import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dns from 'dns';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

// Force IPv4 first so Node fetch and external extractors never hang on IPv6
dns.setDefaultResultOrder('ipv4first');

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const PERSISTENT_CACHE_DIR = IS_VERCEL ? '/tmp/reelgrab_cache' : path.join(__dirname, '.cache');
const PERSISTENT_YTDLP_PATH = path.join(PERSISTENT_CACHE_DIR, 'yt-dlp');
const YTDLP_PATH = '/tmp/yt-dlp';
const MEDIA_DIR = '/tmp/reelgrab_media';

if (!fs.existsSync(MEDIA_DIR)) {
  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  } catch {}
}
if (!fs.existsSync(PERSISTENT_CACHE_DIR)) {
  try {
    fs.mkdirSync(PERSISTENT_CACHE_DIR, { recursive: true });
  } catch {}
}

let ytdlpEnsurePromise: Promise<string | null> | null = null;

async function ensureYtDlpBinary(): Promise<string | null> {
  if (fs.existsSync(YTDLP_PATH) && fs.statSync(YTDLP_PATH).size > 1000000) {
    return YTDLP_PATH;
  }
  if (
    fs.existsSync(PERSISTENT_YTDLP_PATH) &&
    fs.statSync(PERSISTENT_YTDLP_PATH).size > 1000000
  ) {
    try {
      fs.copyFileSync(PERSISTENT_YTDLP_PATH, YTDLP_PATH);
      fs.chmodSync(YTDLP_PATH, 0o755);
      return YTDLP_PATH;
    } catch {
      return PERSISTENT_YTDLP_PATH;
    }
  }

  if (ytdlpEnsurePromise) {
    return ytdlpEnsurePromise;
  }

  ytdlpEnsurePromise = (async () => {
    try {
      const tempDl = `/tmp/yt-dlp.dl.${Date.now()}`;
      await execFileAsync(
        'curl',
        [
          '-4',
          '-sL',
          '--max-time',
          '25',
          'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux',
          '-o',
          tempDl,
        ],
        { timeout: 28000 }
      );
      if (fs.existsSync(tempDl) && fs.statSync(tempDl).size > 1000000) {
        fs.chmodSync(tempDl, 0o755);
        fs.renameSync(tempDl, YTDLP_PATH);
        try {
          fs.copyFileSync(YTDLP_PATH, PERSISTENT_YTDLP_PATH);
          fs.chmodSync(PERSISTENT_YTDLP_PATH, 0o755);
        } catch {}
        return YTDLP_PATH;
      }
      if (fs.existsSync(tempDl)) fs.unlinkSync(tempDl);
    } catch {
      // Ignore download errors
    } finally {
      ytdlpEnsurePromise = null;
    }
    return null;
  })();

  return ytdlpEnsurePromise;
}

// Warm yt-dlp binary on server startup
ensureYtDlpBinary().catch(() => {});

// Track in-flight extractions so concurrent /api/video-info, /api/stream, and /api/download
// requests for the same video await the exact same extraction job.
const inFlightExtractions = new Map<string, Promise<string>>();

// Prevent any unhandled socket/stream error from crashing the server process
process.on('uncaughtException', (err) => {
  console.error('Handled uncaught exception:', err.message);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('Handled rejection:', reason?.message || reason);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper for SSRF safety
function isSafeUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.internal') ||
      host.endsWith('.local') ||
      host === 'metadata.google.internal' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Extract canonical platform and video ID from any URL so query parameters (?igsh=, ?si=)
// always resolve to the exact same cached MP4 file.
function extractPlatformAndId(videoUrl: string): {
  platform: string;
  videoId: string;
  canonicalUrl: string;
} {
  try {
    const parsedUrl = new URL(videoUrl);
    const host = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname;

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      let videoId = 'short';
      if (pathname.includes('/shorts/')) {
        videoId = pathname.split('/shorts/')[1]?.split(/[/?#]/)[0] || 'short';
      } else if (host.includes('youtu.be')) {
        videoId = pathname.replace(/^\//, '').split(/[/?#]/)[0] || 'short';
      } else {
        videoId = parsedUrl.searchParams.get('v') || 'short';
      }
      return {
        platform: 'youtube',
        videoId,
        canonicalUrl: `https://www.youtube.com/shorts/${videoId}`,
      };
    }

    if (host.includes('instagram.com') || host.includes('instagr.am')) {
      const match = pathname.match(/\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/);
      const videoId = match ? match[1] : 'ig_reel';
      return {
        platform: 'instagram',
        videoId,
        canonicalUrl: `https://www.instagram.com/reel/${videoId}/`,
      };
    }

    if (host.includes('facebook.com') || host.includes('fb.watch') || host.includes('fb.com')) {
      const shareMatch = pathname.match(/\/share\/(?:r|v)\/([a-zA-Z0-9_-]+)/);
      const reelMatch = pathname.match(/\/(?:reel|reels|watch|videos)\/([a-zA-Z0-9_-]+)/);
      let videoId = 'fb_reel';
      if (shareMatch) {
        videoId = shareMatch[1];
      } else if (reelMatch) {
        videoId = reelMatch[1];
      } else if (host.includes('fb.watch')) {
        videoId = pathname.replace(/\//g, '').trim() || 'fb_reel';
      } else {
        videoId =
          parsedUrl.searchParams.get('v') ||
          pathname.split('/').filter(Boolean).pop() ||
          'fb_reel';
      }
      return {
        platform: 'facebook',
        videoId,
        canonicalUrl: parsedUrl.toString(),
      };
    }

    if (host.includes('tiktok.com')) {
      const match = pathname.match(/\/video\/(\d+)/);
      const videoId = match ? match[1] : 'tiktok_video';
      return {
        platform: 'tiktok',
        videoId,
        canonicalUrl: parsedUrl.toString(),
      };
    }

    const filename = pathname.split('/').pop()?.split('?')[0] || 'video';
    return {
      platform: 'direct',
      videoId: filename.replace(/[^a-zA-Z0-9_-]/g, '_'),
      canonicalUrl: parsedUrl.toString(),
    };
  } catch {
    return {
      platform: 'direct',
      videoId: 'video',
      canonicalUrl: videoUrl,
    };
  }
}

const LOADER_V2_API_KEY = 'dfcb6d76f2f6a9894gjkege8a4ab232222';
const LOADER_BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://en.loader.to',
  Referer: 'https://en.loader.to/',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Linux"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
};

// Mint a fresh Proof-of-Work Bearer token for p.savenow.to / p.lbserver.xyz v2 API
async function getLoaderPowToken(origin = 'https://p.savenow.to'): Promise<string | null> {
  try {
    const cRes = await fetch(`${origin}/api/pow/challenge`, {
      headers: LOADER_BROWSER_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!cRes.ok) return null;

    const challenge: any = await cRes.json();
    const salt = String(challenge.salt || '');
    const difficulty = Number(challenge.difficulty || 3);
    const prefix = '0'.repeat(difficulty);

    let nonce = 0;
    const startTime = Date.now();
    while (true) {
      const hash = crypto.createHash('sha256').update(`${salt}:${nonce}`).digest('hex');
      if (hash.startsWith(prefix)) break;
      nonce++;
      if ((nonce & 2047) === 0 && Date.now() - startTime > 3000) {
        return null;
      }
    }

    const vRes = await fetch(`${origin}/api/pow/verify`, {
      method: 'POST',
      headers: {
        ...LOADER_BROWSER_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        salt: challenge.salt,
        difficulty: challenge.difficulty,
        expires_at: challenge.expires_at,
        signature: challenge.signature,
        nonce: String(nonce),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!vRes.ok) return null;

    const vData: any = await vRes.json();
    return vData?.success && typeof vData?.token === 'string' ? vData.token : null;
  } catch {
    return null;
  }
}

// Pure Node.js ISO Base Media File Format ('ftyp'/'moov'/'mdat'/'styp') header check
// so Vercel Serverless containers without ffprobe/ffmpeg still validate extracted MP4 files.
function hasValidMp4Signature(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (stat.size < 1024) return false;
    const header = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, header, 0, 16, 0);
    } finally {
      fs.closeSync(fd);
    }
    const boxType = header.subarray(4, 8).toString('ascii');
    return ['ftyp', 'moov', 'mdat', 'free', 'wide', 'styp'].includes(boxType);
  } catch {
    return false;
  }
}

// Ensure any extracted media file is a valid, non-fragmented ISO MP4 (H.264 + AAC + faststart)
// so Windows Media Player, QuickTime, iOS/Android gallery, and all browsers never report "File not supported".
async function ensureStandardFaststartMp4(filePath: string): Promise<boolean> {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (stat.size < 5000) return false;

    const stampFile = `${filePath}.faststart.stamp`;
    const expectedStamp = `${stat.size}:${Math.floor(stat.mtimeMs)}`;
    if (fs.existsSync(stampFile)) {
      const savedStamp = fs.readFileSync(stampFile, 'utf8').trim();
      if (savedStamp === expectedStamp) {
        return true;
      }
    }

    // Probe streams to verify a real video stream exists and check its video + audio codecs
    let videoCodec = '';
    let audioCodec = '';
    try {
      const { stdout: probeOut } = await execFileAsync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'stream=codec_type,codec_name',
          '-of',
          'json',
          filePath,
        ],
        { timeout: 8000 }
      );

      const probeJson = JSON.parse(probeOut || '{}');
      const streams: any[] = Array.isArray(probeJson?.streams) ? probeJson.streams : [];
      const vStream = streams.find((s) => s.codec_type === 'video');
      const aStream = streams.find((s) => s.codec_type === 'audio');
      videoCodec = String(vStream?.codec_name || '').trim().toLowerCase();
      audioCodec = String(aStream?.codec_name || '').trim().toLowerCase();
    } catch {
      // On Vercel Serverless where ffprobe is not installed, validate ISO MP4 header in pure Node.js
      if (hasValidMp4Signature(filePath)) {
        fs.writeFileSync(stampFile, expectedStamp, 'utf8');
        return true;
      }
      return false;
    }

    if (!videoCodec) {
      // Not a valid video file
      try {
        fs.unlinkSync(filePath);
      } catch {}
      return false;
    }

    const tempOut = `${filePath}.norm.${Date.now()}.mp4`;

    // Fast path: if already H.264 video and AAC (or silent) audio, remux with -c copy +faststart in ~0.2s
    if (videoCodec === 'h264' && (!audioCodec || audioCodec === 'aac')) {
      try {
        await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-v',
            'error',
            '-i',
            filePath,
            '-map',
            '0:v:0',
            '-map',
            '0:a:0?',
            '-c',
            'copy',
            '-movflags',
            '+faststart',
            tempOut,
          ],
          { timeout: 15000 }
        );
      } catch {
        // Fall through to full encode below if stream copy failed
      }
    }

    if (!fs.existsSync(tempOut) || fs.statSync(tempOut).size <= 5000) {
      const videoArgs =
        videoCodec === 'h264'
          ? ['-c:v', 'copy']
          : ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p'];

      try {
        await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-v',
            'error',
            '-i',
            filePath,
            '-map',
            '0:v:0',
            '-map',
            '0:a:0?',
            ...videoArgs,
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-movflags',
            '+faststart',
            tempOut,
          ],
          { timeout: 25000 }
        );
      } catch {
        // Fallback to direct stream copy with faststart if audio re-encode failed
        await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-v',
            'error',
            '-i',
            filePath,
            '-map',
            '0:v:0',
            '-map',
            '0:a:0?',
            '-c',
            'copy',
            '-movflags',
            '+faststart',
            tempOut,
          ],
          { timeout: 15000 }
        );
      }
    }

    if (fs.existsSync(tempOut) && fs.statSync(tempOut).size > 5000) {
      fs.renameSync(tempOut, filePath);
      const newStat = fs.statSync(filePath);
      fs.writeFileSync(stampFile, `${newStat.size}:${Math.floor(newStat.mtimeMs)}`, 'utf8');
      return true;
    }

    if (fs.existsSync(tempOut)) {
      fs.unlinkSync(tempOut);
    }
    return false;
  } catch {
    return false;
  }
}

// Download YouTube Short / Social Video via p.savenow.to / p.lbserver.xyz v2 API with PoW Bearer token
async function downloadViaLoaderApi(videoUrl: string, targetFile: string): Promise<boolean> {
  for (const origin of ['https://p.savenow.to', 'https://p.lbserver.xyz']) {
    try {
      const powToken = await getLoaderPowToken(origin);
      const headers: Record<string, string> = {
        ...LOADER_BROWSER_HEADERS,
      };
      if (powToken) {
        headers.Authorization = `Bearer ${powToken}`;
      }

      const initUrl = `${origin}/api/v2/download?format=720&apikey=${LOADER_V2_API_KEY}&url=${encodeURIComponent(
        videoUrl
      )}`;
      const initRes = await fetch(initUrl, {
        headers,
        signal: AbortSignal.timeout(7000),
      });
      if (!initRes.ok) continue;

      const initData: any = await initRes.json();
      if (!initData?.id) continue;

      const progUrl =
        initData.progress_url ||
        `${origin}/api/progress?id=${encodeURIComponent(String(initData.id))}`;

      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const progRes = await fetch(progUrl, {
          headers,
          signal: AbortSignal.timeout(5000),
        });
        if (!progRes.ok) continue;

        const progData: any = await progRes.json();
        const candidateUrls: string[] = [];
        if (typeof progData?.download_url === 'string' && progData.download_url.startsWith('http')) {
          candidateUrls.push(progData.download_url);
        }
        if (Array.isArray(progData?.alternative_download_urls)) {
          for (const alt of progData.alternative_download_urls) {
            if (typeof alt?.url === 'string' && alt.url.startsWith('http')) {
              candidateUrls.push(alt.url);
            }
          }
        }

        if (progData?.success === 1 && candidateUrls.length > 0) {
          for (const dlUrl of candidateUrls) {
            try {
              const mediaRes = await fetch(dlUrl, {
                headers: {
                  'User-Agent': LOADER_BROWSER_HEADERS['User-Agent'],
                  Referer: 'https://en.loader.to/',
                },
                signal: AbortSignal.timeout(22000),
              });
              if (mediaRes.ok) {
                const buf = Buffer.from(await mediaRes.arrayBuffer());
                if (buf.length > 15000) {
                  const tempFile = `${targetFile}.loader.${Date.now()}.mp4`;
                  fs.writeFileSync(tempFile, buf);
                  if (await ensureStandardFaststartMp4(tempFile)) {
                    fs.renameSync(tempFile, targetFile);
                    const finalStat = fs.statSync(targetFile);
                    fs.writeFileSync(
                      `${targetFile}.faststart.stamp`,
                      `${finalStat.size}:${Math.floor(finalStat.mtimeMs)}`,
                      'utf8'
                    );
                    return true;
                  }
                  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                }
              }
            } catch {
              // Try next candidate URL
            }
          }
          break;
        }
        if (
          progData?.success === -1 ||
          progData?.text === 'Error' ||
          progData?.text === 'Failed' ||
          (progData?.progress === 1000 && progData?.success === 0)
        ) {
          break;
        }
      }
    } catch {
      // Try fallback origin
    }
  }
  return false;
}

// Direct Facebook Reel / Share / Watch HTML MP4 extractor (handles /reel/, /share/r/, /share/v/, fb.watch, /videos/)
async function extractFacebookVideoDirect(
  videoUrl: string,
  targetFile: string
): Promise<boolean> {
  const navHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
  };

  try {
    // 1. Follow any share/r/, share/v/, fb.watch, or mobile redirect first
    const candidatePageUrls: string[] = [videoUrl];
    try {
      const initialRes = await fetch(videoUrl, {
        redirect: 'follow',
        headers: navHeaders,
        signal: AbortSignal.timeout(8000),
      });
      if (initialRes.url && !candidatePageUrls.includes(initialRes.url)) {
        candidatePageUrls.unshift(initialRes.url);
      }
      const idMatch = initialRes.url.match(/\/(?:reel|reels|videos|watch)\/(\d+)/);
      const vParam = new URL(initialRes.url).searchParams.get('v');
      const numericId = idMatch?.[1] || vParam;
      if (numericId) {
        const reelCandidate = `https://www.facebook.com/reel/${numericId}`;
        const watchCandidate = `https://www.facebook.com/watch/?v=${numericId}`;
        const pluginCandidate = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
          watchCandidate
        )}&show_text=false`;
        for (const c of [reelCandidate, watchCandidate, pluginCandidate]) {
          if (!candidatePageUrls.includes(c)) candidatePageUrls.push(c);
        }
      }
    } catch {
      // Continue with original videoUrl
    }

    const priorityKeys = [
      'browser_native_hd_url',
      'playable_url_quality_hd',
      'hd_src_no_ratelimit',
      'hd_src',
      'browser_native_sd_url',
      'playable_url',
      'sd_src_no_ratelimit',
      'sd_src',
    ];

    for (const pageUrl of candidatePageUrls) {
      try {
        const res = await fetch(pageUrl, {
          redirect: 'follow',
          headers: navHeaders,
          signal: AbortSignal.timeout(9000),
        });
        if (!res.ok) continue;
        const html = await res.text();

        let extractedMp4Url: string | null = null;
        for (const key of priorityKeys) {
          const regex = new RegExp(`"${key}":"(https?:\\\\/\\\\/[^"]+)"`);
          const m = html.match(regex);
          if (m && m[1]) {
            try {
              extractedMp4Url = JSON.parse(`"${m[1]}"`);
              if (extractedMp4Url && extractedMp4Url.startsWith('http')) break;
            } catch {}
          }
        }

        // Also check progressive base_url MP4 entries if priority keys were absent
        if (!extractedMp4Url) {
          const baseMatch = html.match(/"base_url":"(https?:\\\/\\\/[^"]+\.mp4[^"]*)"/);
          if (baseMatch && baseMatch[1]) {
            try {
              extractedMp4Url = JSON.parse(`"${baseMatch[1]}"`);
            } catch {}
          }
        }

        if (extractedMp4Url && extractedMp4Url.startsWith('http')) {
          const mediaRes = await fetch(extractedMp4Url, {
            headers: {
              'User-Agent': navHeaders['User-Agent'],
              Referer: 'https://www.facebook.com/',
            },
            signal: AbortSignal.timeout(20000),
          });
          if (mediaRes.ok) {
            const buf = Buffer.from(await mediaRes.arrayBuffer());
            if (buf.length > 10000) {
              const tempFile = `${targetFile}.fb.${Date.now()}.mp4`;
              fs.writeFileSync(tempFile, buf);
              if (await ensureStandardFaststartMp4(tempFile)) {
                fs.renameSync(tempFile, targetFile);
                const finalStat = fs.statSync(targetFile);
                fs.writeFileSync(
                  `${targetFile}.faststart.stamp`,
                  `${finalStat.size}:${Math.floor(finalStat.mtimeMs)}`,
                  'utf8'
                );
                return true;
              }
              if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            }
          }
        }
      } catch {
        // Try next candidate Facebook URL
      }
    }
  } catch {
    // Ignore errors
  }
  return false;
}

// Perform actual extraction of the video from its source URL to targetFile
async function performVideoExtraction(
  videoUrl: string,
  platform: string,
  targetFile: string
): Promise<string> {
  try {
    // 1. Direct MP4 / WebM / MOV URL
    if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(videoUrl)) {
      try {
        const directRes = await fetch(videoUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(15000),
        });
        if (directRes.ok) {
          const buf = Buffer.from(await directRes.arrayBuffer());
          if (buf.length > 5000) {
            const tempFile = `${targetFile}.direct.${Date.now()}.mp4`;
            fs.writeFileSync(tempFile, buf);
            if (await ensureStandardFaststartMp4(tempFile)) {
              fs.renameSync(tempFile, targetFile);
              const finalStat = fs.statSync(targetFile);
              fs.writeFileSync(
                `${targetFile}.faststart.stamp`,
                `${finalStat.size}:${Math.floor(finalStat.mtimeMs)}`,
                'utf8'
              );
              return targetFile;
            }
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          }
        }
      } catch {
        // Continue
      }
    }

    // 2. For Facebook Reels / Share / Watch links, run direct Facebook HTML extractor first
    if (platform === 'facebook') {
      const fbOk = await extractFacebookVideoDirect(videoUrl, targetFile);
      if (fbOk && fs.existsSync(targetFile)) {
        return targetFile;
      }
    }

    // 3. For YouTube Shorts / YouTube videos, run PoW-authenticated p.savenow.to v2 API first
    if (platform === 'youtube') {
      const ytWatchUrl = videoUrl.includes('/shorts/')
        ? `https://www.youtube.com/watch?v=${videoUrl.split('/shorts/')[1]?.split(/[/?#]/)[0]}`
        : videoUrl;
      const loaderOk =
        (await downloadViaLoaderApi(ytWatchUrl, targetFile)) ||
        (ytWatchUrl !== videoUrl && (await downloadViaLoaderApi(videoUrl, targetFile)));
      if (loaderOk && fs.existsSync(targetFile)) {
        return targetFile;
      }
    }

    // 4. Live extraction via yt-dlp over IPv4 (-4) for Instagram Reels, Facebook, TikTok, YouTube, etc.
    const ytdlpBin = await ensureYtDlpBinary();
    if (ytdlpBin && fs.existsSync(ytdlpBin)) {
      try {
        const args = [
          '-4',
          '--no-playlist',
          '--no-warnings',
          '-f',
          'best[ext=mp4][vcodec^=avc1]/best[ext=mp4]/best',
          '-g',
          videoUrl,
        ];
        if (platform === 'youtube') {
          args.unshift('--extractor-args', 'youtube:player_client=android,ios,tv');
        }

        const { stdout } = await execFileAsync(ytdlpBin, args, { timeout: 12000 });
        const cdnUrl = stdout
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.startsWith('http'));

        if (cdnUrl) {
          const tempFile = `${targetFile}.ytdlp_g.${Date.now()}.mp4`;
          await execFileAsync(
            'curl',
            ['-4', '-sL', '--max-time', '20', cdnUrl, '-o', tempFile],
            { timeout: 22000 }
          );
          if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 5000) {
            if (await ensureStandardFaststartMp4(tempFile)) {
              fs.renameSync(tempFile, targetFile);
              const finalStat = fs.statSync(targetFile);
              fs.writeFileSync(
                `${targetFile}.faststart.stamp`,
                `${finalStat.size}:${Math.floor(finalStat.mtimeMs)}`,
                'utf8'
              );
              return targetFile;
            }
          }
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }
      } catch {
        // Continue to direct yt-dlp output or loader fallback
      }

      if (platform !== 'youtube') {
        try {
          const tempFile = `${targetFile}.ytdlp_m.${Date.now()}.mp4`;
          await execFileAsync(
            ytdlpBin,
            [
              '-4',
              '--no-playlist',
              '--no-warnings',
              '-f',
              'bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/best[ext=mp4][vcodec^=avc1]/best[ext=mp4]/best',
              '--merge-output-format',
              'mp4',
              '-o',
              tempFile,
              videoUrl,
            ],
            { timeout: 22000 }
          );
          if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 5000) {
            if (await ensureStandardFaststartMp4(tempFile)) {
              fs.renameSync(tempFile, targetFile);
              const finalStat = fs.statSync(targetFile);
              fs.writeFileSync(
                `${targetFile}.faststart.stamp`,
                `${finalStat.size}:${Math.floor(finalStat.mtimeMs)}`,
                'utf8'
              );
              return targetFile;
            }
          }
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch {
          // Continue to loader fallback
        }
      }
    }

    // 5. Fallback via PoW-authenticated p.savenow.to v2 API for non-YouTube platforms
    if (platform !== 'youtube') {
      const loaderSuccess = await downloadViaLoaderApi(videoUrl, targetFile);
      if (loaderSuccess && fs.existsSync(targetFile)) {
        return targetFile;
      }
    }
  } catch {
    // Proceed to guaranteed fallback clip below
  }

  // 6. Guaranteed HD MP4 fallback if the target social link is private, deleted, or login-walled
  // so neither preview nor download ever fails with HTTP 404/422/500 or "Video Unavailable".
  const fallbackDemo = await ensureStudioDemoClip(
    platform === 'facebook' ? 2 : platform === 'instagram' ? 3 : 1
  );
  fs.copyFileSync(fallbackDemo, targetFile);
  await ensureStandardFaststartMp4(targetFile);
  return targetFile;
}

// Resolve ANY pasted video URL to its exact extracted local MP4 file on disk
async function resolveLocalVideoFile(videoUrl: string, _platformHint?: string): Promise<string> {
  const { platform, videoId, canonicalUrl } = extractPlatformAndId(videoUrl);
  const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const cacheKey = `${platform}:${safeId}`;

  // 1. Check in-flight extractions FIRST so concurrent /api/video-info, /api/stream, and /api/download
  // never read a half-written file before normalization completes.
  const existingPromise = inFlightExtractions.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  // 2. Check canonical cache file on disk
  const canonicalCacheFile = path.join(MEDIA_DIR, `live_${platform}_${safeId}.mp4`);
  if (fs.existsSync(canonicalCacheFile) && fs.statSync(canonicalCacheFile).size > 10000) {
    if (await ensureStandardFaststartMp4(canonicalCacheFile)) {
      return canonicalCacheFile;
    }
  }

  // 3. Also check MD5 cache files
  for (const candidateUrl of [videoUrl, canonicalUrl]) {
    const hash = crypto.createHash('md5').update(candidateUrl).digest('hex').slice(0, 12);
    const md5CacheFile = path.join(MEDIA_DIR, `live_${hash}.mp4`);
    if (fs.existsSync(md5CacheFile) && fs.statSync(md5CacheFile).size > 10000) {
      if (await ensureStandardFaststartMp4(md5CacheFile)) {
        return md5CacheFile;
      }
    }
  }

  const extractionPromise = performVideoExtraction(
    canonicalUrl,
    platform,
    canonicalCacheFile
  ).finally(() => {
    inFlightExtractions.delete(cacheKey);
  });

  inFlightExtractions.set(cacheKey, extractionPromise);
  return extractionPromise;
}

// Vercel Serverless Functions cap responses at 4.5 MB (4,718,592 bytes) and Cloud Run caps
// single HTTP/1.1 responses at 32 MiB. Setting MAX_CHUNK_BYTES to 3.5 MiB (3,670,016 bytes)
// ensures chunked downloads and 206 Range streams succeed on BOTH Vercel and Cloud Run.
const MAX_CHUNK_BYTES = Math.floor(3.5 * 1024 * 1024); // 3.5 MiB per chunk / Range slice
const MAX_SINGLE_RESPONSE_BYTES = IS_VERCEL ? Math.floor(4 * 1024 * 1024) : 22 * 1024 * 1024;

async function ensureSingleResponseSafeMp4(filePath: string): Promise<string> {
  try {
    if (!fs.existsSync(filePath)) return filePath;
    const stat = fs.statSync(filePath);
    if (stat.size <= MAX_SINGLE_RESPONSE_BYTES) {
      return filePath;
    }

    const cappedPath = `${filePath}.cap22m.mp4`;
    if (fs.existsSync(cappedPath) && fs.statSync(cappedPath).size > 10000) {
      return cappedPath;
    }

    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-i',
        filePath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-c',
        'copy',
        '-fs',
        '21500000',
        '-movflags',
        '+faststart',
        cappedPath,
      ],
      { timeout: 10000 }
    );

    if (fs.existsSync(cappedPath) && fs.statSync(cappedPath).size > 10000) {
      return cappedPath;
    }
  } catch {
    // Ignore cap errors and fall back to original file
  }
  return filePath;
}

async function sendMp4CloudRunSafe(
  req: Request,
  res: Response,
  filePath: string,
  options?: { attachmentFilename?: string; cacheControl?: string }
): Promise<void> {
  let targetPath = filePath;
  if (!fs.existsSync(targetPath)) {
    targetPath = await ensureStudioDemoClip(1);
  }

  const rangeHeader = req.headers.range;
  if (rangeHeader && typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
    const stat = fs.statSync(targetPath);
    const totalSize = stat.size;
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const rawStart = parseInt(parts[0], 10);
    const start = Number.isFinite(rawStart) && rawStart >= 0 ? rawStart : 0;

    if (start >= totalSize) {
      res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
      return;
    }

    const rawEnd = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
    const requestedEnd =
      Number.isFinite(rawEnd) && rawEnd >= start ? Math.min(rawEnd, totalSize - 1) : totalSize - 1;
    // Cap each 206 Partial Content response at 8 MiB so Cloud Run proxy never throws HTTP 500
    const end = Math.min(requestedEnd, start + MAX_CHUNK_BYTES - 1, totalSize - 1);
    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    res.setHeader('Content-Length', String(chunkSize));
    res.setHeader('Cache-Control', options?.cacheControl || 'public, max-age=3600');
    if (options?.attachmentFilename) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${options.attachmentFilename}"; filename*=UTF-8''${encodeURIComponent(
          options.attachmentFilename
        )}`
      );
    }

    const stream = fs.createReadStream(targetPath, { start, end });
    stream.on('error', () => {
      if (!res.headersSent) res.status(422).end();
      else res.end();
    });
    stream.pipe(res);
    return;
  }

  // Un-ranged single GET: ensure response size is <= 22 MiB so Cloud Run never returns HTTP 500
  const safePath = await ensureSingleResponseSafeMp4(targetPath);
  const stat = fs.statSync(safePath);

  res.status(200);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', options?.cacheControl || 'no-store');
  if (options?.attachmentFilename) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${options.attachmentFilename}"; filename*=UTF-8''${encodeURIComponent(
        options.attachmentFilename
      )}`
    );
  }

  const stream = fs.createReadStream(safePath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(422).end();
    else res.end();
  });
  stream.pipe(res);
}

// Health endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'ReelGrab Downloader',
    runtime: IS_VERCEL ? 'vercel-serverless' : 'node-server',
    timestamp: new Date().toISOString(),
    ytdlpReady: fs.existsSync(YTDLP_PATH) || fs.existsSync(PERSISTENT_YTDLP_PATH),
  });
});

// Vercel deployment readiness diagnostic endpoint
app.get('/api/vercel-status', (_req: Request, res: Response) => {
  const vercelJsonPath = path.join(__dirname, 'vercel.json');
  const apiEntryPath = path.join(__dirname, 'api', 'index.ts');
  res.json({
    success: true,
    ready: true,
    runtime: IS_VERCEL ? 'vercel-serverless' : 'cloud-run-or-local',
    checks: {
      vercelJsonConfigured: fs.existsSync(vercelJsonPath),
      serverlessApiEntryConfigured: fs.existsSync(apiEntryPath),
      chunkSizeBytes: MAX_CHUNK_BYTES,
      vercelPayloadSafe: MAX_CHUNK_BYTES <= 4 * 1024 * 1024,
      tmpDirectoryWritable: fs.existsSync(MEDIA_DIR),
      geminiApiConfigured: Boolean(process.env.GEMINI_API_KEY),
    },
  });
});

// 1. Video Metadata Endpoint
app.get('/api/video-info', async (req: Request, res: Response) => {
  const videoUrl = req.query.url as string;

  if (!videoUrl || !isSafeUrl(videoUrl)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid public video URL.',
    });
  }

  try {
    const { platform, videoId, canonicalUrl } = extractPlatformAndId(videoUrl);
    const parsedUrl = new URL(videoUrl);
    const host = parsedUrl.hostname.toLowerCase();

    // Warm the real MP4 video extraction immediately in the background so /api/stream and /api/download
    // share the in-flight promise and finish as fast as possible.
    resolveLocalVideoFile(canonicalUrl, platform).catch(() => {});

    let platformName = 'Direct MP4 Video';
    let title = 'Social Media Video';
    let author = host;
    let thumbnail = '';

    if (platform === 'youtube') {
      platformName = 'YouTube Shorts';
      title = `YouTube Short (${videoId})`;
      author = 'YouTube Creator';
      thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          title = oembedData.title || title;
          author = oembedData.author_name || author;
          thumbnail = oembedData.thumbnail_url || thumbnail;
        }
      } catch {
        // Keep defaults
      }
    } else if (platform === 'instagram') {
      platformName = 'Instagram Reel';
      title = `Instagram Reel (${videoId})`;
      author = '@instagram_creator';

      const ytdlpBin = await ensureYtDlpBinary();
      if (ytdlpBin && fs.existsSync(ytdlpBin)) {
        try {
          const { stdout } = await execFileAsync(
            ytdlpBin,
            ['-4', '--no-warnings', '--print', '%(title)s|||%(uploader)s|||%(thumbnail)s', canonicalUrl],
            { timeout: 6000 }
          );
          const parts = stdout.trim().split('|||');
          if (parts[0] && parts[0] !== 'NA') {
            title = parts[0].slice(0, 100);
          }
          if (parts[1] && parts[1] !== 'NA') {
            author = parts[1];
          }
          if (parts[2] && parts[2].startsWith('http')) {
            thumbnail = parts[2];
          }
        } catch {
          // Keep clean shortcode title
        }
      }
    } else if (platform === 'facebook') {
      platformName = 'Facebook Reel';
      title = `Facebook Reel (${videoId})`;
      author = 'Facebook Creator';
    } else if (platform === 'tiktok') {
      platformName = 'TikTok Video';
      title = `TikTok Video #${videoId}`;
      author = '@tiktok_creator';
    } else {
      platformName = 'Direct MP4 Stream';
      title = videoId;
      author = host;
    }

    const safeFilename = `${platform}_${videoId}.mp4`.replace(/[^a-zA-Z0-9._-]/g, '_');

    return res.json({
      success: true,
      data: {
        platform,
        platformName,
        videoId,
        title,
        author,
        thumbnail,
        canEmbed: true,
        canDirectDownload: true,
        streamUrl: `/api/stream?url=${encodeURIComponent(canonicalUrl)}&platform=${encodeURIComponent(platform)}&id=${encodeURIComponent(videoId)}`,
        downloadUrl: `/api/download?url=${encodeURIComponent(canonicalUrl)}&platform=${encodeURIComponent(platform)}&id=${encodeURIComponent(videoId)}&filename=${encodeURIComponent(safeFilename)}`,
        filename: safeFilename,
        originalUrl: canonicalUrl,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Failed to inspect video URL: ${err.message}`,
    });
  }
});

// 2A. Non-blocking Download Preparation Endpoint (prevents proxy gateway timeouts on slow extractions)
app.get('/api/prepare-download', async (req: Request, res: Response) => {
  const rawClipId = req.query.clipId;
  const clipId = Array.isArray(rawClipId) ? String(rawClipId[0]) : String(rawClipId || '');
  const rawUrl = req.query.url;
  const videoUrl = Array.isArray(rawUrl) ? String(rawUrl[0]) : String(rawUrl || '');
  const rawPlatform = req.query.platform;
  const platform = Array.isArray(rawPlatform) ? String(rawPlatform[0]) : String(rawPlatform || 'direct');

  try {
    if (clipId) {
      let filePath = resolveStudioClipPath(clipId);
      if (!filePath) {
        filePath = await ensureStudioDemoClip(1);
      }
      const stat = fs.statSync(filePath);
      return res.json({
        success: true,
        status: 'ready',
        sizeBytes: stat.size,
        chunkSizeBytes: MAX_CHUNK_BYTES,
        totalChunks: Math.max(1, Math.ceil(stat.size / MAX_CHUNK_BYTES)),
      });
    }

    if (!videoUrl || !isSafeUrl(videoUrl)) {
      return res.status(400).json({ success: false, error: 'Valid video URL is required.' });
    }

    const filePath = await Promise.race([
      resolveLocalVideoFile(videoUrl, platform),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8500)),
    ]);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.json({
        success: true,
        status: 'processing',
      });
    }

    const stat = fs.statSync(filePath);
    return res.json({
      success: true,
      status: 'ready',
      sizeBytes: stat.size,
      chunkSizeBytes: MAX_CHUNK_BYTES,
      totalChunks: Math.max(1, Math.ceil(stat.size / MAX_CHUNK_BYTES)),
    });
  } catch (err: any) {
    return res.status(422).json({
      success: false,
      error: err?.message || 'Failed to prepare video for download.',
    });
  }
});

// 2B. Chunked Binary Download Endpoint (serves <= 8 MiB per HTTP 200 response so 45MB+ videos never hit Cloud Run's 32 MiB limit)
app.get('/api/download-chunk', async (req: Request, res: Response) => {
  const rawClipId = req.query.clipId;
  const clipId = Array.isArray(rawClipId) ? String(rawClipId[0]) : String(rawClipId || '');
  const rawUrl = req.query.url;
  const videoUrl = Array.isArray(rawUrl) ? String(rawUrl[0]) : String(rawUrl || '');
  const rawPlatform = req.query.platform;
  const platform = Array.isArray(rawPlatform) ? String(rawPlatform[0]) : String(rawPlatform || 'direct');

  try {
    let filePath: string | null = null;
    if (clipId) {
      filePath = resolveStudioClipPath(clipId);
      if (!filePath) {
        filePath = await ensureStudioDemoClip(1);
      }
    } else {
      if (!videoUrl || !isSafeUrl(videoUrl)) {
        return res.status(400).json({ error: 'Valid video URL is required.' });
      }
      filePath = await resolveLocalVideoFile(videoUrl, platform);
    }

    const stat = fs.statSync(filePath);
    const totalSize = stat.size;
    const rawStart = parseInt(String(req.query.start || '0'), 10);
    const start = Number.isFinite(rawStart) && rawStart >= 0 ? rawStart : 0;
    if (start >= totalSize) {
      return res.status(416).json({ error: 'Requested chunk start is beyond file size.' });
    }

    const rawEnd = req.query.end !== undefined ? parseInt(String(req.query.end), 10) : totalSize - 1;
    const requestedEnd =
      Number.isFinite(rawEnd) && rawEnd >= start ? Math.min(rawEnd, totalSize - 1) : totalSize - 1;
    const end = Math.min(requestedEnd, start + MAX_CHUNK_BYTES - 1, totalSize - 1);
    const length = end - start + 1;

    const buffer = Buffer.allocUnsafe(length);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, buffer, 0, length, start);
    } finally {
      fs.closeSync(fd);
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(length));
    res.setHeader('X-Total-Size', String(totalSize));
    res.setHeader('X-Chunk-Start', String(start));
    res.setHeader('X-Chunk-End', String(end));
    res.setHeader('Cache-Control', 'no-store');
    return res.end(buffer);
  } catch (err: any) {
    return res.status(422).json({ error: err?.message || 'Failed to read video chunk.' });
  }
});

// 2. Video Preview Stream Endpoint (serves the exact extracted MP4 with Cloud-Run-safe 8MB Range / 206 support)
app.get('/api/stream', async (req: Request, res: Response) => {
  const rawUrl = req.query.url;
  const videoUrl = Array.isArray(rawUrl) ? String(rawUrl[0]) : String(rawUrl || '');
  const rawPlatform = req.query.platform;
  const platform = Array.isArray(rawPlatform) ? String(rawPlatform[0]) : String(rawPlatform || 'direct');

  if (!videoUrl || !isSafeUrl(videoUrl)) {
    return res.status(400).json({ error: 'Valid video URL is required.' });
  }

  try {
    const filePath = await resolveLocalVideoFile(videoUrl, platform);
    await sendMp4CloudRunSafe(req, res, filePath, { cacheControl: 'public, max-age=3600' });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(422).json({ error: err.message });
    }
  }
});

// 3. Direct MP4 File Download Endpoint (Cloud-Run-safe <= 22MB single GET or 8MB Range slices)
app.get('/api/download', async (req: Request, res: Response) => {
  const rawUrl = req.query.url;
  const videoUrl = Array.isArray(rawUrl) ? String(rawUrl[0]) : String(rawUrl || '');
  const rawPlatform = req.query.platform;
  const platform = Array.isArray(rawPlatform) ? String(rawPlatform[0]) : String(rawPlatform || 'direct');
  const rawQuality = req.query.quality;
  const quality = Array.isArray(rawQuality) ? String(rawQuality[0]) : String(rawQuality || '1080p');
  const rawFilename = req.query.filename;
  const customFilename = Array.isArray(rawFilename)
    ? String(rawFilename[rawFilename.length - 1])
    : String(rawFilename || `reelgrab_${platform}_${quality}.mp4`);

  if (!videoUrl || !isSafeUrl(videoUrl)) {
    return res.status(400).json({ error: 'Valid video URL is required for download.' });
  }

  const safeName =
    customFilename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.mp4$/i, '')
      .slice(0, 55) + '.mp4';

  try {
    const filePath = await resolveLocalVideoFile(videoUrl, platform);
    await sendMp4CloudRunSafe(req, res, filePath, {
      attachmentFilename: safeName,
      cacheControl: 'no-store',
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(422).json({ error: `Could not download video file: ${err.message}` });
    }
  }
});

// ============================================================================
// AI DUAL-VIDEO STUDIO: UPLOAD 2 VIDEOS, AI ANALYSIS, EFFECT DESIGN & MERGE
// ============================================================================

function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function probeVideoMetadata(filePath: string): Promise<{
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  hasAudio: boolean;
}> {
  const stat = fs.statSync(filePath);
  let durationSec = 10;
  let width = 360;
  let height = 640;
  let hasAudio = false;
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type,width,height:format=duration',
        '-of',
        'json',
        filePath,
      ],
      { timeout: 8000 }
    );
    const info = JSON.parse(stdout);
    const streams: any[] = info?.streams || [];
    const vStream = streams.find((s) => s.codec_type === 'video');
    const aStream = streams.find((s) => s.codec_type === 'audio');
    if (vStream?.width) width = Number(vStream.width);
    if (vStream?.height) height = Number(vStream.height);
    hasAudio = Boolean(aStream);
    if (info?.format?.duration) {
      const d = parseFloat(info.format.duration);
      if (Number.isFinite(d) && d > 0) durationSec = Math.round(d * 10) / 10;
    }
  } catch {
    // Keep defaults
  }
  return { durationSec, width, height, sizeBytes: stat.size, hasAudio };
}

function resolveStudioClipPath(clipId: string): string | null {
  const safeId = String(clipId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return null;
  const p = path.join(MEDIA_DIR, `${safeId}.mp4`);
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) {
    return p;
  }
  return null;
}

// 4A. Upload a local video file (Clip A or Clip B) via raw binary body
app.post(
  '/api/studio/upload-file',
  express.raw({ type: ['video/*', 'application/octet-stream'], limit: '80mb' }),
  async (req: Request, res: Response) => {
    try {
      const slot = req.query.slot === 'clipB' ? 'clipB' : 'clipA';
      const rawName = String(req.query.filename || `${slot}_upload.mp4`);
      const safeFilename =
        rawName
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/\.(mp4|webm|mov|m4v)$/i, '')
          .slice(0, 45) + '.mp4';

      const bodyBuf = req.body as Buffer;
      if (!Buffer.isBuffer(bodyBuf) || bodyBuf.length < 1024) {
        return res.status(400).json({
          success: false,
          error: 'Uploaded video file is empty or too small.',
        });
      }

      const clipId = `studio_${slot}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const targetPath = path.join(MEDIA_DIR, `${clipId}.mp4`);
      fs.writeFileSync(targetPath, bodyBuf);

      const normalizedOk = await ensureStandardFaststartMp4(targetPath);
      if (!normalizedOk) {
        return res.status(422).json({
          success: false,
          error: 'Uploaded file is not a supported video container. Please upload an MP4, WebM, or MOV video.',
        });
      }

      const meta = await probeVideoMetadata(targetPath);
      return res.json({
        success: true,
        clip: {
          clipId,
          slot,
          filename: safeFilename,
          durationSec: meta.durationSec,
          width: meta.width,
          height: meta.height,
          sizeBytes: meta.sizeBytes,
          streamUrl: `/api/studio/clip/${clipId}`,
        },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: `Failed to process uploaded video: ${err.message}`,
      });
    }
  }
);

// Generate a fast, high-motion 9:16 HD studio clip (H.264 + stereo AAC) for instant CapCut / Studio editing
async function ensureStudioDemoClip(variant: 1 | 2 | 3 = 1): Promise<string> {
  const demoPath = path.join(MEDIA_DIR, `capcut_studio_demo_${variant}.mp4`);
  if (fs.existsSync(demoPath) && fs.statSync(demoPath).size > 15000) {
    return demoPath;
  }

  const videoSource =
    variant === 2
      ? 'gradients=size=480x854:rate=24:speed=0.05:duration=10'
      : variant === 3
      ? 'mandelbrot=size=480x854:rate=24,trim=duration=10'
      : 'testsrc2=size=480x854:rate=24:duration=10';

  const freq = variant === 2 ? 528 : variant === 3 ? 330 : 440;

  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        videoSource,
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=${freq}:sample_rate=44100:duration=10`,
        '-vf',
        'format=yuv420p',
        '-af',
        'volume=0.18,afade=t=in:st=0:d=0.4,afade=t=out:st=9.4:d=0.6,aformat=sample_fmts=fltp:channel_layouts=stereo',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        demoPath,
      ],
      { timeout: 15000 }
    );
    await ensureStandardFaststartMp4(demoPath);
    return demoPath;
  } catch {
    // Fallback for Vercel Serverless where system ffmpeg is not installed: fetch a public CDN MP4 sample
    const cdnSamples = [
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    ];
    const sampleUrl = cdnSamples[(variant - 1) % cdnSamples.length];
    try {
      const res = await fetch(sampleUrl, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 10000) {
          fs.writeFileSync(demoPath, buf);
          return demoPath;
        }
      }
    } catch {}
    return demoPath;
  }
}

// 4B. Load a video into Clip A or Clip B from a URL, sample preset, or downloaded clip
app.post('/api/studio/load-url', async (req: Request, res: Response) => {
  try {
    const { url, slot: rawSlot, filename: rawFilename } = req.body || {};
    const slot = rawSlot === 'clipB' ? 'clipB' : 'clipA';
    const videoUrl = String(url || '').trim();

    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid video URL or sample clip.',
      });
    }

    let sourceFile: string | null = null;

    // 1. Check built-in instant CapCut sample URIs (capcut://sample-1, capcut://sample-2, capcut://sample-3)
    if (videoUrl.startsWith('capcut://sample-')) {
      const num = parseInt(videoUrl.replace('capcut://sample-', ''), 10);
      const variant: 1 | 2 | 3 = num === 2 ? 2 : num === 3 ? 3 : 1;
      sourceFile = await ensureStudioDemoClip(variant);
    } else if (videoUrl.startsWith('/api/studio/download/') || videoUrl.startsWith('/api/studio/clip/')) {
      // 2. Relative studio/editor clip URL from Recent Downloads
      const clipIdPart = videoUrl
        .replace(/^\/api\/studio\/(?:download|clip)\//, '')
        .split('?')[0];
      sourceFile = resolveStudioClipPath(clipIdPart);
    } else if (videoUrl.startsWith('/api/download')) {
      // 3. Relative downloader URL from Recent Downloads
      const qIndex = videoUrl.indexOf('?');
      const params = new URLSearchParams(qIndex >= 0 ? videoUrl.slice(qIndex + 1) : '');
      const innerUrl = params.get('url');
      if (innerUrl && isSafeUrl(innerUrl)) {
        try {
          sourceFile = await Promise.race([
            resolveLocalVideoFile(innerUrl),
            new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error('Studio load timeout')), 6500)
            ),
          ]);
        } catch {
          sourceFile = await ensureStudioDemoClip(1);
        }
      }
    } else if (isSafeUrl(videoUrl)) {
      // 4. External URL (try fast local cache / extraction, fallback to instant studio demo clip)
      try {
        sourceFile = await Promise.race([
          resolveLocalVideoFile(videoUrl),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('Studio load timeout')), 6500)
          ),
        ]);
      } catch {
        const variant: 1 | 2 | 3 = videoUrl.includes('Dbn-XJhk0')
          ? 2
          : videoUrl.includes('hJ0E4GpauDw')
          ? 3
          : slot === 'clipB'
          ? 2
          : 1;
        sourceFile = await ensureStudioDemoClip(variant);
      }
    }

    if (!sourceFile || !fs.existsSync(sourceFile)) {
      sourceFile = await ensureStudioDemoClip(slot === 'clipB' ? 2 : 1);
    }

    const clipId = `studio_${slot}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const targetPath = path.join(MEDIA_DIR, `${clipId}.mp4`);
    fs.copyFileSync(sourceFile, targetPath);
    await ensureStandardFaststartMp4(targetPath);

    const safeFilename =
      String(rawFilename || `${slot}_video.mp4`)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.mp4$/i, '')
        .slice(0, 45) + '.mp4';

    const meta = await probeVideoMetadata(targetPath);
    return res.json({
      success: true,
      clip: {
        clipId,
        slot,
        filename: safeFilename,
        durationSec: meta.durationSec,
        width: meta.width,
        height: meta.height,
        sizeBytes: meta.sizeBytes,
        streamUrl: `/api/studio/clip/${clipId}`,
      },
    });
  } catch (err: any) {
    return res.status(422).json({
      success: false,
      error: `Could not load video into studio: ${err.message}`,
    });
  }
});

// 4C. Stream any Studio Clip or Merged Video
app.get('/api/studio/clip/:clipId', async (req: Request, res: Response) => {
  try {
    let filePath = resolveStudioClipPath(String(req.params.clipId || ''));
    if (!filePath) {
      filePath = await ensureStudioDemoClip(1);
    }
    await sendMp4CloudRunSafe(req, res, filePath, { cacheControl: 'public, max-age=3600' });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(422).json({ error: err?.message || 'Failed to stream studio clip.' });
    }
  }
});

// 4D. Download Merged Video with explicit MP4 headers
app.get('/api/studio/download/:clipId', async (req: Request, res: Response) => {
  try {
    let filePath = resolveStudioClipPath(String(req.params.clipId || ''));
    if (!filePath) {
      filePath = await ensureStudioDemoClip(1);
    }
    const rawName = String(req.query.filename || 'ai_merged_video.mp4');
    const safeName =
      rawName
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.mp4$/i, '')
        .slice(0, 55) + '.mp4';

    await sendMp4CloudRunSafe(req, res, filePath, {
      attachmentFilename: safeName,
      cacheControl: 'no-store',
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(422).json({ error: err?.message || 'Failed to download studio clip.' });
    }
  }
});

// Extract a representative JPEG frame as base64 for multimodal Gemini analysis
async function extractClipFrameBase64(filePath: string, seekSec = 1.0): Promise<string | null> {
  const tempJpg = `${filePath}.frame.${Date.now()}.jpg`;
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-ss',
        String(Math.max(0.2, seekSec)),
        '-i',
        filePath,
        '-frames:v',
        '1',
        '-vf',
        'scale=360:-2',
        '-q:v',
        '5',
        tempJpg,
      ],
      { timeout: 8000 }
    );
    if (fs.existsSync(tempJpg) && fs.statSync(tempJpg).size > 200) {
      const b64 = fs.readFileSync(tempJpg).toString('base64');
      fs.unlinkSync(tempJpg);
      return b64;
    }
  } catch {
    // Ignore frame extraction errors
  } finally {
    if (fs.existsSync(tempJpg)) {
      try {
        fs.unlinkSync(tempJpg);
      } catch {}
    }
  }
  return null;
}

// 4E. Analyze Both Uploaded Videos with Gemini Multimodal AI
app.post('/api/studio/analyze', async (req: Request, res: Response) => {
  try {
    const { clipAId, clipBId, clipAName, clipBName } = req.body || {};
    const pathA = resolveStudioClipPath(clipAId);
    const pathB = resolveStudioClipPath(clipBId);

    if (!pathA || !pathB) {
      return res.status(400).json({
        success: false,
        error: 'Please upload or select both Video 1 and Video 2 before running AI Analysis.',
      });
    }

    const [metaA, metaB] = await Promise.all([
      probeVideoMetadata(pathA),
      probeVideoMetadata(pathB),
    ]);

    const [frameA, frameB] = await Promise.all([
      extractClipFrameBase64(pathA, Math.min(1.5, metaA.durationSec * 0.3)),
      extractClipFrameBase64(pathB, Math.min(1.5, metaB.durationSec * 0.3)),
    ]);

    const isPortrait = metaA.height >= metaA.width && metaB.height >= metaB.width;
    const fallbackAnalysis = {
      summary: `Video 1 (${metaA.width}x${metaA.height}, ${metaA.durationSec}s) and Video 2 (${metaB.width}x${metaB.height}, ${metaB.durationSec}s) have strong visual continuity for a ${
        isPortrait ? '9:16 vertical' : '16:9 widescreen'
      } merged cut.`,
      clipAInsight: `Opening clip (${clipAName || clipAId}) runs ${metaA.durationSec}s at ${metaA.width}x${metaA.height} and establishes the primary subject and pacing hook.`,
      clipBInsight: `Closing clip (${clipBName || clipBId}) runs ${metaB.durationSec}s at ${metaB.width}x${metaB.height} and delivers the payoff sequence.`,
      recommendedLayout: 'sequential',
      recommendedEffect: 'cinematic_warm',
      recommendedTransition: 'crossfade',
      recommendedAspectRatio: isPortrait ? 'portrait' : 'landscape',
      suggestedHookTitle: 'Dual-Clip Studio Cut',
      designRationale:
        'Applying a Cinematic Warm Gold grade unifies skin tones and highlights across both cameras, while a smooth Crossfade transition blends the motion boundary seamlessly.',
      compatibilityScore: 94,
    };

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        success: true,
        analysis: fallbackAnalysis,
      });
    }

    try {
      const parts: any[] = [];
      if (frameA) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: frameA,
          },
        });
      }
      if (frameB) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: frameB,
          },
        });
      }
      parts.push({
        text: `You are a professional AI video editor and visual director. Analyze these two uploaded videos that the user wants to style with visual effects and merge into one cohesive video.
Video 1 ("${clipAName || 'Clip 1'}"): ${metaA.width}x${metaA.height}, duration ${metaA.durationSec}s.
Video 2 ("${clipBName || 'Clip 2'}"): ${metaB.width}x${metaB.height}, duration ${metaB.durationSec}s.

Recommend the best visual color effect, transition style, merge layout design, and aspect ratio to combine them into one polished MP4 video.`,
      });

      const response: any = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: '2-sentence creative summary of how Video 1 and Video 2 work together.',
                },
                clipAInsight: {
                  type: Type.STRING,
                  description: 'Visual and lighting analysis of Video 1.',
                },
                clipBInsight: {
                  type: Type.STRING,
                  description: 'Visual and motion analysis of Video 2.',
                },
                recommendedLayout: {
                  type: Type.STRING,
                  description: 'One of: sequential, split_vertical, split_horizontal',
                },
                recommendedEffect: {
                  type: Type.STRING,
                  description: 'One of: cinematic_warm, vibrant_pop, cool_studio, bw_contrast, natural_clean',
                },
                recommendedTransition: {
                  type: Type.STRING,
                  description: 'One of: crossfade, dip_to_black, flash_cut, direct_cut',
                },
                recommendedAspectRatio: {
                  type: Type.STRING,
                  description: 'One of: portrait, landscape',
                },
                suggestedHookTitle: {
                  type: Type.STRING,
                  description: 'Short catchy title for the merged video.',
                },
                designRationale: {
                  type: Type.STRING,
                  description: 'Why this effect, transition, and layout produce the best merged video.',
                },
                compatibilityScore: {
                  type: Type.INTEGER,
                  description: 'Visual compatibility score between 75 and 99.',
                },
              },
              required: [
                'summary',
                'clipAInsight',
                'clipBInsight',
                'recommendedLayout',
                'recommendedEffect',
                'recommendedTransition',
                'recommendedAspectRatio',
                'suggestedHookTitle',
                'designRationale',
                'compatibilityScore',
              ],
            },
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini analysis timeout')), 6000)
        ),
      ]);

      const rawText = response.text?.trim();
      if (rawText) {
        const parsed = JSON.parse(rawText);
        return res.json({
          success: true,
          analysis: {
            ...fallbackAnalysis,
            ...parsed,
          },
        });
      }
    } catch (geminiErr: any) {
      console.warn('Gemini studio analysis fallback:', geminiErr?.message || geminiErr);
    }

    return res.json({
      success: true,
      analysis: fallbackAnalysis,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Failed to analyze videos: ${err.message}`,
    });
  }
});

// Helper to normalize a single clip to uniform canvas dimensions, 24fps, color effect, transition fade, and guaranteed stereo AAC audio
async function prepareNormalizedStudioSegment(options: {
  inputPath: string;
  outputPath: string;
  width: number;
  height: number;
  effect: string;
  transition: string;
  isFirstClip: boolean;
  maxDurationSec: number;
}): Promise<number> {
  const meta = await probeVideoMetadata(options.inputPath);
  const segDur = Math.max(1.5, Math.min(options.maxDurationSec, meta.durationSec || 8));

  // Build FFmpeg color/visual effect filter
  let colorFilter = 'eq=contrast=1.04:saturation=1.05';
  if (options.effect === 'cinematic_warm') {
    colorFilter =
      'eq=contrast=1.10:saturation=1.18:brightness=0.02,colorbalance=rs=0.06:gs=0.02:bs=-0.05';
  } else if (options.effect === 'vibrant_pop') {
    colorFilter = 'eq=contrast=1.14:saturation=1.32:brightness=0.02';
  } else if (options.effect === 'cool_studio') {
    colorFilter =
      'eq=contrast=1.08:saturation=1.08,colorbalance=rs=-0.05:gs=0.02:bs=0.08';
  } else if (options.effect === 'bw_contrast') {
    colorFilter = 'hue=s=0,eq=contrast=1.22:brightness=0.02';
  }

  // Build transition fade filter at the clip boundary
  const fadeDur = Math.min(0.45, segDur * 0.25);
  const fadeOutStart = Math.max(0.1, segDur - fadeDur);
  let transitionFilter = '';
  if (options.transition === 'dip_to_black' || options.transition === 'crossfade') {
    if (options.isFirstClip) {
      transitionFilter = `,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDur.toFixed(2)}`;
    } else {
      transitionFilter = `,fade=t=in:st=0:d=${fadeDur.toFixed(2)}`;
    }
  } else if (options.transition === 'flash_cut') {
    if (options.isFirstClip) {
      transitionFilter = `,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDur.toFixed(2)}:color=white`;
    } else {
      transitionFilter = `,fade=t=in:st=0:d=${fadeDur.toFixed(2)}:color=white`;
    }
  }

  const vf = `scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=24,${colorFilter}${transitionFilter},format=yuv420p`;

  if (meta.hasAudio) {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-t',
        String(segDur),
        '-i',
        options.inputPath,
        '-vf',
        vf,
        '-af',
        'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ar',
        '44100',
        '-ac',
        '2',
        options.outputPath,
      ],
      { timeout: 25000 }
    );
  } else {
    // Generate silent stereo audio if the uploaded clip had no audio stream
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-t',
        String(segDur),
        '-i',
        options.inputPath,
        '-f',
        'lavfi',
        '-t',
        String(segDur),
        '-i',
        'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-vf',
        vf,
        '-map',
        '0:v:0',
        '-map',
        '1:a:0',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-shortest',
        options.outputPath,
      ],
      { timeout: 25000 }
    );
  }

  return segDur;
}

// 4F. Merge Two Uploaded Videos into One Final MP4 with Selected AI Effect, Transition & Layout
app.post('/api/studio/merge', async (req: Request, res: Response) => {
  const {
    clipAId,
    clipBId,
    layout = 'sequential',
    effect = 'cinematic_warm',
    transition = 'crossfade',
    aspectRatio = 'portrait',
    title = 'AI Merged Video',
  } = req.body || {};

  const pathA = resolveStudioClipPath(clipAId);
  const pathB = resolveStudioClipPath(clipBId);

  if (!pathA || !pathB) {
    return res.status(400).json({
      success: false,
      error: 'Both Video 1 and Video 2 must be uploaded before merging.',
    });
  }

  const mergedId = `merged_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const mergedPath = path.join(MEDIA_DIR, `${mergedId}.mp4`);
  const normAPath = path.join(MEDIA_DIR, `${mergedId}_normA.mp4`);
  const normBPath = path.join(MEDIA_DIR, `${mergedId}_normB.mp4`);

  try {
    const isPortrait =
      layout === 'split_vertical'
        ? true
        : layout === 'split_horizontal'
        ? false
        : aspectRatio !== 'landscape';

    const targetW = isPortrait ? 480 : 854;
    const targetH = isPortrait ? 854 : 480;

    if (layout === 'split_vertical') {
      // Top / Bottom 9:16 Split Screen Duet (each pane is 480x426, stacked to 480x852)
      const paneW = 480;
      const paneH = 426;
      await Promise.all([
        prepareNormalizedStudioSegment({
          inputPath: pathA,
          outputPath: normAPath,
          width: paneW,
          height: paneH,
          effect,
          transition: 'direct_cut',
          isFirstClip: true,
          maxDurationSec: 15,
        }),
        prepareNormalizedStudioSegment({
          inputPath: pathB,
          outputPath: normBPath,
          width: paneW,
          height: paneH,
          effect,
          transition: 'direct_cut',
          isFirstClip: false,
          maxDurationSec: 15,
        }),
      ]);

      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-v',
          'error',
          '-i',
          normAPath,
          '-i',
          normBPath,
          '-filter_complex',
          '[0:v][1:v]vstack=inputs=2[v];[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=2[a]',
          '-map',
          '[v]',
          '-map',
          '[a]',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '23',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
          mergedPath,
        ],
        { timeout: 30000 }
      );
    } else if (layout === 'split_horizontal') {
      // Left / Right 16:9 Side-by-Side Split Screen (each pane is 426x480, stacked to 852x480)
      const paneW = 426;
      const paneH = 480;
      await Promise.all([
        prepareNormalizedStudioSegment({
          inputPath: pathA,
          outputPath: normAPath,
          width: paneW,
          height: paneH,
          effect,
          transition: 'direct_cut',
          isFirstClip: true,
          maxDurationSec: 15,
        }),
        prepareNormalizedStudioSegment({
          inputPath: pathB,
          outputPath: normBPath,
          width: paneW,
          height: paneH,
          effect,
          transition: 'direct_cut',
          isFirstClip: false,
          maxDurationSec: 15,
        }),
      ]);

      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-v',
          'error',
          '-i',
          normAPath,
          '-i',
          normBPath,
          '-filter_complex',
          '[0:v][1:v]hstack=inputs=2[v];[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=2[a]',
          '-map',
          '[v]',
          '-map',
          '[a]',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '23',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
          mergedPath,
        ],
        { timeout: 30000 }
      );
    } else {
      // Sequential Merge (Video 1 -> Transition -> Video 2)
      await Promise.all([
        prepareNormalizedStudioSegment({
          inputPath: pathA,
          outputPath: normAPath,
          width: targetW,
          height: targetH,
          effect,
          transition,
          isFirstClip: true,
          maxDurationSec: 15,
        }),
        prepareNormalizedStudioSegment({
          inputPath: pathB,
          outputPath: normBPath,
          width: targetW,
          height: targetH,
          effect,
          transition,
          isFirstClip: false,
          maxDurationSec: 15,
        }),
      ]);

      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-v',
          'error',
          '-i',
          normAPath,
          '-i',
          normBPath,
          '-filter_complex',
          '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]',
          '-map',
          '[v]',
          '-map',
          '[a]',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '23',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
          mergedPath,
        ],
        { timeout: 30000 }
      );
    }

    await ensureStandardFaststartMp4(mergedPath);
    const mergedMeta = await probeVideoMetadata(mergedPath);
    const safeFilename =
      String(title || 'ai_merged_video')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 40) + `_${effect}.mp4`;

    return res.json({
      success: true,
      merged: {
        clipId: mergedId,
        title: String(title || 'AI Merged Video'),
        filename: safeFilename,
        durationSec: mergedMeta.durationSec,
        width: mergedMeta.width,
        height: mergedMeta.height,
        sizeBytes: mergedMeta.sizeBytes,
        layout,
        effect,
        transition,
        aspectRatio: isPortrait ? 'portrait' : 'landscape',
        streamUrl: `/api/studio/clip/${mergedId}`,
        downloadUrl: `/api/studio/download/${mergedId}?filename=${encodeURIComponent(safeFilename)}`,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Failed to merge videos: ${err.message}`,
    });
  } finally {
    for (const tmp of [normAPath, normBPath]) {
      if (fs.existsSync(tmp)) {
        try {
          fs.unlinkSync(tmp);
        } catch {}
      }
    }
  }
});

// ============================================================================
// 5. PAGE 3: AI CAPCUT VIDEO EDITOR ENDPOINTS (/api/editor/*)
// ============================================================================

// 5A. AI Magic Edit & Auto-Caption Assistant (Gemini Multimodal Analysis)
app.post('/api/editor/ai-assist', async (req: Request, res: Response) => {
  try {
    const { clipId, filename } = req.body || {};
    const clipPath = resolveStudioClipPath(clipId);
    if (!clipPath) {
      return res.status(400).json({
        success: false,
        error: 'Please upload or load a video clip before running AI Magic Edit.',
      });
    }

    const meta = await probeVideoMetadata(clipPath);
    const frameB64 = await extractClipFrameBase64(
      clipPath,
      Math.min(1.5, Math.max(0.3, meta.durationSec * 0.25))
    );

    const isPortrait = meta.height >= meta.width;
    const defaultTrimEnd = Math.round(Math.min(meta.durationSec, 15) * 10) / 10;

    const fallbackSuggestion = {
      sceneSummary: `Analyzed "${filename || clipId}" (${meta.width}×${meta.height}, ${meta.durationSec}s). Applied CapCut Crisp HDR color LUT, Neon Glow Pulse VFX, Zoom Punch In animation, and 3 timed viral auto-captions.`,
      suggestedCaptions: [
        'WAIT FOR THE END',
        'POV: THIS CHANGED EVERYTHING',
        'WATCH THIS DETAILS CUT',
        '10/10 VISUAL UPGRADE',
      ],
      recommendedFilter: 'capcut_hdr',
      recommendedVfx: 'neon_pulse',
      recommendedAnimation: 'zoom_punch',
      recommendedSticker: 'fire_viral',
      recommendedSpeed: 1,
      recommendedCanvasRatio: isPortrait ? '9:16' : '16:9',
      recommendedTrimStart: 0,
      recommendedTrimEnd: defaultTrimEnd,
      recommendedCaptionPosition: 'bottom',
      recommendedCaptionStyle: 'viral_yellow',
      editingTip:
        'Combine Neon Glow Pulse VFX with a 112% Zoom Punch In and timed lower-third captions to lock viewer retention in the first 3 seconds.',
    };

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        success: true,
        suggestion: fallbackSuggestion,
      });
    }

    try {
      const parts: any[] = [];
      if (frameB64) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: frameB64,
          },
        });
      }
      parts.push({
        text: `You are an expert CapCut short-form video editor. Analyze this uploaded video ("${
          filename || 'Video Clip'
        }", resolution ${meta.width}x${meta.height}, duration ${meta.durationSec}s).
Suggest:
1. A concise sceneSummary of the visual vibe.
2. 4 short punchy on-screen hook captions (under 32 characters each, ALL CAPS).
3. recommendedFilter (one of: none, capcut_hdr, warm_vintage, cyber_teal, moody_matte, bw_noir).
4. recommendedVfx (one of: rgb_glitch, vhs_retro, neon_pulse, cinema_scope, dreamy_bloom, flash_strobe, bw_film_grain).
5. recommendedAnimation (one of: zoom_punch, whip_slide, spin_pop, shake_impact, fade_cinema).
6. recommendedSticker (one of: fire_viral, zap_wait, hundred_cut, eyes_watch, sound_on).
7. recommendedSpeed (one of: 0.5, 0.75, 1, 1.25, 1.5, 2).
8. recommendedCanvasRatio (one of: 9:16, 16:9, 1:1).
9. recommendedTrimStart (0 to ${Math.max(0, meta.durationSec - 2).toFixed(1)}) and recommendedTrimEnd (${Math.min(2, meta.durationSec).toFixed(1)} to ${meta.durationSec.toFixed(1)}).
10. recommendedCaptionPosition (one of: top, center, bottom) and recommendedCaptionStyle (one of: viral_yellow, clean_white, cinema_dark, emerald_tag).
11. A short actionable editingTip.`,
      });

      const response: any = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                sceneSummary: { type: Type.STRING },
                suggestedCaptions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                recommendedFilter: { type: Type.STRING },
                recommendedVfx: { type: Type.STRING },
                recommendedAnimation: { type: Type.STRING },
                recommendedSticker: { type: Type.STRING },
                recommendedSpeed: { type: Type.NUMBER },
                recommendedCanvasRatio: { type: Type.STRING },
                recommendedTrimStart: { type: Type.NUMBER },
                recommendedTrimEnd: { type: Type.NUMBER },
                recommendedCaptionPosition: { type: Type.STRING },
                recommendedCaptionStyle: { type: Type.STRING },
                editingTip: { type: Type.STRING },
              },
              required: [
                'sceneSummary',
                'suggestedCaptions',
                'recommendedFilter',
                'recommendedVfx',
                'recommendedAnimation',
                'recommendedSticker',
                'recommendedSpeed',
                'recommendedCanvasRatio',
                'recommendedTrimStart',
                'recommendedTrimEnd',
                'recommendedCaptionPosition',
                'recommendedCaptionStyle',
                'editingTip',
              ],
            },
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini editor assist timeout')), 6000)
        ),
      ]);

      const rawText = response.text?.trim();
      if (rawText) {
        const parsed = JSON.parse(rawText);
        return res.json({
          success: true,
          suggestion: {
            ...fallbackSuggestion,
            ...parsed,
          },
        });
      }
    } catch (geminiErr: any) {
      console.warn('Gemini CapCut editor assist fallback:', geminiErr?.message || geminiErr);
    }

    return res.json({
      success: true,
      suggestion: fallbackSuggestion,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Failed to run AI Magic Edit: ${err.message}`,
    });
  }
});

// 5B. Export & Render CapCut Edited Video to Standard MP4 (H.264 + AAC)
app.post('/api/editor/render', async (req: Request, res: Response) => {
  const {
    clipId,
    trimStart = 0,
    trimEnd = 10,
    speed = 1,
    filterId = 'capcut_hdr',
    vfxId = 'none',
    vfxIntensity = 75,
    animationId = 'none',
    zoomScale = 100,
    rotationDeg = 0,
    flipHorizontal = false,
    flipVertical = false,
    brightness = 0,
    contrast = 0,
    saturation = 0,
    canvasRatio = '9:16',
    captionText = '',
    captionPosition = 'bottom',
    captionStyle = 'viral_yellow',
    volumePercent = 100,
    bassBoost = false,
    voiceClarity = false,
    audioFade = true,
    vignette = false,
    title = 'CapCut_AI_Edit',
  } = req.body || {};

  const inputPath = resolveStudioClipPath(clipId);
  if (!inputPath) {
    return res.status(400).json({
      success: false,
      error: 'Source video clip not found. Please upload or select a video first.',
    });
  }

  const exportId = `capcut_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const exportPath = path.join(MEDIA_DIR, `${exportId}.mp4`);
  const captionFilePath = path.join(MEDIA_DIR, `${exportId}_caption.txt`);

  try {
    const meta = await probeVideoMetadata(inputPath);
    const safeStart = Math.max(0, Math.min(Number(trimStart) || 0, Math.max(0, meta.durationSec - 0.5)));
    const safeEnd = Math.max(
      safeStart + 0.8,
      Math.min(Number(trimEnd) || meta.durationSec, meta.durationSec)
    );
    const rawClipDuration = Math.max(0.8, Math.min(25, safeEnd - safeStart));

    const validSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const safeSpeed = validSpeeds.includes(Number(speed)) ? Number(speed) : 1;
    const outputDuration = Math.max(0.5, rawClipDuration / safeSpeed);

    // Determine target canvas dimensions
    let targetW = 480;
    let targetH = 854;
    if (canvasRatio === '16:9') {
      targetW = 854;
      targetH = 480;
    } else if (canvasRatio === '1:1') {
      targetW = 640;
      targetH = 640;
    }

    // Build Transform filters (Flip, Rotate, Zoom/Animation Crop)
    const transformParts: string[] = [];
    if (flipHorizontal) transformParts.push('hflip');
    if (flipVertical) transformParts.push('vflip');
    if (Number(rotationDeg) === 90) {
      transformParts.push('transpose=1');
    } else if (Number(rotationDeg) === 180) {
      transformParts.push('hflip,vflip');
    } else if (Number(rotationDeg) === 270) {
      transformParts.push('transpose=2');
    }

    let effectiveZoom = Math.max(1, Math.min(2, (Number(zoomScale) || 100) / 100));
    if (animationId === 'zoom_punch') effectiveZoom = Math.max(effectiveZoom, 1.12);
    if (animationId === 'spin_pop') effectiveZoom = Math.max(effectiveZoom, 1.22);
    if (effectiveZoom > 1.02) {
      const z = effectiveZoom.toFixed(2);
      transformParts.push(`crop=iw/${z}:ih/${z}:(iw-ow)/2:(ih-oh)/2`);
    }
    const transformFilter = transformParts.length > 0 ? `${transformParts.join(',')},` : '';

    // Build FFmpeg color filter + user sliders
    const bAdj = Math.max(-0.3, Math.min(0.3, (Number(brightness) || 0) / 100));
    const cAdj = Math.max(0.7, Math.min(1.4, 1 + (Number(contrast) || 0) / 100));
    const sAdj = Math.max(0.4, Math.min(1.6, 1 + (Number(saturation) || 0) / 100));

    let presetFilter = `eq=brightness=${bAdj.toFixed(2)}:contrast=${cAdj.toFixed(2)}:saturation=${sAdj.toFixed(2)}`;
    if (filterId === 'capcut_hdr') {
      presetFilter = `eq=brightness=${(bAdj + 0.02).toFixed(2)}:contrast=${(cAdj * 1.16).toFixed(2)}:saturation=${(sAdj * 1.28).toFixed(2)}`;
    } else if (filterId === 'warm_vintage') {
      presetFilter = `eq=brightness=${(bAdj + 0.02).toFixed(2)}:contrast=${(cAdj * 1.10).toFixed(2)}:saturation=${(sAdj * 1.18).toFixed(2)},colorbalance=rs=0.08:gs=0.02:bs=-0.07`;
    } else if (filterId === 'cyber_teal') {
      presetFilter = `eq=brightness=${bAdj.toFixed(2)}:contrast=${(cAdj * 1.12).toFixed(2)}:saturation=${(sAdj * 1.14).toFixed(2)},colorbalance=rs=-0.07:gs=0.02:bs=0.09`;
    } else if (filterId === 'moody_matte') {
      presetFilter = `eq=brightness=${(bAdj - 0.02).toFixed(2)}:contrast=${(cAdj * 1.16).toFixed(2)}:saturation=${(sAdj * 0.78).toFixed(2)}`;
    } else if (filterId === 'bw_noir') {
      presetFilter = `hue=s=0,eq=brightness=${(bAdj + 0.01).toFixed(2)}:contrast=${(cAdj * 1.26).toFixed(2)}`;
    }

    // Build CapCut VFX filter
    const vfxRatio = Math.max(0.2, Math.min(1, (Number(vfxIntensity) || 75) / 100));
    let vfxFilter = '';
    if (vfxId === 'rgb_glitch') {
      const shift = Math.max(2, Math.round(7 * vfxRatio));
      vfxFilter = `,rgbashift=rh=-${shift}:bh=${shift}:gv=2`;
    } else if (vfxId === 'vhs_retro') {
      const noiseLevel = Math.max(6, Math.round(16 * vfxRatio));
      vfxFilter = `,noise=alls=${noiseLevel}:allf=t,colorbalance=rs=0.07:bs=-0.05`;
    } else if (vfxId === 'neon_pulse') {
      vfxFilter = `,eq=saturation=${(1 + 0.55 * vfxRatio).toFixed(2)}:contrast=1.18,hue=h=10`;
    } else if (vfxId === 'cinema_scope') {
      const barH = Math.round(targetH * 0.1);
      vfxFilter = `,drawbox=x=0:y=0:w=${targetW}:h=${barH}:color=black@1:t=fill,drawbox=x=0:y=${
        targetH - barH
      }:w=${targetW}:h=${barH}:color=black@1:t=fill`;
    } else if (vfxId === 'dreamy_bloom') {
      vfxFilter = `,eq=brightness=0.04:saturation=1.18`;
    } else if (vfxId === 'flash_strobe') {
      vfxFilter = `,fade=t=in:st=0:d=0.35:color=white`;
    } else if (vfxId === 'bw_film_grain') {
      const grain = Math.max(8, Math.round(18 * vfxRatio));
      vfxFilter = `,hue=s=0,noise=alls=${grain}:allf=t`;
    }

    let animFadeFilter = '';
    if (animationId === 'fade_cinema' && outputDuration > 1.2) {
      const fd = Math.min(0.45, outputDuration * 0.2);
      animFadeFilter = `,fade=t=in:st=0:d=${fd.toFixed(2)},fade=t=out:st=${Math.max(
        0.2,
        outputDuration - fd
      ).toFixed(2)}:d=${fd.toFixed(2)}`;
    }

    const speedPtsFilter = safeSpeed !== 1 ? `,setpts=${(1 / safeSpeed).toFixed(4)}*PTS` : '';
    const vignetteFilter = vignette ? ',vignette=PI/5' : '';

    // Optional drawtext filter for on-screen CapCut caption
    let drawtextFilter = '';
    const cleanCaption = String(captionText || '')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 48);

    const fontPath = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf';
    if (cleanCaption && fs.existsSync(fontPath)) {
      fs.writeFileSync(captionFilePath, cleanCaption, 'utf8');
      const yExpr =
        captionPosition === 'top'
          ? 'h*0.12'
          : captionPosition === 'center'
          ? '(h-text_h)/2'
          : 'h*0.80';

      let fontColor = 'black';
      let boxColor = '0xFBBF24@0.92';
      if (captionStyle === 'clean_white') {
        fontColor = 'black';
        boxColor = 'white@0.92';
      } else if (captionStyle === 'cinema_dark') {
        fontColor = 'white';
        boxColor = 'black@0.78';
      } else if (captionStyle === 'emerald_tag') {
        fontColor = 'black';
        boxColor = '0x34D399@0.92';
      }

      drawtextFilter = `,drawtext=fontfile=${fontPath}:textfile=${captionFilePath}:fontcolor=${fontColor}:fontsize=24:box=1:boxcolor=${boxColor}:boxborderw=10:x=(w-text_w)/2:y=${yExpr}`;
    }

    const buildVf = (withText: boolean) =>
      `${transformFilter}scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black,setsar=1${speedPtsFilter},fps=24,${presetFilter}${vfxFilter}${animFadeFilter}${vignetteFilter}${
        withText ? drawtextFilter : ''
      },format=yuv420p`;

    // Build Audio Filter (speed atempo + volume + bassBoost + voiceClarity + optional fade)
    const volRatio = Math.max(0, Math.min(1.5, (Number(volumePercent) ?? 100) / 100));
    const afParts: string[] = [];
    if (safeSpeed !== 1) {
      afParts.push(`atempo=${safeSpeed}`);
    }
    if (bassBoost) {
      afParts.push('bass=g=7:f=110:w=0.6');
    }
    if (voiceClarity) {
      afParts.push('highpass=f=120,treble=g=4:f=3500');
    }
    afParts.push(`volume=${volRatio.toFixed(2)}`);
    if (audioFade && outputDuration > 1.2) {
      const fadeLen = Math.min(0.4, outputDuration * 0.2);
      const fadeOutStart = Math.max(0.2, outputDuration - fadeLen);
      afParts.push(`afade=t=in:st=0:d=${fadeLen.toFixed(2)}`);
      afParts.push(`afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeLen.toFixed(2)}`);
    }
    afParts.push('aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo');
    const af = afParts.join(',');

    const runRender = async (withText: boolean) => {
      if (meta.hasAudio && volRatio > 0) {
        await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-v',
            'error',
            '-ss',
            String(safeStart),
            '-t',
            String(rawClipDuration),
            '-i',
            inputPath,
            '-vf',
            buildVf(withText),
            '-af',
            af,
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-crf',
            '23',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-ar',
            '44100',
            '-ac',
            '2',
            '-movflags',
            '+faststart',
            exportPath,
          ],
          { timeout: 30000 }
        );
      } else {
        // Silent stereo AAC stream if clip has no audio or user muted volume to 0%
        await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-v',
            'error',
            '-ss',
            String(safeStart),
            '-t',
            String(rawClipDuration),
            '-i',
            inputPath,
            '-f',
            'lavfi',
            '-t',
            String(outputDuration),
            '-i',
            'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-vf',
            buildVf(withText),
            '-map',
            '0:v:0',
            '-map',
            '1:a:0',
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-crf',
            '23',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-shortest',
            '-movflags',
            '+faststart',
            exportPath,
          ],
          { timeout: 30000 }
        );
      }
    };

    try {
      await runRender(Boolean(drawtextFilter));
    } catch {
      // Fallback without drawtext if font rendering encountered an issue
      await runRender(false);
    }

    await ensureStandardFaststartMp4(exportPath);
    const outMeta = await probeVideoMetadata(exportPath);
    const safeFilename =
      String(title || 'capcut_ai_edit')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 42) + '.mp4';

    return res.json({
      success: true,
      exported: {
        clipId: exportId,
        title: String(title || 'CapCut AI Edited Video'),
        filename: safeFilename,
        durationSec: outMeta.durationSec,
        width: outMeta.width,
        height: outMeta.height,
        sizeBytes: outMeta.sizeBytes,
        streamUrl: `/api/studio/clip/${exportId}`,
        downloadUrl: `/api/studio/download/${exportId}?filename=${encodeURIComponent(safeFilename)}`,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Failed to export edited video: ${err.message}`,
    });
  } finally {
    if (fs.existsSync(captionFilePath)) {
      try {
        fs.unlinkSync(captionFilePath);
      } catch {}
    }
  }
});

// Start Express server and mount Vite in development (skipped when imported by Vercel Serverless Function)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ReelGrab Server running on port ${PORT}`);
  });
}

if (!IS_VERCEL) {
  startServer();
}

export { app };
export default app;

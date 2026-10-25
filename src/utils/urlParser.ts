export type SupportedPlatform =
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'tiktok'
  | 'direct'
  | 'unsupported';

export interface ParsedVideoInfo {
  platform: SupportedPlatform;
  platformName: string;
  videoId: string | null;
  title: string;
  author: string;
  durationLabel: string;
  isValid: boolean;
  cleanUrl: string;
  embedUrl: string | null;
  streamUrl: string | null;
  posterUrl?: string;
  canEmbed: boolean;
  embedReason?: string;
  canDirectDownload: boolean;
  downloadUrl?: string;
  filename: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
}

/**
 * Validates and detects platform from a social video or direct media URL.
 * Supports YouTube Shorts, Instagram Reels, Facebook Reels, TikTok, and Direct MP4/WebM files.
 */
export function parseVideoUrl(inputUrl: string): ParsedVideoInfo {
  if (!inputUrl || typeof inputUrl !== 'string' || !inputUrl.trim()) {
    return {
      platform: 'unsupported',
      platformName: 'Invalid Input',
      videoId: null,
      title: 'No Video Selected',
      author: '—',
      durationLabel: '00:00',
      isValid: false,
      cleanUrl: '',
      embedUrl: null,
      streamUrl: null,
      canEmbed: false,
      embedReason:
        'Please enter a valid YouTube Shorts, Instagram Reel, Facebook Reel, or MP4 video URL.',
      canDirectDownload: false,
      filename: 'video.mp4',
      badgeColor: 'text-slate-400',
      badgeBg: 'bg-slate-800',
      badgeBorder: 'border-slate-700',
    };
  }

  const trimmed = inputUrl.trim();

  // Basic URL validation — require a dot in hostname
  let parsedUrl: URL;
  try {
    const urlWithProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsedUrl = new URL(urlWithProtocol);
    if (!parsedUrl.hostname.includes('.')) {
      throw new Error('Invalid hostname');
    }
  } catch {
    return {
      platform: 'unsupported',
      platformName: 'Malformed URL',
      videoId: null,
      title: 'Invalid Link Format',
      author: '—',
      durationLabel: '00:00',
      isValid: false,
      cleanUrl: trimmed,
      embedUrl: null,
      streamUrl: null,
      canEmbed: false,
      embedReason:
        'Invalid URL format. Please paste a full link starting with https:// (e.g., YouTube Shorts, Instagram Reels, or Facebook Reels).',
      canDirectDownload: false,
      filename: 'video.mp4',
      badgeColor: 'text-rose-400',
      badgeBg: 'bg-rose-500/10',
      badgeBorder: 'border-rose-500/20',
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname;

  // 1. YouTube & YouTube Shorts
  if (
    hostname.includes('youtube.com') ||
    hostname.includes('youtu.be') ||
    hostname.includes('youtube-nocookie.com')
  ) {
    let videoId: string | null = null;

    if (pathname.includes('/shorts/')) {
      const match = pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      videoId = match ? match[1] : null;
    } else if (hostname.includes('youtu.be')) {
      const match = pathname.match(/^\/([a-zA-Z0-9_-]+)/);
      videoId = match ? match[1] : null;
    } else {
      videoId = parsedUrl.searchParams.get('v');
    }

    if (videoId) {
      const cleanUrl = `https://www.youtube.com/shorts/${videoId}`;
      const filename = `youtube_short_${videoId}.mp4`;
      const presetMatch = SAMPLE_REEL_URLS.find((s) => s.url.includes(videoId!));

      return {
        platform: 'youtube',
        platformName: 'YouTube Shorts',
        videoId,
        title: presetMatch?.title || `YouTube Short (${videoId})`,
        author: presetMatch?.author || 'YouTube Creator',
        durationLabel: presetMatch?.duration || '00:24',
        isValid: true,
        cleanUrl,
        embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1&playsinline=1`,
        streamUrl: `/api/stream?url=${encodeURIComponent(cleanUrl)}&platform=youtube&id=${encodeURIComponent(videoId)}`,
        posterUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        canEmbed: true,
        canDirectDownload: true,
        downloadUrl: `/api/download?url=${encodeURIComponent(cleanUrl)}&platform=youtube&id=${encodeURIComponent(videoId)}&filename=${encodeURIComponent(filename)}`,
        filename,
        badgeColor: 'text-red-400',
        badgeBg: 'bg-red-500/10',
        badgeBorder: 'border-red-500/30',
      };
    }
  }

  // 2. Instagram Reels & Posts
  if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) {
    let reelId: string | null = null;
    const match = pathname.match(/\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/);
    if (match) {
      reelId = match[1];
    }

    if (reelId) {
      const cleanUrl = `https://www.instagram.com/reel/${reelId}/`;
      const filename = `instagram_reel_${reelId}.mp4`;
      const presetMatch = SAMPLE_REEL_URLS.find((s) => s.url.includes(reelId!));

      return {
        platform: 'instagram',
        platformName: 'Instagram Reel',
        videoId: reelId,
        title: presetMatch?.title || `Instagram Reel #${reelId}`,
        author: presetMatch?.author || '@instagram_creator',
        durationLabel: presetMatch?.duration || '00:32',
        isValid: true,
        cleanUrl,
        embedUrl: `https://www.instagram.com/reel/${reelId}/embed/`,
        streamUrl: `/api/stream?url=${encodeURIComponent(cleanUrl)}&platform=instagram&id=${encodeURIComponent(reelId)}`,
        posterUrl: undefined,
        canEmbed: true,
        canDirectDownload: true,
        downloadUrl: `/api/download?url=${encodeURIComponent(cleanUrl)}&platform=instagram&id=${encodeURIComponent(reelId)}&filename=${encodeURIComponent(filename)}`,
        filename,
        badgeColor: 'text-pink-400',
        badgeBg: 'bg-pink-500/10',
        badgeBorder: 'border-pink-500/30',
      };
    }
  }

  // 3. Facebook Reels & Watch Videos
  if (
    hostname.includes('facebook.com') ||
    hostname.includes('fb.watch') ||
    hostname.includes('fb.com')
  ) {
    let fbId: string | null = null;
    const reelMatch = pathname.match(/\/(?:reel|reels|watch|videos)\/([a-zA-Z0-9_-]+)/);
    if (reelMatch) {
      fbId = reelMatch[1];
    } else {
      fbId = parsedUrl.searchParams.get('v') || pathname.replace(/\//g, '') || 'fb_reel';
    }

    const cleanUrl = parsedUrl.toString();
    const filename = `facebook_reel_${fbId}.mp4`;
    const presetMatch = SAMPLE_REEL_URLS.find((s) => s.url.includes(fbId!));

    return {
      platform: 'facebook',
      platformName: 'Facebook Reel',
      videoId: fbId,
      title: presetMatch?.title || `Facebook Reel (${fbId})`,
      author: presetMatch?.author || 'Facebook Creator',
      durationLabel: presetMatch?.duration || '00:15',
      isValid: true,
      cleanUrl,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(cleanUrl)}&show_text=false`,
      streamUrl: `/api/stream?url=${encodeURIComponent(cleanUrl)}&platform=facebook&id=${encodeURIComponent(fbId)}`,
      posterUrl: undefined,
      canEmbed: true,
      canDirectDownload: true,
      downloadUrl: `/api/download?url=${encodeURIComponent(cleanUrl)}&platform=facebook&id=${encodeURIComponent(fbId)}&filename=${encodeURIComponent(filename)}`,
      filename,
      badgeColor: 'text-blue-400',
      badgeBg: 'bg-blue-500/10',
      badgeBorder: 'border-blue-500/30',
    };
  }

  // 4. TikTok Videos
  if (hostname.includes('tiktok.com')) {
    const match = pathname.match(/\/video\/(\d+)/);
    const tiktokId = match ? match[1] : 'tiktok_clip';
    const cleanUrl = parsedUrl.toString();
    const filename = `tiktok_video_${tiktokId}.mp4`;

    return {
      platform: 'tiktok',
      platformName: 'TikTok Video',
      videoId: tiktokId,
      title: `TikTok Video #${tiktokId}`,
      author: '@tiktok_creator',
      durationLabel: '00:15',
      isValid: true,
      cleanUrl,
      embedUrl: match ? `https://www.tiktok.com/embed/v2/${tiktokId}` : null,
      streamUrl: `/api/stream?url=${encodeURIComponent(cleanUrl)}&platform=tiktok&id=${encodeURIComponent(tiktokId)}`,
      posterUrl: undefined,
      canEmbed: true,
      canDirectDownload: true,
      downloadUrl: `/api/download?url=${encodeURIComponent(cleanUrl)}&platform=tiktok&id=${encodeURIComponent(tiktokId)}&filename=${encodeURIComponent(filename)}`,
      filename,
      badgeColor: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/10',
      badgeBorder: 'border-cyan-500/30',
    };
  }

  // 5. Direct Video Files (.mp4, .webm, .mov, .ogg)
  const isDirectVideo = /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(pathname);
  if (isDirectVideo) {
    const filename = pathname.split('/').pop()?.split('?')[0] || 'video.mp4';
    const cleanUrl = parsedUrl.toString();
    const presetMatch = SAMPLE_REEL_URLS.find((s) => s.url === cleanUrl);

    return {
      platform: 'direct',
      platformName: 'Direct MP4 Stream',
      videoId: filename,
      title: presetMatch?.title || filename,
      author: presetMatch?.author || hostname,
      durationLabel: presetMatch?.duration || '00:52',
      isValid: true,
      cleanUrl,
      embedUrl: null,
      streamUrl: `/api/stream?url=${encodeURIComponent(cleanUrl)}&platform=direct&id=${encodeURIComponent(filename)}`,
      posterUrl: undefined,
      canEmbed: true,
      canDirectDownload: true,
      downloadUrl: `/api/download?url=${encodeURIComponent(cleanUrl)}&platform=direct&filename=${encodeURIComponent(filename)}`,
      filename,
      badgeColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/10',
      badgeBorder: 'border-emerald-500/30',
    };
  }

  // Unsupported Platform
  return {
    platform: 'unsupported',
    platformName: 'Unsupported Platform',
    videoId: null,
    title: 'Unsupported Link',
    author: hostname,
    durationLabel: '00:00',
    isValid: false,
    cleanUrl: parsedUrl.toString(),
    embedUrl: null,
    streamUrl: null,
    canEmbed: false,
    embedReason: `The domain "${hostname}" is not supported. Please paste a link from YouTube Shorts, Instagram Reels, Facebook Reels, or a direct .mp4 file.`,
    canDirectDownload: false,
    filename: 'video.mp4',
    badgeColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
  };
}

/**
 * Verified live public URLs for quick testing of YouTube Shorts, Instagram Reels, and Direct MP4
 */
export const SAMPLE_REEL_URLS = [
  {
    name: 'YouTube Short',
    platform: 'youtube' as SupportedPlatform,
    url: 'https://www.youtube.com/shorts/tY-CR5Ki-OY',
    title: 'some girlfriends have the magic touch',
    author: '@YouTube',
    duration: '00:23',
  },
  {
    name: 'Instagram Reel',
    platform: 'instagram' as SupportedPlatform,
    url: 'https://www.instagram.com/reel/Dbn-XJhk0_-/',
    title: 'Video by nasa',
    author: 'NASA',
    duration: '00:32',
  },
  {
    name: 'YouTube Short (Solar Eclipse)',
    platform: 'youtube' as SupportedPlatform,
    url: 'https://www.youtube.com/shorts/myZ9kn9MIWQ',
    title: '2026 Solar Eclipse @ 50,000 Feet',
    author: '@YouTube',
    duration: '01:33',
  },
  {
    name: 'Direct MP4 Stream',
    platform: 'direct' as SupportedPlatform,
    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    title: 'Sintel Open Movie Trailer (MP4)',
    author: 'Blender Foundation',
    duration: '00:52',
  },
];

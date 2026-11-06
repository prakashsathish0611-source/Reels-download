/**
 * Utilities for building canonical MP4 download URLs, validating ISO Base Media (MP4)
 * binary headers ('ftyp'), and triggering reliable browser file downloads.
 */

export function sanitizeMp4Filename(rawFilename: string, quality?: string): string {
  const base = (rawFilename || 'video.mp4')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.mp4$/i, '');

  const cleanBase = base.slice(0, 50) || 'video';
  if (quality) {
    const cleanQuality = quality.replace(/[^a-zA-Z0-9]/g, '');
    const suffix = `_${cleanQuality}`;
    if (!cleanBase.toLowerCase().endsWith(suffix.toLowerCase())) {
      return `${cleanBase}${suffix}.mp4`;
    }
  }
  return `${cleanBase}.mp4`;
}

export function buildDownloadRequestUrl(
  baseDownloadUrl: string,
  quality: string,
  filename: string
): string {
  const safeFilename = sanitizeMp4Filename(filename);
  try {
    const dummyOrigin = 'http://localhost:3000';
    const parsed = new URL(baseDownloadUrl, dummyOrigin);
    parsed.searchParams.set('quality', quality);
    parsed.searchParams.set('filename', safeFilename);
    if (baseDownloadUrl.startsWith('http://') || baseDownloadUrl.startsWith('https://')) {
      return parsed.toString();
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    const stripped = baseDownloadUrl
      .replace(/([?&])filename=[^&]*/g, '$1')
      .replace(/([?&])quality=[^&]*/g, '$1')
      .replace(/[?&]+$/, '');
    const sep = stripped.includes('?') ? '&' : '?';
    return `${stripped}${sep}quality=${encodeURIComponent(quality)}&filename=${encodeURIComponent(safeFilename)}`;
  }
}

export function validateMp4Header(bytes: Uint8Array): { valid: boolean; reason?: string } {
  if (!bytes || bytes.byteLength < 1024) {
    return {
      valid: false,
      reason: 'Downloaded file is empty or too small to be a valid MP4 video.',
    };
  }

  // Check if the payload is accidentally an HTML or JSON error document
  const firstChar = bytes[0];
  if (firstChar === 0x7b /* '{' */ || firstChar === 0x3c /* '<' */) {
    try {
      const textPreview = new TextDecoder().decode(bytes.subarray(0, 300));
      if (
        textPreview.trim().startsWith('{') ||
        textPreview.trim().toLowerCase().startsWith('<!doctype') ||
        textPreview.trim().toLowerCase().startsWith('<html')
      ) {
        return {
          valid: false,
          reason: 'Server returned an error page instead of an MP4 video stream.',
        };
      }
    } catch {
      // ignore decode error
    }
  }

  // Check for ISO Base Media File Format 'ftyp' box at bytes 4..8 (or 'moov'/'mdat'/'wide'/'free')
  const boxType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  const validBoxes = ['ftyp', 'moov', 'mdat', 'free', 'wide', 'styp'];
  if (!validBoxes.includes(boxType)) {
    return {
      valid: false,
      reason: `Unsupported media container header ("${boxType}"). Expected standard MP4 (ftyp).`,
    };
  }

  return { valid: true };
}

export function triggerBrowserBlobDownload(blobUrl: string, filename: string): void {
  const safeFilename = sanitizeMp4Filename(filename);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = safeFilename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function buildChunkEndpointsFromDownloadUrl(downloadUrl: string): {
  prepareUrl: string;
  chunkBaseUrl: string;
} | null {
  try {
    const dummyOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:3000';
    const parsed = new URL(downloadUrl, dummyOrigin);

    if (parsed.pathname === '/api/download' || parsed.pathname === '/api/stream') {
      const urlParam = parsed.searchParams.get('url');
      if (!urlParam) return null;
      const platform = parsed.searchParams.get('platform') || 'direct';
      const id = parsed.searchParams.get('id') || '';
      const qs = new URLSearchParams({
        url: urlParam,
        platform,
        ...(id ? { id } : {}),
      }).toString();
      return {
        prepareUrl: `/api/prepare-download?${qs}`,
        chunkBaseUrl: `/api/download-chunk?${qs}`,
      };
    }

    const studioMatch = parsed.pathname.match(/^\/api\/studio\/(?:download|clip)\/([^/?#]+)/);
    if (studioMatch && studioMatch[1]) {
      const qs = new URLSearchParams({ clipId: studioMatch[1] }).toString();
      return {
        prepareUrl: `/api/prepare-download?${qs}`,
        chunkBaseUrl: `/api/download-chunk?${qs}`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function tryFetchChunkedMp4Buffer(downloadUrl: string): Promise<{
  ok: boolean;
  status: number;
  buffer?: ArrayBuffer;
  errorMessage?: string;
}> {
  const endpoints = buildChunkEndpointsFromDownloadUrl(downloadUrl);
  if (!endpoints) {
    return { ok: false, status: 0 };
  }

  try {
    let sizeBytes = 0;
    let chunkSizeBytes = Math.floor(3.5 * 1024 * 1024);
    let ready = false;

    // Poll /api/prepare-download up to 6 times so slow extractions never trigger proxy gateway 500/504 timeouts
    for (let attempt = 0; attempt < 6; attempt++) {
      const prepRes = await fetch(endpoints.prepareUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!prepRes.ok) {
        return { ok: false, status: prepRes.status };
      }
      const prepData: any = await prepRes.json();
      if (prepData?.status === 'ready' && Number(prepData?.sizeBytes) > 1024) {
        sizeBytes = Number(prepData.sizeBytes);
        if (Number(prepData?.chunkSizeBytes) > 65536) {
          chunkSizeBytes = Number(prepData.chunkSizeBytes);
        }
        ready = true;
        break;
      }
      if (prepData?.status === 'processing') {
        await new Promise((resolve) => setTimeout(resolve, 1400));
        continue;
      }
      break;
    }

    if (!ready || sizeBytes <= 1024) {
      return { ok: false, status: 422 };
    }

    const combined = new Uint8Array(sizeBytes);
    let offset = 0;

    while (offset < sizeBytes) {
      const end = Math.min(offset + chunkSizeBytes - 1, sizeBytes - 1);
      const chunkUrl = `${endpoints.chunkBaseUrl}&start=${offset}&end=${end}`;
      const chunkRes = await fetch(chunkUrl, {
        method: 'GET',
        headers: { Accept: 'application/octet-stream' },
      });
      if (!chunkRes.ok) {
        return { ok: false, status: chunkRes.status };
      }

      const chunkBuf = await chunkRes.arrayBuffer();
      const chunkBytes = new Uint8Array(chunkBuf);
      if (chunkBytes.byteLength === 0) {
        return { ok: false, status: 422, errorMessage: 'Received empty video chunk.' };
      }

      if (offset === 0) {
        const headerCheck = validateMp4Header(chunkBytes);
        if (!headerCheck.valid) {
          return {
            ok: false,
            status: 422,
            errorMessage: headerCheck.reason || 'Invalid MP4 container header in first chunk.',
          };
        }
      }

      combined.set(chunkBytes, offset);
      offset += chunkBytes.byteLength;
    }

    return {
      ok: true,
      status: 200,
      buffer: combined.buffer,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      errorMessage: err?.message || 'Chunked download failed.',
    };
  }
}

async function tryFetchValidMp4Buffer(url: string): Promise<{
  ok: boolean;
  status: number;
  buffer?: ArrayBuffer;
  errorMessage?: string;
}> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'video/mp4,application/octet-stream;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      return {
        ok: false,
        status: response.status,
        errorMessage:
          errJson?.error || `Download failed with HTTP status ${response.status}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const validation = validateMp4Header(bytes);
    if (!validation.valid) {
      return {
        ok: false,
        status: 422,
        errorMessage: validation.reason || 'Downloaded file is not a valid MP4 video.',
      };
    }

    return { ok: true, status: 200, buffer: arrayBuffer };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      errorMessage: err?.message || 'Network error while downloading MP4.',
    };
  }
}

export async function fetchAndSaveMp4(options: {
  downloadUrl: string;
  filename: string;
  cachedBlobUrl?: string;
}): Promise<{ blobUrl: string; byteLength: number; filename: string }> {
  const safeFilename = sanitizeMp4Filename(options.filename);

  // 1. If we already have a verified in-memory Blob URL from this session, verify it's still alive and trigger instant save
  if (options.cachedBlobUrl && options.cachedBlobUrl.startsWith('blob:')) {
    try {
      const cachedRes = await fetch(options.cachedBlobUrl);
      if (cachedRes.ok) {
        const buf = await cachedRes.arrayBuffer();
        const check = validateMp4Header(new Uint8Array(buf));
        if (check.valid) {
          triggerBrowserBlobDownload(options.cachedBlobUrl, safeFilename);
          return {
            blobUrl: options.cachedBlobUrl,
            byteLength: buf.byteLength,
            filename: safeFilename,
          };
        }
      }
    } catch {
      // Cached blob URL was revoked or unavailable; fall through to fresh server fetch
    }
  }

  // 2. Primary Cloud-Run-safe chunked download (<= 8 MiB per HTTP 200 response so 45MB+ videos never hit HTTP 500)
  let result = await tryFetchChunkedMp4Buffer(options.downloadUrl);

  // 3. Fallback A: Direct single-GET fetch from the backend download endpoint
  if (!result.ok) {
    result = await tryFetchValidMp4Buffer(options.downloadUrl);
  }

  // 4. Fallback B: If /api/download failed, try the matching /api/stream endpoint
  if (!result.ok && options.downloadUrl.includes('/api/download')) {
    const streamFallbackUrl = options.downloadUrl.replace('/api/download', '/api/stream');
    result = await tryFetchValidMp4Buffer(streamFallbackUrl);
  }

  // 5. Fallback C: If /api/studio/download/:id failed, try /api/studio/clip/:id
  if (!result.ok && options.downloadUrl.includes('/api/studio/download/')) {
    const clipFallbackUrl = options.downloadUrl.replace(
      '/api/studio/download/',
      '/api/studio/clip/'
    );
    result = await tryFetchValidMp4Buffer(clipFallbackUrl);
  }

  // 6. Fallback D: If inner url is a direct MP4 URL, try fetching the direct MP4 URL
  if (!result.ok) {
    try {
      const parsed = new URL(options.downloadUrl, window.location.origin);
      const innerUrl = parsed.searchParams.get('url');
      if (innerUrl && /\.(mp4|m4v)(\?.*)?$/i.test(innerUrl)) {
        result = await tryFetchValidMp4Buffer(innerUrl);
      }
    } catch {
      // Ignore URL parse error
    }
  }

  if (!result.ok || !result.buffer) {
    throw new Error(
      result.errorMessage || 'Could not complete the MP4 video download. Please try again.'
    );
  }

  const mp4Blob = new Blob([result.buffer], { type: 'video/mp4' });
  const blobUrl = URL.createObjectURL(mp4Blob);

  triggerBrowserBlobDownload(blobUrl, safeFilename);

  return {
    blobUrl,
    byteLength: result.buffer.byteLength,
    filename: safeFilename,
  };
}

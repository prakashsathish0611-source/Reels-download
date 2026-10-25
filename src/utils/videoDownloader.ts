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
      if (textPreview.trim().startsWith('{') || textPreview.trim().toLowerCase().startsWith('<!doctype') || textPreview.trim().toLowerCase().startsWith('<html')) {
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

  // 2. Fetch the MP4 binary from the backend download endpoint
  const response = await fetch(options.downloadUrl, {
    method: 'GET',
    headers: {
      Accept: 'video/mp4,application/octet-stream;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => null);
    throw new Error(
      errJson?.error || `Download failed with HTTP status ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const validation = validateMp4Header(bytes);

  if (!validation.valid) {
    throw new Error(validation.reason || 'Downloaded file is not a valid MP4 video.');
  }

  const mp4Blob = new Blob([arrayBuffer], { type: 'video/mp4' });
  const blobUrl = URL.createObjectURL(mp4Blob);

  triggerBrowserBlobDownload(blobUrl, safeFilename);

  return {
    blobUrl,
    byteLength: arrayBuffer.byteLength,
    filename: safeFilename,
  };
}

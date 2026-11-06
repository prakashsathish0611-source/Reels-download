import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeMp4Filename,
  buildDownloadRequestUrl,
  validateMp4Header,
  buildChunkEndpointsFromDownloadUrl,
} from './videoDownloader';

test('sanitizeMp4Filename normalizes filenames and appends quality suffix cleanly', () => {
  assert.equal(
    sanitizeMp4Filename('youtube_short_tY-CR5Ki-OY.mp4', '1080p'),
    'youtube_short_tY-CR5Ki-OY_1080p.mp4'
  );
  // Does not duplicate quality suffix if already present
  assert.equal(
    sanitizeMp4Filename('youtube_short_tY-CR5Ki-OY_1080p.mp4', '1080p'),
    'youtube_short_tY-CR5Ki-OY_1080p.mp4'
  );
  // Strips unsafe characters
  assert.equal(
    sanitizeMp4Filename('my/weird:video*name?.mp4', '720p'),
    'my_weird_video_name__720p.mp4'
  );
});

test('buildDownloadRequestUrl sets quality and filename parameters without duplication', () => {
  const base =
    '/api/download?url=https%3A%2F%2Fwww.youtube.com%2Fshorts%2FtY-CR5Ki-OY&platform=youtube&id=tY-CR5Ki-OY&filename=youtube_short_tY-CR5Ki-OY.mp4';
  const built = buildDownloadRequestUrl(
    base,
    '720p',
    'youtube_short_tY-CR5Ki-OY_720p.mp4'
  );
  assert.ok(built.startsWith('/api/download?'));
  assert.ok(built.includes('quality=720p'));
  assert.ok(built.includes('filename=youtube_short_tY-CR5Ki-OY_720p.mp4'));
  // Ensure only one filename= parameter exists
  assert.equal(built.split('filename=').length - 1, 1);
});

test('buildChunkEndpointsFromDownloadUrl maps social and studio download URLs to prepare and chunk endpoints', () => {
  const socialEndpoints = buildChunkEndpointsFromDownloadUrl(
    '/api/download?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dx1Q0Saq1A8k&platform=youtube&id=x1Q0Saq1A8k&quality=1080p'
  );
  assert.ok(socialEndpoints);
  assert.ok(socialEndpoints.prepareUrl.startsWith('/api/prepare-download?'));
  assert.ok(socialEndpoints.chunkBaseUrl.startsWith('/api/download-chunk?'));
  assert.ok(socialEndpoints.chunkBaseUrl.includes('id=x1Q0Saq1A8k'));

  const studioEndpoints = buildChunkEndpointsFromDownloadUrl(
    '/api/studio/download/merged_abc123?filename=ai_merged_video.mp4'
  );
  assert.ok(studioEndpoints);
  assert.equal(studioEndpoints.prepareUrl, '/api/prepare-download?clipId=merged_abc123');
  assert.equal(studioEndpoints.chunkBaseUrl, '/api/download-chunk?clipId=merged_abc123');
});

test('validateMp4Header accepts valid ISO MP4 ftyp header and rejects HTML/JSON or empty buffers', () => {
  const validMp4 = new Uint8Array(2048);
  // Box size 32 (0x00000020) + 'ftyp' + 'isom'
  validMp4[0] = 0x00;
  validMp4[1] = 0x00;
  validMp4[2] = 0x00;
  validMp4[3] = 0x20;
  validMp4[4] = 0x66; // 'f'
  validMp4[5] = 0x74; // 't'
  validMp4[6] = 0x79; // 'y'
  validMp4[7] = 0x70; // 'p'
  assert.deepEqual(validateMp4Header(validMp4), { valid: true });

  // Reject tiny buffer
  const tiny = new Uint8Array(100);
  assert.equal(validateMp4Header(tiny).valid, false);

  // Reject JSON error response saved as buffer
  const jsonText = JSON.stringify({ error: 'Could not download video' }).padEnd(1500, ' ');
  const jsonBytes = new TextEncoder().encode(jsonText);
  const jsonCheck = validateMp4Header(jsonBytes);
  assert.equal(jsonCheck.valid, false);
  assert.ok(jsonCheck.reason?.includes('error page'));
});

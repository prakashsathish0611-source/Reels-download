import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoUrl } from './urlParser';

test('parseVideoUrl detects YouTube Shorts and enables direct download', () => {
  const result = parseVideoUrl('https://www.youtube.com/shorts/3qHkcs3kG44');
  assert.equal(result.isValid, true);
  assert.equal(result.platform, 'youtube');
  assert.equal(result.videoId, '3qHkcs3kG44');
  assert.equal(result.canEmbed, true);
  assert.equal(result.canDirectDownload, true);
  assert.ok(result.downloadUrl?.includes('platform=youtube'));
  assert.ok(result.filename.endsWith('.mp4'));
});

test('parseVideoUrl detects Instagram Reels and enables direct download', () => {
  const result = parseVideoUrl('https://www.instagram.com/reel/C3bL5J2x_9A/');
  assert.equal(result.isValid, true);
  assert.equal(result.platform, 'instagram');
  assert.equal(result.videoId, 'C3bL5J2x_9A');
  assert.equal(result.canEmbed, true);
  assert.equal(result.canDirectDownload, true);
  assert.ok(result.downloadUrl?.includes('platform=instagram'));
  assert.equal(result.filename, 'instagram_reel_C3bL5J2x_9A.mp4');
});

test('parseVideoUrl detects Facebook Reels and enables direct download', () => {
  const result = parseVideoUrl('https://www.facebook.com/reel/1029384756');
  assert.equal(result.isValid, true);
  assert.equal(result.platform, 'facebook');
  assert.equal(result.videoId, '1029384756');
  assert.equal(result.canEmbed, true);
  assert.equal(result.canDirectDownload, true);
  assert.ok(result.downloadUrl?.includes('platform=facebook'));
  assert.equal(result.filename, 'facebook_reel_1029384756.mp4');
});

test('parseVideoUrl detects Direct MP4 files and enables download', () => {
  const result = parseVideoUrl('https://example.com/videos/sample.mp4');
  assert.equal(result.isValid, true);
  assert.equal(result.platform, 'direct');
  assert.equal(result.canEmbed, true);
  assert.equal(result.canDirectDownload, true);
  assert.ok(result.downloadUrl?.startsWith('/api/download'));
});

test('parseVideoUrl handles invalid and malformed URLs gracefully', () => {
  const empty = parseVideoUrl('');
  assert.equal(empty.isValid, false);
  assert.equal(empty.canDirectDownload, false);

  const invalid = parseVideoUrl('not-a-valid-domain-1234');
  assert.equal(invalid.isValid, false);
  assert.equal(invalid.canDirectDownload, false);
  assert.ok(invalid.embedReason?.length);
});

test('parseVideoUrl handles unsupported platforms with helpful reason', () => {
  const unsupported = parseVideoUrl('https://randomblog.org/post/123');
  assert.equal(unsupported.isValid, false);
  assert.equal(unsupported.platform, 'unsupported');
  assert.equal(unsupported.canDirectDownload, false);
  assert.ok(unsupported.embedReason?.includes('randomblog.org'));
});

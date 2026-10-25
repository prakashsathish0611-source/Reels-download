import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateMergedDuration,
  normalizeAiAnalysisResponse,
  UploadedClipMetadata,
} from './videoMergePlanner';

test('estimateMergedDuration calculates sequential and split-screen durations accurately', () => {
  assert.equal(estimateMergedDuration(12.4, 8.6, 'sequential'), 21);
  assert.equal(estimateMergedDuration(12.4, 8.6, 'split_vertical'), 12.4);
  assert.equal(estimateMergedDuration(6, 15.2, 'split_horizontal'), 15.2);
});

test('normalizeAiAnalysisResponse validates enums and falls back cleanly for missing fields', () => {
  const clipA: UploadedClipMetadata = {
    clipId: 'clip_1',
    slot: 'clipA',
    filename: 'intro_short.mp4',
    durationSec: 10,
    width: 720,
    height: 1280,
    sizeBytes: 1200000,
    streamUrl: '/api/studio/clip/clip_1',
  };
  const clipB: UploadedClipMetadata = {
    clipId: 'clip_2',
    slot: 'clipB',
    filename: 'outro_reel.mp4',
    durationSec: 14,
    width: 720,
    height: 1280,
    sizeBytes: 1500000,
    streamUrl: '/api/studio/clip/clip_2',
  };

  const normalized = normalizeAiAnalysisResponse(
    {
      summary: 'High energy vertical transition.',
      recommendedLayout: 'sequential',
      recommendedEffect: 'cinematic_warm',
      recommendedTransition: 'flash_cut',
      compatibilityScore: 95,
    },
    clipA,
    clipB
  );

  assert.equal(normalized.recommendedLayout, 'sequential');
  assert.equal(normalized.recommendedEffect, 'cinematic_warm');
  assert.equal(normalized.recommendedTransition, 'flash_cut');
  assert.equal(normalized.recommendedAspectRatio, 'portrait');
  assert.equal(normalized.compatibilityScore, 95);
  assert.ok(normalized.clipAInsight.includes('intro_short.mp4'));
});

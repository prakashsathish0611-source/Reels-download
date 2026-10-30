import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampTrimRange,
  calculateEditedDuration,
  buildCssPreviewFilter,
  buildCanvasTransformStyle,
  getActiveTimedCaption,
  buildDefaultTimedCaptions,
  normalizeAiEditorSuggestion,
} from './capcutEditorConfig';

test('clampTrimRange enforces valid start/end bounds within video duration', () => {
  const res1 = clampTrimRange(-2, 50, 20);
  assert.equal(res1.trimStart, 0);
  assert.equal(res1.trimEnd, 20);

  const res2 = clampTrimRange(12, 8, 20);
  assert.equal(res2.trimStart, 12);
  assert.equal(res2.trimEnd, 13);
});

test('calculateEditedDuration computes speed-adjusted duration accurately', () => {
  assert.equal(calculateEditedDuration(0, 10, 1), 10);
  assert.equal(calculateEditedDuration(0, 10, 2), 5);
  assert.equal(calculateEditedDuration(2, 8, 0.5), 12);
});

test('buildCssPreviewFilter combines preset filter, VFX effect, and fine-tune sliders', () => {
  const css = buildCssPreviewFilter({
    filterId: 'capcut_hdr',
    vfxId: 'rgb_glitch',
    vfxIntensity: 80,
    brightness: 10,
    contrast: -5,
    saturation: 20,
  });
  assert.ok(css.includes('contrast(1.22)'));
  assert.ok(css.includes('hue-rotate('));
  assert.ok(css.includes('brightness(1.10)'));
  assert.ok(css.includes('contrast(0.95)'));
  assert.ok(css.includes('saturate(1.20)'));
});

test('buildCanvasTransformStyle combines zoom, flip, rotation, and animation', () => {
  const transform = buildCanvasTransformStyle({
    zoomScale: 120,
    rotationDeg: 90,
    flipHorizontal: true,
    flipVertical: false,
    animationId: 'zoom_punch',
  });
  assert.ok(transform.includes('scale(-1.34, 1.34)'));
  assert.ok(transform.includes('rotate(90deg)'));
});

test('buildDefaultTimedCaptions and getActiveTimedCaption resolve active subtitle cues', () => {
  const cues = buildDefaultTimedCaptions(
    ['HOOK 1', 'ACTION 2', 'PAYOFF 3'],
    0,
    9
  );
  assert.equal(cues.length, 3);
  assert.equal(getActiveTimedCaption(cues, 1.2, true, 'FALLBACK'), 'HOOK 1');
  assert.equal(getActiveTimedCaption(cues, 4.5, true, 'FALLBACK'), 'ACTION 2');
  assert.equal(getActiveTimedCaption(cues, 8.1, true, 'FALLBACK'), 'PAYOFF 3');
  assert.equal(getActiveTimedCaption(cues, 4.5, false, 'FALLBACK'), 'FALLBACK');
});

test('normalizeAiEditorSuggestion validates AI suggestions including VFX, animation, and timed captions', () => {
  const normalized = normalizeAiEditorSuggestion(
    {
      sceneSummary: 'Fast street dance clip',
      suggestedCaptions: ['WATCH THIS STEP', 'WAIT FOR THE DROP', 'INSANE FINALE'],
      recommendedFilter: 'warm_vintage',
      recommendedVfx: 'rgb_glitch',
      recommendedAnimation: 'zoom_punch',
      recommendedSticker: 'fire_viral',
      recommendedSpeed: 1.25,
      recommendedCanvasRatio: '9:16',
      recommendedTrimStart: 1,
      recommendedTrimEnd: 9,
      recommendedCaptionPosition: 'center',
      recommendedCaptionStyle: 'emerald_tag',
    },
    12,
    720,
    1280
  );

  assert.equal(normalized.recommendedFilter, 'warm_vintage');
  assert.equal(normalized.recommendedVfx, 'rgb_glitch');
  assert.equal(normalized.recommendedAnimation, 'zoom_punch');
  assert.equal(normalized.recommendedSticker, 'fire_viral');
  assert.equal(normalized.recommendedSpeed, 1.25);
  assert.equal(normalized.timedCaptions.length, 3);
  assert.equal(normalized.recommendedTrimStart, 1);
  assert.equal(normalized.recommendedTrimEnd, 9);
});

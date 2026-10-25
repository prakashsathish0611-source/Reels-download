import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampTrimRange,
  calculateEditedDuration,
  buildCssPreviewFilter,
  normalizeAiEditorSuggestion,
} from './capcutEditorConfig';

test('clampTrimRange enforces valid start/end bounds within video duration', () => {
  assert.deepEqual(clampTrimRange(0, 12, 20), { trimStart: 0, trimEnd: 12 });
  assert.deepEqual(clampTrimRange(-5, 50, 18.4), { trimStart: 0, trimEnd: 18.4 });
  // When start >= end, enforces at least 1s span
  assert.deepEqual(clampTrimRange(10, 8, 15), { trimStart: 10, trimEnd: 11 });
});

test('calculateEditedDuration computes speed-adjusted duration accurately', () => {
  assert.equal(calculateEditedDuration(0, 10, 1), 10);
  assert.equal(calculateEditedDuration(2, 12, 2), 5);
  assert.equal(calculateEditedDuration(0, 9, 0.5), 18);
});

test('buildCssPreviewFilter combines preset filter and fine-tune sliders', () => {
  const css = buildCssPreviewFilter({
    filterId: 'capcut_hdr',
    brightness: 10,
    contrast: 5,
    saturation: 20,
  });
  assert.ok(css.includes('contrast(1.16)'));
  assert.ok(css.includes('brightness(1.10)'));
  assert.ok(css.includes('saturate(1.20)'));
});

test('normalizeAiEditorSuggestion validates AI suggestions and provides safe defaults', () => {
  const suggestion = normalizeAiEditorSuggestion(
    {
      sceneSummary: 'Fast vertical action clip',
      suggestedCaptions: ['MUST WATCH'],
      recommendedFilter: 'warm_vintage',
      recommendedSpeed: 1.25,
      recommendedTrimStart: 1,
      recommendedTrimEnd: 9.5,
    },
    14,
    360,
    640
  );
  assert.equal(suggestion.recommendedFilter, 'warm_vintage');
  assert.equal(suggestion.recommendedSpeed, 1.25);
  assert.equal(suggestion.recommendedCanvasRatio, '9:16');
  assert.equal(suggestion.recommendedTrimStart, 1);
  assert.equal(suggestion.recommendedTrimEnd, 9.5);
  assert.deepEqual(suggestion.suggestedCaptions, ['MUST WATCH']);
});

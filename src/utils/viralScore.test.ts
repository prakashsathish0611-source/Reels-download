import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateViralScore,
  getScoreTier,
  timestampToSeconds,
  secondsToTimestamp,
  categorizeDuration,
} from './viralScore';
import { ViralScoreBreakdown } from '../types/clip';

test('calculateViralScore computes exact formula weighting', () => {
  // Test case: 100 on everything -> 100
  const perfect: ViralScoreBreakdown = {
    hookStrength: 100,
    retentionPotential: 100,
    emotionalImpact: 100,
    curiosity: 100,
    shareability: 100,
    commentPotential: 100,
    standaloneClarity: 100,
  };
  assert.equal(calculateViralScore(perfect), 100);

  // Test case: realistic high potential clip
  // 95*0.20 (19) + 90*0.20 (18) + 85*0.15 (12.75) + 95*0.15 (14.25) + 80*0.10 (8) + 85*0.10 (8.5) + 90*0.10 (9)
  // Total = 19 + 18 + 12.75 + 14.25 + 8 + 8.5 + 9 = 89.5 -> rounds to 90
  const candidate: ViralScoreBreakdown = {
    hookStrength: 95,
    retentionPotential: 90,
    emotionalImpact: 85,
    curiosity: 95,
    shareability: 80,
    commentPotential: 85,
    standaloneClarity: 90,
  };
  assert.equal(calculateViralScore(candidate), 90);
});

test('getScoreTier assigns correct badge and recommendation', () => {
  assert.equal(getScoreTier(94).tier, 'Viral Gold');
  assert.equal(getScoreTier(85).tier, 'High Potential');
  assert.equal(getScoreTier(75).tier, 'Solid Performer');
  assert.equal(getScoreTier(60).tier, 'Moderate');
});

test('timestampToSeconds and secondsToTimestamp round-trip correctly', () => {
  assert.equal(timestampToSeconds('12:43'), 763);
  assert.equal(timestampToSeconds('01:14:20'), 4460);
  assert.equal(timestampToSeconds('45'), 45);

  assert.equal(secondsToTimestamp(763), '12:43');
  assert.equal(secondsToTimestamp(4460), '01:14:20');
  assert.equal(secondsToTimestamp(45), '00:45');
});

test('categorizeDuration groups short-form tiers accurately', () => {
  assert.equal(categorizeDuration(22), '15-30s');
  assert.equal(categorizeDuration(30), '15-30s');
  assert.equal(categorizeDuration(45), '30-60s');
  assert.equal(categorizeDuration(60), '30-60s');
  assert.equal(categorizeDuration(78), '60-90s');
});

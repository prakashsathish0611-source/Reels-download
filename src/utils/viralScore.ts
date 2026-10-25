import { ViralScoreBreakdown } from '../types/clip';

/**
 * Calculates the exact Viral Potential Score according to Step 3 of CLIP AI:
 * - Hook strength: 20%
 * - Retention potential: 20%
 * - Emotional impact: 15%
 * - Curiosity: 15%
 * - Shareability: 10%
 * - Comment potential: 10%
 * - Standalone clarity: 10%
 * Total = 100%
 */
export function calculateViralScore(breakdown: ViralScoreBreakdown): number {
  const weighted =
    (breakdown.hookStrength * 0.20) +
    (breakdown.retentionPotential * 0.20) +
    (breakdown.emotionalImpact * 0.15) +
    (breakdown.curiosity * 0.15) +
    (breakdown.shareability * 0.10) +
    (breakdown.commentPotential * 0.10) +
    (breakdown.standaloneClarity * 0.10);

  return Math.round(Math.min(100, Math.max(0, weighted)));
}

export type ScoreTier = 'Viral Gold' | 'High Potential' | 'Solid Performer' | 'Moderate';

export function getScoreTier(score: number): {
  tier: ScoreTier;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  recommendation: string;
} {
  if (score >= 90) {
    return {
      tier: 'Viral Gold',
      color: 'text-amber-400',
      badgeBg: 'bg-amber-500/10',
      badgeBorder: 'border-amber-500/30',
      recommendation: 'Must-clip! Top 1% retention hook & standalone clarity.',
    };
  }
  if (score >= 82) {
    return {
      tier: 'High Potential',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/10',
      badgeBorder: 'border-emerald-500/30',
      recommendation: 'Strong candidate for YouTube Shorts algorithm distribution.',
    };
  }
  if (score >= 70) {
    return {
      tier: 'Solid Performer',
      color: 'text-blue-400',
      badgeBg: 'bg-blue-500/10',
      badgeBorder: 'border-blue-500/30',
      recommendation: 'Good engagement for targeted niche audiences.',
    };
  }
  return {
    tier: 'Moderate',
    color: 'text-zinc-400',
    badgeBg: 'bg-zinc-500/10',
    badgeBorder: 'border-zinc-500/30',
    recommendation: 'Needs tighter hook editing or clearer payoff.',
  };
}

/**
 * Parses timestamp string (e.g. "12:43", "01:23:45", or "45") to seconds
 */
export function timestampToSeconds(timestamp: string): number {
  if (!timestamp) return 0;
  const parts = timestamp.trim().split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  }
  return parts[0] || 0;
}

/**
 * Formats seconds to "MM:SS" or "HH:MM:SS"
 */
export function secondsToTimestamp(seconds: number): string {
  const sec = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
}

export function categorizeDuration(seconds: number): '15-30s' | '30-60s' | '60-90s' {
  if (seconds <= 30) return '15-30s';
  if (seconds <= 60) return '30-60s';
  return '60-90s';
}

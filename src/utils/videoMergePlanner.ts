export type MergeLayoutId = 'sequential' | 'split_vertical' | 'split_horizontal';
export type VisualEffectId = 'cinematic_warm' | 'vibrant_pop' | 'cool_studio' | 'bw_contrast' | 'natural_clean';
export type TransitionStyleId = 'crossfade' | 'flash_cut' | 'dip_to_black' | 'direct_cut';
export type OutputAspectRatio = 'portrait' | 'landscape';

export interface UploadedClipMetadata {
  clipId: string;
  slot: 'clipA' | 'clipB';
  filename: string;
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  streamUrl: string;
  thumbnailUrl?: string;
}

export interface DualVideoAiAnalysis {
  summary: string;
  clipAInsight: string;
  clipBInsight: string;
  recommendedLayout: MergeLayoutId;
  recommendedEffect: VisualEffectId;
  recommendedTransition: TransitionStyleId;
  recommendedAspectRatio: OutputAspectRatio;
  suggestedHookTitle: string;
  designRationale: string;
  compatibilityScore: number;
}

export interface MergeDesignOption<T extends string> {
  id: T;
  label: string;
  description: string;
}

export const MERGE_LAYOUT_OPTIONS: MergeDesignOption<MergeLayoutId>[] = [
  {
    id: 'sequential',
    label: 'Sequential Story (Clip 1 → Clip 2)',
    description: 'Plays Video 1 followed by Video 2 with a smooth transition.',
  },
  {
    id: 'split_vertical',
    label: 'Top / Bottom Split Duet (9:16)',
    description: 'Stacks Video 1 on top and Video 2 on bottom in one vertical frame.',
  },
  {
    id: 'split_horizontal',
    label: 'Side-by-Side Split (16:9)',
    description: 'Places Video 1 on the left and Video 2 on the right simultaneously.',
  },
];

export const VISUAL_EFFECT_OPTIONS: MergeDesignOption<VisualEffectId>[] = [
  {
    id: 'cinematic_warm',
    label: 'Cinematic Warm Gold',
    description: 'Rich amber highlights, deeper contrast, and warm skin tones.',
  },
  {
    id: 'vibrant_pop',
    label: 'Vibrant Social Pop',
    description: 'Boosted saturation and crisp contrast for Reels & Shorts.',
  },
  {
    id: 'cool_studio',
    label: 'Teal & Cool Studio',
    description: 'Clean modern cool shadows with balanced highlights.',
  },
  {
    id: 'bw_contrast',
    label: 'High-Contrast Monochrome',
    description: 'Dramatic black-and-white editorial film look.',
  },
  {
    id: 'natural_clean',
    label: 'Natural HD Original',
    description: 'Preserves original colors with normalized brightness.',
  },
];

export const TRANSITION_STYLE_OPTIONS: MergeDesignOption<TransitionStyleId>[] = [
  {
    id: 'crossfade',
    label: 'Smooth Crossfade',
    description: 'Blends the end of Video 1 into the start of Video 2.',
  },
  {
    id: 'dip_to_black',
    label: 'Cinema Dip to Black',
    description: 'Fades out Video 1 to black and fades in Video 2.',
  },
  {
    id: 'flash_cut',
    label: 'Bright Flash Cut',
    description: 'High-energy bright exposure transition between clips.',
  },
  {
    id: 'direct_cut',
    label: 'Instant Beat Cut',
    description: 'Zero-gap hard cut from Video 1 directly into Video 2.',
  },
];

export function estimateMergedDuration(
  clipADuration: number,
  clipBDuration: number,
  layout: MergeLayoutId
): number {
  const durA = Math.max(1, Number.isFinite(clipADuration) ? clipADuration : 5);
  const durB = Math.max(1, Number.isFinite(clipBDuration) ? clipBDuration : 5);
  if (layout === 'sequential') {
    return Math.round((durA + durB) * 10) / 10;
  }
  // For split-screen duet layouts, both videos play simultaneously for the shorter/capped duration
  return Math.round(Math.max(durA, durB) * 10) / 10;
}

export function normalizeAiAnalysisResponse(
  raw: Partial<DualVideoAiAnalysis> | null | undefined,
  clipA?: UploadedClipMetadata | null,
  clipB?: UploadedClipMetadata | null
): DualVideoAiAnalysis {
  const validLayouts: MergeLayoutId[] = ['sequential', 'split_vertical', 'split_horizontal'];
  const validEffects: VisualEffectId[] = [
    'cinematic_warm',
    'vibrant_pop',
    'cool_studio',
    'bw_contrast',
    'natural_clean',
  ];
  const validTransitions: TransitionStyleId[] = [
    'crossfade',
    'flash_cut',
    'dip_to_black',
    'direct_cut',
  ];

  const isPortraitA = clipA ? clipA.height >= clipA.width : true;
  const isPortraitB = clipB ? clipB.height >= clipB.width : true;
  const defaultAspect: OutputAspectRatio = isPortraitA && isPortraitB ? 'portrait' : 'landscape';

  const recommendedLayout: MergeLayoutId =
    raw?.recommendedLayout && validLayouts.includes(raw.recommendedLayout)
      ? raw.recommendedLayout
      : 'sequential';

  const recommendedEffect: VisualEffectId =
    raw?.recommendedEffect && validEffects.includes(raw.recommendedEffect)
      ? raw.recommendedEffect
      : 'vibrant_pop';

  const recommendedTransition: TransitionStyleId =
    raw?.recommendedTransition && validTransitions.includes(raw.recommendedTransition)
      ? raw.recommendedTransition
      : 'crossfade';

  const recommendedAspectRatio: OutputAspectRatio =
    raw?.recommendedAspectRatio === 'portrait' || raw?.recommendedAspectRatio === 'landscape'
      ? raw.recommendedAspectRatio
      : recommendedLayout === 'split_horizontal'
      ? 'landscape'
      : defaultAspect;

  const rawScore = Number(raw?.compatibilityScore);
  const compatibilityScore =
    Number.isFinite(rawScore) && rawScore >= 50 && rawScore <= 100
      ? Math.round(rawScore)
      : 92;

  return {
    summary:
      raw?.summary?.trim() ||
      'Both clips share complementary motion and framing. A sequential story merge with color grading creates a cohesive single video.',
    clipAInsight:
      raw?.clipAInsight?.trim() ||
      `Clip 1 (${clipA?.filename || 'Opening Clip'}) establishes strong visual hook and pacing.`,
    clipBInsight:
      raw?.clipBInsight?.trim() ||
      `Clip 2 (${clipB?.filename || 'Closing Clip'}) delivers visual payoff and continuation.`,
    recommendedLayout,
    recommendedEffect,
    recommendedTransition,
    recommendedAspectRatio,
    suggestedHookTitle:
      raw?.suggestedHookTitle?.trim() || 'Merged AI Reel Cut',
    designRationale:
      raw?.designRationale?.trim() ||
      'Matching luminance and applying a unified contrast curve unifies both video sources into a seamless final MP4.',
    compatibilityScore,
  };
}

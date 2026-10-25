export type CapCutFilterId =
  | 'none'
  | 'capcut_hdr'
  | 'warm_vintage'
  | 'cyber_teal'
  | 'moody_matte'
  | 'bw_noir';

export type CapCutSpeedOption = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
export type CapCutCanvasRatio = '9:16' | '16:9' | '1:1';
export type CapCutCaptionPosition = 'top' | 'center' | 'bottom';
export type CapCutCaptionStyleId = 'viral_yellow' | 'clean_white' | 'cinema_dark' | 'emerald_tag';

export interface CapCutEditState {
  trimStart: number;
  trimEnd: number;
  speed: CapCutSpeedOption;
  filterId: CapCutFilterId;
  brightness: number; // -30 to +30
  contrast: number; // -30 to +30
  saturation: number; // -50 to +50
  canvasRatio: CapCutCanvasRatio;
  captionText: string;
  captionPosition: CapCutCaptionPosition;
  captionStyle: CapCutCaptionStyleId;
  volumePercent: number; // 0 to 150
  audioFade: boolean;
  vignette: boolean;
}

export interface CapCutAiEditSuggestion {
  sceneSummary: string;
  suggestedCaptions: string[];
  recommendedFilter: CapCutFilterId;
  recommendedSpeed: CapCutSpeedOption;
  recommendedCanvasRatio: CapCutCanvasRatio;
  recommendedTrimStart: number;
  recommendedTrimEnd: number;
  recommendedCaptionPosition: CapCutCaptionPosition;
  recommendedCaptionStyle: CapCutCaptionStyleId;
  editingTip: string;
}

export const CAPCUT_FILTER_PRESETS: {
  id: CapCutFilterId;
  label: string;
  description: string;
  cssFilter: string;
}[] = [
  {
    id: 'none',
    label: 'Original HD',
    description: 'Unfiltered natural camera colors.',
    cssFilter: 'none',
  },
  {
    id: 'capcut_hdr',
    label: 'CapCut Crisp HDR',
    description: 'Punchy micro-contrast and vivid social saturation.',
    cssFilter: 'contrast(1.16) saturate(1.28) brightness(1.03)',
  },
  {
    id: 'warm_vintage',
    label: 'Golden Hour Film',
    description: 'Warm amber highlights and soft cinematic tones.',
    cssFilter: 'contrast(1.1) saturate(1.2) sepia(0.18) brightness(1.03)',
  },
  {
    id: 'cyber_teal',
    label: 'Cool Teal Studio',
    description: 'Clean studio contrast with cool shadow tint.',
    cssFilter: 'contrast(1.12) saturate(1.12) hue-rotate(-8deg)',
  },
  {
    id: 'moody_matte',
    label: 'Moody Cinema Matte',
    description: 'Desaturated filmic shadows with lifted contrast.',
    cssFilter: 'contrast(1.15) saturate(0.82) brightness(0.97)',
  },
  {
    id: 'bw_noir',
    label: 'Noir Monochrome',
    description: 'High-contrast black and white street look.',
    cssFilter: 'grayscale(1) contrast(1.25) brightness(1.02)',
  },
];

export const CAPCUT_SPEED_OPTIONS: { value: CapCutSpeedOption; label: string }[] = [
  { value: 0.5, label: '0.5x Slow-Mo' },
  { value: 0.75, label: '0.75x Smooth' },
  { value: 1, label: '1.0x Normal' },
  { value: 1.25, label: '1.25x Snappy' },
  { value: 1.5, label: '1.5x Fast Cut' },
  { value: 2, label: '2.0x Hyper' },
];

export const CAPTION_STYLE_PRESETS: {
  id: CapCutCaptionStyleId;
  label: string;
  previewClass: string;
}[] = [
  {
    id: 'viral_yellow',
    label: 'Viral Amber Box',
    previewClass: 'bg-amber-400 text-slate-950 font-extrabold px-3 py-1 rounded-md shadow-md',
  },
  {
    id: 'clean_white',
    label: 'Clean White Pill',
    previewClass: 'bg-white text-slate-950 font-extrabold px-3 py-1 rounded-md shadow-md',
  },
  {
    id: 'cinema_dark',
    label: 'Cinema Dark Bar',
    previewClass: 'bg-black/80 text-white border border-white/20 font-bold px-3.5 py-1.5 rounded-md',
  },
  {
    id: 'emerald_tag',
    label: 'Emerald Highlight',
    previewClass: 'bg-emerald-400 text-slate-950 font-extrabold px-3 py-1 rounded-md shadow-md',
  },
];

export function clampTrimRange(
  startSec: number,
  endSec: number,
  maxDurationSec: number
): { trimStart: number; trimEnd: number } {
  const safeMax = Math.max(1, Number.isFinite(maxDurationSec) ? maxDurationSec : 10);
  const minClipLen = Math.min(1, safeMax);
  const clampedStart = Math.max(0, Math.min(startSec, safeMax - minClipLen));
  const clampedEnd = Math.max(clampedStart + minClipLen, Math.min(endSec, safeMax));
  return {
    trimStart: Math.round(clampedStart * 10) / 10,
    trimEnd: Math.round(clampedEnd * 10) / 10,
  };
}

export function calculateEditedDuration(
  trimStart: number,
  trimEnd: number,
  speed: CapCutSpeedOption
): number {
  const rawSpan = Math.max(0.5, trimEnd - trimStart);
  const safeSpeed = speed > 0 ? speed : 1;
  return Math.round((rawSpan / safeSpeed) * 10) / 10;
}

export function buildCssPreviewFilter(state: Pick<
  CapCutEditState,
  'filterId' | 'brightness' | 'contrast' | 'saturation'
>): string {
  const preset = CAPCUT_FILTER_PRESETS.find((p) => p.id === state.filterId);
  const base = preset && preset.cssFilter !== 'none' ? `${preset.cssFilter} ` : '';
  const b = (1 + state.brightness / 100).toFixed(2);
  const c = (1 + state.contrast / 100).toFixed(2);
  const s = (1 + state.saturation / 100).toFixed(2);
  return `${base}brightness(${b}) contrast(${c}) saturate(${s})`.trim();
}

export function normalizeAiEditorSuggestion(
  raw: Partial<CapCutAiEditSuggestion> | null | undefined,
  durationSec: number,
  width: number,
  height: number
): CapCutAiEditSuggestion {
  const safeDur = Math.max(2, Number.isFinite(durationSec) ? durationSec : 12);
  const validFilters: CapCutFilterId[] = [
    'none',
    'capcut_hdr',
    'warm_vintage',
    'cyber_teal',
    'moody_matte',
    'bw_noir',
  ];
  const validSpeeds: CapCutSpeedOption[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const validRatios: CapCutCanvasRatio[] = ['9:16', '16:9', '1:1'];
  const validPositions: CapCutCaptionPosition[] = ['top', 'center', 'bottom'];
  const validStyles: CapCutCaptionStyleId[] = [
    'viral_yellow',
    'clean_white',
    'cinema_dark',
    'emerald_tag',
  ];

  const isPortrait = height >= width;
  const { trimStart, trimEnd } = clampTrimRange(
    Number(raw?.recommendedTrimStart ?? 0),
    Number(raw?.recommendedTrimEnd ?? Math.min(safeDur, 15)),
    safeDur
  );

  const captions = Array.isArray(raw?.suggestedCaptions)
    ? raw!.suggestedCaptions.filter((c) => typeof c === 'string' && c.trim().length > 0).slice(0, 4)
    : [];

  if (captions.length === 0) {
    captions.push(
      'WAIT FOR THE END',
      'POV: THIS CHANGED EVERYTHING',
      'WATCH THIS TRANSFORMATION'
    );
  }

  return {
    sceneSummary:
      raw?.sceneSummary?.trim() ||
      `Detected ${width}×${height} video (${safeDur}s). Applying CapCut Crisp HDR grading and a tight hook trim boosts viewer retention.`,
    suggestedCaptions: captions,
    recommendedFilter:
      raw?.recommendedFilter && validFilters.includes(raw.recommendedFilter)
        ? raw.recommendedFilter
        : 'capcut_hdr',
    recommendedSpeed:
      raw?.recommendedSpeed && validSpeeds.includes(raw.recommendedSpeed as CapCutSpeedOption)
        ? (raw.recommendedSpeed as CapCutSpeedOption)
        : 1,
    recommendedCanvasRatio:
      raw?.recommendedCanvasRatio && validRatios.includes(raw.recommendedCanvasRatio)
        ? raw.recommendedCanvasRatio
        : isPortrait
        ? '9:16'
        : '16:9',
    recommendedTrimStart: trimStart,
    recommendedTrimEnd: trimEnd,
    recommendedCaptionPosition:
      raw?.recommendedCaptionPosition && validPositions.includes(raw.recommendedCaptionPosition)
        ? raw.recommendedCaptionPosition
        : 'bottom',
    recommendedCaptionStyle:
      raw?.recommendedCaptionStyle && validStyles.includes(raw.recommendedCaptionStyle)
        ? raw.recommendedCaptionStyle
        : 'viral_yellow',
    editingTip:
      raw?.editingTip?.trim() ||
      'Place a high-contrast hook caption in the lower third and trim any dead air in the first 0.5 seconds.',
  };
}

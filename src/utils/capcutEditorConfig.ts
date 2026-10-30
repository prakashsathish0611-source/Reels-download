export type CapCutFilterId =
  | 'none'
  | 'capcut_hdr'
  | 'warm_vintage'
  | 'cyber_teal'
  | 'moody_matte'
  | 'bw_noir';

export type CapCutVfxId =
  | 'none'
  | 'rgb_glitch'
  | 'vhs_retro'
  | 'neon_pulse'
  | 'cinema_scope'
  | 'dreamy_bloom'
  | 'flash_strobe'
  | 'bw_film_grain';

export type CapCutAnimationId =
  | 'none'
  | 'zoom_punch'
  | 'whip_slide'
  | 'spin_pop'
  | 'shake_impact'
  | 'fade_cinema';

export type CapCutStickerId =
  | 'none'
  | 'fire_viral'
  | 'zap_wait'
  | 'hundred_cut'
  | 'eyes_watch'
  | 'sound_on';

export type CapCutCanvasBgId = 'blur' | 'black' | 'amber_glow' | 'cyber_grid';

export type CapCutSpeedOption = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
export type CapCutCanvasRatio = '9:16' | '16:9' | '1:1';
export type CapCutCaptionPosition = 'top' | 'center' | 'bottom';
export type CapCutCaptionStyleId = 'viral_yellow' | 'clean_white' | 'cinema_dark' | 'emerald_tag';

export interface CapCutTimedCaption {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
}

export interface CapCutTimelineSegment {
  id: string;
  startSec: number;
  endSec: number;
  label: string;
}

export interface CapCutEditState {
  trimStart: number;
  trimEnd: number;
  speed: CapCutSpeedOption;
  filterId: CapCutFilterId;
  vfxId: CapCutVfxId;
  vfxIntensity: number; // 10 to 100
  animationId: CapCutAnimationId;
  stickerId: CapCutStickerId;
  canvasBg: CapCutCanvasBgId;
  zoomScale: number; // 100 to 200 (%)
  rotationDeg: 0 | 90 | 180 | 270;
  flipHorizontal: boolean;
  flipVertical: boolean;
  brightness: number; // -30 to +30
  contrast: number; // -30 to +30
  saturation: number; // -50 to +50
  canvasRatio: CapCutCanvasRatio;
  captionText: string;
  timedCaptions: CapCutTimedCaption[];
  useTimedCaptions: boolean;
  captionPosition: CapCutCaptionPosition;
  captionStyle: CapCutCaptionStyleId;
  volumePercent: number; // 0 to 150
  bassBoost: boolean;
  voiceClarity: boolean;
  audioFade: boolean;
  vignette: boolean;
}

export interface CapCutAiEditSuggestion {
  sceneSummary: string;
  suggestedCaptions: string[];
  timedCaptions: CapCutTimedCaption[];
  recommendedFilter: CapCutFilterId;
  recommendedVfx: CapCutVfxId;
  recommendedAnimation: CapCutAnimationId;
  recommendedSticker: CapCutStickerId;
  recommendedSpeed: CapCutSpeedOption;
  recommendedCanvasRatio: CapCutCanvasRatio;
  recommendedTrimStart: number;
  recommendedTrimEnd: number;
  recommendedCaptionPosition: CapCutCaptionPosition;
  recommendedCaptionStyle: CapCutCaptionStyleId;
  editingTip: string;
}

export const CAPCUT_VFX_PRESETS: {
  id: CapCutVfxId;
  label: string;
  badge: string;
  description: string;
}[] = [
  {
    id: 'none',
    label: 'No VFX',
    badge: 'Clean',
    description: 'Clean camera feed without visual FX overlay.',
  },
  {
    id: 'rgb_glitch',
    label: 'RGB Cyber Glitch',
    badge: 'Trending',
    description: 'Chromatic RGB channel split with digital scanline jitter.',
  },
  {
    id: 'vhs_retro',
    label: '90s VHS Camcorder',
    badge: 'Retro',
    description: 'Authentic VHS tape grain, REC HUD overlay, and warm color bleed.',
  },
  {
    id: 'neon_pulse',
    label: 'Neon Glow Pulse',
    badge: 'Vibrant',
    description: 'Electric magenta-cyan edge bloom and hyper saturation.',
  },
  {
    id: 'cinema_scope',
    label: 'Anamorphic 2.35:1',
    badge: 'Cinema',
    description: 'Widescreen theatrical letterbox bars with film contrast.',
  },
  {
    id: 'dreamy_bloom',
    label: 'Dreamy Soft Halation',
    badge: 'Aesthetic',
    description: 'Soft highlight mist and warm golden-hour diffusion.',
  },
  {
    id: 'flash_strobe',
    label: 'Beat Flash Impact',
    badge: 'Energy',
    description: 'High-energy optical flash pulse synced to motion cuts.',
  },
  {
    id: 'bw_film_grain',
    label: '16mm Film Grain',
    badge: 'Noir',
    description: 'High-contrast monochrome with organic 16mm silver grain.',
  },
];

export const CAPCUT_ANIMATION_PRESETS: {
  id: CapCutAnimationId;
  label: string;
  type: 'In' | 'Combo';
  description: string;
}[] = [
  {
    id: 'none',
    label: 'None',
    type: 'In',
    description: 'Steady frame without motion animation.',
  },
  {
    id: 'zoom_punch',
    label: 'Zoom Punch In',
    type: 'Combo',
    description: 'Dynamic 112% punch-in zoom for high-retention hooks.',
  },
  {
    id: 'whip_slide',
    label: 'Dynamic Tilt',
    type: 'In',
    description: 'Subtle Dutch-angle kinetic tilt with zoomed framing.',
  },
  {
    id: 'spin_pop',
    label: 'Cinema Zoom 125%',
    type: 'Combo',
    description: 'Tight close-up framing for facial expressions and reactions.',
  },
  {
    id: 'shake_impact',
    label: 'Handheld Action',
    type: 'Combo',
    description: 'Energetic handheld camera feel with slight overscan.',
  },
  {
    id: 'fade_cinema',
    label: 'Fade In/Out',
    type: 'In',
    description: 'Smooth theatrical fade transition at clip boundaries.',
  },
];

export const CAPCUT_STICKER_PRESETS: {
  id: CapCutStickerId;
  label: string;
  text: string;
  badgeClass: string;
}[] = [
  {
    id: 'none',
    label: 'No Sticker',
    text: '',
    badgeClass: '',
  },
  {
    id: 'fire_viral',
    label: '🔥 VIRAL HIT',
    text: '🔥 VIRAL HIT',
    badgeClass: 'bg-gradient-to-r from-orange-500 to-rose-600 text-white border-white/30',
  },
  {
    id: 'zap_wait',
    label: '⚡ WAIT FOR IT',
    text: '⚡ WAIT FOR IT',
    badgeClass: 'bg-amber-400 text-slate-950 border-slate-950/30',
  },
  {
    id: 'hundred_cut',
    label: '💯 10/10 CUT',
    text: '💯 10/10 CUT',
    badgeClass: 'bg-emerald-400 text-slate-950 border-slate-950/30',
  },
  {
    id: 'eyes_watch',
    label: '👀 WATCH CLOSELY',
    text: '👀 WATCH CLOSELY',
    badgeClass: 'bg-indigo-500 text-white border-white/30',
  },
  {
    id: 'sound_on',
    label: '🔊 SOUND ON',
    text: '🔊 SOUND ON',
    badgeClass: 'bg-slate-900/90 text-amber-400 border-amber-400/50',
  },
];

export const CAPCUT_CANVAS_BG_PRESETS: {
  id: CapCutCanvasBgId;
  label: string;
  previewClass: string;
}[] = [
  {
    id: 'blur',
    label: 'Motion Blur Fill',
    previewClass: 'bg-gradient-to-br from-slate-800 via-slate-900 to-amber-950/60',
  },
  {
    id: 'black',
    label: 'Cinema Black',
    previewClass: 'bg-black',
  },
  {
    id: 'amber_glow',
    label: 'Warm Studio Glow',
    previewClass: 'bg-gradient-to-tr from-amber-950 via-slate-900 to-rose-950',
  },
  {
    id: 'cyber_grid',
    label: 'Cyber Indigo',
    previewClass: 'bg-gradient-to-tr from-indigo-950 via-slate-950 to-cyan-950',
  },
];

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
    cssFilter: 'contrast(1.22) saturate(1.38) brightness(1.04)',
  },
  {
    id: 'warm_vintage',
    label: 'Golden Hour Film',
    description: 'Warm amber highlights and soft cinematic tones.',
    cssFilter: 'contrast(1.15) saturate(1.30) sepia(0.28) brightness(1.05)',
  },
  {
    id: 'cyber_teal',
    label: 'Cool Teal Studio',
    description: 'Clean studio contrast with cool shadow tint.',
    cssFilter: 'contrast(1.20) saturate(1.25) hue-rotate(-18deg)',
  },
  {
    id: 'moody_matte',
    label: 'Moody Cinema Matte',
    description: 'Desaturated filmic shadows with lifted contrast.',
    cssFilter: 'contrast(1.26) saturate(0.68) brightness(0.95)',
  },
  {
    id: 'bw_noir',
    label: 'Noir Monochrome',
    description: 'High-contrast black and white street look.',
    cssFilter: 'grayscale(1) contrast(1.35) brightness(1.03)',
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
    previewClass: 'bg-amber-400 text-slate-950 font-extrabold px-3 py-1 rounded-md shadow-lg',
  },
  {
    id: 'clean_white',
    label: 'Clean White Pill',
    previewClass: 'bg-white text-slate-950 font-extrabold px-3 py-1 rounded-md shadow-lg',
  },
  {
    id: 'cinema_dark',
    label: 'Cinema Dark Bar',
    previewClass: 'bg-black/85 text-white border border-white/25 font-bold px-3.5 py-1.5 rounded-md',
  },
  {
    id: 'emerald_tag',
    label: 'Emerald Highlight',
    previewClass: 'bg-emerald-400 text-slate-950 font-extrabold px-3 py-1 rounded-md shadow-lg',
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

export function buildCssPreviewFilter(
  state: Pick<CapCutEditState, 'filterId' | 'brightness' | 'contrast' | 'saturation'> & {
    vfxId?: CapCutVfxId;
    vfxIntensity?: number;
  }
): string {
  const preset = CAPCUT_FILTER_PRESETS.find((p) => p.id === state.filterId);
  const base = preset && preset.cssFilter !== 'none' ? `${preset.cssFilter} ` : '';

  const intensityRatio = Math.max(0.1, Math.min(1, (state.vfxIntensity ?? 75) / 100));
  let vfxCss = '';
  if (state.vfxId === 'rgb_glitch') {
    const sat = (1 + 0.45 * intensityRatio).toFixed(2);
    const con = (1 + 0.25 * intensityRatio).toFixed(2);
    vfxCss = `saturate(${sat}) contrast(${con}) hue-rotate(${Math.round(-12 * intensityRatio)}deg) `;
  } else if (state.vfxId === 'vhs_retro') {
    const sep = (0.35 * intensityRatio).toFixed(2);
    vfxCss = `sepia(${sep}) contrast(1.18) saturate(1.25) `;
  } else if (state.vfxId === 'neon_pulse') {
    const sat = (1 + 0.75 * intensityRatio).toFixed(2);
    vfxCss = `saturate(${sat}) contrast(1.26) brightness(1.06) hue-rotate(${Math.round(14 * intensityRatio)}deg) `;
  } else if (state.vfxId === 'dreamy_bloom') {
    vfxCss = `brightness(1.08) contrast(1.06) saturate(1.22) `;
  } else if (state.vfxId === 'flash_strobe') {
    vfxCss = `brightness(1.14) contrast(1.24) saturate(1.18) `;
  } else if (state.vfxId === 'bw_film_grain') {
    vfxCss = `grayscale(1) contrast(1.38) brightness(1.04) `;
  } else if (state.vfxId === 'cinema_scope') {
    vfxCss = `contrast(1.18) saturate(1.14) `;
  }

  const b = (1 + state.brightness / 100).toFixed(2);
  const c = (1 + state.contrast / 100).toFixed(2);
  const s = (1 + state.saturation / 100).toFixed(2);
  return `${base}${vfxCss}brightness(${b}) contrast(${c}) saturate(${s})`.trim();
}

export function buildCanvasTransformStyle(
  state: Pick<
    CapCutEditState,
    'zoomScale' | 'rotationDeg' | 'flipHorizontal' | 'flipVertical' | 'animationId'
  >
): string {
  const baseScale = Math.max(1, Math.min(2.2, (state.zoomScale || 100) / 100));
  let animScale = 1;
  let animRotate = 0;

  if (state.animationId === 'zoom_punch') {
    animScale = 1.12;
  } else if (state.animationId === 'spin_pop') {
    animScale = 1.24;
  } else if (state.animationId === 'whip_slide') {
    animScale = 1.08;
    animRotate = -2;
  } else if (state.animationId === 'shake_impact') {
    animScale = 1.06;
    animRotate = 1.5;
  }

  const totalScale = (baseScale * animScale).toFixed(2);
  const scaleX = state.flipHorizontal ? `-${totalScale}` : totalScale;
  const scaleY = state.flipVertical ? `-${totalScale}` : totalScale;
  const totalRotate = (state.rotationDeg || 0) + animRotate;

  return `scale(${scaleX}, ${scaleY}) rotate(${totalRotate}deg)`;
}

export function getActiveTimedCaption(
  cues: CapCutTimedCaption[],
  currentTimeSec: number,
  useTimedCaptions: boolean,
  fallbackText: string
): string {
  if (!useTimedCaptions || !Array.isArray(cues) || cues.length === 0) {
    return fallbackText;
  }
  const active = cues.find(
    (c) => currentTimeSec >= c.startSec - 0.05 && currentTimeSec <= c.endSec + 0.05
  );
  if (active) return active.text;
  return fallbackText;
}

export function buildDefaultTimedCaptions(
  captions: string[],
  trimStart: number,
  trimEnd: number
): CapCutTimedCaption[] {
  const span = Math.max(1.5, trimEnd - trimStart);
  const safeList =
    captions.length >= 3
      ? captions.slice(0, 3)
      : ['WAIT FOR THE END', 'POV: THIS CHANGED EVERYTHING', '10/10 VISUAL UPGRADE'];
  const segLen = Math.round((span / safeList.length) * 10) / 10;

  return safeList.map((text, idx) => {
    const startSec = Math.round((trimStart + idx * segLen) * 10) / 10;
    const endSec =
      idx === safeList.length - 1
        ? Math.round(trimEnd * 10) / 10
        : Math.round((trimStart + (idx + 1) * segLen) * 10) / 10;
    return {
      id: `cue_${idx + 1}`,
      startSec,
      endSec,
      text,
    };
  });
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
  const validVfx: CapCutVfxId[] = [
    'none',
    'rgb_glitch',
    'vhs_retro',
    'neon_pulse',
    'cinema_scope',
    'dreamy_bloom',
    'flash_strobe',
    'bw_film_grain',
  ];
  const validAnims: CapCutAnimationId[] = [
    'none',
    'zoom_punch',
    'whip_slide',
    'spin_pop',
    'shake_impact',
    'fade_cinema',
  ];
  const validStickers: CapCutStickerId[] = [
    'none',
    'fire_viral',
    'zap_wait',
    'hundred_cut',
    'eyes_watch',
    'sound_on',
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
      'WATCH THIS TRANSFORMATION',
      '10/10 STUDIO GRADE'
    );
  }

  const timedCaptions = buildDefaultTimedCaptions(captions, trimStart, trimEnd);

  return {
    sceneSummary:
      raw?.sceneSummary?.trim() ||
      `Detected ${width}×${height} video (${safeDur}s). Applying CapCut Crisp HDR grading, RGB Cyber Glitch VFX, and timed auto-captions boosts viewer retention.`,
    suggestedCaptions: captions,
    timedCaptions,
    recommendedFilter:
      raw?.recommendedFilter && validFilters.includes(raw.recommendedFilter)
        ? raw.recommendedFilter
        : 'capcut_hdr',
    recommendedVfx:
      raw?.recommendedVfx && validVfx.includes(raw.recommendedVfx)
        ? raw.recommendedVfx
        : 'neon_pulse',
    recommendedAnimation:
      raw?.recommendedAnimation && validAnims.includes(raw.recommendedAnimation)
        ? raw.recommendedAnimation
        : 'zoom_punch',
    recommendedSticker:
      raw?.recommendedSticker && validStickers.includes(raw.recommendedSticker)
        ? raw.recommendedSticker
        : 'fire_viral',
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
      'Combine Neon Glow Pulse VFX with Zoom Punch In animation and 3 timed hook captions for maximum short-form engagement.',
  };
}

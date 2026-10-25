export interface ViralScoreBreakdown {
  hookStrength: number; // 20%
  retentionPotential: number; // 20%
  emotionalImpact: number; // 15%
  curiosity: number; // 15%
  shareability: number; // 10%
  commentPotential: number; // 10%
  standaloneClarity: number; // 10%
}

export interface CaptionWord {
  word: string;
  start: number; // seconds relative to clip start
  end: number;
  highlight?: boolean;
}

export interface CaptionLine {
  start: number;
  end: number;
  text: string;
  words: CaptionWord[];
}

export interface ThumbnailConcept {
  mainVisualSubject: string;
  facialExpression: string;
  overlayText: string; // 2-5 words
  composition: string;
  clickReason: string;
}

export interface StandaloneAudit {
  makesSenseWithoutContext: boolean;
  firstThreeSecondsInterest: string;
  clearPayoff: string;
  unnecessarySetupRemoved: string;
  quickEngagementCheck: string;
}

export interface ClipCandidate {
  id: string;
  rank: number;
  viralScore: number;
  breakdown: ViralScoreBreakdown;
  startTime: string; // e.g. "12:43" or "01:14:20"
  endTime: string; // e.g. "13:28"
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  durationCategory: '15-30s' | '30-60s' | '60-90s';
  hook: string;
  hookStructureType: string;
  topic: string;
  whyItWorks: string[];
  suggestedTitles: [string, string, string];
  description: string;
  hashtags: string[];
  thumbnailConcept: ThumbnailConcept;
  standaloneAudit: StandaloneAudit;
  captions: CaptionLine[];
  speaker: string;
  energyLevel: 'High' | 'Explosive' | 'Intense Thought' | 'Story Arc';
}

export interface VideoAnalysis {
  videoTitle: string;
  youtubeUrl: string;
  channelName: string;
  totalDuration: string;
  summary: string;
  keyTopics: string[];
  identifiedSpeakers: string[];
  clips: ClipCandidate[];
  analyzedAt: string;
  targetClipCount?: number;
}

export type CaptionPreset = 'hormozi' | 'beast' | 'minimal' | 'neon';
export type PlayerAspectRatio = 'portrait' | 'landscape';
export type CropPosition = 'auto' | 'left' | 'center' | 'right';

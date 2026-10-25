import { ClipCandidate } from '../types/clip';

/**
 * Format seconds to SRT timestamp: 00:00:00,000
 */
function toSrtTime(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const millis = Math.min(999, Math.round((s - Math.floor(s)) * 1000));

  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
}

/**
 * Format seconds to WebVTT timestamp: 00:00:00.000
 */
function toVttTime(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const millis = Math.min(999, Math.round((s - Math.floor(s)) * 1000));

  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

/**
 * Generates valid SubRip (.SRT) subtitle file
 */
export function generateSRT(clip: ClipCandidate): string {
  if (!clip.captions || clip.captions.length === 0) {
    return `1\n00:00:00,000 --> 00:00:05,000\n${clip.hook}\n`;
  }

  return clip.captions
    .map((cap, idx) => {
      const startTime = toSrtTime(cap.start);
      const endTime = toSrtTime(cap.end);
      return `${idx + 1}\n${startTime} --> ${endTime}\n${cap.text}\n`;
    })
    .join('\n');
}

/**
 * Generates valid WebVTT (.vtt) subtitle file
 */
export function generateVTT(clip: ClipCandidate): string {
  let vtt = 'WEBVTT\n\n';
  if (!clip.captions || clip.captions.length === 0) {
    return vtt + `1\n00:00:00.000 --> 00:00:05.000\n${clip.hook}\n`;
  }

  vtt += clip.captions
    .map((cap, idx) => {
      const startTime = toVttTime(cap.start);
      const endTime = toVttTime(cap.end);
      return `${idx + 1}\n${startTime} --> ${endTime}\n${cap.text}\n`;
    })
    .join('\n');

  return vtt;
}

/**
 * Generates standard EDL (Edit Decision List) for DaVinci Resolve & Adobe Premiere Pro
 */
export function generatePremiereEDL(clip: ClipCandidate, videoTitle: string): string {
  const cleanTitle = (videoTitle || 'CLIP_AI_EXPORT').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  const inTc = toSrtTime(clip.startSeconds).replace(',', ':');
  const outTc = toSrtTime(clip.endSeconds).replace(',', ':');
  const clipDurationTc = toSrtTime(clip.durationSeconds).replace(',', ':');

  return `TITLE: ${cleanTitle}_CLIP_${clip.rank}
FCM: NON-DROP FRAME

001  AX       V     C        ${inTc} ${outTc} 00:00:00:00 ${clipDurationTc}
* FROM CLIP NAME: ${cleanTitle}
* VIRAL SCORE: ${clip.viralScore}/100
* HOOK: ${clip.hook}
* TOPIC: ${clip.topic}
* SUGGESTED TITLE: ${clip.suggestedTitles[0]}
`;
}

/**
 * Generates ready-to-paste YouTube Shorts publishing kit
 */
export function generateMetadataText(clip: ClipCandidate, videoTitle: string): string {
  return `=== CLIP AI — YOUTUBE SHORTS PUBLISHING KIT ===
CLIP RANK: #${clip.rank} | VIRAL SCORE: ${clip.viralScore}/100 (${clip.durationSeconds}s)
ORIGINAL SOURCE: ${videoTitle}
TIMESTAMPS: ${clip.startTime} -> ${clip.endTime}

------------------------------------------------
1. RECOMMENDED TITLES (Curiosity & High CTR):
------------------------------------------------
Option 1: ${clip.suggestedTitles[0]}
Option 2: ${clip.suggestedTitles[1]}
Option 3: ${clip.suggestedTitles[2]}

------------------------------------------------
2. HOOK (First 1-3 Seconds):
------------------------------------------------
"${clip.hook}"
Structure: ${clip.hookStructureType}

------------------------------------------------
3. DESCRIPTION:
------------------------------------------------
${clip.description}

------------------------------------------------
4. HASHTAGS:
------------------------------------------------
${clip.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')}

------------------------------------------------
5. SHORTS COVER / THUMBNAIL CONCEPT:
------------------------------------------------
- Visual Subject: ${clip.thumbnailConcept.mainVisualSubject}
- Facial Expression: ${clip.thumbnailConcept.facialExpression}
- Overlay Text: "${clip.thumbnailConcept.overlayText}"
- Composition: ${clip.thumbnailConcept.composition}
- Why it Clicks: ${clip.thumbnailConcept.clickReason}
`;
}

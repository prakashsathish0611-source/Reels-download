import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSRT, generateVTT, generatePremiereEDL, generateMetadataText } from './exportFormats';
import { ClipCandidate } from '../types/clip';

const mockClip: ClipCandidate = {
  id: 'clip-1',
  rank: 1,
  viralScore: 94,
  breakdown: {
    hookStrength: 95,
    retentionPotential: 94,
    emotionalImpact: 92,
    curiosity: 96,
    shareability: 90,
    commentPotential: 92,
    standaloneClarity: 95,
  },
  startTime: '12:43',
  endTime: '13:28',
  startSeconds: 763,
  endSeconds: 808,
  durationSeconds: 45,
  durationCategory: '30-60s',
  hook: 'Most people completely misunderstand this about wealth...',
  hookStructureType: 'Problem & Common Myth',
  topic: 'The biggest mistake beginners make when trying to get rich.',
  whyItWorks: [
    'Immediate curiosity gap in first 2 seconds',
    'Challenger viewpoint against conventional wisdom',
    'No preamble or greetings',
  ],
  suggestedTitles: [
    'The Wealth Secret Nobody Talks About',
    'Why 99% of People Stay Stuck',
    'Stop Trading Time for Money Immediately',
  ],
  description: 'Naval Ravikant breaks down why modern work structures keep people trapped and the single mindset shift needed for real leverage.',
  hashtags: ['#wealthcreation', '#shorts', '#mindset', '#finance', '#naval'],
  thumbnailConcept: {
    mainVisualSubject: 'Naval gesturing decisively towards camera',
    facialExpression: 'Focused, calm intensity',
    overlayText: 'STOP WASTING YEARS',
    composition: 'Extreme close up with contrast backlighting',
    clickReason: 'Creates urgent self-reflection on current life choices',
  },
  standaloneAudit: {
    makesSenseWithoutContext: true,
    firstThreeSecondsInterest: 'Bold myth-busting statement creates instant tension',
    clearPayoff: 'Delivers concrete three-part rule for leverage',
    unnecessarySetupRemoved: 'Removed 18s of host banter and coffee sip',
    quickEngagementCheck: 'Answers an unspoken dilemma within 12 seconds',
  },
  captions: [
    {
      start: 0,
      end: 3.2,
      text: 'Most people completely misunderstand how wealth actually works.',
      words: [
        { word: 'Most', start: 0, end: 0.4 },
        { word: 'people', start: 0.4, end: 0.8 },
        { word: 'completely', start: 0.8, end: 1.4, highlight: true },
        { word: 'misunderstand', start: 1.4, end: 2.1, highlight: true },
        { word: 'how', start: 2.1, end: 2.3 },
        { word: 'wealth', start: 2.3, end: 2.7, highlight: true },
        { word: 'works.', start: 2.7, end: 3.2 },
      ],
    },
    {
      start: 3.3,
      end: 6.5,
      text: 'You are never going to get rich renting out your time.',
      words: [
        { word: 'You', start: 3.3, end: 3.5 },
        { word: 'are', start: 3.5, end: 3.7 },
        { word: 'never', start: 3.7, end: 4.1, highlight: true },
        { word: 'going', start: 4.1, end: 4.4 },
        { word: 'to', start: 4.4, end: 4.5 },
        { word: 'get', start: 4.5, end: 4.8 },
        { word: 'rich', start: 4.8, end: 5.2, highlight: true },
        { word: 'renting', start: 5.2, end: 5.8 },
        { word: 'time.', start: 5.8, end: 6.5, highlight: true },
      ],
    },
  ],
  speaker: 'Naval Ravikant',
  energyLevel: 'Intense Thought',
};

test('generateSRT creates valid numbering and arrows', () => {
  const srt = generateSRT(mockClip);
  assert.ok(srt.includes('1\n00:00:00,000 --> 00:00:03,200'));
  assert.ok(srt.includes('Most people completely misunderstand how wealth actually works.'));
  assert.ok(srt.includes('2\n00:00:03,300 --> 00:00:06,500'));
});

test('generateVTT starts with WEBVTT header and decimal timestamps', () => {
  const vtt = generateVTT(mockClip);
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(vtt.includes('00:00:00.000 --> 00:00:03.200'));
});

test('generatePremiereEDL contains title, FCM, and timecodes', () => {
  const edl = generatePremiereEDL(mockClip, 'Joe Rogan Naval');
  assert.ok(edl.includes('TITLE: Joe_Rogan_Naval_CLIP_1'));
  assert.ok(edl.includes('FCM: NON-DROP FRAME'));
  assert.ok(edl.includes('* VIRAL SCORE: 94/100'));
});

test('generateMetadataText contains 3 title options and hashtag formatting', () => {
  const meta = generateMetadataText(mockClip, 'Naval Ravikant Podcast');
  assert.ok(meta.includes('Option 1: The Wealth Secret Nobody Talks About'));
  assert.ok(meta.includes('Option 2: Why 99% of People Stay Stuck'));
  assert.ok(meta.includes('Option 3: Stop Trading Time for Money Immediately'));
  assert.ok(meta.includes('#wealthcreation'));
});

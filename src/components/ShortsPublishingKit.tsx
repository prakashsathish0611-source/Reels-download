import React, { useState } from 'react';
import { ClipCandidate } from '../types/clip';
import {
  generateSRT,
  generateVTT,
  generatePremiereEDL,
  generateMetadataText,
} from '../utils/exportFormats';
import {
  Copy,
  Check,
  Download,
  Sparkles,
  FileText,
  FileCode,
  Image as ImageIcon,
  Tag,
  Type,
  Share2,
} from 'lucide-react';

interface ShortsPublishingKitProps {
  clip: ClipCandidate;
  videoTitle: string;
}

export const ShortsPublishingKit: React.FC<ShortsPublishingKitProps> = ({ clip, videoTitle }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSRT = () => {
    const srt = generateSRT(clip);
    downloadFile(`clip_${clip.rank}_subtitles.srt`, srt, 'text/plain');
  };

  const handleDownloadVTT = () => {
    const vtt = generateVTT(clip);
    downloadFile(`clip_${clip.rank}_subtitles.vtt`, vtt, 'text/vtt');
  };

  const handleDownloadEDL = () => {
    const edl = generatePremiereEDL(clip, videoTitle);
    downloadFile(`clip_${clip.rank}_premiere.edl`, edl, 'text/plain');
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(clip, null, 2);
    downloadFile(`clip_${clip.rank}_package.json`, jsonStr, 'application/json');
  };

  return (
    <div className="space-y-6">
      {/* 1. Title Variations (Step 8) */}
      <div className="p-4 sm:p-5 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Type className="h-4 w-4 text-amber-400" />
            <span>3 High-CTR YouTube Shorts Titles</span>
          </h4>
          <span className="text-[11px] text-zinc-400">Curiosity-driven &bull; Honest</span>
        </div>

        <div className="space-y-2">
          {clip.suggestedTitles.map((title, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold font-mono text-amber-400/80 w-6">
                  0{idx + 1}
                </span>
                <span className="text-sm font-semibold text-zinc-100">{title}</span>
              </div>
              <button
                onClick={() => handleCopy(`title-${idx}`, title)}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                title="Copy Title"
              >
                {copiedKey === `title-${idx}` ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400 text-[11px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span className="text-[11px]">Copy</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 2. YouTube Description & Key Takeaways (Step 9) */}
      <div className="p-4 sm:p-5 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-indigo-400" />
            <span>YouTube Description &amp; Keywords</span>
          </h4>
          <button
            onClick={() => handleCopy('desc', clip.description)}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
          >
            {copiedKey === 'desc' ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400 text-[11px]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span className="text-[11px]">Copy</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs sm:text-sm text-zinc-300 bg-zinc-950 p-3.5 rounded-lg border border-zinc-800/80 leading-relaxed font-normal">
          {clip.description}
        </p>
      </div>

      {/* 3. Targeted Hashtags (Step 10) */}
      <div className="p-4 sm:p-5 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="h-4 w-4 text-rose-400" />
            <span>Targeted Shorts Hashtags</span>
          </h4>
          <button
            onClick={() =>
              handleCopy(
                'tags',
                clip.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')
              )
            }
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
          >
            {copiedKey === 'tags' ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400 text-[11px]">Copied All</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span className="text-[11px]">Copy All</span>
              </>
            )}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {clip.hashtags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-zinc-950 text-rose-300 border border-rose-500/20 rounded-lg text-xs font-medium"
            >
              {tag.startsWith('#') ? tag : `#${tag}`}
            </span>
          ))}
        </div>
      </div>

      {/* 4. Shorts Cover / Thumbnail Concept (Step 11) */}
      <div className="p-4 sm:p-5 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-3">
        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4 text-emerald-400" />
          <span>Shorts Cover / Thumbnail Concept</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-1">
            <span className="font-semibold text-zinc-400 uppercase text-[10px] tracking-wider">
              Main Visual Subject:
            </span>
            <p className="text-zinc-200 font-medium">{clip.thumbnailConcept.mainVisualSubject}</p>
          </div>

          <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-1">
            <span className="font-semibold text-zinc-400 uppercase text-[10px] tracking-wider">
              Facial Expression:
            </span>
            <p className="text-zinc-200 font-medium">{clip.thumbnailConcept.facialExpression}</p>
          </div>

          <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-1">
            <span className="font-semibold text-zinc-400 uppercase text-[10px] tracking-wider">
              Text Overlay (2-5 Words):
            </span>
            <p className="text-amber-400 font-black text-sm uppercase tracking-wide">
              "{clip.thumbnailConcept.overlayText}"
            </p>
          </div>

          <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-1">
            <span className="font-semibold text-zinc-400 uppercase text-[10px] tracking-wider">
              Composition:
            </span>
            <p className="text-zinc-300">{clip.thumbnailConcept.composition}</p>
          </div>
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
          <span className="font-bold text-amber-300">Why it drives clicks: </span>
          <span className="text-zinc-300">{clip.thumbnailConcept.clickReason}</span>
        </div>
      </div>

      {/* 5. Production Export Hub */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <Download className="h-4 w-4 text-amber-400" />
            <span>Export &amp; Editor Production Files</span>
          </h4>
          <button
            onClick={() => handleCopy('all-meta', generateMetadataText(clip, videoTitle))}
            className="text-xs font-bold text-zinc-950 bg-amber-400 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow"
          >
            {copiedKey === 'all-meta' ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Kit Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Entire Publishing Kit</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={handleDownloadSRT}
            className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-zinc-200">Subtitles (.SRT)</span>
              <Download className="h-3.5 w-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
            </div>
            <p className="text-[10px] text-zinc-400">Standard SubRip file</p>
          </button>

          <button
            onClick={handleDownloadVTT}
            className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-zinc-200">WebVTT (.VTT)</span>
              <Download className="h-3.5 w-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
            </div>
            <p className="text-[10px] text-zinc-400">Modern web captions</p>
          </button>

          <button
            onClick={handleDownloadEDL}
            className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-zinc-200">Premiere / Resolve</span>
              <FileCode className="h-3.5 w-3.5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
            </div>
            <p className="text-[10px] text-zinc-400">EDL timeline markers</p>
          </button>

          <button
            onClick={handleDownloadJSON}
            className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-zinc-200">Clip Package JSON</span>
              <Download className="h-3.5 w-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
            </div>
            <p className="text-[10px] text-zinc-400">Full analysis &amp; scores</p>
          </button>
        </div>
      </div>
    </div>
  );
};

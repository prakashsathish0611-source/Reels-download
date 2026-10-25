import React from 'react';
import { ClipCandidate } from '../types/clip';
import { getScoreTier } from '../utils/viralScore';
import { Play, Sparkles, CheckCircle2, ChevronRight, Clock, User, BarChart2, Download } from 'lucide-react';

interface ClipCardProps {
  clip: ClipCandidate;
  isSelected: boolean;
  onSelect: (clip: ClipCandidate) => void;
  onOpenScoreModal: (clip: ClipCandidate) => void;
  onOpenExportModal: (clip: ClipCandidate) => void;
}

export const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  isSelected,
  onSelect,
  onOpenScoreModal,
  onOpenExportModal,
}) => {
  const tier = getScoreTier(clip.viralScore);

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isSelected
          ? 'bg-zinc-900 border-amber-500/80 ring-2 ring-amber-500/30 shadow-xl shadow-amber-500/5'
          : 'bg-zinc-900/60 hover:bg-zinc-900/90 border-zinc-800/80 hover:border-zinc-700'
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Top Header: Rank, Timestamps, Score */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-zinc-950 font-black text-sm flex items-center justify-center shadow">
              #{clip.rank}
            </span>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1 font-mono text-zinc-300">
                <Clock className="h-3 w-3 text-zinc-500" />
                {clip.startTime} &rarr; {clip.endTime}
              </span>
              <span className="text-zinc-600">&bull;</span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium text-[11px]">
                {clip.durationSeconds}s ({clip.durationCategory})
              </span>
            </div>
          </div>

          {/* Viral Score Gauge */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Viral Score</span>
              <span className={`text-base font-black ${tier.color}`}>
                {clip.viralScore}<span className="text-xs font-normal text-zinc-500">/100</span>
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tier.badgeBg} ${tier.badgeBorder} ${tier.color}`}
            >
              {tier.tier}
            </span>
          </div>
        </div>

        {/* Hook statement */}
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Hook ({clip.hookStructureType}):
          </p>
          <p className="text-sm sm:text-base font-bold text-white leading-snug line-clamp-2">
            "{clip.hook}"
          </p>
        </div>

        {/* Topic and Speaker */}
        <div className="mb-3.5 space-y-1">
          <p className="text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">Topic: </span>
            {clip.topic}
          </p>
          {clip.speaker && (
            <p className="text-xs text-zinc-500 flex items-center gap-1">
              <User className="h-3 w-3 text-zinc-400" />
              <span>Speaker: <strong className="text-zinc-300 font-medium">{clip.speaker}</strong></span>
              <span className="text-zinc-600">&bull;</span>
              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="h-3 w-3" /> Standalone Verified
              </span>
            </p>
          )}
        </div>

        {/* Primary Title Suggestion */}
        <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 mb-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
            Suggested YouTube Shorts Title:
          </span>
          <p className="text-xs sm:text-sm font-semibold text-zinc-100 line-clamp-1">
            {clip.suggestedTitles[0]}
          </p>
        </div>

        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenScoreModal(clip)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              title="View 7-factor viral score audit"
            >
              <BarChart2 className="h-3.5 w-3.5 text-amber-400" />
              <span>Score Audit</span>
            </button>

            <button
              onClick={() => onOpenExportModal(clip)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Copy titles, tags, and download subtitles"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" />
              <span>Publishing Kit</span>
            </button>
          </div>

          <button
            onClick={() => onSelect(clip)}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow ${
              isSelected
                ? 'bg-amber-400 text-zinc-950 shadow-amber-400/20'
                : 'bg-zinc-800 hover:bg-amber-400 hover:text-zinc-950 text-white'
            }`}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{isSelected ? 'Currently Playing in 9:16' : 'Open in 9:16 Studio'}</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

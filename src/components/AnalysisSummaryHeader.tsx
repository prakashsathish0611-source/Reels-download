import React from 'react';
import { VideoAnalysis } from '../types/clip';
import { Clock, User, Hash, Flame, Award, ExternalLink } from 'lucide-react';

interface AnalysisSummaryHeaderProps {
  analysis: VideoAnalysis;
}

export const AnalysisSummaryHeader: React.FC<AnalysisSummaryHeaderProps> = ({ analysis }) => {
  const avgViralScore =
    analysis.clips.length > 0
      ? Math.round(
          analysis.clips.reduce((acc, c) => acc + c.viralScore, 0) / analysis.clips.length
        )
      : 0;

  const topScore =
    analysis.clips.length > 0
      ? Math.max(...analysis.clips.map((c) => c.viralScore))
      : 0;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 mb-6 backdrop-blur-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
              {analysis.channelName || 'YouTube Source'}
            </span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Duration: {analysis.totalDuration || 'Full Video'}
            </span>
            {analysis.youtubeUrl && (
              <a
                href={analysis.youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
              >
                <span>Original Link</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {analysis.videoTitle}
          </h2>

          <p className="text-xs sm:text-sm text-zinc-300 mt-1.5 leading-relaxed line-clamp-2">
            {analysis.summary}
          </p>

          {/* Speakers and Topics */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {analysis.identifiedSpeakers && analysis.identifiedSpeakers.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mr-2">
                <User className="h-3.5 w-3.5 text-indigo-400" />
                <span className="font-medium text-zinc-300">
                  {analysis.identifiedSpeakers.join(', ')}
                </span>
              </div>
            )}

            {analysis.keyTopics &&
              analysis.keyTopics.slice(0, 4).map((topic) => (
                <span
                  key={topic}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/50 flex items-center gap-1"
                >
                  <Hash className="h-2.5 w-2.5 text-zinc-500" />
                  {topic}
                </span>
              ))}
          </div>
        </div>

        {/* Highlight Stats Badges */}
        <div className="flex items-center gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-800">
          <div className="px-4 py-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Award className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Top Viral Score</p>
              <p className="text-xl font-extrabold text-amber-400">{topScore}<span className="text-xs font-normal text-zinc-500">/100</span></p>
            </div>
          </div>

          <div className="px-4 py-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Flame className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Clips Extracted</p>
              <p className="text-xl font-extrabold text-emerald-400">{analysis.clips.length} <span className="text-xs font-normal text-zinc-500">Shorts</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

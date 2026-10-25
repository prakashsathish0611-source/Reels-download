import React from 'react';
import { X, BookOpen, CheckCircle, ShieldAlert, Zap, Target, Award } from 'lucide-react';

interface StrategyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StrategyGuideModal: React.FC<StrategyGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow">
              <BookOpen className="h-5 w-5 text-zinc-950" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                CLIP AI Strategy &amp; Editorial Constitution
              </h3>
              <p className="text-xs text-zinc-400">
                12-Step Viral Short-Form Architecture &bull; Formula &amp; Rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs sm:text-sm text-zinc-300">
          {/* Formula Callout */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <h4 className="font-bold text-amber-300 text-sm mb-2 flex items-center gap-1.5">
              <Zap className="h-4 w-4" />
              <span>Step 3: Viral Potential Score Formula (0–100)</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 bg-zinc-950/70 rounded-lg border border-amber-500/20">
                <span className="text-amber-400 font-bold">20%</span> Hook Strength
              </div>
              <div className="p-2 bg-zinc-950/70 rounded-lg border border-amber-500/20">
                <span className="text-emerald-400 font-bold">20%</span> Retention Potential
              </div>
              <div className="p-2 bg-zinc-950/70 rounded-lg border border-amber-500/20">
                <span className="text-rose-400 font-bold">15%</span> Emotional Impact
              </div>
              <div className="p-2 bg-zinc-950/70 rounded-lg border border-amber-500/20">
                <span className="text-indigo-400 font-bold">15%</span> Curiosity Gap
              </div>
              <div className="p-2 bg-zinc-950/70 rounded-lg border border-amber-500/20">
                <span className="text-blue-400 font-bold">10%</span> Shareability
              </div>
              <div className="p-2 bg-zinc-950/70 rounded-lg border border-amber-500/20">
                <span className="text-purple-400 font-bold">10%</span> Comment Potential
              </div>
              <div className="p-2 bg-zinc-950/70 rounded-lg border border-amber-500/20">
                <span className="text-teal-400 font-bold">10%</span> Standalone Clarity
              </div>
              <div className="p-2 bg-zinc-950/70 rounded-lg border border-amber-500/20 font-bold text-amber-300">
                = 100% Score
              </div>
            </div>
          </div>

          {/* 12 Steps Summary */}
          <div>
            <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-400" />
              <span>The 12-Step Strategic Pipeline</span>
            </h4>
            <div className="space-y-3">
              {[
                { step: 'Step 1: Deep Video Analysis', desc: 'Analyzes full transcript, speaker switches, emotional beats, surprising statements, debates, and curiosity gaps.' },
                { step: 'Step 2: Candidate Identification', desc: 'Filters for 20 high-value criteria: strong hooks, unexpected answers, conflict, practical lessons, and memorable quotes.' },
                { step: 'Step 3: Viral Potential Scoring', desc: 'Evaluates each candidate from 0 to 100 using the exact weighted algorithm and standalone viewer clarity tests.' },
                { step: 'Step 4: Smart Clip Duration', desc: 'Prefers 15-30s punchy, 30-60s explanations/stories, up to 90s for deep context. Removes dead space and filler without altering meaning.' },
                { step: 'Step 5: First 1-3s Hook Engineering', desc: 'Opens on the strongest statement to immediately arrest scrolling.' },
                { step: 'Step 6: 9:16 Vertical Reframing', desc: 'Identifies active speaker timestamps, frames for 9:16 mobile canvas, smooth transitions.' },
                { step: 'Step 7: Dynamic Captions', desc: 'Max 2 lines at once, short rhythmic chunks, synchronized word highlights, keeps faces uncovered.' },
                { step: 'Step 8: 3 Title Variations', desc: 'High-CTR, curiosity-driven titles with zero misleading bait.' },
                { step: 'Step 9: YouTube Description', desc: 'Key takeaway with natural keyword integration for YouTube search discovery.' },
                { step: 'Step 10: Targeted Hashtags', desc: '3-5 high-signal content hashtags.' },
                { step: 'Step 11: Shorts Cover Concept', desc: 'Subject, facial expression, 2-5 word text overlay, and psychological reason for clicking.' },
                { step: 'Step 12: Descending Rank Delivery', desc: 'Clips returned in descending viral order so creators immediately edit and publish the highest probability winner.' },
              ].map((item, idx) => (
                <div key={idx} className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
                  <p className="font-bold text-amber-400 text-xs">{item.step}</p>
                  <p className="text-zinc-300 text-xs mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Editorial Integrity Rules */}
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <h4 className="font-bold text-red-400 text-sm mb-2 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" />
              <span>Strict Editorial Rules (Never Violate)</span>
            </h4>
            <ul className="space-y-1.5 text-xs text-zinc-300 list-disc list-inside">
              <li><strong>Never invent dialogue:</strong> Always preserve the speaker's true words and phrasing.</li>
              <li><strong>Never distort context:</strong> A statement must never be clipped to reverse its intention.</li>
              <li><strong>Never fabricate quotes or reactions.</strong></li>
              <li><strong>Never prioritize empty controversy over legitimate value.</strong></li>
              <li><strong>Core Equation:</strong> High Retention + High Value + Accurate Context.</li>
            </ul>
          </div>

          {/* Final Objective */}
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-center">
            <p className="text-xs uppercase tracking-widest font-black text-indigo-300 mb-1">
              Final Viewer Journey Objective
            </p>
            <p className="text-xs sm:text-sm font-extrabold text-white tracking-wide">
              STOP &rarr; WATCH &rarr; STAY &rarr; FINISH &rarr; REWATCH &rarr; LIKE &rarr; COMMENT &rarr; SHARE &rarr; SUBSCRIBE
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

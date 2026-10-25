import React from 'react';
import { ClipCandidate } from '../types/clip';
import { getScoreTier } from '../utils/viralScore';
import { CheckCircle2, AlertCircle, HelpCircle, BarChart3, Zap, Eye, Heart, MessageSquare, Share2, Sparkles } from 'lucide-react';

interface ViralScoreBreakdownViewProps {
  clip: ClipCandidate;
}

export const ViralScoreBreakdownView: React.FC<ViralScoreBreakdownViewProps> = ({ clip }) => {
  const tierInfo = getScoreTier(clip.viralScore);
  const bd = clip.breakdown;

  const scoreFactors = [
    {
      name: 'Hook Strength',
      weight: '20%',
      value: bd.hookStrength,
      icon: Zap,
      color: 'text-amber-400',
      barColor: 'from-amber-500 to-amber-400',
      description: 'First 1-3s stopping power, bold claim, curiosity trigger.',
    },
    {
      name: 'Retention Potential',
      weight: '20%',
      value: bd.retentionPotential,
      icon: Eye,
      color: 'text-emerald-400',
      barColor: 'from-emerald-500 to-emerald-400',
      description: 'Fast pacing, tight delivery, low dead-air, high rewatchability.',
    },
    {
      name: 'Curiosity Gap',
      weight: '15%',
      value: bd.curiosity,
      icon: Sparkles,
      color: 'text-indigo-400',
      barColor: 'from-indigo-500 to-indigo-400',
      description: 'Creates an open loop or question the viewer must stay to answer.',
    },
    {
      name: 'Emotional Impact',
      weight: '15%',
      value: bd.emotionalImpact,
      icon: Heart,
      color: 'text-rose-400',
      barColor: 'from-rose-500 to-rose-400',
      description: 'Provocative conviction, surprise, revelation, or high motivation.',
    },
    {
      name: 'Shareability',
      weight: '10%',
      value: bd.shareability,
      icon: Share2,
      color: 'text-blue-400',
      barColor: 'from-blue-500 to-blue-400',
      description: 'Value people want to send to friends, peers, or save for later.',
    },
    {
      name: 'Comment Potential',
      weight: '10%',
      value: bd.commentPotential,
      icon: MessageSquare,
      color: 'text-purple-400',
      barColor: 'from-purple-500 to-purple-400',
      description: 'Sparks healthy debate, agreement, disagreement, or personal takes.',
    },
    {
      name: 'Standalone Clarity',
      weight: '10%',
      value: bd.standaloneClarity,
      icon: BarChart3,
      color: 'text-teal-400',
      barColor: 'from-teal-500 to-teal-400',
      description: 'Complete sense without needing the prior 60 minutes of video.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-black ${tierInfo.color}`}>
              {clip.viralScore}/100
            </span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${tierInfo.badgeBg} ${tierInfo.badgeBorder} ${tierInfo.color} border`}>
              {tierInfo.tier}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">{tierInfo.recommendation}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Clip Duration</p>
          <p className="text-sm font-bold text-white">{clip.durationSeconds}s ({clip.durationCategory})</p>
          <p className="text-xs text-zinc-400">{clip.startTime} &rarr; {clip.endTime}</p>
        </div>
      </div>

      {/* 7-Factor Breakdown Cards */}
      <div>
        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-amber-400" />
          <span>7-Factor Viral Algorithm Breakdown</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scoreFactors.map((factor) => {
            const Icon = factor.icon;
            return (
              <div key={factor.name} className="p-3 bg-zinc-900/90 border border-zinc-800/80 rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${factor.color}`} />
                    <span className="text-xs font-semibold text-zinc-200">{factor.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({factor.weight})</span>
                  </div>
                  <span className={`text-xs font-extrabold font-mono ${factor.color}`}>
                    {factor.value}/100
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${factor.barColor}`}
                    style={{ width: `${factor.value}%` }}
                  />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">{factor.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Standalone Clarity Audit */}
      <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Standalone Viewer Audit (Rule Check)</span>
        </h4>
        <div className="space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-950/60">
            <span className="font-semibold text-zinc-300 w-36 shrink-0">1. Standalone Sense:</span>
            <span className="text-emerald-400 font-medium">
              {clip.standaloneAudit.makesSenseWithoutContext ? 'Passed (Works 100% with no prior video context)' : 'Requires context'}
            </span>
          </div>

          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-950/60">
            <span className="font-semibold text-zinc-300 w-36 shrink-0">2. First 1-3s Hook:</span>
            <span className="text-zinc-300">{clip.standaloneAudit.firstThreeSecondsInterest}</span>
          </div>

          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-950/60">
            <span className="font-semibold text-zinc-300 w-36 shrink-0">3. Clear Payoff:</span>
            <span className="text-zinc-300">{clip.standaloneAudit.clearPayoff}</span>
          </div>

          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-950/60">
            <span className="font-semibold text-zinc-300 w-36 shrink-0">4. Setup Trimmed:</span>
            <span className="text-zinc-400">{clip.standaloneAudit.unnecessarySetupRemoved}</span>
          </div>

          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-950/60">
            <span className="font-semibold text-zinc-300 w-36 shrink-0">5. Engagement Test:</span>
            <span className="text-zinc-300">{clip.standaloneAudit.quickEngagementCheck}</span>
          </div>
        </div>
      </div>

      {/* Why it works */}
      <div>
        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
          Why This Clip Performs On YouTube Shorts:
        </h4>
        <ul className="space-y-1.5">
          {clip.whyItWorks.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

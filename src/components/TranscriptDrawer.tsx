import React, { useState } from 'react';
import { X, Search, FileText, Sparkles, Copy, Check } from 'lucide-react';

interface TranscriptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  transcriptText: string;
  onAnalyzeCustomTranscript: (transcript: string, title?: string) => void;
}

export const TranscriptDrawer: React.FC<TranscriptDrawerProps> = ({
  isOpen,
  onClose,
  videoTitle,
  transcriptText,
  onAnalyzeCustomTranscript,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [activeTab, setActiveTab] = useState<'view' | 'paste'>('view');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(transcriptText || customInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAnalyzePaste = () => {
    if (!customInput.trim()) return;
    onAnalyzeCustomTranscript(customInput.trim(), 'Custom Transcript Analysis');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl h-full bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <FileText className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Full Video Transcript</h3>
              <p className="text-[11px] text-zinc-400 line-clamp-1">{videoTitle || 'Current Video'}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-zinc-800 text-xs px-4">
          <button
            onClick={() => setActiveTab('view')}
            className={`py-3 px-4 font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'view'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Current Video Transcript
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`py-3 px-4 font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'paste'
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Paste Custom Transcript
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'view' ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search transcript for keywords..."
                  className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl font-mono text-xs text-zinc-300 leading-relaxed max-h-[calc(100vh-250px)] overflow-y-auto whitespace-pre-wrap">
                {transcriptText ||
                  'No raw transcript cached for this video. Use the "Paste Custom Transcript" tab to run Clip AI on any raw transcript or subtitles.'}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">
                Paste any interview transcript, podcast subtitles, or video script. CLIP AI will analyze speaker flow, identify viral short-form moments, and generate captions with scores.
              </p>
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="[00:00:15] Speaker 1: You are never going to get rich renting out your time...
[00:00:28] Speaker 2: What do you mean by that?
[00:00:30] Speaker 1: Because your inputs are directly tied to your outputs..."
                rows={16}
                className="w-full p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="flex items-center justify-between p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl">
                <span className="text-xs font-semibold text-zinc-300">Split into clips:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!customInput.trim()) return;
                      onAnalyzeCustomTranscript(customInput.trim(), 'Custom Video Split (2 Clips)');
                      onClose();
                    }}
                    disabled={!customInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-amber-400 hover:text-zinc-950 text-amber-300 font-bold text-xs transition-colors cursor-pointer border border-amber-500/30 disabled:opacity-40"
                  >
                    Split into 2 Clips
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customInput.trim()) return;
                      onAnalyzeCustomTranscript(customInput.trim(), 'Custom Video Split (3 Clips)');
                      onClose();
                    }}
                    disabled={!customInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-emerald-400 hover:text-zinc-950 text-emerald-300 font-bold text-xs transition-colors cursor-pointer border border-emerald-500/30 disabled:opacity-40"
                  >
                    Split into 3 Clips
                  </button>
                </div>
              </div>

              <button
                onClick={handleAnalyzePaste}
                disabled={!customInput.trim()}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>Auto-Analyze &amp; Split Transcript</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs">
          <span className="text-zinc-500">
            {activeTab === 'view' && transcriptText ? `${transcriptText.length} characters` : ''}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Transcript</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import {
  Upload,
  Wand2,
  Film,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  Sliders,
  Smartphone,
  Tv,
  RefreshCw,
} from 'lucide-react';
import {
  UploadedClipMetadata,
  DualVideoAiAnalysis,
  MergeLayoutId,
  VisualEffectId,
  TransitionStyleId,
  OutputAspectRatio,
  MERGE_LAYOUT_OPTIONS,
  VISUAL_EFFECT_OPTIONS,
  TRANSITION_STYLE_OPTIONS,
  estimateMergedDuration,
  normalizeAiAnalysisResponse,
} from '../utils/videoMergePlanner';
import { SAMPLE_REEL_URLS } from '../utils/urlParser';
import { fetchAndSaveMp4 } from '../utils/videoDownloader';
import { DownloadedVideoRecord } from './ReelGrabPlayer';

interface DualVideoStudioPageProps {
  recentDownloads: DownloadedVideoRecord[];
  onDownloadComplete: (record: DownloadedVideoRecord) => void;
}

interface MergedVideoResult {
  clipId: string;
  title: string;
  filename: string;
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  layout: MergeLayoutId;
  effect: VisualEffectId;
  transition: TransitionStyleId;
  aspectRatio: OutputAspectRatio;
  streamUrl: string;
  downloadUrl: string;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export const DualVideoStudioPage: React.FC<DualVideoStudioPageProps> = ({
  recentDownloads,
  onDownloadComplete,
}) => {
  const [clipA, setClipA] = useState<UploadedClipMetadata | null>(null);
  const [clipB, setClipB] = useState<UploadedClipMetadata | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<'clipA' | 'clipB' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<DualVideoAiAnalysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Effect, Transition & Design Controls
  const [selectedLayout, setSelectedLayout] = useState<MergeLayoutId>('sequential');
  const [selectedEffect, setSelectedEffect] = useState<VisualEffectId>('cinematic_warm');
  const [selectedTransition, setSelectedTransition] = useState<TransitionStyleId>('crossfade');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<OutputAspectRatio>('portrait');
  const [mergedTitle, setMergedTitle] = useState<string>('AI Merged Studio Cut');

  // Merge & Final Export State
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergedResult, setMergedResult] = useState<MergedVideoResult | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isSavingMerged, setIsSavingMerged] = useState<boolean>(false);
  const [savedMergedSuccess, setSavedMergedSuccess] = useState<boolean>(false);

  const fileInputARef = useRef<HTMLInputElement | null>(null);
  const fileInputBRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (slot: 'clipA' | 'clipB', file: File | undefined) => {
    if (!file) return;
    setUploadingSlot(slot);
    setUploadError(null);
    setMergedResult(null);
    setSavedMergedSuccess(false);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const response = await fetch(
        `/api/studio/upload-file?slot=${slot}&filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'video/mp4',
          },
          body: arrayBuffer,
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.clip) {
        throw new Error(data?.error || `Failed to upload ${file.name}`);
      }

      if (slot === 'clipA') {
        setClipA(data.clip);
      } else {
        setClipB(data.clip);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Could not upload the selected video file.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleLoadUrlIntoSlot = async (
    slot: 'clipA' | 'clipB',
    url: string,
    filename: string
  ) => {
    setUploadingSlot(slot);
    setUploadError(null);
    setMergedResult(null);
    setSavedMergedSuccess(false);

    try {
      const response = await fetch('/api/studio/load-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, slot, filename }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.clip) {
        throw new Error(data?.error || 'Could not load video clip into slot.');
      }

      if (slot === 'clipA') {
        setClipA(data.clip);
      } else {
        setClipB(data.clip);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Could not load sample video.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleAnalyzeVideos = async () => {
    if (!clipA || !clipB) {
      setAnalyzeError('Please upload both Video 1 and Video 2 first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const response = await fetch('/api/studio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipAId: clipA.clipId,
          clipBId: clipB.clipId,
          clipAName: clipA.filename,
          clipBName: clipB.filename,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'AI video analysis failed.');
      }

      const normalized = normalizeAiAnalysisResponse(data.analysis, clipA, clipB);
      setAiAnalysis(normalized);

      // Apply AI recommended effect, transition, layout, and title
      setSelectedLayout(normalized.recommendedLayout);
      setSelectedEffect(normalized.recommendedEffect);
      setSelectedTransition(normalized.recommendedTransition);
      setSelectedAspectRatio(normalized.recommendedAspectRatio);
      if (normalized.suggestedHookTitle) {
        setMergedTitle(normalized.suggestedHookTitle);
      }
    } catch (err: any) {
      setAnalyzeError(err.message || 'Failed to analyze the two videos.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMergeVideos = async () => {
    if (!clipA || !clipB) {
      setMergeError('Please upload both Video 1 and Video 2 before merging.');
      return;
    }

    setIsMerging(true);
    setMergeError(null);
    setSavedMergedSuccess(false);

    try {
      // If user hasn't run AI analysis yet, run analysis automatically or merge with selected settings
      const response = await fetch('/api/studio/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipAId: clipA.clipId,
          clipBId: clipB.clipId,
          layout: selectedLayout,
          effect: selectedEffect,
          transition: selectedTransition,
          aspectRatio: selectedAspectRatio,
          title: mergedTitle,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.merged) {
        throw new Error(data?.error || 'Failed to merge the two videos.');
      }

      setMergedResult(data.merged);
    } catch (err: any) {
      setMergeError(err.message || 'Could not merge videos. Please try again.');
    } finally {
      setIsMerging(false);
    }
  };

  const handleDownloadMergedVideo = async () => {
    if (!mergedResult) return;
    setIsSavingMerged(true);
    setMergeError(null);

    try {
      const saved = await fetchAndSaveMp4({
        downloadUrl: mergedResult.downloadUrl,
        filename: mergedResult.filename,
      });

      setSavedMergedSuccess(true);
      onDownloadComplete({
        id: `${Date.now()}-${mergedResult.clipId}`,
        title: `${mergedResult.title} (AI Merged)`,
        platformName: 'AI Studio Merge',
        quality: mergedResult.aspectRatio === 'portrait' ? '9:16 HD' : '16:9 HD',
        filename: saved.filename,
        sourceUrl: window.location.href,
        downloadUrl: mergedResult.downloadUrl,
        blobUrl: saved.blobUrl,
        fileSize: saved.byteLength,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
    } catch (err: any) {
      setMergeError(err.message || 'Failed to save merged MP4 file.');
    } finally {
      setIsSavingMerged(false);
    }
  };

  const renderUploadSlot = (
    slot: 'clipA' | 'clipB',
    slotNumber: 1 | 2,
    label: string,
    subtitle: string,
    clip: UploadedClipMetadata | null,
    inputRef: React.RefObject<HTMLInputElement | null>,
    samplePreset: { url: string; filename: string; label: string }
  ) => {
    const isSlotLoading = uploadingSlot === slot;

    return (
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-amber-400">
              0{slotNumber}. {label}
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">
              {clip ? clip.filename : `Upload Video ${slotNumber}`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
          {clip && (
            <span className="text-xs font-mono tabular-nums text-emerald-400 shrink-0">
              Ready · {clip.durationSec}s
            </span>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          aria-label={`Upload Video ${slotNumber} file`}
          onChange={(e) => handleFileUpload(slot, e.target.files?.[0])}
          className="hidden"
        />

        {/* Video Preview or Upload Dropzone */}
        {clip ? (
          <div className="space-y-3">
            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              <video
                key={clip.streamUrl}
                src={clip.streamUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain bg-black"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono tabular-nums">
              <span>
                {clip.width}×{clip.height} px · {clip.durationSec}s · {formatBytes(clip.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isSlotLoading}
                className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-sans font-semibold cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Replace Video {slotNumber}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-slate-700 bg-slate-900/50 rounded-xl p-6 text-center space-y-3">
            <Film className="h-8 w-8 text-slate-400 mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-200">
                Select an MP4, MOV, or WebM video file from your device
              </p>
              <p className="text-[11px] text-slate-400">
                Supports vertical (9:16) Shorts/Reels and widescreen (16:9) clips
              </p>
            </div>
          </div>
        )}

        {/* Primary Upload Button + Sample Quick-Load */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isSlotLoading}
            className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {isSlotLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                <span>Uploading Video {slotNumber}...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 text-slate-950" />
                <span>
                  {clip ? `Upload Another Video ${slotNumber}` : `Upload Video ${slotNumber} (.MP4)`}
                </span>
              </>
            )}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                handleLoadUrlIntoSlot(slot, samplePreset.url, samplePreset.filename)
              }
              disabled={isSlotLoading}
              className="text-xs text-slate-300 hover:text-amber-400 underline underline-offset-4 transition-colors cursor-pointer"
            >
              Load Demo Video {slotNumber} ({samplePreset.label})
            </button>

            {recentDownloads.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  handleLoadUrlIntoSlot(
                    slot,
                    recentDownloads[0].sourceUrl,
                    recentDownloads[0].filename
                  )
                }
                disabled={isSlotLoading}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-4 transition-colors cursor-pointer"
              >
                Use Latest Downloaded Video
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const bothClipsReady = Boolean(clipA && clipB);
  const estimatedDuration =
    clipA && clipB
      ? estimateMergedDuration(clipA.durationSec, clipB.durationSec, selectedLayout)
      : 0;

  return (
    <div className="space-y-6">
      {/* Studio Header Card */}
      <section
        aria-label="AI Dual-Video Analyzer and Merger"
        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              AI Dual-Video Analyzer, Effect Designer &amp; Video Merger
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Upload two videos below, run Gemini multimodal AI to analyze lighting, pacing, and framing, apply visual effects &amp; transitions, and merge both clips into one final MP4 video.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-400 shrink-0">
            <span>Clip 1: {clipA ? 'Loaded' : 'Empty'}</span>
            <span aria-hidden="true">·</span>
            <span>Clip 2: {clipB ? 'Loaded' : 'Empty'}</span>
            {bothClipsReady && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400">Est. Output: {estimatedDuration}s</span>
              </>
            )}
          </div>
        </div>

        {uploadError && (
          <div
            role="alert"
            className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* STEP 1: TWO VIDEO UPLOAD SLOTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {renderUploadSlot(
            'clipA',
            1,
            'First Video (Opening Clip)',
            'Upload the opening video clip that starts the sequence or top/left split.',
            clipA,
            fileInputARef,
            {
              url: SAMPLE_REEL_URLS[0].url,
              filename: 'youtube_short_clip1.mp4',
              label: 'YouTube Short Clip',
            }
          )}

          {renderUploadSlot(
            'clipB',
            2,
            'Second Video (Closing / Duet Clip)',
            'Upload the second video clip to transition into or pair side-by-side.',
            clipB,
            fileInputBRef,
            {
              url: SAMPLE_REEL_URLS[3].url,
              filename: 'sintel_trailer_clip2.mp4',
              label: 'Cinema Trailer Clip',
            }
          )}
        </div>

        {/* STEP 2: AI ANALYSIS TRIGGER & AI INSIGHTS */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-amber-400">
                03. AI Visual &amp; Effect Analysis
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Analyze Both Videos with AI for Effect &amp; Transition Design
              </h2>
              <p className="text-xs text-slate-400">
                Extracts keyframes from Video 1 and Video 2 to recommend the optimal color grade, transition cut, and layout design.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAnalyzeVideos}
              disabled={!bothClipsReady || isAnalyzing}
              className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  <span>Analyzing 2 Videos with AI...</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 text-slate-950" />
                  <span>Analyze Two Videos with AI</span>
                </>
              )}
            </button>
          </div>

          {analyzeError && (
            <div
              role="alert"
              className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{analyzeError}</span>
            </div>
          )}

          {aiAnalysis && (
            <div
              aria-label="AI Analysis Recommendations"
              className="border-t border-slate-800 pt-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="font-bold text-white">
                    AI Director Recommendation Applied
                  </span>
                </div>
                <span className="font-mono tabular-nums text-emerald-400">
                  Visual Compatibility: {aiAnalysis.compatibilityScore}% · Suggested Title: &ldquo;{aiAnalysis.suggestedHookTitle}&rdquo;
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {aiAnalysis.summary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="text-xs font-semibold text-amber-400">
                    Video 1 Visual Profile
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {aiAnalysis.clipAInsight}
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="text-xs font-semibold text-amber-400">
                    Video 2 Visual Profile
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {aiAnalysis.clipBInsight}
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="text-xs font-semibold text-emerald-400">
                    AI Effect &amp; Merge Design Rationale
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {aiAnalysis.designRationale}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 3: EFFECT, DESIGN & TRANSITION STUDIO CONTROLS */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-amber-400">
                04. Customize Effect, Layout Design &amp; Transition
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Video Effect &amp; Merge Design Studio
              </h2>
            </div>

            {/* Aspect Ratio Selector */}
            <div
              role="group"
              aria-label="Output Video Aspect Ratio"
              className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setSelectedAspectRatio('portrait')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  selectedAspectRatio === 'portrait'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>9:16 Vertical</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAspectRatio('landscape')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  selectedAspectRatio === 'landscape'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Tv className="h-3.5 w-3.5" />
                <span>16:9 Widescreen</span>
              </button>
            </div>
          </div>

          {/* 1. Merge Layout Design */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Layers className="h-3.5 w-3.5 text-amber-400" />
              <span>Merge Layout Design</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {MERGE_LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedLayout(opt.id)}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    selectedLayout === opt.id
                      ? 'bg-amber-400/10 border-amber-400 text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {opt.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Visual Color & Effect Filter */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Sliders className="h-3.5 w-3.5 text-amber-400" />
              <span>AI Visual Color &amp; Filter Effect</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {VISUAL_EFFECT_OPTIONS.map((eff) => (
                <button
                  key={eff.id}
                  type="button"
                  onClick={() => setSelectedEffect(eff.id)}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    selectedEffect === eff.id
                      ? 'bg-amber-400/10 border-amber-400 text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">{eff.label}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {eff.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Transition Effect & Output Title */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-8 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Transition Effect Between Video 1 &amp; Video 2
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {TRANSITION_STYLE_OPTIONS.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => setSelectedTransition(tr.id)}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      selectedTransition === tr.id
                        ? 'bg-amber-400/10 border-amber-400 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{tr.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {tr.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-2">
              <label
                htmlFor="merged-video-title"
                className="block text-xs font-semibold text-slate-300"
              >
                Merged Video Title
              </label>
              <input
                id="merged-video-title"
                type="text"
                value={mergedTitle}
                onChange={(e) => setMergedTitle(e.target.value)}
                placeholder="AI Merged Studio Cut"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Primary Merge & Render Action Button */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <button
              type="button"
              onClick={handleMergeVideos}
              disabled={!bothClipsReady || isMerging}
              className="w-full py-4 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-colors shadow-lg shadow-emerald-500/15 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {isMerging ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-slate-950" />
                  <span>
                    Rendering Effects &amp; Merging Two Videos into One MP4...
                  </span>
                </>
              ) : (
                <>
                  <Film className="h-5 w-5 text-slate-950" />
                  <span>Merge Two Videos into One (.MP4)</span>
                </>
              )}
            </button>

            {mergeError && (
              <div
                role="alert"
                className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{mergeError}</span>
              </div>
            )}
          </div>
        </div>

        {/* STEP 4: MERGED FINAL VIDEO PLAYER & DOWNLOAD */}
        {mergedResult && (
          <div
            aria-label="Merged Final Video Output"
            className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-6 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Merged Video Ready</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  {mergedResult.title}
                </h3>
                <p className="text-xs font-mono tabular-nums text-slate-400">
                  {mergedResult.filename} · {mergedResult.width}×{mergedResult.height} px ·{' '}
                  {mergedResult.durationSec}s · {formatBytes(mergedResult.sizeBytes)} · MP4 (H.264 + AAC)
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadMergedVideo}
                disabled={isSavingMerged}
                className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isSavingMerged ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                    <span>Saving Merged MP4...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 text-slate-950" />
                    <span>Download Merged Video (.MP4)</span>
                  </>
                )}
              </button>
            </div>

            {savedMergedSuccess && (
              <div
                role="status"
                className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  Saved <strong className="font-mono text-white">{mergedResult.filename}</strong> to your device and added to Recent Downloads!
                </span>
              </div>
            )}

            <div className="w-full max-w-2xl mx-auto aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              <video
                key={mergedResult.streamUrl}
                src={mergedResult.streamUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain bg-black"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

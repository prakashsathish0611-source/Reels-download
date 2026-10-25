import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Sparkles,
  Scissors,
  Type,
  Sliders,
  Gauge,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Film,
  Wand2,
  Layers,
} from 'lucide-react';
import { SAMPLE_REEL_URLS } from '../utils/urlParser';
import { fetchAndSaveMp4 } from '../utils/videoDownloader';
import { DownloadedVideoRecord } from './ReelGrabPlayer';
import {
  CapCutEditState,
  CapCutAiEditSuggestion,
  CAPCUT_FILTER_PRESETS,
  CAPCUT_SPEED_OPTIONS,
  CAPTION_STYLE_PRESETS,
  clampTrimRange,
  calculateEditedDuration,
  buildCssPreviewFilter,
  normalizeAiEditorSuggestion,
  CapCutFilterId,
  CapCutSpeedOption,
  CapCutCanvasRatio,
  CapCutCaptionPosition,
  CapCutCaptionStyleId,
} from '../utils/capcutEditorConfig';

function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

interface LoadedEditorClip {
  clipId: string;
  filename: string;
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  streamUrl: string;
}

interface ExportedEditorVideo {
  clipId: string;
  title: string;
  filename: string;
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  streamUrl: string;
  downloadUrl: string;
}

type EditorToolTab = 'ai' | 'trim' | 'text' | 'filters' | 'speed';

interface CapCutEditorPageProps {
  recentDownloads: DownloadedVideoRecord[];
  onDownloadComplete: (record: DownloadedVideoRecord) => void;
}

export const CapCutEditorPage: React.FC<CapCutEditorPageProps> = ({
  recentDownloads,
  onDownloadComplete,
}) => {
  const [sourceClip, setSourceClip] = useState<LoadedEditorClip | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorToolTab>('ai');
  const [projectTitle, setProjectTitle] = useState('CapCut AI Viral Cut');

  const [editState, setEditState] = useState<CapCutEditState>({
    trimStart: 0,
    trimEnd: 10,
    speed: 1,
    filterId: 'capcut_hdr',
    brightness: 2,
    contrast: 6,
    saturation: 12,
    canvasRatio: '9:16',
    captionText: 'WAIT FOR THE END',
    captionPosition: 'bottom',
    captionStyle: 'viral_yellow',
    volumePercent: 100,
    audioFade: true,
    vignette: false,
  });

  const [aiSuggestion, setAiSuggestion] = useState<CapCutAiEditSuggestion | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportedVideo, setExportedVideo] = useState<ExportedEditorVideo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live preview player state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Sync playback speed and volume with HTML5 video preview
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.playbackRate = editState.speed;
    vid.volume = Math.max(0, Math.min(1, editState.volumePercent / 100));
  }, [editState.speed, editState.volumePercent, sourceClip]);

  const applyNewClipDefaults = (clip: LoadedEditorClip) => {
    setSourceClip(clip);
    const isPortrait = clip.height >= clip.width;
    const defaultEnd = Math.round(Math.min(clip.durationSec, 15) * 10) / 10;
    setEditState((prev) => ({
      ...prev,
      trimStart: 0,
      trimEnd: Math.max(1, defaultEnd),
      canvasRatio: isPortrait ? '9:16' : '16:9',
    }));
    setCurrentTime(0);
    setAiSuggestion(null);
    setExportedVideo(null);
    setDownloadSuccess(false);
  };

  // Upload a local video file from user's device
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setErrorMessage(null);
    setIsUploading(true);
    try {
      const response = await fetch(
        `/api/studio/upload-file?slot=clipA&filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload video to editor.');
      }
      applyNewClipDefaults(data.clip);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not upload video file.');
    } finally {
      setIsUploading(false);
    }
  };

  // Load sample or recent video via URL
  const handleLoadUrlClip = async (url: string, label: string) => {
    setErrorMessage(null);
    setIsUploading(true);
    try {
      const response = await fetch('/api/studio/load-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          slot: 'clipA',
          filename: label,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load video into CapCut editor.');
      }
      applyNewClipDefaults(data.clip);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not load video.');
    } finally {
      setIsUploading(false);
    }
  };

  // Run Gemini AI Magic Edit & Auto-Captions
  const handleRunAiMagicEdit = async () => {
    if (!sourceClip) {
      setErrorMessage('Please upload a video or click "Load Sample Reel" first.');
      return;
    }
    setErrorMessage(null);
    setIsAnalyzingAi(true);
    setActiveTab('ai');

    try {
      const response = await fetch('/api/editor/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId: sourceClip.clipId,
          filename: sourceClip.filename,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'AI Magic Edit analysis failed.');
      }

      const normalized = normalizeAiEditorSuggestion(
        data.suggestion,
        sourceClip.durationSec,
        sourceClip.width,
        sourceClip.height
      );
      setAiSuggestion(normalized);

      // Automatically apply AI smart grade, caption, and trim
      setEditState((prev) => ({
        ...prev,
        filterId: normalized.recommendedFilter,
        speed: normalized.recommendedSpeed,
        canvasRatio: normalized.recommendedCanvasRatio,
        trimStart: normalized.recommendedTrimStart,
        trimEnd: normalized.recommendedTrimEnd,
        captionText: normalized.suggestedCaptions[0] || prev.captionText,
        captionPosition: normalized.recommendedCaptionPosition,
        captionStyle: normalized.recommendedCaptionStyle,
      }));
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not run AI Magic Edit.');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // Export & Render Edited Video via FFmpeg
  const handleExportVideo = async () => {
    if (!sourceClip) {
      setErrorMessage('Please upload or load a video clip before exporting.');
      return;
    }
    setErrorMessage(null);
    setIsExporting(true);
    setDownloadSuccess(false);

    try {
      const response = await fetch('/api/editor/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId: sourceClip.clipId,
          ...editState,
          title: projectTitle,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.exported) {
        throw new Error(data.error || 'Failed to render edited MP4 video.');
      }
      setExportedVideo(data.exported);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not export edited video.');
    } finally {
      setIsExporting(false);
    }
  };

  // Download Exported MP4 and save to Recent Downloads
  const handleDownloadExportedMp4 = async () => {
    if (!exportedVideo || isDownloading) return;
    setIsDownloading(true);
    setErrorMessage(null);

    try {
      const saved = await fetchAndSaveMp4({
        downloadUrl: exportedVideo.downloadUrl,
        filename: exportedVideo.filename,
      });

      setDownloadSuccess(true);
      onDownloadComplete({
        id: `${exportedVideo.clipId}-${Date.now()}`,
        title: exportedVideo.title || projectTitle,
        platformName: 'CapCut AI Editor',
        quality: `${exportedVideo.width}x${exportedVideo.height}`,
        filename: saved.filename,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourceUrl: exportedVideo.streamUrl,
        downloadUrl: exportedVideo.downloadUrl,
        blobUrl: saved.blobUrl,
        fileSize: saved.byteLength,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to download edited MP4 file.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Keep preview playback looped within [trimStart, trimEnd]
  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const t = vid.currentTime;
    setCurrentTime(t);
    if (t >= editState.trimEnd || t < editState.trimStart - 0.15) {
      vid.currentTime = editState.trimStart;
      setCurrentTime(editState.trimStart);
    }
  };

  const togglePlayPause = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      if (vid.currentTime < editState.trimStart || vid.currentTime >= editState.trimEnd) {
        vid.currentTime = editState.trimStart;
      }
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  };

  const handleSeekTimeline = (newTimeSec: number) => {
    if (!sourceClip) return;
    const clamped = Math.max(0, Math.min(newTimeSec, sourceClip.durationSec));
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const updateTrimRange = (newStart: number, newEnd: number) => {
    const maxDur = sourceClip?.durationSec || 15;
    const { trimStart, trimEnd } = clampTrimRange(newStart, newEnd, maxDur);
    setEditState((prev) => ({
      ...prev,
      trimStart,
      trimEnd,
    }));
    if (videoRef.current) {
      videoRef.current.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
  };

  const editedDurationSec = calculateEditedDuration(
    editState.trimStart,
    editState.trimEnd,
    editState.speed
  );
  const liveCssFilter = buildCssPreviewFilter(editState);
  const activeCaptionStyleObj =
    CAPTION_STYLE_PRESETS.find((s) => s.id === editState.captionStyle) || CAPTION_STYLE_PRESETS[0];

  const maxClipDur = sourceClip?.durationSec || 10;
  const trimLeftPercent = Math.min(95, Math.max(0, (editState.trimStart / maxClipDur) * 100));
  const trimWidthPercent = Math.min(
    100 - trimLeftPercent,
    Math.max(5, ((editState.trimEnd - editState.trimStart) / maxClipDur) * 100)
  );
  const playheadPercent = Math.min(100, Math.max(0, (currentTime / maxClipDur) * 100));

  return (
    <section
      id="capcut-ai-editor"
      aria-label="CapCut AI Video Editor"
      className="space-y-5"
    >
      {/* Top CapCut Studio Header & Action Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Scissors className="h-4 w-4" />
            <span>Page 3 · CapCut AI Timeline &amp; Effect Editor</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Edit Videos with CapCut Timeline, AI Auto-Captions &amp; Color LUTs
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Upload any video or load a sample Reel, click <strong className="text-slate-200">AI Magic Edit</strong> for instant hook captions and color grading, fine-tune trim/speed/filters on the timeline, and export a verified H.264 + AAC <code className="text-amber-300">.mp4</code> file.
          </p>
        </div>

        {/* Upload / Load Sample / Export Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.webm,.mov"
            aria-label="Upload Video to Edit"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = '';
            }}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span>{sourceClip ? 'Replace Video' : 'Upload Video'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleLoadUrlClip(SAMPLE_REEL_URLS[0].url, 'CapCut_Sample_Short.mp4')
            }
            disabled={isUploading}
            className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Film className="h-3.5 w-3.5 text-amber-400" />
            <span>Load Sample Reel</span>
          </button>

          <button
            type="button"
            onClick={handleRunAiMagicEdit}
            disabled={!sourceClip || isAnalyzingAi}
            className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            {isAnalyzingAi ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-300" />
                <span>AI Editing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>AI Magic Edit</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportVideo}
            disabled={!sourceClip || isExporting}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Rendering MP4...</span>
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                <span>Export Edited Video (.MP4)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200 flex items-center gap-2.5"
        >
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main CapCut 2-Column Workspace: Left Tool Dock & Inspector + Right Live Canvas & Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN (7 cols): CapCut Tool Rail + Active Tool Inspector */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-5">
          {/* Tool Tabs Navigation */}
          <div className="space-y-4">
            <div
              role="tablist"
              aria-label="CapCut Editing Tools"
              className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800"
            >
              {[
                { id: 'ai' as EditorToolTab, label: 'AI Magic', icon: Sparkles },
                { id: 'trim' as EditorToolTab, label: 'Trim & Ratio', icon: Scissors },
                { id: 'text' as EditorToolTab, label: 'Text & Hook', icon: Type },
                { id: 'filters' as EditorToolTab, label: 'Filters & LUT', icon: Sliders },
                { id: 'speed' as EditorToolTab, label: 'Speed & Audio', icon: Gauge },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Source Loader Bar if no clip loaded yet or switching clips */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/90 border border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Film className="h-4 w-4 text-amber-400 shrink-0" />
                {sourceClip ? (
                  <span className="text-slate-200 font-medium truncate">
                    {sourceClip.filename}{' '}
                    <span className="font-mono tabular-nums text-slate-400">
                      ({sourceClip.width}×{sourceClip.height} · {sourceClip.durationSec}s ·{' '}
                      {formatByteSize(sourceClip.sizeBytes)})
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">
                    No video loaded yet — Upload a video file or load a sample clip:
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {SAMPLE_REEL_URLS.slice(0, 2).map((sample, idx) => (
                  <button
                    key={sample.url}
                    type="button"
                    onClick={() =>
                      handleLoadUrlClip(sample.url, `Sample_Clip_${idx + 1}.mp4`)
                    }
                    disabled={isUploading}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Sample {idx + 1}
                  </button>
                ))}
                {recentDownloads.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleLoadUrlClip(
                        recentDownloads[0].downloadUrl,
                        recentDownloads[0].filename
                      )
                    }
                    disabled={isUploading}
                    className="px-2.5 py-1 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-[11px] font-semibold text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Use Latest Download
                  </button>
                )}
              </div>
            </div>

            {/* TAB 1: AI MAGIC ASSISTANT */}
            {activeTab === 'ai' && (
              <div className="space-y-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      <span>CapCut AI Director &amp; Auto-Hook Generator</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Gemini Vision analyzes a keyframe from your clip to suggest viral hook captions, optimal LUT grading, and smart trim bounds.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunAiMagicEdit}
                    disabled={!sourceClip || isAnalyzingAi}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40"
                  >
                    {isAnalyzingAi ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Analyzing Frame...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Run AI Magic Edit</span>
                      </>
                    )}
                  </button>
                </div>

                {aiSuggestion ? (
                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                        AI Visual Scene Breakdown
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {aiSuggestion.sceneSummary}
                      </p>
                      <p className="text-[11px] text-emerald-400 pt-1">
                        Tip: {aiSuggestion.editingTip}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        AI Suggested Hook Captions (Click to apply on video)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {aiSuggestion.suggestedCaptions.map((cap) => (
                          <button
                            key={cap}
                            type="button"
                            onClick={() =>
                              setEditState((prev) => ({ ...prev, captionText: cap }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                              editState.captionText === cap
                                ? 'bg-amber-400 text-slate-950 border-amber-400'
                                : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-amber-400/50'
                            }`}
                          >
                            “{cap}”
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">AI Filter LUT</span>
                        <span className="font-bold text-white">{aiSuggestion.recommendedFilter}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Smart Trim</span>
                        <span className="font-mono tabular-nums font-bold text-emerald-400">
                          {aiSuggestion.recommendedTrimStart}s – {aiSuggestion.recommendedTrimEnd}s
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Canvas Ratio</span>
                        <span className="font-mono tabular-nums font-bold text-amber-400">
                          {aiSuggestion.recommendedCanvasRatio}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between gap-4">
                    <span>
                      {sourceClip
                        ? 'Video loaded! Click "Run AI Magic Edit" to auto-generate viral captions, LUT filter, and smart trim.'
                        : 'Step 1: Click "Upload Video" or "Load Sample Reel" above to start editing.'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TRIM & CANVAS RATIO */}
            {activeTab === 'trim' && (
              <div className="space-y-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">Smart Trim &amp; Aspect Ratio Canvas</h2>
                  <span className="text-xs font-mono tabular-nums text-amber-400">
                    Active Cut: {editState.trimStart.toFixed(1)}s → {editState.trimEnd.toFixed(1)}s (
                    {editedDurationSec}s)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="trim-start-range" className="text-slate-300 font-medium">
                        Trim Start (In Point)
                      </label>
                      <span className="font-mono tabular-nums text-white">
                        {editState.trimStart.toFixed(1)}s
                      </span>
                    </div>
                    <input
                      id="trim-start-range"
                      type="range"
                      min={0}
                      max={Math.max(1, (sourceClip?.durationSec || 12) - 1)}
                      step={0.1}
                      value={editState.trimStart}
                      onChange={(e) =>
                        updateTrimRange(parseFloat(e.target.value), editState.trimEnd)
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="trim-end-range" className="text-slate-300 font-medium">
                        Trim End (Out Point)
                      </label>
                      <span className="font-mono tabular-nums text-white">
                        {editState.trimEnd.toFixed(1)}s
                      </span>
                    </div>
                    <input
                      id="trim-end-range"
                      type="range"
                      min={Math.min(1, sourceClip?.durationSec || 12)}
                      max={sourceClip?.durationSec || 15}
                      step={0.1}
                      value={editState.trimEnd}
                      onChange={(e) =>
                        updateTrimRange(editState.trimStart, parseFloat(e.target.value))
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Quick Trim Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400">Quick Cut:</span>
                  <button
                    type="button"
                    onClick={() => updateTrimRange(0, Math.min(5, sourceClip?.durationSec || 5))}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    First 5s Hook
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTrimRange(0, Math.min(10, sourceClip?.durationSec || 10))}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    Best 10s Reel
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTrimRange(0, sourceClip?.durationSec || 15)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    Full Clip
                  </button>
                </div>

                {/* Canvas Aspect Ratio Selector */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="block text-xs font-semibold text-slate-300">
                    Output Canvas Format
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { id: '9:16', label: '9:16 Vertical', sub: 'Shorts / Reels / TikTok' },
                        { id: '16:9', label: '16:9 Widescreen', sub: 'YouTube / Desktop HD' },
                        { id: '1:1', label: '1:1 Square', sub: 'Feed Post' },
                      ] as { id: CapCutCanvasRatio; label: string; sub: string }[]
                    ).map((ratio) => (
                      <button
                        key={ratio.id}
                        type="button"
                        onClick={() =>
                          setEditState((prev) => ({ ...prev, canvasRatio: ratio.id }))
                        }
                        className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          editState.canvasRatio === ratio.id
                            ? 'bg-amber-400/15 border-amber-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold font-mono">{ratio.label}</div>
                        <div className="text-[11px] text-slate-400">{ratio.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TEXT & HOOK CAPTIONS */}
            {activeTab === 'text' && (
              <div className="space-y-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="capcut-caption-input" className="text-xs font-bold text-white">
                      On-Screen CapCut Hook Caption (Burned into Exported MP4)
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditState((prev) => ({ ...prev, captionText: '' }))}
                      className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Clear Text
                    </button>
                  </div>
                  <input
                    id="capcut-caption-input"
                    type="text"
                    maxLength={48}
                    value={editState.captionText}
                    onChange={(e) =>
                      setEditState((prev) => ({ ...prev, captionText: e.target.value }))
                    }
                    placeholder="Type bold on-screen caption (or leave empty for no text)..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Caption Style Presets */}
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-300">
                    CapCut Caption Box Style
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CAPTION_STYLE_PRESETS.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() =>
                          setEditState((prev) => ({
                            ...prev,
                            captionStyle: style.id as CapCutCaptionStyleId,
                          }))
                        }
                        className={`p-2 rounded-xl border text-center text-xs font-bold transition-colors cursor-pointer ${
                          editState.captionStyle === style.id
                            ? 'border-amber-400 bg-amber-400/15 text-white'
                            : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caption Vertical Alignment */}
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-300">
                    Caption Screen Position
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['top', 'center', 'bottom'] as CapCutCaptionPosition[]).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() =>
                          setEditState((prev) => ({ ...prev, captionPosition: pos }))
                        }
                        className={`py-2 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                          editState.captionPosition === pos
                            ? 'bg-amber-400 text-slate-950 border-amber-400'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: FILTERS & COLOR ADJUST */}
            {activeTab === 'filters' && (
              <div className="space-y-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">CapCut Color LUTs &amp; Grading</h2>
                  <button
                    type="button"
                    onClick={() =>
                      setEditState((prev) => ({
                        ...prev,
                        filterId: 'none',
                        brightness: 0,
                        contrast: 0,
                        saturation: 0,
                        vignette: false,
                      }))
                    }
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Reset Grade
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {CAPCUT_FILTER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        setEditState((prev) => ({
                          ...prev,
                          filterId: preset.id as CapCutFilterId,
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        editState.filterId === preset.id
                          ? 'bg-amber-400/15 border-amber-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{preset.label}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Fine-Tune Color Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Brightness</span>
                      <span className="font-mono tabular-nums text-white">
                        {editState.brightness > 0
                          ? `+${editState.brightness}`
                          : editState.brightness}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-30}
                      max={30}
                      value={editState.brightness}
                      onChange={(e) =>
                        setEditState((prev) => ({
                          ...prev,
                          brightness: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Contrast</span>
                      <span className="font-mono tabular-nums text-white">
                        {editState.contrast > 0 ? `+${editState.contrast}` : editState.contrast}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-30}
                      max={30}
                      value={editState.contrast}
                      onChange={(e) =>
                        setEditState((prev) => ({
                          ...prev,
                          contrast: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Saturation</span>
                      <span className="font-mono tabular-nums text-white">
                        {editState.saturation > 0
                          ? `+${editState.saturation}`
                          : editState.saturation}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={editState.saturation}
                      onChange={(e) =>
                        setEditState((prev) => ({
                          ...prev,
                          saturation: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: SPEED & AUDIO */}
            {activeTab === 'speed' && (
              <div className="space-y-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      CapCut Velocity &amp; Playback Speed
                    </span>
                    <span className="text-xs font-mono tabular-nums text-amber-400">
                      Output Duration: {editedDurationSec}s
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {CAPCUT_SPEED_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setEditState((prev) => ({
                            ...prev,
                            speed: opt.value as CapCutSpeedOption,
                          }))
                        }
                        className={`py-2 px-2 rounded-xl border text-center text-xs font-bold font-mono tabular-nums transition-colors cursor-pointer ${
                          editState.speed === opt.value
                            ? 'bg-amber-400 text-slate-950 border-amber-400'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {opt.value}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-semibold">Audio Track Volume</span>
                      <span className="font-mono tabular-nums text-white">
                        {editState.volumePercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={150}
                      step={5}
                      value={editState.volumePercent}
                      onChange={(e) =>
                        setEditState((prev) => ({
                          ...prev,
                          volumePercent: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div>
                      <div className="text-xs font-bold text-white">Smooth Audio Fade In/Out</div>
                      <div className="text-[11px] text-slate-400">
                        Prevents abrupt audio clicks at cut boundaries
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editState.audioFade}
                      onChange={(e) =>
                        setEditState((prev) => ({ ...prev, audioFade: e.target.checked }))
                      }
                      className="h-4 w-4 accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Filename & Summary Bar */}
          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <label
                htmlFor="editor-project-title"
                className="text-xs font-semibold text-slate-400 whitespace-nowrap"
              >
                Export Name:
              </label>
              <input
                id="editor-project-title"
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-400">
              <span>Ratio: {editState.canvasRatio}</span>
              <span>Speed: {editState.speed}x</span>
              <span className="text-emerald-400 font-bold">Net: {editedDurationSec}s</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Live CapCut Canvas Monitor & Exported MP4 Result */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live CapCut Canvas Monitor ({editState.canvasRatio})
            </span>
            <span className="text-xs font-mono tabular-nums text-amber-400">
              {currentTime.toFixed(1)}s / {editState.trimEnd.toFixed(1)}s
            </span>
          </div>

          {/* Live Video Preview Frame with Real-Time CSS Filter & Caption Overlay */}
          <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-[280px] sm:min-h-[320px]">
            {sourceClip ? (
              <div
                className={`relative overflow-hidden bg-black flex items-center justify-center shadow-2xl ${
                  editState.canvasRatio === '9:16'
                    ? 'w-[190px] sm:w-[210px] aspect-[9/16]'
                    : editState.canvasRatio === '1:1'
                    ? 'w-[240px] sm:w-[260px] aspect-square'
                    : 'w-full max-w-[360px] aspect-video'
                }`}
              >
                <video
                  ref={videoRef}
                  src={sourceClip.streamUrl}
                  playsInline
                  muted={isMuted}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  style={{ filter: liveCssFilter }}
                  className="w-full h-full object-contain"
                />

                {/* Live CapCut On-Screen Caption Overlay */}
                {editState.captionText.trim() && (
                  <div
                    className={`pointer-events-none absolute inset-x-3 flex justify-center text-center ${
                      editState.captionPosition === 'top'
                        ? 'top-4'
                        : editState.captionPosition === 'center'
                        ? 'top-1/2 -translate-y-1/2'
                        : 'bottom-5'
                    }`}
                  >
                    <span
                      className={`text-[11px] sm:text-xs tracking-wide uppercase break-words max-w-full ${activeCaptionStyleObj.previewClass}`}
                    >
                      {editState.captionText}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center space-y-3">
                <Film className="h-8 w-8 text-slate-600 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-300">No Video in CapCut Canvas</p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Upload a video from your device or load a sample Reel to preview real-time filters, captions, and timeline cuts.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Upload Video File
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleLoadUrlClip(SAMPLE_REEL_URLS[0].url, 'CapCut_Sample_Short.mp4')
                    }
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
                  >
                    Load Sample Reel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Transport Bar */}
          <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayPause}
                disabled={!sourceClip}
                aria-label={isPlaying ? 'Pause Preview' : 'Play Preview'}
                className="p-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-colors cursor-pointer disabled:opacity-40"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => handleSeekTimeline(editState.trimStart)}
                disabled={!sourceClip}
                aria-label="Restart from Trim Start"
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                disabled={!sourceClip}
                aria-label={isMuted ? 'Unmute Preview' : 'Mute Preview'}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>

            <div className="text-xs font-mono tabular-nums text-slate-300">
              Cut: {editState.trimStart.toFixed(1)}s – {editState.trimEnd.toFixed(1)}s ·{' '}
              <span className="text-amber-400">{editState.speed}x</span>
            </div>
          </div>

          {/* Exported MP4 Download Card (Appears once rendered) */}
          {exportedVideo && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-white">
                    Exported CapCut MP4 Ready ({exportedVideo.width}×{exportedVideo.height} ·{' '}
                    {exportedVideo.durationSec}s · {formatByteSize(exportedVideo.sizeBytes)})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadExportedMp4}
                disabled={isDownloading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Verified MP4...</span>
                  </>
                ) : downloadSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Saved Edited Video (.MP4) — Click to Save Again</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download Edited Video (.MP4)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM MULTI-TRACK CAPCUT TIMELINE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Multi-Track CapCut Timeline
            </span>
          </div>

          {/* Interactive Timeline Playhead Scrubber */}
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <span className="text-[11px] font-mono tabular-nums text-slate-400">Playhead</span>
            <input
              type="range"
              aria-label="Timeline Playhead Scrubber"
              min={0}
              max={maxClipDur}
              step={0.1}
              value={Math.min(currentTime, maxClipDur)}
              disabled={!sourceClip}
              onChange={(e) => handleSeekTimeline(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer disabled:opacity-40"
            />
            <span className="text-xs font-mono tabular-nums text-amber-400 shrink-0">
              {currentTime.toFixed(1)}s / {maxClipDur.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Multi-Track Lanes */}
        <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 overflow-hidden">
          {/* Playhead Vertical Line */}
          {sourceClip && (
            <div
              style={{ left: `${playheadPercent}%` }}
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-amber-400 z-20"
            />
          )}

          {/* Track 1: Text & Hook Caption Track */}
          <div
            onClick={() => setActiveTab('text')}
            className="relative h-8 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center px-3 cursor-pointer hover:border-slate-700"
          >
            <span className="text-[11px] font-semibold text-slate-400 w-28 shrink-0">
              T1 · Text Overlay
            </span>
            <div className="relative flex-1 h-5 bg-slate-950 rounded overflow-hidden">
              {editState.captionText.trim() && (
                <div
                  style={{ left: `${trimLeftPercent}%`, width: `${trimWidthPercent}%` }}
                  className="absolute top-0 bottom-0 bg-indigo-500/30 border border-indigo-400/60 rounded px-2 flex items-center"
                >
                  <span className="text-[10px] font-bold text-indigo-200 truncate">
                    “{editState.captionText}” ({editState.captionPosition})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Track 2: Main Video + Color LUT Track */}
          <div
            onClick={() => setActiveTab('trim')}
            className="relative h-10 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center px-3 cursor-pointer hover:border-slate-700"
          >
            <span className="text-[11px] font-semibold text-slate-400 w-28 shrink-0">
              V1 · Main Video
            </span>
            <div className="relative flex-1 h-7 bg-slate-950 rounded overflow-hidden">
              <div
                style={{ left: `${trimLeftPercent}%`, width: `${trimWidthPercent}%` }}
                className="absolute top-0 bottom-0 bg-amber-400/20 border-2 border-amber-400 rounded px-2 flex items-center justify-between"
              >
                <span className="text-[11px] font-bold text-amber-300 truncate">
                  {sourceClip ? sourceClip.filename : 'Upload Video'} · LUT: {editState.filterId}
                </span>
                <span className="text-[10px] font-mono tabular-nums text-amber-200 shrink-0">
                  {editState.trimStart.toFixed(1)}s–{editState.trimEnd.toFixed(1)}s ({editState.speed}x)
                </span>
              </div>
            </div>
          </div>

          {/* Track 3: Audio & Fade Track */}
          <div
            onClick={() => setActiveTab('speed')}
            className="relative h-8 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center px-3 cursor-pointer hover:border-slate-700"
          >
            <span className="text-[11px] font-semibold text-slate-400 w-28 shrink-0">
              A1 · Stereo Audio
            </span>
            <div className="relative flex-1 h-5 bg-slate-950 rounded overflow-hidden">
              <div
                style={{ left: `${trimLeftPercent}%`, width: `${trimWidthPercent}%` }}
                className="absolute top-0 bottom-0 bg-emerald-500/20 border border-emerald-400/50 rounded px-2 flex items-center justify-between"
              >
                <span className="text-[10px] font-semibold text-emerald-300 truncate">
                  Volume {editState.volumePercent}%{' '}
                  {editState.audioFade ? '· Smooth Fade In/Out' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

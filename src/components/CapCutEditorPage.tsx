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
  Zap,
  FlipHorizontal,
  RotateCw,
  Maximize2,
  Music,
} from 'lucide-react';
import { SAMPLE_REEL_URLS } from '../utils/urlParser';
import { fetchAndSaveMp4 } from '../utils/videoDownloader';
import { DownloadedVideoRecord } from './ReelGrabPlayer';
import {
  CapCutEditState,
  CapCutAiEditSuggestion,
  CapCutTimelineSegment,
  CAPCUT_FILTER_PRESETS,
  CAPCUT_VFX_PRESETS,
  CAPCUT_ANIMATION_PRESETS,
  CAPCUT_STICKER_PRESETS,
  CAPCUT_CANVAS_BG_PRESETS,
  CAPCUT_SPEED_OPTIONS,
  CAPTION_STYLE_PRESETS,
  clampTrimRange,
  calculateEditedDuration,
  buildCssPreviewFilter,
  buildCanvasTransformStyle,
  getActiveTimedCaption,
  buildDefaultTimedCaptions,
  normalizeAiEditorSuggestion,
  CapCutFilterId,
  CapCutVfxId,
  CapCutAnimationId,
  CapCutStickerId,
  CapCutCanvasBgId,
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

type EditorToolTab = 'vfx' | 'ai' | 'text' | 'filters' | 'transform' | 'speed';

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
  const [activeTab, setActiveTab] = useState<EditorToolTab>('vfx');
  const [projectTitle, setProjectTitle] = useState('CapCut AI Viral Cut');

  const [editState, setEditState] = useState<CapCutEditState>(() => ({
    trimStart: 0,
    trimEnd: 15,
    speed: 1,
    filterId: 'capcut_hdr',
    vfxId: 'neon_pulse',
    vfxIntensity: 80,
    animationId: 'zoom_punch',
    stickerId: 'fire_viral',
    canvasBg: 'blur',
    zoomScale: 100,
    rotationDeg: 0,
    flipHorizontal: false,
    flipVertical: false,
    brightness: 4,
    contrast: 8,
    saturation: 16,
    canvasRatio: '9:16',
    captionText: 'WAIT FOR THE END',
    timedCaptions: buildDefaultTimedCaptions(
      ['WAIT FOR THE END', 'POV: THIS CHANGED EVERYTHING', '10/10 VISUAL UPGRADE'],
      0,
      15
    ),
    useTimedCaptions: true,
    captionPosition: 'bottom',
    captionStyle: 'viral_yellow',
    volumePercent: 100,
    bassBoost: true,
    voiceClarity: true,
    audioFade: true,
    vignette: false,
  }));

  const [timelineSegments, setTimelineSegments] = useState<CapCutTimelineSegment[]>([
    { id: 'seg_1', startSec: 0, endSec: 15, label: 'Scene 1 (Main Cut)' },
  ]);
  const [beatMarkers, setBeatMarkers] = useState<number[]>([2.4, 6.0, 10.5]);

  const [aiSuggestion, setAiSuggestion] = useState<CapCutAiEditSuggestion | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportedVideo, setExportedVideo] = useState<ExportedEditorVideo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Live preview player state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoLoadedRef = useRef(false);
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
    const initialCues = buildDefaultTimedCaptions(
      ['WAIT FOR THE END', 'POV: THIS CHANGED EVERYTHING', '10/10 VISUAL UPGRADE'],
      0,
      defaultEnd
    );
    setEditState((prev) => ({
      ...prev,
      trimStart: 0,
      trimEnd: Math.max(1, defaultEnd),
      canvasRatio: isPortrait ? '9:16' : '16:9',
      timedCaptions: initialCues,
    }));
    setTimelineSegments([
      { id: 'seg_1', startSec: 0, endSec: Math.max(1, defaultEnd), label: 'Part 1 (Full Cut)' },
    ]);
    setBeatMarkers([
      Math.round(defaultEnd * 0.25 * 10) / 10,
      Math.round(defaultEnd * 0.55 * 10) / 10,
      Math.round(defaultEnd * 0.85 * 10) / 10,
    ]);
    setCurrentTime(0);
    setExportedVideo(null);
    setDownloadSuccess(false);
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
      setStatusBanner(`Loaded "${data.clip.filename}" (${data.clip.width}×${data.clip.height}, ${data.clip.durationSec}s) into CapCut Timeline.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not load video.');
    } finally {
      setIsUploading(false);
    }
  };

  // Auto-load a working video clip on initial mount so the CapCut Editor is immediately live & interactive
  useEffect(() => {
    if (hasAutoLoadedRef.current || sourceClip) return;
    hasAutoLoadedRef.current = true;
    const initialUrl =
      recentDownloads.length > 0
        ? recentDownloads[0].downloadUrl
        : 'capcut://sample-1';
    const initialLabel =
      recentDownloads.length > 0
        ? recentDownloads[0].filename
        : 'CapCut_Studio_Short_1.mp4';
    handleLoadUrlClip(initialUrl, initialLabel);
  }, []);

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
      setStatusBanner(`Uploaded "${data.clip.filename}" (${data.clip.durationSec}s) — Ready to edit!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not upload video file.');
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

      // Automatically apply AI smart VFX, LUT grade, animation, sticker, timed captions, and trim
      setEditState((prev) => ({
        ...prev,
        filterId: normalized.recommendedFilter,
        vfxId: normalized.recommendedVfx,
        animationId: normalized.recommendedAnimation,
        stickerId: normalized.recommendedSticker,
        speed: normalized.recommendedSpeed,
        canvasRatio: normalized.recommendedCanvasRatio,
        trimStart: normalized.recommendedTrimStart,
        trimEnd: normalized.recommendedTrimEnd,
        captionText: normalized.suggestedCaptions[0] || prev.captionText,
        timedCaptions: normalized.timedCaptions,
        useTimedCaptions: true,
        captionPosition: normalized.recommendedCaptionPosition,
        captionStyle: normalized.recommendedCaptionStyle,
      }));
      setStatusBanner(
        `AI Magic Edit applied: ${normalized.recommendedVfx} VFX + ${normalized.recommendedFilter} LUT + ${normalized.timedCaptions.length} timed captions!`
      );
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
      const activeBurnCaption = editState.useTimedCaptions
        ? editState.timedCaptions.map((c) => c.text).join(' • ')
        : editState.captionText;

      const response = await fetch('/api/editor/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId: sourceClip.clipId,
          ...editState,
          captionText: activeBurnCaption.slice(0, 48),
          title: projectTitle,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.exported) {
        throw new Error(data.error || 'Failed to render edited MP4 video.');
      }
      setExportedVideo(data.exported);
      setStatusBanner(
        `Export complete! Rendered ${data.exported.width}×${data.exported.height} MP4 (${data.exported.durationSec}s) with ${editState.vfxId} VFX & ${editState.filterId} LUT.`
      );
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
      timedCaptions: buildDefaultTimedCaptions(
        prev.timedCaptions.map((c) => c.text),
        trimStart,
        trimEnd
      ),
    }));
    if (videoRef.current) {
      videoRef.current.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
  };

  // CapCut Split Clip at Playhead action
  const handleSplitAtPlayhead = () => {
    const splitPoint =
      currentTime > editState.trimStart + 0.6 && currentTime < editState.trimEnd - 0.6
        ? Math.round(currentTime * 10) / 10
        : Math.round(((editState.trimStart + editState.trimEnd) / 2) * 10) / 10;

    const nextSegments: CapCutTimelineSegment[] = [
      {
        id: `seg_a_${Date.now()}`,
        startSec: editState.trimStart,
        endSec: splitPoint,
        label: `Part 1 (${editState.trimStart.toFixed(1)}s–${splitPoint.toFixed(1)}s)`,
      },
      {
        id: `seg_b_${Date.now()}`,
        startSec: splitPoint,
        endSec: editState.trimEnd,
        label: `Part 2 (${splitPoint.toFixed(1)}s–${editState.trimEnd.toFixed(1)}s)`,
      },
    ];
    setTimelineSegments(nextSegments);
    setStatusBanner(
      `Split video clip at ${splitPoint.toFixed(1)}s into 2 segments! Click Part 1 or Part 2 on the timeline to solo-trim that segment.`
    );
  };

  const handleAddBeatMarker = () => {
    const marker = Math.round(currentTime * 10) / 10;
    if (!beatMarkers.includes(marker)) {
      setBeatMarkers((prev) => [...prev, marker].sort((a, b) => a - b));
      setStatusBanner(`Added Beat Sync marker at ${marker.toFixed(1)}s.`);
    }
  };

  const editedDurationSec = calculateEditedDuration(
    editState.trimStart,
    editState.trimEnd,
    editState.speed
  );
  const liveCssFilter = buildCssPreviewFilter(editState);
  const liveTransformStyle = buildCanvasTransformStyle(editState);

  const activeCaptionText = getActiveTimedCaption(
    editState.timedCaptions,
    currentTime,
    editState.useTimedCaptions,
    editState.captionText
  );

  const activeCaptionStyleObj =
    CAPTION_STYLE_PRESETS.find((s) => s.id === editState.captionStyle) || CAPTION_STYLE_PRESETS[0];
  const activeStickerObj =
    CAPCUT_STICKER_PRESETS.find((s) => s.id === editState.stickerId) || CAPCUT_STICKER_PRESETS[0];
  const activeCanvasBgObj =
    CAPCUT_CANVAS_BG_PRESETS.find((b) => b.id === editState.canvasBg) ||
    CAPCUT_CANVAS_BG_PRESETS[0];
  const activeVfxObj =
    CAPCUT_VFX_PRESETS.find((v) => v.id === editState.vfxId) || CAPCUT_VFX_PRESETS[0];

  const maxClipDur = sourceClip?.durationSec || 15;
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
            <span>Page 3 · CapCut AI Pro Video Editor &amp; VFX Studio</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            CapCut Video Editor with Live VFX, AI Auto-Captions, Split Timeline &amp; LUTs
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Apply real-time <strong className="text-slate-200">CapCut Visual Effects (RGB Glitch, VHS Cam, Neon Pulse, 2.35:1 Cinema)</strong>, <strong className="text-slate-200">Zoom/Flip/Rotate transforms</strong>, <strong className="text-slate-200">Timed Auto-Captions</strong>, and <strong className="text-slate-200">Timeline Split cuts</strong>, then export a verified H.264 + AAC <code className="text-amber-300">.mp4</code> file.
          </p>
        </div>

        {/* Upload / Load Sample / AI Magic / Export Controls */}
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
            <span>Upload Your Video</span>
          </button>

          <button
            type="button"
            onClick={handleRunAiMagicEdit}
            disabled={!sourceClip || isAnalyzingAi}
            className="px-3.5 py-2 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/50 text-indigo-100 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40"
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

      {/* Live Feedback Status or Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200 flex items-center gap-2.5"
        >
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {statusBanner && !errorMessage && (
        <div className="px-4 py-2.5 bg-amber-400/10 border border-amber-400/30 rounded-xl text-xs text-amber-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main CapCut 2-Column Workspace: Left Tool Dock & Inspector + Right Live Canvas & Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN (7 cols): CapCut 6-Tab Tool Rail + Active Tool Inspector */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            {/* 6 CapCut Editing Tool Tabs */}
            <div
              role="tablist"
              aria-label="CapCut Editing Tools"
              className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800"
            >
              {[
                { id: 'vfx' as EditorToolTab, label: 'Effects (VFX)', icon: Zap },
                { id: 'ai' as EditorToolTab, label: 'AI Magic', icon: Sparkles },
                { id: 'text' as EditorToolTab, label: 'Captions', icon: Type },
                { id: 'filters' as EditorToolTab, label: 'Color LUT', icon: Sliders },
                { id: 'transform' as EditorToolTab, label: 'Crop & Trim', icon: Maximize2 },
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
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
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

            {/* Active Source Clip & Quick Switcher Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/90 border border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Film className="h-4 w-4 text-amber-400 shrink-0" />
                {sourceClip ? (
                  <span className="text-slate-200 font-medium truncate">
                    Active Clip: <strong className="text-white">{sourceClip.filename}</strong>{' '}
                    <span className="font-mono tabular-nums text-slate-400">
                      ({sourceClip.width}×{sourceClip.height} · {sourceClip.durationSec}s ·{' '}
                      {formatByteSize(sourceClip.sizeBytes)})
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-300">Loading studio clip into CapCut canvas...</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() =>
                      handleLoadUrlClip(`capcut://sample-${num}`, `CapCut_Sample_${num}.mp4`)
                    }
                    disabled={isUploading}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Sample {num}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB 1: CAPCUT VISUAL EFFECTS (VFX) & MOTION ANIMATIONS */}
            {activeTab === 'vfx' && (
              <div className="space-y-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-400" />
                      <span>CapCut Visual Effects (VFX) &amp; Motion Animations</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Click any VFX card to apply real-time visual effects on the video canvas and burn them into your MP4 export.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <label htmlFor="vfx-intensity-slider" className="text-slate-300 font-semibold">
                      VFX Intensity:
                    </label>
                    <input
                      id="vfx-intensity-slider"
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={editState.vfxIntensity}
                      onChange={(e) =>
                        setEditState((prev) => ({
                          ...prev,
                          vfxIntensity: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-24 accent-amber-400 cursor-pointer"
                    />
                    <span className="font-mono tabular-nums text-amber-400 font-bold">
                      {editState.vfxIntensity}%
                    </span>
                  </div>
                </div>

                {/* 8 CapCut VFX Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CAPCUT_VFX_PRESETS.map((vfx) => {
                    const isSelected = editState.vfxId === vfx.id;
                    return (
                      <button
                        key={vfx.id}
                        type="button"
                        onClick={() => {
                          setEditState((prev) => ({
                            ...prev,
                            vfxId: vfx.id as CapCutVfxId,
                          }));
                          setStatusBanner(`Applied "${vfx.label}" visual effect to live canvas.`);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400/15 border-amber-400 text-white shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-extrabold text-white">
                            {vfx.label}
                          </span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-950 text-amber-400 shrink-0">
                            {vfx.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 leading-snug">
                          {vfx.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* CapCut In / Combo Motion Animations */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="block text-xs font-bold text-white">
                    Clip Motion Animation (In / Combo)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CAPCUT_ANIMATION_PRESETS.map((anim) => {
                      const isSelected = editState.animationId === anim.id;
                      return (
                        <button
                          key={anim.id}
                          type="button"
                          onClick={() => {
                            setEditState((prev) => ({
                              ...prev,
                              animationId: anim.id as CapCutAnimationId,
                            }));
                            setStatusBanner(`Applied "${anim.label}" motion animation.`);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-500/20 border-indigo-400 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{anim.label}</span>
                            <span className="text-[10px] font-mono text-indigo-300">
                              {anim.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {anim.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: AI MAGIC DIRECTOR */}
            {activeTab === 'ai' && (
              <div className="space-y-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      <span>CapCut AI Director &amp; Multi-Cue Auto-Captions</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Gemini Vision inspects your video frame and automatically configures VFX, LUT grading, Zoom Punch animation, and 3 timed subtitle cues.
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

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">AI VFX</span>
                        <span className="font-bold text-amber-400">
                          {aiSuggestion.recommendedVfx}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">AI Filter LUT</span>
                        <span className="font-bold text-white">
                          {aiSuggestion.recommendedFilter}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Animation</span>
                        <span className="font-bold text-indigo-300">
                          {aiSuggestion.recommendedAnimation}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Smart Trim</span>
                        <span className="font-mono tabular-nums font-bold text-emerald-400">
                          {aiSuggestion.recommendedTrimStart}s–{aiSuggestion.recommendedTrimEnd}s
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 flex items-center justify-between gap-4">
                    <span>
                      Click <strong>Run AI Magic Edit</strong> to let Gemini analyze your video frame and auto-apply the optimal VFX, Color LUT, Animation, and Timed Captions.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TIMED AUTO-CAPTIONS, TEXT & STICKERS */}
            {activeTab === 'text' && (
              <div className="space-y-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-white">
                    Timed Auto-Captions &amp; Overlay Stickers
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditState((prev) => ({
                          ...prev,
                          useTimedCaptions: !prev.useTimedCaptions,
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                        editState.useTimedCaptions
                          ? 'bg-amber-400 text-slate-950 border-amber-400'
                          : 'bg-slate-900 text-slate-300 border-slate-700'
                      }`}
                    >
                      {editState.useTimedCaptions
                        ? 'Timed Multi-Captions: ON'
                        : 'Single Hook Caption'}
                    </button>
                  </div>
                </div>

                {editState.useTimedCaptions ? (
                  <div className="space-y-2">
                    <span className="block text-xs text-slate-400">
                      Edit the 3 timed subtitle cues (automatically switches on screen as the video plays):
                    </span>
                    {editState.timedCaptions.map((cue, idx) => (
                      <div
                        key={cue.id}
                        className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2"
                      >
                        <button
                          type="button"
                          onClick={() => handleSeekTimeline(cue.startSec + 0.1)}
                          className="px-2 py-1 rounded bg-slate-950 text-[11px] font-mono tabular-nums text-amber-400 shrink-0 cursor-pointer"
                        >
                          {cue.startSec.toFixed(1)}s–{cue.endSec.toFixed(1)}s
                        </button>
                        <input
                          type="text"
                          value={cue.text}
                          aria-label={`Timed Caption Cue ${idx + 1}`}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditState((prev) => ({
                              ...prev,
                              timedCaptions: prev.timedCaptions.map((item, i) =>
                                i === idx ? { ...item, text: val } : item
                              ),
                            }));
                          }}
                          className="flex-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label htmlFor="capcut-caption-input" className="text-xs font-bold text-white">
                      Single On-Screen Hook Caption
                    </label>
                    <input
                      id="capcut-caption-input"
                      type="text"
                      maxLength={48}
                      value={editState.captionText}
                      onChange={(e) =>
                        setEditState((prev) => ({ ...prev, captionText: e.target.value }))
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                {/* CapCut Stickers / Callout Badges */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="block text-xs font-semibold text-slate-300">
                    CapCut Callout Sticker Badge
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {CAPCUT_STICKER_PRESETS.map((sticker) => (
                      <button
                        key={sticker.id}
                        type="button"
                        onClick={() =>
                          setEditState((prev) => ({
                            ...prev,
                            stickerId: sticker.id as CapCutStickerId,
                          }))
                        }
                        className={`p-2 rounded-xl border text-center text-[11px] font-bold transition-colors cursor-pointer ${
                          editState.stickerId === sticker.id
                            ? 'border-amber-400 bg-amber-400/15 text-white'
                            : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {sticker.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caption Box Style & Position */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-300">
                      Caption Box Style
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
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
                          className={`p-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                            editState.captionStyle === style.id
                              ? 'border-amber-400 bg-amber-400/15 text-white'
                              : 'border-slate-800 bg-slate-900 text-slate-300'
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-300">
                      Caption Alignment
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['top', 'center', 'bottom'] as CapCutCaptionPosition[]).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() =>
                            setEditState((prev) => ({ ...prev, captionPosition: pos }))
                          }
                          className={`py-2 px-2 rounded-lg border text-xs font-bold uppercase cursor-pointer ${
                            editState.captionPosition === pos
                              ? 'bg-amber-400 text-slate-950 border-amber-400'
                              : 'bg-slate-900 text-slate-300 border-slate-800'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: FILTERS & COLOR LUT ADJUST */}
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

            {/* TAB 5: CROP, TRANSFORM, TRIM & CANVAS RATIO */}
            {activeTab === 'transform' && (
              <div className="space-y-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-white">
                    Canvas Transform (Zoom, Rotate, Flip) &amp; Smart Trim
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditState((prev) => ({
                          ...prev,
                          flipHorizontal: !prev.flipHorizontal,
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 cursor-pointer ${
                        editState.flipHorizontal
                          ? 'bg-amber-400 text-slate-950 border-amber-400'
                          : 'bg-slate-900 text-slate-200 border-slate-700'
                      }`}
                    >
                      <FlipHorizontal className="h-3.5 w-3.5" />
                      <span>Mirror Flip</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEditState((prev) => ({
                          ...prev,
                          rotationDeg: (((prev.rotationDeg + 90) % 360) as 0 | 90 | 180 | 270),
                        }))
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="h-3.5 w-3.5 text-amber-400" />
                      <span>Rotate ({editState.rotationDeg}°)</span>
                    </button>
                  </div>
                </div>

                {/* Zoom Scale + Canvas Backdrop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="canvas-zoom-slider" className="text-slate-300 font-medium">
                        Canvas Crop / Zoom Scale
                      </label>
                      <span className="font-mono tabular-nums text-amber-400 font-bold">
                        {editState.zoomScale}%
                      </span>
                    </div>
                    <input
                      id="canvas-zoom-slider"
                      type="range"
                      min={100}
                      max={180}
                      step={5}
                      value={editState.zoomScale}
                      onChange={(e) =>
                        setEditState((prev) => ({
                          ...prev,
                          zoomScale: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-xs text-slate-300 font-medium">
                      Canvas Backdrop Fill
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CAPCUT_CANVAS_BG_PRESETS.map((bg) => (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() =>
                            setEditState((prev) => ({
                              ...prev,
                              canvasBg: bg.id as CapCutCanvasBgId,
                            }))
                          }
                          className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                            editState.canvasBg === bg.id
                              ? 'border-amber-400 bg-amber-400/15 text-white'
                              : 'border-slate-800 bg-slate-900 text-slate-400'
                          }`}
                        >
                          {bg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Trim Start / End Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
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
                      max={Math.max(1, (sourceClip?.durationSec || 15) - 1)}
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
                      min={Math.min(1, sourceClip?.durationSec || 15)}
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

                {/* Aspect Ratio Selector */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                  {(
                    [
                      { id: '9:16', label: '9:16 Vertical' },
                      { id: '16:9', label: '16:9 Widescreen' },
                      { id: '1:1', label: '1:1 Square' },
                    ] as { id: CapCutCanvasRatio; label: string }[]
                  ).map((ratio) => (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() =>
                        setEditState((prev) => ({ ...prev, canvasRatio: ratio.id }))
                      }
                      className={`py-2 px-3 rounded-xl border text-xs font-bold font-mono transition-colors cursor-pointer ${
                        editState.canvasRatio === ratio.id
                          ? 'bg-amber-400/15 border-amber-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: SPEED & AUDIO MASTERING */}
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

                {/* Audio Volume & Mastering FX */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="space-y-1">
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditState((prev) => ({ ...prev, bassBoost: !prev.bassBoost }))
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold cursor-pointer ${
                        editState.bassBoost
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div>Bass Boost (+7dB)</div>
                      <div className="text-[10px] font-normal text-slate-400">
                        Punchy low-end EQ
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEditState((prev) => ({ ...prev, voiceClarity: !prev.voiceClarity }))
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold cursor-pointer ${
                        editState.voiceClarity
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div>AI Voice Clarity</div>
                      <div className="text-[10px] font-normal text-slate-400">
                        Denoise + vocal presence
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEditState((prev) => ({ ...prev, audioFade: !prev.audioFade }))
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold cursor-pointer ${
                        editState.audioFade
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div>Smooth Fade In/Out</div>
                      <div className="text-[10px] font-normal text-slate-400">
                        Anti-click audio edges
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Filename & Active Effect Summary Bar */}
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

            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono tabular-nums text-slate-400">
              <span className="text-amber-400 font-bold">VFX: {activeVfxObj.label}</span>
              <span>Ratio: {editState.canvasRatio}</span>
              <span className="text-emerald-400 font-bold">Net: {editedDurationSec}s</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Live CapCut Canvas Monitor & Exported MP4 Result */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                CapCut Live Monitor ({editState.canvasRatio})
              </span>
              {editState.vfxId !== 'none' && (
                <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-[10px] font-mono font-bold text-amber-300">
                  FX: {activeVfxObj.label}
                </span>
              )}
            </div>
            <span className="text-xs font-mono tabular-nums text-amber-400">
              {currentTime.toFixed(1)}s / {editState.trimEnd.toFixed(1)}s
            </span>
          </div>

          {/* Live Video Preview Frame with Real-Time VFX Overlays, Transform, LUT & Timed Captions */}
          <div
            className={`relative border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-[290px] sm:min-h-[330px] ${activeCanvasBgObj.previewClass}`}
          >
            {sourceClip ? (
              <div
                className={`relative overflow-hidden bg-black flex items-center justify-center shadow-2xl transition-all ${
                  editState.canvasRatio === '9:16'
                    ? 'w-[195px] sm:w-[215px] aspect-[9/16]'
                    : editState.canvasRatio === '1:1'
                    ? 'w-[245px] sm:w-[265px] aspect-square'
                    : 'w-full max-w-[360px] aspect-video'
                } ${
                  editState.vfxId === 'neon_pulse'
                    ? 'ring-2 ring-fuchsia-500 shadow-[0_0_30px_rgba(217,70,239,0.55)]'
                    : editState.vfxId === 'rgb_glitch'
                    ? 'ring-2 ring-cyan-400 shadow-[-4px_0_12px_rgba(244,63,94,0.7),4px_0_12px_rgba(34,211,238,0.7)]'
                    : ''
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
                  style={{
                    filter: liveCssFilter,
                    transform: liveTransformStyle,
                  }}
                  className="w-full h-full object-contain transition-transform duration-200"
                />

                {/* LIVE CAPCUT VFX OVERLAYS */}
                {editState.vfxId === 'vhs_retro' && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2.5 font-mono text-[10px] text-amber-200/90 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px]">
                    <div className="flex justify-between items-center">
                      <span className="text-rose-400 font-bold">● REC</span>
                      <span>SP 00:0{Math.floor(currentTime)}:18</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-amber-300/80">
                      <span>PLAY ▷</span>
                      <span>VHS CAM 1998</span>
                    </div>
                  </div>
                )}

                {editState.vfxId === 'rgb_glitch' && (
                  <div className="pointer-events-none absolute inset-0 mix-blend-screen border-l-2 border-r-2 border-l-rose-500/70 border-r-cyan-400/70 bg-[linear-gradient(transparent_60%,rgba(34,211,238,0.12)_60%)] bg-[length:100%_6px]" />
                )}

                {editState.vfxId === 'cinema_scope' && (
                  <>
                    <div className="pointer-events-none absolute top-0 inset-x-0 h-[11%] bg-black z-10" />
                    <div className="pointer-events-none absolute bottom-0 inset-x-0 h-[11%] bg-black z-10" />
                  </>
                )}

                {editState.vfxId === 'dreamy_bloom' && (
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-amber-500/15 via-transparent to-rose-400/20 mix-blend-screen" />
                )}

                {editState.vfxId === 'flash_strobe' && (
                  <div className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-white/40 bg-white/10" />
                )}

                {/* Live CapCut Sticker Overlay */}
                {activeStickerObj.id !== 'none' && (
                  <div className="pointer-events-none absolute top-3 right-2.5 z-20">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold border shadow-md ${activeStickerObj.badgeClass}`}
                    >
                      {activeStickerObj.text}
                    </span>
                  </div>
                )}

                {/* Live CapCut On-Screen Timed Caption Overlay */}
                {activeCaptionText.trim() && (
                  <div
                    className={`pointer-events-none absolute inset-x-2.5 z-20 flex justify-center text-center ${
                      editState.captionPosition === 'top'
                        ? 'top-9'
                        : editState.captionPosition === 'center'
                        ? 'top-1/2 -translate-y-1/2'
                        : 'bottom-6'
                    }`}
                  >
                    <span
                      className={`text-[11px] sm:text-xs tracking-wide uppercase break-words max-w-full ${activeCaptionStyleObj.previewClass}`}
                    >
                      {activeCaptionText}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center space-y-3">
                <Loader2 className="h-7 w-7 text-amber-400 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-300">
                  Loading video into CapCut Canvas...
                </p>
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
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    <span>Play Preview</span>
                  </>
                )}
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
              {editState.trimStart.toFixed(1)}s–{editState.trimEnd.toFixed(1)}s ·{' '}
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

      {/* BOTTOM MULTI-TRACK CAPCUT TIMELINE WITH REAL SPLIT / TRIM / BEAT TOOLS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
        {/* CapCut Timeline Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              CapCut Multi-Track Timeline
            </span>
          </div>

          {/* Direct Timeline Editing Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleSplitAtPlayhead}
              disabled={!sourceClip}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-amber-400 flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Scissors className="h-3.5 w-3.5" />
              <span>Split Clip</span>
            </button>

            <button
              type="button"
              onClick={() => updateTrimRange(currentTime, editState.trimEnd)}
              disabled={!sourceClip}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-40"
            >
              [ Set Start
            </button>

            <button
              type="button"
              onClick={() =>
                updateTrimRange(
                  editState.trimStart,
                  Math.max(editState.trimStart + 1, currentTime)
                )
              }
              disabled={!sourceClip}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-40"
            >
              Set End ]
            </button>

            <button
              type="button"
              onClick={() =>
                setEditState((prev) => ({
                  ...prev,
                  flipHorizontal: !prev.flipHorizontal,
                }))
              }
              disabled={!sourceClip}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <FlipHorizontal className="h-3.5 w-3.5 text-indigo-400" />
              <span>Flip</span>
            </button>

            <button
              type="button"
              onClick={handleAddBeatMarker}
              disabled={!sourceClip}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Music className="h-3.5 w-3.5" />
              <span>+ Beat Marker</span>
            </button>
          </div>

          {/* Interactive Timeline Playhead Scrubber */}
          <div className="flex items-center gap-2.5 flex-1 min-w-[220px] max-w-sm">
            <span className="text-[11px] font-mono tabular-nums text-slate-400">Scrub</span>
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

          {/* Track 1: Timed Auto-Captions & Sticker Track */}
          <div
            onClick={() => setActiveTab('text')}
            className="relative h-8 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center px-3 cursor-pointer hover:border-slate-700"
          >
            <span className="text-[11px] font-semibold text-slate-400 w-28 shrink-0">
              T1 · Captions
            </span>
            <div className="relative flex-1 h-5 bg-slate-950 rounded overflow-hidden flex items-center gap-1 px-1">
              {editState.useTimedCaptions ? (
                editState.timedCaptions.map((cue) => (
                  <div
                    key={cue.id}
                    className="flex-1 h-4 bg-indigo-500/30 border border-indigo-400/60 rounded px-1.5 flex items-center justify-between min-w-0"
                  >
                    <span className="text-[10px] font-bold text-indigo-200 truncate">
                      “{cue.text}”
                    </span>
                    <span className="text-[9px] font-mono text-indigo-300 shrink-0 ml-1">
                      {cue.startSec.toFixed(0)}s-{cue.endSec.toFixed(0)}s
                    </span>
                  </div>
                ))
              ) : (
                <div
                  style={{ left: `${trimLeftPercent}%`, width: `${trimWidthPercent}%` }}
                  className="absolute top-0 bottom-0 bg-indigo-500/30 border border-indigo-400/60 rounded px-2 flex items-center"
                >
                  <span className="text-[10px] font-bold text-indigo-200 truncate">
                    “{editState.captionText}”
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Track 2: VFX & Animation Layer */}
          <div
            onClick={() => setActiveTab('vfx')}
            className="relative h-8 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center px-3 cursor-pointer hover:border-slate-700"
          >
            <span className="text-[11px] font-semibold text-slate-400 w-28 shrink-0">
              FX1 · Visual FX
            </span>
            <div className="relative flex-1 h-5 bg-slate-950 rounded overflow-hidden">
              <div
                style={{ left: `${trimLeftPercent}%`, width: `${trimWidthPercent}%` }}
                className="absolute top-0 bottom-0 bg-fuchsia-500/25 border border-fuchsia-400/60 rounded px-2 flex items-center justify-between"
              >
                <span className="text-[10px] font-bold text-fuchsia-200 truncate">
                  VFX: {activeVfxObj.label} ({editState.vfxIntensity}%) · Anim:{' '}
                  {editState.animationId}
                </span>
                {activeStickerObj.id !== 'none' && (
                  <span className="text-[10px] font-bold text-amber-300 shrink-0">
                    {activeStickerObj.text}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Track 3: Main Video Track + Split Segments */}
          <div
            onClick={() => setActiveTab('transform')}
            className="relative h-10 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center px-3 cursor-pointer hover:border-slate-700"
          >
            <span className="text-[11px] font-semibold text-slate-400 w-28 shrink-0">
              V1 · Video Cut
            </span>
            <div className="relative flex-1 h-7 bg-slate-950 rounded overflow-hidden flex items-center gap-1 px-1">
              {timelineSegments.length > 1 ? (
                timelineSegments.map((seg) => (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTrimRange(seg.startSec, seg.endSec);
                      setStatusBanner(`Solo-selected ${seg.label}.`);
                    }}
                    className="flex-1 h-6 bg-amber-400/25 hover:bg-amber-400/35 border-2 border-amber-400 rounded px-2 flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-[10px] font-bold text-amber-200 truncate">
                      ✂ {seg.label}
                    </span>
                  </button>
                ))
              ) : (
                <div
                  style={{ left: `${trimLeftPercent}%`, width: `${trimWidthPercent}%` }}
                  className="absolute top-0 bottom-0 bg-amber-400/20 border-2 border-amber-400 rounded px-2 flex items-center justify-between"
                >
                  <span className="text-[11px] font-bold text-amber-300 truncate">
                    {sourceClip ? sourceClip.filename : 'Loading...'} · LUT: {editState.filterId}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-amber-200 shrink-0">
                    {editState.trimStart.toFixed(1)}s–{editState.trimEnd.toFixed(1)}s (
                    {editState.speed}x)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Track 4: Stereo Audio + Beat Sync Markers */}
          <div
            onClick={() => setActiveTab('speed')}
            className="relative h-8 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center px-3 cursor-pointer hover:border-slate-700"
          >
            <span className="text-[11px] font-semibold text-slate-400 w-28 shrink-0">
              A1 · Audio &amp; Beats
            </span>
            <div className="relative flex-1 h-5 bg-slate-950 rounded overflow-hidden">
              <div
                style={{ left: `${trimLeftPercent}%`, width: `${trimWidthPercent}%` }}
                className="absolute top-0 bottom-0 bg-emerald-500/20 border border-emerald-400/50 rounded px-2 flex items-center justify-between"
              >
                <span className="text-[10px] font-semibold text-emerald-300 truncate">
                  Vol {editState.volumePercent}%
                  {editState.bassBoost ? ' · Bass Boost' : ''}
                  {editState.voiceClarity ? ' · Voice Clarity' : ''}
                </span>
                <span className="text-[10px] font-mono text-amber-300 shrink-0">
                  Beats: {beatMarkers.map((b) => `${b}s`).join(', ')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { ParsedVideoInfo } from '../utils/urlParser';
import {
  sanitizeMp4Filename,
  buildDownloadRequestUrl,
  fetchAndSaveMp4,
} from '../utils/videoDownloader';
import {
  Download,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  Smartphone,
  Tv,
  Film,
  Globe,
} from 'lucide-react';

export interface DownloadedVideoRecord {
  id: string;
  title: string;
  platformName: string;
  quality: string;
  filename: string;
  sourceUrl: string;
  downloadUrl: string;
  blobUrl?: string;
  fileSize?: number;
  timestamp: string;
}

interface ReelGrabPlayerProps {
  videoInfo: ParsedVideoInfo;
  aspectRatio: 'portrait' | 'landscape';
  onAspectRatioChange: (ratio: 'portrait' | 'landscape') => void;
  onDownloadComplete: (record: DownloadedVideoRecord) => void;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '00:00';
  const totalSec = Math.round(sec);
  const mins = Math.floor(totalSec / 60);
  const rem = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const ReelGrabPlayer: React.FC<ReelGrabPlayerProps> = ({
  videoInfo,
  aspectRatio,
  onAspectRatioChange,
  onDownloadComplete,
}) => {
  const [selectedQuality, setSelectedQuality] = useState<'1080p' | '720p' | '480p'>('1080p');
  // Always default to 'stream' so the HTML5 <video> preview runs the EXACT extracted MP4 stream
  // that will be downloaded when clicking Download Video (.MP4).
  const [previewSource, setPreviewSource] = useState<'stream' | 'embed'>('stream');
  const [isStreamLoading, setIsStreamLoading] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<boolean>(false);
  const [liveDuration, setLiveDuration] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'success' | 'error'>('idle');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Reset player state when the canonical video URL changes
  useEffect(() => {
    setDownloadStatus('idle');
    setDownloadError(null);
    setPreviewSource('stream');
    setIsStreamLoading(true);
    setStreamError(false);
    setLiveDuration(null);
  }, [videoInfo.cleanUrl, videoInfo.platform, videoInfo.videoId]);

  const handleCopyLink = async () => {
    if (!videoInfo.cleanUrl) return;
    try {
      await navigator.clipboard.writeText(videoInfo.cleanUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownload = async () => {
    if (!videoInfo.isValid || !videoInfo.canDirectDownload || !videoInfo.downloadUrl) {
      setDownloadStatus('error');
      setDownloadError(
        videoInfo.embedReason || 'Please enter a valid YouTube Short, Instagram Reel, Facebook Reel, or MP4 URL first.'
      );
      return;
    }

    try {
      setDownloadStatus('downloading');
      setDownloadError(null);

      const finalFilename = sanitizeMp4Filename(videoInfo.filename, selectedQuality);
      const requestUrl = buildDownloadRequestUrl(
        videoInfo.downloadUrl,
        selectedQuality,
        finalFilename
      );

      const saved = await fetchAndSaveMp4({
        downloadUrl: requestUrl,
        filename: finalFilename,
      });

      setDownloadStatus('success');
      onDownloadComplete({
        id: `${Date.now()}-${videoInfo.videoId || 'video'}`,
        title: videoInfo.title,
        platformName: videoInfo.platformName,
        quality: selectedQuality,
        filename: saved.filename,
        sourceUrl: videoInfo.cleanUrl,
        downloadUrl: requestUrl,
        blobUrl: saved.blobUrl,
        fileSize: saved.byteLength,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    } catch (err: any) {
      setDownloadStatus('error');
      setDownloadError(err.message || 'Could not complete the video download. Please try again.');
    }
  };

  if (!videoInfo.isValid) {
    return (
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
        <h2 className="text-base font-bold text-white">No Valid Video Loaded</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          {videoInfo.embedReason ||
            'Paste a valid YouTube Shorts, Instagram Reels, Facebook Reels, or direct MP4 URL above and click Fetch Video.'}
        </p>
      </section>
    );
  }

  const renderPlayerMedia = (isPortrait: boolean) => {
    if (previewSource === 'embed' && videoInfo.embedUrl) {
      return (
        <iframe
          key={videoInfo.embedUrl}
          src={videoInfo.embedUrl}
          title={videoInfo.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full border-0 bg-black"
        />
      );
    }

    if (videoInfo.streamUrl) {
      return (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          <video
            key={videoInfo.streamUrl}
            ref={videoRef}
            src={videoInfo.streamUrl}
            poster={videoInfo.posterUrl}
            controls
            playsInline
            preload="auto"
            onLoadStart={() => {
              setIsStreamLoading(true);
              setStreamError(false);
            }}
            onLoadedMetadata={(e) => {
              const dur = e.currentTarget.duration;
              if (Number.isFinite(dur) && dur > 0) {
                setLiveDuration(formatSeconds(dur));
              }
            }}
            onLoadedData={() => setIsStreamLoading(false)}
            onCanPlay={() => setIsStreamLoading(false)}
            onError={() => {
              setIsStreamLoading(false);
              setStreamError(true);
            }}
            className={`w-full h-full ${isPortrait ? 'object-cover' : 'object-contain'} bg-black`}
          />
          {isStreamLoading && (
            <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center gap-2 p-4 text-center pointer-events-none">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              <span className="text-xs font-semibold text-white">
                Extracting live MP4 video...
              </span>
              <span className="text-[11px] text-slate-400">
                Preparing exact video for preview &amp; download
              </span>
            </div>
          )}
          {streamError && !isStreamLoading && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
              <span className="text-xs font-semibold text-white">
                Could not stream MP4 directly
              </span>
              {videoInfo.embedUrl && (
                <button
                  type="button"
                  onClick={() => setPreviewSource('embed')}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Switch to Official Embed
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="p-4 text-center">
        <Film className="h-8 w-8 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-400">Preview ready</p>
      </div>
    );
  };

  return (
    <section
      aria-label="Video Preview and Download Workspace"
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT COLUMN: Video Preview Frame (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
          {/* View Mode & Source Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="group"
              aria-label="Preview Aspect Ratio"
              className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
            >
              <button
                type="button"
                onClick={() => onAspectRatioChange('portrait')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  aspectRatio === 'portrait'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>9:16 Portrait</span>
              </button>
              <button
                type="button"
                onClick={() => onAspectRatioChange('landscape')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  aspectRatio === 'landscape'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Tv className="h-3.5 w-3.5" />
                <span>16:9 Landscape</span>
              </button>
            </div>

            {/* Source Mode Switch (MP4 Stream vs Official Platform Embed) */}
            {videoInfo.embedUrl && (
              <div
                role="group"
                aria-label="Preview Player Mode"
                className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
              >
                <button
                  type="button"
                  onClick={() => setPreviewSource('stream')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    previewSource === 'stream'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Film className="h-3 w-3" />
                  <span>MP4 Stream</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSource('embed')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    previewSource === 'embed'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe className="h-3 w-3" />
                  <span>Official Embed</span>
                </button>
              </div>
            )}
          </div>

          {/* Responsive Player Frame */}
          <div className="flex-1 flex items-center justify-center bg-slate-950 border border-slate-800/90 rounded-2xl p-3">
            {aspectRatio === 'portrait' ? (
              <div className="relative w-[205px] sm:w-[220px] aspect-[9/16] bg-black rounded-xl overflow-hidden border border-slate-800 shadow-lg flex items-center justify-center">
                {renderPlayerMedia(true)}
              </div>
            ) : (
              <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-lg flex items-center justify-center">
                {renderPlayerMedia(false)}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Metadata, Quality Selector & Single Download Button (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-slate-950 border border-slate-800/90 rounded-2xl p-6 space-y-6">
          <div className="space-y-4">
            {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className={`font-semibold ${videoInfo.badgeColor}`}>
                {videoInfo.platformName}
              </span>
              <span aria-hidden="true">·</span>
              <span>{videoInfo.author}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {liveDuration || videoInfo.durationLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">MP4 (H.264 + AAC)</span>
            </div>

            {/* Video Title */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {videoInfo.title}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1 truncate">
                Source: {videoInfo.cleanUrl}
              </p>
            </div>

            {/* Quality Selection */}
            <div className="pt-2 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Select Download Quality
              </label>
              <div
                role="group"
                aria-label="Video Download Quality"
                className="grid grid-cols-3 gap-2.5"
              >
                {(
                  [
                    { id: '1080p', label: '1080p Full HD', desc: 'MP4 · Best Quality' },
                    { id: '720p', label: '720p HD', desc: 'MP4 · Balanced' },
                    { id: '480p', label: '480p Standard', desc: 'MP4 · Fast Save' },
                  ] as const
                ).map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelectedQuality(q.id)}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      selectedQuality === q.id
                        ? 'bg-amber-400/10 border-amber-400 text-white'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono tabular-nums">
                      {q.label}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {q.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Primary Single Download Action & Status Feedback */}
          <div className="space-y-4 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloadStatus === 'downloading'}
              className="w-full py-4 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-colors shadow-lg shadow-emerald-500/15 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {downloadStatus === 'downloading' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-slate-950" />
                  <span>Downloading {selectedQuality} MP4 Video...</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5 text-slate-950" />
                  <span>Download Video ({selectedQuality} .MP4)</span>
                </>
              )}
            </button>

            {/* Download Status Alerts */}
            {downloadStatus === 'success' && (
              <div
                role="status"
                className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  Download complete! Saved{' '}
                  <strong className="font-mono text-white">
                    {videoInfo.filename.replace(/\.mp4$/i, `_${selectedQuality}.mp4`)}
                  </strong>{' '}
                  to your device.
                </span>
              </div>
            )}

            {downloadError && (
              <div
                role="alert"
                className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{downloadError}</span>
              </div>
            )}

            {/* Secondary Utility Links */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-400">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Source Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Source URL</span>
                  </>
                )}
              </button>

              <a
                href={videoInfo.cleanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 transition-colors whitespace-nowrap"
              >
                <span>Open Original on {videoInfo.platformName}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

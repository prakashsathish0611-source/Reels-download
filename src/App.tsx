/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { parseVideoUrl, ParsedVideoInfo, SAMPLE_REEL_URLS } from './utils/urlParser';
import { fetchAndSaveMp4 } from './utils/videoDownloader';
import { Header, ActiveAppPage } from './components/Header';
import { VideoInputBar } from './components/VideoInputBar';
import { ReelGrabPlayer, DownloadedVideoRecord } from './components/ReelGrabPlayer';
import { DualVideoStudioPage } from './components/DualVideoStudioPage';
import { CapCutEditorPage } from './components/CapCutEditorPage';
import {
  Download,
  Trash2,
  CheckCircle2,
  Film,
  Smartphone,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Wand2,
  Scissors,
} from 'lucide-react';

export default function App() {
  const [activePage, setActivePage] = useState<ActiveAppPage>(() => {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');
    if (pageParam === 'studio') return 'studio';
    if (pageParam === 'editor') return 'editor';
    return 'downloader';
  });
  const [currentUrl, setCurrentUrl] = useState<string>(SAMPLE_REEL_URLS[0].url);
  const [parsedVideoInfo, setParsedVideoInfo] = useState<ParsedVideoInfo>(() =>
    parseVideoUrl(SAMPLE_REEL_URLS[0].url)
  );
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'landscape'>('portrait');
  const [downloadHistory, setDownloadHistory] = useState<DownloadedVideoRecord[]>([]);
  const [reSavingId, setReSavingId] = useState<string | null>(null);
  const [reSavedId, setReSavedId] = useState<string | null>(null);
  const [reSaveError, setReSaveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFetchVideo = async (url: string) => {
    setCurrentUrl(url);
    const localParsed = parseVideoUrl(url);
    setParsedVideoInfo(localParsed);

    if (!localParsed.isValid) return;

    setIsFetching(true);
    try {
      const response = await fetch(
        `/api/video-info?url=${encodeURIComponent(localParsed.cleanUrl)}`
      );
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setParsedVideoInfo((prev) => ({
            ...prev,
            title: result.data.title || prev.title,
            author: result.data.author || prev.author,
            posterUrl: result.data.thumbnail || prev.posterUrl,
            filename: result.data.filename || prev.filename,
            streamUrl: result.data.streamUrl || prev.streamUrl,
            downloadUrl: result.data.downloadUrl || prev.downloadUrl,
          }));
        }
      }
    } catch {
      // Local parsed info already has valid canonical streamUrl and downloadUrl
    } finally {
      setIsFetching(false);
    }
  };

  const handleQuickPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        handleFetchVideo(text.trim());
        return;
      }
    } catch {
      // Focus input if clipboard permission is not granted
    }
    inputRef.current?.focus();
  };

  const handleDownloadComplete = (record: DownloadedVideoRecord) => {
    setDownloadHistory((prev) => [record, ...prev]);
    setReSaveError(null);
  };

  const handleSaveAgain = async (item: DownloadedVideoRecord) => {
    if (reSavingId) return;
    setReSavingId(item.id);
    setReSaveError(null);

    try {
      const saved = await fetchAndSaveMp4({
        downloadUrl: item.downloadUrl,
        filename: item.filename,
        cachedBlobUrl: item.blobUrl,
      });

      setDownloadHistory((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                blobUrl: saved.blobUrl,
                fileSize: saved.byteLength,
                filename: saved.filename,
              }
            : entry
        )
      );

      setReSavedId(item.id);
      setTimeout(() => {
        setReSavedId((current) => (current === item.id ? null : current));
      }, 3000);
    } catch (err: any) {
      setReSaveError(
        err.message || `Could not re-save "${item.filename}". Please try again.`
      );
    } finally {
      setReSavingId(null);
    }
  };

  const handleClearHistory = () => {
    downloadHistory.forEach((item) => {
      if (item.blobUrl && item.blobUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.blobUrl);
        } catch {
          // ignore revoke errors
        }
      }
    });
    setDownloadHistory([]);
    setReSaveError(null);
    setReSavedId(null);
  };

  return (
    <div id="top" className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <Header
        activePage={activePage}
        onSelectPage={setActivePage}
        onQuickPaste={handleQuickPaste}
        downloadCount={downloadHistory.length}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-5 space-y-6">
        {/* Workspace Page Switcher Tabs */}
        <div
          role="tablist"
          aria-label="Workspace Pages"
          className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={activePage === 'downloader'}
              onClick={() => setActivePage('downloader')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activePage === 'downloader'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Download className="h-4 w-4" />
              <span>Page 1 · Social Video Downloader</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activePage === 'studio'}
              onClick={() => setActivePage('studio')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activePage === 'studio'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Wand2 className="h-4 w-4" />
              <span>Page 2 · AI Dual-Video Merger</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activePage === 'editor'}
              onClick={() => setActivePage('editor')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activePage === 'editor'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Scissors className="h-4 w-4" />
              <span>Page 3 · AI CapCut Video Editor</span>
            </button>
          </div>
        </div>

        {activePage === 'downloader' ? (
          <>
            {/* 1. URL Input & Platform Detector */}
            <VideoInputBar
              currentUrl={currentUrl}
              onSubmitUrl={handleFetchVideo}
              isFetching={isFetching}
              inputRef={inputRef}
            />

            {/* 2. Video Preview & Single Download Workspace */}
            <ReelGrabPlayer
              videoInfo={parsedVideoInfo}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              onDownloadComplete={handleDownloadComplete}
            />
          </>
        ) : activePage === 'studio' ? (
          /* Page 2: AI Dual-Video Analyzer, Effect Designer & Merger */
          <DualVideoStudioPage
            recentDownloads={downloadHistory}
            onDownloadComplete={handleDownloadComplete}
          />
        ) : (
          /* Page 3: AI CapCut Timeline & Effect Video Editor */
          <CapCutEditorPage
            recentDownloads={downloadHistory}
            onDownloadComplete={handleDownloadComplete}
          />
        )}

        {/* 3. Recent Downloads History Table */}
        <section
          id="history"
          aria-label="Recent Downloads"
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Recent Downloads</h2>
              <p className="text-xs text-slate-400">
                Videos downloaded during this session with verified MP4 (H.264 + AAC) instant re-save.
              </p>
            </div>
            {downloadHistory.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {reSaveError && (
            <div
              role="alert"
              className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{reSaveError}</span>
            </div>
          )}

          {downloadHistory.length === 0 ? (
            <div className="p-8 bg-slate-950 border border-slate-800/80 rounded-xl text-center space-y-2">
              <Film className="h-6 w-6 text-slate-500 mx-auto" />
              <p className="text-sm font-medium text-slate-300">
                No videos downloaded yet
              </p>
              <p className="text-xs text-slate-500">
                Click the green Download Video (.MP4) button above to save a YouTube Short, Instagram Reel, or Facebook Reel.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-semibold text-slate-400">
                    <th className="py-3 px-4">Video Title</th>
                    <th className="py-3 px-4">Platform</th>
                    <th className="py-3 px-4">Quality</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {downloadHistory.map((item) => {
                    const isSaving = reSavingId === item.id;
                    const isSaved = reSavedId === item.id;
                    return (
                      <tr
                        key={item.id}
                        className="bg-slate-900/50 hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-white">
                          <div>{item.title}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {item.filename}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {item.platformName}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-emerald-400">
                          {item.quality} MP4
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-400">
                          {item.timestamp}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleSaveAgain(item)}
                            disabled={isSaving}
                            aria-label={`Save Again ${item.title}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                              isSaved
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 hover:text-amber-300 border border-amber-400/30'
                            } disabled:opacity-60`}
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Saving MP4...</span>
                              </>
                            ) : isSaved ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Saved (.MP4)</span>
                              </>
                            ) : (
                              <>
                                <Download className="h-3.5 w-3.5" />
                                <span>Save Again</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 4. Supported Platforms Overview */}
        <section
          id="platforms"
          aria-label="Supported Video Platforms"
          className="space-y-4"
        >
          <div>
            <h2 className="text-lg font-bold text-white">
              Supported Social Video Platforms
            </h2>
            <p className="text-xs text-slate-400">
              Built for fast, single-click MP4 video saving across short-form vertical and widescreen formats.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">01. YouTube Shorts</h3>
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Supports <code className="text-slate-300">youtube.com/shorts/*</code> and <code className="text-slate-300">youtu.be/*</code> links with instant 9:16 or 16:9 preview and direct 1080p/720p MP4 download.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">02. Instagram Reels</h3>
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Supports <code className="text-slate-300">instagram.com/reel/*</code> and post links. Streams through the ReelGrab media proxy for in-browser playback and MP4 file saving.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">03. Facebook Reels</h3>
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Supports <code className="text-slate-300">facebook.com/reel/*</code> and <code className="text-slate-300">fb.watch/*</code> links with full HTML5 video preview and single-click MP4 download.
              </p>
            </div>
          </div>
        </section>

        {/* 5. How It Works */}
        <section
          id="faq"
          aria-label="How ReelGrab Works"
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Smartphone className="h-4 w-4" />
              <span>Step 1 · Paste Link</span>
            </div>
            <h3 className="text-sm font-bold text-white">
              Copy any Short or Reel URL
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Copy the share link from YouTube Shorts, Instagram Reels, or Facebook Reels and paste it into the input field above.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Film className="h-4 w-4" />
              <span>Step 2 · Preview Video</span>
            </div>
            <h3 className="text-sm font-bold text-white">
              Watch in 9:16 Portrait or 16:9
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Verify the video stream in the built-in HTML5 player and switch between mobile vertical (9:16) and widescreen (16:9) modes.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Step 3 · Save MP4</span>
            </div>
            <h3 className="text-sm font-bold text-white">
              Click Download Video (.MP4)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Select 1080p, 720p, or 480p and click the single Download button to save the MP4 file directly to your device.
            </p>
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ReelGrab — Social Video &amp; Reels Downloader</span>
          <span>For personal and authorized media archiving</span>
        </div>
      </footer>
    </div>
  );
}

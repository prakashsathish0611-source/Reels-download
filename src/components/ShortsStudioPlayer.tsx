import React, { useState, useEffect, useRef } from 'react';
import { ClipCandidate, CaptionPreset, PlayerAspectRatio, CropPosition } from '../types/clip';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Smartphone,
  Tv,
  Layers,
  Heart,
  MessageCircle,
  Share2,
  Disc3,
  Sparkles,
  Maximize2,
  MoveHorizontal,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ShortsStudioPlayerProps {
  clip: ClipCandidate;
  videoTitle: string;
}

export const ShortsStudioPlayer: React.FC<ShortsStudioPlayerProps> = ({ clip, videoTitle }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [captionPreset, setCaptionPreset] = useState<CaptionPreset>('hormozi');
  const [reframeMode, setReframeMode] = useState<'auto' | 'split' | 'speaker1'>('auto');
  const [showShortsOverlay, setShowShortsOverlay] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // New Orientation & Aspect Ratio States
  const [aspectRatio, setAspectRatio] = useState<PlayerAspectRatio>('portrait');
  const [cropPosition, setCropPosition] = useState<CropPosition>('auto');
  const [showCropGuide, setShowCropGuide] = useState<boolean>(true);

  const duration = clip.durationSeconds || 45;
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Playback timer loop
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const step = (now: number) => {
        if (lastTimeRef.current !== null) {
          const delta = (now - lastTimeRef.current) / 1000;
          setCurrentTime((prev) => {
            const next = prev + delta * playbackSpeed;
            if (next >= duration) {
              setIsPlaying(false);
              return 0;
            }
            return next;
          });
        }
        lastTimeRef.current = now;
        animationFrameRef.current = requestAnimationFrame(step);
      };
      animationFrameRef.current = requestAnimationFrame(step);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      lastTimeRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, duration]);

  // Reset playback on clip change
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, [clip.id]);

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
  };

  const handleReset = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // Find active caption line & words for current time
  const activeCaptionLine = clip.captions?.find(
    (c) => currentTime >= c.start && currentTime <= c.end
  );

  const currentCaptionText = activeCaptionLine
    ? activeCaptionLine.text
    : currentTime < 3
    ? clip.hook
    : '';

  const activeWords = activeCaptionLine?.words || [];

  // Determine crop offset in landscape mode (percentage from left)
  const getCropOffsetClass = () => {
    if (cropPosition === 'left') return 'left-6';
    if (cropPosition === 'center') return 'left-1/2 -translate-x-1/2';
    if (cropPosition === 'right') return 'right-6';
    // Auto-track: follows speaker
    return 'right-8'; // Speaker is on right in podcast studio setup
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
      {/* MODE TOGGLE: Portrait (9:16) vs Landscape (16:9) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800">
        <div className="flex items-center space-x-1.5">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pl-1.5 pr-2">
            Preview Mode:
          </span>
          <button
            onClick={() => setAspectRatio('portrait')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              aspectRatio === 'portrait'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Portrait (9:16 Shorts)</span>
          </button>

          <button
            onClick={() => setAspectRatio('landscape')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              aspectRatio === 'landscape'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Tv className="h-3.5 w-3.5" />
            <span>Landscape (16:9 Master)</span>
          </button>
        </div>

        {/* Sub-controls based on mode */}
        {aspectRatio === 'portrait' ? (
          <button
            onClick={() => setShowShortsOverlay((v) => !v)}
            className="text-[11px] text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer px-2 py-1 rounded bg-zinc-950/60 border border-zinc-800 flex items-center gap-1"
          >
            {showShortsOverlay ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            <span>{showShortsOverlay ? 'Hide UI Overlay' : 'Show UI Overlay'}</span>
          </button>
        ) : (
          <button
            onClick={() => setShowCropGuide((v) => !v)}
            className="text-[11px] text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer px-2 py-1 rounded bg-zinc-950/60 border border-zinc-800 flex items-center gap-1"
          >
            <Layers className="h-3 w-3 text-amber-400" />
            <span>{showCropGuide ? 'Hide 9:16 Crop Guide' : 'Show 9:16 Crop Guide'}</span>
          </button>
        )}
      </div>

      {/* VIDEO PREVIEW SCREEN */}
      {aspectRatio === 'portrait' ? (
        /* ============================================================ */
        /* PORTRAIT MODE (9:16 Vertical Shorts Simulator)               */
        /* ============================================================ */
        <div className="flex flex-col items-center">
          <div className="relative w-[280px] sm:w-[305px] h-[520px] sm:h-[570px] bg-black rounded-[40px] p-3 shadow-2xl ring-1 ring-zinc-700/60 shadow-amber-500/5 overflow-hidden flex flex-col justify-between">
            {/* Phone Speaker Notch */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-24 h-4 bg-zinc-900 rounded-full z-30 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-zinc-950 border border-zinc-800 mr-2" />
              <div className="w-10 h-1 bg-zinc-800 rounded-full" />
            </div>

            {/* Video Canvas Container */}
            <div className="relative w-full h-full rounded-[30px] overflow-hidden bg-gradient-to-b from-zinc-900 via-zinc-950 to-black select-none">
              {/* Speaker Video Simulation Canvas */}
              {reframeMode === 'split' ? (
                /* Split Screen Mode */
                <div className="w-full h-full flex flex-col">
                  {/* Top: Host */}
                  <div className="relative h-1/2 w-full bg-gradient-to-br from-zinc-800 to-zinc-900 border-b border-zinc-700/40 flex items-center justify-center overflow-hidden">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-zinc-950 font-bold text-lg shadow-xl ring-4 ring-amber-500/20">
                      HOST
                    </div>
                    <span className="absolute bottom-2 left-3 text-[10px] font-semibold text-zinc-300 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
                      Host Camera
                    </span>
                  </div>
                  {/* Bottom: Active Speaker */}
                  <div className="relative h-1/2 w-full bg-gradient-to-br from-indigo-950 to-zinc-900 flex items-center justify-center overflow-hidden">
                    <div className="w-22 h-22 rounded-full bg-gradient-to-tr from-indigo-500 to-rose-500 flex items-center justify-center text-white font-extrabold text-xl shadow-xl ring-4 ring-indigo-500/30">
                      {clip.speaker.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="absolute bottom-2 left-3 text-[10px] font-semibold text-emerald-300 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      {clip.speaker} (Active)
                    </span>
                  </div>
                </div>
              ) : (
                /* Single Speaker / Auto Active Tracking */
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900 to-zinc-950 opacity-90" />
                  <div className="absolute w-44 h-44 rounded-full bg-amber-500/10 blur-3xl" />

                  <div className="relative z-10 flex flex-col items-center">
                    <div className="relative">
                      <div className="w-26 h-26 sm:w-30 sm:h-30 rounded-3xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 p-1 shadow-2xl glow-amber">
                        <div className="w-full h-full rounded-[22px] bg-zinc-900 flex items-center justify-center overflow-hidden relative">
                          <span className="text-3xl font-black text-white tracking-wider">
                            {clip.speaker.slice(0, 2).toUpperCase()}
                          </span>
                          {isPlaying && (
                            <div className="absolute bottom-1 inset-x-2 flex items-end justify-center gap-0.5 h-6">
                              {[35, 75, 45, 90, 60, 80, 40, 95, 50].map((h, i) => (
                                <div
                                  key={i}
                                  className="w-1 bg-amber-400 rounded-full animate-bounce"
                                  style={{
                                    height: `${(h * Math.sin((currentTime + i) * 3) + 50) % 100}%`,
                                    animationDuration: `${0.3 + (i % 3) * 0.15}s`,
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="absolute -bottom-2 inset-x-0 mx-auto w-max px-2 py-0.5 rounded-full bg-emerald-500 text-black font-extrabold text-[9px] uppercase tracking-wider shadow">
                        9:16 Speaker Tracked
                      </span>
                    </div>

                    <p className="mt-3 text-xs font-bold text-white tracking-wide">{clip.speaker}</p>
                    <p className="text-[10px] text-zinc-400">{clip.energyLevel} Pacing</p>
                  </div>
                </div>
              )}

              {/* DYNAMIC ANIMATED KARAOKE CAPTIONS (Vertical 9:16 Safe Area) */}
              <div className="absolute bottom-20 inset-x-3 z-20 pointer-events-none text-center">
                {captionPreset === 'hormozi' && (
                  <div className="inline-block px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 max-w-[94%] shadow-2xl">
                    <div className="text-sm sm:text-base font-black uppercase tracking-tight text-white leading-tight">
                      {activeWords.length > 0 ? (
                        activeWords.map((w, idx) => {
                          const isCurrent = currentTime >= w.start && currentTime <= w.end;
                          return (
                            <span
                              key={idx}
                              className={`inline-block mx-0.5 transition-all duration-100 ${
                                isCurrent
                                  ? 'text-amber-300 scale-110 font-black text-stroke-thick bg-amber-400/20 px-1 rounded'
                                  : w.highlight
                                  ? 'text-yellow-400 font-bold'
                                  : 'text-white'
                              }`}
                            >
                              {w.word}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-amber-300 font-black">{currentCaptionText}</span>
                      )}
                    </div>
                  </div>
                )}

                {captionPreset === 'beast' && (
                  <div className="inline-block px-3 py-2 rounded-2xl bg-black/70 backdrop-blur-md border border-emerald-500/30 max-w-[94%] shadow-2xl">
                    <div className="text-sm sm:text-base font-extrabold uppercase tracking-tight text-white">
                      {activeWords.length > 0 ? (
                        activeWords.map((w, idx) => {
                          const isCurrent = currentTime >= w.start && currentTime <= w.end;
                          return (
                            <span
                              key={idx}
                              className={`inline-block mx-0.5 ${
                                isCurrent
                                  ? 'text-emerald-400 bg-emerald-500/20 px-1 rounded scale-105 font-black text-stroke-thick'
                                  : 'text-zinc-100'
                              }`}
                            >
                              {w.word}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-emerald-400">{currentCaptionText}</span>
                      )}
                    </div>
                  </div>
                )}

                {captionPreset === 'minimal' && (
                  <div className="inline-block px-3 py-1.5 rounded-lg bg-zinc-950/80 backdrop-blur-sm border border-zinc-700/60 max-w-[90%]">
                    <p className="text-xs sm:text-sm font-medium text-white leading-snug">
                      {currentCaptionText}
                    </p>
                  </div>
                )}

                {captionPreset === 'neon' && (
                  <div className="inline-block px-3 py-2 rounded-xl bg-black/80 backdrop-blur-md border border-cyan-500/40 shadow-lg shadow-cyan-500/20 max-w-[92%]">
                    <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-cyan-200">
                      {activeWords.length > 0 ? (
                        activeWords.map((w, idx) => {
                          const isCurrent = currentTime >= w.start && currentTime <= w.end;
                          return (
                            <span
                              key={idx}
                              className={`inline-block mx-0.5 ${
                                isCurrent
                                  ? 'text-cyan-300 underline decoration-cyan-400 scale-105'
                                  : 'text-zinc-300'
                              }`}
                            >
                              {w.word}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-cyan-300">{currentCaptionText}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* YouTube Shorts UI Overlay Mockup */}
              {showShortsOverlay && (
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 z-10 text-white">
                  <div className="flex items-center justify-between text-xs font-semibold text-white/90 drop-shadow">
                    <span className="bg-black/40 px-2 py-0.5 rounded-full text-[10px] backdrop-blur-sm">
                      YouTube Shorts
                    </span>
                    <span className="text-[10px] bg-red-600 px-2 py-0.5 rounded-full font-bold">
                      Viral #{clip.rank}
                    </span>
                  </div>

                  <div className="self-end flex flex-col items-center space-y-4 mb-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                        <Heart className="h-4 w-4 text-white fill-white" />
                      </div>
                      <span className="text-[9px] font-bold mt-0.5">342K</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                        <MessageCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-[9px] font-bold mt-0.5">2.4K</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                        <Share2 className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-[9px] font-bold mt-0.5">Share</span>
                    </div>

                    <div className="w-7 h-7 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center animate-spin">
                      <Disc3 className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                  </div>

                  <div className="pr-10 drop-shadow">
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-zinc-950 text-[9px] font-bold">
                        AI
                      </div>
                      <span className="text-xs font-bold text-white">@viralclips</span>
                    </div>
                    <p className="text-[11px] text-zinc-200 line-clamp-1 mt-0.5 font-medium">
                      {clip.suggestedTitles[0]}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* LANDSCAPE MODE (16:9 Cinema / Master Video Display)          */
        /* ============================================================ */
        <div className="flex flex-col items-center w-full">
          {/* Landscape 16:9 Studio Monitor Frame */}
          <div className="relative w-full aspect-video max-h-[380px] bg-zinc-950 rounded-2xl p-2.5 shadow-2xl ring-1 ring-zinc-800 overflow-hidden border border-zinc-700/80">
            {/* Monitor Top bar */}
            <div className="absolute top-3 left-4 right-4 z-30 flex items-center justify-between text-xs text-zinc-400 pointer-events-none">
              <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono text-zinc-300 border border-zinc-700/40">
                16:9 Widescreen Master &bull; {videoTitle.slice(0, 32)}...
              </span>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono text-[10px]">
                {clip.startTime} &rarr; {clip.endTime}
              </span>
            </div>

            {/* Widescreen Video Canvas */}
            <div className="relative w-full h-full rounded-xl overflow-hidden bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-between px-8">
              {/* Studio Backdrop Lighting */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/40 via-zinc-950 to-black pointer-events-none" />

              {/* Left Speaker / Host Camera */}
              <div className="relative z-10 flex flex-col items-center opacity-80">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-base shadow-xl">
                  HOST
                </div>
                <span className="mt-2 text-[11px] font-semibold text-zinc-400">Host (Interviewer)</span>
              </div>

              {/* Center Podcast Table / Microphones */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="h-10 w-24 rounded-full bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-zinc-500">STUDIO DESK</span>
                </div>
              </div>

              {/* Right Speaker / Active Focus */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 p-0.5 shadow-2xl glow-amber">
                    <div className="w-full h-full rounded-[14px] bg-zinc-900 flex items-center justify-center text-white font-extrabold text-2xl relative overflow-hidden">
                      {clip.speaker.slice(0, 2).toUpperCase()}
                      {isPlaying && (
                        <div className="absolute bottom-1 inset-x-2 flex items-end justify-center gap-0.5 h-5">
                          {[40, 80, 50, 95, 60].map((h, i) => (
                            <div
                              key={i}
                              className="w-1 bg-amber-400 rounded-full animate-bounce"
                              style={{
                                height: `${(h * Math.sin((currentTime + i) * 3) + 50) % 100}%`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="absolute -bottom-2 inset-x-0 mx-auto w-max px-2 py-0.5 rounded-full bg-amber-400 text-black font-extrabold text-[9px] uppercase tracking-wider">
                    Speaking
                  </span>
                </div>
                <span className="mt-3 text-xs font-bold text-white">{clip.speaker}</span>
              </div>

              {/* 9:16 CROP WINDOW OVERLAY (Visual representation of vertical clipping) */}
              {showCropGuide && (
                <div
                  className={`absolute inset-y-1.5 ${getCropOffsetClass()} w-[26%] border-2 border-amber-400/90 rounded-xl bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.25)] pointer-events-none transition-all duration-300 flex flex-col justify-between p-2`}
                >
                  <div className="flex items-center justify-between text-[9px] font-bold text-amber-300 bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-sm">
                    <span>9:16 CROP</span>
                    <span>SHORTS CUT</span>
                  </div>
                  <div className="border border-dashed border-amber-400/40 rounded-lg flex-1 my-1" />
                  <div className="text-[9px] font-mono text-center text-amber-300/80 bg-black/60 px-1 rounded">
                    Safe Caption Zone
                  </div>
                </div>
              )}

              {/* Lower Third Captions for Landscape */}
              <div className="absolute bottom-4 inset-x-12 z-20 pointer-events-none text-center">
                <div className="inline-block px-4 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 max-w-[85%] shadow-2xl">
                  <p className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    {currentCaptionText}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 9:16 Crop Window Position Controller */}
          <div className="w-full mt-3 p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <MoveHorizontal className="h-4 w-4 text-amber-400" />
              <span>9:16 Crop Anchor Position:</span>
            </span>

            <div className="flex items-center gap-1.5">
              {[
                { id: 'auto' as CropPosition, label: 'Auto (Speaker)' },
                { id: 'left' as CropPosition, label: 'Left (Host)' },
                { id: 'center' as CropPosition, label: 'Center' },
                { id: 'right' as CropPosition, label: 'Right (Guest)' },
              ].map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => setCropPosition(pos.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                    cropPosition === pos.id
                      ? 'bg-amber-400 text-zinc-950 font-bold shadow'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SCRUBBER & TIMELINE BAR (Shared across both Portrait & Landscape) */}
      <div className="p-3.5 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <span className="text-amber-400 font-bold">{currentTime.toFixed(1)}s</span>
          <span className="text-zinc-500 font-sans text-[11px]">
            {clip.startTime} &rarr; {clip.endTime}
          </span>
          <span>{duration}s</span>
        </div>

        <input
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="w-full accent-amber-500 h-2 bg-zinc-800 rounded-lg cursor-pointer"
        />

        {/* Playback Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleTogglePlay}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shadow-lg transition-transform active:scale-95 cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
            </button>

            <button
              onClick={handleReset}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              title="Restart Clip"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={() => setIsMuted((v) => !v)}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Speed Toggles */}
          <div className="flex items-center bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-700/60 text-xs">
            {[1.0, 1.25, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  playbackSpeed === speed
                    ? 'bg-amber-500 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CAPTION STYLES */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>Dynamic Caption Preset</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'hormozi' as CaptionPreset, name: 'Hormozi Gold', desc: 'Bouncy, Yellow active', color: 'border-amber-500/60 text-amber-300' },
            { id: 'beast' as CaptionPreset, name: 'Beast Kinetic', desc: 'Neon green pop', color: 'border-emerald-500/60 text-emerald-300' },
            { id: 'minimal' as CaptionPreset, name: 'Minimal Box', desc: 'Clean Apple sub', color: 'border-zinc-500/60 text-white' },
            { id: 'neon' as CaptionPreset, name: 'Neon Cyber', desc: 'Glowing Cyan', color: 'border-cyan-500/60 text-cyan-300' },
          ].map((style) => (
            <button
              key={style.id}
              onClick={() => setCaptionPreset(style.id)}
              className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                captionPreset === style.id
                  ? `bg-zinc-800/90 ${style.color} ring-1 ring-amber-400/40 shadow-lg`
                  : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <p className="text-xs font-bold">{style.name}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{style.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

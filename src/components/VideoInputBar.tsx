import React, { useState, useEffect, useMemo } from 'react';
import {
  Link2,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { parseVideoUrl, SAMPLE_REEL_URLS } from '../utils/urlParser';

interface VideoInputBarProps {
  currentUrl: string;
  onSubmitUrl: (url: string) => void;
  isFetching: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const VideoInputBar: React.FC<VideoInputBarProps> = ({
  currentUrl,
  onSubmitUrl,
  isFetching,
  inputRef,
}) => {
  const [inputUrl, setInputUrl] = useState(currentUrl || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setInputUrl(currentUrl);
    setValidationError(null);
  }, [currentUrl]);

  const parsedInfo = useMemo(() => {
    if (!inputUrl.trim()) return null;
    return parseVideoUrl(inputUrl.trim());
  }, [inputUrl]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputUrl(val);
    if (validationError) setValidationError(null);
  };

  const handleClear = () => {
    setInputUrl('');
    setValidationError(null);
    inputRef?.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      setValidationError('Please paste a valid YouTube Shorts, Instagram Reel, Facebook Reel, or MP4 video link.');
      return;
    }

    const check = parseVideoUrl(trimmed);
    if (!check.isValid) {
      setValidationError(
        check.embedReason ||
          'Unsupported or invalid URL. Please enter a link from YouTube Shorts, Instagram Reels, Facebook Reels, or a direct MP4 file.'
      );
      return;
    }

    setValidationError(null);
    onSubmitUrl(trimmed);
  };

  return (
    <section
      id="downloader"
      className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl"
    >
      <div className="max-w-3xl space-y-1.5 mb-4">
        <h1
          className="text-xl sm:text-2xl font-extrabold text-white tracking-tight"
          style={{ textWrap: 'balance' }}
        >
          Download YouTube Shorts, Instagram Reels &amp; Facebook Reels
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          Paste any public video link below to preview in portrait (9:16) or widescreen (16:9) and download the MP4 video file directly to your device.
        </p>
      </div>

      {/* Single URL Input + Single Primary Submit Button */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="reelgrab-url-input" className="sr-only">
              Social Media Video URL
            </label>
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Link2 className="h-4 w-4 text-amber-400" />
            </div>
            <input
              ref={inputRef}
              id="reelgrab-url-input"
              type="url"
              value={inputUrl}
              onChange={handleInputChange}
              placeholder="https://www.youtube.com/shorts/... or https://www.instagram.com/reel/..."
              disabled={isFetching}
              className="w-full pl-11 pr-10 py-3.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 transition-colors font-mono"
            />
            {inputUrl.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear video URL"
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isFetching}
            className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Fetching Video...</span>
              </>
            ) : (
              <>
                <span>Fetch Video</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {/* Live Validation / Error Message */}
        {validationError ? (
          <div
            role="alert"
            className="flex items-center gap-2 text-xs text-rose-400 pt-1"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        ) : (
          parsedInfo && (
            <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
              {parsedInfo.isValid ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-white">
                    {parsedInfo.platformName}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="text-slate-400">
                    Ready for preview and MP4 download
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{parsedInfo.embedReason}</span>
                </div>
              )}
            </div>
          )
        )}
      </form>

      {/* Quick Test Platform Selector */}
      <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-400 mr-1">
          Quick test links:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {SAMPLE_REEL_URLS.map((sample) => {
            const isSelected = inputUrl.trim() === sample.url;
            return (
              <button
                key={sample.url}
                type="button"
                onClick={() => {
                  setInputUrl(sample.url);
                  setValidationError(null);
                  onSubmitUrl(sample.url);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-amber-400 border border-amber-400/40'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                {sample.name}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

import React from 'react';

export type ActiveAppPage = 'downloader' | 'studio' | 'editor';

interface HeaderProps {
  activePage: ActiveAppPage;
  onSelectPage: (page: ActiveAppPage) => void;
  onQuickPaste: () => void;
  downloadCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activePage,
  onSelectPage,
  onQuickPaste,
  downloadCount,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0B0F17]/95 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectPage('downloader');
          }}
          className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Reel<span className="text-amber-400">Grab</span>
        </a>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
        >
          <a
            href="#downloader"
            onClick={(e) => {
              e.preventDefault();
              onSelectPage('downloader');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activePage === 'downloader'
                ? 'text-white underline underline-offset-8 decoration-amber-400'
                : 'hover:text-white'
            }`}
          >
            Video Downloader
          </a>
          <a
            href="#ai-video-merger"
            onClick={(e) => {
              e.preventDefault();
              onSelectPage('studio');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activePage === 'studio'
                ? 'text-white underline underline-offset-8 decoration-amber-400'
                : 'hover:text-white'
            }`}
          >
            AI Video Merger
          </a>
          <a
            href="#capcut-ai-editor"
            onClick={(e) => {
              e.preventDefault();
              onSelectPage('editor');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activePage === 'editor'
                ? 'text-white underline underline-offset-8 decoration-amber-400'
                : 'hover:text-white'
            }`}
          >
            CapCut AI Editor
          </a>
          <a
            href="#history"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Recent Downloads {downloadCount > 0 ? `(${downloadCount})` : ''}
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          {activePage !== 'editor' ? (
            <button
              type="button"
              onClick={() => onSelectPage('editor')}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open CapCut AI Editor
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onSelectPage('downloader');
                setTimeout(onQuickPaste, 50);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Paste Video Link
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

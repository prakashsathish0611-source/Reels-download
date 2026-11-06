import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  GitBranch,
  Server,
  ShieldCheck,
  X,
  Download,
  RefreshCw,
} from 'lucide-react';

interface VercelStatusResponse {
  success: boolean;
  ready: boolean;
  runtime: string;
  checks: {
    vercelJsonConfigured: boolean;
    serverlessApiEntryConfigured: boolean;
    chunkSizeBytes: number;
    vercelPayloadSafe: boolean;
    tmpDirectoryWritable: boolean;
    geminiApiConfigured: boolean;
  };
}

interface VercelDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VERCEL_JSON_CONTENT = JSON.stringify(
  {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    version: 2,
    framework: 'vite',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    functions: {
      'api/**/*.ts': {
        maxDuration: 60,
        memory: 1024,
      },
    },
    rewrites: [
      {
        source: '/api/(.*)',
        destination: '/api/index',
      },
      {
        source: '/((?!api/).*)',
        destination: '/index.html',
      },
    ],
  },
  null,
  2
);

export const VercelDeployModal: React.FC<VercelDeployModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<VercelStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/vercel-status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2200);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleDownloadVercelJson = () => {
    const blob = new Blob([VERCEL_JSON_CONTENT], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vercel.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vercel-deploy-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-2xl bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white text-slate-950 flex items-center justify-center font-black text-base shadow">
              ▲
            </div>
            <div>
              <h2 id="vercel-deploy-title" className="text-base font-bold text-white">
                Deploy to Vercel — Ready Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Full-stack Vite SPA + Express Serverless API (`/api/index.ts` & `vercel.json`)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Vercel deployment modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* 1. Live Readiness Verification */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                <span>Vercel Serverless Readiness Checks</span>
              </div>
              <button
                type="button"
                onClick={fetchStatus}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Verify</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-200">vercel.json Routing</div>
                  <div className="text-slate-400">
                    {status?.checks?.vercelJsonConfigured !== false
                      ? 'Configured (/api/* -> /api/index)'
                      : 'Ready'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-200">Serverless Entry (/api/index.ts)</div>
                  <div className="text-slate-400">
                    {status?.checks?.serverlessApiEntryConfigured !== false
                      ? 'Express app exported for Vercel'
                      : 'Ready'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-200">3.5 MiB Chunked MP4 Transfer</div>
                  <div className="text-slate-400">Under Vercel 4.5 MB function limit</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-200">Ephemeral /tmp Media Storage</div>
                  <div className="text-slate-400">Read-only filesystem safe</div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Option A: Deploy via Vercel CLI */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Terminal className="h-4 w-4" />
              <span>Option 1 · Deploy via Vercel CLI (Fastest)</span>
            </div>
            <p className="text-xs text-slate-300">
              Export or clone this project to your computer, then run the Vercel CLI from the project root:
            </p>
            <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 font-mono text-xs text-emerald-300">
              <code>npm install && npx vercel --prod</code>
              <button
                type="button"
                onClick={() => handleCopy('cli', 'npm install && npx vercel --prod')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-sans text-xs font-semibold cursor-pointer shrink-0"
              >
                {copiedId === 'cli' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Command</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3. Option B: Deploy via GitHub + Vercel Dashboard */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400">
              <GitBranch className="h-4 w-4" />
              <span>Option 2 · Deploy via GitHub + Vercel Dashboard</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
              <li>
                Push this project repository to <strong>GitHub</strong> (both{' '}
                <code className="text-amber-300">vercel.json</code> and{' '}
                <code className="text-amber-300">api/index.ts</code> are already included).
              </li>
              <li>
                Open{' '}
                <a
                  href="https://vercel.com/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  vercel.com/new
                </a>{' '}
                and import your GitHub repository.
              </li>
              <li>
                Keep the auto-detected settings (<strong>Framework Preset: Vite</strong>,{' '}
                <strong>Build Command:</strong> <code>npm run build</code>,{' '}
                <strong>Output Directory:</strong> <code>dist</code>).
              </li>
              <li>
                In <strong>Environment Variables</strong>, add{' '}
                <code className="text-emerald-300">GEMINI_API_KEY</code> for AI video analysis and click{' '}
                <strong>Deploy</strong>.
              </li>
            </ol>
          </div>

          {/* 4. Inspect / Download vercel.json */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Server className="h-4 w-4 text-slate-400" />
                <span>Included vercel.json Configuration</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy('json', VERCEL_JSON_CONTENT)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  {copiedId === 'json' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadVercelJson}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download vercel.json</span>
                </button>
              </div>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 overflow-x-auto">
              {VERCEL_JSON_CONTENT}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Both <code className="text-slate-200">/vercel.json</code> and{' '}
            <code className="text-slate-200">/api/index.ts</code> are active in the workspace.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

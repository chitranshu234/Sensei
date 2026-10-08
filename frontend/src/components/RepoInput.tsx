import { useState } from 'react';
import { Icons } from './Icons';

interface Props {
  onSubmit: (url: string, branch?: string) => void;
  loading?: boolean;
}

const sampleRepos = [
  {
    name: 'Spring PetClinic',
    url: 'https://github.com/spring-projects/spring-petclinic',
    desc: 'Classic Spring Boot architecture',
  },
  {
    name: 'RealWorld Spring Boot',
    url: 'https://github.com/gothinkster/spring-boot-realworld-example-app',
    desc: 'JWT & Domain-Driven Design',
  },
];

export const RepoInput = ({ onSubmit, loading }: Props) => {
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim(), branch.trim() || undefined);
    }
  };

  return (
    <div className="glass-card p-6 sm:p-7 relative overflow-hidden">
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-500/15 border border-primary-500/30 text-primary-300">
            <Icons.GitHub size={17} />
          </div>
          <h2 className="text-xl font-bold font-display text-surface-900">Analyze Repository</h2>
        </div>
        <p className="text-xs text-surface-600 leading-relaxed">
          Submit any public GitHub repository URL. The engine clones the codebase, extracts AST classes, and builds your interactive architecture graph.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* URL Input */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
            GitHub Repository URL
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-surface-500">
              <Icons.Link size={16} />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full rounded-xl border border-surface-300 bg-surface-100 py-3 pl-10 pr-10 text-xs sm:text-sm text-surface-900 placeholder-surface-500 outline-none transition-all focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
              required
              disabled={loading}
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="absolute inset-y-0 right-3 flex items-center text-surface-500 hover:text-surface-900"
              >
                <Icons.X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-surface-500 hover:text-primary-600 transition-colors flex items-center gap-1.5 font-medium"
          >
            <Icons.ChevronRight
              size={13}
              className={`transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`}
            />
            <span>{showAdvanced ? 'Hide branch options' : 'Specify branch (optional)'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-surface-500">
                  <Icons.GitBranch size={14} />
                </div>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Branch name (default: main or master)"
                  className="w-full rounded-xl border border-surface-300 bg-surface-100 py-2.5 pl-9 pr-3 text-xs text-surface-900 placeholder-surface-500 outline-none transition-all focus:border-primary-500/50"
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="w-full rounded-xl bg-gradient-to-r from-primary-600 via-primary-500 to-accent-indigo py-3.5 font-bold text-xs sm:text-sm text-white transition-all hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span>Initiating AST Pipeline...</span>
            </>
          ) : (
            <>
              <Icons.Sparkles size={16} />
              <span>Start Codebase Analysis</span>
            </>
          )}
        </button>
      </form>

      {/* Quick Start Presets */}
      <div className="mt-6 pt-5 border-t border-surface-300">
        <p className="text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-2.5">
          Quick Start With Benchmarks:
        </p>
        <div className="grid grid-cols-1 gap-2">
          {sampleRepos.map((repo) => (
            <button
              key={repo.url}
              type="button"
              onClick={() => setUrl(repo.url)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-white hover:border-primary-500/25 transition-all text-left group shadow-sm"
            >
              <div className="truncate pr-2">
                <p className="text-xs font-semibold text-surface-900 group-hover:text-primary-600 transition-colors">
                  {repo.name}
                </p>
                <p className="text-[10px] text-surface-500 truncate">{repo.desc}</p>
              </div>
              <span className="text-[10px] text-primary-600 font-semibold px-2 py-0.5 rounded-md bg-primary-500/10 border border-primary-500/20 flex-shrink-0">
                Load
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

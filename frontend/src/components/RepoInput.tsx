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
    desc: 'JWT & domain-driven design',
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
    <div className="sheet p-6 sm:p-7">
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-ink-800 text-paper-50">
            <Icons.GitHub size={16} />
          </div>
          <h2 className="font-display text-xl text-ink-900">Analyze a repository</h2>
        </div>
        <p className="text-sm text-ink-500 leading-relaxed">
          Submit any public GitHub URL. The engine clones the repo, extracts the AST, and builds an
          interactive architecture graph.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block annotation mb-1.5">GitHub repository URL</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-ink-400">
              <Icons.Link size={15} />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="field pl-9 pr-9 font-mono text-xs sm:text-sm"
              required
              disabled={loading}
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="absolute inset-y-0 right-3 flex items-center text-ink-400 hover:text-ink-700"
              >
                <Icons.X size={14} />
              </button>
            )}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-ink-500 hover:text-vermilion-600 transition-colors flex items-center gap-1.5 font-medium"
          >
            <Icons.ChevronRight
              size={13}
              className={`transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`}
            />
            <span>{showAdvanced ? 'Hide branch option' : 'Specify a branch (optional)'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-2.5">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-ink-400">
                  <Icons.GitBranch size={14} />
                </div>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Branch (default: main or master)"
                  className="field py-2.5 pl-9 text-xs"
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading || !url.trim()} className="btn btn-primary w-full py-3">
          {loading ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              <span>Starting AST pipeline…</span>
            </>
          ) : (
            <>
              <Icons.Sparkles size={16} />
              <span>Start analysis</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-paper-400">
        <p className="annotation mb-2.5">Quick start</p>
        <div className="grid grid-cols-1 gap-2">
          {sampleRepos.map((repo) => (
            <button
              key={repo.url}
              type="button"
              onClick={() => setUrl(repo.url)}
              className="sheet sheet-interactive flex items-center justify-between gap-2 p-2.5 text-left group"
            >
              <div className="truncate pr-2">
                <p className="text-xs font-semibold text-ink-800 group-hover:text-vermilion-700 transition-colors">
                  {repo.name}
                </p>
                <p className="text-[10px] text-ink-400 truncate">{repo.desc}</p>
              </div>
              <span className="annotation text-vermilion-600 flex-shrink-0">Load</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

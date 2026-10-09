import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { RepoInput } from '../components/RepoInput';
import { Icons } from '../components/Icons';
import { Repository, RepoStatus } from '../types/repository';

const statusConfig: Record<RepoStatus, { bg: string; text: string; dot: string; label: string }> = {
  QUEUED: { bg: 'bg-paper-100 border-paper-400', text: 'text-ink-500', dot: 'bg-ink-300', label: 'Queued' },
  CLONING: { bg: 'bg-ochre-100 border-ochre-500/30', text: 'text-ochre-500', dot: 'bg-ochre-500', label: 'Cloning' },
  PARSING: { bg: 'bg-teal-100 border-teal-500/30', text: 'text-teal-600', dot: 'bg-teal-500', label: 'Parsing AST' },
  INDEXING: { bg: 'bg-violet-100 border-violet-500/30', text: 'text-violet-600', dot: 'bg-violet-500', label: 'Indexing' },
  READY: { bg: 'bg-green-100 border-green-600/30', text: 'text-green-600', dot: 'bg-green-600', label: 'Ready' },
  FAILED: { bg: 'bg-rose-100 border-rose-500/30', text: 'text-rose-500', dot: 'bg-rose-500', label: 'Failed' },
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const {
    repositories,
    loading,
    error,
    fetchRepositories,
    submitRepository,
    deleteRepository,
    clearError,
  } = useAppStore();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READY' | 'ACTIVE'>('ALL');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  // Poll while any repository is still processing.
  useEffect(() => {
    const hasActive = repositories.some((r) => !['READY', 'FAILED'].includes(r.status));
    if (!hasActive) return;
    const interval = setInterval(() => fetchRepositories(), 2500);
    return () => clearInterval(interval);
  }, [repositories, fetchRepositories]);

  const handleSubmit = async (url: string, branch?: string) => {
    const repo = await submitRepository(url, branch);
    if (repo) navigate(`/repo/${repo.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm('Remove this repository from your workspace?')) {
      setDeletingId(id);
      try {
        await deleteRepository(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const filteredRepos = useMemo(() => {
    return repositories.filter((r) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'READY') return r.status === 'READY';
      return !['READY', 'FAILED'].includes(r.status);
    });
  }, [repositories, statusFilter]);

  const metrics = useMemo(() => {
    const totalRepos = repositories.length;
    const readyRepos = repositories.filter((r) => r.status === 'READY').length;
    const totalFiles = repositories.reduce((acc, r) => acc + (r.totalFiles || 0), 0);
    const totalClasses = repositories.reduce((acc, r) => acc + (r.totalClasses || 0), 0);
    const totalRelationships = repositories.reduce((acc, r) => acc + (r.totalRelationships || 0), 0);
    return { totalRepos, readyRepos, totalFiles, totalClasses, totalRelationships };
  }, [repositories]);

  const statChips = [
    { label: 'Repositories', value: `${metrics.readyRepos}/${metrics.totalRepos}`, show: metrics.totalRepos > 0 },
    { label: 'Files parsed', value: metrics.totalFiles, show: metrics.totalFiles > 0 },
    { label: 'AST classes', value: metrics.totalClasses, show: metrics.totalClasses > 0 },
    { label: 'Relations', value: metrics.totalRelationships, show: metrics.totalRelationships > 0 },
  ].filter((c) => c.show);

  return (
    <div className="relative z-10 pb-16">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        {/* ── Hero ── */}
        <div className="mb-10 rise">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-paper-400">
            <div className="max-w-2xl">
              <p className="annotation mb-3">AST intelligence · layer architecture engine</p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-ink-900 leading-[1.05]">
                Codebase <span className="text-vermilion-600">intelligence</span>
              </h1>
              <p className="mt-3 text-sm sm:text-base text-ink-500 leading-relaxed">
                Connect a repository to parse class hierarchies, visualize Spring layers, and query
                code logic with verifiable citations.
              </p>
            </div>

            {statChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {statChips.map((c) => (
                  <div key={c.label} className="sheet px-3.5 py-2">
                    <p className="annotation">{c.label}</p>
                    <p className="font-mono text-base font-semibold text-ink-900 mt-0.5">{c.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-8 sheet border-rose-500/40 bg-rose-100/50 p-4 flex items-center gap-3">
            <Icons.AlertTriangle className="text-rose-500 flex-shrink-0" size={18} />
            <p className="text-sm text-rose-500 flex-1">{error}</p>
            <button onClick={clearError} className="text-rose-500 hover:text-ink-900 p-1 rounded-sm hover:bg-paper-200">
              <Icons.X size={16} />
            </button>
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-5">
            <RepoInput onSubmit={handleSubmit} loading={loading} />
          </div>

          <div className="lg:col-span-7">
            <div className="sheet p-5 sm:p-7">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-paper-400">
                <div>
                  <h2 className="font-display text-lg text-ink-900">Your workspaces</h2>
                  <p className="annotation normal-case tracking-normal mt-0.5">
                    {repositories.length === 1 ? '1 repository indexed' : `${repositories.length} repositories indexed`}
                  </p>
                </div>

                {repositories.length > 0 && (
                  <div className="flex rounded-sm border border-paper-400 bg-paper-100 p-0.5 text-xs self-start">
                    {(['ALL', 'READY', 'ACTIVE'] as const).map((key) => (
                      <button
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        className={`px-3 py-1 rounded-sm font-semibold transition-colors ${
                          statusFilter === key
                            ? 'bg-paper-50 text-ink-900 border border-paper-400'
                            : 'text-ink-400 hover:text-ink-700'
                        }`}
                      >
                        {key === 'ALL' ? 'All' : key === 'READY' ? 'Ready' : 'Active'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {repositories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-sm bg-paper-100 border border-paper-400 mb-4 text-ink-400">
                    <Icons.GitHub size={28} />
                  </div>
                  <h3 className="font-display text-base text-ink-900">No repositories yet</h3>
                  <p className="text-sm text-ink-500 mt-1 max-w-xs">
                    Paste a GitHub URL on the left to start extracting architecture and code patterns.
                  </p>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="py-12 text-center text-sm text-ink-400">No repositories match this filter.</div>
              ) : (
                <div className="space-y-3">
                  {filteredRepos.map((repo) => {
                    const st = statusConfig[repo.status] || statusConfig.QUEUED;
                    const isProcessing = !['READY', 'FAILED'].includes(repo.status);

                    return (
                      <div
                        key={repo.id}
                        onClick={() => navigate(`/repo/${repo.id}`)}
                        className="sheet sheet-interactive group p-4 sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <h3 className="text-base font-semibold text-ink-900 group-hover:text-vermilion-700 transition-colors truncate">
                                {repo.name}
                              </h3>
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${st.bg} ${st.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${st.dot} ${isProcessing ? 'pulse-mark' : ''}`} />
                                {st.label}
                              </span>
                              {repo.defaultBranch && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-ink-500 font-mono px-2 py-0.5 rounded-sm bg-paper-100">
                                  <Icons.GitBranch size={11} />
                                  {repo.defaultBranch}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-ink-400 font-mono truncate max-w-md">{repo.githubUrl}</p>

                            {repo.status === 'READY' && (
                              <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-paper-300 text-xs text-ink-500">
                                {repo.totalFiles != null && (
                                  <span className="flex items-center gap-1">
                                    <Icons.File size={13} className="text-teal-500" />
                                    <strong className="font-mono text-ink-800">{repo.totalFiles}</strong> files
                                  </span>
                                )}
                                {repo.totalClasses != null && (
                                  <span className="flex items-center gap-1">
                                    <Icons.Code size={13} className="text-violet-500" />
                                    <strong className="font-mono text-ink-800">{repo.totalClasses}</strong> classes
                                  </span>
                                )}
                                {repo.totalMethods != null && (
                                  <span className="flex items-center gap-1">
                                    <Icons.Cpu size={13} className="text-vermilion-500" />
                                    <strong className="font-mono text-ink-800">{repo.totalMethods}</strong> methods
                                  </span>
                                )}
                                {repo.totalRelationships != null && (
                                  <span className="flex items-center gap-1">
                                    <Icons.Architecture size={13} className="text-ochre-500" />
                                    <strong className="font-mono text-ink-800">{repo.totalRelationships}</strong> relations
                                  </span>
                                )}
                              </div>
                            )}

                            {repo.errorMessage && (
                              <p className="text-xs text-rose-500 mt-2 bg-rose-100/60 p-2 rounded-sm border border-rose-500/20">
                                {repo.errorMessage}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => handleDelete(e, repo.id)}
                              disabled={deletingId === repo.id}
                              className="p-2 rounded-sm text-ink-400 hover:text-rose-500 hover:bg-paper-200 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                              title="Delete repository"
                            >
                              <Icons.Trash size={15} />
                            </button>
                            <div className="p-2 text-ink-300 group-hover:text-vermilion-600 transition-colors">
                              <Icons.ArrowRight size={16} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Capabilities ── */}
        <div className="mt-14 pt-10 border-t border-paper-400">
          <div className="mb-8">
            <p className="annotation mb-2">Engine capabilities</p>
            <h2 className="font-display text-2xl text-ink-900">A purpose-built comprehension pipeline</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                icon: Icons.Architecture,
                title: 'Spring layer visualization',
                desc: 'A hierarchical AST dependency graph of Controllers, Services, Repositories, and Entities with injection-flow tracking.',
                accent: 'text-vermilion-600 bg-vermilion-100 border-vermilion-200',
              },
              {
                icon: Icons.Search,
                title: 'Semantic code index',
                desc: 'AST-aware chunking that preserves signatures and summaries, embedded into a vector store for retrieval.',
                accent: 'text-teal-600 bg-teal-100 border-teal-300/50',
              },
              {
                icon: Icons.Sparkles,
                title: 'Citation-grounded RAG',
                desc: 'LLM reasoning anchored to retrieved repository chunks, returning clickable file:line links into the source.',
                accent: 'text-violet-600 bg-violet-100 border-violet-400/40',
              },
            ].map((f) => {
              const IconComp = f.icon;
              return (
                <div key={f.title} className="sheet p-5 sm:p-6">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-sm border mb-4 ${f.accent}`}>
                    <IconComp size={22} />
                  </div>
                  <h3 className="font-display text-base text-ink-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-ink-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

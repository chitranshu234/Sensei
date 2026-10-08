import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { RepoInput } from '../components/RepoInput';
import { Icons } from '../components/Icons';
import { Repository, RepoStatus } from '../types/repository';

const statusConfig: Record<
  RepoStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  QUEUED: {
    bg: 'bg-surface-100 border-surface-300',
    text: 'text-surface-600',
    dot: 'bg-surface-400',
    label: 'Queued',
  },
  CLONING: {
    bg: 'bg-accent-amber/10 border-accent-amber/20',
    text: 'text-accent-amber',
    dot: 'bg-accent-amber',
    label: 'Cloning Repository',
  },
  PARSING: {
    bg: 'bg-accent-cyan/10 border-accent-cyan/20',
    text: 'text-accent-cyan',
    dot: 'bg-accent-cyan',
    label: 'Parsing AST',
  },
  INDEXING: {
    bg: 'bg-accent-violet/10 border-accent-violet/20',
    text: 'text-accent-violet',
    dot: 'bg-accent-violet',
    label: 'Indexing Vectors',
  },
  READY: {
    bg: 'bg-accent-emerald/10 border-accent-emerald/20',
    text: 'text-accent-emerald',
    dot: 'bg-accent-emerald',
    label: 'Ready',
  },
  FAILED: {
    bg: 'bg-accent-rose/10 border-accent-rose/20',
    text: 'text-accent-rose',
    dot: 'bg-accent-rose',
    label: 'Failed',
  },
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

  const [repoSearch, setRepoSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READY' | 'ACTIVE'>('ALL');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  // Poll for status updates if any repo is not READY or FAILED
  useEffect(() => {
    const hasActive = repositories.some((r) => !['READY', 'FAILED'].includes(r.status));
    if (!hasActive) return;

    const interval = setInterval(() => {
      fetchRepositories();
    }, 2500);
    return () => clearInterval(interval);
  }, [repositories, fetchRepositories]);

  const handleSubmit = async (url: string, branch?: string) => {
    try {
      const repo = await submitRepository(url, branch);
      navigate(`/repo/${(repo as Repository).id}`);
    } catch {
      // error handled in store
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to remove this repository from your workspace?')) {
      setDeletingId(id);
      try {
        await deleteRepository(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Filtered repositories
  const filteredRepos = useMemo(() => {
    return repositories.filter((r) => {
      const matchesSearch =
        !repoSearch ||
        r.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
        r.githubUrl.toLowerCase().includes(repoSearch.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'READY'
          ? r.status === 'READY'
          : !['READY', 'FAILED'].includes(r.status);

      return matchesSearch && matchesStatus;
    });
  }, [repositories, repoSearch, statusFilter]);

  // Aggregate metrics computed from real project data
  const metrics = useMemo(() => {
    const totalRepos = repositories.length;
    const readyRepos = repositories.filter((r) => r.status === 'READY').length;
    const totalFiles = repositories.reduce((acc, r) => acc + (r.totalFiles || 0), 0);
    const totalClasses = repositories.reduce((acc, r) => acc + (r.totalClasses || 0), 0);
    const totalRelationships = repositories.reduce(
      (acc, r) => acc + (r.totalRelationships || 0),
      0
    );

    return { totalRepos, readyRepos, totalFiles, totalClasses, totalRelationships };
  }, [repositories]);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        {/* ─── Hero Section ─── */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs font-semibold text-primary-300 mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan animate-pulse-dot" />
                AST Intelligence & Layer Architecture Engine
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display text-surface-900">
                Codebase <span className="gradient-text-accent">Intelligence</span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-surface-600 max-w-2xl leading-relaxed">
                Connect your repository to parse class hierarchies, visualize Spring layers, and query code logic with verifiable citations.
              </p>
            </div>

            {/* Quick Aggregate Stats Chips */}
            {metrics.totalRepos > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3.5 py-2 rounded-2xl bg-surface-100 border border-surface-300 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">
                    Repositories
                  </p>
                  <p className="text-base font-extrabold font-mono text-surface-900">
                    {metrics.readyRepos}
                    <span className="text-xs text-surface-500 font-normal">
                      /{metrics.totalRepos}
                    </span>
                  </p>
                </div>
                {metrics.totalFiles > 0 && (
                  <div className="px-3.5 py-2 rounded-2xl bg-surface-100 border border-surface-300 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">
                      Files Parsed
                    </p>
                    <p className="text-base font-extrabold font-mono text-accent-cyan">
                      {metrics.totalFiles}
                    </p>
                  </div>
                )}
                {metrics.totalClasses > 0 && (
                  <div className="px-3.5 py-2 rounded-2xl bg-surface-100 border border-surface-300 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">
                      AST Classes
                    </p>
                    <p className="text-base font-extrabold font-mono text-accent-violet">
                      {metrics.totalClasses}
                    </p>
                  </div>
                )}
                {metrics.totalRelationships > 0 && (
                  <div className="px-3.5 py-2 rounded-2xl bg-surface-100 border border-surface-300 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">
                      Relations
                    </p>
                    <p className="text-base font-extrabold font-mono text-accent-amber">
                      {metrics.totalRelationships}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Error banner ─── */}
        {error && (
          <div className="mb-8 rounded-2xl border border-accent-rose/30 bg-accent-rose/10 p-4 flex items-center gap-3 backdrop-blur-md">
            <Icons.AlertTriangle className="text-accent-rose flex-shrink-0" size={20} />
            <p className="text-sm text-accent-rose flex-1 font-medium">{error}</p>
            <button
              onClick={clearError}
              className="text-accent-rose hover:text-surface-900 transition-colors p-1.5 rounded-lg hover:bg-black/5"
            >
              <Icons.X size={16} />
            </button>
          </div>
        )}

        {/* ─── Main Grid: Input + Repositories ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Input Card (5 cols) */}
          <div className="lg:col-span-5">
            <RepoInput onSubmit={handleSubmit} loading={loading} />
          </div>

          {/* Right: Repository List (7 cols) */}
          <div className="lg:col-span-7">
            <div className="glass-card p-6 sm:p-7">
              {/* Header with Search and Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/5">
                <div>
                  <h2 className="text-lg font-bold font-display text-surface-900">Your Workspaces</h2>
                  <p className="text-xs text-surface-600">
                    {repositories.length === 1
                      ? '1 repository indexed'
                      : `${repositories.length} repositories indexed`}
                  </p>
                </div>

                {repositories.length > 0 && (
                  <div className="flex items-center gap-2">
                    {/* Status Tabs */}
                    <div className="flex p-0.5 rounded-xl bg-surface-100 border border-surface-300 text-xs">
                      <button
                        onClick={() => setStatusFilter('ALL')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          statusFilter === 'ALL'
                            ? 'bg-white text-surface-900 font-semibold shadow-sm'
                            : 'text-surface-500 hover:text-surface-800'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setStatusFilter('READY')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          statusFilter === 'READY'
                            ? 'bg-accent-emerald/10 text-accent-emerald font-semibold shadow-sm'
                            : 'text-surface-500 hover:text-surface-800'
                        }`}
                      >
                        Ready
                      </button>
                      <button
                        onClick={() => setStatusFilter('ACTIVE')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          statusFilter === 'ACTIVE'
                            ? 'bg-accent-violet/10 text-accent-violet font-semibold shadow-sm'
                            : 'text-surface-500 hover:text-surface-800'
                        }`}
                      >
                        Active
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Repositories Stream */}
              {repositories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-surface-100 border border-surface-300 mb-4 shadow-sm">
                    <Icons.GitHub className="text-surface-500" size={30} />
                  </div>
                  <h3 className="text-sm font-bold text-surface-900">No repositories analyzed yet</h3>
                  <p className="text-xs text-surface-600 mt-1 max-w-xs">
                    Provide a GitHub repository link on the left to start extracting architecture and code patterns.
                  </p>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="py-12 text-center text-xs text-surface-500">
                  No repositories match your active filter.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredRepos.map((repo) => {
                    const st = statusConfig[repo.status] || statusConfig.QUEUED;
                    const isProcessing = !['READY', 'FAILED'].includes(repo.status);

                    return (
                      <div
                        key={repo.id}
                        onClick={() => navigate(`/repo/${repo.id}`)}
                        className="group w-full relative rounded-2xl border border-surface-300 bg-white hover:bg-surface-100 hover:border-primary-500/50 p-5 text-left transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            {/* Repo Name & Status */}
                            <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                              <h3 className="text-base font-bold text-surface-900 group-hover:text-primary-600 transition-colors truncate">
                                {repo.name}
                              </h3>

                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${st.bg} ${st.text}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${st.dot} ${
                                    isProcessing ? 'animate-pulse-dot' : ''
                                  }`}
                                />
                                {st.label}
                              </span>

                              {repo.defaultBranch && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-surface-600 font-mono px-2 py-0.5 rounded-md bg-surface-100">
                                  <Icons.GitBranch size={11} />
                                  {repo.defaultBranch}
                                </span>
                              )}
                            </div>

                            {/* GitHub URL */}
                            <p className="text-xs text-surface-500 font-mono truncate max-w-md">
                              {repo.githubUrl}
                            </p>

                            {/* Metrics Strip */}
                            {repo.status === 'READY' && (
                              <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-surface-300 text-xs text-surface-600">
                                {repo.totalFiles != null && (
                                  <span className="flex items-center gap-1">
                                    <Icons.File size={13} className="text-accent-cyan" />
                                    <strong className="font-mono text-surface-900">{repo.totalFiles}</strong> files
                                  </span>
                                )}
                                {repo.totalClasses != null && (
                                  <span className="flex items-center gap-1">
                                    <Icons.Code size={13} className="text-accent-violet" />
                                    <strong className="font-mono text-surface-900">{repo.totalClasses}</strong> classes
                                  </span>
                                )}
                                {repo.totalMethods != null && (
                                  <span className="flex items-center gap-1">
                                    <Icons.Cpu size={13} className="text-primary-600" />
                                    <strong className="font-mono text-surface-900">{repo.totalMethods}</strong> methods
                                  </span>
                                )}
                                {repo.totalRelationships != null && (
                                  <span className="flex items-center gap-1">
                                    <Icons.Architecture size={13} className="text-accent-amber" />
                                    <strong className="font-mono text-surface-900">{repo.totalRelationships}</strong> relations
                                  </span>
                                )}
                              </div>
                            )}

                            {repo.errorMessage && (
                              <p className="text-xs text-accent-rose mt-2 bg-accent-rose/10 p-2 rounded-lg">
                                {repo.errorMessage}
                              </p>
                            )}
                          </div>

                          {/* Right Controls */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => handleDelete(e, repo.id)}
                              disabled={deletingId === repo.id}
                              className="p-2 rounded-xl text-surface-500 hover:text-accent-rose hover:bg-accent-rose/10 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete Repository"
                            >
                              <Icons.Trash size={15} />
                            </button>
                            <div className="p-2 rounded-xl text-surface-500 group-hover:text-primary-600 transition-colors">
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

        {/* ─── Platform Capabilities Showcase ─── */}
        <div className="mt-16 pt-12 border-t border-surface-300">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold font-display text-surface-900">Engine Capabilities</h2>
            <p className="text-xs text-surface-600 mt-1">
              Purpose-built analysis pipeline for enterprise architecture comprehension
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Icons.Architecture,
                title: 'Spring Layer Visualization',
                desc: 'Hierarchical AST dependency graph categorizing Controllers, Services, Repositories, and Entities with injection flow tracking.',
                color: 'text-accent-orange',
                bg: 'bg-accent-orange/10 border-accent-orange/20',
              },
              {
                icon: Icons.Search,
                title: 'Code Index & Semantic Vectors',
                desc: 'AST-aware chunking preserving method signatures and summaries embedded via local sentence-transformers in ChromaDB.',
                color: 'text-accent-cyan',
                bg: 'bg-accent-cyan/10 border-accent-cyan/20',
              },
              {
                icon: Icons.Sparkles,
                title: 'Citation-Grounded RAG',
                desc: 'Gemini reasoning anchored in retrieved repository chunks, providing verifiable file:line links directly into the source code viewer.',
                color: 'text-accent-violet',
                bg: 'bg-accent-violet/10 border-accent-violet/20',
              },
            ].map((f) => {
              const IconComp = f.icon;
              return (
                <div
                  key={f.title}
                  className="glass-card p-6 rounded-2xl border border-surface-300 hover:border-surface-400 transition-all bg-white"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ${f.bg} border mb-4`}
                  >
                    <IconComp className={f.color} size={22} />
                  </div>
                  <h3 className="text-sm font-bold text-surface-900 mb-1.5">{f.title}</h3>
                  <p className="text-xs text-surface-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

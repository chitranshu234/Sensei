import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppStore } from '../store/appStore';
import { api } from '../services/api';
import { CodeFile } from '../types/repository';
import { ArchitectureGraph as ArchGraphType } from '../types/architecture';
import { ArchitectureGraphView } from '../components/ArchitectureGraph';
import { FileExplorer } from '../components/FileExplorer';
import { CodeViewer } from '../components/CodeViewer';
import { ChatPanel } from '../components/ChatPanel';
import { LoadingState } from '../components/LoadingState';
import { Icons } from '../components/Icons';

type Tab = 'architecture' | 'files' | 'chat';

export const RepositoryPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const repoId = Number(id);

  const { currentRepo, fetchRepository, loading: storeLoading } = useAppStore();

  const [activeTab, setActiveTab] = useState<Tab>('architecture');
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [archGraph, setArchGraph] = useState<ArchGraphType | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [highlightLines, setHighlightLines] = useState<number[] | undefined>(undefined);
  const [loadingData, setLoadingData] = useState(false);

  // Chat preset prompt state (from Architecture node inspector "Ask AI")
  const [chatPresetPrompt, setChatPresetPrompt] = useState<string | undefined>(undefined);

  // Onboarding Guide Modal state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingGuide, setOnboardingGuide] = useState<string | null>(null);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);

  // Fetch repo on mount
  useEffect(() => {
    if (repoId) {
      fetchRepository(repoId);
    }
  }, [repoId, fetchRepository]);

  // Poll while not READY or FAILED
  useEffect(() => {
    if (!currentRepo || currentRepo.status === 'READY' || currentRepo.status === 'FAILED') return;
    const interval = setInterval(() => fetchRepository(repoId), 2500);
    return () => clearInterval(interval);
  }, [currentRepo?.status, repoId, fetchRepository]);

  // Load data once READY
  useEffect(() => {
    if (currentRepo?.status !== 'READY') return;

    const loadData = async () => {
      setLoadingData(true);
      try {
        const [filesData, archData] = await Promise.allSettled([
          api.getFiles(repoId),
          api.getArchitecture(repoId),
        ]);
        if (filesData.status === 'fulfilled') {
          const fileList = filesData.value as CodeFile[];
          setFiles(fileList);
          // Auto select first file if none selected
          if (fileList.length > 0 && !selectedFile) {
            handleFileSelect(fileList[0].filePath);
          }
        }
        if (archData.status === 'fulfilled') {
          const arch = archData.value as ArchGraphType;
          setArchGraph({
            nodes: arch?.nodes || [],
            edges: arch?.edges || []
          });
        }
      } catch {
        // partial data is acceptable
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, [currentRepo?.status, repoId]);

  // Load file content with line highlighting support
  const handleFileSelect = async (
    filePath: string,
    startLine?: number,
    endLine?: number
  ) => {
    setSelectedFile(filePath);
    if (startLine && endLine) {
      const lines: number[] = [];
      for (let i = startLine; i <= endLine; i++) lines.push(i);
      setHighlightLines(lines);
    } else {
      setHighlightLines(undefined);
    }

    try {
      const response = (await api.getFileContent(repoId, filePath)) as
        | { content?: string }
        | string;
      const text = typeof response === 'string' ? response : response?.content ?? '';
      setFileContent(text);
    } catch {
      setFileContent('// Failed to load file content');
    }
  };

  // Citation click from chat
  const handleCitationClick = (filePath: string, startLine: number, endLine: number) => {
    setActiveTab('files');
    handleFileSelect(filePath, startLine, endLine);
  };

  // Fetch Onboarding Guide
  const handleOpenOnboarding = async () => {
    setShowOnboarding(true);
    if (!onboardingGuide && !loadingOnboarding) {
      setLoadingOnboarding(true);
      try {
        const guide = (await api.generateOnboarding(repoId)) as
          | { guide?: string; content?: string }
          | string;
        const text =
          typeof guide === 'string'
            ? guide
            : guide?.guide || guide?.content || JSON.stringify(guide, null, 2);
        setOnboardingGuide(text);
      } catch {
        setOnboardingGuide('Unable to generate onboarding guide at this moment.');
      } finally {
        setLoadingOnboarding(false);
      }
    }
  };

  if (!currentRepo && storeLoading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 rounded-full border-2 border-primary-500/30 border-t-primary-500 animate-spin" />
          <p className="text-xs text-surface-600 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!currentRepo) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="glass-card p-8 text-center max-w-md w-full">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100 border border-surface-300 mx-auto mb-4">
            <Icons.Search className="text-surface-600" size={26} />
          </div>
          <h2 className="text-lg font-bold text-surface-900 mb-2">Repository Not Found</h2>
          <p className="text-xs text-surface-600 mb-6">
            The requested repository does not exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/')}
            className="pill-button bg-primary-500 hover:bg-primary-600 text-white mx-auto shadow-sm"
          >
            <Icons.ArrowRight size={14} className="rotate-180" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Pipeline Loading State
  if (currentRepo.status !== 'READY') {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="mx-auto max-w-3xl px-6">
          <button
            onClick={() => navigate('/')}
            className="mb-6 text-xs text-surface-600 hover:text-surface-900 transition-colors flex items-center gap-1.5 font-medium"
          >
            <Icons.ArrowRight size={14} className="rotate-180" />
            Back to Dashboard
          </button>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold font-display text-surface-900">{currentRepo.name}</h2>
              {currentRepo.defaultBranch && (
                <span className="text-[11px] font-mono text-surface-600 px-2 py-0.5 rounded-md bg-surface-100">
                  {currentRepo.defaultBranch}
                </span>
              )}
            </div>
            <p className="text-xs text-surface-600 font-mono mb-8 truncate">
              {currentRepo.githubUrl}
            </p>
            <LoadingState status={currentRepo.status} errorMessage={currentRepo.errorMessage} />
          </div>
        </div>
      </div>
    );
  }

  const tabs: {
    key: Tab;
    label: string;
    icon: React.FC<{ className?: string; size?: number }>;
    count?: number;
  }[] = [
    {
      key: 'architecture',
      label: 'Architecture Graph',
      icon: Icons.Architecture,
      count: archGraph?.nodes.length,
    },
    {
      key: 'files',
      label: 'Code Explorer',
      icon: Icons.Folder,
      count: files.length,
    },
    {
      key: 'chat',
      label: 'AI Intelligence',
      icon: Icons.Sparkles,
    },
  ];

  return (
    <div className="min-h-screen pt-16 flex flex-col">
      {/* ─── Sticky Workspace Header ─── */}
      <div className="border-b border-surface-300 bg-white/90 backdrop-blur-xl sticky top-16 z-30 shadow-sm">
        <div className="mx-auto max-w-[1700px] px-6 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left Repo Info */}
            <div className="flex items-center gap-3.5 min-w-0">
              <button
                onClick={() => navigate('/')}
                className="p-1.5 rounded-xl text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors flex-shrink-0"
                title="Back to Dashboard"
              >
                <Icons.ArrowRight size={16} className="rotate-180" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-surface-900 font-display truncate">
                    {currentRepo.name}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-accent-emerald/10 border border-accent-emerald/20 text-accent-emerald">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald animate-pulse" />
                    Ready
                  </span>
                  {currentRepo.defaultBranch && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-surface-600 font-mono px-2 py-0.5 rounded-md bg-surface-100 border border-surface-300">
                      <Icons.GitBranch size={11} />
                      {currentRepo.defaultBranch}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <a
                    href={currentRepo.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-surface-500 hover:text-primary-600 font-mono truncate flex items-center gap-1 transition-colors"
                  >
                    <span>{currentRepo.githubUrl}</span>
                    <Icons.ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>

            {/* Center / Right: Real AST Metrics & Onboarding Button */}
            <div className="flex items-center gap-2.5">
              {currentRepo.totalFiles != null && (
                <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-100 border border-surface-300 text-xs">
                  <span className="text-surface-600">Files:</span>
                  <span className="font-mono font-bold text-surface-900">{currentRepo.totalFiles}</span>
                </div>
              )}
              {currentRepo.totalClasses != null && (
                <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-100 border border-surface-300 text-xs">
                  <span className="text-surface-600">Classes:</span>
                  <span className="font-mono font-bold text-accent-violet">
                    {currentRepo.totalClasses}
                  </span>
                </div>
              )}
              {currentRepo.totalRelationships != null && (
                <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-100 border border-surface-300 text-xs">
                  <span className="text-surface-600">Relations:</span>
                  <span className="font-mono font-bold text-accent-amber">
                    {currentRepo.totalRelationships}
                  </span>
                </div>
              )}

              {/* Onboarding Guide Action */}
              <button
                onClick={handleOpenOnboarding}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-accent-violet/10 to-primary-500/10 border border-accent-violet/20 hover:border-accent-violet/40 text-accent-violet hover:text-accent-violet text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm bg-white"
              >
                <Icons.BookOpen size={14} />
                <span>Onboarding Guide</span>
              </button>
            </div>
          </div>

          {/* Tab Selector Strip */}
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-surface-300">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-primary-500/10 text-primary-600 border border-primary-500/20 shadow-sm'
                      : 'text-surface-500 hover:text-surface-900 hover:bg-surface-100'
                  }`}
                >
                  <TabIcon size={14} />
                  <span>{tab.label}</span>
                  {tab.count != null && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-primary-500/20 text-primary-600'
                          : 'bg-surface-100 text-surface-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Main Tab Workspace Area ─── */}
      <div className="flex-1 mx-auto max-w-[1700px] w-full p-6 flex flex-col">
        {loadingData && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-primary-500/30 border-t-primary-500 animate-spin" />
              <p className="text-xs text-surface-600">Loading codebase assets...</p>
            </div>
          </div>
        )}

        {/* Tab 1: Architecture Graph View */}
        {activeTab === 'architecture' && !loadingData && (
          <div
            className="flex-1 w-full flex flex-col"
            style={{
              height: 'calc(100vh - 215px)',
            }}
          >
            {archGraph && archGraph.nodes.length > 0 ? (
              <ArchitectureGraphView
                repoId={repoId}
                graph={archGraph}
                onNodeClick={(_nodeId, filePath) => {
                  if (filePath) {
                    setActiveTab('files');
                    handleFileSelect(filePath);
                  }
                }}
                onAskAboutNode={(nodeName, nodeType) => {
                  setActiveTab('chat');
                  setChatPresetPrompt(
                    `Explain the architectural purpose and dependencies of ${nodeName} (${nodeType}) in this codebase.`
                  );
                }}
              />
            ) : (
              <div className="glass-card flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                <Icons.Architecture className="text-surface-500" size={32} />
                <p className="text-xs text-surface-500">
                  Architecture graph is compiling or not yet available.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Files & Code Viewer */}
        {activeTab === 'files' && !loadingData && (
          <div
            className="flex-1 w-full flex flex-col md:flex-row gap-5"
            style={{
              height: 'calc(100vh - 215px)',
            }}
          >
            {/* File Explorer (320px) */}
            <div className="w-full md:w-80 flex-shrink-0 h-[40%] md:h-full">
              <FileExplorer
                files={files}
                onFileSelect={(path) => handleFileSelect(path)}
                selectedFile={selectedFile ?? undefined}
              />
            </div>

            {/* Code Viewer */}
            <div className="flex-1 h-[60%] md:h-full overflow-hidden">
              {selectedFile ? (
                <CodeViewer
                  filePath={selectedFile}
                  content={fileContent}
                  highlightLines={highlightLines}
                />
              ) : (
                <div className="glass-card h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-100 border border-surface-300 mb-3">
                    <Icons.File className="text-surface-500" size={24} />
                  </div>
                  <p className="text-xs text-surface-600">
                    Select a file from the explorer to inspect syntax and definitions
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: AI Chat */}
        {activeTab === 'chat' && !loadingData && (
          <div
            className="flex-1 w-full flex flex-col"
            style={{
              height: 'calc(100vh - 215px)',
            }}
          >
            <ChatPanel
              repoId={repoId}
              onCitationClick={handleCitationClick}
              presetPrompt={chatPresetPrompt}
              onClearPresetPrompt={() => setChatPresetPrompt(undefined)}
            />
          </div>
        )}
      </div>

      {/* ─── Onboarding Guide Modal ─── */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 bg-surface-200/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="glass-card w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-surface-300 shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-surface-300 flex items-center justify-between bg-white/90">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-violet/20 text-accent-violet border border-accent-violet/30">
                  <Icons.BookOpen size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-surface-900">Developer Onboarding Guide</h3>
                  <p className="text-[11px] text-surface-500">
                    AI-synthesized walkthrough of repository components and setup
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowOnboarding(false)}
                className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors"
              >
                <Icons.X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-surface-800">
              {loadingOnboarding ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-primary-500/30 border-t-primary-500 animate-spin" />
                  <p className="text-xs text-surface-600">
                    Generating repository onboarding documentation...
                  </p>
                </div>
              ) : onboardingGuide ? (
                <div className="prose prose-sm max-w-none text-surface-800">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{onboardingGuide}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-surface-600">No onboarding guide generated yet.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-surface-300 bg-white/90 flex items-center justify-between">
              <span className="text-[11px] text-surface-500">
                Grounded on repository AST & vector embeddings
              </span>
              <button
                onClick={() => setShowOnboarding(false)}
                className="px-4 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:bg-white text-xs font-semibold text-surface-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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

const PANEL_HEIGHT = 'h-[calc(100vh-16rem)] min-h-[520px]';

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

  const [chatPresetPrompt, setChatPresetPrompt] = useState<string | undefined>(undefined);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingGuide, setOnboardingGuide] = useState<string | null>(null);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);

  useEffect(() => {
    if (repoId) fetchRepository(repoId);
  }, [repoId, fetchRepository]);

  useEffect(() => {
    if (!currentRepo || currentRepo.status === 'READY' || currentRepo.status === 'FAILED') return;
    const interval = setInterval(() => fetchRepository(repoId), 2500);
    return () => clearInterval(interval);
  }, [currentRepo?.status, repoId, fetchRepository]);

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
          if (fileList.length > 0 && !selectedFile) {
            handleFileSelect(fileList[0].filePath);
          }
        }
        if (archData.status === 'fulfilled') {
          const arch = archData.value as ArchGraphType;
          setArchGraph({ nodes: arch?.nodes || [], edges: arch?.edges || [] });
        }
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, [currentRepo?.status, repoId]);

  const handleFileSelect = async (filePath: string, startLine?: number, endLine?: number) => {
    setSelectedFile(filePath);
    if (startLine && endLine) {
      const lines: number[] = [];
      for (let i = startLine; i <= endLine; i++) lines.push(i);
      setHighlightLines(lines);
    } else {
      setHighlightLines(undefined);
    }

    try {
      const response = (await api.getFileContent(repoId, filePath)) as { content?: string } | string;
      const text = typeof response === 'string' ? response : response?.content ?? '';
      setFileContent(text);
    } catch {
      setFileContent('// Failed to load file content');
    }
  };

  const handleCitationClick = (filePath: string, startLine: number, endLine: number) => {
    setActiveTab('files');
    handleFileSelect(filePath, startLine, endLine);
  };

  const handleOpenOnboarding = async () => {
    setShowOnboarding(true);
    if (!onboardingGuide && !loadingOnboarding) {
      setLoadingOnboarding(true);
      try {
        const guide = (await api.generateOnboarding(repoId)) as { guide?: string; content?: string } | string;
        const text =
          typeof guide === 'string' ? guide : guide?.guide || guide?.content || JSON.stringify(guide, null, 2);
        setOnboardingGuide(text);
      } catch {
        setOnboardingGuide('Unable to generate an onboarding guide right now.');
      } finally {
        setLoadingOnboarding(false);
      }
    }
  };

  if (!currentRepo && storeLoading) {
    return (
      <div className="relative z-10 pt-24 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-vermilion-200 border-t-vermilion-500 animate-spin" />
          <p className="annotation">Loading workspace</p>
        </div>
      </div>
    );
  }

  if (!currentRepo) {
    return (
      <div className="relative z-10 pt-24 flex items-center justify-center px-4">
        <div className="sheet sheet-raised p-8 text-center max-w-md w-full">
          <div className="flex h-14 w-14 items-center justify-center rounded-sm bg-paper-100 border border-paper-400 mx-auto mb-4 text-ink-400">
            <Icons.Search size={26} />
          </div>
          <h2 className="font-display text-lg text-ink-900 mb-2">Repository not found</h2>
          <p className="text-sm text-ink-500 mb-6">
            This repository does not exist or has been removed.
          </p>
          <button onClick={() => navigate('/')} className="btn btn-primary mx-auto">
            <Icons.ArrowRight size={14} className="rotate-180" />
            Back to workspace
          </button>
        </div>
      </div>
    );
  }

  if (currentRepo.status !== 'READY') {
    return (
      <div className="relative z-10 pt-10 pb-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost mb-6 px-2"
          >
            <Icons.ArrowRight size={14} className="rotate-180" />
            Back to workspace
          </button>
          <div className="sheet p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-display text-xl text-ink-900">{currentRepo.name}</h2>
              {currentRepo.defaultBranch && (
                <span className="text-[11px] font-mono text-ink-500 px-2 py-0.5 rounded-sm bg-paper-100">
                  {currentRepo.defaultBranch}
                </span>
              )}
            </div>
            <p className="text-xs text-ink-400 font-mono mb-8 truncate">{currentRepo.githubUrl}</p>
            <LoadingState status={currentRepo.status} errorMessage={currentRepo.errorMessage} />
          </div>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.FC<{ className?: string; size?: number }>; count?: number }[] = [
    { key: 'architecture', label: 'Architecture', icon: Icons.Architecture, count: archGraph?.nodes.length },
    { key: 'files', label: 'Code explorer', icon: Icons.Folder, count: files.length },
    { key: 'chat', label: 'AI intelligence', icon: Icons.Sparkles },
  ];

  return (
    <div className="relative z-10 flex flex-col">
      {/* ── Sticky workspace header ── */}
      <div className="border-b border-paper-400 bg-paper-50/95 backdrop-blur-sm sticky top-14 z-30">
        <div className="mx-auto max-w-[1700px] px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate('/')}
                className="p-1.5 rounded-sm text-ink-400 hover:text-ink-900 hover:bg-paper-200 transition-colors flex-shrink-0"
                title="Back to workspace"
              >
                <Icons.ArrowRight size={16} className="rotate-180" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-base sm:text-lg text-ink-900 truncate">{currentRepo.name}</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-100 border border-green-600/30 text-green-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                    Ready
                  </span>
                  {currentRepo.defaultBranch && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-ink-500 font-mono px-2 py-0.5 rounded-sm bg-paper-100 border border-paper-400">
                      <Icons.GitBranch size={11} />
                      {currentRepo.defaultBranch}
                    </span>
                  )}
                </div>
                <a
                  href={currentRepo.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-ink-400 hover:text-vermilion-600 font-mono truncate flex items-center gap-1 transition-colors mt-0.5"
                >
                  <span className="truncate">{currentRepo.githubUrl}</span>
                  <Icons.ExternalLink size={11} className="flex-shrink-0" />
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentRepo.totalClasses != null && (
                <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-sm bg-paper-100 border border-paper-400 text-xs">
                  <span className="text-ink-500">Classes</span>
                  <span className="font-mono font-semibold text-violet-600">{currentRepo.totalClasses}</span>
                </div>
              )}
              {currentRepo.totalRelationships != null && (
                <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-sm bg-paper-100 border border-paper-400 text-xs">
                  <span className="text-ink-500">Relations</span>
                  <span className="font-mono font-semibold text-ochre-500">{currentRepo.totalRelationships}</span>
                </div>
              )}
              <button onClick={handleOpenOnboarding} className="btn btn-secondary px-3 py-1.5 text-xs">
                <Icons.BookOpen size={14} />
                <span className="hidden sm:inline">Onboarding guide</span>
                <span className="sm:hidden">Guide</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="tab-strip mt-3 border-b-0 -mb-3">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`tab ${isActive ? 'tab-active' : ''}`}
                >
                  <TabIcon size={14} />
                  <span>{tab.label}</span>
                  {tab.count != null && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-paper-200 text-ink-500">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 mx-auto max-w-[1700px] w-full px-4 sm:px-6 py-5 flex flex-col">
        {loadingData && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-vermilion-200 border-t-vermilion-500 animate-spin" />
              <p className="annotation">Loading codebase assets</p>
            </div>
          </div>
        )}

        {activeTab === 'architecture' && !loadingData && (
          <div className={`flex-1 w-full flex flex-col ${PANEL_HEIGHT}`}>
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
              <div className="sheet flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                <Icons.Architecture className="text-ink-300" size={32} />
                <p className="text-sm text-ink-400">Architecture graph is compiling or unavailable.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && !loadingData && (
          <div className={`flex-1 w-full flex flex-col md:flex-row gap-4 ${PANEL_HEIGHT}`}>
            <div className="w-full md:w-80 flex-shrink-0 h-[40%] md:h-full">
              <FileExplorer files={files} onFileSelect={(path) => handleFileSelect(path)} selectedFile={selectedFile ?? undefined} />
            </div>
            <div className="flex-1 h-[60%] md:h-full overflow-hidden">
              {selectedFile ? (
                <CodeViewer filePath={selectedFile} content={fileContent} highlightLines={highlightLines} />
              ) : (
                <div className="sheet h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-paper-100 border border-paper-400 mb-3 text-ink-400">
                    <Icons.File size={24} />
                  </div>
                  <p className="text-sm text-ink-500">Select a file from the explorer to inspect it.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chat' && !loadingData && (
          <div className={`flex-1 w-full flex flex-col ${PANEL_HEIGHT}`}>
            <ChatPanel
              repoId={repoId}
              onCitationClick={handleCitationClick}
              presetPrompt={chatPresetPrompt}
              onClearPresetPrompt={() => setChatPresetPrompt(undefined)}
            />
          </div>
        )}
      </div>

      {/* ── Onboarding modal ── */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="sheet sheet-raised w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-paper-400 flex items-center justify-between bg-paper-50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-violet-100 text-violet-600 border border-violet-400/40 flex-shrink-0">
                  <Icons.BookOpen size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-sm text-ink-900 truncate">Developer onboarding guide</h3>
                  <p className="annotation normal-case tracking-normal truncate">
                    AI walkthrough grounded on the repository
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOnboarding(false)}
                className="p-1.5 rounded-sm text-ink-400 hover:text-ink-900 hover:bg-paper-200 transition-colors flex-shrink-0"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto text-sm leading-relaxed text-ink-700">
              {loadingOnboarding ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-vermilion-200 border-t-vermilion-500 animate-spin" />
                  <p className="annotation">Generating onboarding documentation</p>
                </div>
              ) : onboardingGuide ? (
                <div className="md-body max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{onboardingGuide}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-ink-500">No onboarding guide generated yet.</p>
              )}
            </div>

            <div className="px-5 sm:px-6 py-3 border-t border-paper-400 bg-paper-50 flex items-center justify-between">
              <span className="annotation normal-case tracking-normal">Grounded on AST & embeddings</span>
              <button onClick={() => setShowOnboarding(false)} className="btn btn-secondary px-4 py-1.5 text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { RepoStatus } from '../types/repository';
import { Icons } from './Icons';

interface Props {
  status: RepoStatus;
  errorMessage?: string;
}

const steps: {
  key: RepoStatus;
  label: string;
  desc: string;
  icon: React.FC<{ className?: string; size?: number }>;
}[] = [
  {
    key: 'QUEUED',
    label: 'Queued in Engine',
    desc: 'Waiting for worker process allocation',
    icon: Icons.Clock,
  },
  {
    key: 'CLONING',
    label: 'Cloning Repository',
    desc: 'Fetching Git tree from GitHub',
    icon: Icons.Download,
  },
  {
    key: 'PARSING',
    label: 'Parsing Code AST',
    desc: 'Extracting classes, components, functions, and relationships',
    icon: Icons.Microscope,
  },
  {
    key: 'INDEXING',
    label: 'Vector Embedding & Indexing',
    desc: 'Generating sentence-transformer embeddings in ChromaDB',
    icon: Icons.Brain,
  },
  {
    key: 'READY',
    label: 'Workspace Ready',
    desc: 'Architecture graph and semantic search are live',
    icon: Icons.Check,
  },
];

const statusOrder: Record<RepoStatus, number> = {
  QUEUED: 0,
  CLONING: 1,
  PARSING: 2,
  INDEXING: 3,
  READY: 4,
  FAILED: -1,
};

export const LoadingState = ({ status, errorMessage }: Props) => {
  if (status === 'FAILED') {
    return (
      <div className="glass-card p-6 border-accent-rose/30 bg-accent-rose/5 rounded-2xl">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-rose/15 text-accent-rose flex-shrink-0">
            <Icons.AlertCircle size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-accent-rose">Repository Analysis Failed</h3>
            <p className="text-xs text-surface-600 mt-1 leading-relaxed">
              {errorMessage ||
                'The analysis pipeline encountered an error. Please verify the repository URL and check that your backend services are active.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentStep = statusOrder[status];
  const progressPercent = Math.min(100, Math.round(((currentStep + 0.5) / steps.length) * 100));

  return (
    <div className="glass-card p-6 sm:p-7 rounded-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold font-display text-surface-900">Pipeline Processing</h3>
          <p className="text-xs text-surface-600">
            Automated AST analysis and vectorization in progress
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-primary-600 px-2.5 py-1 rounded-lg bg-primary-500/10 border border-primary-500/20">
          {progressPercent}%
        </span>
      </div>

      <div className="space-y-3.5">
        {steps.map((step) => {
          const stepIdx = statusOrder[step.key];
          const isComplete = stepIdx < currentStep;
          const isCurrent = stepIdx === currentStep;
          const IconComp = step.icon;

          return (
            <div
              key={step.key}
              className={`flex items-center gap-3.5 p-3 rounded-xl border transition-all ${
                isCurrent
                  ? 'bg-primary-500/10 border-primary-500/30 shadow-sm'
                  : isComplete
                  ? 'bg-surface-100 border-surface-300'
                  : 'bg-white border-transparent opacity-40'
              }`}
            >
              {/* Step indicator */}
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all flex-shrink-0 ${
                  isComplete
                    ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                    : isCurrent
                    ? 'bg-primary-500/20 text-primary-600 border border-primary-500/40 animate-pulse-dot'
                    : 'bg-surface-100 border border-surface-300 text-surface-500'
                }`}
              >
                {isComplete ? <Icons.Check size={16} /> : <IconComp size={16} />}
              </div>

              {/* Label & Description */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-bold truncate ${
                    isComplete
                      ? 'text-accent-emerald'
                      : isCurrent
                      ? 'text-surface-900'
                      : 'text-surface-500'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[11px] text-surface-600 truncate">{step.desc}</p>
              </div>

              {/* Status Badge */}
              {isCurrent && (
                <span className="rounded-full bg-primary-500/20 text-primary-600 border border-primary-500/30 px-2.5 py-0.5 text-[10px] font-bold flex-shrink-0">
                  Running
                </span>
              )}
              {isComplete && (
                <span className="rounded-full bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 px-2.5 py-0.5 text-[10px] font-bold flex-shrink-0">
                  Done
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-6 h-2 rounded-full bg-surface-200 overflow-hidden border border-surface-300">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-600 via-primary-500 to-accent-cyan transition-all duration-700 ease-out shadow-sm"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

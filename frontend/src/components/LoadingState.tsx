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
  { key: 'QUEUED', label: 'Queued in engine', desc: 'Waiting for a worker in the ingestion pool', icon: Icons.Clock },
  { key: 'CLONING', label: 'Cloning repository', desc: 'Fetching the Git tree from GitHub', icon: Icons.Download },
  { key: 'PARSING', label: 'Parsing code AST', desc: 'Extracting classes, members, and relationships', icon: Icons.Microscope },
  { key: 'INDEXING', label: 'Vector embedding & indexing', desc: 'Embedding chunks into the vector store', icon: Icons.Brain },
  { key: 'READY', label: 'Workspace ready', desc: 'Architecture graph and semantic search are live', icon: Icons.Check },
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
      <div className="sheet p-6 border-rose-500/40 bg-rose-100/50">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-rose-100 text-rose-500 border border-rose-500/30 flex-shrink-0">
            <Icons.AlertCircle size={22} />
          </div>
          <div>
            <h3 className="font-display text-base text-rose-500">Repository analysis failed</h3>
            <p className="text-sm text-ink-600 mt-1 leading-relaxed">
              {errorMessage ||
                'The pipeline hit an error. Verify the repository URL and that the backend and AI services are running.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentStep = statusOrder[status];
  const progressPercent = Math.min(100, Math.round(((currentStep + 0.5) / steps.length) * 100));

  return (
    <div className="sheet p-6 sm:p-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-lg text-ink-900">Pipeline processing</h3>
          <p className="annotation normal-case tracking-normal mt-0.5">
            AST analysis and vectorization in progress
          </p>
        </div>
        <span className="font-mono text-sm font-semibold text-vermilion-700 px-2.5 py-1 rounded-sm bg-vermilion-100 border border-vermilion-200">
          {progressPercent}%
        </span>
      </div>

      <div className="space-y-2.5">
        {steps.map((step) => {
          const stepIdx = statusOrder[step.key];
          const isComplete = stepIdx < currentStep;
          const isCurrent = stepIdx === currentStep;
          const IconComp = step.icon;

          return (
            <div
              key={step.key}
              className={`flex items-center gap-3.5 p-3 rounded-sm border transition-colors ${
                isCurrent
                  ? 'bg-vermilion-100/60 border-vermilion-200'
                  : isComplete
                  ? 'bg-paper-100 border-paper-400'
                  : 'bg-paper-50 border-transparent opacity-45'
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-sm flex-shrink-0 border ${
                  isComplete
                    ? 'bg-green-100 text-green-600 border-green-600/30'
                    : isCurrent
                    ? 'bg-vermilion-100 text-vermilion-600 border-vermilion-200 pulse-mark'
                    : 'bg-paper-100 text-ink-400 border-paper-400'
                }`}
              >
                {isComplete ? <Icons.Check size={16} /> : <IconComp size={16} />}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold truncate ${
                    isComplete ? 'text-green-600' : isCurrent ? 'text-ink-900' : 'text-ink-400'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-ink-500 truncate">{step.desc}</p>
              </div>

              {isCurrent && (
                <span className="annotation text-vermilion-600 flex-shrink-0">Running</span>
              )}
              {isComplete && (
                <span className="annotation text-green-600 flex-shrink-0">Done</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 h-1.5 rounded-full bg-paper-200 overflow-hidden border border-paper-400">
        <div
          className="h-full bg-vermilion-500 transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

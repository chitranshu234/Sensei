import { useState, useMemo } from 'react';
import { CodeFile } from '../types/repository';
import { Icons } from './Icons';

interface Props {
  files: CodeFile[];
  onFileSelect: (filePath: string) => void;
  selectedFile?: string;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: CodeFile;
}

function buildTree(files: CodeFile[]): TreeNode {
  const root: TreeNode = { name: 'root', path: '', isDir: true, children: [] };

  files.forEach((file) => {
    const parts = file.filePath.split('/');
    let current = root;

    parts.forEach((part, idx) => {
      const isLast = idx === parts.length - 1;
      let child = current.children.find((c) => c.name === part);

      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, idx + 1).join('/'),
          isDir: !isLast,
          children: [],
          file: isLast ? file : undefined,
        };
        current.children.push(child);
      }
      current = child;
    });
  });

  const sortTree = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortTree);
  };
  sortTree(root);

  return root;
}

const TreeItem = ({
  node,
  depth,
  onFileSelect,
  selectedFile,
}: {
  node: TreeNode;
  depth: number;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
}) => {
  const [open, setOpen] = useState(depth < 3);
  const isSelected = selectedFile === node.path;

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-colors hover:bg-black/5 group"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <Icons.ChevronRight
            size={11}
            className={`text-surface-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
          {open ? (
            <Icons.FolderOpen size={14} className="text-accent-amber flex-shrink-0" />
          ) : (
            <Icons.Folder size={14} className="text-accent-amber flex-shrink-0" />
          )}
          <span className="text-surface-700 group-hover:text-surface-900 transition-colors truncate font-medium">
            {node.name}
          </span>
          <span className="ml-auto text-[10px] text-surface-500 font-mono">
            {node.children.length}
          </span>
        </button>
        {open &&
          node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          ))}
      </div>
    );
  }

  const ext = node.name.split('.').pop()?.toLowerCase();
  const getFileBadgeColor = () => {
    switch (ext) {
      case 'java':
        return 'text-accent-orange';
      case 'py':
        return 'text-accent-cyan';
      case 'ts':
      case 'tsx':
      case 'js':
        return 'text-accent-violet';
      case 'xml':
      case 'yml':
      case 'yaml':
        return 'text-accent-amber';
      default:
        return 'text-surface-400';
    }
  };

  return (
    <button
      onClick={() => onFileSelect(node.path)}
      className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-all ${
        isSelected
          ? 'bg-primary-500/10 text-primary-600 font-semibold border border-primary-500/30'
          : 'text-surface-600 hover:text-surface-900 hover:bg-black/5'
      }`}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
    >
      <Icons.File size={13} className={`${getFileBadgeColor()} flex-shrink-0`} />
      <span className="truncate font-mono text-[11.5px]">{node.name}</span>
      {node.file && (
        <span className="ml-auto text-[10px] font-mono text-surface-500 px-1 py-0.5 rounded bg-surface-100">
          {node.file.lineCount}L
        </span>
      )}
    </button>
  );
};

export const FileExplorer = ({ files, onFileSelect, selectedFile }: Props) => {
  const [search, setSearch] = useState('');

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files;
    const q = search.toLowerCase();
    return files.filter((f) => f.filePath.toLowerCase().includes(q));
  }, [files, search]);

  const tree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);

  return (
    <div className="glass-card flex flex-col h-full overflow-hidden border border-surface-300">
      {/* Header */}
      <div className="p-3.5 border-b border-surface-300 bg-white/90 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-surface-800">
            Repository Files
          </h3>
          <span className="text-[11px] font-mono text-surface-600">
            {filteredFiles.length} / {files.length}
          </span>
        </div>

        <div className="relative">
          <Icons.Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter files..."
            className="w-full rounded-xl border border-surface-300 bg-surface-100 pl-8 pr-7 py-1.5 text-xs text-surface-900 placeholder-surface-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-800"
            >
              <Icons.X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tree Stream */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {tree.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={0}
            onFileSelect={onFileSelect}
            selectedFile={selectedFile}
          />
        ))}

        {filteredFiles.length === 0 && (
          <div className="text-center py-10 text-xs text-surface-500">
            No matching files found
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-surface-300 bg-white/90 text-[11px] text-surface-500 flex items-center justify-between">
        <span>Click any file to inspect code</span>
      </div>
    </div>
  );
};

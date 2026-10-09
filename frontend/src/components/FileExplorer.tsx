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

const fileColor = (name: string): string => {
  switch (name.split('.').pop()?.toLowerCase()) {
    case 'java':
      return 'text-vermilion-500';
    case 'py':
      return 'text-teal-500';
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return 'text-violet-500';
    case 'xml':
    case 'yml':
    case 'yaml':
    case 'json':
      return 'text-ochre-500';
    default:
      return 'text-ink-300';
  }
};

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
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-paper-200 group"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <Icons.ChevronRight
            size={11}
            className={`text-ink-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
          {open ? (
            <Icons.FolderOpen size={14} className="text-ochre-500 flex-shrink-0" />
          ) : (
            <Icons.Folder size={14} className="text-ochre-500 flex-shrink-0" />
          )}
          <span className="text-ink-700 group-hover:text-ink-900 transition-colors truncate font-medium">
            {node.name}
          </span>
          <span className="ml-auto text-[10px] text-ink-400 font-mono">{node.children.length}</span>
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

  return (
    <button
      onClick={() => onFileSelect(node.path)}
      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
        isSelected
          ? 'bg-vermilion-100 text-vermilion-700 font-semibold'
          : 'text-ink-600 hover:text-ink-900 hover:bg-paper-200'
      }`}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
    >
      <Icons.File size={13} className={`${fileColor(node.name)} flex-shrink-0`} />
      <span className="truncate font-mono text-[11.5px]">{node.name}</span>
      {node.file && (
        <span className="ml-auto text-[10px] font-mono text-ink-400 px-1 py-0.5 rounded-sm bg-paper-100">
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
    <div className="sheet flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-paper-400 bg-paper-100">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="annotation">Repository files</h3>
          <span className="text-[11px] font-mono text-ink-400">
            {filteredFiles.length} / {files.length}
          </span>
        </div>

        <div className="relative">
          <Icons.Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter files…"
            className="field py-1.5 pl-8 pr-7 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
            >
              <Icons.X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
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
          <div className="text-center py-10 text-xs text-ink-400">No matching files</div>
        )}
      </div>
    </div>
  );
};

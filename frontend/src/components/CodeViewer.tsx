import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Icons } from './Icons';

interface Props {
  filePath: string;
  content: string;
  lineCount?: number;
  highlightLines?: number[];
}

export const CodeViewer = ({ filePath, content, lineCount, highlightLines }: Props) => {
  const [copied, setCopied] = useState(false);
  const fileName = filePath.split('/').pop() || filePath;
  const extension = fileName.split('.').pop() || '';

  const langMap: Record<string, string> = {
    java: 'java',
    py: 'python',
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    properties: 'properties',
    gradle: 'groovy',
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const calculatedLines = lineCount || (content ? content.split('\n').length : 0);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white rounded-2xl border border-surface-300 shadow-sm">
      {/* File Header Bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-300 bg-surface-100 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan flex-shrink-0">
            <Icons.Code size={13} />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-mono font-semibold text-surface-900 truncate block">
              {filePath}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {calculatedLines > 0 && (
            <span className="text-[11px] font-mono text-surface-600 px-2 py-0.5 rounded-md bg-surface-200">
              {calculatedLines} lines
            </span>
          )}

          <span className="text-[10px] font-mono uppercase font-bold text-primary-600 px-2 py-0.5 rounded-md bg-primary-500/10 border border-primary-500/20">
            {extension || 'text'}
          </span>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-black/5 transition-colors flex items-center gap-1 text-xs"
            title="Copy code to clipboard"
          >
            {copied ? (
              <Icons.Check size={14} className="text-accent-emerald" />
            ) : (
              <Icons.Copy size={14} />
            )}
            <span className="text-[11px] hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div className="flex-1 overflow-auto bg-[#FAFAFA] text-xs">
        <SyntaxHighlighter
          language={langMap[extension.toLowerCase()] || 'text'}
          style={oneLight}
          showLineNumbers
          wrapLines
          customStyle={{
            margin: 0,
            padding: '16px',
            background: 'transparent',
            fontSize: '12.5px',
            lineHeight: '1.65',
            fontFamily: 'JetBrains Mono, monospace',
          }}
          lineNumberStyle={{
            color: '#475569',
            fontSize: '11px',
            paddingRight: '16px',
            userSelect: 'none',
          }}
          lineProps={(lineNumber) => {
            const isHighlighted = highlightLines?.includes(lineNumber);
            return {
              style: {
                backgroundColor: isHighlighted ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                display: 'block',
                paddingLeft: '8px',
                borderLeft: isHighlighted ? '3px solid #818cf8' : '3px solid transparent',
              },
            };
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

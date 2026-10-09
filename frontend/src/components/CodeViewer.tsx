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

export const CodeViewer = ({ filePath, content, lineCount, highlightLines }: Props) => {
  const [copied, setCopied] = useState(false);
  const fileName = filePath.split('/').pop() || filePath;
  const extension = fileName.split('.').pop() || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const calculatedLines = lineCount || (content ? content.split('\n').length : 0);

  return (
    <div className="sheet flex flex-col h-full overflow-hidden">
      {/* File header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-paper-400 bg-paper-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-teal-100 text-teal-600 border border-teal-300/50 flex-shrink-0">
            <Icons.Code size={13} />
          </div>
          <span className="text-xs font-mono text-ink-800 truncate block" title={filePath}>
            {filePath}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {calculatedLines > 0 && (
            <span className="text-[11px] font-mono text-ink-500 px-2 py-0.5 rounded-sm bg-paper-200 hidden sm:inline">
              {calculatedLines} lines
            </span>
          )}
          <span className="text-[10px] font-mono uppercase font-bold text-vermilion-700 px-2 py-0.5 rounded-sm bg-vermilion-100 border border-vermilion-200">
            {extension || 'text'}
          </span>
          <button
            onClick={handleCopy}
            className="btn btn-ghost px-2 py-1.5 text-xs"
            title="Copy to clipboard"
          >
            {copied ? <Icons.Check size={14} className="text-green-600" /> : <Icons.Copy size={14} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code */}
      <div className="flex-1 overflow-auto bg-paper-50 text-xs">
        <SyntaxHighlighter
          language={langMap[extension.toLowerCase()] || 'text'}
          style={oneLight}
          showLineNumbers
          wrapLongLines
          customStyle={{
            margin: 0,
            padding: '16px',
            background: 'transparent',
            fontSize: '12.5px',
            lineHeight: '1.65',
            fontFamily: 'JetBrains Mono, monospace',
          }}
          lineNumberStyle={{
            color: '#a89e8f',
            fontSize: '11px',
            paddingRight: '16px',
            userSelect: 'none',
          }}
          lineProps={(lineNumber: number) => {
            const isHighlighted = highlightLines?.includes(lineNumber);
            return {
              style: {
                backgroundColor: isHighlighted ? 'rgba(188, 75, 38, 0.12)' : 'transparent',
                display: 'block',
                paddingLeft: '8px',
                borderLeft: isHighlighted ? '3px solid #bc4b26' : '3px solid transparent',
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

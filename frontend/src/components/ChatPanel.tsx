import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Icons } from './Icons';
import { api } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  repoId: number;
  onCitationClick?: (filePath: string, startLine: number, endLine: number) => void;
  presetPrompt?: string;
  onClearPresetPrompt?: () => void;
}

/** A ChatGPT/Gemini-style fenced code block: language header + copy button + syntax highlighting. */
const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="my-3 overflow-hidden rounded-sm border border-paper-400">
      <div className="flex items-center justify-between px-3 py-1.5 bg-paper-100 border-b border-paper-400">
        <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400">
          {language || 'code'}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[11px] text-ink-400 hover:text-ink-800 transition-colors"
        >
          {copied ? <Icons.Check size={12} className="text-green-600" /> : <Icons.Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneLight}
        wrapLongLines
        customStyle={{
          margin: 0,
          padding: '12px 14px',
          background: '#faf5ec',
          fontSize: '12px',
          lineHeight: '1.6',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

/**
 * Source-grounded chat. Transcript state is local to this component (scoped to the repo view).
 * Streaming goes through {@link api.streamChat}, which attaches the auth header and parses the SSE
 * frames to spec, so markdown fences and line breaks survive the wire. Assistant answers render as
 * full-width markdown (headings, lists, tables, code blocks, clickable citations) the way ChatGPT /
 * Gemini present them, with a live caret while streaming.
 */
export const ChatPanel = ({
  repoId,
  onCitationClick,
  presetPrompt,
  onClearPresetPrompt,
}: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (presetPrompt) {
      setInput(presetPrompt);
      onClearPresetPrompt?.();
    }
  }, [presetPrompt, onClearPresetPrompt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const appendToLast = (chunk: string) => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === 'assistant') {
        next[next.length - 1] = { ...last, content: last.content + chunk };
      }
      return next;
    });
  };

  const handleSend = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    await api.streamChat(
      repoId,
      text,
      {
        onToken: (token) => appendToLast(token),
        onDone: () => setLoading(false),
        onError: (msg) => {
          appendToLast(`\n\n⚠️ **${msg}**`);
          setLoading(false);
        },
      },
      controller.signal
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyAnswer = (idx: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1500);
  };

  const suggestedQuestions = [
    'Explain the core architecture and how the frontend, backend, and AI service interact',
    'Where are the main Java database entities and repositories defined?',
    'How does the vector indexing and RAG pipeline work in the Python AI service?',
    'List all the available REST endpoints and their mappings',
  ];

  const markdownComponents = {
    code({ className, children }: { className?: string; children?: React.ReactNode }) {
      const raw = String(children).replace(/\n$/, '');
      const citation = raw.trim().match(/^([A-Za-z0-9_./\\-]+\.\w+):(\d+)-(\d+)$/);
      if (citation) {
        const [, file, start, end] = citation;
        return (
          <button
            type="button"
            onClick={() => onCitationClick?.(file, parseInt(start, 10), parseInt(end, 10))}
            className="inline-flex items-center gap-1.5 rounded-sm bg-vermilion-100 border border-vermilion-200 px-1.5 py-0.5 text-xs font-mono text-vermilion-700 hover:bg-vermilion-200 transition-colors mx-0.5 cursor-pointer align-baseline"
            title={`Open ${file} lines ${start}-${end}`}
          >
            <Icons.Link size={11} />
            <span>{file}:{start}-{end}</span>
          </button>
        );
      }

      const langMatch = /language-(\w+)/.exec(className || '');
      const isBlock = !!langMatch || raw.includes('\n');
      if (isBlock) {
        return <CodeBlock language={langMatch ? langMatch[1] : ''} value={raw} />;
      }
      return (
        <code className="rounded-sm bg-paper-200 border border-paper-400 px-1.5 py-0.5 font-mono text-[0.82em] text-vermilion-700">
          {children}
        </code>
      );
    },
    // pass-through so our CodeBlock isn't nested inside a <pre>
    pre({ children }: { children?: React.ReactNode }) {
      return <>{children}</>;
    },
    p({ children }: { children?: React.ReactNode }) {
      return <p className="mb-3 last:mb-0 leading-[1.7]">{children}</p>;
    },
    h1({ children }: { children?: React.ReactNode }) {
      return <h1 className="font-display text-lg text-ink-900 mt-4 mb-2 first:mt-0">{children}</h1>;
    },
    h2({ children }: { children?: React.ReactNode }) {
      return <h2 className="font-display text-base text-ink-900 mt-4 mb-2 first:mt-0">{children}</h2>;
    },
    h3({ children }: { children?: React.ReactNode }) {
      return <h3 className="font-semibold text-sm text-ink-900 mt-3 mb-1.5 first:mt-0">{children}</h3>;
    },
    ul({ children }: { children?: React.ReactNode }) {
      return <ul className="list-disc pl-5 mb-3 space-y-1 marker:text-ink-300">{children}</ul>;
    },
    ol({ children }: { children?: React.ReactNode }) {
      return <ol className="list-decimal pl-5 mb-3 space-y-1 marker:text-ink-400">{children}</ol>;
    },
    li({ children }: { children?: React.ReactNode }) {
      return <li className="leading-[1.6] pl-1">{children}</li>;
    },
    strong({ children }: { children?: React.ReactNode }) {
      return <strong className="font-semibold text-ink-900">{children}</strong>;
    },
    a({ children, href }: { children?: React.ReactNode; href?: string }) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className="text-vermilion-700 underline underline-offset-2 hover:text-vermilion-600">
          {children}
        </a>
      );
    },
    blockquote({ children }: { children?: React.ReactNode }) {
      return (
        <blockquote className="border-l-2 border-vermilion-400 pl-3 my-3 text-ink-500 italic">
          {children}
        </blockquote>
      );
    },
    hr() {
      return <hr className="my-4 border-0 border-t border-paper-400" />;
    },
    table({ children }: { children?: React.ReactNode }) {
      return (
        <div className="overflow-x-auto my-3 rounded-sm border border-paper-400">
          <table className="min-w-full border-collapse text-xs">{children}</table>
        </div>
      );
    },
    thead({ children }: { children?: React.ReactNode }) {
      return <thead className="bg-paper-100 border-b border-paper-400">{children}</thead>;
    },
    th({ children }: { children?: React.ReactNode }) {
      return <th className="px-3 py-2 text-left font-semibold text-ink-900 border-r border-paper-300 last:border-r-0">{children}</th>;
    },
    td({ children }: { children?: React.ReactNode }) {
      return <td className="px-3 py-2 border-b border-r border-paper-300 last:border-r-0 text-ink-600 align-top">{children}</td>;
    },
  };

  return (
    <div className="sheet flex-1 w-full flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-paper-400 bg-paper-50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-vermilion-100 text-vermilion-600 border border-vermilion-200 flex-shrink-0">
            <Icons.Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink-900 truncate">Source-grounded assistant</h3>
            <p className="annotation normal-case tracking-normal truncate">
              Answers cite repository chunks as file:line
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="btn btn-ghost px-2 py-1.5 text-xs flex-shrink-0"
            title="Clear conversation"
          >
            <Icons.Trash size={13} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-8 px-5 text-center max-w-lg mx-auto">
            <div className="flex h-14 w-14 items-center justify-center rounded-sm bg-paper-100 border border-paper-400 text-vermilion-500">
              <Icons.Brain size={28} />
            </div>
            <div>
              <h4 className="font-display text-lg text-ink-900 mb-1">Ask about this repository</h4>
              <p className="text-sm text-ink-500 leading-relaxed">
                Questions are embedded, searched across the vector index, and answered with precise
                file:line citations you can open in the code viewer.
              </p>
            </div>

            <div className="w-full space-y-2 mt-1">
              <p className="annotation text-left">Suggested</p>
              <div className="grid grid-cols-1 gap-1.5">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="sheet sheet-interactive flex items-center justify-between gap-2 px-3 py-2.5 text-left text-[0.8125rem] text-ink-700"
                  >
                    <span className="truncate">{q}</span>
                    <Icons.ArrowRight size={13} className="text-ink-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-paper-300/70">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const streaming = !isUser && loading && idx === messages.length - 1;

              if (isUser) {
                return (
                  <div key={idx} className="flex justify-end px-4 sm:px-5 py-4">
                    <div className="max-w-[85%] rounded-sm bg-ink-800 text-paper-50 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div key={idx} className="flex gap-3 px-4 sm:px-5 py-4 bg-paper-50/40">
                  <div className="flex-shrink-0 h-7 w-7 rounded-sm bg-vermilion-100 text-vermilion-600 border border-vermilion-200 flex items-center justify-center mt-0.5">
                    <Icons.Sparkles size={13} />
                  </div>

                  <div className="min-w-0 flex-1">
                    {msg.content === '' && streaming ? (
                      <span className="inline-flex items-center gap-2 text-sm text-ink-400">
                        <span className="h-3 w-3 rounded-full border-2 border-vermilion-200 border-t-vermilion-500 animate-spin" />
                        Retrieving chunks…
                      </span>
                    ) : (
                      <div className="text-[0.9rem] text-ink-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {msg.content}
                        </ReactMarkdown>
                        {streaming && <span className="stream-caret" aria-hidden="true" />}
                      </div>
                    )}

                    {/* Answer actions (once streaming is done) */}
                    {!streaming && msg.content.trim() !== '' && (
                      <div className="mt-2 flex items-center gap-1">
                        <button
                          onClick={() => copyAnswer(idx, msg.content)}
                          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] text-ink-400 hover:text-ink-800 hover:bg-paper-100 transition-colors"
                          title="Copy answer"
                        >
                          {copiedIdx === idx ? (
                            <>
                              <Icons.Check size={12} className="text-green-600" /> Copied
                            </>
                          ) : (
                            <>
                              <Icons.Copy size={12} /> Copy
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-3 sm:p-4 border-t border-paper-400 bg-paper-50">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about architecture, services, endpoints, or data models…"
            rows={1}
            className="field resize-none flex-1 max-h-32"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="btn btn-primary px-3.5 py-3 flex-shrink-0"
            title="Send"
          >
            <Icons.Send size={16} />
          </button>
        </div>
        <p className="annotation normal-case tracking-normal mt-2 text-ink-300">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
};

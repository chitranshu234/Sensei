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

/**
 * Source-grounded chat. Transcript state is deliberately local to this component — it is scoped
 * to a single repository view and should vanish on navigation (the app store is app-lifetime
 * state). Streaming goes through {@link api.streamChat}, which attaches the auth header and parses
 * the SSE frames to spec, so markdown fences and line breaks survive the wire.
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Preset prompt (e.g. from the architecture inspector "Ask AI" button).
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

  // Abort any in-flight stream when the panel unmounts.
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

  const suggestedQuestions = [
    'Explain the core architecture and how the frontend, backend, and AI service interact',
    'Where are the main Java database entities and repositories defined?',
    'How does the vector indexing and RAG pipeline work in the Python AI service?',
    'List all the available REST endpoints and their mappings',
  ];

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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-8 text-center max-w-lg mx-auto">
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
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 h-7 w-7 rounded-sm bg-vermilion-100 text-vermilion-600 border border-vermilion-200 flex items-center justify-center mt-0.5">
                <Icons.Sparkles size={13} />
              </div>
            )}

            <div
              className={`max-w-[85%] px-4 py-3 text-[0.8125rem] sm:text-sm leading-relaxed rounded-sm ${
                msg.role === 'user'
                  ? 'bg-ink-800 text-paper-50'
                  : 'bg-paper-50 text-ink-700 border border-paper-400'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : msg.content === '' && loading ? (
                <span className="inline-flex items-center gap-2 text-ink-400">
                  <span className="h-3 w-3 rounded-full border-2 border-vermilion-200 border-t-vermilion-500 animate-spin" />
                  Retrieving chunks…
                </span>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const textValue = String(children).trim();
                      const match = textValue.match(/^([A-Za-z0-9_./\\-]+\.\w+):(\d+)-(\d+)$/);
                      if (match) {
                        const [, file, start, end] = match;
                        return (
                          <button
                            type="button"
                            onClick={() => onCitationClick?.(file, parseInt(start, 10), parseInt(end, 10))}
                            className="inline-flex items-center gap-1.5 rounded-sm bg-vermilion-100 border border-vermilion-200 px-1.5 py-0.5 text-xs font-mono text-vermilion-700 hover:bg-vermilion-200 transition-colors mx-0.5 cursor-pointer"
                            title={`Open ${file} lines ${start}-${end}`}
                          >
                            <Icons.Link size={11} />
                            <span>{file}:{start}-{end}</span>
                          </button>
                        );
                      }

                      const isInline = !className && !String(children).includes('\n');
                      if (isInline) {
                        return (
                          <code
                            className="bg-paper-200 text-vermilion-700 font-mono text-xs px-1.5 py-0.5 rounded-sm border border-paper-400"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      const matchLang = /language-(\w+)/.exec(className || '');
                      return (
                        <div className="rounded-sm overflow-hidden my-3 border border-paper-400">
                          <SyntaxHighlighter
                            language={matchLang ? matchLang[1] : 'text'}
                            style={oneLight}
                            customStyle={{
                              margin: 0,
                              padding: '12px',
                              background: '#faf5ec',
                              fontSize: '11.5px',
                              fontFamily: 'JetBrains Mono, monospace',
                            }}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      );
                    },
                    table({ children }) {
                      return (
                        <div className="overflow-x-auto my-3 rounded-sm border border-paper-400">
                          <table className="min-w-full border-collapse text-xs">{children}</table>
                        </div>
                      );
                    },
                    thead({ children }) {
                      return <thead className="bg-paper-100 border-b border-paper-400">{children}</thead>;
                    },
                    th({ children }) {
                      return <th className="px-3 py-2 text-left font-semibold text-ink-900">{children}</th>;
                    },
                    td({ children }) {
                      return <td className="px-3 py-2 border-b border-paper-300 text-ink-600">{children}</td>;
                    },
                    p({ children }) {
                      return <p className="mb-2.5 last:mb-0">{children}</p>;
                    },
                    ul({ children }) {
                      return <ul className="list-disc list-inside mb-2.5 space-y-1">{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className="list-decimal list-inside mb-2.5 space-y-1">{children}</ol>;
                    },
                    h1({ children }) {
                      return <h3 className="font-display text-sm text-ink-900 mb-2 mt-3">{children}</h3>;
                    },
                    h2({ children }) {
                      return <h4 className="font-display text-xs text-ink-900 mb-1.5 mt-2.5">{children}</h4>;
                    },
                    h3({ children }) {
                      return <h5 className="text-xs font-bold text-vermilion-700 mb-1 mt-2">{children}</h5>;
                    },
                    blockquote({ children }) {
                      return (
                        <blockquote className="border-l-2 border-vermilion-400 pl-3 my-2 text-ink-500 italic">
                          {children}
                        </blockquote>
                      );
                    },
                    a({ children, href }) {
                      return (
                        <a href={href} target="_blank" rel="noreferrer" className="text-vermilion-700 underline underline-offset-2">
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
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

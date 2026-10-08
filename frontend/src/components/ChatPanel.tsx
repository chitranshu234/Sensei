import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Icons } from './Icons';
import { useAppStore } from '../store/appStore';

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

export const ChatPanel = ({
  repoId,
  onCitationClick,
  presetPrompt,
  onClearPresetPrompt,
}: Props) => {
  const { chatMessages: messages, addChatMessage, updateLastChatMessage, clearChatMessages } = useAppStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // If a preset prompt comes in (e.g. from Architecture Graph "Ask AI")
  useEffect(() => {
    if (presetPrompt) {
      setInput(presetPrompt);
      onClearPresetPrompt?.();
    }
  }, [presetPrompt, onClearPresetPrompt]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || loading) return;

    setInput('');
    addChatMessage({ role: 'user', content: textToSend });
    setLoading(true);

    try {
      const response = await fetch(`/api/repositories/${repoId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId, message: textToSend }),
      });

      if (!response.ok) {
        let errMsg = 'Something went wrong. Please check that the AI service is reachable.';
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch {
          /* ignore */
        }
        addChatMessage({ role: 'assistant', content: `⚠️ **Error:** ${errMsg}` });
        setLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      addChatMessage({ role: 'assistant', content: '' });

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const payload = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
              assistantContent += payload + '\n';
              updateLastChatMessage(assistantContent);
            }
          }
        }
        
        // Process any remaining buffer
        if (buffer.startsWith('data:')) {
          const payload = buffer.startsWith('data: ') ? buffer.slice(6) : buffer.slice(5);
          assistantContent += payload + '\n';
          updateLastChatMessage(assistantContent);
        }
      }

      if (assistantContent.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(assistantContent.trim());
          if (parsed.error) {
            const friendly = parsed.error.includes('ReadTimeoutException')
              ? '⚠️ **Request timed out.** The AI service took too long to complete. Try asking a more specific query.'
              : `⚠️ **Error:** ${parsed.error}`;
            updateLastChatMessage(friendly);
          }
        } catch {
          /* not JSON */
        }
      }
    } catch {
      addChatMessage({
        role: 'assistant',
        content:
          'Unable to connect to the AI service. Verify that the Python AI service is running on port 8000 and the backend on port 8080.',
      });
    } finally {
      setLoading(false);
    }
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
    <div className="glass-card flex-1 w-full flex flex-col h-full overflow-hidden border border-surface-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-300 bg-white/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-cyan text-white shadow-md">
            <Icons.Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-surface-900">Source-Grounded Assistant</h3>
            <p className="text-[11px] text-surface-500">
              Answers verified against repository chunks with citations
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={() => clearChatMessages()}
            className="p-1.5 rounded-lg text-surface-500 hover:text-surface-800 hover:bg-black/5 transition-colors text-xs flex items-center gap-1"
            title="Clear Chat History"
          >
            <Icons.Trash size={13} />
            <span className="hidden sm:inline text-[11px]">Clear</span>
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-8 text-center max-w-lg mx-auto">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-500/10 border border-primary-500/20 text-primary-400 shadow-inner">
              <Icons.Brain size={32} />
            </div>
            <div>
              <h4 className="text-base font-bold text-surface-900 mb-1">
                Ask Questions About This Repository
              </h4>
              <p className="text-xs text-surface-500 leading-relaxed">
                Queries are embedded into vector space, searched across ChromaDB chunks, and synthesized with precise file:line links.
              </p>
            </div>

            <div className="w-full space-y-2 mt-2">
              <p className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">
                Suggested Prompts
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                      handleSend(q);
                    }}
                    className="w-full p-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-white hover:border-primary-500/30 text-left text-xs text-surface-700 hover:text-surface-900 transition-all flex items-center justify-between group shadow-sm"
                  >
                    <span className="truncate pr-2">{q}</span>
                    <Icons.ArrowRight
                      size={13}
                      className="text-surface-500 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all flex-shrink-0"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 h-7 w-7 rounded-xl bg-gradient-to-br from-primary-500 to-accent-cyan flex items-center justify-center text-white mt-1 shadow-sm">
                <Icons.Sparkles size={14} />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white font-medium shadow-md'
                  : 'bg-white text-surface-800 border border-surface-300 shadow-sm'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const text = String(children).trim();
                      // Citation detector: file.ext:start-end
                      const match = text.match(/^([A-Za-z0-9_./\\-]+\.\w+):(\d+)-(\d+)$/);
                      if (match) {
                        const [, file, start, end] = match;
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              onCitationClick?.(file, parseInt(start, 10), parseInt(end, 10))
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500/15 border border-primary-500/30 px-2 py-0.5 text-xs font-mono text-primary-300 hover:bg-primary-500/30 transition-all mx-0.5 cursor-pointer shadow-sm hover:scale-[1.02]"
                            title={`Inspect ${file} lines ${start}-${end}`}
                          >
                            <Icons.Link size={11} className="text-primary-400" />
                            <span>
                              {file}:{start}-{end}
                            </span>
                          </button>
                        );
                      }

                      const isInline = !className && !String(children).includes('\n');
                      if (isInline) {
                        return (
                          <code
                            className="bg-surface-100 text-primary-600 font-mono text-xs px-1.5 py-0.5 rounded-md border border-surface-300"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      const matchLang = /language-(\w+)/.exec(className || '');
                      return (
                        <div className="rounded-xl overflow-hidden my-3 border border-surface-300 shadow-sm">
                          <SyntaxHighlighter
                            language={matchLang ? matchLang[1] : 'text'}
                            style={oneLight}
                            customStyle={{
                              margin: 0,
                              padding: '12px',
                              background: '#FAFAFA',
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
                        <div className="overflow-x-auto my-3 rounded-xl border border-surface-300 shadow-sm">
                          <table className="min-w-full border-collapse text-xs">{children}</table>
                        </div>
                      );
                    },
                    thead({ children }) {
                      return <thead className="bg-surface-100 border-b border-surface-300">{children}</thead>;
                    },
                    th({ children }) {
                      return (
                        <th className="px-3 py-2 text-left font-bold text-surface-900">{children}</th>
                      );
                    },
                    td({ children }) {
                      return (
                        <td className="px-3 py-2 border-b border-surface-300 text-surface-700">
                          {children}
                        </td>
                      );
                    },
                    p({ children }) {
                      return <p className="mb-2.5 last:mb-0">{children}</p>;
                    },
                    ul({ children }) {
                      return <ul className="list-disc list-inside mb-2.5 space-y-1">{children}</ul>;
                    },
                    ol({ children }) {
                      return (
                        <ol className="list-decimal list-inside mb-2.5 space-y-1">{children}</ol>
                      );
                    },
                    h1({ children }) {
                      return (
                        <h3 className="text-sm font-extrabold text-surface-900 mb-2 mt-3 font-display">
                          {children}
                        </h3>
                      );
                    },
                    h2({ children }) {
                      return (
                        <h4 className="text-xs font-bold text-surface-900 mb-1.5 mt-2.5 font-display">
                          {children}
                        </h4>
                      );
                    },
                    h3({ children }) {
                      return (
                        <h5 className="text-xs font-bold text-primary-600 mb-1 mt-2">
                          {children}
                        </h5>
                      );
                    },
                    blockquote({ children }) {
                      return (
                        <blockquote className="border-l-2 border-primary-500/60 pl-3 my-2 text-surface-600 italic">
                          {children}
                        </blockquote>
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

        {loading && (
          <div className="flex items-center gap-3 text-xs text-surface-500">
            <div className="h-6 w-6 rounded-lg bg-surface-100 border border-surface-300 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full border-2 border-primary-500/30 border-t-primary-500 animate-spin" />
            </div>
            <span>Retrieving chunks & generating grounded answer...</span>
          </div>
        )}
      </div>

      {/* Input Field Bar */}
      <div className="p-3 sm:p-4 border-t border-surface-300 bg-white/90 backdrop-blur-md">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about architecture, services, endpoints, or data models..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 text-xs sm:text-sm text-surface-900 placeholder-surface-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-4 py-3 text-white transition-all hover:shadow-md hover:shadow-primary-500/20 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center"
            title="Send query"
          >
            <Icons.Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

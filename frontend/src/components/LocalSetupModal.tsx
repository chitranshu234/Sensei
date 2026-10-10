import React from 'react';
import { Icons } from './Icons';

interface Props {
  onClose: () => void;
}

export const LocalSetupModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="sheet sheet-raised w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-paper-400 flex items-center justify-between bg-paper-50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-ochre-100 text-ochre-600 border border-ochre-400/40 flex-shrink-0">
              <Icons.BookOpen size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-sm text-ink-900 truncate">Run Sensei Locally</h3>
              <p className="annotation normal-case tracking-normal truncate">
                Bypass all limits and experience instant AI responses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm text-ink-400 hover:text-ink-900 hover:bg-paper-200 transition-colors flex-shrink-0"
          >
            <Icons.X size={16} />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto text-sm leading-relaxed text-ink-700 md-body max-w-none">
          <div className="bg-ochre-50 border border-ochre-200 rounded-md p-4 mb-6">
            <p className="text-sm text-ochre-900">
              <strong>Note on Performance:</strong> You are currently viewing the live portfolio demo. Because this backend is hosted on Render's free tier (throttled to 0.1 CPU core), AI responses and codebase analysis can take 1-2 minutes. 
              When you run this project locally on your own machine with a fast API key (like Groq), the AI responds instantly!
            </p>
          </div>

          <h3>Prerequisites</h3>
          <ul>
            <li>Java 21 or higher</li>
            <li>Python 3.10+</li>
            <li>Node.js 18+</li>
            <li>A PostgreSQL database (or just use the default H2 file database)</li>
          </ul>

          <h3>1. Clone the repository</h3>
          <pre><code>git clone https://github.com/chitranshu234/Sensei.git\ncd Sensei</code></pre>

          <h3>2. Backend Setup (Java Spring Boot)</h3>
          <pre><code>cd backend\nmvn clean install\nmvn spring-boot:run</code></pre>
          
          <h3>3. AI Service Setup (Python FastAPI)</h3>
          <pre><code>cd ai-service\npython -m venv .venv\n# On Windows:\n.venv\\Scripts\\activate\n# On Mac/Linux:\n# source .venv/bin/activate\n\npip install -r requirements.txt</code></pre>
          <p>Create a <code>.env</code> file in the <code>ai-service</code> directory and add your API key:</p>
          <pre><code># Use Google Gemini:\nLLM_PROVIDER=gemini\nGEMINI_API_KEY=your_google_api_key\n\n# Or use Groq for lightning-fast responses:\n# LLM_PROVIDER=groq\n# GROQ_API_KEY=your_groq_api_key</code></pre>
          <pre><code>uvicorn main:app --port 8000 --reload</code></pre>

          <h3>4. Frontend Setup (React)</h3>
          <pre><code>cd frontend\nnpm install\nnpm run dev</code></pre>

          <p className="mt-6 text-sm text-ink-500">Once all three services are running, open your browser to <code>http://localhost:5173</code> to start querying your local repositories instantly without restrictions.</p>
        </div>

        <div className="px-5 sm:px-6 py-3 border-t border-paper-400 bg-paper-50 flex items-center justify-between">
          <span className="annotation normal-case tracking-normal">Full architecture diagram support included</span>
          <button onClick={onClose} className="btn btn-secondary px-4 py-1.5 text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

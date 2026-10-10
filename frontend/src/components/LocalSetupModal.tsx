import React from 'react';
import { Icons } from './Icons';

interface Props {
  onClose: () => void;
}

export const LocalSetupModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="sheet sheet-raised w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
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
          <h3>Prerequisites</h3>
          <ul>
            <li>Java 21 and Maven</li>
            <li>Python 3.10+</li>
            <li>Node.js 18+ and npm</li>
            <li>A Google Gemini API key (<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-vermilion-600 hover:underline">aistudio.google.com/apikey</a>) — required for embeddings</li>
            <li>A Google OAuth 2.0 Client (for login)</li>
            <li>Optionally a Groq API key (<a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-vermilion-600 hover:underline">console.groq.com</a>) for faster chat responses</li>
          </ul>
          <p>No database setup is required — an embedded H2 file database is used by default.</p>

          <h3>1. Clone</h3>
          <pre><code>git clone https://github.com/chitranshu234/Sensei.git
cd Sensei</code></pre>

          <h3>2. Backend — Spring Boot (:8080)</h3>
          <p>In Google Cloud Console, create a project, configure the OAuth consent screen, and create an OAuth 2.0 Client ID of type Web application. Under <strong>Authorized redirect URIs</strong>, add exactly:</p>
          <pre><code>http://localhost:8080/login/oauth2/code/google</code></pre>
          <p>If the consent screen is in Testing mode, add your own email under <strong>Test users</strong>.</p>
          <p>Then create <code>backend/.env</code> (loaded automatically via spring-dotenv):</p>
          <pre><code>GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret</code></pre>
          <pre><code>cd backend
mvn clean package
mvn spring-boot:run</code></pre>
          <p>The backend will refuse to start if those two variables are missing — that's expected.</p>

          <h3>3. AI service — FastAPI (:8000)</h3>
          <pre><code>cd ai-service
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt</code></pre>
          <p>Create <code>ai-service/.env</code>:</p>
          <pre><code># Embeddings always use Google — this key is required either way.
GOOGLE_API_KEY=your_gemini_api_key

# Recommended: Groq for fast chat (works with the default model list)
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key

# To use Gemini for chat instead, set these three together:
# LLM_PROVIDER=google
# LLM_MODEL=gemini-2.0-flash
# LLM_FALLBACK_MODELS=gemini-2.0-flash-lite</code></pre>
          <pre><code>uvicorn main:app --port 8000 --reload</code></pre>

          <h3>4. Frontend — React (:5173)</h3>
          <pre><code>cd frontend
npm install
npm run dev</code></pre>
          <p>No frontend <code>.env</code> is needed locally — Vite proxies <code>/api</code> to the backend automatically.</p>

          <p className="mt-6 text-sm text-ink-500">Open <a href="http://localhost:5173" target="_blank" rel="noopener noreferrer" className="text-vermilion-600 font-semibold hover:underline">http://localhost:5173</a>, sign in with Google, and submit a repository URL in the form <code>https://github.com/owner/repo</code>.</p>
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

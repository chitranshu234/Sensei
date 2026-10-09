import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import { Icons } from '../components/Icons';
import logoMarkUrl from '../assets/logo-mark.png';

type Mode = 'login' | 'register';

/**
 * Authentication sheet. One screen, two modes (sign in / create account) sharing the same
 * drafting-sheet grammar as the rest of the app: warm paper, a single hairline border, and
 * vermilion reserved for the primary action. Mobile-first — the brand column folds away below
 * `lg` so the form always owns the viewport on a phone.
 */
export const LoginPage = () => {
  const { login, register, submitting, error, clearError } = useAuthStore();

  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    clearError();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    if (mode === 'login') {
      await login({ username: username.trim(), password });
    } else {
      await register({
        username: username.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
    }
  };

  return (
    <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
      {/* ── Brand column (desktop only) ── */}
      <aside className="hidden lg:flex flex-col justify-between border-r border-paper-400 bg-paper-100/70 p-10 xl:p-14">
        <div className="flex items-center gap-2.5">
          <img src={logoMarkUrl} alt="" className="h-8 w-auto" style={{ mixBlendMode: 'multiply' }} />
          <span className="font-display text-xl text-ink-900 leading-none">Sensei</span>
        </div>

        <div className="max-w-md">
          <p className="annotation mb-4">Codebase intelligence</p>
          <h1 className="font-display text-4xl xl:text-5xl leading-[1.05] text-ink-900">
            Read any repository like a drawing.
          </h1>
          <p className="mt-5 text-ink-500 leading-relaxed">
            Point Sensei at a GitHub repository and it clones, parses the AST, maps the software
            architecture, and answers questions grounded in the source — with citations you can click
            straight into the code.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Interactive architecture graph',
              'AST-aware code explorer',
              'Source-grounded AI chat',
            ].map((line) => (
              <li key={line} className="flex items-center gap-3 text-sm text-ink-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-vermilion-100 text-vermilion-600">
                  <Icons.Check size={13} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="annotation normal-case tracking-normal text-ink-400">
          Built by Chitranshu Pandey · Spring Boot · FastAPI · React
        </p>
      </aside>

      {/* ── Form column ── */}
      <main className="flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-sm">
          {/* Mobile brand mark */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
            <img src={logoMarkUrl} alt="" className="h-8 w-auto" style={{ mixBlendMode: 'multiply' }} />
            <span className="font-display text-xl text-ink-900 leading-none">Sensei</span>
          </div>

          <div className="sheet sheet-raised p-6 sm:p-8 rise">
            <div className="mb-6">
              <h2 className="font-display text-2xl text-ink-900">
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                {mode === 'login'
                  ? 'Welcome back — enter your credentials to continue.'
                  : 'Set up a workspace to start analysing repositories.'}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="mb-6 flex rounded-sm border border-paper-400 bg-paper-100 p-0.5">
              {(['login', 'register'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`flex-1 rounded-sm px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                    mode === m
                      ? 'bg-paper-50 text-ink-900 border border-paper-400'
                      : 'text-ink-400 hover:text-ink-700'
                  }`}
                >
                  {m === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block annotation mb-1.5">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your-handle"
                  className="field font-mono"
                  required
                  disabled={submitting}
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label htmlFor="displayName" className="block annotation mb-1.5">
                    Display name <span className="text-ink-300 lowercase tracking-normal">(optional)</span>
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How your name appears"
                    className="field"
                    disabled={submitting}
                  />
                </div>
              )}

              <div>
                <label htmlFor="password" className="block annotation mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                    className="field font-mono pr-10"
                    required
                    minLength={mode === 'register' ? 8 : undefined}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-2.5 flex items-center text-ink-400 hover:text-ink-700"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icons.Eye size={15} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-sm border border-rose-500/40 bg-rose-100 px-3 py-2 text-[0.8125rem] text-rose-500">
                  <Icons.AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                  </>
                ) : (
                  <>
                    {mode === 'login' ? 'Sign in' : 'Create account'}
                    <Icons.ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-[0.8125rem] text-ink-500">
              {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                className="font-semibold text-vermilion-600 hover:text-vermilion-700 underline underline-offset-2"
              >
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </div>

          <p className="mt-5 text-center annotation normal-case tracking-normal text-ink-400">
            The first account created becomes the workspace administrator.
          </p>
        </div>
      </main>
    </div>
  );
};

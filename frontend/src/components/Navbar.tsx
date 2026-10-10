import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icons } from './Icons';
import { useAuthStore } from '../store/authStore';
import { LocalSetupModal } from './LocalSetupModal';
import logoMarkUrl from '../assets/logo-mark.png';

/**
 * Top bar. Fixed, hairline-bottomed, and 56px tall so it reads as the sheet's title block
 * rather than a floating app chrome. The account menu collapses to an icon below `sm`.
 */
export const Navbar = () => {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLocalSetup, setShowLocalSetup] = useState(false);

  const initials = (user?.displayName || user?.username || '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-14 border-b border-paper-400 bg-paper-50/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[1700px] h-full px-4 sm:px-6 flex items-center justify-between gap-4">

        <Link to="/" className="flex items-center gap-2.5 min-w-0 group">
          <img
            src={logoMarkUrl}
            alt=""
            className="h-7 w-auto shrink-0"
            style={{ mixBlendMode: 'multiply' }}
          />
          <span className="font-display text-lg text-ink-900 leading-none">Sensei</span>
          <span className="hidden sm:inline annotation border-l border-paper-400 pl-2.5 ml-1">
            Codebase intelligence
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className={`hidden sm:inline-flex btn btn-ghost ${
              location.pathname === '/' ? 'text-ink-900 bg-paper-200' : ''
            }`}
          >
            <Icons.Dashboard size={14} />
            Workspace
          </Link>

          <button
            onClick={() => setShowLocalSetup(true)}
            className="hidden sm:inline-flex btn btn-ghost text-ochre-600 hover:text-ochre-700 hover:bg-ochre-50"
          >
            <Icons.BookOpen size={14} />
            Local Setup
          </button>

          {/* Account */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-sm border border-transparent hover:border-paper-400 hover:bg-paper-100 transition-colors"
            >
              <span className="h-7 w-7 grid place-items-center bg-ink-700 text-paper-50 text-[0.6875rem] font-semibold rounded-sm">
                {initials}
              </span>
              <span className="hidden md:block text-[0.8125rem] font-medium text-ink-700 max-w-[11ch] truncate">
                {user?.displayName || user?.username}
              </span>
              <Icons.ChevronRight
                size={12}
                className={`hidden md:block text-ink-400 transition-transform ${menuOpen ? 'rotate-90' : ''}`}
              />
            </button>

            {menuOpen && (
              <>
                {/* Click-away layer: closes the menu without a document listener. */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 z-20 w-56 sheet sheet-raised py-1"
                >
                  <div className="px-3 py-2 border-b border-paper-300">
                    <p className="text-[0.8125rem] font-semibold text-ink-900 truncate">
                      {user?.displayName || user?.username}
                    </p>
                    <p className="annotation mt-0.5 normal-case tracking-normal">
                      @{user?.username} · {user?.role.toLowerCase()}
                    </p>
                  </div>
                  <Link
                    to="/"
                    onClick={() => setMenuOpen(false)}
                    className="sm:hidden flex items-center gap-2 w-full px-3 py-2 text-[0.8125rem] text-ink-700 hover:bg-paper-200"
                  >
                    <Icons.Dashboard size={14} /> Workspace
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[0.8125rem] text-ink-700 hover:bg-paper-200 text-left"
                  >
                    <Icons.X size={13} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showLocalSetup && (
        <LocalSetupModal onClose={() => setShowLocalSetup(false)} />
      )}
    </nav>
  );
};

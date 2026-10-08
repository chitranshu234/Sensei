import { Link, useLocation } from 'react-router-dom';
import { Icons } from './Icons';
import logoMarkUrl from '../assets/logo-mark.png';
import logoTextUrl from '../assets/logo-text.png';

export const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-surface-300 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto max-w-[1700px] px-6 sm:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2 group">
            <img 
              src={logoMarkUrl} 
              alt="Sensei Icon" 
              className="h-10 w-auto transition-transform group-hover:scale-105" 
              style={{ mixBlendMode: 'multiply' }} 
            />
            <img 
              src={logoTextUrl} 
              alt="Sensei" 
              className="h-11 w-auto opacity-90 transition-opacity group-hover:opacity-100" 
              style={{ mixBlendMode: 'multiply', marginTop: '2px' }} 
            />
          </Link>

          {/* Center Navigation */}
          <div className="flex items-center gap-1.5">
            <Link
              to="/"
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                location.pathname === '/'
                  ? 'bg-primary-500/15 text-primary-600 border border-primary-500/30'
                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
              }`}
            >
              <Icons.Dashboard size={14} />
              <span>Workspace</span>
            </Link>
          </div>

          {/* Right Status Indicator */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-surface-100 border border-surface-300 px-3 py-1 text-[11px] font-medium text-surface-600">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald animate-pulse-dot" />
              <span>Engine Ready</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

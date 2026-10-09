import { useEffect, type ReactNode } from 'react';
import { useAuthStore, attachAuthExpiryListener } from '../store/authStore';
import { LoginPage } from '../pages/LoginPage';

/**
 * Renders the app only for a signed-in user; otherwise shows the sign-in sheet.
 *
 * <p>Gating here rather than inside each route keeps every page free of auth branches, and
 * guarantees a new route added later is protected by default.
 */
export const AuthGate = ({ children }: { children: ReactNode }) => {
  const { user, initialising, bootstrap } = useAuthStore();

  useEffect(() => {
    attachAuthExpiryListener();
    bootstrap();
  }, [bootstrap]);

  if (initialising) {
    return (
      <div className="min-h-screen grid place-items-center bg-paper-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border border-ink-300 border-t-vermilion-500 rounded-full animate-spin" />
          <p className="annotation">Checking your session</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  return <>{children}</>;
};

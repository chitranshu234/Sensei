import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const OAuth2Callback = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      // Store token in localStorage
      localStorage.setItem('auth_token', token);
      
      // Force reload to let AuthGate pick up the token and fetch user
      window.location.href = '/';
    } else {
      navigate('/login');
    }
  }, [token, navigate]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <span className="h-6 w-6 rounded-full border-2 border-ink-200 border-t-ink-900 animate-spin" />
        <p className="text-sm text-ink-500">Completing sign in…</p>
      </div>
    </div>
  );
};

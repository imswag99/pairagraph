import { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

// Renders Google's own button via Google Identity Services (loaded as a
// <script> tag in index.html) and forwards the resulting ID token to the backend.
export function GoogleSignInButton({ onSuccess, onError }) {
  const buttonRef = useRef(null);
  const { loginWithGoogle } = useAuth();

  useEffect(() => {
    let cancelled = false;

    function renderWhenReady() {
      if (cancelled) return;
      if (!window.google?.accounts?.id || !buttonRef.current) {
        setTimeout(renderWhenReady, 100);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            await loginWithGoogle(response.credential);
            onSuccess?.();
          } catch (err) {
            onError?.(err.message);
          }
        },
      });

      // Google's button API only accepts a fixed pixel width, so it's measured
      // from the actual (responsive, CSS-sized) container instead of hardcoded
      // — a fixed 280px overflowed narrow phone screens.
      const width = Math.min(280, buttonRef.current.offsetWidth || 280);
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width,
      });
    }

    renderWhenReady();
    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle]);

  return <div ref={buttonRef} className="w-full max-w-[280px]" />;
}

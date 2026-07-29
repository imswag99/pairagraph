import { useEffect, useRef } from 'react';

// Renders Cloudflare's own widget via the Turnstile script (loaded as a
// <script> tag in index.html, no npm wrapper) — same poll-until-ready pattern
// GoogleSignInButton uses, since this script also loads async defer and may
// not be ready yet when this component first mounts.
export function TurnstileWidget({ onVerify, onExpire, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    function renderWhenReady() {
      if (cancelled) return;
      if (!window.turnstile || !containerRef.current) {
        setTimeout(renderWhenReady, 100);
        return;
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: import.meta.env.VITE_CAPTCHA_SITE_KEY,
        callback: onVerify,
        'expired-callback': onExpire,
        'error-callback': onError,
      });
    }

    renderWhenReady();
    return () => {
      cancelled = true;
      if (widgetIdRef.current != null) {
        window.turnstile?.remove(widgetIdRef.current);
      }
    };
  }, [onVerify, onExpire, onError]);

  return <div ref={containerRef} />;
}

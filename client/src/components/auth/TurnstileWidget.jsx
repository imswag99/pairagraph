import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Renders Cloudflare's own widget via the Turnstile script (loaded as a
// <script> tag in index.html, no npm wrapper) — same poll-until-ready pattern
// GoogleSignInButton uses, since this script also loads async defer and may
// not be ready yet when this component first mounts.
//
// Exposes reset() via ref: Turnstile tokens are single-use, so a form that
// fails for any *other* reason after CAPTCHA already passed (e.g. duplicate
// email) is left holding an already-spent token — the widget itself won't
// silently issue a new one, it has to be told to via reset().
export const TurnstileWidget = forwardRef(function TurnstileWidget(
  { onVerify, onExpire, onError },
  ref
) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current != null) {
        window.turnstile?.reset(widgetIdRef.current);
      }
    },
  }));

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
});

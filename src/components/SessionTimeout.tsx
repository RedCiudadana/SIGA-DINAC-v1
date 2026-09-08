import { useEffect, useRef, useCallback } from 'react';

interface SessionTimeoutProps {
  timeoutMinutes: number;
  warningMinutes: number;
  onTimeout: () => void;
  onWarning: () => void;
  onActivity: () => void;
}

export function SessionTimeout({
  timeoutMinutes,
  warningMinutes,
  onTimeout,
  onWarning,
  onActivity,
}: SessionTimeoutProps) {
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  const warningMs = warningMinutes * 60 * 1000;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (warningShownRef.current) {
      warningShownRef.current = false;
      onActivity();
    }
  }, [onActivity]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll', 'click'];

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > 5000) {
        resetTimer();
      }
    };

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= timeoutMs) {
        onTimeout();
        clearInterval(interval);
      } else if (elapsed >= timeoutMs - warningMs && !warningShownRef.current) {
        warningShownRef.current = true;
        onWarning();
      }
    }, 10000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      clearInterval(interval);
    };
  }, [timeoutMs, warningMs, onTimeout, onWarning, resetTimer]);

  return null;
}

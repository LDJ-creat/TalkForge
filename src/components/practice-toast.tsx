"use client";

import { useEffect } from "react";

type PracticeToastProps = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

export function PracticeToast({
  message,
  onDismiss,
  durationMs = 3200,
}: PracticeToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(onDismiss, durationMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, message, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <div
      className="practice-toast"
      role="status"
      aria-live="polite"
      data-testid="practice-toast"
    >
      {message}
    </div>
  );
}

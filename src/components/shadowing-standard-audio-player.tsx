"use client";

import { useEffect, useRef, useState } from "react";

import type { ShadowingStandardAudio } from "@/domain/shadowing";
import { fetchShadowingItemAudioBlob } from "@/features/conversation/fetch-shadowing-audio-api";
import { shadowingCopy } from "@/lib/ui-copy";

const MAX_REASONABLE_DURATION_MS = 5 * 60 * 1000;

export function formatShadowingAudioDuration(
  standardAudio?: ShadowingStandardAudio,
): string | null {
  if (!standardAudio?.durationMs || standardAudio.durationMs <= 0) {
    return null;
  }

  if (
    standardAudio.durationMs > MAX_REASONABLE_DURATION_MS ||
    standardAudio.durationMs === standardAudio.sizeBytes
  ) {
    return null;
  }

  const seconds = standardAudio.durationMs / 1000;
  if (seconds < 10) {
    return `${seconds.toFixed(1)} 秒`;
  }

  return `${Math.round(seconds)} 秒`;
}

type ShadowingStandardAudioPlayerProps = {
  sessionId: string;
  itemId: string;
  standardAudio: ShadowingStandardAudio;
};

export function ShadowingStandardAudioPlayer({
  sessionId,
  itemId,
  standardAudio,
}: ShadowingStandardAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "playing" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const durationLabel = formatShadowingAudioDuration(standardAudio);

  async function ensureAudioReady(): Promise<HTMLAudioElement> {
    if (audioRef.current && objectUrlRef.current) {
      return audioRef.current;
    }

    setStatus("loading");
    setErrorMessage(null);

    const blob = await fetchShadowingItemAudioBlob(sessionId, itemId);
    const objectUrl = URL.createObjectURL(blob);
    objectUrlRef.current = objectUrl;

    const audio = new Audio(objectUrl);
    audioRef.current = audio;

    audio.addEventListener("ended", () => {
      setStatus("ready");
    });

    setStatus("ready");
    return audio;
  }

  async function handleTogglePlayback() {
    try {
      const audio = await ensureAudioReady();

      if (status === "playing") {
        audio.pause();
        setStatus("ready");
        return;
      }

      await audio.play();
      setStatus("playing");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : shadowingCopy.playbackFailed,
      );
    }
  }

  const isLoading = status === "loading";
  const isPlaying = status === "playing";
  const buttonLabel = isLoading
    ? shadowingCopy.loadingAudio
    : isPlaying
      ? shadowingCopy.pauseStandardAudio
      : shadowingCopy.playStandardAudio;

  return (
    <div className="shadowing-practice__audio" data-testid="shadowing-standard-audio-player">
      <button
        type="button"
        className="shadowing-practice__play-button"
        onClick={() => void handleTogglePlayback()}
        disabled={isLoading}
        aria-pressed={isPlaying}
        aria-label={buttonLabel}
      >
        {buttonLabel}
      </button>
      <p className="shadowing-practice__audio-status">
        {status === "error"
          ? (errorMessage ?? shadowingCopy.playbackFailed)
          : durationLabel
            ? shadowingCopy.audioReadyDuration(durationLabel)
            : shadowingCopy.audioReady}
      </p>
    </div>
  );
}

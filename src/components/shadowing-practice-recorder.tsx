"use client";

import { useEffect, useRef, useState } from "react";

import type { TurnPronunciationFeedback } from "@/domain/pronunciation-feedback";
import { submitShadowingPracticeRecording } from "@/features/conversation/submit-shadowing-practice-api";
import { shadowingCopy } from "@/lib/ui-copy";

import { PronunciationFeedbackView } from "./pronunciation-feedback-view";

const MIN_RECORDING_MS = 300;

type RecorderStatus = "idle" | "recording" | "evaluating" | "done" | "error";

type ShadowingPracticeRecorderProps = {
  sessionId: string;
  itemId: string;
  standardText: string;
};

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

export function ShadowingPracticeRecorder({
  sessionId,
  itemId,
  standardText,
}: ShadowingPracticeRecorderProps) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [feedback, setFeedback] = useState<TurnPronunciationFeedback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    setErrorMessage(null);
    setFeedback(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMessage(shadowingCopy.microphoneUnavailable);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        void handleRecordingStop(recorder);
      });

      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setStatus("recording");
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : shadowingCopy.microphoneUnavailable,
      );
    }
  }

  async function handleRecordingStop(recorder: MediaRecorder) {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const startedAt = startedAtRef.current ?? Date.now();
    const durationMs = Date.now() - startedAt;
    startedAtRef.current = null;

    const blob = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    });
    chunksRef.current = [];

    if (durationMs < MIN_RECORDING_MS || blob.size <= 0) {
      setStatus("error");
      setErrorMessage(shadowingCopy.recordingTooShort);
      return;
    }

    setStatus("evaluating");

    try {
      const result = await submitShadowingPracticeRecording({
        sessionId,
        itemId,
        audioBlob: blob,
        durationMs,
      });

      setFeedback(result.feedback);
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : shadowingCopy.evaluationFailed,
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function handleToggleRecording() {
    if (status === "recording") {
      stopRecording();
      return;
    }

    if (status === "evaluating") {
      return;
    }

    void startRecording();
  }

  const isRecording = status === "recording";
  const isEvaluating = status === "evaluating";
  const buttonLabel = isRecording
    ? shadowingCopy.stopRecording
    : isEvaluating
      ? shadowingCopy.evaluatingRecording
      : shadowingCopy.startRecording;

  return (
    <div className="shadowing-practice__recorder" data-testid="shadowing-practice-recorder">
      <button
        type="button"
        className={`shadowing-practice__mic-button${
          isRecording ? " shadowing-practice__mic-button--active" : ""
        }`}
        onClick={handleToggleRecording}
        disabled={isEvaluating}
        aria-pressed={isRecording}
        aria-label={buttonLabel}
      >
        {buttonLabel}
      </button>
      <p className="shadowing-practice__recorder-hint">
        {isRecording
          ? shadowingCopy.recordingHint
          : shadowingCopy.recorderPrompt.replace("{text}", standardText)}
      </p>
      {status === "error" && errorMessage ? (
        <p className="shadowing-practice__recorder-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {feedback && feedback.evaluationStatus === "done" ? (
        <PronunciationFeedbackView
          feedback={feedback}
          idPrefix={`${itemId}-practice`}
          className="shadowing-practice__pronunciation"
          testId="shadowing-practice-pronunciation-feedback"
        />
      ) : null}
    </div>
  );
}

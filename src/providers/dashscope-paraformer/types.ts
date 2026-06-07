export type DashScopeParaformerWord = {
  begin_time: number;
  end_time: number;
  text: string;
  punctuation?: string;
};

export type DashScopeParaformerSentence = {
  begin_time: number;
  end_time: number | null;
  text: string;
  heartbeat?: boolean | null;
  sentence_end: boolean;
  emo_tag?: string;
  emo_confidence?: number;
  words?: DashScopeParaformerWord[];
};

export type DashScopeParaformerResultGeneratedEvent = {
  header: {
    task_id: string;
    event: "result-generated";
    attributes?: Record<string, unknown>;
  };
  payload: {
    output: {
      sentence: DashScopeParaformerSentence;
    };
    usage: {
      duration: number;
    } | null;
  };
};

export type DashScopeParaformerTaskStartedEvent = {
  header: {
    task_id: string;
    event: "task-started";
    attributes?: Record<string, unknown>;
  };
  payload: Record<string, never>;
};

export type DashScopeParaformerTaskFinishedEvent = {
  header: {
    task_id: string;
    event: "task-finished";
    attributes?: Record<string, unknown>;
  };
  payload: {
    output: Record<string, unknown>;
    usage: null;
  };
};

export type DashScopeParaformerTaskFailedEvent = {
  header: {
    task_id: string;
    event: "task-failed";
    error_code?: string;
    error_message?: string;
    attributes?: Record<string, unknown>;
  };
  payload: Record<string, never>;
};

export type DashScopeParaformerServerEvent =
  | DashScopeParaformerTaskStartedEvent
  | DashScopeParaformerResultGeneratedEvent
  | DashScopeParaformerTaskFinishedEvent
  | DashScopeParaformerTaskFailedEvent;

export type DashScopeParaformerTranscriptionResult = {
  sentences: DashScopeParaformerSentence[];
  durationSec?: number;
};

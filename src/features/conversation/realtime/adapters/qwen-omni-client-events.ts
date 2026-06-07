import {
  buildQwenOmniOpeningSpeechEvents,
  buildQwenOmniOpeningUserItemEvent,
  buildQwenOmniResponseCreateEvent,
} from "@/providers/qwen-omni/session-config";

export function buildQwenOmniResponseCancelEvent() {
  return {
    type: "response.cancel",
  };
}

export {
  buildQwenOmniOpeningSpeechEvents,
  buildQwenOmniOpeningUserItemEvent,
  buildQwenOmniResponseCreateEvent,
};

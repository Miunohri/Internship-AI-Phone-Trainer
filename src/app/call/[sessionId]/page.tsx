"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import NavBar from "@/components/NavBar";
import {
  createAiReply,
  createTurn,
  endSession,
  getTurns,
  type Turn,
} from "@/lib/api";

type VoiceState = "idle" | "connecting" | "connected" | "error";

type RealtimeEvent = {
  type?: string;
  transcript?: string;
  item_id?: string;
  response_id?: string;
  content_index?: number;
  error?: {
    message?: string;
  };
};

function getVoiceStatusLabel(state: VoiceState) {
  switch (state) {
    case "connecting":
      return "Connecting microphone...";
    case "connected":
      return "Voice connected";
    case "error":
      return "Voice disconnected";
    default:
      return "Voice not connected";
  }
}

export default function CallPage() {
  const router = useRouter();
  const { status } = useSession();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");
  const [error, setError] = useState("");

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [micMuted, setMicMuted] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const savedVoiceEventsRef = useRef<Set<string>>(new Set());
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());

  const closeVoiceConnection = useCallback((updateState = true) => {
    const dataChannel = dataChannelRef.current;
    dataChannelRef.current = null;

    if (dataChannel) {
      dataChannel.onopen = null;
      dataChannel.onclose = null;
      dataChannel.onerror = null;
      dataChannel.onmessage = null;

      if (dataChannel.readyState !== "closed") {
        dataChannel.close();
      }
    }

    const peerConnection = peerConnectionRef.current;
    peerConnectionRef.current = null;

    if (peerConnection) {
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
    }

    const localStream = localStreamRef.current;
    localStreamRef.current = null;

    localStream?.getTracks().forEach((track) => track.stop());

    const remoteAudio = remoteAudioRef.current;

    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
    }

    if (updateState) {
      setVoiceState("idle");
      setMicMuted(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated") {
      router.replace("/");
      return;
    }

    let active = true;

    async function poll() {
      try {
        const data = await getTurns(sessionId);

        if (active) {
          setTurns(data);
        }
      } catch {
        if (active) {
          setError("Could not load the transcript.");
        }
      }
    }

    void poll();

    const timer = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [router, sessionId, status]);

  useEffect(() => {
    return () => {
      closeVoiceConnection(false);
    };
  }, [closeVoiceConnection]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length]);

  function queueVoiceTurn(
    speaker: "ADVISOR" | "AI_CUSTOMER",
    text: string,
    eventKey: string
  ) {
    const normalizedText = text.trim();

    if (
      !normalizedText ||
      savedVoiceEventsRef.current.has(eventKey)
    ) {
      return;
    }

    savedVoiceEventsRef.current.add(eventKey);

    persistQueueRef.current = persistQueueRef.current.then(async () => {
      try {
        const created = await createTurn(sessionId, {
          speaker,
          text: normalizedText,
        });

        setTurns((current) => {
          if (current.some((turn) => turn.id === created.id)) {
            return current;
          }

          return [...current, created].sort(
            (a, b) => a.sequence - b.sequence
          );
        });
      } catch {
        savedVoiceEventsRef.current.delete(eventKey);
        setError(
          "A voice transcript line could not be saved. You may continue the call."
        );
      }
    });
  }

  function handleRealtimeEvent(message: MessageEvent) {
    if (typeof message.data !== "string") {
      return;
    }

    let event: RealtimeEvent;

    try {
      event = JSON.parse(message.data) as RealtimeEvent;
    } catch {
      return;
    }

    if (
      event.type ===
      "conversation.item.input_audio_transcription.completed"
    ) {
      const eventKey = [
        event.type,
        event.item_id,
        event.content_index,
        event.transcript,
      ].join(":");

      queueVoiceTurn(
        "ADVISOR",
        event.transcript ?? "",
        eventKey
      );

      return;
    }

    if (event.type === "response.output_audio_transcript.done") {
      const eventKey = [
        event.type,
        event.response_id,
        event.item_id,
        event.content_index,
        event.transcript,
      ].join(":");

      queueVoiceTurn(
        "AI_CUSTOMER",
        event.transcript ?? "",
        eventKey
      );

      return;
    }

    if (
      event.type ===
      "conversation.item.input_audio_transcription.failed"
    ) {
      setVoiceError(
        "One advisor statement could not be transcribed."
      );

      return;
    }

    if (event.type === "error") {
      setVoiceError(
        event.error?.message ??
          "The realtime voice service reported an error."
      );
    }
  }

  async function startVoiceCall() {
    if (
      voiceState === "connecting" ||
      voiceState === "connected"
    ) {
      return;
    }

    setVoiceState("connecting");
    setVoiceError("");
    setError("");
    setMicMuted(false);

    closeVoiceConnection(false);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "This browser does not support microphone access."
        );
      }

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      peerConnection.ontrack = (event) => {
        const remoteAudio = remoteAudioRef.current;

        if (!remoteAudio) {
          return;
        }

        remoteAudio.srcObject =
          event.streams[0] ??
          new MediaStream([event.track]);

        void remoteAudio.play().catch(() => {
          setVoiceError(
            "Customer audio is ready, but the browser blocked playback. Click the voice controls again."
          );
        });
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnectionRef.current !== peerConnection) {
          return;
        }

        if (peerConnection.connectionState === "connected") {
          setVoiceState("connected");
          return;
        }

        if (
          peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "disconnected"
        ) {
          closeVoiceConnection(false);
          setVoiceState("error");
          setVoiceError(
            "The voice connection was lost. Reconnect or continue using text."
          );
        }
      };

      const localStream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      localStreamRef.current = localStream;

      for (const track of localStream.getAudioTracks()) {
        peerConnection.addTrack(track, localStream);
      }

      const dataChannel =
        peerConnection.createDataChannel("oai-events");

      dataChannelRef.current = dataChannel;

      dataChannel.onmessage = handleRealtimeEvent;

      dataChannel.onopen = () => {
        if (dataChannelRef.current === dataChannel) {
          setVoiceState("connected");
        }
      };

      dataChannel.onerror = () => {
        if (dataChannelRef.current === dataChannel) {
          setVoiceError(
            "The voice event channel encountered an error."
          );
        }
      };

      dataChannel.onclose = () => {
        if (dataChannelRef.current === dataChannel) {
          closeVoiceConnection(false);
          setVoiceState("error");
          setVoiceError(
            "The voice connection closed. Reconnect or continue using text."
          );
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (!offer.sdp) {
        throw new Error(
          "The browser did not create a valid voice connection offer."
        );
      }

      const response = await fetch(
        `/api/sessions/${sessionId}/realtime`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        }
      );

      const responseText = await response.text();

      if (!response.ok) {
        let message =
          "Could not start the realtime voice connection.";

        try {
          const body = JSON.parse(responseText) as {
            error?: string;
          };

          if (body.error) {
            message = body.error;
          }
        } catch {
          // Keep the generic message for a non-JSON response.
        }

        throw new Error(message);
      }

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: responseText,
      });
    } catch (startError) {
      closeVoiceConnection(false);
      setVoiceState("error");

      if (
        startError instanceof DOMException &&
        startError.name === "NotAllowedError"
      ) {
        setVoiceError(
          "Microphone permission was denied. Allow microphone access in the browser, then try again."
        );

        return;
      }

      setVoiceError(
        startError instanceof Error
          ? startError.message
          : "Could not start the voice call."
      );
    }
  }

  function disconnectVoice() {
    closeVoiceConnection();
    setVoiceError("");
  }

  function toggleMicrophone() {
    const nextMuted = !micMuted;

    localStreamRef.current
      ?.getAudioTracks()
      .forEach((track) => {
        track.enabled = !nextMuted;
      });

    setMicMuted(nextMuted);
  }

  async function send() {
    const text = input.trim();

    if (
      !text ||
      sending ||
      voiceState === "connecting" ||
      voiceState === "connected"
    ) {
      return;
    }

    setSending(true);
    setError("");

    try {
      setInput("");

      await createAiReply(sessionId, text);

      const data = await getTurns(sessionId);
      setTurns(data);
    } catch {
      setError("Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  async function endCall() {
    if (ending) {
      return;
    }

    setEnding(true);
    setEndError("");

    localStreamRef.current
      ?.getAudioTracks()
      .forEach((track) => {
        track.enabled = false;
      });

    try {
      await new Promise((resolve) =>
        window.setTimeout(resolve, 500)
      );

      await persistQueueRef.current;
    } catch {
      setEndError(
        "Some final transcript activity may not have finished saving."
      );
    }

    closeVoiceConnection();

    try {
      await endSession(sessionId);
    } catch {
      setEndError(
        "Could not mark the session complete. Continuing to results."
      );
    }

    router.push(`/results/${sessionId}`);
  }

  const visibleTurns = turns.filter(
    (turn) => turn.speaker !== "SYSTEM"
  );

  const voiceActive =
    voiceState === "connecting" ||
    voiceState === "connected";

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <NavBar />

      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        className="hidden"
      />

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--jb-charcoal)]">
              Training Call In Progress
            </h1>

            <p className="text-xs text-slate-500">
              You are the advisor. Speak naturally or use the text fallback.
            </p>
          </div>

          <button
            onClick={endCall}
            disabled={ending}
            className="bg-red-700 hover:bg-red-800 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            {ending ? "Ending..." : "End Call"}
          </button>
        </div>

        <section className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    voiceState === "connected"
                      ? "bg-emerald-500"
                      : voiceState === "connecting"
                        ? "bg-amber-500"
                        : voiceState === "error"
                          ? "bg-red-500"
                          : "bg-slate-400"
                  }`}
                />

                <p className="text-sm font-semibold text-[var(--jb-charcoal)]">
                  {getVoiceStatusLabel(voiceState)}
                </p>
              </div>

              <p className="text-xs text-slate-500 mt-1">
                The customer will hear your microphone and reply aloud.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!voiceActive && (
                <button
                  type="button"
                  onClick={startVoiceCall}
                  disabled={ending}
                  className="bg-[var(--jb-navy)] hover:opacity-90 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2 rounded transition-opacity"
                >
                  {voiceState === "error"
                    ? "Reconnect Voice"
                    : "Start Voice Call"}
                </button>
              )}

              {voiceState === "connected" && (
                <button
                  type="button"
                  onClick={toggleMicrophone}
                  disabled={ending}
                  className="border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-sm font-medium px-4 py-2 rounded"
                >
                  {micMuted ? "Unmute Microphone" : "Mute Microphone"}
                </button>
              )}

              {voiceActive && (
                <button
                  type="button"
                  onClick={disconnectVoice}
                  disabled={ending}
                  className="border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 text-sm font-medium px-4 py-2 rounded"
                >
                  Disconnect Voice
                </button>
              )}
            </div>
          </div>

          {micMuted && (
            <p className="text-xs text-amber-700 mt-3">
              Your microphone is muted.
            </p>
          )}

          {voiceError && (
            <p className="text-sm text-red-600 mt-3">
              {voiceError}
            </p>
          )}
        </section>

        {error && (
          <p className="text-sm text-red-600 mb-2">
            {error}
          </p>
        )}

        {endError && (
          <p className="text-sm text-[var(--jb-blue)] mb-2">
            {endError}
          </p>
        )}

        <div className="flex-1 bg-white rounded-lg shadow p-4 overflow-y-auto mb-4 min-h-[380px] max-h-[480px]">
          {visibleTurns.length === 0 && (
            <p className="text-sm text-slate-400 text-center mt-10">
              Start voice and greet the customer, or type a greeting below.
            </p>
          )}

          <ul className="space-y-3">
            {visibleTurns.map((turn) => {
              const isAdvisor =
                turn.speaker === "ADVISOR";

              return (
                <li
                  key={turn.id}
                  className={`flex ${
                    isAdvisor
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
                      isAdvisor
                        ? "bg-[var(--jb-navy)] text-white"
                        : "bg-slate-200 text-[var(--jb-charcoal)]"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wide opacity-70 mb-1">
                      {isAdvisor ? "You" : "Customer"}
                    </p>

                    <p>{turn.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div ref={bottomRef} />
        </div>

        <div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void send();
                }
              }}
              disabled={voiceActive || ending}
              placeholder={
                voiceActive
                  ? "Disconnect voice to use the text fallback"
                  : "Type what you would say to the customer"
              }
              className="flex-1 border border-slate-300 rounded px-4 py-2 text-sm focus:outline-none focus:border-[var(--jb-blue)] disabled:bg-slate-100"
            />

            <button
              onClick={send}
              disabled={
                sending ||
                voiceActive ||
                ending ||
                !input.trim()
              }
              className="bg-[var(--jb-navy)] hover:opacity-90 disabled:bg-slate-300 text-white text-sm font-medium px-5 py-2 rounded transition-opacity"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-2">
            Text mode remains available whenever voice is disconnected.
          </p>
        </div>
      </main>
    </div>
  );
}

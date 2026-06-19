import { useEffect, useState, useCallback, useRef } from 'react';

export interface VoiceCommand {
  command: string | RegExp;
  callback: (match?: any) => void;
}

export type VoiceErrorCode = 'denied' | 'unsupported' | 'generic';

export interface VoiceError {
  code: VoiceErrorCode;
  /** Raw detail string (mostly for the generic case). Not user-facing on its own. */
  detail?: string;
}

interface Options {
  /** BCP-47 language tag (e.g. "en-US", "ja-JP", "ko-KR"). Defaults to "en-US". */
  lang?: string;
}

/**
 * Wraps the browser SpeechRecognition API.
 *
 * Why the ref dance:
 * - The previous version listed `commands` and `isListening` in its useEffect
 *   deps, so every parent re-render rebuilt the SpeechRecognition object,
 *   which made the mic flicker and dropped recognition mid-sentence.
 * - Now: the recognition object is built ONCE per language. Commands and
 *   `active` are read from refs, so updating them never tears down the engine.
 */
export const useVoiceCommands = (
  commands: VoiceCommand[],
  active: boolean = true,
  options: Options = {},
) => {
  const lang = options.lang ?? 'en-US';
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<VoiceError | null>(null);

  const recognitionRef = useRef<any>(null);
  const commandsRef = useRef<VoiceCommand[]>(commands);
  const activeRef = useRef<boolean>(active);
  const wantListeningRef = useRef<boolean>(false);

  // Keep refs in sync without triggering effect re-runs.
  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  useEffect(() => {
    activeRef.current = active;
    if (!active) {
      wantListeningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* noop */
      }
    }
  }, [active]);

  const startListening = useCallback(async () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (wantListeningRef.current) return;

    try {
      // Force the permission prompt before starting.
      await navigator.mediaDevices.getUserMedia({ audio: true });
      // Tiny delay so the hardware is ready before SpeechRecognition starts.
      await new Promise((resolve) => setTimeout(resolve, 100));

      wantListeningRef.current = true;
      recognition.start();
      setIsListening(true);
      setError(null);
    } catch (e: any) {
      wantListeningRef.current = false;
      console.error('Speech recognition start failed', e);
      if (
        e?.name === 'NotAllowedError' ||
        e?.message === 'Permission denied' ||
        e?.name === 'PermissionDeniedError'
      ) {
        setError({ code: 'denied' });
      } else {
        setError({ code: 'generic', detail: String(e?.message ?? e) });
      }
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    setIsListening(false);
  }, []);

  // Build the recognition object ONCE per language. Everything else is read
  // through refs so we do not bounce the engine on parent re-renders.
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError({ code: 'unsupported' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript: string = event.results[last][0].transcript
        .toLowerCase()
        .trim();
      for (const { command, callback } of commandsRef.current) {
        if (typeof command === 'string') {
          if (transcript.includes(command.toLowerCase())) {
            callback(transcript);
            break;
          }
        } else if (command instanceof RegExp) {
          const match = transcript.match(command);
          if (match) {
            callback(match);
            break;
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      // eslint-disable-next-line no-console
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError({ code: 'denied' });
        wantListeningRef.current = false;
        setIsListening(false);
      } else if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      } else {
        setError({ code: 'generic', detail: String(event.error) });
        wantListeningRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (activeRef.current && wantListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Voice auto-restart failed', e);
        }
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      wantListeningRef.current = false;
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  return { isListening, error, startListening, stopListening };
};

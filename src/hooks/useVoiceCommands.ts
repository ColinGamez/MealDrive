import { useEffect, useState, useCallback, useRef } from 'react';

export interface VoiceCommand {
  command: string | RegExp;
  callback: (match?: any) => void;
}

export const useVoiceCommands = (commands: VoiceCommand[], active: boolean = true) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(async () => {
    if (recognitionRef.current) {
      if (isListening) {
        console.log('Speech recognition already listening');
        return;
      }
      try {
        // Explicitly request permission first to force the prompt
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Small delay to ensure hardware is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        recognitionRef.current.start();
        setIsListening(true);
        setError(null);
      } catch (e: any) {
        console.error('Speech recognition start failed', e);
        if (e.name === 'NotAllowedError' || e.message === 'Permission denied' || e.name === 'PermissionDeniedError') {
          setError('Microphone access denied. Please click the lock icon in your browser address bar and set Microphone to "Allow". If that doesn\'t work, check your browser\'s global microphone settings or try refreshing the page.');
        } else {
          setError(`Could not start microphone: ${e.message}`);
        }
        setIsListening(false);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.toLowerCase().trim();
      console.log('Voice command received:', transcript);

      for (const { command, callback } of commands) {
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
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone access denied. Please click the lock icon in your browser address bar and set Microphone to "Allow". If that doesn\'t work, check your browser\'s global microphone settings or try refreshing the page.');
      } else if (event.error === 'no-speech') {
        // Ignore no-speech errors as they are common and handled by auto-restart
        return;
      } else if (event.error === 'aborted') {
        // Aborted usually means it was stopped manually or by another process
        console.log('Speech recognition aborted');
        return;
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      if (active && isListening && !error) {
        // Auto-restart if it was supposed to be listening and no fatal error
        try {
          recognition.start();
        } catch (e) {
          // If start fails here, it might already be starting or have a permission issue
          console.warn('Auto-restart failed', e);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    // We don't auto-start here to avoid 'not-allowed' on page load without gesture
    // The UI will handle the initial start via a button click

    return () => {
      recognition.stop();
    };
  }, [commands, active, isListening, error]);

  return { isListening, error, startListening, stopListening };
};


"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/hooks/use-settings';

type VoiceRecorderProps = {
  onRecordingComplete: (audioBlob: Blob) => void;
  isProcessing: boolean;
};

export function VoiceRecorder({ onRecordingComplete, isProcessing }: VoiceRecorderProps) {
  const { settings } = useSettings();
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const spacebarHeldRef = useRef(false);

  const checkMicPermission = useCallback(async () => {
    try {
      // Check permission status without prompting
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permissionStatus.state === 'granted') {
        setHasPermission(true);
      } else if (permissionStatus.state === 'denied') {
        setHasPermission(false);
      } else {
        setHasPermission(null); // Prompt needed
      }
      permissionStatus.onchange = () => {
        setHasPermission(permissionStatus.state === 'granted');
      };
    } catch (error) {
      console.error("Permissions API not supported, falling back to getUserMedia check", error);
      setHasPermission(null); // Fallback to prompt on action
    }
  }, []);

  useEffect(() => {
    checkMicPermission();
  }, [checkMicPermission]);

  const stopSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };
  
  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return;
    
    if (hasPermission === false) {
      alert('Microphone access is denied. Please enable it in your browser settings.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setHasPermission(true);
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        stopSilenceTimer();
        if (audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            onRecordingComplete(audioBlob);
        }
        stopMediaStream();
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Setup for intelligent stop
      if (settings.micMode === 'tap' && settings.intelligentStopDuration > 0) {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
        
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkForSilence = () => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording' || !analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((acc, val) => acc + val, 0);
          const isSilent = sum < bufferLength * 2; // Heuristic for silence

          if (isSilent) {
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                stopRecording();
              }, settings.intelligentStopDuration * 1000);
            }
          } else {
            stopSilenceTimer();
          }
          
          requestAnimationFrame(checkForSilence);
        };
        requestAnimationFrame(checkForSilence);
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setHasPermission(false);
      alert('Could not access microphone. Please check permissions and try again.');
    }
  }, [isRecording, isProcessing, hasPermission, settings.micMode, settings.intelligentStopDuration, onRecordingComplete, stopMediaStream, stopRecording]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || !settings.spacebarToTalk || spacebarHeldRef.current) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      event.preventDefault();
      spacebarHeldRef.current = true;
      startRecording();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || !settings.spacebarToTalk || !spacebarHeldRef.current) {
        return;
      }
      event.preventDefault();
      spacebarHeldRef.current = false;
      stopRecording();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (isRecording) {
        stopRecording();
      }
    };
  }, [settings.spacebarToTalk, startRecording, stopRecording, isRecording]);

  const handleTap = () => {
    if (settings.micMode !== 'tap') return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  const handlePointerDown = () => {
    if (settings.micMode === 'hold') {
      startRecording();
    }
  };

  const handlePointerUp = () => {
    if (settings.micMode === 'hold') {
      stopRecording();
    }
  };

  return (
    <Button
      onClick={handleTap}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp} // Stop if user's finger leaves the button
      disabled={isProcessing || (hasPermission === null && settings.micMode === 'tap')}
      size="lg"
      className={cn(
        'w-20 h-20 rounded-full transition-all duration-300 ease-in-out touch-none',
        'bg-accent hover:bg-accent/90 text-accent-foreground',
        'shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-100',
        'focus-visible:ring-4 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isRecording && 'bg-red-500 hover:bg-red-600 animate-pulse'
      )}
      aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
    >
      {isRecording ? (
        <Square className="w-8 h-8 fill-current" />
      ) : (
        <Mic className="w-8 h-8" />
      )}
    </Button>
  );
}

    
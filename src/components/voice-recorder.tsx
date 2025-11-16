
"use client";

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/hooks/use-settings';

type VoiceRecorderProps = {
  onRecordingComplete: (audioBlob: Blob) => void;
  isProcessing: boolean;
};

export type VoiceRecorderRef = {
    startRecording: () => void;
    stopRecording: () => void;
};

export const VoiceRecorder = forwardRef<VoiceRecorderRef, VoiceRecorderProps>(
    ({ onRecordingComplete, isProcessing }, ref) => {
        const { settings } = useSettings();
        const [isRecording, setIsRecording] = useState(false);
        const [hasPermission, setHasPermission] = useState(true);
        const mediaRecorderRef = useRef<MediaRecorder | null>(null);
        const audioChunksRef = useRef<Blob[]>([]);
        const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
        const audioContextRef = useRef<AudioContext | null>(null);
        const analyserRef = useRef<AnalyserNode | null>(null);
        const streamRef = useRef<MediaStream | null>(null);

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
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
            }
        }, []);

        const startRecording = useCallback(async () => {
            if (isRecording || isProcessing) return;

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
                setIsRecording(false);
                stopSilenceTimer();
                if (audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    onRecordingComplete(audioBlob);
                }
                stopMediaStream();
            };
            
            mediaRecorderRef.current.onerror = (event) => {
                console.error('MediaRecorder error:', event);
                setIsRecording(false);
                stopMediaStream();
            }

            mediaRecorderRef.current.start();
            setIsRecording(true);

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
                const isSilent = sum < bufferLength * 2;

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
            alert('Could not access microphone. Please enable it in your browser settings and refresh the page.');
            }
        }, [isRecording, isProcessing, settings.micMode, settings.intelligentStopDuration, onRecordingComplete, stopMediaStream, stopRecording]);

        useImperativeHandle(ref, () => ({
            startRecording,
            stopRecording,
        }));

        useEffect(() => {
            // Cleanup on unmount
            return () => {
                if (isRecording) {
                    stopRecording();
                }
            };
        }, [isRecording, stopRecording]);

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
            onPointerLeave={handlePointerUp}
            disabled={isProcessing || !hasPermission}
            size="lg"
            className={cn(
                'w-20 h-20 rounded-full transition-all duration-300 ease-in-out touch-none',
                'bg-accent hover:bg-accent/90 text-accent-foreground',
                'shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-100',
                'focus-visible:ring-4 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isRecording && 'bg-red-500 hover:bg-red-600 animate-pulse'
            )}
            style={isRecording ? { animationDuration: '1.33s' } : {}}
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
);

VoiceRecorder.displayName = 'VoiceRecorder';


'use server';

import { DeepgramClient, createClient } from '@deepgram/sdk';
import { analyzeTaskDetails, AnalyzeTaskDetailsOutput } from '@/ai/flows/analyze-task-details';

export async function processVoiceCommand(formData: FormData): Promise<{ transcript: string, analysis: AnalyzeTaskDetailsOutput | null }> {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!deepgramApiKey) {
    throw new Error("Deepgram API key is not configured.");
  }
  if (!groqApiKey) {
    throw new Error("Groq API key is not configured.");
  }

  const deepgram = createClient(deepgramApiKey);

  const file = formData.get('audio') as File;
  if (!file || file.size === 0) {
    throw new Error('No audio file provided.');
  }
  
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    // 1. Get transcription from Deepgram
    const { result, error: deepgramError } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: 'nova-3',
        smart_format: true,
      }
    );

    if (deepgramError) {
      console.error("Deepgram transcription error:", JSON.stringify(deepgramError, null, 2));
      throw new Error(deepgramError.message || 'Transcription service returned an error.');
    }

    const transcript = result?.results.channels[0].alternatives[0].transcript || '';

    if (!transcript) {
      // If transcription is empty, no need to call Groq
      return { transcript: '', analysis: null };
    }

    // 2. Immediately analyze the transcript with Groq
    const analysis = await analyzeTaskDetails({ taskDescription: transcript });
    return { transcript, analysis };

  } catch (error) {
    console.error("Error during voice command processing:", error);
    // Re-throw the error to be caught by the client
    if (error instanceof Error) {
        throw new Error(error.message);
    }
    throw new Error("An unknown error occurred during voice command processing.");
  }
}


export async function getWeatherData(latitude?: number, longitude?: number) {
  try {
    const locationQuery = latitude && longitude ? `${latitude},${longitude}` : '';
    const response = await fetch(`http://wttr.in/${locationQuery}?format=j1`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Weather API failed with status: ${response.status}`);
    }
    const data = await response.json();
    return data.current_condition[0];
  } catch (error) {
    console.error("Could not fetch weather data:", error);
    return null;
  }
}

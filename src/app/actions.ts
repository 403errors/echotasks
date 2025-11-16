'use server';

import { DeepgramClient, createClient } from '@deepgram/sdk';
import { analyzeTaskDetails, AnalyzeTaskDetailsOutput } from '@/ai/flows/analyze-task-details';

export async function getTranscription(formData: FormData) {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

  if (!deepgramApiKey) {
    throw new Error("Deepgram API key is not configured. Please set the DEEPGRAM_API_KEY environment variable.");
  }

  const deepgram = createClient(deepgramApiKey);

  const file = formData.get('audio') as File;
  if (!file || file.size === 0) {
    throw new Error('No audio file provided.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: 'nova-2',
        smart_format: true,
      }
    );

    if (error) {
      console.error("Deepgram transcription error:", JSON.stringify(error, null, 2));
      throw new Error(error.message || 'Transcription service returned an error.');
    }

    if (result) {
      const transcript = result.results.channels[0].alternatives[0].transcript;
      if (transcript) {
        return transcript;
      }
    }
    
    // If we get here, it means transcription result was empty.
    return '';

  } catch (error) {
    console.error("Error during transcription:", error);
    if (error instanceof Error) {
        // Re-throw the actual error message
        throw new Error(error.message);
    }
    // Fallback error
    throw new Error("An unknown error occurred during transcription.");
  }
}

export async function analyzeTask(taskDescription: string): Promise<AnalyzeTaskDetailsOutput | null> {
    if (!taskDescription) return null;
    
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable in your .env file.");
    }

    try {
        const result = await analyzeTaskDetails({ taskDescription });
        return result;
    } catch (error) {
        console.error("Error analyzing task:", error);
        if (error instanceof Error) {
            // Re-throw with a more user-friendly message for the UI
            throw new Error(`Task analysis failed. This could be due to an invalid API key or a network issue.`);
        }
        throw new Error("Task analysis failed. An unknown error occurred.");
    }
}


export async function getWeatherData() {
  try {
    const response = await fetch('http://wttr.in/?format=j1', { cache: 'no-store' });
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

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// This file is now only used for Genkit's internal setup, 
// but is not directly involved in the OpenAI call.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

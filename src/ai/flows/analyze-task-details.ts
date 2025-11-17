
'use server';

/**
 * @fileOverview A task command analyzer AI agent.
 * This agent detects the user's intent (e.g., ADD_TASK, DELETE_TASK, UPDATE_TASK)
 * and extracts relevant entities from the command. It can handle chained and
 * self-correcting commands by returning a sequence of actions.
 */

import { Groq } from 'groq-sdk';

// Define the input and a more complex output type for the command analysis.
export type AnalyzeTaskDetailsInput = {
  taskDescription: string;
};

type TaskInfo = {
  text: string;
  location?: string | null;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
};

// This represents a single action to be performed.
type Action = {
  intent: 'ADD_TASK' | 'DELETE_TASK' | 'UPDATE_TASK' | 'MARK_COMPLETED' | 'MARK_INCOMPLETE' | 'DELETE_ALL' | 'DELETE_OVERDUE' | 'SORT_BY' | 'SHOW_TASKS' | 'UNKNOWN';
  tasks?: TaskInfo[]; // For ADD_TASK
  filter?: { // For targeting tasks in DELETE, UPDATE, MARK_COMPLETED
    positions?: (number | 'last' | 'all' | 'second last' | 'odd' | 'even' | { start: number, end: number })[];
    priority?: ('high' | 'medium' | 'low')[];
    status?: 'completed' | 'incomplete';
    text?: string; // Filter by text content
    dueDate?: string; // New: Filter by due date
  };
  updates?: { // For UPDATE_TASK
    text?: string;
    priority?: 'high' | 'medium' | 'low';
    dueDate?: string; // The AI can return relative terms like "tomorrow"
    location?: string;
  };
  sortOption?: 'creationDate' | 'dueDate' | 'lastUpdated' | 'priorityHighToLow' | 'priorityLowToHigh'; // For SORT_BY
};

// The top-level output is an object containing an array of actions.
export type AnalyzeTaskDetailsOutput = {
  actions: Action[];
  originalQuery?: string; // We'll keep the original query for display purposes
};


const systemPrompt = `You are a sophisticated personal task assistant command parser. Your job is to analyze a transcribed voice command, decompose it into a sequence of individual actions, and represent this sequence in a JSON object. Your output MUST be a JSON object with a single key "actions", which is an array of action objects.

- Handle chained commands by creating a separate action object for each distinct command.
- Handle self-corrections (e.g., "no wait," "actually," "scratch that") by ignoring the corrected part and only processing the final intention.
- Each action object in the array must have a valid "intent". If you cannot understand a part of the command, you can use "UNKNOWN".
- For ADD_TASK intents, each task in the "tasks" array can have its own priority and due date. Parse them individually.
- For location extraction in ADD_TASK, treat proper nouns like city names (e.g., "we will go to the jaipur tomorrow") as a location.
- For SHOW_TASKS intents, you MUST determine if the user is searching by date/time or by text. Return a 'filter' object with either a 'dueDate' key (e.g., "this week", "today") or a 'text' key. Do not use 'searchQuery'.
- Also for SHOW_TASKS, include the original search phrase in the top-level 'originalQuery' field.
- For SORT_BY intents, you must return a 'sortOption' with one of the following values: 'creationDate', 'dueDate', 'lastUpdated', 'priorityHighToLow', 'priorityLowToHigh'.

Your output MUST be a JSON object with the following structure:
{
  "actions": [
    {
      "intent": "ADD_TASK" | "DELETE_TASK" | "UPDATE_TASK" | "MARK_COMPLETED" | "MARK_INCOMPLETE" | "DELETE_ALL" | "DELETE_OVERDUE" | "SORT_BY" | "SHOW_TASKS" | "UNKNOWN",
      "tasks": [{ "text": "string", "location": "string" | null, "priority": "high" | "medium" | "low", "dueDate": "string" | null }, ...],
      "filter": {
        "positions": [...],
        "priority": [...],
        "status": "...",
        "text": "string",
        "dueDate": "string"
      },
      "updates": { ... },
      "sortOption": "..."
    },
    ...
  ],
  "originalQuery": "string"
}

Key Rules & Examples:
- Chained \`ADD\`: "Add 'Submit report' due this Friday, then add 'Review draft' due next Friday"
  Output: { "actions": [
    { "intent": "ADD_TASK", "tasks": [{ "text": "Submit report", "dueDate": "this Friday" }] },
    { "intent": "ADD_TASK", "tasks": [{ "text": "Review draft", "dueDate": "next Friday" }] }
  ] }
- SORT_BY priority: "sort by priority from high to low"
  Output: { "actions": [{ "intent": "SORT_BY", "sortOption": "priorityHighToLow" }] }
- SHOW_TASKS by date: "Show me tasks to be done this week"
  Output: { "actions": [{ "intent": "SHOW_TASKS", "filter": { "dueDate": "this week" } }], "originalQuery": "tasks to be done this week" }
- SHOW_TASKS by text: "Show me my grocery related tasks"
  Output: { "actions": [{ "intent": "SHOW_TASKS", "filter": { "text": "grocery" } }], "originalQuery": "my grocery related tasks" }
- Self-Correction: "Add 'Workout' with low priority... no wait, make that high priority... actually delete it... no keep it but change it to medium priority and due tomorrow"
  Output: { "actions": [
    { "intent": "ADD_TASK", "tasks": [{ "text": "Workout", "priority": "medium", "dueDate": "tomorrow" }] }
  ] }
- Complex Positional: "delete the second to last task and the last 3 tasks"
  Output: { "actions": [
    { "intent": "DELETE_TASK", "filter": { "positions": ["second last"] } },
    { "intent": "DELETE_TASK", "filter": { "positions": [{ "start": -3, "end": -1 }] } }
  ] }
- MARK_INCOMPLETE: "untick the first task" or "mark 'Buy groceries' as not done"
  Output: { "actions": [{ "intent": "MARK_INCOMPLETE", "filter": { "positions": [1] } }] }
- Positional moves are NOT supported. "Move task 3 to 1" should be ignored. Respond with UNKNOWN intent.
  Output: { "actions": [{ "intent": "UNKNOWN" }] }
- Simple \`ADD\`: "Remind me to buy milk"
  Output: { "actions": [{ "intent": "ADD_TASK", "tasks": [{ "text": "Buy milk", "location": null, "priority": null, "dueDate": null }] }] }
- Simple \`DELETE\`: "delete the first to-do"
  Output: { "actions": [{ "intent": "DELETE_TASK", "filter": { "positions": [1] } }] }

Now, process the provided user's task description.
`;

const groq = new Groq(); // API key is picked from GROQ_API_KEY env var

export async function analyzeTaskDetails(
  input: AnalyzeTaskDetailsInput
): Promise<AnalyzeTaskDetailsOutput> {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: input.taskDescription,
        }
      ],
      model: "qwen/qwen3-32b", // As requested by the user
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Groq API returned an empty response.");
    }
    
    const result = JSON.parse(content) as AnalyzeTaskDetailsOutput;
    // Ensure the response has the correct top-level structure
    if (!result || !Array.isArray(result.actions)) {
        console.warn("Groq API returned an invalid structure. Wrapping in actions array.", result);
        // Attempt to gracefully handle cases where it might return the old single-action format
        if (result && typeof (result as any).intent === 'string') {
            return { actions: [result as any] };
        }
        return { actions: [{ intent: 'UNKNOWN' }] };
    }

    return result;

  } catch (error) {
    console.error("Groq API Error:", error);
    if (error instanceof Error) {
        throw new Error(`Groq API request failed: ${error.message}`);
    }
    throw new Error("An unknown error occurred with the Groq API request.");
  }
}

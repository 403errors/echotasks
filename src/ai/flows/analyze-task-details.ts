
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

type DateShift = {
    days?: number;
    weeks?: number;
    months?: number;
};

// This represents a single action to be performed.
export type Action = {
  intent: 'ADD_TASK' | 'DELETE_TASK' | 'UPDATE_TASK' | 'MARK_COMPLETED' | 'MARK_INCOMPLETE' | 'DELETE_ALL' | 'DELETE_OVERDUE' | 'SORT_BY' | 'SHOW_TASKS' | 'QUERY_TASK_INFO' | 'UNKNOWN';
  tasks?: TaskInfo[]; // For ADD_TASK
  filter?: { // For targeting tasks in DELETE, UPDATE, MARK_COMPLETED
    positions?: (number | 'last' | 'all' | 'second last' | 'odd' | 'even' | { start: number, end: number })[];
    priority?: ('high' | 'medium' | 'low')[];
    status?: 'completed' | 'incomplete' | 'overdue';
    text?: string; // Filter by text content
    location?: string;
    dueDate?: string; // Filter by due date
  };
  updates?: { // For UPDATE_TASK
    text?: string;
    priority?: 'high' | 'medium' | 'low';
    dueDate?: string; // The AI can return relative terms like "tomorrow"
    dueDateShift?: DateShift; // For relative date changes like "push by 3 days"
    location?: string;
  };
  sortOption?: 'creationDate' | 'dueDate' | 'lastUpdated' | 'priorityHighToLow' | 'priorityLowToHigh'; // For SORT_BY
  queryType?: 'count' | 'details' | 'deadline' | 'priority'; // For QUERY_TASK_INFO
};

// The top-level output is an object containing an array of actions.
export type AnalyzeTaskDetailsOutput = {
  actions: Action[];
  originalQuery?: string; // We'll keep the original query for display purposes
};


const systemPrompt = `You are a sophisticated personal task assistant command parser. Your job is to analyze a transcribed voice command, decompose it into a sequence of individual actions, and represent this sequence in a JSON object. Your output MUST be a JSON object with a single key "actions", which is an array of action objects.

- Handle chained commands by creating a separate action object for each distinct command.
- Handle self-corrections (e.g., "no wait," "actually," "scratch that", "never mind") by ignoring the corrected part and only processing the final intention. If a command is fully cancelled ("never mind about shopping", "scratch that"), you can either return an empty actions array or an UNKNOWN intent.
- For commands that seem to add a task with details (e.g., "add task to submit the report by next friday and mark it as high priority"), your primary goal is to use the 'ADD_TASK' intent. The client will handle checking for duplicates. For example, parse this as: { "intent": "ADD_TASK", "tasks": [{ "text": "submit the report", "dueDate": "next friday", "priority": "high" }] }. Only use 'UPDATE_TASK' if the user explicitly says "update", "change", "move", or "push".
- For ADD_TASK intents, each task in the "tasks" array can have its own priority and due date. Parse them individually.
- For location extraction in ADD_TASK, treat proper nouns like city names (e.g., "we will go to the jaipur tomorrow") as a location.
- For SHOW_TASKS intents, you MUST determine if the user is searching by date/time, text, status, or priority. Return a 'filter' object with the appropriate keys. Include the original search phrase in the top-level 'originalQuery' field.
- For SORT_BY intents, you must return a 'sortOption' with one of the following values: 'creationDate', 'dueDate', 'lastUpdated', 'priorityHighToLow', 'priorityLowToHigh'.
- For MARK_COMPLETED intents based on a topic (e.g., "done with presentation"), extract the topic into the 'filter.text'. For "Everything's done!", interpret it as completing all of today's incomplete tasks.
- For UPDATE_TASK based on a topic (e.g., "make the report urgent"), extract the topic into 'filter.text' and the change into 'updates'.
- For relative date changes like "push by 3 days" or "delay by a week", use the 'updates.dueDateShift' object (e.g., { "days": 3 } or { "weeks": 1 }). For context-less commands like "push it", apply it to the 'last' task.
- For DELETE_TASK by topic ("delete swimming task"), extract the topic into 'filter.text'. For "never mind about shopping", convert it to a DELETE intent for "shopping".
- For bulk deletions ("delete all completed tasks"), use a filter like '{ "status": "completed" }'. For "clear everything for today", use '{ "dueDate": "today" }'.
- For QUERY_TASK_INFO, determine the user's question. For counts ("how many tasks"), use "queryType": "count". For details ("show details of first task"), use "queryType": "details". For specific fields ("what's the deadline"), use "queryType": "deadline".
- For MARK_INCOMPLETE intents like "untick the first task" or "mark 'Buy groceries' as not done", generate a 'MARK_INCOMPLETE' intent with the appropriate filter.

Your output MUST be a JSON object with the following structure:
{
  "actions": [
    {
      "intent": "ADD_TASK" | "DELETE_TASK" | "UPDATE_TASK" | "MARK_COMPLETED" | "MARK_INCOMPLETE" | "DELETE_ALL" | "DELETE_OVERDUE" | "SORT_BY" | "SHOW_TASKS" | "QUERY_TASK_INFO" | "UNKNOWN",
      "tasks": [{ "text": "string", "location": "string" | null, "priority": "high" | "medium" | "low", "dueDate": "string" | null }, ...],
      "filter": { "positions": [...], "priority": [...], "status": "...", "text": "string", "location": "string", "dueDate": "string" },
      "updates": { "text": "string", "priority": "high" | "medium" | "low", "dueDate": "string", "dueDateShift": { "days": "number", "weeks": "number" }, "location": "string" },
      "sortOption": "...",
      "queryType": "count" | "details" | "deadline" | "priority"
    },
    ...
  ],
  "originalQuery": "string"
}

Key Rules & Examples:
- "Add 'Submit report' due this Friday, then add 'Review draft' due next Friday" -> { "actions": [{ "intent": "ADD_TASK", "tasks": [{ "text": "Submit report", "dueDate": "this Friday" }] }, { "intent": "ADD_TASK", "tasks": [{ "text": "Review draft", "dueDate": "next Friday" }] }] }
- "Submitting the report the day after tomorrow" -> { "actions": [{ "intent": "ADD_TASK", "tasks": [{ "text": "Submitting the report", "dueDate": "day after tomorrow" }] }] }
- "Sort by priority from high to low" -> { "actions": [{ "intent": "SORT_BY", "sortOption": "priorityHighToLow" }] }
- "Show me tasks to be done this week" -> { "actions": [{ "intent": "SHOW_TASKS", "filter": { "dueDate": "this week" }, "originalQuery": "tasks to be done this week" }] }
- "Show me my grocery related tasks" -> { "actions": [{ "intent": "SHOW_TASKS", "filter": { "text": "grocery" }, "originalQuery": "my grocery related tasks" }] }
- "Show me overdue tasks" -> { "actions": [{ "intent": "SHOW_TASKS", "filter": { "status": "overdue" }, "originalQuery": "overdue tasks" }] }
- "I'm done with the presentation" -> { "actions": [{ "intent": "MARK_COMPLETED", "filter": { "text": "presentation" } }] }
- "Everything's done!" -> { "actions": [{ "intent": "MARK_COMPLETED", "filter": { "dueDate": "today", "status": "incomplete" } }] }
- "Make the report urgent" -> { "actions": [{ "intent": "UPDATE_TASK", "filter": { "text": "report" }, "updates": { "priority": "high" } }] }
- "This isn't important anymore" -> { "actions": [{ "intent": "UPDATE_TASK", "filter": { "positions": ["last"] }, "updates": { "priority": "low" } }] }
- "Push the submitting of report by 2 days" -> { "actions": [{ "intent": "UPDATE_TASK", "filter": { "text": "submitting of report" }, "updates": { "dueDateShift": { "days": 2 } } }] }
- "Push it by 3 days" -> { "actions": [{ "intent": "UPDATE_TASK", "filter": { "positions": ["last"] }, "updates": { "dueDateShift": { "days": 3 } } }] }
- "Move everything from today to tomorrow" -> { "actions": [{ "intent": "UPDATE_TASK", "filter": { "dueDate": "today" }, "updates": { "dueDate": "tomorrow" } }] }
- "Delete the swimming task" or "Never mind about the swimming" -> { "actions": [{ "intent": "DELETE_TASK", "filter": { "text": "swimming" } }] }
- "Delete all completed tasks" -> { "actions": [{ "intent": "DELETE_TASK", "filter": { "status": "completed" } }] }
- "Clear everything for today" -> { "actions": [{ "intent": "DELETE_TASK", "filter": { "dueDate": "today" } }] }
- "Untick the first task" or "mark 'Buy groceries' as not done" -> { "actions": [{ "intent": "MARK_INCOMPLETE", "filter": { "positions": [1] } }] }
- "How many tasks do I have?" -> { "actions": [{ "intent": "QUERY_TASK_INFO", "queryType": "count", "filter": {} }] }
- "How many things are due today?" -> { "actions": [{ "intent": "QUERY_TASK_INFO", "queryType": "count", "filter": { "dueDate": "today" } }] }
- "What's the deadline for the report?" -> { "actions": [{ "intent": "QUERY_TASK_INFO", "queryType": "deadline", "filter": { "text": "report" } }] }
- "Add 'Workout'... no wait, make that high priority... actually delete it... no keep it but change it to medium priority and due tomorrow" -> { "actions": [{ "intent": "ADD_TASK", "tasks": [{ "text": "Workout", "priority": "medium", "dueDate": "tomorrow" }] }] }
- "Make everything urgent" -> { "actions": [{ "intent": "UPDATE_TASK", "filter": { "status": "incomplete" }, "updates": { "priority": "high" } }] }
- "Move everything to next week" -> { "actions": [{ "intent": "UPDATE_TASK", "filter": { "status": "incomplete" }, "updates": { "dueDate": "next week" } }] }
- "Invalid commands: "Move task 3 to 1" -> { "actions": [{ "intent": "UNKNOWN" }] }

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
    
    // It's safer to parse and then validate.
    let result: AnalyzeTaskDetailsOutput;
    try {
        result = JSON.parse(content);
    } catch (e) {
        console.error("Groq API returned non-JSON content:", content);
        throw new Error("The AI service returned an invalid response. Please try again.");
    }
    
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
        // Check if the error message includes HTML, indicating a server-side issue from Groq/Cloudflare
        if (typeof error.message === 'string' && error.message.trim().toLowerCase().includes('<!doctype html>')) {
            throw new Error("The AI service (Groq) is currently experiencing technical difficulties. Please try again in a moment.");
        }
        // Re-throw other types of errors with a generic message
        throw new Error(`Groq API request failed: ${error.message}`);
    }
    // Fallback for unknown errors
    throw new Error("An unknown error occurred with the Groq API request.");
  }
}


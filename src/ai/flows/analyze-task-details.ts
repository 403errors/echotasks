
'use server';

/**
 * @fileOverview A task command analyzer AI agent.
 * This agent detects the user's intent (e.g., ADD_TASK, DELETE_TASK, UPDATE_TASK)
 * and extracts relevant entities from the command.
 */

const MODEL_NAME = 'gpt-4o-mini';
const API_URL = 'https://api.openai.com/v1/chat/completions';

// Define the input and a more complex output type for the command analysis.
export type AnalyzeTaskDetailsInput = {
  taskDescription: string;
};

type TaskInfo = {
  text: string;
  location?: string | null;
};

export type AnalyzeTaskDetailsOutput = {
  intent: 'ADD_TASK' | 'DELETE_TASK' | 'UPDATE_TASK' | 'MARK_COMPLETED' | 'DELETE_ALL' | 'DELETE_OVERDUE' | 'SORT_BY' | 'SHOW_TASKS' | 'UNKNOWN';
  tasks?: TaskInfo[]; // For ADD_TASK, now an array of objects
  filter?: { // For targeting tasks in DELETE, UPDATE, MARK_COMPLETED
    positions?: (number | 'last')[];
    priority?: ('high' | 'medium' | 'low')[];
    status?: 'completed' | 'incomplete';
  };
  updates?: { // For UPDATE_TASK
    text?: string;
    priority?: 'high' | 'medium' | 'low';
    dueDate?: string; // The AI can return relative terms like "tomorrow"
    location?: string;
  };
  sortOption?: 'creationDate' | 'dueDate' | 'lastUpdated' | 'priorityHighToLow' | 'priorityLowToHigh'; // For SORT_BY
  searchQuery?: string; // For SHOW_TASKS
};

const systemPrompt = `You are a sophisticated personal task assistant command parser. Your job is to analyze a transcribed voice command and determine the user's intent and the entities associated with that intent.

Your output MUST be a JSON object with the following structure:
{
  "intent": "ADD_TASK" | "DELETE_TASK" | "UPDATE_TASK" | "MARK_COMPLETED" | "DELETE_ALL" | "DELETE_OVERDUE" | "SORT_BY" | "SHOW_TASKS" | "UNKNOWN",
  "tasks": [{ "text": "string", "location": "string" | null }, ...],
  "filter": {
    "positions": ["last" | number],
    "priority": ["high" | "medium" | "low"],
    "status": "completed" | "incomplete"
  },
  "updates": {
    "text": "string",
    "priority": "high" | "medium" | "low",
    "dueDate": "string, e.g., 'tomorrow', 'next Friday'",
    "location": "string"
  },
  "sortOption": "creationDate" | "dueDate" | "lastUpdated" | "priorityHighToLow" | "priorityLowToHigh",
  "searchQuery": "string"
}

- "intent": The primary action.
- "tasks": For ADD_TASK, an array of objects. Each object must have a "text" property. The "location" property should be extracted ONLY if it's a physical place (e.g., 'home', 'office', 'the bank') where the task can be done. The subject of a task (like 'groceries') is NOT a location. If no location is mentioned, it must be null.
- "filter": Specifies which tasks to target.
  - "positions": 1-based indices. Recognize ordinals ("first", "second") and relative terms ("last", "final").
  - "priority": An array of priorities to filter by.
  - "status": Filter by whether tasks are done or not.
- "updates": For UPDATE_TASK, specifies what to change. The AI should extract what the new value should be.
- "sortOption": For SORT_BY, extract the sorting criteria. Map user phrases to the allowed values. e.g., "due date" -> "dueDate", "priority" -> "priorityHighToLow".
- "searchQuery": For SHOW_TASKS, this should be the keyword or phrase the user wants to filter by (e.g., "administrative", "grocery", "this week").

Examples:
- Input: "Remind me to buy milk by this Friday and it's super important"
  Output: { "intent": "ADD_TASK", "tasks": [{ "text": "Buy milk", "location": null }] }
- Input: "add tasks to walk the dog and buy groceries"
  Output: { "intent": "ADD_TASK", "tasks": [{ "text": "Walk the dog", "location": null }, { "text": "Buy groceries", "location": null }] }
- Input: "Call the doctor and buy groceries"
  Output: { "intent": "ADD_TASK", "tasks": [{ "text": "Call the doctor", "location": null }, { "text": "Buy groceries", "location": null }] }
- Input: "add a task to call mom at home"
  Output: { "intent": "ADD_TASK", "tasks": [{ "text": "Call mom", "location": "home" }] }
- Input: "delete the first to-do"
  Output: { "intent": "DELETE_TASK", "filter": { "positions": [1] } }
- Input: "delete the second and last tasks"
  Output: { "intent": "DELETE_TASK", "filter": { "positions": [2, "last"] } }
- Input: "complete the final task"
  Output: { "intent": "MARK_COMPLETED", "filter": { "positions": ["last"] } }
- Input: "update the last task's date to tomorrow"
  Output: { "intent": "UPDATE_TASK", "filter": { "positions": ["last"] }, "updates": { "dueDate": "tomorrow" } }
- Input: "change the first task to high priority"
  Output: { "intent": "UPDATE_TASK", "filter": { "positions": [1] }, "updates": { "priority": "high" } }
- Input: "delete all the tasks with high priority"
  Output: { "intent": "DELETE_TASK", "filter": { "priority": ["high"] } }
- Input: "update all the medium priority tasks to have due date as tomorrow"
  Output: { "intent": "UPDATE_TASK", "filter": { "priority": ["medium"] }, "updates": { "dueDate": "tomorrow" } }
- Input: "clear up my to-dos"
  Output: { "intent": "DELETE_ALL" }
- Input: "delete all overdue tasks"
  Output: { "intent": "DELETE_OVERDUE" }
- Input: "sort by due date"
  Output: { "intent": "SORT_BY", "sortOption": "dueDate" }
- Input: "sort by priority high to low"
  Output: { "intent": "SORT_BY", "sortOption": "priorityHighToLow" }
- Input: "show me all administrative tasks"
  Output: { "intent": "SHOW_TASKS", "searchQuery": "administrative" }
- Input: "show me my grocery list"
  Output: { "intent": "SHOW_TASKS", "searchQuery": "grocery" }
- Input: "what do I have to do this week"
  Output: { "intent": "SHOW_TASKS", "searchQuery": "this week" }
- Input: "what's the weather"
  Output: { "intent": "UNKNOWN" }

Now, process the provided user's task description.
`;

export async function analyzeTaskDetails(
  input: AnalyzeTaskDetailsInput
): Promise<AnalyzeTaskDetailsOutput> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: input.taskDescription,
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("OpenAI API Error:", errorBody);
    throw new Error(`OpenAI API request failed with status ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content) as AnalyzeTaskDetailsOutput;
}


export type Task = {
  id: string;
  text: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low' | 'default' | null;
  dueDate: string | null;
  location: string | null;
  createdAt: string;
  lastUpdated: string;
};

export type Action = import('@/ai/flows/analyze-task-details').Action;

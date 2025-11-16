export type Task = {
  id: string;
  text: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  dueDate: string | null;
  location: string | null;
  createdAt: string;
  lastUpdated: string;
};

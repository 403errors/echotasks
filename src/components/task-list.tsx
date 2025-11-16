"use client";

import type { Task } from '@/types';
import { TaskItem } from './task-item';
import { AnimatePresence, motion } from 'framer-motion';

type TaskListProps = {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
};

export function TaskList({ tasks, onToggle, onDelete, onEdit }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10 flex flex-col items-center justify-center h-full min-h-[250px]">
        <p className="font-headline text-lg">No tasks yet.</p>
        <p>Click the microphone to add a new task.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="w-full"
          >
            <TaskItem task={task} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}


"use client";

import type { Task } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, CalendarDays, MapPin, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


type TaskItemProps = {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

function getFormattedDate(dueDate: string | null): { text: string; isOverdue: boolean } {
    if (!dueDate) return { text: '', isOverdue: false };

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to the start of the day

    const due = new Date(dueDate + 'T00:00:00');
    due.setHours(0,0,0,0); // Make sure due date is at start of day

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        const daysOverdue = Math.abs(diffDays);
        return { text: `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`, isOverdue: true };
    }
    if (diffDays === 0) {
        return { text: 'Today', isOverdue: false };
    }
    if (diffDays === 1) {
        return { text: 'Tomorrow', isOverdue: false };
    }
    
    return {
        text: due.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }),
        isOverdue: false
    };
}


export function TaskItem({ task, onToggle, onDelete, onEdit }: TaskItemProps) {
  const getPriorityColor = (priority: string | null) => {
    if(!priority) return 'bg-gray-400';
    const p = priority.toLowerCase();
    return priorityColors[p] || 'bg-gray-400';
  };
  
  const { text: formattedDate, isOverdue } = getFormattedDate(task.dueDate);
  
  return (
    <div className={cn(
      "w-full transition-all duration-200 hover:bg-white/5 rounded-lg"
      )}>
      <div className="p-4 flex items-start gap-4">
        <Checkbox
          id={`task-${task.id}`}
          checked={task.completed}
          onCheckedChange={() => onToggle(task.id)}
          className="w-6 h-6 rounded-md mt-1"
          aria-label={`Mark task as ${task.completed ? 'incomplete' : 'complete'}`}
        />
        <div className="flex-grow grid gap-1.5">
          <label
            htmlFor={`task-${task.id}`}
            className={cn(
              'font-medium cursor-pointer transition-colors',
              task.completed && 'line-through text-muted-foreground'
            )}
          >
            {task.text}
          </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {formattedDate && (
              <div className={cn("flex items-center gap-1.5", isOverdue && "text-red-500")}>
                <CalendarDays className="w-4 h-4" />
                <span>{formattedDate}</span>
              </div>
            )}
            {task.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>{task.location}</span>
              </div>
            )}
            {task.priority && (
              <Badge variant="secondary" className="capitalize flex items-center gap-1.5 px-2 py-0.5">
                <span className={cn("h-2 w-2 rounded-full", getPriorityColor(task.priority))} />
                <span>{task.priority}</span>
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(task)}
            aria-label={`Edit task: ${task.text}`}
            className="text-muted-foreground hover:text-primary"
          >
            <Pencil className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(task.id)}
            aria-label={`Delete task: ${task.text}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

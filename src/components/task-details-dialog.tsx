
"use client";

import type { Task } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Tag, Info, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

type TaskDetailsDialogProps = {
  task: Task | null;
  onOpenChange: (isOpen: boolean) => void;
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-500 border-red-500',
  medium: 'bg-yellow-500 border-yellow-500',
  low: 'bg-green-500 border-green-500',
};

function getFormattedDate(dateString: string | null): string {
    if (!dateString) return 'Not set';
    return new Date(dateString + 'T12:00:00').toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function DetailRow({ icon: Icon, label, value, className }: { icon: React.ElementType, label: string, value: React.ReactNode, className?: string }) {
    if (!value) return null;
    return (
        <div className={cn("flex items-start gap-4", className)}>
            <Icon className="h-5 w-5 mt-1 text-muted-foreground" />
            <div className="flex flex-col">
                <span className="text-sm font-semibold text-muted-foreground">{label}</span>
                <span className="text-base text-foreground">{value}</span>
            </div>
        </div>
    )
}

export function TaskDetailsDialog({ task, onOpenChange }: TaskDetailsDialogProps) {
  if (!task) return null;

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
           <DialogDescription className="pt-2">{task.text}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
            <DetailRow
                icon={CalendarDays}
                label="Due Date"
                value={getFormattedDate(task.dueDate)}
            />
             <DetailRow
                icon={Tag}
                label="Priority"
                value={
                    task.priority ? (
                        <Badge
                            variant={task.priority === 'high' || task.priority === 'medium' || task.priority === 'low' ? 'default' : 'secondary'}
                            className={cn("capitalize", priorityColors[task.priority])}
                        >
                            {task.priority}
                        </Badge>
                    ) : "Not set"
                }
            />
             <DetailRow
                icon={MapPin}
                label="Location"
                value={task.location || 'Not set'}
            />
            <DetailRow
                icon={Clock}
                label="Created On"
                value={getFormattedDate(task.createdAt)}
            />
             <DetailRow
                icon={Info}
                label="Status"
                value={task.completed ? 'Completed' : 'Pending'}
            />
        </div>
      </DialogContent>
    </Dialog>
  );
}

    
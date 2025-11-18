
"use client";

import { useState, useEffect } from "react";
import type { Task, Action } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type UpdateTasksDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  tasks: Task[];
  updates: Action['updates'];
  title: string;
  onUpdate: (selectedIds: string[], updates: Action['updates']) => void;
};

export function UpdateTasksDialog({
  isOpen,
  onOpenChange,
  tasks,
  updates,
  title,
  onUpdate,
}: UpdateTasksDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      // Pre-select all tasks when the dialog opens
      setSelectedIds(new Set(tasks.map((task) => task.id)));
    }
  }, [isOpen, tasks]);

  const handleToggle = (taskId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(tasks.map((task) => task.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    onUpdate(Array.from(selectedIds), updates);
    onOpenChange(false);
  };

  const getUpdateDescription = () => {
    if (!updates) return null;
    const parts: string[] = [];
    if (updates.priority) parts.push(`set priority to ${updates.priority}`);
    if (updates.dueDate) parts.push(`set due date to ${updates.dueDate}`);
    if (updates.dueDateShift) {
        const { days, weeks, months } = updates.dueDateShift;
        if(days) parts.push(`push due date by ${days} day(s)`);
        if(weeks) parts.push(`push due date by ${weeks} week(s)`);
        if(months) parts.push(`push due date by ${months} month(s)`);
    }
    if (updates.location) parts.push(`set location to ${updates.location}`);
    if (updates.text) parts.push(`change text to "${updates.text}"`);

    return `This will ${parts.join(' and ')}.`;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {getUpdateDescription()} Select the tasks you'd like to update.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center justify-between py-2">
            <p className="text-sm text-muted-foreground">{selectedIds.size} of {tasks.length} selected</p>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>Select All</Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAll}>Deselect All</Button>
            </div>
        </div>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted"
              >
                <Checkbox
                  id={`update-${task.id}`}
                  checked={selectedIds.has(task.id)}
                  onCheckedChange={() => handleToggle(task.id)}
                />
                <Label
                  htmlFor={`update-${task.id}`}
                  className="flex-grow cursor-pointer"
                >
                  {task.text}
                   {task.priority && <Badge variant="secondary" className="ml-2">{task.priority}</Badge>}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
                Update {selectedIds.size} Task(s)
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

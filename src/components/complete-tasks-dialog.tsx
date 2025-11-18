
"use client";

import { useState, useEffect } from "react";
import type { Task } from "@/types";
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
import { Separator } from "@/components/ui/separator";

type CompleteTasksDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  tasks: Task[];
  onComplete: (selectedIds: string[]) => void;
};

export function CompleteTasksDialog({
  isOpen,
  onOpenChange,
  tasks,
  onComplete,
}: CompleteTasksDialogProps) {
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
    onComplete(Array.from(selectedIds));
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Tasks</DialogTitle>
          <DialogDescription>
            Select the tasks you'd like to mark as complete.
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
                  id={`complete-${task.id}`}
                  checked={selectedIds.has(task.id)}
                  onCheckedChange={() => handleToggle(task.id)}
                />
                <Label
                  htmlFor={`complete-${task.id}`}
                  className="flex-grow cursor-pointer"
                >
                  {task.text}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
                Complete {selectedIds.size} Task(s)
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

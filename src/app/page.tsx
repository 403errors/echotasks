

"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTasks } from '@/lib/hooks/use-tasks';
import { VoiceRecorder } from '@/components/voice-recorder';
import { TaskList } from '@/components/task-list';
import { getTranscription, analyzeTask } from '@/app/actions';
import { useToast } from "@/hooks/use-toast";
import { LoaderCircle, ArrowDownUp, Undo2, Info, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { detectPriorityFast } from '@/lib/priority-detection';
import * as chrono from 'chrono-node';
import type { Task } from '@/types';
import type { AnalyzeTaskDetailsOutput } from '@/ai/flows/analyze-task-details';
import { EditTaskDialog } from '@/components/edit-task-dialog';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { InfoDialog } from '@/components/info-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { UserGreeting } from '@/components/user-greeting';
import { SettingsSheet } from '@/components/settings-sheet';
import { useSettings } from '@/lib/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';


type SortOption = 'creationDate' | 'dueDate' | 'lastUpdated' | 'priorityHighToLow' | 'priorityLowToHigh';

const priorityOrder: Record<string, number> = { high: 1, medium: 2, low: 3 };

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const commandExamples = [
  "Add 'Buy groceries' and 'Call the doctor'",
  "Remind me to 'Call John' tomorrow",
  "Add task to submit the report by next friday and mark it as high priority",
  "Update the last task's location to 'Office'",
  "Change the last task to 'Pay the bills'",
  "Complete the first and third tasks",
  "Delete the second to-do",
  "Delete the final task",
  "Change the priority of 'Finish report' to low",
  "Sort my list by due date",
  "Delete all overdue tasks",
  "Clear my to-do list",
];

function AnimatedSuggestions() {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (index === commandExamples.length) {
      setIndex(0);
      return;
    }

    const currentCommand = commandExamples[index];

    if (subIndex === currentCommand.length + 1 && !isDeleting) {
      setTimeout(() => setIsDeleting(true), 1000); // Pause before deleting
      return;
    }

    if (subIndex === 0 && isDeleting) {
      setIsDeleting(false);
      setIndex((prev) => (prev + 1));
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
      setText(currentCommand.substring(0, subIndex));
    }, isDeleting ? 30 : 45);

    return () => clearTimeout(timeout);
  }, [subIndex, index, isDeleting]);

  return (
    <div className="h-6 text-center text-muted-foreground">
      <span>e.g. "{text}"</span>
      <span className="animate-pulse">|</span>
    </div>
  );
}

export default function Home() {
  const { 
    tasks, 
    addTask, 
    toggleTask, 
    deleteTask, 
    isLoaded, 
    updateTask, 
    completeTasks, 
    deleteAllTasks, 
    lastAction, 
    revertLastAction, 
    clearLastAction, 
    deleteOverdueTasks 
  } = useTasks();
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('creationDate');
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [showSpacebarTip, setShowSpacebarTip] = useState(false);
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  useEffect(() => {
      // Show the tip only on desktop if the feature is enabled
      const tipShown = localStorage.getItem('spacebarTipShown');
      if (!isMobile && settings.spacebarToTalk && !tipShown) {
          setShowSpacebarTip(true);
      }
  }, [isMobile, settings.spacebarToTalk]);

  const handleDismissSpacebarTip = () => {
      setShowSpacebarTip(false);
      localStorage.setItem('spacebarTipShown', 'true');
  };

  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: (() => void) | null;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: null,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (lastAction) {
      const timer = setTimeout(() => {
        clearLastAction();
      }, 10000); // Clear undo action after 10 seconds
      return () => clearTimeout(timer);
    }
  }, [lastAction, clearLastAction]);

  const handleUndo = () => {
    revertLastAction();
    toast({ title: "Action reverted" });
  };

  const getFilteredTaskIds = (filter: AnalyzeTaskDetailsOutput['filter']): string[] => {
    if (!filter) return [];

    let filteredTasks = [...tasks];

    if (filter.status) {
        filteredTasks = filteredTasks.filter(t => t.completed === (filter.status === 'completed'));
    }

    if (filter.priority && filter.priority.length > 0) {
        const prioritySet = new Set(filter.priority);
        filteredTasks = filteredTasks.filter(t => t.priority && prioritySet.has(t.priority));
    }

    // After other filters, apply position filter
    if (filter.positions && filter.positions.length > 0) {
        const indices = new Set<number>();
        const taskCount = filteredTasks.length;

        filter.positions.forEach(pos => {
            if (pos === 'last') {
                if (taskCount > 0) indices.add(taskCount - 1);
            } else if (typeof pos === 'number' && pos > 0 && pos <= taskCount) {
                indices.add(pos - 1);
            }
        });
        
        // This maps the filtered indices back to the original unfiltered tasks array
        const finalTasks: Task[] = [];
        const filteredTaskIds = new Set(filteredTasks.map(t => t.id));
        const allTasksInOrder = tasks.filter(t => filteredTaskIds.has(t.id));

        indices.forEach(index => {
          if(allTasksInOrder[index]) {
            finalTasks.push(allTasksInOrder[index])
          }
        });
        return finalTasks.map(t => t.id);
    }
    
    return filteredTasks.map(t => t.id);
  };
  
  const sortedTasks = useMemo(() => {
    let tasksCopy = [...tasks];
    
    switch (sortOption) {
      case 'dueDate':
        tasksCopy = tasksCopy.sort((a, b) => {
          const aDate = a.dueDate ? new Date(a.dueDate + 'T00:00:00').getTime() : Infinity;
          const bDate = b.dueDate ? new Date(b.dueDate + 'T00:00:00').getTime() : Infinity;
          const now = new Date();
          now.setHours(0,0,0,0);
          const today = now.getTime();
          
          const aIsPast = aDate < today;
          const bIsPast = bDate < today;

          if(aIsPast && !bIsPast) return -1;
          if(!aIsPast && bIsPast) return 1;

          if (aDate === Infinity && bDate === Infinity) return 0;
          if (aDate === Infinity) return 1;
          if (bDate === Infinity) return -1;
            
          return aDate - bDate;
        });
        break;
      case 'priorityHighToLow':
        tasksCopy = tasksCopy.sort((a, b) => (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4));
        break;
      case 'priorityLowToHigh':
        tasksCopy = tasksCopy.sort((a, b) => (priorityOrder[b.priority] || 4) - (priorityOrder[a.priority] || 4));
        break;
      case 'lastUpdated':
         tasksCopy = tasksCopy.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        break;
      case 'creationDate':
      default:
        tasksCopy = tasksCopy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    if (settings.moveCompletedToBottom) {
      const completed = tasksCopy.filter(t => t.completed);
      const incomplete = tasksCopy.filter(t => !t.completed);
      return [...incomplete, ...completed];
    }
    
    return tasksCopy;

  }, [tasks, sortOption, settings.moveCompletedToBottom]);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      if (showSpacebarTip) {
          handleDismissSpacebarTip();
      }
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const transcript = await getTranscription(formData);

      if (!transcript) {
        toast({ variant: "destructive", title: "Couldn't hear anything" });
        return;
      }
      
      const analysis = await analyzeTask(transcript);

      if (!analysis || !analysis.intent || analysis.intent === 'UNKNOWN') {
        toast({ variant: "destructive", title: "Could not understand command" });
        return;
      }

      switch (analysis.intent) {
        case 'ADD_TASK': {
          if (!analysis.tasks || analysis.tasks.length === 0) {
            toast({ variant: "destructive", title: "No task description found" });
            break;
          }
          const priorityResult = await detectPriorityFast(transcript);
          const priority = priorityResult.priority === 'none' ? 'medium' : priorityResult.priority;
          const parsedDate = chrono.parseDate(transcript, new Date(), { forwardDate: true });
          
          analysis.tasks.forEach(taskInfo => {
            addTask({
                text: taskInfo.text,
                priority: priority,
                dueDate: parsedDate ? formatDate(parsedDate) : null,
                location: taskInfo.location || null,
            });
          });

          toast({ title: `Added ${analysis.tasks.length} task(s)`, description: analysis.tasks.map(t => t.text).join(', ') });
          break;
        }

        case 'DELETE_TASK': {
          const idsToDelete = getFilteredTaskIds(analysis.filter);
          if (idsToDelete.length === 0) {
            toast({ variant: "destructive", title: "Task not found" });
            break;
          }

          const onConfirm = () => {
            idsToDelete.forEach(id => deleteTask(id));
            toast({ title: "Task(s) Deleted", description: `Removed ${idsToDelete.length} task(s).` });
          };

          if (idsToDelete.length > 1) {
            setConfirmationState({
              isOpen: true,
              title: `Delete ${idsToDelete.length} tasks?`,
              description: "This action cannot be undone, but you can use the undo button afterward.",
              onConfirm,
            });
          } else {
            onConfirm();
          }
          break;
        }
        
        case 'DELETE_OVERDUE': {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const overdueCount = tasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() < today.getTime() && !t.completed).length;

            if (overdueCount === 0) {
                toast({ title: "No Overdue Tasks", description: "You have no overdue tasks to delete." });
                return;
            }
            
            const onConfirm = () => {
                const deletedCount = deleteOverdueTasks();
                toast({ title: "Overdue Tasks Deleted", description: `Removed ${deletedCount} overdue task(s).` });
            };

            setConfirmationState({
              isOpen: true,
              title: `Delete ${overdueCount} overdue task(s)?`,
              description: "This action cannot be undone, but you can use the undo button afterward.",
              onConfirm,
            });
            break;
        }

        case 'MARK_COMPLETED': {
          const idsToComplete = getFilteredTaskIds(analysis.filter);
          if (idsToComplete.length === 0) {
            toast({ variant: "destructive", title: "Task not found" });
            break;
          }
          completeTasks(idsToComplete, true);
          toast({ title: "Task(s) Completed", description: `Marked ${idsToComplete.length} task(s) as done.` });
          break;
        }
        
        case 'UPDATE_TASK': {
          const idsToUpdate = getFilteredTaskIds(analysis.filter);
          if (idsToUpdate.length === 0 || !analysis.updates) {
             toast({ variant: "destructive", title: "Task not found or no update specified" });
             break;
          }
          idsToUpdate.forEach(id => updateTask(id, analysis.updates!));
          toast({ title: "Task(s) Updated", description: `Updated ${idsToUpdate.length} task(s).` });
          break;
        }
        
        case 'SORT_BY': {
            if (analysis.sortOption) {
                setSortOption(analysis.sortOption);
                toast({ title: "List Sorted", description: `Tasks sorted by ${analysis.sortOption.replace(/([A-Z])/g, ' $1')}.` });
            } else {
                toast({ variant: "destructive", title: "Sort option not recognized" });
            }
            break;
        }

        case 'DELETE_ALL': {
            if (tasks.length === 0) {
                toast({ title: "No Tasks to Delete", description: "Your to-do list is already empty." });
                return;
            }
            const onConfirm = () => {
                deleteAllTasks();
                toast({ title: "All Tasks Deleted", description: "Your to-do list is clear!" });
            }

            setConfirmationState({
              isOpen: true,
              title: `Delete all ${tasks.length} tasks?`,
              description: "This action cannot be undone, but you can use the undo button afterward.",
              onConfirm,
            });
            break;
        }

        default:
          toast({ variant: "destructive", title: "Could not perform action" });
          break;
      }

    } catch (error) {
      console.error(error);
      const description = error instanceof Error ? error.message : "Please try again.";
      toast({ variant: "destructive", title: "An error occurred", description });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseConfirmation = () => {
    setConfirmationState({ isOpen: false, title: '', description: '', onConfirm: null });
  };

  const handleConfirm = () => {
    if (confirmationState.onConfirm) {
      confirmationState.onConfirm();
    }
    handleCloseConfirmation();
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
  }

  const handleUpdateTask = (updatedTask: Task) => {
    updateTask(updatedTask.id, updatedTask);
    toast({ title: "Task updated" });
  }

  return (
    <>
      <main className="flex min-h-screen w-full flex-col bg-background p-4 sm:p-6 md:p-8 font-body">
        {!isMobile && (
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 md:top-8 md:left-8">
              <UserGreeting />
          </div>
        )}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 md:top-8 md:right-8 flex flex-col items-center gap-2">
            <SettingsSheet />
            {!isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setIsInfoDialogOpen(true)}>
                  <Info className="h-5 w-5" />
                  <span className="sr-only">Info</span>
              </Button>
            )}
        </div>
        
        <div className="w-full max-w-2xl mx-auto flex flex-col justify-center flex-grow">
          <header className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-headline font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent mb-2">
              EchoTasks
            </h1>
            <p className="text-lg text-muted-foreground">
              Create your to-do list by just speaking.
            </p>
          </header>
          
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center gap-4">
                <VoiceRecorder onRecordingComplete={handleRecordingComplete} isProcessing={isProcessing} />
                <AnimatedSuggestions />
                {isProcessing && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <LoaderCircle className="animate-spin h-4 w-4" />
                        <span>Processing your command...</span>
                    </div>
                )}
            </div>

            <div className='flex justify-between items-center'>
              <div className='h-10 w-24'>
                {lastAction && (
                  <div className="relative overflow-hidden rounded-md">
                    <Button variant="outline" onClick={handleUndo} className="w-full">
                      <Undo2 className="mr-2 h-4 w-4" />
                      Undo
                    </Button>
                    <motion.div
                      className="absolute bottom-0 left-0 h-1 bg-primary/50"
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{ duration: 10, ease: 'linear' }}
                    />
                  </div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <ArrowDownUp className="mr-2 h-4 w-4" />
                    Sort By
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuRadioGroup value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                    <DropdownMenuRadioItem value="creationDate">Date Created</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="lastUpdated">Last Updated</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dueDate">Due Date</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="priorityHighToLow">Priority (High to Low)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="priorityLowToHigh">Priority (Low to High)</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Card className="w-full shadow-2xl">
              <div className="p-4 sm:p-6 min-h-[300px]">
                {!isLoaded ? (
                   <div className="flex justify-center items-center h-full min-h-[250px]">
                      <LoaderCircle className="animate-spin h-8 w-8 text-primary" />
                   </div>
                ) : (
                  <TaskList tasks={sortedTasks} onToggle={toggleTask} onDelete={deleteTask} onEdit={handleEditTask} />
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    
      <AnimatePresence>
          {showSpacebarTip && (
              <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground text-sm p-3 rounded-lg shadow-lg flex items-center gap-4"
              >
                  <p>
                      <b>Pro Tip:</b> Hold the <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Space</kbd> key to talk.
                  </p>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismissSpacebarTip}>
                      <X className="h-4 w-4" />
                  </Button>
              </motion.div>
          )}
      </AnimatePresence>


      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          onOpenChange={(isOpen) => !isOpen && setEditingTask(null)}
          onUpdate={handleUpdateTask}
        />
      )}
      <ConfirmationDialog
          isOpen={confirmationState.isOpen}
          onOpenChange={handleCloseConfirmation}
          onConfirm={handleConfirm}
          title={confirmationState.title}
          description={confirmationState.description}
      />
      <InfoDialog 
          isOpen={isInfoDialogOpen}
          onOpenChange={setIsInfoDialogOpen}
      />
    </>
  );
}

    

    

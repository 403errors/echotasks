
"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTasks } from '@/lib/hooks/use-tasks';
import { VoiceRecorder, VoiceRecorderRef } from '@/components/voice-recorder';
import { TaskList } from '@/components/task-list';
import { processVoiceCommand } from '@/app/actions';
import { useToast } from "@/hooks/use-toast";
import { LoaderCircle, ArrowDownUp, Undo2, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { detectPriorityFast } from '@/lib/priority-detection';
import * as chrono from 'chrono-node';
import type { Task } from '@/types';
import type { AnalyzeTaskDetailsOutput, Action } from '@/ai/flows/analyze-task-details';
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
import { motion } from 'framer-motion';
import { UserGreeting } from '@/components/user-greeting';
import { SettingsSheet } from '@/components/settings-sheet';
import { useSettings } from '@/lib/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { FilteredTasksDialog } from '@/components/filtered-tasks-dialog';
import { ProTipDialog } from '@/components/pro-tip-dialog';
import { CompleteTasksDialog } from '@/components/complete-tasks-dialog';
import { UpdateTasksDialog } from '@/components/update-tasks-dialog';
import { TaskDetailsDialog } from '@/components/task-details-dialog';


type SortOption = 'creationDate' | 'dueDate' | 'lastUpdated' | 'priorityHighToLow' | 'priorityLowToHigh';

const priorityOrder: Record<string, number> = { high: 1, medium: 2, low: 3, default: 4 };

const sortLabels: Record<SortOption, string> = {
  creationDate: "Date Created",
  dueDate: "Due Date",
  lastUpdated: "Last Updated",
  priorityHighToLow: "Priority (High-Low)",
  priorityLowToHigh: "Priority (Low-High)",
};

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
  "Show me my grocery related tasks",
  "Show me tasks to be done this week",
];

const topicSynonyms: Record<string, string[]> = {
    shopping: ['buy', 'groceries', 'get', 'shop'],
    calls: ['call', 'phone', 'contact'],
    presentation: ['presentation', 'slides', 'deck'],
    workout: ['workout', 'exercise', 'gym', 'run', 'yoga'],
    cleaning: ['clean', 'tidy', 'organize'],
    report: ['report', 'document', 'summary'],
    work: ['work', 'office', 'project'],
    submit: ['submit', 'submitting'],
};

function getFuzzyMatchingTaskIds(allTasks: Task[], topic: string): string[] {
    if (!topic) return [];
    const lowerTopic = topic.toLowerCase();

    // --- Phase 1: Prioritize phrase matching ---
    const phraseMatches = allTasks.filter(task => {
        const lowerTaskText = task.text.toLowerCase();
        // Check if one string is a substring of the other. This handles cases like "submit report" vs "submitting the report".
        return lowerTaskText.includes(lowerTopic) || lowerTopic.includes(lowerTaskText);
    });

    if (phraseMatches.length > 0) {
        return phraseMatches.map(task => task.id);
    }
    
    // --- Phase 2: Fallback to keyword and synonym matching if no phrase matches are found ---
    const topicWords = new Set(lowerTopic.split(/\W+/).filter(w => w.length > 2));
    const synonymKey = Object.keys(topicSynonyms).find(key => 
        topicSynonyms[key].includes(lowerTopic) || key.includes(lowerTopic)
    ) || lowerTopic;
    const synonyms = topicSynonyms[synonymKey] || [synonymKey];
    const synonymSet = new Set(synonyms);

    return allTasks
        .filter(task => {
            const lowerTaskText = task.text.toLowerCase();
            const taskWords = new Set(lowerTaskText.split(/\W+/));

            // Synonym check
            if ([...taskWords].some(word => synonymSet.has(word))) return true;

            // Check if any significant word from the topic appears in the task text
            if ([...topicWords].some(topicWord => lowerTaskText.includes(topicWord))) return true;
            
            return false;
        })
        .map(task => task.id);
}


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
  const [sortOption, setSortOption] = useState<SortOption>('creationDate');
  const { 
    tasks, 
    addTasks, 
    toggleTask, 
    deleteTask, 
    isLoaded, 
    updateTask, 
    updateTasks,
    completeTasks, 
    deleteAllTasks, 
    lastAction, 
    revertLastAction, 
    clearLastAction, 
    deleteOverdueTasks 
  } = useTasks(sortOption);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isProTipOpen, setIsProTipOpen] = useState(false);
  const { settings } = useSettings();
  const isMobile = useIsMobile();
  const voiceRecorderRef = useRef<VoiceRecorderRef>(null);
  const spacebarHeldRef = useRef(false);

  const [completionState, setCompletionState] = useState<{
    isOpen: boolean;
    tasks: Task[];
  }>({ isOpen: false, tasks: [] });

  const [updateState, setUpdateState] = useState<{
    isOpen: boolean;
    tasks: Task[];
    updates: Action['updates'];
    title: string;
  }>({ isOpen: false, tasks: [], updates: {}, title: '' });

  const [filteredTasksState, setFilteredTasksState] = useState<{
    isOpen: boolean;
    title: string;
    tasks: Task[];
  }>({
    isOpen: false,
    title: '',
    tasks: [],
  });

  useEffect(() => {
      // Show the tip only on desktop if the feature is enabled
      const tipShown = localStorage.getItem('spacebarTipShown');
      if (!isMobile && settings.spacebarToTalk && !tipShown) {
          setIsProTipOpen(true);
      }
  }, [isMobile, settings.spacebarToTalk]);

    useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || !settings.spacebarToTalk) return;
        
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      event.preventDefault();

      if (event.repeat || spacebarHeldRef.current) return;

      spacebarHeldRef.current = true;
      voiceRecorderRef.current?.startRecording();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || !settings.spacebarToTalk || !spacebarHeldRef.current) {
        return;
      }
      event.preventDefault();
      spacebarHeldRef.current = false;
      voiceRecorderRef.current?.stopRecording();
    };
    
    // Also prevent default on keypress to stop scrolling
    const handleKeyPress = (event: KeyboardEvent) => {
        if (event.code === 'Space') {
            event.preventDefault();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keypress', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keypress', handleKeyPress);
    };
  }, [settings.spacebarToTalk]);

  const handleDismissProTip = () => {
      setIsProTipOpen(false);
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

  const sortedTasks = useMemo(() => {
    let tasksCopy = [...tasks];
    
    // The actual sorting logic is now handled inside the useTasks hook
    // This useMemo is now only responsible for the completed tasks filter
    if (settings.moveCompletedToBottom) {
      const completed = tasksCopy.filter(t => t.completed);
      const incomplete = tasksCopy.filter(t => !t.completed);
      return [...incomplete, ...completed];
    }
    
    return tasksCopy;

  }, [tasks, settings.moveCompletedToBottom]);


  const getFilteredTaskIds = (
    filter: Action['filter']
  ): string[] => {
    if (!filter) return [];

    let baseTasks = [...tasks]; // Use original tasks for attribute filters
    
    if (filter.text) {
        const fuzzyIds = getFuzzyMatchingTaskIds(baseTasks, filter.text);
        const directIds = baseTasks.filter(t => t.text.toLowerCase().includes(filter.text!.toLowerCase())).map(t => t.id);
        const combined = new Set([...fuzzyIds, ...directIds]);
        baseTasks = baseTasks.filter(t => combined.has(t.id));
    }
    
    if (filter.dueDate) {
        const query = filter.dueDate.toLowerCase();
        
        const parsedDateRange = chrono.parse(query, new Date(), { forwardDate: true });
        if (parsedDateRange.length > 0) {
            const { start, end } = parsedDateRange[0];
            const startDate = start.date();
            const endDate = end ? end.date() : new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
            
            // Set times to cover the whole days
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            
            baseTasks = baseTasks.filter(task => {
                if (!task.dueDate) return false;
                // Use T12:00:00 to avoid timezone shifts putting it on the previous day
                const taskDueDate = new Date(task.dueDate + 'T12:00:00'); 
                return taskDueDate >= startDate && taskDueDate <= endDate;
            });
        }
    }
    
    if (filter.status) {
        if (filter.status === 'overdue') {
             const today = new Date();
             today.setHours(0,0,0,0);
             baseTasks = baseTasks.filter(t => t.dueDate && new Date(t.dueDate) < today && !t.completed);
        } else {
            baseTasks = baseTasks.filter(t => t.completed === (filter.status === 'completed'));
        }
    }
    
    if (filter.priority && filter.priority.length > 0) {
        const prioritySet = new Set(filter.priority);
        baseTasks = baseTasks.filter(t => t.priority && prioritySet.has(t.priority));
    }

    if (filter.location) {
        const lowerLocation = filter.location.toLowerCase();
        baseTasks = baseTasks.filter(t => t.location && t.location.toLowerCase().includes(lowerLocation));
    }

    if (filter.positions && filter.positions.length > 0) {
        const indices = new Set<number>();
        const posTasks = [...sortedTasks]; // Use sortedTasks for positional filters
        const taskCount = posTasks.length;

        filter.positions.forEach(pos => {
            if (pos === 'last') {
                if (taskCount > 0) indices.add(taskCount - 1);
            } else if (pos === 'second last') {
                if (taskCount > 1) indices.add(taskCount - 2);
            } else if (pos === 'odd') {
                for (let i = 0; i < taskCount; i += 2) indices.add(i);
            } else if (pos === 'even') {
                for (let i = 1; i < taskCount; i += 2) indices.add(i);
            } else if (pos === 'all') {
                for (let i = 0; i < taskCount; i++) indices.add(i);
            } else if (typeof pos === 'number' && pos > 0 && pos <= taskCount) {
                indices.add(pos - 1);
            } else if (typeof pos === 'object' && 'start' in pos && 'end' in pos) {
                const start = pos.start < 0 ? taskCount + pos.start : pos.start - 1;
                const end = pos.end < 0 ? taskCount + pos.end : pos.end - 1;
                for (let i = start; i <= end; i++) {
                    if (i >= 0 && i < taskCount) {
                        indices.add(i);
                    }
                }
            }
        });
        
        return Array.from(indices).map(index => posTasks[index].id);
    }
    
    return baseTasks.map(t => t.id);
};
  
  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      if (isProTipOpen) {
          handleDismissProTip();
      }
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const { transcript, analysis } = await processVoiceCommand(formData);

      if (!transcript) {
        toast({ variant: "destructive", title: "Couldn't hear anything" });
        return;
      }
      
      if (!analysis || !analysis.actions || analysis.actions.length === 0 || analysis.actions.every(a => a.intent === 'UNKNOWN')) {
        toast({ variant: "destructive", title: "Could not understand command" });
        return;
      }
      
      let summary = { added: 0, updated: 0, deleted: 0, completed: 0, uncompleted: 0, sorted: false, shown: false, unknown: 0, queried: 0 };
      const tasksToAdd = [];

      for (const action of analysis.actions) {
        switch (action.intent) {
          case 'ADD_TASK': {
            if (!action.tasks || action.tasks.length === 0) {
              summary.unknown++;
              continue;
            }
            
            for (const taskInfo of action.tasks) {
                // Check for similar tasks only if the command is a simple add, without extra details.
                const isSimpleAdd = !taskInfo.dueDate && !taskInfo.priority && !taskInfo.location;
                const similarTaskIds = isSimpleAdd ? getFuzzyMatchingTaskIds(tasks.filter(t => !t.completed), taskInfo.text) : [];

                if (similarTaskIds.length > 0 && action.intent !== 'UPDATE_TASK') {
                    // This is a likely duplicate, inform the user.
                    toast({ title: "Task already exists", description: `A similar task for "${taskInfo.text}" already exists.`});
                } else {
                    // If it's not a simple add (i.e., it has a date/priority), or no similar task was found, treat it as an update or a new task.
                    const fuzzyIdsForUpdate = getFuzzyMatchingTaskIds(tasks.filter(t => !t.completed), taskInfo.text);
                    
                    if (fuzzyIdsForUpdate.length > 0 && !isSimpleAdd) {
                        // A similar task exists AND the user provided new details (date/prio), so let's update it.
                        const updates = {
                            priority: taskInfo.priority,
                            dueDate: taskInfo.dueDate,
                            location: taskInfo.location,
                        };
                        // Remove undefined keys so we don't nullify existing values
                        Object.keys(updates).forEach(key => (updates as any)[key] === undefined && delete (updates as any)[key]);

                        if (Object.keys(updates).length > 0) {
                            updateTask(fuzzyIdsForUpdate[0], updates);
                            summary.updated++;
                            toast({ title: "Task Updated", description: `Updated existing task: "${tasks.find(t => t.id === fuzzyIdsForUpdate[0])?.text}".` });
                        }
                    } else {
                        // No similar task, queue it to be added as new
                        const priorityResult = await detectPriorityFast(transcript);
                        const defaultPriority = priorityResult.priority === 'none' ? null : priorityResult.priority;
                        
                        const now = new Date();
                        const taskDueDate = taskInfo.dueDate ? chrono.parseDate(taskInfo.dueDate, now, { forwardDate: true }) : chrono.parseDate(transcript, now, { forwardDate: true });
                        
                        tasksToAdd.push({
                            text: taskInfo.text,
                            priority: taskInfo.priority || defaultPriority,
                            dueDate: taskDueDate ? formatDate(taskDueDate) : null,
                            location: taskInfo.location || null,
                        });
                        summary.added++;
                    }
                }
            }
            break;
          }

          case 'DELETE_TASK': {
            const idsToDelete = getFilteredTaskIds(action.filter);
            if (idsToDelete.length === 0) {
              toast({ title: "No matching tasks", description: "No tasks found to delete." });
              continue;
            }
            
            const tasksToDelete = tasks.filter(t => idsToDelete.includes(t.id));
            
            const onConfirm = () => {
              deleteTask(idsToDelete);
              summary.deleted += idsToDelete.length;
              toast({ title: "Task(s) Deleted", description: `Removed ${idsToDelete.length} task(s).` });
            };

            const isSingleHighPriority = idsToDelete.length === 1 && tasksToDelete[0]?.priority === 'high';
            
            if (idsToDelete.length > 1 || isSingleHighPriority) {
                let title = `Delete ${idsToDelete.length} task(s)?`;
                let description = "This action cannot be undone, but you can use the undo button afterward.";

                if (isSingleHighPriority) {
                    title = "Confirm Deletion";
                    description = `"${tasksToDelete[0].text}" is a high priority task. Are you sure you want to delete it?`;
                }

                setConfirmationState({
                    isOpen: true,
                    title,
                    description,
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
                  continue;
              }
              
              const onConfirm = () => {
                  const deletedCount = deleteOverdueTasks();
                  summary.deleted += deletedCount;
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
            let idsToComplete: string[] = [];
            if (action.filter?.positions && action.filter.positions.length > 0) {
                idsToComplete = getFilteredTaskIds(action.filter);
            } else if (action.filter?.text) {
                idsToComplete = getFuzzyMatchingTaskIds(tasks.filter(t => !t.completed), action.filter.text);
            } else if (action.filter) { // For bulk actions like "complete everything today"
                idsToComplete = getFilteredTaskIds(action.filter);
            }


            if (idsToComplete.length === 0) {
                toast({ title: "No Matching Tasks", description: `No tasks found to complete.` });
            } else if (idsToComplete.length === 1) {
                completeTasks(idsToComplete, true);
                summary.completed++;
            } else {
                const matchingTasks = tasks.filter(t => idsToComplete.includes(t.id));
                setCompletionState({ isOpen: true, tasks: matchingTasks });
            }
            break;
          }
          
          case 'MARK_INCOMPLETE': {
            const idsToUncomplete = getFilteredTaskIds(action.filter);
            if (idsToUncomplete.length === 0) {
                summary.unknown++;
                continue;
            }
            completeTasks(idsToUncomplete, false);
            summary.uncompleted += idsToUncomplete.length;
            break;
          }

          case 'UPDATE_TASK': {
            if (!action.updates) {
                summary.unknown++;
                continue;
            }

            let idsToUpdate: string[] = getFilteredTaskIds(action.filter);

            if (idsToUpdate.length === 0) {
                toast({ title: "No matching tasks", description: `No tasks found to update for "${action.filter?.text || 'your query'}".` });
                continue;
            }
            
            const performUpdate = (targetIds: string[]) => {
                let finalUpdates = { ...action.updates };
                
                if (finalUpdates.dueDate) {
                    const parsedDate = chrono.parseDate(finalUpdates.dueDate, new Date(), { forwardDate: true });
                    finalUpdates.dueDate = parsedDate ? formatDate(parsedDate) : null;
                }
                
                if (finalUpdates.dueDateShift) {
                    const { days = 0, weeks = 0, months = 0 } = finalUpdates.dueDateShift;
                    const tasksToShift = tasks.filter(t => targetIds.includes(t.id));
                    
                    const shiftedUpdates = tasksToShift.map(task => {
                        const currentDueDate = task.dueDate ? new Date(task.dueDate + 'T00:00:00') : new Date();
                        currentDueDate.setDate(currentDueDate.getDate() + days + (weeks * 7));
                        currentDueDate.setMonth(currentDueDate.getMonth() + months);
                        return { id: task.id, updates: { ...finalUpdates, dueDate: formatDate(currentDueDate) } };
                    });
                    
                    updateTasks(shiftedUpdates);

                } else {
                    updateTasks(targetIds.map(id => ({ id, updates: finalUpdates })));
                }

                summary.updated += targetIds.length;
            };

            if (idsToUpdate.length > 1) {
                const updatesCount = Object.keys(action.updates).length;
                if(action.filter?.text && updatesCount > 0){
                    const matchingTasks = tasks.filter(t => idsToUpdate.includes(t.id));
                    setUpdateState({
                        isOpen: true,
                        tasks: matchingTasks,
                        updates: action.updates,
                        title: `Update ${action.filter.text} tasks?`
                    });
                } else if(action.filter?.dueDate){
                     const onConfirm = () => performUpdate(idsToUpdate);
                     setConfirmationState({
                        isOpen: true,
                        title: `Bulk Update`,
                        description: `This will update ${idsToUpdate.length} tasks. Proceed?`,
                        onConfirm,
                    });
                } else {
                     const onConfirm = () => performUpdate(idsToUpdate);
                     setConfirmationState({
                        isOpen: true,
                        title: `Bulk Update`,
                        description: `This will update ${idsToUpdate.length} tasks. Proceed?`,
                        onConfirm,
                    });
                }

            } else {
                performUpdate(idsToUpdate);
            }
            break;
          }
          
          case 'SORT_BY': {
              if (action.sortOption) {
                  setSortOption(action.sortOption);
                  summary.sorted = true;
              } else {
                  summary.unknown++;
              }
              break;
          }

          case 'SHOW_TASKS': {
              if (!action.filter) {
                  summary.unknown++;
                  break;
              }
              
              const filtered = getFilteredTaskIds(action.filter).map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[];
              
              const getQueryDescription = () => {
                if (analysis.originalQuery) {
                    return `"${analysis.originalQuery}"`;
                }
                if (action.filter?.text) {
                    return `tasks containing "${action.filter.text}"`;
                }
                if (action.filter?.dueDate) {
                    return `tasks for "${action.filter.dueDate}"`;
                }
                return "your search";
              };

              const queryDescription = getQueryDescription();
              const hasMatchingTasks = filtered.length > 0;

              if (!hasMatchingTasks) {
                  const emptyStateMessages: Record<string, string> = {
                    'overdue': "No overdue tasks. Great job!",
                    'completed': "No tasks completed yet. Keep going!",
                    'high': "No urgent tasks. You're all caught up!",
                  };
                  const filterKey = action.filter.status || action.filter.priority?.[0];
                  const message = filterKey ? emptyStateMessages[filterKey] : `No tasks match ${queryDescription}.`;
                  toast({ title: "No tasks found", description: message });
              } else {
                  setFilteredTasksState({
                      isOpen: true,
                      title: `Tasks matching ${queryDescription}`,
                      tasks: filtered
                  });
                  summary.shown = true;
              }
              break;
          }
          
          case 'QUERY_TASK_INFO': {
                const targetTasks = getFilteredTaskIds(action.filter).map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[];
                if (targetTasks.length === 0) {
                    toast({ title: "No matching tasks found." });
                    continue;
                }

                if (action.queryType === 'count') {
                    toast({ title: "Task Count", description: `You have ${targetTasks.length} matching task(s).`});
                } else if (targetTasks.length > 1 && action.queryType !== 'details') {
                     toast({ title: "Multiple Tasks Found", description: "Your query matched multiple tasks. Please be more specific." });
                } else {
                    const task = targetTasks[0];
                    setDetailsTask(task);
                }
                summary.queried++;
                break;
          }

          case 'DELETE_ALL': {
              if (tasks.length === 0) {
                  toast({ title: "No Tasks to Delete", description: "Your to-do list is already empty." });
                  continue;
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
            summary.unknown++;
            break;
        }
      }

      if (tasksToAdd.length > 0) {
        addTasks(tasksToAdd);
      }
      
      // Generate a summary toast if not handled by individual actions
      let summaryParts = [];
      if(summary.added > 0) summaryParts.push(`Added ${summary.added}`);
      if(summary.updated > 0) summaryParts.push(`Updated ${summary.updated}`);
      if(summary.deleted > 0) summaryParts.push(`Deleted ${summary.deleted}`);
      if(summary.completed > 0) summaryParts.push(`Completed ${summary.completed}`);
      if(summary.uncompleted > 0) summaryParts.push(`Un-completed ${summary.uncompleted}`);
      if(summary.sorted) summaryParts.push(`Sorted list`);
      if(summary.queried > 0 && !detailsTask) summaryParts.push(`Queried ${summary.queried} item(s)`);


      if (summaryParts.length > 0 && !summary.shown && !completionState.isOpen && !updateState.isOpen && !confirmationState.isOpen) {
          toast({ title: "Actions Performed", description: summaryParts.join(', ') + '.' });
      } else if (summary.unknown > 0 && !summary.shown && !completionState.isOpen && !updateState.isOpen) {
          toast({ variant: "destructive", title: "Some parts of the command were not understood." });
      }

    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Please try again.";
      if (typeof errorMessage === 'string' && errorMessage.includes('The AI service (Groq) is currently experiencing technical difficulties')) {
          toast({
              variant: "destructive",
              title: "AI Service Error",
              description: errorMessage
          });
      } else if (typeof errorMessage === 'string' && errorMessage.includes('corrupt or unsupported data')) {
          toast({
              variant: "destructive",
              title: "Audio Unclear",
              description: "Audio was unclear or corrupt. Please try speaking again, perhaps a bit closer to your microphone."
          });
      } else {
          toast({ variant: "destructive", title: "An error occurred", description: errorMessage });
      }
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
  
  const handleUpdateTasks = (ids: string[], updates: Action['updates']) => {
    if (ids.length > 0) {
        updateTasks(ids.map(id => ({ id, updates: updates! })));
        toast({ title: `${ids.length} task(s) updated.`});
    }
    setUpdateState({ isOpen: false, tasks: [], updates: {}, title: '' });
  };


  const handleCompleteTasks = (ids: string[]) => {
    if (ids.length > 0) {
        completeTasks(ids, true);
        toast({ title: `${ids.length} task(s) completed.`});
    }
    setCompletionState({ isOpen: false, tasks: [] });
  };


  return (
    <>
      <main className="flex min-h-screen w-full flex-col bg-background p-4 sm:p-6 md:p-8 font-body">
        <div className="relative flex-grow flex flex-col">
          {!isMobile && (
            <div className="absolute top-0 left-0">
                <UserGreeting />
            </div>
          )}
          <div className="absolute top-0 right-0 flex flex-col items-center gap-2">
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
                  <VoiceRecorder ref={voiceRecorderRef} onRecordingComplete={handleRecordingComplete} isProcessing={isProcessing} />
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
                    <Button variant="outline" className="w-48 justify-start">
                        <ArrowDownUp className="mr-2 h-4 w-4" />
                        <span className="truncate">
                          Sorted by: {sortLabels[sortOption]}
                        </span>
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
        </div>
      </main>

      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          onOpenChange={(isOpen) => !isOpen && setEditingTask(null)}
          onUpdate={handleUpdateTask}
        />
      )}
      {detailsTask && (
        <TaskDetailsDialog
            task={detailsTask}
            onOpenChange={(isOpen) => !isOpen && setDetailsTask(null)}
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
      <FilteredTasksDialog
          isOpen={filteredTasksState.isOpen}
          onOpenChange={(isOpen) => setFilteredTasksState(prev => ({...prev, isOpen}))}
          title={filteredTasksState.title}
          tasks={filteredTasksState.tasks}
          onEdit={handleEditTask}
          onToggle={toggleTask}
          onDelete={deleteTask}
      />
      <ProTipDialog
        isOpen={isProTipOpen}
        onOpenChange={handleDismissProTip}
      />
      <CompleteTasksDialog
        isOpen={completionState.isOpen}
        onOpenChange={(isOpen) => !isOpen && setCompletionState({ isOpen: false, tasks: [] })}
        tasks={completionState.tasks}
        onComplete={handleCompleteTasks}
      />
      <UpdateTasksDialog
        isOpen={updateState.isOpen}
        onOpenChange={(isOpen) => !isOpen && setUpdateState({ isOpen: false, tasks: [], updates: {}, title: ''})}
        tasks={updateState.tasks}
        updates={updateState.updates}
        title={updateState.title}
        onUpdate={handleUpdateTasks}
      />
    </>
  );
}

    









    
 

    

    
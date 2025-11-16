
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Task } from '@/types';
import * as chrono from 'chrono-node';

const STORAGE_KEY = 'echo-tasks';

type UndoAction =
  | { type: 'delete'; task: Task }
  | { type: 'add'; id: string }
  | { type: 'update'; originalTask: Task }
  | { type: 'delete-many'; tasks: Task[] }
  | { type: 'complete-many'; originalTasks: Task[] };


function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const getTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
}

const createMockTasks = (): Task[] => {
    const now = new Date().toISOString();
    return [
        {
            id: crypto.randomUUID(),
            text: 'Submit the project report',
            completed: false,
            priority: 'high',
            dueDate: getTomorrow(),
            location: 'Office',
            createdAt: now,
            lastUpdated: now,
        },
        {
            id: crypto.randomUUID(),
            text: 'Buy milk and eggs',
            completed: false,
            priority: 'medium',
            dueDate: null,
            location: 'Supermarket',
            createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            lastUpdated: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        },
        {
            id: crypto.randomUUID(),
            text: 'Review EchoTasks features',
            completed: true,
            priority: 'low',
            dueDate: null,
            location: null,
            createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
            lastUpdated: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        },
    ]
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastAction, setLastAction] = useState<UndoAction | null>(null);

  useEffect(() => {
    try {
      const storedTasks = localStorage.getItem(STORAGE_KEY);
      // If tasks are found in storage, parse them. Otherwise, create mock tasks.
      if (storedTasks && JSON.parse(storedTasks).length > 0) {
        setTasks(JSON.parse(storedTasks));
      } else {
        setTasks(createMockTasks());
      }
    } catch (error) {
      console.error("Failed to load tasks from localStorage, creating mocks.", error);
      setTasks(createMockTasks());
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (error) {
        console.error("Failed to save tasks to localStorage", error);
      }
    }
  }, [tasks, isLoaded]);
  
  const clearLastAction = useCallback(() => {
      setLastAction(null);
  }, []);

  const addTask = useCallback((taskDetails: Omit<Task, 'id' | 'completed' | 'createdAt' | 'lastUpdated'>) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...taskDetails,
      id: crypto.randomUUID(),
      completed: false,
      createdAt: now,
      lastUpdated: now,
    };
    setTasks((prevTasks) => [newTask, ...prevTasks]);
    setLastAction({ type: 'add', id: newTask.id });
  }, []);

  const toggleTask = useCallback((id: string) => {
    const originalTask = tasks.find(t => t.id === id);
    if (!originalTask) return;

    setLastAction({ type: 'update', originalTask });
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed, lastUpdated: new Date().toISOString() } : task
      )
    );
  }, [tasks]);

  const deleteTask = useCallback((id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    setLastAction({ type: 'delete', task: taskToDelete });
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
  }, [tasks]);
  
  const deleteOverdueTasks = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueTasks = tasks.filter(task => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate + 'T00:00:00');
        return dueDate < today;
    });

    if (overdueTasks.length === 0) return 0;

    setLastAction({ type: 'delete-many', tasks: overdueTasks });
    setTasks(prevTasks => prevTasks.filter(task => !overdueTasks.some(ot => ot.id === task.id)));
    return overdueTasks.length;
  }, [tasks]);


  const deleteAllTasks = useCallback(() => {
    if (tasks.length === 0) return;
    setLastAction({ type: 'delete-many', tasks: tasks });
    setTasks([]);
  }, [tasks]);

  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
    const originalTask = tasks.find(t => t.id === id);
    if(!originalTask) return;

    setLastAction({ type: 'update', originalTask });
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id === id) {
          const newUpdates = { ...updates };
          // If dueDate is a relative string like "tomorrow", parse it.
          if (typeof newUpdates.dueDate === 'string' && newUpdates.dueDate) {
            const parsedDate = chrono.parseDate(newUpdates.dueDate, new Date(), { forwardDate: true });
            newUpdates.dueDate = parsedDate ? formatDate(parsedDate) : task.dueDate;
          }
          return { ...task, ...newUpdates, lastUpdated: new Date().toISOString() };
        }
        return task;
      })
    );
  }, [tasks]);

  const completeTasks = useCallback((ids: string[], completed: boolean) => {
    const originalTasks = tasks.filter(t => ids.includes(t.id));
    if (originalTasks.length === 0) return;

    setLastAction({ type: 'complete-many', originalTasks });
    setTasks(prevTasks => 
      prevTasks.map(task => 
        ids.includes(task.id) ? { ...task, completed, lastUpdated: new Date().toISOString() } : task
      )
    );
  }, [tasks]);

  const revertLastAction = useCallback(() => {
    if (!lastAction) return;

    switch (lastAction.type) {
      case 'add':
        setTasks(prev => prev.filter(t => t.id !== lastAction.id));
        break;
      case 'delete':
        setTasks(prev => [...prev, lastAction.task].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        break;
      case 'update': {
        setTasks(prev => prev.map(t => t.id === lastAction.originalTask.id ? lastAction.originalTask : t));
        break;
      }
      case 'complete-many': {
        const originalMap = new Map(lastAction.originalTasks.map(t => [t.id, t]));
        setTasks(prev => prev.map(t => originalMap.get(t.id) || t));
        break;
      }
      case 'delete-many':
        setTasks(prev => [...prev, ...lastAction.tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        break;
    }
    
    setLastAction(null);
  }, [lastAction]);


  return { tasks, addTask, toggleTask, deleteTask, isLoaded, deleteAllTasks, updateTask, completeTasks, lastAction, revertLastAction, clearLastAction, deleteOverdueTasks };
}

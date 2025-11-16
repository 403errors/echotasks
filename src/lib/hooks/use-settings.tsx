
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SETTINGS_STORAGE_KEY = 'echo-tasks-settings';

type Settings = {
  temperatureUnit: 'celsius' | 'fahrenheit';
  moveCompletedToBottom: boolean;
  micMode: 'tap' | 'hold';
  intelligentStopDuration: 0 | 2 | 3 | 5; // in seconds, 0 is off
  spacebarToTalk: boolean;
};

const defaultSettings: Settings = {
  temperatureUnit: 'celsius',
  moveCompletedToBottom: false,
  micMode: 'tap',
  intelligentStopDuration: 0,
  spacebarToTalk: true,
};

type SetSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => void;

type SettingsContextType = {
  settings: Settings;
  setSetting: SetSetting;
  isLoaded: boolean;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        // Merge with defaults to ensure all keys are present
        setSettings({ ...defaultSettings, ...parsed });
      } else {
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
      setSettings(defaultSettings);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error("Failed to save settings to localStorage", error);
      }
    }
  }, [settings, isLoaded]);

  const setSetting: SetSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const value = { settings, setSetting, isLoaded };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

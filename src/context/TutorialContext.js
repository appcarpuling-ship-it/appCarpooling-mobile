import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@carpuling:first_app_tutorial_v1';

const TutorialContext = createContext(null);

export const TutorialProvider = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [completed, setCompleted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled) {
          setCompleted(value === 'true');
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setCompleted(false);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeTutorial = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* noop */
    }
    setCompleted(true);
  }, []);

  const resetTutorial = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setCompleted(false);
  }, []);

  const value = useMemo(
    () => ({
      tutorialReady: ready,
      tutorialCompleted: completed,
      completeTutorial,
      resetTutorial,
    }),
    [ready, completed, completeTutorial, resetTutorial]
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
};

export const useTutorial = () => {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial debe usarse dentro de TutorialProvider');
  }
  return ctx;
};

export default TutorialContext;

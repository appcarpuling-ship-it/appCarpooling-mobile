import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { 
  lightColors, 
  darkColors, 
  lightGradients, 
  darkGradients,
  getColors,
  getGradients
} from '../theme/colors';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = '@carpooling_theme_preference';

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSystemDefault, setIsSystemDefault] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const saveThemePreference = useCallback(async (newIsDarkMode, newIsSystemDefault) => {
    try {
      const preference = {
        isDarkMode: newIsDarkMode,
        isSystemDefault: newIsSystemDefault,
      };
      await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preference));
    } catch (error) {
      console.error('Error guardando preferencia de tema:', error);
    }
  }, []);

  const loadThemePreference = useCallback(async () => {
    try {
      const savedPreference = await AsyncStorage.getItem(THEME_STORAGE_KEY);

      if (savedPreference) {
        const preference = JSON.parse(savedPreference);
        setIsSystemDefault(preference.isSystemDefault);

        if (preference.isSystemDefault) {
          const systemColorScheme = Appearance.getColorScheme();
          setIsDarkMode(systemColorScheme === 'dark');
        } else {
          setIsDarkMode(preference.isDarkMode);
        }
      } else {
        setIsDarkMode(false);
        setIsSystemDefault(false);
      }
    } catch (error) {
      console.error('Error cargando preferencia de tema:', error);
      setIsDarkMode(false);
      setIsSystemDefault(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cargar preferencia guardada al inicializar
  useEffect(() => {
    loadThemePreference();
  }, [loadThemePreference]);

  // Escuchar cambios del sistema si está en modo automático
  useEffect(() => {
    if (isSystemDefault) {
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        setIsDarkMode(colorScheme === 'dark');
      });

      return () => subscription?.remove();
    }
  }, [isSystemDefault]);

  const toggleTheme = useCallback(() => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    setIsSystemDefault(false);
    saveThemePreference(newIsDarkMode, false);
  }, [isDarkMode, saveThemePreference]);

  const setThemeMode = useCallback(
    (mode) => {
      if (mode === 'system') {
        const systemColorScheme = Appearance.getColorScheme();
        setIsDarkMode(systemColorScheme === 'dark');
        setIsSystemDefault(true);
        saveThemePreference(systemColorScheme === 'dark', true);
      } else if (mode === 'light') {
        setIsDarkMode(false);
        setIsSystemDefault(false);
        saveThemePreference(false, false);
      } else if (mode === 'dark') {
        setIsDarkMode(true);
        setIsSystemDefault(false);
        saveThemePreference(true, false);
      }
    },
    [saveThemePreference]
  );

  const getCurrentThemeMode = useCallback(() => {
    if (isSystemDefault) return 'system';
    return isDarkMode ? 'dark' : 'light';
  }, [isSystemDefault, isDarkMode]);

  const colors = useMemo(() => getColors(isDarkMode), [isDarkMode]);
  const gradients = useMemo(() => getGradients(isDarkMode), [isDarkMode]);

  const value = useMemo(
    () => ({
      isDarkMode,
      isSystemDefault,
      isLoading,
      colors,
      gradients,
      toggleTheme,
      setThemeMode,
      getCurrentThemeMode,
      lightColors,
      darkColors,
      lightGradients,
      darkGradients,
    }),
    [
      isDarkMode,
      isSystemDefault,
      isLoading,
      colors,
      gradients,
      toggleTheme,
      setThemeMode,
      getCurrentThemeMode,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
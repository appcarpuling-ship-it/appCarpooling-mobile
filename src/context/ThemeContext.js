import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const [isSystemDefault, setIsSystemDefault] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar preferencia guardada al inicializar
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Escuchar cambios del sistema si está en modo automático
  useEffect(() => {
    if (isSystemDefault) {
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        setIsDarkMode(colorScheme === 'dark');
      });

      return () => subscription?.remove();
    }
  }, [isSystemDefault]);

  const loadThemePreference = async () => {
    try {
      const savedPreference = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      
      if (savedPreference) {
        const preference = JSON.parse(savedPreference);
        setIsSystemDefault(preference.isSystemDefault);
        
        if (preference.isSystemDefault) {
          // Usar preferencia del sistema
          const systemColorScheme = Appearance.getColorScheme();
          setIsDarkMode(systemColorScheme === 'dark');
        } else {
          // Usar preferencia manual
          setIsDarkMode(preference.isDarkMode);
        }
      } else {
        // Primera vez - usar preferencia del sistema
        const systemColorScheme = Appearance.getColorScheme();
        setIsDarkMode(systemColorScheme === 'dark');
        setIsSystemDefault(true);
      }
    } catch (error) {
      console.error('Error cargando preferencia de tema:', error);
      // Fallback al sistema
      const systemColorScheme = Appearance.getColorScheme();
      setIsDarkMode(systemColorScheme === 'dark');
    } finally {
      setIsLoading(false);
    }
  };

  const saveThemePreference = async (newIsDarkMode, newIsSystemDefault) => {
    try {
      const preference = {
        isDarkMode: newIsDarkMode,
        isSystemDefault: newIsSystemDefault
      };
      await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preference));
    } catch (error) {
      console.error('Error guardando preferencia de tema:', error);
    }
  };

  const toggleTheme = () => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    setIsSystemDefault(false); // Al cambiar manualmente, desactivar modo sistema
    saveThemePreference(newIsDarkMode, false);
  };

  const setThemeMode = (mode) => {
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
  };

  const getCurrentThemeMode = () => {
    if (isSystemDefault) return 'system';
    return isDarkMode ? 'dark' : 'light';
  };

  const colors = getColors(isDarkMode);
  const gradients = getGradients(isDarkMode);

  const value = {
    // Estado del tema
    isDarkMode,
    isSystemDefault,
    isLoading,

    // Colores y gradientes actuales
    colors,
    gradients,

    // Funciones para cambiar tema
    toggleTheme,
    setThemeMode,
    getCurrentThemeMode,

    // Acceso a todos los colores
    lightColors,
    darkColors,
    lightGradients,
    darkGradients,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
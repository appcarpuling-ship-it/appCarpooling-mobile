import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

// Paleta blanco y negro del rediseño. Un solo acento: el inverso del fondo.
// Los tokens de colors.js siguen vivos para las pantallas viejas; este archivo
// es el set reducido que usan las pantallas ya migradas al estilo nuevo.
const LIGHT = {
  bg: '#FFFFFF',
  surface: '#F4F4F5', // fondo de cards/chips sobre bg
  card: '#FFFFFF',
  border: '#E7E7E9',
  text: '#000000',
  textMuted: '#8A8A8E',
  // "invert" = superficie de alto contraste (botón primario, nav flotante)
  invertBg: '#000000',
  invertText: '#FFFFFF',
  scrim: 'rgba(0,0,0,0.06)',
};

const DARK = {
  bg: '#161616', // ya es el negro que usa el resto de la app
  surface: '#212121',
  card: '#1E1E1E',
  border: '#2E2E2E',
  text: '#FFFFFF',
  textMuted: '#8A8A8E',
  invertBg: '#FFFFFF',
  invertText: '#000000',
  scrim: 'rgba(255,255,255,0.08)',
};

// Radios grandes y espaciado generoso: es lo que define el estilo de las refs.
export const radius = { sm: 12, md: 18, lg: 24, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const font = {
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
};

export const useUI = () => {
  let isDarkMode = false;
  try {
    // useColors() lee getCurrentThemeMode(), que devuelve 'system' cuando el
    // usuario sigue al sistema: comparar contra 'dark' daba falso y la pantalla
    // quedaba en claro. isDarkMode ya viene resuelto.
    isDarkMode = useTheme().isDarkMode;
  } catch {
    isDarkMode = false; // fuera del ThemeProvider
  }

  return useMemo(
    () => ({ ...(isDarkMode ? DARK : LIGHT), isDarkMode, radius, space, font }),
    [isDarkMode]
  );
};

export default useUI;

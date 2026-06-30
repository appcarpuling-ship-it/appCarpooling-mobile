// Colores para modo claro — fondo levemente grisáceo para que las cards (blancas) sobresalgan
export const lightColors = {
  // Backgrounds
  background: '#F6F6F8',       // page bg: cool-gray muy sutil
  surface: '#FFFFFF',          // cards / sheets: blanco puro
  surfaceElevated: '#FFFFFF',
  surfaceHover: '#EFEFEF',
  surfaceSubtle: '#F0F0F4',    // secciones recesadas

  // Primary (negro profundo, no puro)
  primary: '#0D0D0D',
  primaryDark: '#000000',
  primaryLight: '#2A2A2A',
  primaryVariant: '#1A1A1A',

  // Accent
  accent: '#0D0D0D',
  accentGreen: '#10B981',
  accentOrange: '#F59E0B',
  accentRed: '#EF4444',

  // Text — jerarquía clara y neutral
  textPrimary: '#0A0A0A',
  textSecondary: '#3D3D3D',
  textTertiary: '#717171',
  textMuted: '#ADADAD',

  // Borders & Dividers
  border: '#E2E2E2',
  borderLight: '#EEEEEE',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Messages
  messagePrimary: '#3B82F6',
  messageSecondary: '#2563EB',

  // Inputs
  inputBackground: '#FFFFFF',
  inputBorder: '#D5D5D5',
  inputBorderFocus: '#0A0A0A',
  placeholder: '#ADADAD',

  // Cards
  cardBackground: '#FFFFFF',
  cardBorder: '#E2E2E2',

  // Overlays / Shadows
  overlay: 'rgba(255, 255, 255, 0.96)',
  overlayLight: 'rgba(0, 0, 0, 0.08)',
  shadow: 'rgba(0, 0, 0, 0.06)',
  shadowMd: 'rgba(0, 0, 0, 0.10)',
  shadowLg: 'rgba(0, 0, 0, 0.15)',
};

// Colores para modo oscuro — negro profundo con capas neutrales (sin tinte azul/morado)
export const darkColors = {
  // Backgrounds
  background: '#111111',       // fondo muy oscuro
  surface: '#1C1C1C',          // cards: ligeramente más claro
  surfaceElevated: '#242424',  // cards elevadas
  surfaceHover: '#2A2A2A',
  surfaceSubtle: '#161616',    // secciones recesadas

  // Primary (blanco suave, no brillante)
  primary: '#F2F2F2',
  primaryDark: '#FFFFFF',
  primaryLight: '#D8D8D8',
  primaryVariant: '#E0E0E0',

  // Accent
  accent: '#F2F2F2',
  accentGreen: '#34D399',
  accentOrange: '#FBBF24',
  accentRed: '#F87171',

  // Text — jerarquía clara
  textPrimary: '#F5F5F5',
  textSecondary: '#CCCCCC',
  textTertiary: '#8A8A8A',
  textMuted: '#555555',

  // Borders & Dividers
  border: '#2A2A2A',
  borderLight: '#1E1E1E',

  // Status
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',

  // Messages
  messagePrimary: '#60A5FA',
  messageSecondary: '#3B82F6',

  // Inputs
  inputBackground: '#1C1C1C',
  inputBorder: '#333333',
  inputBorderFocus: '#F5F5F5',
  placeholder: '#666666',

  // Cards
  cardBackground: '#1C1C1C',
  cardBorder: '#2A2A2A',

  // Overlays / Shadows
  overlay: 'rgba(17, 17, 17, 0.96)',
  overlayLight: 'rgba(255, 255, 255, 0.08)',
  shadow: 'rgba(0, 0, 0, 0.40)',
  shadowMd: 'rgba(0, 0, 0, 0.55)',
  shadowLg: 'rgba(0, 0, 0, 0.70)',
};

export const colors = lightColors;

// Gradientes — mantenidos por retro-compatibilidad (no usar en pantallas nuevas)
export const lightGradients = {
  primary: ['#1F2937', '#111827'],
  primaryVertical: ['#1F2937', '#111827'],
  accent: ['#1F2937', '#111827'],
  light: ['#F8F9FA', '#FFFFFF'],
  card: ['#FFFFFF', '#F8F9FA'],
};

export const darkGradients = {
  primary: ['#F9FAFB', '#E5E7EB'],
  primaryVertical: ['#F9FAFB', '#FFFFFF'],
  accent: ['#F9FAFB', '#E5E7EB'],
  light: ['#1F2937', '#111827'],
  card: ['#1F2937', '#374151'],
};

export const gradients = lightGradients;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 48,
};

export const fontWeight = {
  thin: '100',
  extraLight: '200',
  light: '300',
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',
};

export const fontFamily = {
  thin: 'Sora_100Thin',
  extraLight: 'Sora_200ExtraLight',
  light: 'Sora_300Light',
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
  normal: 'Sora_400Regular',
  primary: 'Sora_500Medium',
  heading: 'Sora_700Bold',
};

export const getColors = (isDark = false) => isDark ? darkColors : lightColors;
export const getGradients = (isDark = false) => isDark ? darkGradients : lightGradients;

export const safeColors = {
  ...colors,
  primary: colors.primary || '#0D0D0D',
  background: colors.background || '#F6F6F8',
  surface: colors.surface || '#FFFFFF',
  textPrimary: colors.textPrimary || '#0A0A0A',
};

export const createColorArray = (...colorValues) => {
  return (Array.isArray(colorValues) ? colorValues : []).map(color => {
    if (typeof color === 'string') return color;
    if (color && typeof color === 'object' && color.primary) return color.primary;
    return '#0D0D0D';
  }).filter(Boolean);
};

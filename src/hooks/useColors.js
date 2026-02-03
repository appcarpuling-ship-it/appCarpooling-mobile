import { useMemo } from 'react';

// Importación directa - Metro bundler maneja esto correctamente
import { colors as baseColors, gradients as baseGradients } from '../theme/colors';

// Usar valores directos para evitar problemas de carga
const BASE_FONTFAMILY = {
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

// Fallback colors in case the main colors object fails to load
const FALLBACK_COLORS = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  accent: '#A855F7',
  accentGreen: '#10B981',
  accentOrange: '#F59E0B',
  accentRed: '#EF4444',
  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  inputBackground: '#FFFFFF',
  inputBorder: '#D1D5DB',
  inputBorderFocus: '#6366F1',
  placeholder: '#6B7280',
  cardBackground: '#FFFFFF',
  cardBorder: '#E5E7EB',
  overlay: 'rgba(255, 255, 255, 0.95)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

const FALLBACK_GRADIENTS = {
  primary: ['#6366F1', '#8B5CF6'],
  primaryVertical: ['#6366F1', '#4F46E5'],
  accent: ['#A855F7', '#EC4899'],
  light: ['#F8F9FA', '#FFFFFF'],
  card: ['#FFFFFF', '#F8F9FA'],
};

const FALLBACK_FONTFAMILY = {
  thin: 'Sora_100Thin',
  extraLight: 'Sora_200ExtraLight',
  light: 'Sora_300Light',
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
};

export const useColors = () => {
  // Siempre retorna un objeto seguro
  const colors = useMemo(() => {
    if (!baseColors || typeof baseColors !== 'object') {
      return { ...FALLBACK_COLORS };
    }
    return { ...FALLBACK_COLORS, ...baseColors };
  }, []);

  const gradients = useMemo(() => {
    if (!baseGradients || typeof baseGradients !== 'object') {
      return { ...FALLBACK_GRADIENTS };
    }
    return { ...FALLBACK_GRADIENTS, ...baseGradients };
  }, []);

  const fontFamily = useMemo(() => {
    // Siempre usar los valores directos para evitar problemas de carga
    return { ...FALLBACK_FONTFAMILY, ...BASE_FONTFAMILY };
  }, []);

  // Helper robusto: nunca retorna undefined
  const createColorArray = (...colorValues) => {
    const safeColors = colors || FALLBACK_COLORS;
    return (Array.isArray(colorValues) ? colorValues : []).map(color => {
      if (!color) return FALLBACK_COLORS.primary;
      if (typeof color === 'string' && color.startsWith('#')) return color;
      if (typeof color === 'string') return color;
      if (typeof color === 'undefined') return FALLBACK_COLORS.primary;
      if (color && safeColors.primary) return safeColors.primary;
      return FALLBACK_COLORS.primary;
    }).filter(Boolean);
  };

  return {
    colors,
    gradients,
    fontFamily,
    createColorArray,
  };
};

export default useColors;
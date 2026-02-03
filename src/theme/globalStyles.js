import { StyleSheet } from 'react-native';
import { fontSize } from './colors';

// Usar valores directos de fontFamily para evitar problemas de carga
const SORA_FONTS = {
  bold: 'Sora_700Bold',
  regular: 'Sora_400Regular',
  semiBold: 'Sora_600SemiBold',
  medium: 'Sora_500Medium',
};

/**
 * Global text styles con tipografía Sora
 * Usa estos estilos para mantener consistencia en toda la app
 */
export const globalTextStyles = {
  // Headings
  h1: {
    fontSize: fontSize.xxxl,
    fontFamily: SORA_FONTS.bold,
    fontWeight: '700',
  },
  h2: {
    fontSize: fontSize.xxl,
    fontFamily: SORA_FONTS.bold,
    fontWeight: '700',
  },
  h3: {
    fontSize: fontSize.xl,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: '600',
  },
  h4: {
    fontSize: fontSize.lg,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: '600',
  },

  // Body text
  body: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.regular,
    fontWeight: '400',
  },
  bodySmall: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    fontWeight: '400',
  },
  bodyXSmall: {
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.regular,
    fontWeight: '400',
  },

  // Emphasis
  bodyBold: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: '600',
  },
  bodyBoldSmall: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: '600',
  },

  // Labels
  label: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.medium,
    fontWeight: '500',
  },
  labelSmall: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.medium,
    fontWeight: '500',
  },

  // Buttons
  button: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: '600',
  },
  buttonSmall: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: '600',
  },

  // Captions
  caption: {
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.regular,
    fontWeight: '400',
  },
  captionBold: {
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.medium,
    fontWeight: '500',
  },
};

/**
 * Función auxiliar para combinar estilos globales con estilos personalizados
 * @param {string} styleType - tipo de estilo predefinido (h1, body, label, etc)
 * @param {object} customStyle - estilos adicionales personalizados
 * @returns {object} estilos combinados
 */
export const applyTextStyle = (styleType, customStyle = {}) => {
  const baseStyle = globalTextStyles[styleType] || globalTextStyles.body;
  return {
    ...baseStyle,
    ...customStyle,
  };
};

export default globalTextStyles;

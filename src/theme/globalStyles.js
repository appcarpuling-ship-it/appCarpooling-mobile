import { StyleSheet } from 'react-native';
import { fontFamily, fontSize } from './colors';

/**
 * Global text styles con tipografía Sora
 * Usa estos estilos para mantener consistencia en toda la app
 */
export const globalTextStyles = {
  // Headings
  h1: {
    fontSize: fontSize.xxxl,
    fontFamily: fontFamily.bold,
    fontWeight: '700',
  },
  h2: {
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.bold,
    fontWeight: '700',
  },
  h3: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.semiBold,
    fontWeight: '600',
  },
  h4: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.semiBold,
    fontWeight: '600',
  },

  // Body text
  body: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    fontWeight: '400',
  },
  bodySmall: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    fontWeight: '400',
  },
  bodyXSmall: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    fontWeight: '400',
  },

  // Emphasis
  bodyBold: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semiBold,
    fontWeight: '600',
  },
  bodyBoldSmall: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semiBold,
    fontWeight: '600',
  },

  // Labels
  label: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
    fontWeight: '500',
  },
  labelSmall: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontWeight: '500',
  },

  // Buttons
  button: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semiBold,
    fontWeight: '600',
  },
  buttonSmall: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semiBold,
    fontWeight: '600',
  },

  // Captions
  caption: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    fontWeight: '400',
  },
  captionBold: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
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

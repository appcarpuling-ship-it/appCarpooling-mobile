import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';

// Usar valores directos para evitar problemas de carga
const SORA_FONTS = {
  thin: 'Sora_100Thin',
  extraLight: 'Sora_200ExtraLight',
  light: 'Sora_300Light',
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
};

/**
 * Componente Text personalizado que usa Sora por defecto
 * Asegura que todos los textos usen la tipografía Sora
 */
const SoraText = ({ style, fontWeight, ...props }) => {
  // Mapear fontWeight a fontFamily de Sora si no se especifica fontFamily
  const getFontFamily = () => {
    if (style?.fontFamily) {
      return style.fontFamily;
    }

    // Si se especifica fontWeight, mapearlo a la fuente Sora correspondiente
    const weight = fontWeight || style?.fontWeight;
    if (weight) {
      const weightMap = {
        '100': SORA_FONTS.thin,
        '200': SORA_FONTS.extraLight,
        '300': SORA_FONTS.light,
        '400': SORA_FONTS.regular,
        '500': SORA_FONTS.medium,
        '600': SORA_FONTS.semiBold,
        '700': SORA_FONTS.bold,
        '800': SORA_FONTS.extraBold,
        thin: SORA_FONTS.thin,
        extraLight: SORA_FONTS.extraLight,
        light: SORA_FONTS.light,
        normal: SORA_FONTS.regular,
        regular: SORA_FONTS.regular,
        medium: SORA_FONTS.medium,
        semibold: SORA_FONTS.semiBold,
        semiBold: SORA_FONTS.semiBold,
        bold: SORA_FONTS.bold,
        extraBold: SORA_FONTS.extraBold,
      };
      return weightMap[weight] || SORA_FONTS.regular;
    }

    // Por defecto, usar regular
    return SORA_FONTS.regular;
  };

  const combinedStyle = [
    { fontFamily: getFontFamily() },
    style,
  ];

  return <RNText style={combinedStyle} {...props} />;
};

export default SoraText;

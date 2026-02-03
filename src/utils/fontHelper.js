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
 * Helper para mapear fontWeight a fontFamily de Sora
 * Asegura que todos los textos usen la tipografía Sora
 */
export const getSoraFontFamily = (fontWeight) => {
  if (!fontWeight) {
    return SORA_FONTS.regular;
  }

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

  return weightMap[fontWeight] || SORA_FONTS.regular;
};

/**
 * Helper para crear estilos de texto con Sora automáticamente
 * Si el estilo tiene fontWeight pero no fontFamily, agrega fontFamily de Sora
 */
export const withSoraFont = (style) => {
  if (!style) return { fontFamily: SORA_FONTS.regular };
  
  const { fontWeight, fontFamily: existingFontFamily, ...rest } = style;
  
  // Si ya tiene fontFamily, mantenerlo
  if (existingFontFamily) {
    return style;
  }
  
  // Si tiene fontWeight, mapearlo a Sora
  if (fontWeight) {
    return {
      ...rest,
      fontWeight,
      fontFamily: getSoraFontFamily(fontWeight),
    };
  }
  
  // Por defecto, usar regular
  return {
    ...rest,
    fontFamily: SORA_FONTS.regular,
  };
};

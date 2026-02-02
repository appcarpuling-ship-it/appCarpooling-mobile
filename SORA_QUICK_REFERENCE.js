// Referencia Rápida - Plantillas de Estilos con Sora Font

import { StyleSheet } from 'react-native';
import { fontSize, fontFamily, spacing, borderRadius } from '../theme/colors';

// ============================================
// PLANTILLA 1: Componente con Hook useColors
// ============================================
/*
import useColors from '../../hooks/useColors';

const MyComponent = () => {
  const { colors, fontFamily, gradients, createColorArray } = useColors();
  
  const dynamicStyles = StyleSheet.create({
    // Aquí van los estilos que usan colors y fontFamily
    heading: {
      fontSize: fontSize.xl,
      fontFamily: fontFamily.bold,
      color: colors.textPrimary,
    },
    body: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.regular,
      color: colors.textSecondary,
    },
  });
  
  // ... resto del componente
};
*/

// ============================================
// PLANTILLA 2: Estilos Estáticos Globales
// ============================================
/*
import { fontFamily, fontSize, spacing } from '../theme/colors';

const staticStyles = StyleSheet.create({
  heading: {
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.bold,
    fontWeight: '700',
  },
  subheading: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.semiBold,
    fontWeight: '600',
  },
  body: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    fontWeight: '400',
  },
});
*/

// ============================================
// TABLA DE REFERENCIA RÁPIDA
// ============================================

const QUICK_REFERENCE = {
  // Pesos disponibles y sus casos de uso
  fontWeights: {
    'thin': { family: 'Sora_100Thin', weight: '100', uso: 'Muy raro, solo para énfasis especial' },
    'extraLight': { family: 'Sora_200ExtraLight', weight: '200', uso: 'Raro, solo para textos decorativos' },
    'light': { family: 'Sora_300Light', weight: '300', uso: 'Textos secundarios ligeros' },
    'regular': { family: 'Sora_400Regular', weight: '400', uso: 'Texto principal, párrafos' },
    'medium': { family: 'Sora_500Medium', weight: '500', uso: 'Labels, captions, notas' },
    'semiBold': { family: 'Sora_600SemiBold', weight: '600', uso: 'Botones, títulos pequeños' },
    'bold': { family: 'Sora_700Bold', weight: '700', uso: 'Títulos principales, headings' },
    'extraBold': { family: 'Sora_800ExtraBold', weight: '800', uso: 'Títulos muy grandes, logos' },
  },

  // Combinaciones comunes
  commonCombinations: {
    h1: { fontFamily: 'Sora_700Bold', fontSize: 32, lineHeight: 40 },
    h2: { fontFamily: 'Sora_700Bold', fontSize: 24, lineHeight: 32 },
    h3: { fontFamily: 'Sora_600SemiBold', fontSize: 20, lineHeight: 28 },
    h4: { fontFamily: 'Sora_600SemiBold', fontSize: 18, lineHeight: 24 },
    body: { fontFamily: 'Sora_400Regular', fontSize: 16, lineHeight: 24 },
    bodySmall: { fontFamily: 'Sora_400Regular', fontSize: 14, lineHeight: 20 },
    caption: { fontFamily: 'Sora_500Medium', fontSize: 12, lineHeight: 16 },
    button: { fontFamily: 'Sora_600SemiBold', fontSize: 16, lineHeight: 24 },
    label: { fontFamily: 'Sora_500Medium', fontSize: 14, lineHeight: 20 },
  },
};

// ============================================
// EJEMPLOS DE USO EN COMPONENTES
// ============================================

// Ejemplo 1: Screen con useState y dinámicos
export const EXAMPLE_SCREEN = `
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import useColors from '../../hooks/useColors';
import { fontSize, spacing } from '../theme/colors';

export const MyScreen = () => {
  const { colors, fontFamily } = useColors();
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.lg,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: fontSize.xxl,
      fontFamily: fontFamily.bold,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    description: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.regular,
      color: colors.textSecondary,
    },
  });
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi Título</Text>
      <Text style={styles.description}>Mi descripción</Text>
    </View>
  );
};
`;

// Ejemplo 2: Componente con estilos estáticos
export const EXAMPLE_COMPONENT = `
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSize, spacing, colors } from '../theme/colors';

export const MyComponent = ({ title, subtitle }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.semiBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.textSecondary,
  },
});
`;

// ============================================
// CHECKLIST PARA NUEVOS COMPONENTES
// ============================================
export const MIGRATION_CHECKLIST = [
  '1. ✓ Importar fontFamily desde colors.js',
  '2. ✓ Importar useColors en screens (para componentes dinámicos)',
  '3. ✓ Añadir fontFamily a TODOS los estilos de Text',
  '4. ✓ Usar fontFamily.regular como defecto',
  '5. ✓ Mantener fontWeight para retrocompatibilidad',
  '6. ✓ Testear en iOS y Android',
  '7. ✓ Revisar contraste y legibilidad',
  '8. ✓ Documentar cambios en PR',
];

// ============================================
// TIPS Y MEJORES PRÁCTICAS
// ============================================
export const BEST_PRACTICES = {
  siempre: [
    'Usar fontFamily desde colors.js',
    'Incluir fontFamily en TODOS los estilos de texto',
    'Usar hook useColors() en screens para estilos dinámicos',
    'Mantener fontWeight para consistencia',
  ],
  evitar: [
    'Hardcodear nombres de fuentes',
    'Usar fontWeight sin fontFamily',
    'Crear nuevos estilos sin fontFamily',
    'Olvidar actualizar componentes al cambiar tipografía',
  ],
  testing: [
    'Verificar en dispositivos iOS y Android',
    'Comprobar zoom text accesibility',
    'Validar contraste de colores',
    'Revisar en diferentes tamaños de pantalla',
  ],
};

export default QUICK_REFERENCE;

// Sistema de diseño centralizado — importar desde aquí en lugar de colors.js directamente
export { spacing, borderRadius, fontSize, fontWeight, fontFamily, getColors, getGradients } from './colors';

// Sombras — úsalas en styleSheet con spread: { ...shadows.md }
export const shadows = {
  none: {},
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Fuentes Sora — constante directa para evitar problemas de carga dinámica
export const SF = {
  thin:       'Sora_100Thin',
  extraLight: 'Sora_200ExtraLight',
  light:      'Sora_300Light',
  regular:    'Sora_400Regular',
  medium:     'Sora_500Medium',
  semiBold:   'Sora_600SemiBold',
  bold:       'Sora_700Bold',
  extraBold:  'Sora_800ExtraBold',
};

// Duraciones de animación en ms
export const duration = {
  instant: 100,
  fast:    150,
  normal:  250,
  slow:    400,
};

// Escala tipográfica completa con Sora
export const textStyles = {
  display: { fontSize: 48, lineHeight: 56, fontFamily: SF.bold, letterSpacing: -1 },
  h1:      { fontSize: 30, lineHeight: 38, fontFamily: SF.bold, letterSpacing: -0.5 },
  h2:      { fontSize: 24, lineHeight: 32, fontFamily: SF.bold, letterSpacing: -0.3 },
  h3:      { fontSize: 20, lineHeight: 28, fontFamily: SF.semiBold },
  h4:      { fontSize: 17, lineHeight: 24, fontFamily: SF.semiBold },
  body:    { fontSize: 15, lineHeight: 22, fontFamily: SF.regular },
  bodyMd:  { fontSize: 16, lineHeight: 24, fontFamily: SF.regular },
  bodySm:  { fontSize: 13, lineHeight: 18, fontFamily: SF.regular },
  label:   { fontSize: 14, lineHeight: 20, fontFamily: SF.medium },
  labelSm: { fontSize: 12, lineHeight: 16, fontFamily: SF.medium },
  caption: { fontSize: 11, lineHeight: 14, fontFamily: SF.medium, letterSpacing: 0.3 },
  button:  { fontSize: 15, lineHeight: 22, fontFamily: SF.semiBold },
  buttonSm:{ fontSize: 13, lineHeight: 18, fontFamily: SF.semiBold },
  tag:     { fontSize: 11, lineHeight: 14, fontFamily: SF.semiBold, letterSpacing: 0.8, textTransform: 'uppercase' },
};

import {
  Sora_100Thin,
  Sora_200ExtraLight,
  Sora_300Light,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';

export const soraFonts = {
  Sora_100Thin,
  Sora_200ExtraLight,
  Sora_300Light,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
};

// Font family names to use in styles
export const fontFamily = {
  thin: 'Sora_100Thin',
  extraLight: 'Sora_200ExtraLight',
  light: 'Sora_300Light',
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',

  // Default mappings
  normal: 'Sora_400Regular',
  primary: 'Sora_500Medium',
  heading: 'Sora_700Bold',
};

// Typography styles with Sora font
export const typography = {
  display: {
    fontSize: 48,
    lineHeight: 56,
    fontFamily: fontFamily.bold,
    letterSpacing: -1,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.25,
  },
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fontFamily.semiBold,
  },
  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fontFamily.semiBold,
  },
  body1: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fontFamily.regular,
  },
  body2: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamily.regular,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamily.medium,
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fontFamily.semiBold,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamily.medium,
    letterSpacing: 0.25,
  },
};
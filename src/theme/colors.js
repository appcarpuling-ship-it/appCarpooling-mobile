export const colors = {
  // Backgrounds - LIGHT MODE
  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceElevated: '#FFFFFF',
  surfaceHover: '#F1F3F4',

  // Primary colors - Black and gray tones
  primary: '#1F2937', // Black
  primaryDark: '#111827',
  primaryLight: '#374151',

  // Accent colors
  accent: '#111827', // Black
  accentGreen: '#10B981',
  accentOrange: '#F59E0B',
  accentRed: '#EF4444',

  // Text colors - BLACK FOR LIGHT MODE
  textPrimary: '#000000',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  textMuted: '#9CA3AF',

  // Borders & Dividers - LIGHT
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Input colors - LIGHT MODE
  inputBackground: '#FFFFFF',
  inputBorder: '#D1D5DB',
  inputBorderFocus: '#1F2937',
  placeholder: '#6B7280',

  // Card colors - LIGHT MODE
  cardBackground: '#FFFFFF',
  cardBorder: '#E5E7EB',

  // Overlay - LIGHT MODE
  overlay: 'rgba(255, 255, 255, 0.95)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',

  // Shadow - LIGHT MODE
  shadow: 'rgba(0, 0, 0, 0.1)',
};

export const gradients = {
  primary: ['#1F2937', '#111827'],
  primaryVertical: ['#1F2937', '#111827'],
  accent: ['#1F2937', '#111827'],
  light: ['#F8F9FA', '#FFFFFF'], // LIGHT MODE GRADIENT
  card: ['#FFFFFF', '#F8F9FA'], // LIGHT CARD GRADIENT
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
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

// Font families - Re-exported from typography.js to avoid duplication
// Import directly from typography.js where needed in components
export const fontFamily = {
  thin: 'Sora_100Thin',
  extraLight: 'Sora_200ExtraLight',
  light: 'Sora_300Light',
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
};

// Typography configuration will be imported directly where needed
// to avoid circular dependency issues

// Helper function to ensure colors are available
export const safeColors = {
  ...colors,
  // Ensure we have fallbacks if something goes wrong
  primary: colors.primary || '#6366F1',
  background: colors.background || '#FFFFFF',
  surface: colors.surface || '#F8F9FA',
  textPrimary: colors.textPrimary || '#000000',
};

// Safe array creator for React Native components that expect color arrays
export const createColorArray = (...colorValues) => {
  return (Array.isArray(colorValues) ? colorValues : []).map(color => {
    if (typeof color === 'string') return color;
    if (color && typeof color === 'object' && color.primary) return color.primary;
    return '#6366F1'; // fallback color
  }).filter(Boolean);
};

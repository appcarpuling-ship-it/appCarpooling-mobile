import React from 'react';
import { View, StyleSheet } from 'react-native';
import SoraText from '../SoraText';
import { useColors } from '../../hooks/useColors';
import { textStyles } from '../../theme/tokens';

/**
 * Badge reutilizable.
 * variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
 * size:    'sm' | 'md'
 */
const Badge = ({ label, variant = 'neutral', size = 'md', style }) => {
  const { colors, isDarkMode } = useColors();

  const { bg, text } = getBadgeColors(variant, colors, isDarkMode);
  const sizeStyle = size === 'sm' ? styles.sm : styles.md;

  return (
    <View style={[styles.base, sizeStyle, { backgroundColor: bg }, style]}>
      <SoraText style={[styles.text, { color: text }]}>{label}</SoraText>
    </View>
  );
};

const getBadgeColors = (variant, colors, isDarkMode) => {
  switch (variant) {
    case 'success':
      return {
        bg: isDarkMode ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.12)',
        text: colors.success,
      };
    case 'warning':
      return {
        bg: isDarkMode ? 'rgba(251, 191, 36, 0.15)' : 'rgba(245, 158, 11, 0.12)',
        text: colors.warning,
      };
    case 'error':
      return {
        bg: isDarkMode ? 'rgba(248, 113, 113, 0.15)' : 'rgba(239, 68, 68, 0.12)',
        text: colors.error,
      };
    case 'info':
      return {
        bg: isDarkMode ? 'rgba(96, 165, 250, 0.15)' : 'rgba(59, 130, 246, 0.12)',
        text: colors.info,
      };
    default:
      return {
        bg: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        text: colors.textSecondary,
      };
  }
};

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sm: { paddingHorizontal: 8, paddingVertical: 3 },
  md: { paddingHorizontal: 10, paddingVertical: 4 },
  text: {
    ...textStyles.caption,
  },
});

export default Badge;

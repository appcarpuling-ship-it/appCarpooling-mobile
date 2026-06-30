import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { shadows } from '../../theme/tokens';

/**
 * Card unificada.
 * variant: 'default' | 'elevated' | 'flat' | 'subtle'
 */
const Card = ({ variant = 'default', style, children, ...props }) => {
  const { colors, isDarkMode } = useColors();

  const variantStyle = getVariantStyle(variant, colors, isDarkMode);

  return (
    <View style={[styles.base, variantStyle, style]} {...props}>
      {children}
    </View>
  );
};

const getVariantStyle = (variant, colors, isDarkMode) => {
  switch (variant) {
    case 'elevated':
      return {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: isDarkMode ? 1 : 0,
        borderColor: colors.border,
        ...(isDarkMode ? {} : shadows.md),
      };
    case 'flat':
      return {
        backgroundColor: colors.surfaceSubtle,
        borderRadius: 14,
      };
    case 'subtle':
      return {
        backgroundColor: colors.surfaceHover,
        borderRadius: 12,
      };
    case 'default':
    default:
      return {
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        ...(isDarkMode ? {} : shadows.sm),
      };
  }
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

export default Card;

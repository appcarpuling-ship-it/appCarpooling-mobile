import React from 'react';
import { TouchableOpacity, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';
import { SF, textStyles, shadows } from '../../theme/tokens';
import SoraText from '../SoraText';

/**
 * Button unificado.
 * variant: 'filled' | 'outlined' | 'ghost' | 'danger'
 * size:    'sm' | 'md' | 'lg'
 */
const Button = ({
  variant = 'filled',
  size = 'md',
  label,
  onPress,
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  labelStyle,
  ...props
}) => {
  const { colors, isDarkMode } = useColors();
  const isDisabled = disabled || loading;

  const sizeStyle = SIZE_STYLES[size];
  const variantStyle = getVariantStyle(variant, colors, isDarkMode);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        sizeStyle.container,
        variantStyle.container,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyle.textColor}
        />
      ) : (
        <View style={styles.row}>
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={sizeStyle.iconSize}
              color={variantStyle.textColor}
              style={styles.iconLeft}
            />
          )}
          <SoraText
            style={[
              sizeStyle.text,
              { color: variantStyle.textColor },
              labelStyle,
            ]}
          >
            {label}
          </SoraText>
          {rightIcon && (
            <Ionicons
              name={rightIcon}
              size={sizeStyle.iconSize}
              color={variantStyle.textColor}
              style={styles.iconRight}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const getVariantStyle = (variant, colors, isDarkMode) => {
  switch (variant) {
    case 'outlined':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.textPrimary,
        },
        textColor: colors.textPrimary,
      };
    case 'ghost':
      return {
        container: {
          backgroundColor: 'transparent',
        },
        textColor: colors.textPrimary,
      };
    case 'danger':
      return {
        container: {
          backgroundColor: isDarkMode ? '#EF4444' : '#DC2626',
        },
        textColor: '#FFFFFF',
      };
    case 'filled':
    default:
      return {
        container: {
          backgroundColor: colors.textPrimary,
        },
        textColor: colors.background,
      };
  }
};

const SIZE_STYLES = {
  sm: {
    container: { height: 40, paddingHorizontal: 16, borderRadius: 10 },
    text:      { ...textStyles.buttonSm },
    iconSize:  16,
  },
  md: {
    container: { height: 52, paddingHorizontal: 22, borderRadius: 12 },
    text:      { ...textStyles.button },
    iconSize:  18,
  },
  lg: {
    container: { height: 58, paddingHorizontal: 28, borderRadius: 14 },
    text:      { ...textStyles.button, fontSize: 17 },
    iconSize:  20,
  },
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});

export default Button;

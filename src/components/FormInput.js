import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme/colors';

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


// Safe colors fallback to prevent 'colors is not defined' errors
const safeColors = (() => {
  try {
    const { colors } = require('./src/theme/colors');
    return colors;
  } catch {
    try {
      const { colors } = require('../theme/colors');
      return colors;
    } catch {
      try {
        const { colors } = require('../../theme/colors');
        return colors;
      } catch {
        return {
          background: '#FFFFFF', surface: '#F8F9FA', surfaceElevated: '#FFFFFF',
          textPrimary: '#000000', textSecondary: '#374151', textTertiary: '#6B7280',
          textMuted: '#9CA3AF', primary: '#6366F1', primaryDark: '#4F46E5',
          accent: '#A855F7', accentGreen: '#10B981', accentOrange: '#F59E0B',
          accentRed: '#EF4444', success: '#10B981', warning: '#F59E0B',
          error: '#EF4444', info: '#3B82F6', inputBackground: '#FFFFFF',
          inputBorder: '#D1D5DB', borderLight: '#F3F4F6', border: '#E5E7EB'
        };
      }
    }
  }
})();

const FormInput = ({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
  editable = true,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  inputStyle,
  showPasswordToggle = false,
  required = false,
  helper,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { isDarkMode } = useTheme();

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (onBlur) {
      onBlur();
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const getBorderColor = () => {
    if (error) return isDarkMode ? '#EF4444' : '#DC2626';
    if (isFocused) return isDarkMode ? '#3B82F6' : '#6366F1';
    return isDarkMode ? '#404040' : '#E5E7EB';
  };

  const getIconColor = () => {
    if (error) return isDarkMode ? '#EF4444' : '#DC2626';
    if (isFocused) return isDarkMode ? '#3B82F6' : '#6366F1';
    return isDarkMode ? '#9CA3AF' : '#6B7280';
  };

  const actualSecureTextEntry = showPasswordToggle ? !showPassword : secureTextEntry;

  return (
    <View style={[styles.container, style]}>
      {/* Label */}
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {label}
            {required && <Text style={[styles.required, { color: isDarkMode ? '#EF4444' : '#DC2626' }]}> *</Text>}
          </Text>
          {maxLength && value && (
            <Text style={[
              styles.characterCount,
              { color: value.length > maxLength * 0.9 ? (isDarkMode ? '#F59E0B' : '#D97706') : (isDarkMode ? '#9CA3AF' : '#6B7280') }
            ]}>
              {value.length}/{maxLength}
            </Text>
          )}
        </View>
      )}

      {/* Input Container */}
      <View style={[
        styles.inputContainer,
        {
          backgroundColor: isDarkMode ? '#292929' : '#F8F9FA',
          borderColor: getBorderColor(),
          borderWidth: error ? 2 : 1,
        },
        !editable && styles.inputDisabled,
        multiline && styles.multilineContainer,
      ]}>
        {/* Left Icon */}
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Ionicons
              name={leftIcon}
              size={20}
              color={getIconColor()}
            />
          </View>
        )}

        {/* Text Input */}
        <TextInput
          style={[
            styles.textInput,
            { color: isDarkMode ? '#FFFFFF' : '#1F2937' },
            inputStyle,
            multiline && styles.multilineInput,
            leftIcon && styles.textInputWithLeftIcon,
            (rightIcon || showPasswordToggle) && styles.textInputWithRightIcon,
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
          secureTextEntry={actualSecureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          selectionColor={isDarkMode ? '#3B82F6' : '#6366F1'}
          {...props}
        />

        {/* Right Icon or Password Toggle */}
        {(showPasswordToggle || rightIcon) && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={showPasswordToggle ? togglePasswordVisibility : onRightIconPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={
                showPasswordToggle
                  ? (showPassword ? 'eye-outline' : 'eye-off-outline')
                  : rightIcon
              }
              size={20}
              color={getIconColor()}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Helper Text */}
      {helper && !error && (
        <Text style={[styles.helper, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>{helper}</Text>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle"
            size={14}
            color={isDarkMode ? '#EF4444' : '#DC2626'}
          />
          <Text style={[styles.errorText, { color: isDarkMode ? '#EF4444' : '#DC2626' }]}>{error}</Text>
        </View>
      )}

      {/* Success Indicator */}
      {!error && value && isFocused && (
        <View style={styles.successContainer}>
          <Ionicons
            name="checkmark-circle"
            size={14}
            color={isDarkMode ? '#10B981' : '#059669'}
          />
          <Text style={[styles.successText, { color: isDarkMode ? '#10B981' : '#059669' }]}>Válido</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semibold,
    color: safeColors.textSecondary,
  },
  required: {
    color: safeColors.error || '#EF4444',
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.bold,
    fontWeight: fontWeight.bold,
  },
  characterCount: {
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.medium,
    fontWeight: fontWeight.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: safeColors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  multilineContainer: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
  inputDisabled: {
    backgroundColor: safeColors.surfaceDisabled || safeColors.surface,
    opacity: 0.6,
  },
  leftIconContainer: {
    marginRight: spacing.sm,
  },
  rightIconContainer: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.regular,
    color: safeColors.textPrimary,
    paddingVertical: spacing.sm,
  },
  textInputWithLeftIcon: {
    marginLeft: 0,
  },
  textInputWithRightIcon: {
    marginRight: 0,
  },
  multilineInput: {
    textAlignVertical: 'top',
    minHeight: 80,
  },
  helper: {
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.regular,
    color: safeColors.textTertiary,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.regular,
    color: safeColors.error || '#EF4444',
    marginLeft: spacing.xs,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  successText: {
    fontSize: fontSize.xs,
    color: safeColors.success || '#10B981',
    marginLeft: spacing.xs,
  },
});

export default FormInput;
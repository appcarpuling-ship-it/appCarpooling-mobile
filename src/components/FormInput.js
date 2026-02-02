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
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme/colors';


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
    if (error) return colors.error || '#EF4444';
    if (isFocused) return colors.primary;
    return colors.border;
  };

  const getIconColor = () => {
    if (error) return colors.error || '#EF4444';
    if (isFocused) return colors.primary;
    return colors.textTertiary;
  };

  const actualSecureTextEntry = showPasswordToggle ? !showPassword : secureTextEntry;

  return (
    <View style={[styles.container, style]}>
      {/* Label */}
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
          {maxLength && value && (
            <Text style={[
              styles.characterCount,
              { color: value.length > maxLength * 0.9 ? colors.warning || '#F59E0B' : colors.textTertiary }
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
          placeholderTextColor={colors.placeholder}
          secureTextEntry={actualSecureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          selectionColor={colors.primary}
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
        <Text style={styles.helper}>{helper}</Text>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle"
            size={14}
            color={colors.error || '#EF4444'}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Success Indicator */}
      {!error && value && isFocused && (
        <View style={styles.successContainer}>
          <Ionicons
            name="checkmark-circle"
            size={14}
            color={colors.success || '#10B981'}
          />
          <Text style={styles.successText}>Válido</Text>
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
    fontWeight: fontWeight.semibold,
    color: safeColors.textSecondary,
  },
  required: {
    color: safeColors.error || '#EF4444',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  characterCount: {
    fontSize: fontSize.xs,
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
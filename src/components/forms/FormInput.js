import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import SoraText from '../SoraText';
import { SF, textStyles } from '../../theme/tokens';
import { spacing, borderRadius, fontSize } from '../../theme/colors';

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

  // Colores inline alineados con el nuevo sistema
  const bg       = isDarkMode ? '#1C1C1C' : '#FFFFFF';
  const border   = error
    ? (isDarkMode ? '#F87171' : '#DC2626')
    : isFocused
    ? (isDarkMode ? '#F5F5F5' : '#0A0A0A')
    : (isDarkMode ? '#333333' : '#D5D5D5');
  const iconColor = error
    ? (isDarkMode ? '#F87171' : '#DC2626')
    : isFocused
    ? (isDarkMode ? '#F5F5F5' : '#0A0A0A')
    : (isDarkMode ? '#666666' : '#ADADAD');
  const textColor   = isDarkMode ? '#F5F5F5' : '#0A0A0A';
  const labelColor  = isDarkMode ? '#8A8A8A' : '#717171';
  const helperColor = isDarkMode ? '#666666' : '#ADADAD';

  const actualSecure = showPasswordToggle ? !showPassword : secureTextEntry;

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelRow}>
          <SoraText style={[styles.label, { color: labelColor }]}>
            {label}
            {required && <SoraText style={{ color: isDarkMode ? '#F87171' : '#DC2626' }}> *</SoraText>}
          </SoraText>
          {maxLength && value ? (
            <SoraText style={[styles.charCount, {
              color: value.length > maxLength * 0.9
                ? (isDarkMode ? '#FBBF24' : '#D97706')
                : helperColor,
            }]}>
              {value.length}/{maxLength}
            </SoraText>
          ) : null}
        </View>
      )}

      <View style={[
        styles.inputWrap,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: error || isFocused ? 2 : 1,
        },
        !editable && styles.disabled,
        multiline && styles.multiline,
      ]}>
        {leftIcon && (
          <View style={[styles.leftIcon, multiline && styles.leftIconMultiline]}>
            <Ionicons name={leftIcon} size={19} color={iconColor} />
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            { color: textColor, fontFamily: SF.regular },
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => { setIsFocused(false); onBlur?.(); }}
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? '#555555' : '#ADADAD'}
          secureTextEntry={actualSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          selectionColor={isDarkMode ? '#60A5FA' : '#3B82F6'}
          {...(multiline && Platform.OS === 'android' ? { includeFontPadding: false } : {})}
          {...props}
        />

        {(showPasswordToggle || rightIcon) && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={showPasswordToggle ? () => setShowPassword(!showPassword) : onRightIconPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPasswordToggle
                ? (showPassword ? 'eye-outline' : 'eye-off-outline')
                : rightIcon}
              size={19}
              color={iconColor}
            />
          </TouchableOpacity>
        )}
      </View>

      {helper && !error && (
        <SoraText style={[styles.helper, { color: helperColor }]}>{helper}</SoraText>
      )}

      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={13} color={isDarkMode ? '#F87171' : '#DC2626'} />
          <SoraText style={[styles.errorText, { color: isDarkMode ? '#F87171' : '#DC2626' }]}>
            {error}
          </SoraText>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label:     { ...textStyles.labelSm },
  charCount: { ...textStyles.caption },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  multiline: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
  disabled: { opacity: 0.5 },
  leftIcon: { marginRight: spacing.sm },
  leftIconMultiline: {
    paddingTop: Platform.select({ ios: 2, android: 0, default: 0 }),
  },
  rightIcon: { marginLeft: spacing.sm, padding: 2 },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 80,
  },
  helper: { ...textStyles.caption, marginTop: 5, marginLeft: 2 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    marginLeft: 2,
  },
  errorText: { ...textStyles.caption, flex: 1 },
});

export default FormInput;

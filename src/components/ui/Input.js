import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SoraText from '../SoraText';
import { useColors } from '../../hooks/useColors';
import { SF, textStyles } from '../../theme/tokens';

/**
 * Input unificado con label, error, icon y password toggle.
 * Reemplaza a FormInput en pantallas nuevas; FormInput sigue vigente en las existentes.
 */
const Input = ({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  placeholder,
  secureTextEntry,
  showPasswordToggle = false,
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
  required = false,
  helper,
  style,
  inputStyle,
  ...props
}) => {
  const { colors, isDarkMode } = useColors();
  const [focused, setFocused] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
    ? colors.inputBorderFocus
    : colors.inputBorder;

  const borderWidth = error || focused ? 2 : 1;

  const iconColor = error
    ? colors.error
    : focused
    ? colors.textPrimary
    : colors.textMuted;

  const isSecure = showPasswordToggle ? !showPass : secureTextEntry;

  return (
    <View style={[styles.wrapper, style]}>
      {label && (
        <View style={styles.labelRow}>
          <SoraText style={[styles.label, { color: colors.textTertiary }]}>
            {label}
            {required && (
              <SoraText style={{ color: colors.error }}> *</SoraText>
            )}
          </SoraText>
          {maxLength && value ? (
            <SoraText
              style={[
                styles.charCount,
                {
                  color:
                    value.length > maxLength * 0.9
                      ? colors.warning
                      : colors.textMuted,
                },
              ]}
            >
              {value.length}/{maxLength}
            </SoraText>
          ) : null}
        </View>
      )}

      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.inputBackground,
            borderColor,
            borderWidth,
          },
          !editable && styles.disabled,
          multiline && styles.multiline,
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={19}
            color={iconColor}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          style={[
            styles.input,
            { color: colors.textPrimary },
            leftIcon && styles.inputWithLeft,
            (rightIcon || showPasswordToggle) && styles.inputWithRight,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          selectionColor={colors.info}
          {...(multiline && Platform.OS === 'android' ? { includeFontPadding: false } : {})}
          {...props}
        />

        {(showPasswordToggle || rightIcon) && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={showPasswordToggle ? () => setShowPass(!showPass) : onRightIconPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={
                showPasswordToggle
                  ? showPass ? 'eye-outline' : 'eye-off-outline'
                  : rightIcon
              }
              size={19}
              color={iconColor}
            />
          </TouchableOpacity>
        )}
      </View>

      {helper && !error && (
        <SoraText style={[styles.helper, { color: colors.textMuted }]}>{helper}</SoraText>
      )}

      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={13} color={colors.error} />
          <SoraText style={[styles.errorText, { color: colors.error }]}>{error}</SoraText>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    ...textStyles.labelSm,
  },
  charCount: {
    ...textStyles.caption,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  multiline: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  leftIcon: {
    marginRight: 10,
  },
  rightIcon: {
    marginLeft: 10,
    padding: 2,
  },
  input: {
    flex: 1,
    ...textStyles.body,
    paddingVertical: 0,
  },
  inputWithLeft: {
    marginLeft: 0,
  },
  inputWithRight: {
    marginRight: 0,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 80,
    paddingTop: Platform.OS === 'ios' ? 2 : 0,
  },
  helper: {
    ...textStyles.caption,
    marginTop: 5,
    marginLeft: 2,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    marginLeft: 2,
  },
  errorText: {
    ...textStyles.caption,
    flex: 1,
  },
});

export default Input;

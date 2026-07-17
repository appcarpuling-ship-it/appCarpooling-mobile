import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const AlertModal = ({
  visible,
  title,
  message,
  buttons = [],
  onRequestClose,
  type, // 'success' | 'error' | 'warning' | undefined
}) => {
  const { isDarkMode } = useTheme();

  const handleBackdropPress = () => {
    const cancelButton = buttons.find(b => b.style === 'cancel');
    if (cancelButton?.onPress) cancelButton.onPress();
    onRequestClose?.();
  };

  const handleButtonPress = (button) => {
    if (button.onPress) button.onPress();
    onRequestClose?.();
  };

  const backgroundColor = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const titleColor = isDarkMode ? '#FFFFFF' : '#111827';
  const messageColor = isDarkMode ? '#9CA3AF' : '#6B7280';
  const destructiveColor = '#EF4444';

  const iconConfig = {
    success: { name: 'checkmark-circle', color: '#16A34A', bg: isDarkMode ? '#052e16' : '#F0FDF4' },
    error:   { name: 'close-circle',     color: '#DC2626', bg: isDarkMode ? '#3B0D0D' : '#FEF2F2' },
    warning: { name: 'warning',           color: '#D97706', bg: isDarkMode ? '#451A03' : '#FFFBEB' },
  }[type];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.modal, { backgroundColor }]}>
              {iconConfig && (
                <View style={[styles.iconWrap, { backgroundColor: iconConfig.bg }]}>
                  <Ionicons name={iconConfig.name} size={32} color={iconConfig.color} />
                </View>
              )}
              {title ? (
                <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
              ) : null}
              {message ? (
                <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
              ) : null}
              <View style={[styles.buttonsRow, buttons.length > 2 && styles.buttonsColumn]}>
                {buttons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      button.style === 'destructive' && { backgroundColor: '#DC2626', borderColor: '#DC2626' },
                      button.style !== 'destructive' && { borderColor: isDarkMode ? '#2E2E2E' : '#E5E7EB' },
                      index === buttons.length - 1 && button.style !== 'cancel' && button.style !== 'destructive' && {
                        backgroundColor: isDarkMode ? '#FFFFFF' : '#111827',
                        borderColor: isDarkMode ? '#FFFFFF' : '#111827',
                      },
                    ]}
                    onPress={() => handleButtonPress(button)}
                    activeOpacity={0.7}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.buttonText,
                        button.style === 'destructive' && { color: '#FFFFFF' },
                        button.style === 'cancel' && { color: messageColor },
                        index === buttons.length - 1 && button.style !== 'cancel' && button.style !== 'destructive' && {
                          color: isDarkMode ? '#111827' : '#FFFFFF',
                        },
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  // Con más de 2 botones no entran en fila (el texto wrapea): se apilan como en el Alert nativo.
  buttonsColumn: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AlertModal;

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const AlertModal = ({
  visible,
  title,
  message,
  buttons = [],
  onRequestClose,
}) => {
  const { isDarkMode } = useTheme();

  const handleBackdropPress = () => {
    const cancelButton = buttons.find(b => b.style === 'cancel');
    if (cancelButton?.onPress) {
      cancelButton.onPress();
    }
    onRequestClose?.();
  };

  const handleButtonPress = (button) => {
    if (button.onPress) {
      button.onPress();
    }
    onRequestClose?.();
  };

  const backgroundColor = isDarkMode ? '#292929' : '#FFFFFF';
  const titleColor = isDarkMode ? '#FFFFFF' : '#1F2937';
  const messageColor = isDarkMode ? '#9CA3AF' : '#6B7280';
  const destructiveColor = '#EF4444';

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
              {title ? (
                <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
              ) : null}
              {message ? (
                <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
              ) : null}
              <View style={styles.buttonsRow}>
                {buttons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      button.style === 'cancel' && styles.cancelButton,
                      button.style === 'destructive' && { borderColor: destructiveColor },
                      { borderColor: isDarkMode ? '#404040' : '#E5E7EB' },
                    ]}
                    onPress={() => handleButtonPress(button)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        { color: button.style === 'destructive' ? destructiveColor : titleColor },
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    // Estilo base para cancelar
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AlertModal;

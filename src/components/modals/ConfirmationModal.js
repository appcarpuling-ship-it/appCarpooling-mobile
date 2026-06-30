import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const ConfirmationModal = ({
  visible,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  showCancel = true,
  type = 'confirm',
}) => {
  const { isDarkMode } = useTheme();

  const backgroundColor = isDarkMode ? '#292929' : '#FFFFFF';
  const titleColor      = isDarkMode ? '#FFFFFF'  : '#1F2937';
  const messageColor    = isDarkMode ? '#9CA3AF'  : '#6B7280';
  const borderColor     = isDarkMode ? '#404040'  : '#E5E7EB';
  const destructive     = type === 'error';
  // Botón principal lleno cuando es la única acción (sin cancelar)
  const filledConfirm   = !showCancel && !destructive;

  const handleConfirm = () => { onConfirm?.(); onClose(); };
  const handleCancel  = () => { onCancel?.();  onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
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
                {showCancel && (
                  <TouchableOpacity
                    style={[styles.button, { borderColor }]}
                    onPress={handleCancel}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.buttonText, { color: titleColor }]}>{cancelText}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.button,
                    destructive
                      ? { borderColor: '#EF4444' }
                      : filledConfirm
                        ? { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000', borderColor: 'transparent' }
                        : { borderColor },
                  ]}
                  onPress={handleConfirm}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.buttonText,
                    destructive
                      ? { color: '#EF4444' }
                      : filledConfirm
                        ? { color: isDarkMode ? '#000000' : '#FFFFFF' }
                        : { color: titleColor },
                  ]}>
                    {confirmText}
                  </Text>
                </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ConfirmationModal;

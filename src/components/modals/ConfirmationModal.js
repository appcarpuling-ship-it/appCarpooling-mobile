import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, spacing, borderRadius, colors } from '../../theme/colors';
import { useColors } from '../../hooks/useColors';

const { width } = Dimensions.get('window');

const ConfirmationModal = ({
  visible,
  onClose,
  onConfirm,
  onCancel,
  type = 'confirm', // 'confirm', 'success', 'error', 'warbining', 'info'
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  showCancel = true,
  icon,
}) => {
  const { colors: themeColors, createColorArray } = useColors();
  const modalStyles = React.useMemo(() => getStyles(), []);
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: icon || 'checkmark-circle',
          iconColor: '#10B981',
          gradientColors: createColorArray('#10B981', '#059669'),
          backgroundColor: '#D1FAE5',
        };
      case 'error':
        return {
          icon: icon || 'close-circle',
          iconColor: '#EF4444',
          gradientColors: createColorArray('#EF4444', '#DC2626'),
          backgroundColor: '#FEE2E2',
        };
      case 'warning':
        return {
          icon: icon || 'warning',
          iconColor: '#F59E0B',
          gradientColors: createColorArray('#F59E0B', '#D97706'),
          backgroundColor: '#FEF3C7',
        };
      case 'info':
        return {
          icon: icon || 'information-circle',
          iconColor: '#3B82F6',
          gradientColors: createColorArray('#3B82F6', '#2563EB'),
          backgroundColor: '#DBEAFE',
        };
      default: // confirm
        return {
          icon: icon || 'help-circle',
          iconColor: '#6366F1',
          gradientColors: createColorArray('#6366F1', '#4F46E5'),
          backgroundColor: '#EEF2FF',
        };
    }
  };

  const typeConfig = getTypeConfig();

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <Animated.View
          style={[
            modalStyles.container,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={modalStyles.modalContent}>
            {/* Icon Container */}
            <View style={[modalStyles.iconContainer, { backgroundColor: typeConfig.backgroundColor }]}>
              <LinearGradient
                colors={typeConfig.gradientColors}
                style={modalStyles.iconGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={typeConfig.icon} size={48} color="#FFFFFF" />
              </LinearGradient>
            </View>

            {/* Title */}
            {title && (
              <Text style={modalStyles.title}>{title}</Text>
            )}

            {/* Message */}
            {message && (
              <Text style={modalStyles.message}>{message}</Text>
            )}

            {/* Buttons */}
            <View style={modalStyles.buttonContainer}>
              {showCancel && (
                <TouchableOpacity
                  style={[modalStyles.button, modalStyles.cancelButton]}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={modalStyles.cancelButtonText}>{cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[modalStyles.button, modalStyles.confirmButton]}
                onPress={handleConfirm}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={typeConfig.gradientColors}
                  style={modalStyles.confirmButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={modalStyles.confirmButtonText}>{confirmText}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Usar valores directos para evitar problemas de carga
const SORA_FONTS = {
  bold: 'Sora_700Bold',
  regular: 'Sora_400Regular',
  semiBold: 'Sora_600SemiBold',
};

// Crear estilos de forma lazy para evitar problemas de carga
const getStyles = () => {

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    container: {
      width: width * 0.85,
      maxWidth: 400,
    },
    modalContent: {
      backgroundColor: '#FFFFFF',
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    iconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    iconGradient: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: fontSize.xl,
      fontFamily: SORA_FONTS.bold,
      color: '#000000',
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    message: {
      fontSize: fontSize.md,
      fontFamily: SORA_FONTS.regular,
      color: '#6B7280',
      textAlign: 'center',
      marginBottom: spacing.xl,
      lineHeight: 24,
    },
    buttonContainer: {
      flexDirection: 'row',
      width: '100%',
      gap: spacing.md,
    },
    button: {
      flex: 1,
      height: 48,
      borderRadius: borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    cancelButton: {
      backgroundColor: '#F3F4F6',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    cancelButtonText: {
      fontSize: fontSize.md,
      fontFamily: SORA_FONTS.semiBold,
      color: '#374151',
    },
    confirmButton: {
      overflow: 'hidden',
    },
    confirmButtonGradient: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    confirmButtonText: {
      fontSize: fontSize.md,
      fontFamily: SORA_FONTS.semiBold,
      color: '#FFFFFF',
    },
  });
};

export default ConfirmationModal;

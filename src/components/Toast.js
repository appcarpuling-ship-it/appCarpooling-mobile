import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Usar valores directos para evitar problemas de carga
const SORA_FONTS = {
  semiBold: 'Sora_600SemiBold',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const Toast = ({ visible, message, type = 'success', duration = 3000, onHide }) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Animar entrada
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto ocultar después de la duración
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onHide) onHide();
    });
  };

  if (!visible) return null;

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          colors: ['#10B981', '#059669'],
          icon: 'checkmark-circle',
          bgColor: '#D1FAE5',
        };
      case 'error':
        return {
          colors: ['#EF4444', '#DC2626'],
          icon: 'close-circle',
          bgColor: '#FEE2E2',
        };
      case 'warning':
        return {
          colors: ['#F59E0B', '#D97706'],
          icon: 'alert-circle',
          bgColor: '#FEF3C7',
        };
      case 'info':
        return {
          colors: ['#3B82F6', '#2563EB'],
          icon: 'information-circle',
          bgColor: '#DBEAFE',
        };
      default:
        return {
          colors: ['#6B7280', '#4B5563'],
          icon: 'information-circle',
          bgColor: '#F3F4F6',
        };
    }
  };

  const config = getTypeConfig();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <LinearGradient colors={config.colors} style={styles.toast}>
        <View style={styles.content}>
          <Ionicons name={config.icon} size={24} color="#FFFFFF" />
          <Text style={styles.message}>{message}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  toast: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  message: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: '600',
  },
});

export default Toast;

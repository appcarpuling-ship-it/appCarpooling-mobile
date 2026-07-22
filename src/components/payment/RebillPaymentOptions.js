import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useColors from '../../hooks/useColors';
import { useTheme } from '../../context/ThemeContext';

const RebillPaymentOptions = ({
  paymentUrl,
  qrDataUrl,
  amount,
  formatCurrency = (n) => `$${Number(n).toLocaleString('es-AR')}`,
  onCheckoutPress,
  style,
}) => {
  const { colors } = useColors();
  const { isDarkMode } = useTheme();
  const dark = isDarkMode;
  const [showQR, setShowQR] = useState(false);

  const hasCheckout = !!paymentUrl;
  const hasQR = !!qrDataUrl;

  if (!hasCheckout && !hasQR) return null;

  return (
    <View style={[styles.container, style]}>
      {hasCheckout && (
        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={() => onCheckoutPress?.(paymentUrl)}
          activeOpacity={0.8}
        >
          <Text style={styles.checkoutButtonText}>Completar pago</Text>
        </TouchableOpacity>
      )}

      {hasQR && (
        <View style={[styles.qrSection, {
          borderColor: dark ? '#2A2A2A' : '#E5E7EB',
          backgroundColor: dark ? '#1A1A1A' : '#F9FAFB',
        }]}>
          <TouchableOpacity
            style={styles.qrToggle}
            onPress={() => setShowQR(!showQR)}
            activeOpacity={0.7}
          >
            <Ionicons name="qr-code" size={18} color={colors.textPrimary} />
            <Text style={[styles.qrToggleText, { color: colors.textPrimary }]}>
              {showQR ? 'Ocultar QR' : 'Pagar con QR'}
            </Text>
            <Ionicons
              name={showQR ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          {showQR && (
            <View style={styles.qrContent}>
              <Text style={[styles.qrHint, { color: colors.textMuted }]}>
                Escaneá el QR con la app de Rebill
              </Text>
              <View style={styles.qrImageContainer}>
                <Image
                  source={{ uri: qrDataUrl }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              {amount != null && (
                <Text style={[styles.qrAmount, { color: colors.textPrimary }]}>
                  {formatCurrency(amount)}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  qrSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  qrToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  qrToggleText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  qrContent: {
    marginTop: 14,
    alignItems: 'center',
    gap: 10,
  },
  qrHint: {
    fontSize: 12,
  },
  qrImageContainer: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
  },
  qrImage: {
    width: 180,
    height: 180,
  },
  qrAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default RebillPaymentOptions;

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Muestra opciones de pago AstroPay: Checkout (redirect) y QR
 */
const AstroPayPaymentOptions = ({
  paymentUrl,
  qrDataUrl,
  amount,
  formatCurrency = (n) => `$${Number(n).toLocaleString('es-AR')}`,
  onCheckoutPress,
  style,
}) => {
  const [showQR, setShowQR] = useState(false);

  const hasCheckout = !!paymentUrl;
  const hasQR = !!qrDataUrl;

  if (!hasCheckout && !hasQR) return null;

  const handleCheckout = () => {
    if (onCheckoutPress && paymentUrl) {
      onCheckoutPress(paymentUrl);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Checkout - redirect */}
      {hasCheckout && (
        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={handleCheckout}
          activeOpacity={0.8}
        >
          <Ionicons name="card" size={20} color="#fff" />
          <Text style={styles.checkoutButtonText}>Pagar con Checkout</Text>
        </TouchableOpacity>
      )}

      {/* QR - toggle */}
      {hasQR && (
        <View style={styles.qrSection}>
          <TouchableOpacity
            style={styles.qrToggle}
            onPress={() => setShowQR(!showQR)}
            activeOpacity={0.7}
          >
            <Ionicons name="qr-code" size={20} color="#374151" />
            <Text style={styles.qrToggleText}>
              {showQR ? 'Ocultar QR' : 'Pagar con QR'}
            </Text>
          </TouchableOpacity>
          {showQR && (
            <View style={styles.qrContent}>
              <Text style={styles.qrHint}>
                Escaneá el QR con la app de AstroPay
              </Text>
              <View style={styles.qrImageContainer}>
                <Image
                  source={{ uri: qrDataUrl }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              {amount != null && (
                <Text style={styles.qrAmount}>
                  Monto: {formatCurrency(amount)}
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
    gap: 12,
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ea580c',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrSection: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  qrToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  qrToggleText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  qrContent: {
    marginTop: 12,
    alignItems: 'center',
  },
  qrHint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  qrImageContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  qrImage: {
    width: 180,
    height: 180,
  },
  qrAmount: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
});

export default AstroPayPaymentOptions;

import React, { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Componente para manejar el checkout nativo de MercadoPago
 * Usa Custom Tabs (Android) y Safari View Controller (iOS) - componentes nativos del sistema
 */
const NativeCheckout = {
  /**
   * Abre el checkout de MercadoPago usando el navegador nativo del sistema
   * @param {string} paymentUrl - URL de la preferencia de MercadoPago
   * @param {object} callbacks - Callbacks para éxito y error
   */
  async openCheckout(paymentUrl, callbacks = {}) {
    const { onPaymentSuccess, onPaymentError } = callbacks;

    try {
      console.log('💳 [NativeCheckout] Abriendo checkout nativo:', paymentUrl);

      // Configurar listener para deep links antes de abrir el navegador
      const subscription = Linking.addEventListener('url', (event) => {
        console.log('🔗 [NativeCheckout] Deep link recibido:', event.url);
        this.handleDeepLink(event.url, { onPaymentSuccess, onPaymentError });
        subscription.remove(); // Remover listener después de recibir el link
      });

      // Abrir el navegador nativo (Custom Tabs en Android, Safari View Controller en iOS)
      // Este navegador nativo se cierra automáticamente cuando detecta un deep link válido
      const result = await WebBrowser.openBrowserAsync(paymentUrl, {
        // Opciones para mejor experiencia
        showTitle: true,
        enableBarCollapsing: false,
        // Colores de la barra (opcional)
        toolbarColor: '#1F2937',
        controlsColor: '#FFFFFF',
        // En Android, esto permite que Custom Tabs se cierre automáticamente al detectar deep link
        // En iOS, Safari View Controller también maneja esto automáticamente
      });

      console.log('📱 [NativeCheckout] Navegador cerrado:', result.type);

      // Si el usuario cerró el navegador sin completar el pago
      if (result.type === 'cancel') {
        console.log('⚠️ [NativeCheckout] Usuario canceló el pago');
        if (onPaymentError) {
          onPaymentError(new Error('Pago cancelado por el usuario'));
        }
      }

      // Remover listener si no se recibió ningún deep link
      setTimeout(() => {
        subscription.remove();
      }, 1000);

    } catch (error) {
      console.error('❌ [NativeCheckout] Error abriendo checkout:', error);
      if (onPaymentError) {
        onPaymentError(error);
      } else {
        Alert.alert('Error', 'No se pudo abrir la página de pago');
      }
    }
  },

  /**
   * Maneja el deep link cuando MercadoPago redirige de vuelta a la app
   * @param {string} url - URL del deep link
   * @param {object} callbacks - Callbacks para éxito y error
   */
  handleDeepLink(url, callbacks = {}) {
    const { onPaymentSuccess, onPaymentError } = callbacks;

    try {
      console.log('🔍 [NativeCheckout] Procesando deep link:', url);

      // Parsear la URL para extraer parámetros
      const urlObj = new URL(url);
      const status = urlObj.searchParams.get('status');
      const paymentId = urlObj.searchParams.get('payment_id');
      const preferenceId = urlObj.searchParams.get('preference_id');
      const paymentStatus = urlObj.searchParams.get('payment_status');

      console.log('📊 [NativeCheckout] Parámetros extraídos:', {
        status,
        paymentId,
        preferenceId,
        paymentStatus
      });

      // Determinar el estado del pago
      if (status === 'approved' || paymentStatus === 'approved') {
        console.log('✅ [NativeCheckout] Pago aprobado');
        if (onPaymentSuccess) {
          onPaymentSuccess({
            status: 'approved',
            paymentId,
            preferenceId,
            paymentStatus: 'approved'
          });
        } else {
          Alert.alert(
            '✅ Pago Completado',
            'Tu pago se ha procesado correctamente. La reserva será confirmada en breve.'
          );
        }
      } else if (status === 'pending' || paymentStatus === 'pending') {
        console.log('⏳ [NativeCheckout] Pago pendiente');
        if (onPaymentSuccess) {
          onPaymentSuccess({
            status: 'pending',
            paymentId,
            preferenceId,
            paymentStatus: 'pending'
          });
        } else {
          Alert.alert(
            '⏳ Pago Pendiente',
            'Tu pago está siendo procesado. Te notificaremos cuando se confirme.'
          );
        }
      } else if (status === 'rejected' || status === 'failure' || paymentStatus === 'rejected') {
        console.log('❌ [NativeCheckout] Pago rechazado');
        if (onPaymentError) {
          onPaymentError(new Error('El pago fue rechazado'));
        } else {
          Alert.alert('Error', 'El pago fue rechazado. Por favor, intenta nuevamente.');
        }
      } else {
        console.log('⚠️ [NativeCheckout] Estado desconocido:', status);
        // Si no hay estado claro, asumir que el usuario volvió sin completar
        if (onPaymentError) {
          onPaymentError(new Error('Estado de pago desconocido'));
        }
      }
    } catch (error) {
      console.error('❌ [NativeCheckout] Error procesando deep link:', error);
      if (onPaymentError) {
        onPaymentError(error);
      }
    }
  },

  /**
   * Configura el listener inicial para deep links cuando la app se inicia
   * Debe llamarse en App.js o en el componente principal
   */
  setupDeepLinkListener(callbacks = {}) {
    // Manejar deep link si la app ya estaba abierta
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 [NativeCheckout] Deep link inicial:', url);
        this.handleDeepLink(url, callbacks);
      }
    });

    // Manejar deep links cuando la app está en primer plano
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🔗 [NativeCheckout] Deep link recibido (app en primer plano):', event.url);
      this.handleDeepLink(event.url, callbacks);
    });

    return subscription;
  }
};

export default NativeCheckout;

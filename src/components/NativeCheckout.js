import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import { showAlertAsync } from '../context/AlertContext';
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
    let subscriptionRemoved = false;

    const safeRemoveSubscription = (sub) => {
      if (!subscriptionRemoved && sub?.remove) {
        try {
          sub.remove();
          subscriptionRemoved = true;
        } catch (e) {
          // Ignorar si ya fue removido
        }
      }
    };

    try {
      console.log('💳 [NativeCheckout] Abriendo checkout:', paymentUrl?.substring?.(0, 60) + '...');

      const subscription = Linking.addEventListener('url', (event) => {
        if (!event?.url) return;
        console.log('🔗 [NativeCheckout] Deep link recibido');
        this.handleDeepLink(event.url, { onPaymentSuccess, onPaymentError });
        safeRemoveSubscription(subscription);
      });

      // Abrir navegador (Custom Tabs / Safari View Controller)
      const result = await WebBrowser.openBrowserAsync(paymentUrl, {
        showTitle: true,
        enableBarCollapsing: false,
        toolbarColor: '#1F2937',
        controlsColor: '#FFFFFF',
      });

      console.log('📱 [NativeCheckout] Navegador cerrado:', result?.type || 'unknown');

      if (result?.type === 'cancel' || result?.type === 'dismiss') {
        if (!subscriptionRemoved) {
          safeRemoveSubscription(subscription);
          if (onPaymentError) {
            onPaymentError(new Error('Pago cancelado o navegador cerrado'));
          }
        }
      } else {
        safeRemoveSubscription(subscription);
      }
    } catch (error) {
      console.error('❌ [NativeCheckout] Error:', error?.message || error);
      // Fallback: abrir en navegador externo (más estable en algunos dispositivos)
      try {
        const canOpen = await Linking.canOpenURL(paymentUrl);
        if (canOpen) {
          await Linking.openURL(paymentUrl);
          showAlertAsync(
            'Pago abierto',
            'Completá el pago en el navegador y volvé a la app cuando termines.'
          );
          return;
        }
      } catch (linkErr) {
        console.warn('Fallback Linking.openURL falló:', linkErr);
      }
      if (onPaymentError) {
        onPaymentError(error);
      } else {
        showAlertAsync('Error', 'No se pudo abrir la página de pago. Intentá desde el navegador.');
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
      console.log('🔍 [NativeCheckout] Procesando deep link');

      // Parsear URL (carpooling:// o https://)
      let searchParams;
      try {
        const urlObj = new URL(url);
        searchParams = urlObj.searchParams;
      } catch {
        const qs = url.includes('?') ? url.split('?')[1] : '';
        searchParams = new URLSearchParams(qs || '');
      }

      const status = searchParams.get('status');
      const paymentId = searchParams.get('payment_id');
      const preferenceId = searchParams.get('preference_id');
      const paymentStatus = searchParams.get('payment_status');
      const externalReference = searchParams.get('external_reference');

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
            paymentStatus: 'approved',
            externalReference
          });
        } else {
          showAlertAsync(
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
          showAlertAsync(
            '⏳ Pago Pendiente',
            'Tu pago está siendo procesado. Te notificaremos cuando se confirme.'
          );
        }
      } else if (status === 'rejected' || status === 'failure' || paymentStatus === 'rejected') {
        console.log('❌ [NativeCheckout] Pago rechazado');
        if (onPaymentError) {
          onPaymentError(new Error('El pago fue rechazado'));
        } else {
          showAlertAsync('Error', 'El pago fue rechazado. Por favor, intenta nuevamente.');
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

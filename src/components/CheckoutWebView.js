import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAlert } from '../context/AlertContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Componente WebView para manejar el checkout de MercadoPago dentro de la app
 * Detecta cuando el pago se completa y maneja el redirect de vuelta a la app
 */
const CheckoutWebView = ({
  visible,
  onClose,
  paymentUrl,
  onPaymentSuccess,
  onPaymentError,
  reservationId
}) => {
  const { showAlert } = useAlert();
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('');
  const processedRef = useRef(false);

  useEffect(() => {
    if (visible && paymentUrl) {
      setLoading(true);
      setCurrentUrl(paymentUrl);
      processedRef.current = false;
    }
  }, [visible, paymentUrl]);

  // Detectar cuando se completa el pago
  const handleNavigationStateChange = (navState) => {
    const url = navState.url;
    setCurrentUrl(url);

    // Detectar URLs de confirmación (MercadoPago, AstroPay, Rebill)
    const isConfirmationUrl = url.includes('/payments/confirmation') ||
      url.includes('status=approved') ||
      url.includes('status=rejected') ||
      url.includes('payment_id=') ||
      url.includes('preference_id=') ||
      (url.includes('provider=rebill') && url.includes('external_reference')) ||
      (url.includes('provider=astropay') && url.includes('external_reference'));

    if (isConfirmationUrl && !processedRef.current) {
      processedRef.current = true;
      console.log('✅ [CheckoutWebView] Pago detectado:', url.substring(0, 80) + '...');

      const urlParams = new URLSearchParams(url.split('?')[1] || '');
      const status = urlParams.get('status') || 'approved';
      const paymentId = urlParams.get('payment_id');
      const preferenceId = urlParams.get('preference_id');
      const provider = urlParams.get('provider');
      const externalReference = urlParams.get('external_reference');

      if (status === 'approved' || status === 'pending' || (provider === 'rebill' && status === 'approved') || (provider === 'astropay' && status === 'approved')) {
        setTimeout(() => {
          onPaymentSuccess({
            status,
            paymentId,
            preferenceId,
            externalReference,
            reservationId
          });
          onClose();
        }, 800);
      } else if (status === 'rejected' || status === 'failure') {
        onPaymentError(new Error('El pago fue rechazado'));
        onClose();
      }
    }
  };

  // Manejar mensajes del WebView (si MercadoPago envía mensajes)
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📨 [CheckoutWebView] Mensaje recibido:', data);

      if (data.type === 'PAYMENT_SUCCESS' || data.status === 'approved') {
        onPaymentSuccess({
          status: 'approved',
          paymentId: data.paymentId,
          preferenceId: data.preferenceId,
          reservationId
        });
        onClose();
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  };

  // Manejar errores de carga
  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('❌ [CheckoutWebView] Error cargando:', nativeEvent);
    setLoading(false);

    if (nativeEvent.description?.includes('net::ERR')) {
      showAlert(
        'Error de Conexión',
        'No se pudo cargar la página de pago. Verifica tu conexión a internet.',
        [{ text: 'Cerrar', onPress: onClose }]
      );
    }
  };

  // Manejar cuando termina de cargar
  const handleLoadEnd = () => {
    setLoading(false);
  };

  if (!visible || !paymentUrl) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={['#1F2937', '#111827']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Completar Pago</Text>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

        {/* WebView */}
        <View style={styles.webViewContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Cargando página de pago...</Text>
            </View>
          )}

          <WebView
            ref={webViewRef}
            source={{ uri: paymentUrl }}
            style={styles.webView}
            onNavigationStateChange={handleNavigationStateChange}
            onMessage={handleMessage}
            onError={handleError}
            onLoadEnd={handleLoadEnd}
            onLoadStart={() => setLoading(true)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            thirdPartyCookiesEnabled={true}
            // Permitir navegación dentro del checkout
            onShouldStartLoadWithRequest={(request) => {
              const u = request?.url || '';
              if (u.startsWith('https://') ||
                u.includes('rebill.com') ||
                u.includes('mercadopago.com') ||
                u.includes('mercadolibre.com') ||
                u.includes('astropay.com') ||
                u.includes('carpuling.com.ar')) {
                return true;
              }
              if (u.startsWith('http://')) return true;
              return false;
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
});

export default CheckoutWebView;

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

  useEffect(() => {
    if (visible && paymentUrl) {
      setLoading(true);
      setCurrentUrl(paymentUrl);
    }
  }, [visible, paymentUrl]);

  // Detectar cuando se completa el pago
  const handleNavigationStateChange = (navState) => {
    const url = navState.url;
    setCurrentUrl(url);

    // Detectar URLs de confirmación de MercadoPago, AstroPay
    if (url.includes('/payments/confirmation') ||
      url.includes('status=approved') ||
      url.includes('payment_id=') ||
      url.includes('preference_id=') ||
      (url.includes('provider=astropay') && url.includes('external_reference'))) {

      console.log('✅ [CheckoutWebView] Pago completado detectado:', url);

      // Extraer parámetros de la URL
      const urlParams = new URLSearchParams(url.split('?')[1] || '');
      const status = urlParams.get('status') || 'approved';
      const paymentId = urlParams.get('payment_id');
      const preferenceId = urlParams.get('preference_id');
      const provider = urlParams.get('provider');

      if (status === 'approved' || status === 'pending' || (provider === 'astropay' && status === 'approved')) {
        // Cerrar el modal y notificar éxito
        setTimeout(() => {
          onPaymentSuccess({
            status,
            paymentId,
            preferenceId,
            reservationId
          });
          onClose();
        }, 1000);
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
      presentationStyle="pageSheet"
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
            // Permitir navegación dentro del checkout
            onShouldStartLoadWithRequest={(request) => {
              // Permitir URLs de MercadoPago, AstroPay y HTTPS
              if (request.url.includes('mercadopago.com') ||
                request.url.includes('mercadolibre.com') ||
                request.url.includes('astropay.com') ||
                request.url.includes('getapp.astropay.com') ||
                request.url.startsWith('https://')) {
                return true;
              }
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

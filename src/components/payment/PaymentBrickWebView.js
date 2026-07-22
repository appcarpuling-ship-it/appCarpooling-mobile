import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import { useAlert } from '../../context/AlertContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const PaymentBrickWebView = ({ 
  visible, 
  onClose, 
  preferenceId, 
  amount, 
  intentId,
  seats,
  trip,
  onPaymentSuccess,
  onPaymentError,
  publicKey
}) => {
  const { showAlert } = useAlert();
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [brickReady, setBrickReady] = useState(false);
  const timeoutRef = useRef(null);

  // Resetear estado cuando el modal se abre
  useEffect(() => {
    if (visible) {
      console.log('🔍 [WebView] Parámetros recibidos:', {
        preferenceId,
        amount,
        intentId,
        publicKey: publicKey ? `${publicKey.substring(0, 20)}...` : 'NO DEFINIDO'
      });

      // Resetear estados
      setLoading(true);
      setBrickReady(false);

      // Timeout de seguridad global: si después de 8 segundos no hay respuesta, forzar ready
      timeoutRef.current = setTimeout(() => {
        console.log('⚠️ [WebView] TIMEOUT GLOBAL (8s) - No se recibieron mensajes, forzando ready');
        setLoading(false);
        setBrickReady(true);
      }, 8000);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };

      // Validar parámetros
      if (!preferenceId) {
        console.error('❌ [WebView] ERROR: preferenceId no definido');
        showAlert('Error', 'No se pudo inicializar el pago: falta preferenceId');
        onClose();
        return;
      }

      if (!amount || amount <= 0) {
        console.error('❌ [WebView] ERROR: amount inválido:', amount);
        showAlert('Error', 'No se pudo inicializar el pago: monto inválido');
        onClose();
        return;
      }

      if (!publicKey || publicKey === 'TEST-your-public-key') {
        console.error('❌ [WebView] ERROR: publicKey no definido o inválido');
        showAlert('Error', 'No se pudo inicializar el pago: falta configuración de MercadoPago');
        onClose();
        return;
      }
    } else {
      // Resetear cuando se cierra
      setLoading(false);
      setBrickReady(false);
    }
  }, [visible, preferenceId, amount, publicKey]);

  // HTML mejorado con mejor manejo de errores
  // Log del HTML generado (solo para debug)
  useEffect(() => {
    if (visible && preferenceId && amount) {
      console.log('📄 [WebView] Generando HTML con:', {
        preferenceId: preferenceId.substring(0, 30) + '...',
        amount,
        hasPublicKey: !!publicKey
      });
    }
  }, [visible, preferenceId, amount, publicKey]);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Pago</title>
        <script src="https://sdk.mercadopago.com/js/v2"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #F8F9FA;
            padding: 0;
            margin: 0;
            overflow-x: hidden;
          }

          .container {
            max-width: 100%;
            margin: 0 auto;
            padding: 16px;
          }

          .header {
            background: linear-gradient(135deg, #1F2937 0%, #111827 100%);
            color: white;
            padding: 20px 16px;
            margin: -16px -16px 16px -16px;
            border-radius: 0 0 16px 16px;
          }

          .header h1 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .summary {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 12px;
            margin-top: 12px;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }

          .summary-row:last-child {
            margin-bottom: 0;
            padding-top: 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            font-weight: 600;
            font-size: 18px;
          }

          .summary-label {
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
          }

          .summary-value {
            color: white;
            font-size: 14px;
          }

          #paymentBrick_container {
            background: white;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            min-height: 400px;
          }

          .loading {
            text-align: center;
            padding: 60px 20px;
            color: #6B7280;
          }

          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #E5E7EB;
            border-top-color: #1F2937;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .error {
            background: #FEE2E2;
            border: 1px solid #FCA5A5;
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
            color: #991B1B;
          }

          .error-title {
            font-weight: 600;
            margin-bottom: 4px;
          }

          .info-box {
            background: #EFF6FF;
            border-left: 4px solid #3B82F6;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
          }

          .info-box-title {
            font-weight: 600;
            color: #1E40AF;
            margin-bottom: 4px;
            font-size: 14px;
          }

          .info-box-text {
            color: #1E40AF;
            font-size: 13px;
            line-height: 1.5;
          }

          .debug-info {
            background: #F3F4F6;
            border-radius: 8px;
            padding: 12px;
            margin: 16px 0;
            font-size: 11px;
            color: #6B7280;
            font-family: monospace;
            max-height: 200px;
            overflow-y: auto;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Pagar Reserva</h1>
            <div class="summary">
              <div class="summary-row">
                <span class="summary-label">Asientos:</span>
                <span class="summary-value">${seats} asiento${seats > 1 ? 's' : ''}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Viaje:</span>
                <span class="summary-value">${trip?.origin?.city || ''} → ${trip?.destination?.city || ''}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Total a pagar:</span>
                <span class="summary-value">$${amount} ARS</span>
              </div>
            </div>
          </div>

          <div class="info-box">
            <div class="info-box-title">ℹ️ Información importante</div>
            <div class="info-box-text">
              Este monto es NO REEMBOLSABLE y va directo a la plataforma.
              El día del viaje pagarás el resto directamente al conductor.
            </div>
          </div>

          <div class="debug-info" id="debug-info">
            Iniciando...<br>
          </div>

          <div id="loading" class="loading">
            <div class="loading-spinner"></div>
            <div>Cargando métodos de pago...</div>
          </div>

          <div id="error" class="error" style="display:none;">
            <div class="error-title">Error</div>
            <div id="error-message"></div>
          </div>

          <div id="paymentBrick_container"></div>
        </div>

        <script>
          // Enviar mensaje inmediato para verificar que el script funciona
          (function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'SCRIPT_LOADED',
                message: 'Script de Payment Brick cargado correctamente'
              }));
            }
            console.log('✅ Script de Payment Brick iniciado');
          })();

          const PUBLIC_KEY = "${publicKey}";
          const PREFERENCE_ID = "${preferenceId}";
          const AMOUNT = ${amount};
          const INTENT_ID = "${intentId}";

          console.log('📋 Parámetros configurados:', {
            publicKey: PUBLIC_KEY ? PUBLIC_KEY.substring(0, 20) + '...' : 'NO DEFINIDO',
            preferenceId: PREFERENCE_ID ? PREFERENCE_ID.substring(0, 30) + '...' : 'NO DEFINIDO',
            amount: AMOUNT,
            intentId: INTENT_ID
          });

          let paymentBrickController = null;
          let initAttempts = 0;
          const MAX_ATTEMPTS = 3;

          function updateDebugInfo(message) {
            const debugDiv = document.getElementById('debug-info');
            if (debugDiv) {
              const timestamp = new Date().toLocaleTimeString();
              debugDiv.innerHTML += timestamp + ' - ' + message + '<br>';
              debugDiv.scrollTop = debugDiv.scrollHeight;
            }
          }

          function sendMessage(type, data = {}) {
            const message = JSON.stringify({ type, ...data });
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(message);
            }
          }

          // Capturar logs
          const originalLog = console.log;
          const originalError = console.error;
          
          console.log = function(...args) {
            originalLog.apply(console, args);
            sendMessage('CONSOLE_LOG', { message: args.join(' ') });
          };
          
          console.error = function(...args) {
            originalError.apply(console, args);
            sendMessage('CONSOLE_ERROR', { message: args.join(' ') });
          };

          function showError(message) {
            console.error('ERROR:', message);
            updateDebugInfo('❌ ERROR: ' + message);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
            document.getElementById('error-message').textContent = message;
            sendMessage('BRICK_ERROR', { error: message });
          }

          async function waitForSDK(maxWait = 15000) {
            const startTime = Date.now();
            updateDebugInfo('⏳ Esperando SDK de MercadoPago...');
            
            while (typeof window.MercadoPago === 'undefined') {
              if (Date.now() - startTime > maxWait) {
                throw new Error('Timeout esperando SDK de MercadoPago. Verifica tu conexión a internet.');
              }
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Verificar que el SDK esté completamente cargado
            if (typeof window.MercadoPago !== 'function') {
              throw new Error('SDK de MercadoPago no está disponible correctamente');
            }
          }

          async function initPaymentBrick() {
            try {
              initAttempts++;
              console.log('🔧 Intento #' + initAttempts + ' de inicializar Payment Brick');
              updateDebugInfo('🔧 Intento #' + initAttempts + ' de inicializar Payment Brick');

              // Validar parámetros
              if (!PUBLIC_KEY || PUBLIC_KEY === 'TEST-your-public-key') {
                throw new Error('Public Key de MercadoPago no configurada');
              }
              
              if (!PREFERENCE_ID) {
                throw new Error('Preference ID no definido');
              }
              
              if (!AMOUNT || AMOUNT <= 0) {
                throw new Error('Monto inválido: ' + AMOUNT);
              }

              updateDebugInfo('✅ Parámetros validados');
              updateDebugInfo('Preference: ' + PREFERENCE_ID.substring(0, 30) + '...');
              updateDebugInfo('Amount: $' + AMOUNT);
              updateDebugInfo('Public Key: ' + PUBLIC_KEY.substring(0, 20) + '...');
              
              // Esperar a que el SDK esté disponible
              await waitForSDK(15000);
              updateDebugInfo('✅ SDK de MercadoPago cargado');

              // Inicializar MercadoPago
              const mp = new window.MercadoPago(PUBLIC_KEY, { 
                locale: 'es-AR'
              });
              updateDebugInfo('✅ Cliente MercadoPago inicializado');

              // Verificar que bricks() esté disponible
              if (typeof mp.bricks !== 'function') {
                throw new Error('Método bricks() no disponible en el SDK');
              }

              const bricksBuilder = mp.bricks();
              updateDebugInfo('✅ Bricks builder obtenido');

              // Verificar que el contenedor existe
              const container = document.getElementById('paymentBrick_container');
              if (!container) {
                throw new Error('Contenedor paymentBrick_container no encontrado');
              }
              updateDebugInfo('✅ Contenedor encontrado');

              const settings = {
                initialization: {
                  preferenceId: PREFERENCE_ID,
                  amount: AMOUNT,
                },
                customization: {
                  paymentMethods: {
                    creditCard: 'all',
                    debitCard: 'all',
                    ticket: 'all',
                    mercadoPago: ['wallet_purchase'],
                    maxInstallments: 12,
                  },
                  visual: {
                    style: {
                      theme: 'default',
                    },
                  },
                },
                callbacks: {
                  onReady: () => {
                    console.log('✅ Brick ready - onReady callback ejecutado');
                    updateDebugInfo('✅ Brick listo - onReady ejecutado');
                    
                    // Limpiar timeout de seguridad
                    if (window.clearReadyTimeout) {
                      window.clearReadyTimeout();
                    }
                    
                    // Ocultar loading
                    const loadingEl = document.getElementById('loading');
                    if (loadingEl) {
                      loadingEl.style.display = 'none';
                    }
                    
                    // Enviar mensaje a React Native
                    sendMessage('BRICK_READY');
                    console.log('📤 Mensaje BRICK_READY enviado a React Native');
                    
                    // Forzar actualización visual
                    setTimeout(() => {
                      const container = document.getElementById('paymentBrick_container');
                      if (container) {
                        container.style.opacity = '1';
                        container.style.visibility = 'visible';
                      }
                    }, 100);
                  },
                  
                  onSubmit: async (formData) => {
                    console.log('📝 onSubmit - Procesando pago...');
                    updateDebugInfo('📝 onSubmit - Procesando pago...');
                    
                    const data = formData?.formData || formData;
                    if (!data || !data.token) {
                      const errorMsg = 'No se recibió el token de la tarjeta';
                      console.error('❌', errorMsg);
                      updateDebugInfo('❌ ' + errorMsg);
                      throw new Error(errorMsg);
                    }

                    updateDebugInfo('✅ Token recibido, enviando a backend...');
                    
                    sendMessage('PAYMENT_SUBMIT', {
                      intentId: INTENT_ID,
                      formData: {
                        token: data.token,
                        payment_method_id: data.payment_method_id,
                        transaction_amount: data.transaction_amount,
                        installments: data.installments,
                        issuer_id: data.issuer_id,
                        payer: data.payer
                      }
                    });

                    return new Promise((resolve, reject) => {
                      window.paymentResolve = resolve;
                      window.paymentReject = reject;
                      // Timeout de 60 segundos
                      setTimeout(() => {
                        if (window.paymentReject) {
                          reject(new Error('Timeout esperando respuesta del servidor'));
                        }
                      }, 60000);
                    });
                  },
                  
                  onError: (error) => {
                    console.error('🚨 Brick error:', error);
                    const errorMsg = error?.message || error?.cause?.[0]?.description || 'Error desconocido en el formulario';
                    updateDebugInfo('🚨 Error: ' + errorMsg);
                    showError(errorMsg);
                  },
                },
              };

              updateDebugInfo('📦 Creando Payment Brick...');
              
              // Crear el Brick
              paymentBrickController = await bricksBuilder.create(
                'payment',
                'paymentBrick_container',
                settings
              );

              console.log('✅ Brick creado exitosamente');
              updateDebugInfo('✅ Brick creado - esperando onReady...');
              
              // Timeout de seguridad: si onReady no se ejecuta en 5 segundos, asumir que está listo
              const readyTimeout = setTimeout(() => {
                const loadingEl = document.getElementById('loading');
                if (loadingEl && loadingEl.style.display !== 'none') {
                  console.log('⚠️ onReady no se ejecutó en 5 segundos, asumiendo que está listo');
                  updateDebugInfo('⚠️ onReady no ejecutado en tiempo, forzando ready...');
                  loadingEl.style.display = 'none';
                  sendMessage('BRICK_READY');
                  console.log('📤 Mensaje BRICK_READY enviado (timeout)');
                }
              }, 5000);

              // Limpiar timeout si onReady se ejecuta
              window.clearReadyTimeout = () => {
                clearTimeout(readyTimeout);
                console.log('✅ Timeout de seguridad cancelado');
              };

            } catch (error) {
              console.error('❌ Error fatal:', error);
              const errorMsg = error?.message || 'Error desconocido';
              updateDebugInfo('❌ Error: ' + errorMsg);
              
              if (initAttempts < MAX_ATTEMPTS) {
                updateDebugInfo('🔄 Reintentando en 3 segundos... (Intento ' + (initAttempts + 1) + '/' + MAX_ATTEMPTS + ')');
                setTimeout(() => {
                  initPaymentBrick();
                }, 3000);
              } else {
                showError('Error al cargar el formulario de pago: ' + errorMsg);
              }
            }
          }

          window.handlePaymentResponse = function(success, data) {
            console.log('📨 Response:', success);
            updateDebugInfo('📨 Respuesta: ' + (success ? 'Éxito' : 'Error'));
            
            if (success) {
              if (window.paymentResolve) window.paymentResolve();
              sendMessage('PAYMENT_SUCCESS', { data });
            } else {
              const errorMsg = data?.error || 'Error al procesar';
              if (window.paymentReject) window.paymentReject(new Error(errorMsg));
              showError(errorMsg);
            }
          };

          // Función para iniciar cuando todo esté listo
          function startInitialization() {
            console.log('🚀 Iniciando inicialización del Payment Brick');
            updateDebugInfo('🚀 Iniciando inicialización...');
            
            // Esperar un poco para asegurar que el DOM está completamente listo
            setTimeout(() => {
              initPaymentBrick();
            }, 500);
          }

          // Iniciar cuando el documento esté listo
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startInitialization);
          } else {
            // El documento ya está listo
            startInitialization();
          }

          // También escuchar cuando la ventana carga completamente
          window.addEventListener('load', () => {
            console.log('✅ Ventana completamente cargada');
            updateDebugInfo('✅ Ventana cargada');
          });

          console.log('✅ Script cargado');
          updateDebugInfo('✅ Script cargado');
        </script>
      </body>
    </html>
  `;


  const handleWebViewMessage = async (event) => {
    try {
      const data = event.nativeEvent.data;
      console.log('📨 [WebView] Mensaje recibido:', data);
      
      const message = JSON.parse(data);

      switch (message.type) {
        case 'CONSOLE_LOG':
          console.log('🌐 [WebView]', message.message);
          break;

        case 'CONSOLE_ERROR':
          console.error('🌐 [WebView] ERROR:', message.message);
          break;

        case 'BRICK_READY':
          console.log('✅ [PaymentBrick] Brick listo - ocultando loading');
          // Cancelar timeout global si existe
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setLoading(false);
          setBrickReady(true);
          break;

        case 'PAYMENT_SUBMIT':
          console.log('💳 [PaymentBrick] Procesando...');
          // Solo mostrar loading si el brick ya estaba listo
          if (brickReady) {
            setLoading(true);
          }

          try {
            const response = await onPaymentSuccess(message.intentId, message.formData);
            console.log('✅ [PaymentBrick] Respuesta del pago:', response);

            // Si el pago está pendiente, tratarlo como éxito pero informar al usuario
            if (response?.pending || response?.success === true) {
              console.log('✅ [PaymentBrick] Pago en proceso, tratando como éxito');
              webViewRef.current?.injectJavaScript(`
                window.handlePaymentResponse(true, ${JSON.stringify({ ...response, pending: true })});
                true;
              `);
              // Cerrar después de un momento para que el usuario vea el mensaje
              setTimeout(() => onClose(), 3000);
            } else {
              webViewRef.current?.injectJavaScript(`
                window.handlePaymentResponse(true, ${JSON.stringify(response)});
                true;
              `);
              setTimeout(() => onClose(), 2000);
            }
          } catch (error) {
            console.error('❌ [PaymentBrick] Error:', error);
            console.error('❌ [PaymentBrick] Error response data:', error?.response?.data);
            
            // Extraer información detallada del error
            const statusMP = error?.response?.data?.statusMP;
            const statusDetail = error?.response?.data?.statusDetail;
            const errorMessage = error?.response?.data?.message || 
                               error?.response?.data?.error || 
                               error?.message || 
                               'Error al procesar el pago';

            console.log('🔍 [PaymentBrick] Estado del pago:', { statusMP, statusDetail, errorMessage });

            // Si el pago está en proceso o pendiente, NO mostrar error al usuario
            // El BookingScreen ya mostró el mensaje apropiado
            if (statusMP === 'in_process' || statusMP === 'pending' || statusDetail === 'pending_review_manual') {
              console.log('✅ [PaymentBrick] Pago en proceso, no mostrando error en WebView');
              // Simular éxito para que el WebView no muestre error
              webViewRef.current?.injectJavaScript(`
                window.handlePaymentResponse(true, { pending: true, status: "${statusMP}" });
                true;
              `);
              setLoading(false);
              // Cerrar después de un momento
              setTimeout(() => onClose(), 2000);
              return;
            }

            // Mensaje más descriptivo según el estado para errores reales
            let userFriendlyMessage = errorMessage;
            
            if (statusDetail === 'cc_rejected_high_risk') {
              userFriendlyMessage = 'El pago fue rechazado por seguridad. Por favor intenta con otro método de pago.';
            } else if (statusDetail) {
              userFriendlyMessage = `El pago fue ${statusDetail.replace(/_/g, ' ')}. Por favor intenta nuevamente.`;
            }

            const sanitizedError = userFriendlyMessage.replace(/"/g, '\\"').replace(/\n/g, ' ');

            webViewRef.current?.injectJavaScript(`
              window.handlePaymentResponse(false, { error: "${sanitizedError}" });
              true;
            `);

            setLoading(false);
            if (onPaymentError) onPaymentError(error);
          }
          break;

        case 'BRICK_ERROR':
          console.error('❌ [PaymentBrick] Error:', message.error);
          setLoading(false);
          showAlert('Error', message.error || 'Error en el formulario');
          if (onPaymentError) onPaymentError(new Error(message.error));
          break;

        case 'PAYMENT_SUCCESS':
          console.log('✅ [PaymentBrick] Completado');
          setLoading(false);
          break;

        case 'WEBVIEW_READY':
          console.log('✅ [WebView] WebView listo y funcionando');
          break;

        case 'SCRIPT_LOADED':
          console.log('✅ [WebView] Script cargado:', message.message);
          // Cancelar timeout global ya que el script está funcionando
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          // Nuevo timeout más corto: si después de 10 segundos no hay BRICK_READY, forzar
          timeoutRef.current = setTimeout(() => {
            if (loading && !brickReady) {
              console.log('⚠️ [WebView] Timeout después de SCRIPT_LOADED - forzando ready');
              setLoading(false);
              setBrickReady(true);
            }
          }, 10000);
          break;
      }
    } catch (error) {
      console.error('❌ [PaymentBrick] Error parseando mensaje:', error);
      console.error('❌ [PaymentBrick] Datos recibidos:', event.nativeEvent.data);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={gradients?.primary || ['#1F2937', '#111827']}
          style={styles.modalHeader}
        >
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Completar Pago</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        {/* Loading solo durante el procesamiento del pago, no durante la carga inicial */}
        {loading && brickReady && (
          <View style={styles.processingOverlay}>
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color="#1F2937" />
              <Text style={styles.processingText}>Procesando pago...</Text>
            </View>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          scalesPageToFit={true}
          bounces={false}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          mixedContentMode="compatibility"
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          onError={(e) => {
            console.error('❌ [WebView] Error nativo:', e.nativeEvent);
            console.error('❌ [WebView] Error completo:', JSON.stringify(e.nativeEvent, null, 2));
            setLoading(false);
            showAlert(
              'Error al cargar',
              'No se pudo cargar el formulario de pago. Verifica tu conexión a internet e intenta nuevamente.',
              [
                { text: 'Cerrar', onPress: onClose },
                { text: 'Reintentar', onPress: () => {
                  setLoading(true);
                  setBrickReady(false);
                  // Forzar recarga del WebView
                  webViewRef.current?.reload();
                }}
              ]
            );
          }}
          onHttpError={(e) => {
            console.error('❌ [WebView] HTTP error:', e.nativeEvent);
            console.error('❌ [WebView] Status code:', e.nativeEvent.statusCode);
            if (e.nativeEvent.statusCode >= 400) {
              setLoading(false);
              showAlert(
                'Error de conexión',
                `Error HTTP ${e.nativeEvent.statusCode}: No se pudo cargar el formulario. Verifica tu conexión a internet.`,
                [{ text: 'Cerrar', onPress: onClose }]
              );
            }
          }}
          onLoadStart={() => {
            console.log('🔄 [WebView] Iniciando carga...');
            setLoading(true);
            setBrickReady(false);
          }}
          onLoadEnd={() => {
            console.log('✅ [WebView] HTML cargado completamente');
            
            // Esperar un momento y luego inyectar script de verificación
            setTimeout(() => {
              console.log('🔧 [WebView] Inyectando script de verificación...');
              webViewRef.current?.injectJavaScript(`
                (function() {
                  console.log('✅ [WebView] Script de verificación ejecutado');
                  try {
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ 
                        type: 'WEBVIEW_READY',
                        message: 'WebView funcionando correctamente'
                      }));
                      console.log('📤 Mensaje WEBVIEW_READY enviado');
                    } else {
                      console.error('❌ window.ReactNativeWebView no está disponible');
                    }
                  } catch (e) {
                    console.error('❌ Error en script de verificación:', e);
                  }
                })();
                true;
              `);
            }, 1000);
          }}
          onLoadProgress={(e) => {
            const progress = Math.round(e.nativeEvent.progress * 100);
            console.log('📊 [WebView] Progreso:', progress + '%');
          }}
          onShouldStartLoadWithRequest={(request) => {
            console.log('🔗 [WebView] Intentando cargar URL:', request.url);
            // Permitir todas las URLs (SDK de MercadoPago necesita cargar recursos externos)
            return true;
          }}
          onNavigationStateChange={(navState) => {
            console.log('🧭 [WebView] Estado de navegación:', {
              url: navState.url,
              loading: navState.loading,
              canGoBack: navState.canGoBack
            });
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 50,
    paddingBottom: spacing.md,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Sora_600SemiBold',
    color: '#FFFFFF',
  },
  webview: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  processingText: {
    marginLeft: spacing.sm,
    fontSize: fontSize.md,
    color: '#374151',
    fontFamily: 'Sora_500Medium',
  },
});

export default PaymentBrickWebView;
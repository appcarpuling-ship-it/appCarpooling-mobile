import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Linking,
  Dimensions,
  Image,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { calculateReservationPrice, createSeatReservation } from '../../services/seatReservationService';
import { get_public } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { colors as staticColors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { useAuth } from '../../context/AuthContext';
import ConfirmationModal from '../../components/ConfirmationModal';

// Usar valores directos para evitar problemas de carga
const SORA_FONTS = {
  thin: 'Sora_100Thin',
  extraLight: 'Sora_200ExtraLight',
  light: 'Sora_300Light',
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 200;

const BookingScreen = ({ route, navigation }) => {
  const { colors, getCurrentThemeMode, gradients, isDarkMode } = useColors();
  const { user } = useAuth();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const { trip, existingReservation } = route.params;

  // Validar que trip existe y tenga los datos necesarios
  if (!trip || !trip.origin || !trip.destination) {
    return (
      <LinearGradient colors={['#1F2937', '#111827']} style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.error || '#EF4444' }]}>Error: Datos del viaje incompletos</Text>
        </View>
      </LinearGradient>
    );
  }
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [calculatingPrice, setCalculatingPrice] = useState(true);
  const [priceData, setPriceData] = useState(null);
  const [error, setError] = useState('');

  // Banner states
  const [banners, setBanners] = useState([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerScrollRef = useRef(null);
  const bannerAutoScrollTimer = useRef(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Cargar cálculo de precio al montar componente (solo si no hay reserva existente)
  useEffect(() => {
    if (!existingReservation) {
      calculatePrice();
    } else {
      // Si hay reserva existente, usar su información de precio
      setPriceData({
        pricing: {
          basePrice: existingReservation.totalPrice,
          totalPrice: existingReservation.totalPrice,
          numberOfSeats: existingReservation.seatsBooked
        }
      });
      setSeats(existingReservation.seatsBooked);
      setCalculatingPrice(false);
    }
    loadBanners();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      if (bannerAutoScrollTimer.current) {
        clearInterval(bannerAutoScrollTimer.current);
      }
    };
  }, []);

  // Auto-scroll banners
  useEffect(() => {
    if (banners.length > 1) {
      bannerAutoScrollTimer.current = setInterval(() => {
        setActiveBannerIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % banners.length;

          // Validar que el índice sea válido antes de hacer scroll
          if (nextIndex >= 0 && nextIndex < banners.length && bannerScrollRef.current) {
            try {
              bannerScrollRef.current.scrollToIndex({
                index: nextIndex,
                animated: true,
              });
            } catch (error) {
              // Si falla, intentar con scrollToOffset como fallback
              console.warn('Error en scrollToIndex, usando scrollToOffset:', error);
              try {
                const offset = nextIndex * (BANNER_WIDTH + 16);
                bannerScrollRef.current.scrollToOffset({
                  offset,
                  animated: true,
                });
              } catch (offsetError) {
                console.warn('Error en scrollToOffset:', offsetError);
              }
            }
          }

          return nextIndex;
        });
      }, 5000);
    }

    return () => {
      if (bannerAutoScrollTimer.current) {
        clearInterval(bannerAutoScrollTimer.current);
      }
    };
  }, [banners]);

  // Recalcular precio cuando cambien los asientos (solo si no hay reserva existente)
  useEffect(() => {
    if (seats > 0 && !existingReservation) {
      calculatePrice();
    }
  }, [seats]);

  // Función para formatear números con separadores de miles (formato argentino, sin decimales)
  const formatNumber = (num) => {
    if (typeof num !== 'number') {
      num = parseFloat(num);
    }
    if (isNaN(num)) return num;
    // Redondear a número entero y agregar puntos como separadores de miles
    const integerPart = Math.round(num).toString();
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const calculatePrice = async () => {
    try {
      setCalculatingPrice(true);
      setError('');

      const tripId = trip._id || trip.id;
      const response = await calculateReservationPrice(tripId, seats);

      if (response.success) {
        // Calcular descuento si el usuario tiene uno disponible
        const basePrice = response.data.pricing.totalPrice;
        const userDiscount = user?.discountPercentage || 0;
        
        let discountAmount = 0;
        let finalPrice = basePrice;
        
        if (userDiscount > 0) {
          discountAmount = (basePrice * userDiscount) / 100;
          finalPrice = basePrice - discountAmount;
        }
        
        // Agregar información de descuento a la respuesta
        const enhancedPriceData = {
          ...response.data,
          pricing: {
            ...response.data.pricing,
            originalPrice: basePrice,
            discountPercentage: userDiscount,
            discountAmount: Math.round(discountAmount),
            finalPrice: Math.round(finalPrice)
          }
        };
        
        setPriceData(enhancedPriceData);
      } else {
        setError('Error al calcular el precio');
      }
    } catch (err) {
      console.error('Error calculando precio:', err);
      setError(err.message || 'Error al calcular el precio');
    } finally {
      setCalculatingPrice(false);
    }
  };

  const loadBanners = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_BANNERS_BY_PACKAGE('free'), { isActive: true });
      if (response.success && Array.isArray(response.data)) {
        setBanners(response.data.filter(b => b.isActive));
      } else {
        setBanners([]);
      }
    } catch (error) {
      console.error('Error loading banners:', error);
    }
  };

  const handleBannerPress = async (banner) => {
    try {
      await get_public(ENDPOINTS.REGISTER_BANNER_CLICK(banner._id));
    } catch (error) {
      console.error('Error registering banner click:', error);
    }

    if (banner.clickUrl) {
      try {
        const canOpen = await Linking.canOpenURL(banner.clickUrl);
        if (canOpen) {
          await Linking.openURL(banner.clickUrl);
        }
      } catch (error) {
        console.error('Error opening banner URL:', error);
      }
    }
  };

  const onBannerScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.floor(event.nativeEvent.contentOffset.x / slideSize);
    if (index !== activeBannerIndex && index >= 0 && index < banners.length) {
      setActiveBannerIndex(index);
    }
  };

  const renderBannerItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => handleBannerPress(item)}
      style={styles.bannerSlide}
    >
      <LinearGradient
        colors={gradients?.primary || ['#1F2937', '#374151']}
        style={styles.bannerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.bannerContent}>
            <Text style={[styles.bannerTitle, { color: '#FFFFFF' }]} numberOfLines={2}>
              {item.title}
            </Text>
            {item.description && (
              <Text style={[styles.bannerDescription, { color: 'rgba(255, 255, 255, 0.9)' }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            {item.clickUrl && (
              <View style={styles.bannerCta}>
                <Text style={[styles.bannerCtaText, { color: '#FFFFFF' }]}>Ver más</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFF" />
              </View>
            )}
          </View>
        )}
        {item.imageUrl && item.title && (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.bannerOverlay}
          >
         
          </LinearGradient>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const handleCreateReservation = async () => {
    if (!priceData) return;

    setLoading(true);
    setError('');

    try {
      const tripId = trip._id || trip.id;

      // Crear solicitud de reserva (sin pago inmediato)
      const reservationResponse = await createSeatReservation({
        tripId,
        seatsBooked: seats,
        message: ''
      });

      if (!reservationResponse?.success) {
        throw new Error(reservationResponse?.message || 'Error creando la reserva');
      }

      setModalMessage('Tu solicitud de reserva ha sido enviada al conductor. Te notificaremos cuando la apruebe.');
      setShowSuccessModal(true);
    } catch (err) {
      console.error('❌ [Booking] Error creando reserva:', err);
      setModalMessage(
        err?.response?.data?.message ||
        err?.message ||
        'Error al procesar la reserva'
      );
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };


  // Pantalla principal de booking (sin modales de pago - el flujo es: solicitar -> aprobar -> pagar)
  // Los modales de pago se eliminaron porque ahora el flujo es:
  // 1. Usuario solicita reserva (pending_approval)
  // 2. Conductor aprueba -> se crea PaymentIntent y se retorna paymentUrl
  // 3. Usuario paga usando paymentUrl (redirect a Checkout Pro)
  // 4. Webhook procesa el pago automáticamente
  if (false) { // Eliminado: showPaymentSelector
    return (
      <LinearGradient colors={gradients?.light || ['#F8F9FA', '#FFFFFF']} style={styles.container}>
        <Animated.View
          style={[
            styles.animatedContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShowPaymentSelector(false)}>
                <Ionicons name="chevron-back" size={32} color={colors.primary || '#1F2937'} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {existingReservation ? 'Completar pago pendiente' : 'Elige tu método de pago'}
              </Text>
            </View>

            {/* Información de la reserva */}
            <LinearGradient
              colors={gradients?.card || ['#FFFFFF', '#F8F9FA']}
              style={styles.card}
            >
              <View style={styles.cardBorder}>
                <Text style={styles.sectionTitle}>
                  {existingReservation ? 'Tu reserva pendiente' : 'Resumen de tu reserva'}
                </Text>

                <View style={styles.summaryItem}>
                  <Ionicons name="location-outline" size={18} color={colors.textSecondary || '#374151'} />
                  <View style={styles.summaryContent}>
                    <Text style={styles.summaryLabel}>Viaje</Text>
                    <Text style={styles.summaryValue}>
                      {trip.origin?.city} → {trip.destination?.city}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryItem}>
                  <Ionicons name="people-outline" size={18} color={colors.textSecondary || '#374151'} />
                  <View style={styles.summaryContent}>
                    <Text style={styles.summaryLabel}>Asientos</Text>
                    <Text style={styles.summaryValue}>{seats} asiento{seats > 1 ? 's' : ''}</Text>
                  </View>
                </View>

                {existingReservation && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="time-outline" size={18} color="#F59E0B" />
                    <View style={styles.summaryContent}>
                      <Text style={styles.summaryLabel}>Estado</Text>
                      <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>Pago Pendiente</Text>
                    </View>
                  </View>
                )}

                {priceData && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="cash-outline" size={18} color={colors.textSecondary || '#374151'} />
                    <View style={styles.summaryContent}>
                      <Text style={styles.summaryLabel}>Total</Text>
                      <Text style={styles.summaryValue}>
                        ${priceData.pricing.totalPrice} ARS
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </LinearGradient>

            {/* Opciones de pago */}
            <LinearGradient
              colors={gradients?.card || ['#FFFFFF', '#F8F9FA']}
              style={styles.card}
            >
              <View style={styles.cardBorder}>
                <Text style={styles.sectionTitle}>Métodos de Pago</Text>

                {/* Payment Brick - Opción recomendada */}
                <TouchableOpacity
                  style={styles.paymentOption}
                  onPress={() => handlePaymentMethodSelection('brick')}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#00B2E3', '#0099CC']}
                    style={styles.paymentMethodIcon}
                  >
                    <Ionicons name="card-outline" size={32} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.paymentMethodContent}>
                    <Text style={styles.paymentMethodTitle}>Pago con Tarjeta</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Paga directamente en la app sin salir
                    </Text>
                    <View style={[styles.paymentMethodBadge, { backgroundColor: '#10B981' }]}>
                      <Text style={styles.paymentMethodBadgeText}>Recomendado</Text>
                    </View>
                    <Text style={[styles.paymentMethodDescription, { fontSize: 12, marginTop: 4, fontStyle: 'italic' }]}>
                      💳 Tarjeta de crédito, débito, Mercado Pago y más
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={colors.textTertiary || '#6B7280'} />
                </TouchableOpacity>

                {/* QR de Mercado Pago */}
                <TouchableOpacity
                  style={[styles.paymentOption, { marginTop: 16 }]}
                  onPress={() => handlePaymentMethodSelection('qr')}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={gradients?.primary || ['#1F2937', '#111827']}
                    style={styles.paymentMethodIcon}
                  >
                    <Ionicons name="qr-code" size={32} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.paymentMethodContent}>
                    <Text style={styles.paymentMethodTitle}>QR de Mercado Pago</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Pago rápido con app de MercadoPago
                    </Text>
                    <View style={[styles.paymentMethodBadge, { backgroundColor: colors.surface || '#F3F4F6' }]}>
                      <Text style={[styles.paymentMethodBadgeText, { color: colors.textSecondary || '#374151' }]}>
                        Comisión más baja
                      </Text>
                    </View>
                    <Text style={[styles.paymentMethodDescription, { fontSize: 12, marginTop: 4, fontStyle: 'italic' }]}>
                      💡 Requiere app de Mercado Pago instalada
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={colors.textTertiary || '#6B7280'} />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => setShowPaymentSelector(false)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#E5E7EB', '#D1D5DB']}
                style={styles.closeButton}
              >
                <Text style={[styles.closeButtonText, { color: colors.textPrimary || '#000000' }]}>
                  Cancelar
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </LinearGradient>
    );
  }

  // Eliminado: Modal de QR de pago (ya no se usa)
  if (false) { // Eliminado: showPaymentQR
    return (
      <LinearGradient colors={gradients?.light || ['#F8F9FA', '#FFFFFF']} style={styles.container}>
        <Animated.View
          style={[
            styles.animatedContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShowPaymentQR(false)}>
                <Ionicons name="chevron-back" size={32} color={colors.primary || '#1F2937'} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Completa tu reserva</Text>
            </View>

            {/* Información de la reserva */}
            <LinearGradient
              colors={gradients?.card || ['#FFFFFF', '#F8F9FA']}
              style={styles.card}
            >
              <View style={styles.cardBorder}>
                <Text style={styles.sectionTitle}>Resumen de tu reserva</Text>

                <View style={styles.summaryItem}>
                  <Ionicons name="location-outline" size={18} color={colors.textSecondary || '#374151'} />
                  <View style={styles.summaryContent}>
                    <Text style={styles.summaryLabel}>Viaje</Text>
                    <Text style={styles.summaryValue}>
                      {trip.origin?.city} → {trip.destination?.city}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryItem}>
                  <Ionicons name="people-outline" size={18} color={colors.textSecondary || '#374151'} />
                  <View style={styles.summaryContent}>
                    <Text style={styles.summaryLabel}>Asientos</Text>
                    <Text style={styles.summaryValue}>{seats} asiento{seats > 1 ? 's' : ''}</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* Información del pago */}
            <LinearGradient
              colors={gradients?.card || ['#FFFFFF', '#F8F9FA']}
              style={styles.card}
            >
              <View style={styles.cardBorder}>
                <Text style={styles.sectionTitle}>Información del pago</Text>

                {paymentData?.payment?.data?.feeBreakdown && (
                  <>
                    <View style={styles.priceBreakdown}>
                      <Text style={styles.breakdownLabel}>Reserva de asiento</Text>
                      <Text style={styles.breakdownValue}>${paymentData.payment.data.feeBreakdown.reservationAmount} ARS</Text>
                    </View>

                    <View style={styles.priceBreakdown}>
                      <Text style={styles.breakdownLabel}>Comisión plataforma</Text>
                      <Text style={styles.breakdownValue}>${paymentData.payment.data.feeBreakdown.platformFee} ARS</Text>
                    </View>

                    <View style={styles.priceBreakdown}>
                      <Text style={styles.breakdownLabel}>
                        Comisión MercadoPago ({paymentData.paymentMethod === 'qr' ? '0.6%' : '5.99%'})
                      </Text>
                      <Text style={styles.breakdownValue}>
                        ${paymentData.paymentMethod === 'qr'
                          ? paymentData.payment.data.feeBreakdown.mpQRFee
                          : paymentData.payment.data.feeBreakdown.mpFee} ARS
                      </Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.borderLight || colors.border }]} />

                    <View style={[styles.priceBreakdown, { marginBottom: 0 }]}>
                      <Text style={[styles.breakdownLabel, { fontWeight: fontWeight.bold }]}>
                        Total a pagar
                      </Text>
                      <Text style={[styles.breakdownValue, { fontSize: fontSize.lg, fontWeight: fontWeight.bold }]}>
                        ${paymentData.payment.data.feeBreakdown.totalToPay} ARS
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </LinearGradient>

            {/* Información importante */}
            <LinearGradient
              colors={gradients?.card || ['#FFFFFF', '#F8F9FA']}
              style={styles.card}
            >
              <View style={styles.cardBorder}>
                <View style={styles.importantBox}>
                  <Ionicons name="alert-circle" size={20} color="#EF4444" />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={styles.importantTitle}>Información importante</Text>
                    <Text style={styles.importantText}>
                      Este monto es NO REEMBOLSABLE y va directo a la plataforma.{'\n\n'}
                      El día del viaje pagarás el resto directamente al conductor.
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* Métodos de pago */}
            <LinearGradient
              colors={gradients?.card || ['#FFFFFF', '#F8F9FA']}
              style={styles.card}
            >
              <View style={styles.cardBorder}>
                <Text style={styles.sectionTitle}>Método de pago</Text>

                <TouchableOpacity
                  onPress={handleOpenPaymentLink}
                  style={styles.paymentButton}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={gradients?.primary || ['#1F2937', '#111827']}
                    style={styles.paymentButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons
                      name={paymentData?.paymentMethod === 'qr' ? 'qr-code' : 'card'}
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.paymentButtonText}>
                      {paymentData?.paymentMethod === 'qr' ? 'Pagar con QR' : 'Ir a Checkout Pro'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.paymentHint}>
                  Monto: ${paymentData?.payment?.data?.feeBreakdown?.totalToPay || 'N/A'} ARS
                </Text>

                {/* Debug info */}
                <View style={styles.debugInfo}>
                  <Text style={styles.debugText}>
                    ID Reserva: {paymentData?.reservation?.reservationId || 'N/A'}
                  </Text>
                  <Text style={styles.debugText}>
                    Método: {paymentData?.paymentMethod || selectedPaymentMethod || 'N/A'}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Instrucciones */}
            <LinearGradient
              colors={gradients?.card || ['#FFFFFF', '#F8F9FA']}
              style={styles.card}
            >
              <View style={styles.cardBorder}>
                <Text style={styles.sectionTitle}>Cómo pagar</Text>

                <View style={styles.instructionStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>Abre la app de Mercado Pago</Text>
                </View>

                <View style={styles.instructionStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>Toca "Pagar con QR"</Text>
                </View>

                <View style={styles.instructionStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>Escanea el código QR</Text>
                </View>

                <View style={[styles.instructionStep, { marginBottom: 0 }]}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>4</Text>
                  </View>
                  <Text style={styles.stepText}>Confirma el pago</Text>
                </View>
              </View>
            </LinearGradient>
          </ScrollView>

          {/* Botón cerrar */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => setShowPaymentQR(false)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#E5E7EB', '#D1D5DB']}
                style={styles.closeButton}
              >
                <Text style={[styles.closeButtonText, { color: colors.textPrimary || '#000000' }]}>
                  Cerrar
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </LinearGradient>
    );
  }

  // Pantalla principal de booking
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Trip Summary Card */}
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: isDarkMode ? 0 : 1, borderColor: isDarkMode ? 'transparent' : colors.borderLight }]}>
            <View style={styles.cardBorder}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Resumen del Viaje</Text>

              <View style={styles.routeContainer}>
                <View style={styles.routePoint}>
                  {/* <View style={styles.iconContainer}>
                    <Ionicons name="location" size={20} color={colors.primary || '#1F2937'} />
                  </View> */}
                  <View style={styles.routeTextContainer}>
                    <Text style={[styles.routeText, { color: colors.textPrimary }]}>{trip.origin?.city || 'Origen'}</Text>
                    {!!trip.origin?.province && (
                      <Text style={[styles.routeProvince, { color: colors.textSecondary }]}>{trip.origin.province}</Text>
                    )}
                    {!!trip.origin?.address && (
                      <Text style={[styles.routeAddress, { color: colors.textTertiary }]}>{trip.origin.address}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.arrowContainer}>
                  <Ionicons name="arrow-forward" size={20} color={colors.textTertiary || '#6B7280'} />
                </View>

                <View style={styles.routePoint}>
                  {/* <View style={styles.iconContainer}>
                    <Ionicons name="location" size={20} color={colors.accentRed || '#EF4444'} />
                  </View> */}
                  <View style={styles.routeTextContainer}>
                    <Text style={[styles.routeText, { color: colors.textPrimary }]}>{trip.destination?.city || 'Destino'}</Text>
                    {!!trip.destination?.province && (
                      <Text style={[styles.routeProvince, { color: colors.textSecondary }]}>{trip.destination.province}</Text>
                    )}
                    {!!trip.destination?.address && (
                      <Text style={[styles.routeAddress, { color: colors.textTertiary }]}>{trip.destination.address}</Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.dateTimeContainer}>
                <View style={styles.dateTimeRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={[styles.tripDate, { color: colors.textSecondary }]}>
                    {new Date(trip.departureDate).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </Text>
                </View>
                <View style={styles.dateTimeRow}>
                  <Ionicons name="time-outline" size={18} color={colors.primary} />
                  <Text style={[styles.tripDate, { color: colors.textSecondary }]}>{trip.departureTime || 'N/A'} Hs</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Información de cálculo dinámico */}
          {calculatingPrice ? (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: isDarkMode ? 0 : 1, borderColor: isDarkMode ? 'transparent' : colors.borderLight }]}>
              <View style={styles.cardBorder}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Calculando precio dinámico...
                </Text>
              </View>
            </View>
          ) : priceData ? (
            <>
              {/* Seat Selection Card */}
              <View style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: isDarkMode ? 0 : 1, borderColor: isDarkMode ? 'transparent' : colors.borderLight }]}>
                <View style={styles.cardBorder}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Número de Asientos</Text>

                  <View style={styles.seatSelector}>
                    <TouchableOpacity
                      onPress={() => setSeats(Math.max(1, seats - 1))}
                      disabled={seats === 1}
                    >
                      <LinearGradient
                        colors={seats === 1 ? [colors.surfaceElevated || '#E5E7EB', colors.surface || '#F8F9FA'] : (isDarkMode ? (gradients?.primary || ['#F9FAFB', '#E5E7EB']) : ['#1F2937', '#111827'])}
                        style={styles.seatButton}
                      >
                        <Ionicons
                          name="remove"
                          size={24}
                          color={seats === 1 ? (colors.textMuted || '#9CA3AF') : (isDarkMode ? '#000000' : '#FFFFFF')}
                        />
                      </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.seatCountContainer}>
                      <Text style={[styles.seatCount, { color: colors.textPrimary }]}>{seats}</Text>
                      <Text style={[styles.seatLabel, { color: colors.textSecondary }]}>asiento{seats > 1 ? 's' : ''}</Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => setSeats(Math.min(trip.availableSeats || 5, seats + 1))}
                      disabled={seats === trip.availableSeats}
                    >
                      <LinearGradient
                        colors={seats === trip.availableSeats ? [colors.surfaceElevated || '#E5E7EB', colors.surface || '#F8F9FA'] : (isDarkMode ? (gradients?.primary || ['#F9FAFB', '#E5E7EB']) : ['#1F2937', '#111827'])}
                        style={styles.seatButton}
                      >
                        <Ionicons
                          name="add"
                          size={24}
                          color={seats === trip.availableSeats ? (colors.textMuted || '#9CA3AF') : (isDarkMode ? '#000000' : '#FFFFFF')}
                        />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.availableSeatsContainer}>
                    <Ionicons name="people-outline" size={16} color={colors.textSecondary || '#374151'} />
                    <Text style={[styles.availableSeats, { color: colors.textSecondary }]}>
                      {trip.availableSeats || 0} asientos disponibles
                    </Text>
                  </View>
                </View>
              </View>
            </>
          ) : error ? (
            <LinearGradient
              colors={gradients?.card || ['#FFFFFF', '#F8F9FA']}
              style={styles.card}
            >
              <View style={styles.cardBorder}>
                <Text style={styles.errorMessage}>{error}</Text>
              </View>
            </LinearGradient>
          ) : null}

          {/* Driver Info Card */}
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: isDarkMode ? 0 : 1, borderColor: isDarkMode ? 'transparent' : colors.borderLight }]}>
            <View style={styles.cardBorder}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Conductor</Text>

              <View style={styles.driverInfo}>
                <View style={[styles.avatarPlaceholder, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#1F1F1F' : colors.primary }]}>
                  <Text style={[styles.avatarText, { color: '#FFFFFF' }]}>
                    {trip.driver?.firstName?.[0]}{trip.driver?.lastName?.[0]}
                  </Text>
                </View>

                <View style={styles.driverDetails}>
                  <Text style={[styles.driverName, { color: colors.textPrimary }]}>
                    {trip.driver?.firstName} {trip.driver?.lastName}
                  </Text>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={16} color={colors.accentOrange || '#F59E0B'} />
                    <Text style={[styles.rating, { color: colors.textSecondary }]}>
                      {trip.driver?.rating?.toFixed(1) || '5.0'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Vehicle Info Card */}
          {trip.vehicle && (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: isDarkMode ? 0 : 1, borderColor: isDarkMode ? 'transparent' : colors.borderLight }]}>
              <View style={styles.cardBorder}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Vehículo</Text>

                <View style={styles.vehicleInfo}>
                  <View style={styles.vehicleIconContainer}>
                    <View style={[styles.vehicleIcon, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#1F1F1F' : colors.primary }]}>
                      <Ionicons name="car-sport" size={28} color="#FFFFFF" />
                    </View>
                  </View>

                  <View style={styles.vehicleDetails}>
                    <Text style={[styles.vehicleName, { color: colors.textPrimary }]}>
                      {trip.vehicle?.brand || 'N/A'} {trip.vehicle?.model || ''}
                    </Text>
                    <Text style={[styles.vehicleYear, { color: colors.textSecondary }]}>
                      Año {trip.vehicle?.year || 'N/A'}
                    </Text>
                    {trip.vehicle?.color && (
                      <View style={styles.vehicleColorRow}>
                        <View style={[styles.colorDot, { backgroundColor: trip.vehicle.color.toLowerCase() === 'blanco' ? '#E5E7EB' : trip.vehicle.color.toLowerCase() === 'negro' ? '#1F2937' : trip.vehicle.color.toLowerCase() === 'rojo' ? '#EF4444' : trip.vehicle.color.toLowerCase() === 'azul' ? '#3B82F6' : trip.vehicle.color.toLowerCase() === 'gris' ? '#6B7280' : trip.vehicle.color.toLowerCase() === 'plata' ? '#9CA3AF' : '#6B7280' }]} />
                        <Text style={[styles.vehicleColor, { color: colors.textSecondary }]}>{trip.vehicle.color}</Text>
                      </View>
                    )}
                    {trip.vehicle?.plate && (
                      <View style={[styles.plateContainer, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#1F1F1F' : '#F3F4F6' }]}>
                        <Text style={[styles.plateText, { color: getCurrentThemeMode() === 'dark' ? '#FFFFFF' : '#1F2937' }]}>{trip.vehicle.plate}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Precio y Descuentos Card */}
          {priceData && (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: isDarkMode ? 0 : 1, borderColor: isDarkMode ? 'transparent' : colors.borderLight }]}>
              <View style={styles.cardBorder}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Precio del Viaje</Text>

                <View style={styles.priceBreakdown}>
                  <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Precio base ({seats} asiento{seats > 1 ? 's' : ''})</Text>
                  <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>${formatNumber(priceData.pricing.originalPrice || priceData.pricing.totalPrice)} ARS</Text>
                </View>

                {priceData.pricing.discountPercentage > 0 && (
                  <View style={styles.priceBreakdown}>
                    <Text style={[styles.breakdownLabel, { color: colors.success }]}>Descuento promocional ({priceData.pricing.discountPercentage}%)</Text>
                    <Text style={[styles.breakdownValue, { color: colors.success }]}>-${formatNumber(priceData.pricing.discountAmount)} ARS</Text>
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: colors.borderLight || colors.border }]} />

                <View style={[styles.priceBreakdown, { marginBottom: 0 }]}>
                  <Text style={[styles.breakdownLabel, { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary }]}>
                    Total a pagar
                  </Text>
                  <Text style={[styles.breakdownValue, { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary || '#1F2937' }]}>
                    ${formatNumber(priceData.pricing.finalPrice || priceData.pricing.totalPrice)} ARS
                  </Text>
                </View>

                {priceData.pricing.discountPercentage > 0 && (
                  <View style={[styles.importantBox, {
                    backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                  }]}>
                    <View style={[styles.discountIconWrap, { backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.2)' : 'rgba(16, 185, 129, 0.15)' }]}>
                      <Ionicons name="pricetag" size={20} color={colors.success || '#10B981'} />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={[styles.importantTitle, { color: colors.success || '#10B981' }]}>¡Descuento aplicado!</Text>
                      <Text style={[styles.importantText, { color: colors.textSecondary }]}>
                        Estás ahorrando ${formatNumber(priceData.pricing.discountAmount)} ARS gracias a tu código promocional.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Trip Details Card */}
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: isDarkMode ? 0 : 1, borderColor: isDarkMode ? 'transparent' : colors.borderLight }]}>
            <View style={styles.cardBorder}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Detalles del Viaje</Text>

              <View style={styles.detailRow}>
                <View style={[styles.detailIconWrapper, { backgroundColor: isDarkMode ? colors.surfaceElevated : 'rgba(31, 41, 55, 0.08)' }]}>
                  <Ionicons name="people" size={20} color={colors.textSecondary} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Asientos Disponibles</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{trip.availableSeats || 0} de {trip.totalSeats || trip.availableSeats || 0}</Text>
                </View>
              </View>

              {/* <View style={styles.detailRow}>
                <View style={styles.detailIconWrapper}>
                  <Ionicons name="cash" size={20} color="#1F2937" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Precio por Asiento</Text>
                  <Text style={styles.detailValue}>${trip.pricePerSeat || 0} ARS</Text>
                </View>
              </View> */}

              {priceData?.distanceKm && (
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconWrapper, { backgroundColor: isDarkMode ? colors.surfaceElevated : 'rgba(31, 41, 55, 0.08)' }]}>
                    <Ionicons name="navigate" size={20} color={colors.textSecondary} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Distancia Estimada</Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{priceData.distanceKm} km</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Trip Preferences Card */}
          {trip.rules && (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: isDarkMode ? 0 : 1, borderColor: isDarkMode ? 'transparent' : colors.borderLight }]}>
              <View style={styles.cardBorder}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Preferencias del Viaje</Text>

                <View style={styles.preferencesGrid}>
                  <View style={styles.preferenceItem}>
                    <Ionicons
                      name={trip.rules?.smokingAllowed ? 'checkmark-circle' : 'close-circle'}
                      size={22}
                      color={trip.rules?.smokingAllowed ? '#10B981' : '#EF4444'}
                    />
                    <Text style={[styles.preferenceText, { color: colors.textSecondary }]}>
                      {trip.rules?.smokingAllowed ? 'Permite fumar' : 'No fumar'}
                    </Text>
                  </View>

                  <View style={styles.preferenceItem}>
                    <Ionicons
                      name={trip.rules?.petsAllowed ? 'checkmark-circle' : 'close-circle'}
                      size={22}
                      color={trip.rules?.petsAllowed ? '#10B981' : '#EF4444'}
                    />
                    <Text style={[styles.preferenceText, { color: colors.textSecondary }]}>
                      {trip.rules?.petsAllowed ? 'Mascotas OK' : 'Sin mascotas'}
                    </Text>
                  </View>

                  <View style={styles.preferenceItem}>
                    <Ionicons
                      name={trip.rules?.musicAllowed !== false ? 'musical-notes' : 'musical-notes-outline'}
                      size={22}
                      color={trip.rules?.musicAllowed !== false ? '#10B981' : '#EF4444'}
                    />
                    <Text style={[styles.preferenceText, { color: colors.textSecondary }]}>
                      {trip.rules?.musicAllowed !== false ? 'Música OK' : 'Sin música'}
                    </Text>
                  </View>

                  <View style={styles.preferenceItem}>
                    <Ionicons
                      name="chatbubbles"
                      size={22}
                      color="#3B82F6"
                    />
                    <Text style={[styles.preferenceText, { color: colors.textSecondary }]}>
                      {trip.rules?.talkative === 'quiet' ? 'Silencioso' : trip.rules?.talkative === 'chatty' ? 'Conversador' : 'Flexible'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Notes Card */}
          {trip.notes && (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: isDarkMode ? 0 : 1, borderColor: isDarkMode ? 'transparent' : colors.borderLight }]}>
              <View style={styles.cardBorder}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notas del Conductor</Text>
                <View style={[styles.notesContainer, { backgroundColor: isDarkMode ? colors.surfaceElevated : colors.surface }]}>
                  <Ionicons name="document-text-outline" size={20} color={colors.textTertiary} />
                  <Text style={[styles.notesText, { color: colors.textSecondary }]}>{trip.notes}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Banner Carousel Section */}
          {banners.length > 0 && (
            <View style={styles.bannerSection}>
              <FlatList
                ref={bannerScrollRef}
                data={banners}
                renderItem={renderBannerItem}
                keyExtractor={(item) => item._id}
                horizontal
                pagingEnabled={false}
                showsHorizontalScrollIndicator={false}
                onScroll={onBannerScroll}
                scrollEventThrottle={16}
                snapToInterval={BANNER_WIDTH + 16}
                decelerationRate="fast"
                contentContainerStyle={styles.bannerListContent}
                getItemLayout={(data, index) => ({
                  length: BANNER_WIDTH + 16,
                  offset: (BANNER_WIDTH + 16) * index,
                  index,
                })}
                onScrollToIndexFailed={(info) => {
                  // Manejar error cuando el índice no está disponible
                  console.warn('Error en scrollToIndex:', info);
                  const wait = new Promise(resolve => setTimeout(resolve, 500));
                  wait.then(() => {
                    if (bannerScrollRef.current && info.index < banners.length) {
                      try {
                        bannerScrollRef.current.scrollToIndex({
                          index: info.index,
                          animated: true,
                        });
                      } catch (e) {
                        // Si aún falla, usar scrollToOffset
                        const offset = info.index * (BANNER_WIDTH + 16);
                        bannerScrollRef.current?.scrollToOffset({
                          offset,
                          animated: true,
                        });
                      }
                    }
                  });
                }}
              />
            </View>
          )}
        </ScrollView>

        {/* Confirm Button */}
        <View style={[styles.footer, { backgroundColor: colors.cardBackground, borderTopWidth: isDarkMode ? 0 : 1, borderTopColor: colors.borderLight }]}>
          <TouchableOpacity
            onPress={handleCreateReservation}
            disabled={loading || calculatingPrice || !priceData}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={getCurrentThemeMode() === 'dark' ? ['#1F1F1F', '#2A2A2A'] : ['#1F2937', '#111827']}
              style={styles.confirmButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="large" />
              ) : (
                <>
                  <View style={styles.confirmButtonContent}>
                    <Ionicons name="send-outline" size={24} color="#FFFFFF" />
                    <Text style={[styles.confirmButtonText, { color: '#FFFFFF' }]}>Solicitar Reserva</Text>
                  </View>
                  {priceData && (
                    <Text style={[styles.confirmButtonPrice, { color: '#FFFFFF' }]}>
                      ${formatNumber(priceData.pricing.finalPrice || priceData.pricing.totalPrice)} ARS
                    </Text>
                  )}
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Eliminado: Payment Brick Modal (ya no se usa, se usa Checkout Pro con redirect) */}
      </Animated.View>

      <ConfirmationModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onConfirm={() => {
          setShowSuccessModal(false);
          navigation.goBack();
        }}
        type="success"
        title="Solicitud Enviada"
        message={modalMessage}
        confirmText="OK"
        showCancel={false}
      />

      <ConfirmationModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        onConfirm={() => setShowErrorModal(false)}
        type="error"
        title="Error"
        message={modalMessage}
        confirmText="OK"
        showCancel={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  errorText: {
    fontSize: fontSize.lg,
    color: '#EF4444',
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
    textAlign: 'center',
  },
  animatedContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginLeft: spacing.md,
  },
  card: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardBorder: {
    padding: spacing.md,
    borderWidth: 0,
    borderRadius: borderRadius.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginBottom: spacing.md,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowContainer: {
    paddingHorizontal: spacing.sm,
  },
  routeTextContainer: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  routeText: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
  },
  routeProvince: {
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
    marginTop: 2,
  },
  routeAddress: {
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.regular,
    color: '#9CA3AF',
    marginTop: 2,
  },
  dateTimeContainer: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tripDate: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
  },
  loadingText: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.regular,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  seatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  seatButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatCountContainer: {
    alignItems: 'center',
    marginHorizontal: spacing.xl,
  },
  seatCount: {
    fontSize: fontSize.xxxl,
    fontFamily: SORA_FONTS.bold,
    fontWeight: fontWeight.bold,
    color: '#000000',
  },
  seatLabel: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
    marginTop: spacing.xs,
  },
  availableSeatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  availableSeats: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
  },
  priceBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  breakdownLabel: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    color: '#6B7280',
    fontWeight: fontWeight.semiBold,
  },
  breakdownValue: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    color: '#000000',
    fontWeight: fontWeight.semiBold,
  },
  formulaText: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.semiBold,
    color: '#374151',
    fontWeight: fontWeight.semiBold,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  importantBox: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  discountIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  importantTitle: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
    marginBottom: spacing.xs,
  },
  importantText: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    lineHeight: 18,
  },
  errorMessage: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    color: '#EF4444',
    fontWeight: fontWeight.semiBold,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: fontSize.xl,
    fontFamily: SORA_FONTS.bold,
    fontWeight: fontWeight.bold,
  },
  driverDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  driverName: {
    fontSize: fontSize.lg,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginBottom: spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    marginLeft: spacing.xs,
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
  confirmButton: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
  },
  confirmButtonPrice: {
    color: '#FFFFFF',
    fontSize: fontSize.xl,
    fontFamily: SORA_FONTS.bold,
    fontWeight: fontWeight.bold,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  summaryContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginTop: spacing.xs,
  },
  paymentButton: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  paymentButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  paymentButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
  },
  paymentHint: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
    textAlign: 'center',
  },
  debugInfo: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  debugText: {
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.bold,
    fontWeight: fontWeight.bold,
  },
  stepText: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.regular,
    color: '#374151',
    flex: 1,
  },
  closeButton: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
  },
  // Vehicle Styles
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIconContainer: {
    marginRight: spacing.md,
  },
  vehicleIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleName: {
    fontSize: fontSize.lg,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginBottom: spacing.xs,
  },
  vehicleYear: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
    marginBottom: spacing.xs,
  },
  vehicleColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vehicleColor: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
  },
  plateContainer: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  plateText: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.bold,
    fontWeight: fontWeight.bold,
    color: '#1F2937',
    letterSpacing: 1,
  },
  // Detail Row Styles
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  detailIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
  },
  // Preferences Styles
  preferencesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
    marginBottom: spacing.sm,
  },
  preferenceText: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#374151',
    marginLeft: spacing.sm,
    flex: 1,
  },
  // Notes Styles
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  notesText: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#374151',
    lineHeight: 20,
    flex: 1,
    marginLeft: spacing.sm,
  },
  // Banner Carousel Styles
  bannerSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerListContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: '#1F2937',
  },
  bannerGradient: {
    flex: 1,
    borderRadius: 16,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  bannerContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 18,
    fontFamily: SORA_FONTS.bold,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bannerDescription: {
    fontSize: 14,
    fontFamily: SORA_FONTS.regular,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 12,
  },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bannerCtaText: {
    fontSize: 14,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 4,
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  bannerOverlayTitle: {
    fontSize: 15,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Payment Method Selector Styles
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentMethodIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  paymentMethodContent: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: fontSize.lg,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.regular,
    color: '#6B7280',
    marginBottom: spacing.sm,
  },
  paymentMethodBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  paymentMethodBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: SORA_FONTS.medium,
    fontWeight: fontWeight.medium,
    color: '#FFFFFF',
  },
});

export default BookingScreen;

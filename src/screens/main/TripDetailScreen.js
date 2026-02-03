import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  FlatList,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { get_public, get_withauth, post_withauth } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { getPendingPaymentReservations } from '../../services/seatReservationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = 200;
import { useAuth } from '../../context/AuthContext';
import { colors as themeColors, gradients } from '../../theme/colors';
import useColors from '../../hooks/useColors';

// Safe colors for styles (fallbacks in case theme colors fail to load)
const styleColors = themeColors || {
  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#1F2937',
  accent: '#1F2937',
  accentRed: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
};

const TripDetailScreen = ({ route, navigation }) => {
  const { colors, gradients, createColorArray } = useColors();
  const { tripId } = route.params;
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userBooking, setUserBooking] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Banner states
  const [banners, setBanners] = useState([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerScrollRef = useRef(null);
  const bannerAutoScrollTimer = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadTripDetail(); // Esto ahora incluye checkUserBooking() internamente
    loadBanners();

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
          bannerScrollRef.current?.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
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

  // Recargar estado de reserva cuando la pantalla se enfoque
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 [TripDetail] Pantalla enfocada, verificando estado de reserva');
      checkUserBooking();
    }, [tripId])
  );

  useEffect(() => {
    if (!loading && trip) {
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
    }
  }, [loading, trip]);

  const loadTripDetail = async () => {
    try {
      const response = await get_public(ENDPOINTS.GET_TRIP(tripId));
      if (response.success) {
        setTrip(response.data);
        console.log('✅ [TripDetail] Viaje cargado, verificando reserva del usuario...');
        // Verificar reserva del usuario después de cargar el viaje exitosamente
        await checkUserBooking();
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar el detalle del viaje');
    } finally {
      setLoading(false);
    }
  };

  const checkUserBooking = async () => {
    try {
      console.log('🔍 [TripDetail] Verificando reserva del usuario para viaje:', tripId);

      const response = await get_withauth('/bookings/my-bookings');

      if (response.success && response.data) {
        const bookings = response.data || [];

        // Buscar si hay una reserva activa para este viaje
        const existingBooking = bookings.find(
          booking => {
            const bookingTripId = booking.trip?._id || booking.trip;
            const currentTripId = tripId;
            console.log('🔍 [TripDetail] Comparando:', { bookingTripId, currentTripId, status: booking.status });

            // Incluir más estados de reserva activos y también estados completados
            const activeStatuses = ['pending', 'confirmed', 'accepted', 'active', 'completed'];
            const isMatchingTrip = bookingTripId === currentTripId;
            const hasActiveStatus = activeStatuses.includes(booking.status);

            console.log('📊 [TripDetail] Detalles de comparación:', {
              isMatchingTrip,
              hasActiveStatus,
              bookingStatus: booking.status,
              activeStatuses
            });

            return isMatchingTrip && hasActiveStatus;
          }
        );

        setUserBooking(existingBooking);
        console.log('✅ [TripDetail] Reserva existente encontrada:', existingBooking);
      } else {
        console.log('⚠️ [TripDetail] Error en respuesta de reservas:', response);
        setUserBooking(null);
      }
    } catch (error) {
      console.error('❌ [TripDetail] Error checking user booking:', error);
      setUserBooking(null);
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
        colors={createColorArray('#1F2937', '#374151')}
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
            <Text style={styles.bannerTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {!!item.description && (
              <Text style={styles.bannerDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            {!!item.clickUrl && (
              <View style={styles.bannerCta}>
                <Text style={styles.bannerCtaText}>Ver más</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFF" />
              </View>
            )}
          </View>
        )}
        {!!item.imageUrl && !!item.title && (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.bannerOverlay}
          >
            <Text style={styles.bannerOverlayTitle} numberOfLines={1}>
              {item.title}
            </Text>
          </LinearGradient>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const handleBookTrip = () => {
    // Validar que el trip tenga los datos necesarios
    if (!trip) {
      Alert.alert('Error', 'Datos del viaje no disponibles');
      return;
    }

    if (trip.availableSeats === 0) {
      Alert.alert('Error', 'No hay asientos disponibles');
      return;
    }

    // Validar que tenga al menos origin y destination
    if (!trip.origin || !trip.destination) {
      Alert.alert('Error', 'Datos incompletos del viaje');
      return;
    }

    navigation.navigate('Booking', { trip });
  };

  // Función para completar pago de reserva pendiente
  const handleCompletePendingPayment = async () => {
    try {
      setPaymentLoading(true);
      console.log('💳 [TripDetail] handleCompletePendingPayment llamado');

      // Primero recargar la reserva para obtener la información más actualizada
      let updatedBooking = null;
      try {
        const response = await get_withauth('/bookings/my-bookings');
        if (response.success && response.data) {
          const bookings = response.data || [];
          updatedBooking = bookings.find(
            booking => {
              const bookingTripId = booking.trip?._id || booking.trip;
              return bookingTripId === tripId;
            }
          );
          if (updatedBooking) {
            setUserBooking(updatedBooking);
            console.log('✅ [TripDetail] Reserva actualizada:', updatedBooking);
          }
        }
      } catch (err) {
        console.error('❌ [TripDetail] Error recargando reserva:', err);
      }

      // Usar la reserva actualizada o la existente
      const currentBooking = updatedBooking || userBooking;

      console.log('💳 [TripDetail] userBooking actual:', JSON.stringify(currentBooking, null, 2));

      const seatReservation = currentBooking?.seatReservation;
      const reservationStatus = seatReservation?.reservationStatus || currentBooking?.paymentStatus;
      const seatReservationId = seatReservation?._id || seatReservation?.id;

      console.log('💳 [TripDetail] reservationStatus:', reservationStatus);
      console.log('💳 [TripDetail] seatReservationId:', seatReservationId);
      console.log('💳 [TripDetail] seatReservation completo:', JSON.stringify(seatReservation, null, 2));

      // Verificar si está pendiente de pago
      if (reservationStatus === 'pending_payment') {
        // Obtener URL de pago desde la reserva - buscar en múltiples ubicaciones
        let paymentUrl = seatReservation?.reservationPayment?.paymentUrl ||
          seatReservation?.paymentUrl ||
          seatReservation?.initPoint ||
          currentBooking?.paymentUrl ||
          currentBooking?.seatReservation?.paymentUrl ||
          currentBooking?.seatReservation?.reservationPayment?.paymentUrl;

        console.log('💳 [TripDetail] paymentUrl encontrada en userBooking:', paymentUrl);

        // Si no encontramos la URL, intentar obtenerla desde el endpoint de reservas pendientes
        if (!paymentUrl && seatReservationId) {
          console.log('💳 [TripDetail] No se encontró paymentUrl localmente, buscando en endpoint...');
          try {
            const pendingResponse = await getPendingPaymentReservations();
            console.log('💳 [TripDetail] Respuesta de pending payments:', JSON.stringify(pendingResponse, null, 2));

            if (pendingResponse.success && pendingResponse.data?.pendingReservations) {
              // Buscar por ID de booking o seatReservation
              const bookingId = currentBooking?._id || currentBooking?.id;
              const pendingReservation = pendingResponse.data.pendingReservations.find(
                (r) => r.id === seatReservationId ||
                  r._id === seatReservationId ||
                  r.bookingId === bookingId ||
                  r.seatReservation?._id === seatReservationId ||
                  (r.trip && (r.trip.id === tripId || r.trip._id === tripId))
              );

              if (pendingReservation) {
                paymentUrl = pendingReservation.paymentUrl ||
                  pendingReservation.seatReservation?.paymentUrl ||
                  pendingReservation.seatReservation?.reservationPayment?.paymentUrl;
                console.log('💳 [TripDetail] paymentUrl encontrada en endpoint:', paymentUrl);
              } else {
                console.log('⚠️ [TripDetail] No se encontró la reserva en pending payments');
              }
            }
          } catch (err) {
            console.error('❌ [TripDetail] Error obteniendo reservas pendientes:', err);
          }
        }

        if (paymentUrl) {
          // Validar que la URL sea válida
          if (!paymentUrl.startsWith('http://') && !paymentUrl.startsWith('https://')) {
            console.error('❌ [TripDetail] URL inválida:', paymentUrl);
            Alert.alert('Error', 'La URL de pago no es válida');
            return;
          }

          // Abrir Checkout Pro en el navegador
          console.log('💳 [TripDetail] Intentando abrir URL:', paymentUrl);
          const canOpen = await Linking.canOpenURL(paymentUrl);
          console.log('💳 [TripDetail] canOpen:', canOpen);

          if (canOpen) {
            await Linking.openURL(paymentUrl);
            console.log('✅ [TripDetail] URL abierta exitosamente');
          } else {
            console.error('❌ [TripDetail] No se pudo abrir la URL');
            Alert.alert('Error', 'No se pudo abrir el link de pago. Verifica que la URL sea válida.');
          }
        } else {
          console.error('❌ [TripDetail] No se encontró paymentUrl');
          console.error('❌ [TripDetail] Estructura completa currentBooking:', JSON.stringify(currentBooking, null, 2));
          console.error('❌ [TripDetail] Estructura seatReservation:', JSON.stringify(seatReservation, null, 2));

          Alert.alert(
            'Error',
            'No se encontró la URL de pago. Esto puede ocurrir si la reserva aún no ha sido aprobada por el conductor. Por favor, intenta recargar la página o contacta al soporte.'
          );
        }
      } else if (reservationStatus === 'pending_approval') {
        console.log('⏳ [TripDetail] Reserva pendiente de aprobación');
        Alert.alert(
          'Pendiente de Aprobación',
          'Tu solicitud está esperando la aprobación del conductor. Te notificaremos cuando sea aprobada.'
        );
      } else {
        console.log('ℹ️ [TripDetail] Estado de reserva:', reservationStatus);
        Alert.alert('Información', `Esta reserva no requiere pago en este momento. Estado: ${reservationStatus || 'desconocido'}`);
      }
    } catch (error) {
      console.error('❌ [TripDetail] Error procesando pago:', error);
      console.error('❌ [TripDetail] Error completo:', JSON.stringify(error, null, 2));
      Alert.alert('Error', `No se pudo procesar el pago: ${error.message}`);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Función para cancelar reserva pendiente
  const handleCancelPendingReservation = async () => {
    Alert.alert(
      'Cancelar Reserva',
      '¿Estás seguro de que deseas cancelar esta reserva? Esta acción no se puede deshacer.',
      [
        { text: 'No, mantener', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setPaymentLoading(true);
              // Cancelar reserva de asiento
              const { cancelSeatReservation } = require('../../services/seatReservationService');
              const seatReservationId = userBooking.seatReservation?._id || userBooking.seatReservation?.id;
              if (seatReservationId) {
                await cancelSeatReservation(seatReservationId, 'Cancelado por el usuario');
              } else {
                throw new Error('No se encontró la reserva de asiento');
              }

              // Por ahora, simplemente recargamos el viaje para actualizar el estado
              await loadTripDetail();

              Alert.alert('Éxito', 'Reserva cancelada correctamente');
            } catch (error) {
              console.error('Error cancelando reserva:', error);
              Alert.alert('Error', 'No se pudo cancelar la reserva');
            } finally {
              setPaymentLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleStartChat = async () => {
    try {
      const response = await post_withauth('/chat/conversation', {
        participantId: trip.driver._id,
        tripId: trip._id
      });

      if (response.success) {
        const conversation = response.data;
        const otherUser = conversation.participants?.find(p => p._id !== user._id);

        navigation.navigate('ChatsTab', {
          screen: 'ChatDetail',
          params: {
            conversation,
            otherUser
          }
        });
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo iniciar la conversación');
      console.error('Error al iniciar chat:', error);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando detalles...</Text>
      </LinearGradient>
    );
  }

  if (!trip) {
    return (
      <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.textTertiary} />
        <Text style={styles.emptyText}>Viaje no encontrado</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const userId = user?._id || user?.id;
  const driverId = trip.driver?._id || trip.driver?.id;
  const isOwnTrip = userId && driverId && userId === driverId;

  return (
    <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.container}>
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
          {/* Driver Info Header */}
          <LinearGradient
            colors={createColorArray('#F8F9FA', '#E5E7EB')}
            style={styles.driverCard}
          >
            <LinearGradient
              colors={['#1F2937', '#111827']}
              style={styles.avatarPlaceholder}
            >
              <Text style={styles.avatarText}>
                {(trip.driver?.firstName?.[0] || 'U')}{(trip.driver?.lastName?.[0] || 'N')}
              </Text>
            </LinearGradient>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>
                {`${trip.driver?.firstName || 'Usuario'} ${trip.driver?.lastName || 'Desconocido'}`}
              </Text>
              {!isOwnTrip && (
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={handleStartChat}
                >
                  <LinearGradient
                    colors={createColorArray('#1A1A1A', '#0F0F0F')}
                    style={styles.chatButtonGradient}
                  >
                    <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>

          {/* Trip Status */}
          {!!trip.status && (
            <View style={styles.tripStatusBanner}>
              <View style={[
                styles.tripStatusDot,
                { backgroundColor: trip.status === 'started' ? '#3B82F6'
                  : trip.status === 'completed' ? '#10B981'
                  : trip.status === 'cancelled' ? '#EF4444'
                  : '#6B7280' }
              ]} />
              <Text style={styles.tripStatusLabel}>
                {trip.status === 'started' ? 'Viaje en curso'
                  : trip.status === 'completed' ? 'Viaje finalizado'
                  : trip.status === 'cancelled' ? 'Viaje cancelado'
                  : trip.status === 'active' ? 'Viaje programado'
                  : trip.status === 'pending' ? 'Viaje pendiente'
                  : `Estado: ${trip.status}`}
              </Text>
              {trip.status === 'started' && !!trip.startedAt && (
                <Text style={styles.tripStatusTime}>
                  {`· ${new Date(trip.startedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} hs`}
                </Text>
              )}
            </View>
          )}

          {/* Route Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ruta</Text>
            <LinearGradient
              colors={createColorArray('#F8F9FA', '#E5E7EB')}
              style={styles.infoCard}
            >
              <View style={styles.routeContainer}>
                <View style={styles.routeLine}>
                  <LinearGradient
                    colors={['#1F2937', '#111827']}
                    style={styles.routeDot}
                  />
                  <View style={styles.routePath} />
                  <View style={[styles.routeDot, styles.routeDotEnd]}>
                    <LinearGradient
                      colors={['#EF4444', '#DC2626']}
                      style={styles.routeDotGradient}
                    />
                  </View>
                </View>
                <View style={styles.routeInfo}>
                  <View style={styles.routePoint}>
                    <Text style={styles.routeTime}>{trip.departureTime || 'N/A'}</Text>
                    <Text style={styles.routeCity}>{trip.origin?.city || 'Ciudad desconocida'}</Text>
                    <Text style={styles.routeAddress}>{trip.origin?.address || 'Dirección no especificada'}</Text>
                  </View>
                  <View style={styles.routePoint}>
                    <Text style={styles.routeCity}>{trip.destination?.city || 'Ciudad desconocida'}</Text>
                    <Text style={styles.routeAddress}>{trip.destination?.address || 'Dirección no especificada'}</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Trip Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detalles del Viaje</Text>
            <LinearGradient
              colors={createColorArray('#F8F9FA', '#E5E7EB')}
              style={styles.infoCard}
            >
              <View style={styles.detailRow}>
                <View style={styles.iconWrapper}>
                  <Ionicons name="calendar-outline" size={20} color="#1F2937" />
                </View>
                <Text style={styles.detailText}>
                  {trip.departureDate
                    ? new Date(trip.departureDate).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                    : 'Fecha no especificada'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.iconWrapper}>
                  <Ionicons name="people-outline" size={20} color="#1F2937" />
                </View>
                <Text style={styles.detailText}>
                  {`${trip.availableSeats || 0} asiento${(trip.availableSeats || 0) > 1 ? 's' : ''} disponible${(trip.availableSeats || 0) > 1 ? 's' : ''}`}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.iconWrapper}>
                  <Ionicons name="car-outline" size={20} color="#1F2937" />
                </View>
                <Text style={styles.detailText}>
                  {`${trip.vehicle?.brand || 'N/A'} ${trip.vehicle?.model || 'N/A'} - ${trip.vehicle?.year || 'N/A'}`}
                </Text>
              </View>
            </LinearGradient>
          </View>

          {/* Price Highlight - Solo mostrar si hay precio */}
          {/* {trip.pricePerSeat > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Precio</Text>
              <LinearGradient
                colors={['#1F2937', '#111827']}
                style={styles.priceCard}
              >
                <Ionicons name="cash-outline" size={28} color="#FFFFFF" />
                <View style={styles.priceContent}>
                  <Text style={styles.priceAmount}>${trip.pricePerSeat?.toFixed(2) || '0.00'}</Text>
                  <Text style={styles.priceLabelWhite}>por asiento</Text>
                </View>
              </LinearGradient>
            </View>
          )} */}

          {/* Notes */}
          {!!trip.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notas del Conductor</Text>
              <LinearGradient
                colors={createColorArray('#F8F9FA', '#E5E7EB')}
                style={styles.infoCard}
              >
                <Text style={styles.notes}>{trip.notes}</Text>
              </LinearGradient>
            </View>
          )}

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferencias</Text>
            <LinearGradient
              colors={createColorArray('#F8F9FA', '#E5E7EB')}
              style={styles.infoCard}
            >
              <View style={styles.preferencesContainer}>
                <View style={styles.preference}>
                  <Ionicons
                    name={trip.rules?.smokingAllowed ? 'checkmark-circle' : 'close-circle'}
                    size={22}
                    color={trip.rules?.smokingAllowed ? colors.accentGreen : colors.accentRed}
                  />
                  <Text style={styles.preferenceText}>
                    {`${trip.rules?.smokingAllowed ? 'Permite' : 'No permite'} fumar`}
                  </Text>
                </View>
                <View style={styles.preference}>
                  <Ionicons
                    name={trip.rules?.petsAllowed ? 'checkmark-circle' : 'close-circle'}
                    size={22}
                    color={trip.rules?.petsAllowed ? colors.accentGreen : colors.accentRed}
                  />
                  <Text style={styles.preferenceText}>
                    {`${trip.rules?.petsAllowed ? 'Permite' : 'No permite'} mascotas`}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

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
              />
            </View>
          )}

          {/* Bottom padding for footer */}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* User Booking Status */}
        {!isOwnTrip && userBooking && (
          <LinearGradient
            colors={['#FFFFFF', '#FFFFFF']}
            style={styles.footer}
          >
            <View style={styles.bookingStatus}>
              <View style={styles.bookingStatusIcon} />
              <Text style={styles.bookingStatusText}>
                {userBooking.status === 'confirmed' || userBooking.status === 'accepted'
                  ? 'Reserva Confirmada'
                  : 'Reserva Pendiente'}
              </Text>
            </View>
          </LinearGradient>
        )}

        {/* Book Button o Estado de Reserva */}
        {!isOwnTrip && (
          <LinearGradient
            colors={createColorArray('rgba(255,255,255,0)', 'rgba(248,249,250,0.95)', '#F8F9FA')}
            style={styles.footer}
          >
            {userBooking ? (
              // Mostrar estado de reserva existente
              // Verificar si es reserva de asiento pendiente de pago o reserva tradicional pendiente
              (userBooking.seatReservation?.reservationStatus === 'pending_payment' ||
                userBooking.paymentStatus === 'pending_payment') ? (
                // Reserva pendiente de pago
                <View style={styles.pendingPaymentContainer}>
                  <LinearGradient
                    colors={['#1F2937', '#111827']}
                    style={styles.pendingPaymentCard}
                  >
                    <View style={styles.pendingPaymentBadge}>
                      <View style={styles.pendingPaymentDot} />
                      <Text style={styles.pendingPaymentBadgeText}>Pago Pendiente</Text>
                    </View>

                    <Text style={styles.pendingPaymentMessage}>
                      Tu reserva está esperando el pago para confirmarse.
                    </Text>

                    <TouchableOpacity
                      style={styles.payButton}
                      onPress={handleCompletePendingPayment}
                      disabled={paymentLoading}
                      activeOpacity={0.8}
                    >
                      <View style={styles.payButtonGradient}>
                        {paymentLoading ? (
                          <ActivityIndicator size="small" color="#1F2937" />
                        ) : (
                          <>
                            <Ionicons name="card-outline" size={20} color="#1F2937" />
                            <Text style={styles.payButtonText}>Completar Pago</Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancelPendingReservation}
                      disabled={paymentLoading}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar reserva</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              ) : (
                // Reserva confirmada o en otro estado
                <LinearGradient
                  colors={['#1F2937', '#111827']}
                  style={styles.confirmedBookingCard}
                >
                  <View style={styles.confirmedBookingBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.confirmedBookingBadgeText}>
                      {userBooking.status === 'confirmed' ? 'Confirmada' : 'Activa'}
                    </Text>
                  </View>
                  <Text style={styles.confirmedBookingTitle}>
                    {userBooking.status === 'confirmed' ? 'Tu reserva está confirmada' : 'Tu reserva está activa'}
                  </Text>
                </LinearGradient>
              )
            ) : (
              // Botón de reservar nuevo viaje
              <TouchableOpacity
                style={[styles.bookButton, trip.availableSeats === 0 && styles.bookButtonDisabled]}
                onPress={handleBookTrip}
                disabled={trip.availableSeats === 0}
              >
                <LinearGradient
                  colors={['#1F2937', '#111827']}
                  style={styles.bookButtonGradient}
                >
                  <Ionicons
                    name={trip.availableSeats === 0 ? 'close-circle-outline' : 'checkmark-circle-outline'}
                    size={24}
                    color="#FFFFFF"
                  />
                  <Text style={styles.bookButtonText}>
                    {trip.availableSeats === 0 ? 'Sin Asientos Disponibles' : 'Reservar Viaje'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </LinearGradient>
        )}
      </Animated.View>
    </LinearGradient>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: styleColors.textSecondary,
    fontWeight: '500',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: styleColors.textPrimary,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: styleColors.border,
  },
  backButtonText: {
    fontSize: 16,
    color: styleColors.textPrimary,
    fontWeight: '600',
  },
  animatedContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  driverCard: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: styleColors.border,
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  driverName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: styleColors.textPrimary,
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    marginLeft: 6,
    fontSize: 16,
    color: styleColors.textSecondary,
    fontWeight: '600',
  },
  trips: {
    marginLeft: 8,
    fontSize: 14,
    color: styleColors.textTertiary,
  },
  chatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 8,
  },
  chatButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: styleColors.border,
    borderRadius: 22,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: styleColors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: styleColors.border,
  },
  routeContainer: {
    flexDirection: 'row',
  },
  routeLine: {
    width: 24,
    alignItems: 'center',
    marginRight: 16,
  },
  routeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  routeDotEnd: {
    width: 16,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  routeDotGradient: {
    width: '100%',
    height: '100%',
  },
  routePath: {
    flex: 1,
    width: 2,
    backgroundColor: styleColors.borderLight,
    marginVertical: 10,
  },
  routeInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  routePoint: {
    marginBottom: 16,
  },
  routeTime: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  routeCity: {
    fontSize: 18,
    fontWeight: '700',
    color: styleColors.textPrimary,
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 14,
    color: styleColors.textSecondary,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(31, 41, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 14,
    flex: 1,
    fontSize: 15,
    color: styleColors.textPrimary,
    fontWeight: '500',
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  priceContent: {
    marginLeft: 16,
    flex: 1,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  priceLabelWhite: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  notes: {
    fontSize: 15,
    color: styleColors.textSecondary,
    lineHeight: 22,
  },
  preferencesContainer: {
    gap: 16,
  },
  preference: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferenceText: {
    marginLeft: 12,
    fontSize: 15,
    color: styleColors.textPrimary,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  bookButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  bookButtonDisabled: {
    shadowOpacity: 0.1,
    elevation: 2,
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 12,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  bookingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: styleColors.border,
  },
  bookingStatusIcon: {
    marginRight: 12,
  },
  bookingStatusText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  // Banner Carousel Styles
  bannerSection: {
    marginTop: 8,
    marginBottom: 16,
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
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bannerDescription: {
    fontSize: 14,
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
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(31, 41, 55, 0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#1F2937',
    width: 24,
  },
  // Estilos para reserva pendiente de pago
  pendingPaymentContainer: {
    marginBottom: 8,
  },
  pendingPaymentCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  pendingPaymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 12,
  },
  pendingPaymentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  pendingPaymentBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pendingPaymentMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  payButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    gap: 8,
  },
  payButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmedBookingCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  confirmedBookingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 12,
    gap: 6,
  },
  confirmedBookingBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  confirmedBookingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  confirmedBookingSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  tripStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  tripStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tripStatusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  tripStatusTime: {
    fontSize: 13,
    color: '#6B7280',
  },
});

export default TripDetailScreen;

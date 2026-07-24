import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Modal, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { useAuth } from '../../../context/AuthContext';
import { get_withauth, put_withauth, buildImageUri } from '../../../services/apiService';
import { acceptTripRequestApplication, applyToTripRequest, cancelTripRequest } from '../../../services/tripRequestService';
import { confirmFromCallback } from '../../../services/seatReservationService';
import CheckoutWebView from '../../../components/payment/CheckoutWebView';
import { ENDPOINTS } from '../../../config/api';
import { useUI } from '../../../theme/ui';
import VehicleOptionCard from '../../../components/vehicle/VehicleOptionCard';

const STATUS_MAP = {
  open:             { label: 'Abierta',       solid: true },
  awaiting_payment: { label: 'Pago pendiente', solid: true },
  paid:             { label: 'Confirmada',     solid: true },
  cancelled:        { label: 'Cancelada',      solid: false },
  expired:          { label: 'Vencida',        color: '#9CA3AF' },
};

const TripRequestDetailScreen = ({ route, navigation }) => {
  const { requestId, canApply: canApplyParam, alreadyApplied: alreadyAppliedParam } = route.params || {};

  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { showAlert }  = useAlert();

  const dark        = isDarkMode;
  const ui = useUI();
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const textPrimary = dark ? '#FFFFFF'  : '#1F2937';
  const textSecondary = dark ? '#D1D5DB' : '#374151';
  const textMuted   = dark ? '#9CA3AF'  : '#6B7280';
  const divider     = dark ? '#2A2A2A'  : '#E5E7EB';
  const accent      = dark ? '#FFFFFF'  : '#1F2937';  const accentInverse = ui.invertText;

  const [request,        setRequest]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [accepting,      setAccepting]      = useState(null);
  const [vehicles,       setVehicles]       = useState([]);
  const [vehicleModal,   setVehicleModal]   = useState(false);
  const [applying,       setApplying]       = useState(false);
  const [canApply,       setCanApply]       = useState(canApplyParam ?? false);
  const [alreadyApplied, setAlreadyApplied] = useState(alreadyAppliedParam ?? false);
  const [checkoutModal,  setCheckoutModal]  = useState({ visible: false, paymentUrl: null });
  const [cancelling,     setCancelling]     = useState(false);

  const isPassenger = request ? request.isPassenger : false;
  const isDriver    = request ? !request.isPassenger : false;

  const loadVehicles = async () => {
    try {
      const res = await get_withauth(ENDPOINTS.MY_VEHICLES);
      if (res.success) setVehicles(res.data || []);
    } catch { /* no-op */ }
  };

  const load = async (isRefreshing = false) => {
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await get_withauth(`/trip-requests/${requestId}`);
      if (res.success) {
        setRequest(res.data);
        if (res.data.canApply       !== undefined) setCanApply(res.data.canApply);
        if (res.data.alreadyApplied !== undefined) setAlreadyApplied(res.data.alreadyApplied);
        if (!res.data.isPassenger) loadVehicles();
      }
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [requestId]));

  const onRefresh = () => { load(true); };

  const handleCancel = () => {
    showAlert(
      'Cancelar solicitud',
      '¿Estás seguro? Los conductores postulados serán notificados.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar', style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelTripRequest(requestId);
              navigation.navigate('Result', {
                type: 'success',
                title: 'Solicitud cancelada',
                message: 'Tu solicitud fue cancelada.',
                onPrimary: () => { navigation.goBack(); navigation.goBack(); },
              });
            } catch (err) {
              showAlert('Error', err.message);
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  const handleCancelTrip = () => {
    showAlert(
      'Cancelar viaje',
      '¿Estás seguro? El viaje será eliminado y el pasajero será notificado. La solicitud volverá a estar abierta.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar', style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const tripId = request?.createdTrip?._id || request?.createdTrip;
              await put_withauth(ENDPOINTS.CANCEL_TRIP(tripId));
              navigation.navigate('Result', {
                type: 'success',
                title: 'Viaje cancelado',
                message: 'El viaje fue cancelado y el pasajero fue notificado.',
                onPrimary: () => { navigation.goBack(); navigation.goBack(); },
              });
            } catch (err) {
              showAlert('Error', err.message);
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  const handleApplyPress = () => {
    if (vehicles.length === 0) {
      return showAlert(
        'Sin vehículos',
        'Necesitás tener al menos un vehículo registrado para postularte.',
        [{ text: 'Agregar vehículo', onPress: () => navigation.navigate('ProfileTab', { screen: 'Vehicles' }) }]
      );
    }
    setVehicleModal(true);
  };

  const confirmApply = async (vehicleId) => {
    setVehicleModal(false);
    setApplying(true);
    try {
      const res = await applyToTripRequest(requestId, vehicleId);
      if (res.success) {
        navigation.navigate('Result', { type: 'success', title: '¡Propuesta enviada!', message: 'El pasajero revisará tu perfil y vehículo.' });
        setAlreadyApplied(true);
        setCanApply(false);
      }
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      setApplying(false);
    }
  };

  const handleAccept = (applicationId) => {
    showAlert(
      'Aceptar conductor',
      'Al aceptar este conductor, los demás serán rechazados y se generará el pago.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            setAccepting(applicationId);
            try {
              const res = await acceptTripRequestApplication(requestId, applicationId);
              if (res.success) {
                const paymentUrl = res.data?.payment?.url;
                if (paymentUrl) {
                  setCheckoutModal({ visible: true, paymentUrl });
                } else {
                  load();
                }
              }
            } catch (err) {
              showAlert('Error', err.message);
            } finally {
              setAccepting(null);
            }
          }
        }
      ]
    );
  };

  // timeZone UTC: departureDate de una solicitud es un dia de calendario guardado como
  // medianoche UTC. Sin esto, en UTC-3 se muestra el dia anterior.
  const formatDate = (date) =>
    new Date(date).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="small" color={textMuted} />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Text style={[styles.emptyText, { color: textMuted }]}>Solicitud no encontrada</Text>
      </View>
    );
  }

  const statusCfg   = STATUS_MAP[request.status] || { label: request.status, color: textMuted };
  const acceptedApp = request.applications?.find(a => a.status === 'accepted');
  const passenger   = request.passenger;
  const isAcceptedDriver = isDriver && !!acceptedApp && String(acceptedApp.driver) === String(user?._id);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} colors={[textMuted]} />}
      >

        {/* Status badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.solid ? ui.invertBg : ui.surface }]}>
            <View style={[styles.statusDot, { backgroundColor: statusCfg.solid ? ui.invertText : textMuted }]} />
            <Text style={[styles.statusText, { color: statusCfg.solid ? ui.invertText : textMuted }]}>{statusCfg.label}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={[styles.section, { borderBottomColor: divider }]}>
          <View style={styles.routeRow}>
            <View style={styles.routeDotsCol}>
              <View style={[styles.routeDotOrigin, { borderColor: accent }]} />
              <View style={[styles.routeLineV, { backgroundColor: dark ? '#333' : '#D0D0D0' }]} />
              <View style={[styles.routeDotDest, { backgroundColor: accent }]} />
            </View>
            <View style={styles.routeLabelsCol}>
              <View style={styles.routeStop}>
                <Text style={[styles.routeStopLabel, { color: textMuted }]}>Origen</Text>
                <Text style={[styles.routeStopAddress, { color: textPrimary }]}>{request.origin.city}</Text>
                {request.origin.address && request.origin.address !== request.origin.city && (
                  <Text style={[styles.routeStopCity, { color: textMuted }]} numberOfLines={2}>{request.origin.address}</Text>
                )}
              </View>
              {(request.intermediateStops || []).map((stop, i) => (
                <View key={i} style={styles.routeStop}>
                  <Text style={[styles.routeStopLabel, { color: textMuted }]}>Parada {i + 1}</Text>
                  <Text style={[styles.routeStopAddress, { color: textPrimary }]}>{stop.city || stop.address}</Text>
                  {stop.address && stop.address !== stop.city && (
                    <Text style={[styles.routeStopCity, { color: textMuted }]} numberOfLines={2}>{stop.address}</Text>
                  )}
                </View>
              ))}
              <View style={styles.routeStop}>
                <Text style={[styles.routeStopLabel, { color: textMuted }]}>Destino</Text>
                <Text style={[styles.routeStopAddress, { color: textPrimary }]}>{request.destination.city}</Text>
                {request.destination.address && request.destination.address !== request.destination.city && (
                  <Text style={[styles.routeStopCity, { color: textMuted }]} numberOfLines={2}>{request.destination.address}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Ver trayecto en mapa */}
        {(request.origin?.coordinates?.latitude || request.destination?.coordinates?.latitude) && (
          <TouchableOpacity
            style={[styles.mapBtn, { borderColor: divider }]}
            onPress={() => navigation.navigate('TripMap', { trip: request })}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={18} color={textPrimary} />
            <Text style={[styles.mapBtnText, { color: textPrimary }]}>Ver trayecto en mapa</Text>
            <Ionicons name="chevron-forward" size={16} color={textMuted} />
          </TouchableOpacity>
        )}

        {/* Meta: fecha · hora · km · precio */}
        <View style={[styles.metaRow, { borderBottomColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={16} color={textPrimary} />
            <Text style={[styles.metaText, { color: textPrimary }]}>{formatDate(request.departureDate)}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={textPrimary} />
            <Text style={[styles.metaText, { color: textPrimary }]}>{request.departureTime}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={16} color={textPrimary} />
            <Text style={[styles.metaText, { color: textPrimary }]}>
              {request.seatsNeeded} {request.seatsNeeded === 1 ? 'asiento' : 'asientos'}
            </Text>
          </View>
        </View>

        {/* Precio — solo visible para el pasajero */}
        {isPassenger && <View style={[styles.costBanner, { backgroundColor: cardBg, borderColor: divider }]}>
          <View style={styles.costBannerLeft}>
            <Text style={[styles.costBannerLabel, { color: textSecondary }]}>Precio a pagar</Text>
            {request.seatsNeeded > 1 && (
              <Text style={[styles.costBannerSub, { color: textMuted }]}>
                ${request.pricePerSeat?.toLocaleString()} × {request.seatsNeeded} asientos
              </Text>
            )}
          </View>
          <Text style={[styles.costBannerValue, { color: textPrimary }]}>
            ${((request.pricePerSeat || 0) * (request.seatsNeeded || 1)).toLocaleString()}
          </Text>
        </View>}

        {/* Passenger info (driver mode) */}
        {isDriver && passenger && (
          <View style={[styles.section, { borderBottomColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: textPrimary }]}>Publicado por</Text>
            <View style={styles.driverRow}>
              {passenger.avatar ? (
                <Image source={{ uri: buildImageUri(passenger.avatar) }} style={styles.driverAvatar} />
              ) : (
                <View style={[styles.driverAvatarPlaceholder, { backgroundColor: cardBg }]}>
                  <Text style={[styles.driverInitials, { color: textSecondary }]}>
                    {`${passenger.firstName?.[0] || ''}${passenger.lastName?.[0] || ''}`}
                  </Text>
                </View>
              )}
              <View style={styles.driverInfo}>
                <Text style={[styles.driverName, { color: textPrimary }]}>
                  {passenger.firstName} {passenger.lastName}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Driver selected — passenger mode, non-open */}
        {isPassenger && acceptedApp && request.status !== 'open' && (
          <View style={[styles.section, { borderBottomColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: textPrimary }]}>Conductor aprobado</Text>
            <View style={styles.driverRow}>
              {acceptedApp.driverSnapshot?.avatar ? (
                <Image source={{ uri: buildImageUri(acceptedApp.driverSnapshot.avatar) }} style={styles.driverAvatar} />
              ) : (
                <View style={[styles.driverAvatarPlaceholder, { backgroundColor: cardBg }]}>
                  <Ionicons name="person" size={22} color={textMuted} />
                </View>
              )}
              <View style={styles.driverInfo}>
                <Text style={[styles.driverName, { color: textPrimary }]}>
                  {acceptedApp.driverSnapshot?.firstName} {acceptedApp.driverSnapshot?.lastName}
                </Text>
                {acceptedApp.vehicleSnapshot && (
                  <Text style={[styles.driverPhotoHint, { color: textMuted }]}>
                    {acceptedApp.vehicleSnapshot.brand} {acceptedApp.vehicleSnapshot.model} · {acceptedApp.vehicleSnapshot.licensePlate}
                  </Text>
                )}
              </View>
              <Ionicons name="checkmark-circle" size={20} color={textPrimary} />
            </View>
          </View>
        )}

        {/* Applications — passenger, open */}
        {isPassenger && request.status === 'open' && (
          <View style={[styles.section, { borderBottomColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: textPrimary }]}>
              Postulaciones · {request.applications?.length || 0}/5
            </Text>
            {request.applications?.length === 0 ? (
              <Text style={{ fontSize: 13, color: textMuted }}>
                Aún no hay conductores postulados. Te avisamos cuando lleguen.
              </Text>
            ) : (
              request.applications.map((app) => (
                <TouchableOpacity
                  key={app._id}
                  style={[styles.passengerRow, { borderBottomColor: divider }]}
                  onPress={() => navigation.navigate('ApplicationDetail', { app, requestId })}
                  activeOpacity={0.75}
                >
                  {app.driverSnapshot?.avatar ? (
                    <Image source={{ uri: buildImageUri(app.driverSnapshot.avatar) }} style={styles.passengerAvatar} />
                  ) : (
                    <View style={[styles.passengerAvatarPlaceholder, { backgroundColor: cardBg }]}>
                      <Ionicons name="person" size={18} color={textMuted} />
                    </View>
                  )}
                  <View style={styles.passengerInfo}>
                    <Text style={[styles.passengerName, { color: textPrimary }]}>
                      {app.driverSnapshot?.firstName} {app.driverSnapshot?.lastName}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <Ionicons name="star" size={11} color={textPrimary} />
                      <Text style={[styles.passengerSeats, { color: textMuted }]}>
                        {app.driverSnapshot?.rating?.toFixed(1) || '—'}
                      </Text>
                      {app.vehicleSnapshot && (
                        <Text style={[styles.passengerSeats, { color: textMuted }]}>
                          · {app.vehicleSnapshot.brand} {app.vehicleSnapshot.model} {app.vehicleSnapshot.licensePlate ? `· ${app.vehicleSnapshot.licensePlate}` : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  {app.status === 'rejected' ? (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: cardBg }}>
                      <Text style={{ color: ui.textMuted, fontSize: 10, fontWeight: '600' }}>Rechazado</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={textMuted} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: divider }]}>

          {/* Pago pendiente (passenger) */}
          {isPassenger && request.status === 'awaiting_payment' && request.paymentData?.paymentUrl && (
            <View style={styles.pendingWrap}>
              <View style={styles.pendingTopRow}>
                <View style={styles.pendingIndicator}>
                  <View style={[styles.pendingDot, { backgroundColor: ui.textMuted }]} />
                  <Text style={[styles.pendingLabel, { color: ui.textMuted }]}>Pago pendiente</Text>
                </View>
              </View>
              <Text style={[{ fontSize: 13, color: textMuted, marginBottom: 14 }]}>
                Tu conductor está reservado. Completá el pago para confirmar el viaje.
              </Text>
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: ui.textMuted }]}
                onPress={() => setCheckoutModal({ visible: true, paymentUrl: request.paymentData.paymentUrl })}
                activeOpacity={0.85}
              >
                <Text style={[styles.footerBtnText, { color: '#FFFFFF' }]}>Ir al pago</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Esperando pago (driver) */}
          {isAcceptedDriver && request.status === 'awaiting_payment' && (
            <View style={[styles.statusFooter, { backgroundColor: ui.invertBg }]}>
              <Ionicons name="hourglass-outline" size={17} color={ui.invertText} />
              <Text style={[styles.statusFooterText, { color: ui.invertText }]}>
                ¡Te eligieron! El pasajero está completando el pago.
              </Text>
            </View>
          )}

          {/* Confirmado */}
          {(isPassenger || isAcceptedDriver) && request.status === 'paid' && (
            <View style={[styles.statusFooter, { backgroundColor: ui.invertBg }]}>
              <Ionicons name="checkmark-circle" size={17} color={ui.invertText} />
              <Text style={[styles.statusFooterText, { color: ui.invertText }]}>
                {isPassenger ? 'Viaje confirmado. Aparece en "Mis reservas".' : 'Pago confirmado. El viaje está en tu agenda.'}
              </Text>
            </View>
          )}

          {/* Cancelar viaje (driver aceptado, paid) */}
          {isAcceptedDriver && request.status === 'paid' && (
            <View style={[styles.footerRow, { marginTop: 10 }]}>
              <TouchableOpacity
                style={[styles.footerBtnOutline, { borderColor: ui.border, flex: 1 }, cancelling && { opacity: 0.6 }]}
                onPress={handleCancelTrip}
                activeOpacity={0.7}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color={ui.textMuted} />
                  : <Text style={[styles.footerBtnOutlineText, { color: ui.textMuted }]}>Cancelar viaje</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Ofrecer viaje (driver) */}
          {isDriver && (
            alreadyApplied && !['paid', 'awaiting_payment'].includes(request.status) ? (
              <View style={[styles.statusFooter, { backgroundColor: ui.invertBg }]}>
                <Ionicons name="checkmark-circle" size={17} color={ui.invertText} />
                <Text style={[styles.statusFooterText, { color: ui.invertText }]}>Ya te postulaste a este viaje</Text>
              </View>
            ) : canApply ? (
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: accent }, applying && { opacity: 0.6 }]}
                onPress={handleApplyPress}
                disabled={applying}
              >
                {applying
                  ? <ActivityIndicator color={accentInverse} />
                  : <Text style={[styles.footerBtnText, { color: accentInverse }]}>Ofrecer viaje</Text>
                }
              </TouchableOpacity>
            ) : null
          )}

          {/* Cancelar (passenger) */}
          {isPassenger && ['open', 'awaiting_payment', 'paid'].includes(request.status) && (
            <View style={[styles.footerRow, { marginTop: request.status === 'awaiting_payment' ? 0 : 10 }]}>
              <TouchableOpacity
                style={[styles.footerBtnOutline, { borderColor: ui.border, flex: 1 }, cancelling && { opacity: 0.6 }]}
                onPress={handleCancel}
                activeOpacity={0.7}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color={ui.textMuted} />
                  : <Text style={[styles.footerBtnOutlineText, { color: ui.textMuted }]}>Cancelar solicitud</Text>
                }
              </TouchableOpacity>
            </View>
          )}

        </View>

      </ScrollView>

      {/* Checkout WebView */}
      <CheckoutWebView
        visible={checkoutModal.visible}
        paymentUrl={checkoutModal.paymentUrl}
        onClose={() => { setCheckoutModal({ visible: false, paymentUrl: null }); load(); }}
        onPaymentSuccess={async ({ externalReference }) => {
          try {
            await confirmFromCallback(externalReference || requestId, 'approved');
          } catch (e) {
            console.warn('confirmFromCallback:', e?.message);
          }
          setCheckoutModal({ visible: false, paymentUrl: null });
          load();
        }}
        onPaymentError={() => {
          setCheckoutModal({ visible: false, paymentUrl: null });
          load();
        }}
        reservationId={requestId}
      />

      {/* Vehicle selection modal */}
      {isDriver && (
        <Modal visible={vehicleModal} transparent animationType="slide" onRequestClose={() => setVehicleModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>¿Con qué vehículo te postulás?</Text>
              <ScrollView>
                {vehicles.map(v => {
                    const insufficient = v.capacity < (request?.seatsNeeded || 1);
                    return (
                      <VehicleOptionCard
                        key={v._id}
                        vehicle={v}
                        compact
                        disabledReason={
                          insufficient
                            ? `Capacidad insuficiente (${v.capacity} de ${request.seatsNeeded} requeridos)`
                            : null
                        }
                        onPress={() => {
                          if (insufficient) {
                            showAlert('Capacidad insuficiente', `Este vehículo tiene ${v.capacity} asiento${v.capacity === 1 ? '' : 's'} y el viaje necesita ${request.seatsNeeded}.`);
                          } else {
                            confirmApply(v._id);
                          }
                        }}
                      />
                    );
                  })}
              </ScrollView>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: divider }]}
                onPress={() => setVehicleModal(false)}
              >
                <Text style={{ color: textMuted }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15 },

  // Status — exact match TripDetailScreen
  statusRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6,
  },
  statusDot:  { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },

  // Section
  section:      { paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 },

  // Route
  routeRow:       { flexDirection: 'row', gap: 16 },
  routeDotsCol:   { width: 18, alignItems: 'center', paddingTop: 4 },
  routeDotOrigin: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  routeLineV:     { width: 1.5, height: 44, marginVertical: 2 },
  routeDotDest:   { width: 10, height: 10, borderRadius: 5 },
  routeLabelsCol: { flex: 1 },
  routeStop:      { paddingBottom: 16 },
  routeStopLabel:   { fontSize: 11, fontFamily: 'Sora_500Medium', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  routeStopAddress: { fontSize: 15, fontFamily: 'Sora_500Medium' },
  routeStopCity:    { fontSize: 13, marginTop: 1 },

  // Meta row
  metaRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  metaItem:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaDivider:{ width: StyleSheet.hairlineWidth, height: 20, marginHorizontal: 4 },
  metaText:   { fontSize: 13, flex: 1 },

  // Cost banner
  costBanner:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  costBannerLeft:  { flex: 1 },
  costBannerLabel: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  costBannerSub:   { fontSize: 12, marginTop: 2 },
  costBannerValue: { fontSize: 22, fontFamily: 'Sora_700Bold' },

  // Driver / person row
  driverRow:              { flexDirection: 'row', alignItems: 'center', gap: 14 },
  driverAvatar:           { width: 56, height: 56, borderRadius: 28 },
  driverAvatarPlaceholder:{ width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  driverInitials:         { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  driverInfo:             { flex: 1 },
  driverName:             { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  driverPhotoHint:        { fontSize: 12, marginTop: 4 },

  // Passengers / applications list
  passengerRow:              { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  passengerAvatar:           { width: 40, height: 40, borderRadius: 20 },
  passengerAvatarPlaceholder:{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  passengerInfo:             { flex: 1 },
  passengerName:             { fontSize: 14, fontFamily: 'Sora_500Medium' },
  passengerSeats:            { fontSize: 12 },
  chatBtn:                   { width: 60, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // Footer
  footer:           { padding: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, gap: 4 },
  footerRow:        { flexDirection: 'row', gap: 10 },
  footerBtn:        { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  footerBtnText:    { fontSize: 15, fontFamily: 'Sora_700Bold' },
  footerBtnOutline: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  footerBtnOutlineText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  statusFooter:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12 },
  statusFooterText: { fontSize: 13, fontFamily: 'Sora_500Medium', flex: 1 },

  // Map button
  mapBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  mapBtnText: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium' },

  // Pending payment
  pendingWrap:      { marginBottom: 4 },
  pendingTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  pendingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingDot:       { width: 7, height: 7, borderRadius: 4 },
  pendingLabel:     { fontSize: 13, fontFamily: 'Sora_600SemiBold' },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent:  { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalTitle:    { fontSize: 16, fontFamily: 'Sora_700Bold', marginBottom: 16 },
  modalCancelBtn:{ marginTop: 8, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
});

export default TripRequestDetailScreen;

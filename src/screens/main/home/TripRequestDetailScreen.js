import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useColors } from '../../../hooks/useColors';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { get_withauth, buildImageUri } from '../../../services/apiService';
import { acceptTripRequestApplication } from '../../../services/tripRequestService';

const TripRequestDetailScreen = ({ route, navigation }) => {
  const { requestId, mode } = route.params || {};
  const isPassenger = mode === 'passenger';

  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const dark = isDarkMode;
  const bg = dark ? '#161616' : '#F9FAFB';
  const cardBg = dark ? '#1F1F1F' : '#FFFFFF';
  const border = dark ? '#333333' : '#E5E7EB';
  const textPrimary = dark ? '#FFFFFF' : '#1F2937';
  const textMuted = dark ? '#9CA3AF' : '#6B7280';
  const divider = dark ? '#2A2A2A' : '#F3F4F6';

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await get_withauth(`/trip-requests/${requestId}`);
      if (res.success) setRequest(res.data);
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [requestId]));


  const handleAccept = async (applicationId) => {
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
                  showAlert(
                    '¡Conductor aceptado!',
                    `El precio total es $${res.data?.totalAmount?.toLocaleString()}. Ahora procedé al pago para confirmar el viaje.`,
                    [
                      { text: 'Pagar ahora', onPress: () => Linking.openURL(paymentUrl) },
                      { text: 'Después', style: 'cancel' }
                    ]
                  );
                }
                load();
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

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={textMuted} />
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={{ color: textMuted }}>Solicitud no encontrada</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pendingApps = request.applications?.filter(a => a.status === 'pending') || [];
  const acceptedApp = request.applications?.find(a => a.status === 'accepted');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Route card */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.routeBlock}>
            <Ionicons name="radio-button-on" size={14} color="#22C55E" />
            <Text style={[styles.city, { color: textPrimary }]}>{request.origin.city}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeBlock}>
            <Ionicons name="location" size={14} color="#EF4444" />
            <Text style={[styles.city, { color: textPrimary }]}>{request.destination.city}</Text>
          </View>
          <View style={[styles.routeMeta, { borderTopColor: divider }]}>
            <Text style={[styles.metaText, { color: textMuted }]}>
              {formatDate(request.departureDate)} · {request.departureTime}
            </Text>
            <Text style={[styles.metaText, { color: textMuted }]}>
              {request.distanceKm} km · ${request.pricePerSeat?.toLocaleString()} / asiento
            </Text>
          </View>
        </View>

        {/* Awaiting payment */}
        {request.status === 'awaiting_payment' && request.paymentData?.paymentUrl && (
          <View style={[styles.card, { backgroundColor: '#FFF7ED', borderColor: '#F59E0B' }]}>
            <Text style={{ color: '#92400E', fontWeight: '700', fontSize: 14 }}>Pago pendiente</Text>
            <Text style={{ color: '#92400E', fontSize: 13 }}>
              Tu conductor está reservado. Completá el pago para confirmar el viaje.
            </Text>
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => Linking.openURL(request.paymentData.paymentUrl)}
            >
              <Text style={styles.payBtnText}>Ir al pago</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Paid */}
        {request.status === 'paid' && (
          <View style={[styles.card, { backgroundColor: '#F0FDF4', borderColor: '#22C55E' }]}>
            <Text style={{ color: '#15803D', fontWeight: '700', fontSize: 14 }}>¡Viaje confirmado!</Text>
            <Text style={{ color: '#15803D', fontSize: 13 }}>
              El pago fue procesado. El viaje aparece en la sección "Mis reservas".
            </Text>
          </View>
        )}

        {/* Applications (passenger view) */}
        {isPassenger && request.status === 'open' && (
          <View>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>
              Postulaciones ({request.applications?.length || 0}/5)
            </Text>

            {request.applications?.length === 0 ? (
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={{ color: textMuted, fontSize: 13, textAlign: 'center' }}>
                  Aún no hay conductores postulados. Te notificamos cuando lleguen.
                </Text>
              </View>
            ) : (
              request.applications.map((app) => (
                <View key={app._id} style={[styles.appCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <View style={styles.appHeader}>
                    {app.driverSnapshot?.avatar ? (
                      <Image
                        source={{ uri: buildImageUri(app.driverSnapshot.avatar) }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: divider }]}>
                        <Ionicons name="person" size={20} color={textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.driverName, { color: textPrimary }]}>
                        {app.driverSnapshot?.firstName} {app.driverSnapshot?.lastName}
                      </Text>
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={[styles.ratingText, { color: textMuted }]}>
                          {app.driverSnapshot?.rating?.toFixed(1) || '—'}
                        </Text>
                        {app.driverSnapshot?.verified && (
                          <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={12} color="#3B82F6" />
                            <Text style={{ color: '#3B82F6', fontSize: 10, fontWeight: '600' }}>Verificado</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {app.status === 'rejected' && (
                      <View style={[styles.statusTag, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '600' }}>Rechazado</Text>
                      </View>
                    )}
                  </View>

                  {/* Vehicle */}
                  {app.vehicleSnapshot && (
                    <View style={[styles.vehicleRow, { borderTopColor: divider }]}>
                      <Ionicons name="car-outline" size={14} color={textMuted} />
                      <Text style={[styles.vehicleText, { color: textMuted }]}>
                        {app.vehicleSnapshot.brand} {app.vehicleSnapshot.model} {app.vehicleSnapshot.year} · {app.vehicleSnapshot.color}
                      </Text>
                      {app.vehicleSnapshot.licensePlate && (
                        <Text style={[styles.plate, { color: textMuted, borderColor: border }]}>
                          {app.vehicleSnapshot.licensePlate}
                        </Text>
                      )}
                    </View>
                  )}

                  {app.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.acceptBtn, accepting === app._id && { opacity: 0.6 }]}
                      onPress={() => handleAccept(app._id)}
                      disabled={!!accepting}
                    >
                      {accepting === app._id ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.acceptBtnText}>Elegir este conductor</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* Accepted driver summary */}
        {acceptedApp && request.status !== 'open' && (
          <View>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Conductor seleccionado</Text>
            <View style={[styles.appCard, { backgroundColor: cardBg, borderColor: '#22C55E' }]}>
              <View style={styles.appHeader}>
                {acceptedApp.driverSnapshot?.avatar ? (
                  <Image
                    source={{ uri: buildImageUri(acceptedApp.driverSnapshot.avatar) }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: divider }]}>
                    <Ionicons name="person" size={20} color={textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.driverName, { color: textPrimary }]}>
                    {acceptedApp.driverSnapshot?.firstName} {acceptedApp.driverSnapshot?.lastName}
                  </Text>
                  {acceptedApp.vehicleSnapshot && (
                    <Text style={{ color: textMuted, fontSize: 12 }}>
                      {acceptedApp.vehicleSnapshot.brand} {acceptedApp.vehicleSnapshot.model} · {acceptedApp.vehicleSnapshot.licensePlate}
                    </Text>
                  )}
                </View>
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
              </View>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, gap: 14, paddingBottom: 32 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14 },
  routeBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeLine: { width: 1, height: 16, backgroundColor: '#E5E7EB', marginLeft: 7 },
  city: { fontSize: 16, fontWeight: '700', flex: 1 },
  routeMeta: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 4 },
  metaText: { fontSize: 13 },
  payBtn: { backgroundColor: '#F59E0B', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  payBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  appCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10, marginBottom: 10 },
  appHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  driverName: { fontSize: 14, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { fontSize: 12 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4 },
  statusTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, paddingTop: 8, flexWrap: 'wrap' },
  vehicleText: { fontSize: 12, flex: 1 },
  plate: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  acceptBtn: { backgroundColor: '#1F2937', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  acceptBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});

export default TripRequestDetailScreen;

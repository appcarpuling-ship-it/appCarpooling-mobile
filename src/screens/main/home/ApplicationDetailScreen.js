import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { buildImageUri } from '../../../services/apiService';
import { acceptTripRequestApplication } from '../../../services/tripRequestService';
import { confirmFromCallback } from '../../../services/seatReservationService';
import CheckoutWebView from '../../../components/payment/CheckoutWebView';
import { useUI } from '../../../theme/ui';

const ApplicationDetailScreen = ({ route, navigation }) => {
  const { app, requestId } = route.params;
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const dark = isDarkMode;
  const bg         = dark ? '#161616' : '#F9FAFB';
  const cardBg     = dark ? '#1F1F1F' : '#FFFFFF';
  const border     = dark ? '#333333' : '#E5E7EB';
  const textPrimary = dark ? '#FFFFFF' : '#1F2937';
  const textMuted   = dark ? '#9CA3AF' : '#6B7280';
  const divider     = dark ? '#2A2A2A' : '#F3F4F6';

  const ui = useUI();  const accent      = ui.invertBg;
  const accentInverse = ui.invertText;

  const [accepting, setAccepting] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState({ visible: false, paymentUrl: null });

  const driver = app.driverSnapshot || {};
  const vehicle = app.vehicleSnapshot || {};

  const handleAccept = () => {
    showAlert(
      'Aceptar conductor',
      'Al aceptar este conductor, los demás serán rechazados y se generará el pago.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            setAccepting(true);
            try {
              const res = await acceptTripRequestApplication(requestId, app._id);
              if (res.success) {
                const paymentUrl = res.data?.payment?.url;
                if (paymentUrl) {
                  setCheckoutModal({ visible: true, paymentUrl });
                } else {
                  navigation.goBack();
                }
              }
            } catch (err) {
              showAlert('Error', err.message);
            } finally {
              setAccepting(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Detalle del conductor</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Driver info */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.driverTop}>
            {driver.avatar ? (
              <Image source={{ uri: buildImageUri(driver.avatar) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: dark ? '#333' : '#E8E8E8' }]}>
                <Ionicons name="person" size={36} color={textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.driverName, { color: textPrimary }]}>
                {driver.firstName} {driver.lastName}
              </Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={[styles.ratingText, { color: textMuted }]}>
                  {driver.rating?.toFixed(1) || '—'}
                </Text>
                {driver.totalTrips != null && (
                  <Text style={[styles.ratingText, { color: textMuted }]}>
                    · {driver.totalTrips} viaje{driver.totalTrips !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>
              {driver.verified && (
                <View style={styles.verifiedRow}>
                  <Ionicons name="shield-checkmark" size={13} color="#22C55E" />
                  <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '600' }}>Verificado</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Vehicle info */}
        {Object.keys(vehicle).length > 0 && (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Vehículo</Text>
            {vehicle.photo ? (
              <Image source={{ uri: buildImageUri(vehicle.photo) }} style={styles.vehiclePhoto} />
            ) : null}
            <View style={styles.vehicleRow}>
              <Ionicons name="car-outline" size={20} color={textMuted} />
              <Text style={[styles.vehicleMain, { color: textPrimary }]}>
                {vehicle.brand} {vehicle.model} {vehicle.year}
              </Text>
            </View>
            <View style={[styles.dividerLine, { backgroundColor: divider }]} />
            {vehicle.color ? (
              <View style={styles.vehicleDetail}>
                <Text style={[styles.vehicleDetailLabel, { color: textMuted }]}>Color</Text>
                <Text style={[styles.vehicleDetailValue, { color: textPrimary }]}>{vehicle.color}</Text>
              </View>
            ) : null}
            {vehicle.licensePlate ? (
              <View style={styles.vehicleDetail}>
                <Text style={[styles.vehicleDetailLabel, { color: textMuted }]}>Patente</Text>
                <Text style={[styles.vehicleDetailValue, { color: textPrimary }]}>{vehicle.licensePlate}</Text>
              </View>
            ) : null}
            {vehicle.capacity != null ? (
              <View style={styles.vehicleDetail}>
                <Text style={[styles.vehicleDetailLabel, { color: textMuted }]}>Capacidad</Text>
                <Text style={[styles.vehicleDetailValue, { color: textPrimary }]}>
                  {vehicle.capacity} asiento{vehicle.capacity !== 1 ? 's' : ''}
                </Text>
              </View>
            ) : null}
            {vehicle.vehicleType ? (
              <View style={styles.vehicleDetail}>
                <Text style={[styles.vehicleDetailLabel, { color: textMuted }]}>Tipo</Text>
                <Text style={[styles.vehicleDetailValue, { color: textPrimary }]}>{vehicle.vehicleType}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Checkout WebView */}
      <CheckoutWebView
        visible={checkoutModal.visible}
        paymentUrl={checkoutModal.paymentUrl}
        onClose={() => { setCheckoutModal({ visible: false, paymentUrl: null }); navigation.goBack(); }}
        onPaymentSuccess={async ({ externalReference }) => {
          try {
            await confirmFromCallback(externalReference || requestId, 'approved');
          } catch (e) {
            console.warn('confirmFromCallback:', e?.message);
          }
          setCheckoutModal({ visible: false, paymentUrl: null });
          navigation.goBack();
        }}
        onPaymentError={() => { setCheckoutModal({ visible: false, paymentUrl: null }); }}
        reservationId={requestId}
      />

      {/* Footer CTA */}
      {app.status === 'pending' && (
        <View style={[styles.footer, { backgroundColor: bg, borderTopColor: border }]}>
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: accent }, accepting && { opacity: 0.6 }]}
            onPress={handleAccept}
            disabled={accepting}
          >
            {accepting
              ? <ActivityIndicator color={accentInverse} />
              : <Text style={[styles.acceptBtnText, { color: accentInverse }]}>Elegir este conductor</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {app.status === 'accepted' && (
        <View style={[styles.footer, { backgroundColor: bg, borderTopColor: border }]}>
          <View style={[styles.acceptedBadge, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text style={{ color: '#22C55E', fontWeight: '700', fontSize: 14 }}>Conductor seleccionado</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontFamily: 'Sora_700Bold' },
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  driverTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  driverName: { fontSize: 18, fontFamily: 'Sora_700Bold', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  sectionLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  vehiclePhoto: { width: '100%', height: 160, borderRadius: 10, marginBottom: 12 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  vehicleMain: { fontSize: 16, fontFamily: 'Sora_700Bold' },
  dividerLine: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  vehicleDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  vehicleDetailLabel: { fontSize: 13 },
  vehicleDetailValue: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  acceptBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  acceptBtnText: { fontSize: 15, fontFamily: 'Sora_700Bold' },
  acceptedBadge: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
});

export default ApplicationDetailScreen;

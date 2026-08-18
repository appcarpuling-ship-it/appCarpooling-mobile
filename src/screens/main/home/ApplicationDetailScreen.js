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
import Rating from '../../../components/ui/Rating';

/**
 * El recorrido completo del viaje, como lo va a hacer el conductor: sus puntas afuera y el
 * tramo del pasajero en el medio. Los puntos del conductor son opcionales —si no declaró
 * recorrido propio hace el mismo tramo—, y en ese caso se muestran sólo los dos del pasajero.
 */
const armarRecorrido = (app, tramo) => {
  if (!tramo?.origin || !tramo?.destination) return [];
  const dir = (p) => p?.address || p?.city;
  return [
    app.driverOrigin && { etiqueta: 'Sale desde', texto: dir(app.driverOrigin), delConductor: true },
    { etiqueta: 'Te levanta en', texto: dir(tramo.origin) },
    { etiqueta: 'Te deja en', texto: dir(tramo.destination) },
    app.driverDestination && { etiqueta: 'Sigue hasta', texto: dir(app.driverDestination), delConductor: true },
  ].filter((p) => p && p.texto);
};

const ApplicationDetailScreen = ({ route, navigation }) => {
  const { app, requestId, tramoPasajero } = route.params;
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const dark = isDarkMode;
  const ui = useUI();
  const bg         = ui.bg;
  const cardBg     = ui.surface;
  const border     = ui.border;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg;  const accent      = ui.invertBg;
  const accentInverse = ui.invertText;

  const [accepting, setAccepting] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState({ visible: false, paymentUrl: null });

  const driver = app.driverSnapshot || {};
  const vehicle = app.vehicleSnapshot || {};
  const recorrido = armarRecorrido(app, tramoPasajero);

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
              navigation.navigate('Result', { type: 'error', title: 'Ocurrió algo', message: err.message });
            } finally {
              setAccepting(false);
            }
          }
        }
      ]
    );
  };

  return (
    // 'top' además de 'bottom': el header de esta pantalla lo dibuja ella misma, no el
    // navegador, así que sin el inset de arriba quedaba metido dentro de la barra de estado.
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
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
                <Rating rating={driver.rating} count={driver.ratingCount} size={13} />
                {driver.totalTrips != null && (
                  <Text style={[styles.ratingText, { color: textMuted }]}>
                    · {driver.totalTrips} viaje{driver.totalTrips !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Recorrido: lo que el pasajero necesita para decidir si le sirve este conductor.
            Sin esto sólo veía el auto y la calificación, y no por dónde pasa. */}
        {recorrido.length > 0 && (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Recorrido</Text>
            {recorrido.map((punto, i) => (
              <View key={`${punto.etiqueta}-${i}`} style={styles.recorridoFila}>
                <View style={styles.recorridoLinea}>
                  <View style={[
                    styles.recorridoPunto,
                    { backgroundColor: punto.delConductor ? textMuted : accent },
                  ]} />
                  {i < recorrido.length - 1 && (
                    <View style={[styles.recorridoTramo, { backgroundColor: divider }]} />
                  )}
                </View>
                <View style={styles.recorridoTexto}>
                  <Text style={[styles.recorridoEtiqueta, { color: textMuted }]}>{punto.etiqueta}</Text>
                  <Text style={[styles.recorridoDireccion, { color: textPrimary }]}>{punto.texto}</Text>
                </View>
              </View>
            ))}
            <Text style={[styles.recorridoNota, { color: textMuted }]}>
              Pagás sólo tu tramo, desde donde subís hasta donde bajás.
            </Text>
          </View>
        )}

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
          navigation.navigate('Result', {
            type: 'success',
            title: 'Pago confirmado',
            message: 'Tu pago fue procesado correctamente.',
            onPrimary: () => navigation.goBack(),
          });
        }}
        onPaymentError={(error) => {
          setCheckoutModal({ visible: false, paymentUrl: null });
          navigation.navigate('Result', {
            type: 'error',
            title: 'No se pudo procesar el pago',
            message: error?.message || 'No se pudo procesar el pago.',
          });
        }}
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
          <View style={[styles.acceptedBadge, { backgroundColor: ui.invertBg }]}>
            <Ionicons name="checkmark-circle" size={16} color={ui.invertText} />
            <Text style={{ color: ui.invertText, fontWeight: '700', fontSize: 14 }}>Conductor seleccionado</Text>
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
  sectionLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  vehiclePhoto: { width: '100%', height: 160, borderRadius: 10, marginBottom: 12 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  vehicleMain: { fontSize: 16, fontFamily: 'Sora_700Bold' },
  dividerLine: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  vehicleDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  vehicleDetailLabel: { fontSize: 13 },
  vehicleDetailValue: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },
  // El punto del pasajero va en negro pleno y el del conductor en gris: de un vistazo se ve
  // cuál es "mi" tramo dentro del recorrido más largo.
  recorridoFila: { flexDirection: 'row', gap: 12 },
  recorridoLinea: { alignItems: 'center', width: 10 },
  recorridoPunto: { width: 9, height: 9, borderRadius: 999, marginTop: 5 },
  recorridoTramo: { width: StyleSheet.hairlineWidth, flex: 1, minHeight: 22 },
  recorridoTexto: { flex: 1, paddingBottom: 14 },
  recorridoEtiqueta: { fontSize: 11, fontFamily: 'Sora_500Medium', marginBottom: 2 },
  recorridoDireccion: { fontSize: 14, fontFamily: 'Sora_600SemiBold', lineHeight: 19 },
  recorridoNota: { fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 17 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  acceptBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  acceptBtnText: { fontSize: 15, fontFamily: 'Sora_700Bold' },
  acceptedBadge: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
});

export default ApplicationDetailScreen;

import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView,
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
import PillButton from '../../../components/ui/PillButton';

/**
 * El recorrido completo del viaje, como lo va a hacer el conductor: sus puntas afuera y el
 * tramo del pasajero en el medio. Los puntos del conductor son opcionales —si no declaró
 * recorrido propio hace el mismo tramo—, y en ese caso se muestran sólo los dos del pasajero.
 */
// Dirección (línea principal) + ciudad/provincia (línea chica), cuando no son lo mismo.
// Antes era sólo `address || city`: las puntas del conductor tienen una dirección de calle
// sin ciudad al lado, y quedaban sin poder saber en qué ciudad caían.
const dir = (p) => {
  const principal = p?.address || p?.city || '';
  const ciudad = [p?.city, p?.province].filter(Boolean).join(', ');
  return { texto: principal, ciudad: ciudad && ciudad !== principal ? ciudad : '' };
};

const armarRecorrido = (app, tramo) => {
  if (!tramo?.origin || !tramo?.destination) return [];
  // Las paradas que puso el pasajero al publicar la solicitud van entre sus dos puntas.
  // Antes se ignoraban y su viaje se mostraba como si fuera directo.
  const paradas = (tramo.intermediateStops || [])
    .map((stop, i) => ({ etiqueta: `Parada ${i + 1}`, ...dir(stop) }));
  return [
    app.driverOrigin && { etiqueta: 'Sale desde', ...dir(app.driverOrigin), delConductor: true },
    // Paradas del recorrido del conductor: van antes de que suba el pasajero sólo como
    // orden de lectura; en el mapa la posición real la resuelve la geografía.
    ...(app.driverStops || []).map((p) => ({ etiqueta: 'Pasa por', ...dir(p), delConductor: true })),
    { etiqueta: 'Te subís en', ...dir(tramo.origin) },
    ...paradas,
    { etiqueta: 'Te deja en', ...dir(tramo.destination) },
    app.driverDestination && { etiqueta: 'Sigue hasta', ...dir(app.driverDestination), delConductor: true },
  ].filter((p) => p && p.texto);
};

/**
 * Qué contestó el conductor cuando se postuló: mismo tramo, o recorrido propio.
 *
 * Sin esto, el que hace el mismo tramo se veía EXACTAMENTE igual que si no hubiéramos
 * preguntado nada: dos puntos y listo. El pasajero no podía distinguir "este conductor hace
 * justo tu viaje" de "no sabemos por dónde va", que es la diferencia que la pregunta vino a
 * responder.
 */
const recorridoElegido = (app) =>
  app.driverOrigin || app.driverDestination || (app.driverStops || []).length > 0
    ? { texto: 'Viene de más lejos o sigue más allá', icono: 'git-branch-outline' }
    : { texto: 'Hace tu mismo tramo', icono: 'swap-horizontal-outline' };

/**
 * Mismo recorrido que `armarRecorrido`, pero con la forma de `trip` que espera TripMapScreen:
 * origen/destino son las puntas más lejanas (las del conductor, si declaró recorrido propio) y
 * el tramo del pasajero —y las paradas que él haya puesto— quedan como paradas intermedias.
 */
const armarTripParaMapa = (app, tramo, driver, vehicle) => {
  if (!tramo?.origin || !tramo?.destination) return null;
  const intermediateStops = [];
  if (app.driverOrigin) intermediateStops.push({ ...tramo.origin, kind: 'pickup', order: 0 });
  // Las paradas propias del pasajero también son puntos del recorrido: sin ellas el mapa
  // trazaba derecho entre sus dos puntas y se salteaba el desvío que él mismo pidió.
  (tramo.intermediateStops || []).forEach((stop, i) => {
    intermediateStops.push({ ...stop, kind: 'stop', order: 1 + i });
  });
  if (app.driverDestination) {
    intermediateStops.push({ ...tramo.destination, kind: 'dropoff', order: 1 + (tramo.intermediateStops || []).length });
  }
  // Las paradas propias del conductor. Sin `passenger`: son escalas de su recorrido.
  (app.driverStops || []).forEach((stop, i) => {
    intermediateStops.push({ ...stop, kind: 'stop', order: 100 + i });
  });
  return {
    origin: app.driverOrigin || tramo.origin,
    destination: app.driverDestination || tramo.destination,
    intermediateStops,
    driver,
    vehicle,
  };
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

  const [accepting, setAccepting] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState({ visible: false, paymentUrl: null });

  const driver = app.driverSnapshot || {};
  const vehicle = app.vehicleSnapshot || {};
  const recorrido = armarRecorrido(app, tramoPasajero);
  const eleccion = recorridoElegido(app);
  const tripParaMapa = armarTripParaMapa(app, tramoPasajero, driver, vehicle);

  // Las fotos: la principal es `photo`, y `photos` puede repetirla. Se deduplica para no
  // mostrar la misma imagen dos veces, y se corta en 3 secundarias.
  const todasLasFotos = [vehicle.photo, ...(vehicle.photos || [])].filter(Boolean);
  const fotosUnicas = [...new Set(todasLasFotos)];
  const fotoPrincipal = fotosUnicas[0] || null;
  const fotosSecundarias = fotosUnicas.slice(1, 4);

  // Sólo las que están en true. Las postulaciones viejas no traen `features` en el snapshot.
  const chipsVehiculo = [
    { key: 'ac', label: 'Aire', icon: 'snow-outline' },
    { key: 'music', label: 'Música', icon: 'musical-notes-outline' },
    { key: 'luggage', label: 'Equipaje', icon: 'bag-outline' },
    { key: 'pets', label: 'Mascotas', icon: 'paw-outline' },
    { key: 'smoking', label: 'Se puede fumar', icon: 'flame-outline' },
  ].filter((c) => vehicle.features?.[c.key]);

  const handleAccept = () => {
    navigation.navigate('Confirm', {
      title: 'Aceptar conductor',
      message: 'Al aceptar este conductor, los demás serán rechazados y se generará el pago.',
      confirmLabel: 'Aceptar',
      onConfirm: async () => {
        setAccepting(true);
        try {
          const res = await acceptTripRequestApplication(requestId, app._id);
          if (!res.success) throw new Error(res.message || 'No se pudo aceptar');

          // El pasajero ya no paga por la app: le paga directo al conductor. `paymentUrl`
          // se sigue contemplando solo para las solicitudes viejas que quedaron con un
          // checkout abierto de antes del cambio — ahí hay que abrir el modal en vez de
          // mostrar Result. El goBack que saca el Confirm de encima lo hace ConfirmScreen
          // solo con skipResult, no hace falta pedirlo acá también.
          const paymentUrl = res.data?.payment?.url;
          if (paymentUrl) {
            setCheckoutModal({ visible: true, paymentUrl });
            return { skipResult: true };
          }
          const total = res.data?.totalAmount;
          return {
            title: '¡Viaje confirmado!',
            message: total > 0
              ? `Ya tenés tu lugar. Le pagás $${Number(total).toLocaleString('es-AR')} directamente al conductor, no por la app.`
              : 'Ya tenés tu lugar. Coordiná los gastos del viaje directamente con el conductor.',
            primaryLabel: 'Listo',
          };
        } finally {
          setAccepting(false);
        }
      },
      errorParams: { title: 'Ocurrió algo' },
    });
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

        {/* Su precio: es lo que el pasajero está comparando entre las propuestas, así que va
            arriba de todo lo demás. Se le paga al conductor al llegar, aparte de la conexión
            que cobra la app. */}
        {app.driverPrice > 0 && (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            {/* "por asiento" pasa al rótulo al sacar la aclaración de abajo: sin eso, $30.000
                puede leerse como el total de la reserva y no como el precio de cada lugar. */}
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Su precio por asiento</Text>
            <Text style={{ color: textPrimary, fontSize: 30, fontFamily: 'Sora_800ExtraBold', letterSpacing: -1 }}>
              ${Number(app.driverPrice).toLocaleString('es-AR')}
            </Text>
          </View>
        )}

        {/* Recorrido: lo que el pasajero necesita para decidir si le sirve este conductor.
            Sin esto sólo veía el auto y la calificación, y no por dónde pasa. */}
        {recorrido.length > 0 && (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Recorrido</Text>

            {/* Qué eligió al postularse. Va arriba de los puntos porque es el encuadre: sin
                esto, "hace tu mismo tramo" y "no declaró nada" se ven idénticos. */}
            <View style={styles.recorridoElegido}>
              <Ionicons name={eleccion.icono} size={15} color={textPrimary} />
              <Text style={[styles.recorridoElegidoText, { color: textPrimary }]}>{eleccion.texto}</Text>
            </View>

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
                  {!!punto.ciudad && (
                    <Text style={[styles.recorridoCiudad, { color: textMuted }]}>{punto.ciudad}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Ver trayecto en mapa: mismas direcciones de arriba, ahora en el mapa. */}
        {tripParaMapa?.origin?.coordinates?.latitude && (
          <TouchableOpacity
            style={[styles.card, styles.mapCard, { backgroundColor: cardBg, borderColor: border }]}
            onPress={() => navigation.navigate('TripMap', { trip: tripParaMapa })}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={18} color={textPrimary} />
            <Text style={[styles.mapBtnText, { color: textPrimary }]}>Ver trayecto en mapa</Text>
            <Ionicons name="chevron-forward" size={16} color={textMuted} />
          </TouchableOpacity>
        )}

        {/* Vehicle info */}
        {Object.keys(vehicle).length > 0 && (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Vehículo</Text>

            {/* La principal grande y hasta 3 más en fila abajo. El tope es a propósito: con seis
                fotos la ficha se volvía un scroll de fotos y tapaba los datos del auto. */}
            {fotoPrincipal ? (
              <Image source={{ uri: buildImageUri(fotoPrincipal) }} style={styles.vehiclePhoto} />
            ) : null}
            {fotosSecundarias.length > 0 && (
              <View style={styles.fotosFila}>
                {fotosSecundarias.map((f) => (
                  <Image key={f} source={{ uri: buildImageUri(f) }} style={styles.fotoChica} />
                ))}
              </View>
            )}

            {/* Las características van con la foto y no sueltas: son parte de "cómo es el auto".
                Las postulaciones viejas no las traen en el snapshot, y ahí no se muestra nada. */}
            {chipsVehiculo.length > 0 && (
              <View style={styles.featuresRow}>
                {chipsVehiculo.map((c) => (
                  <View key={c.label} style={[styles.featureChip, { backgroundColor: bg }]}>
                    <Ionicons name={c.icon} size={14} color={textPrimary} />
                    <Text style={[styles.featureChipText, { color: textPrimary }]}>{c.label}</Text>
                  </View>
                ))}
              </View>
            )}

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
            {/* Sin "Tipo": mostraba `vehicle.vehicleType` crudo, o sea la clave interna del
                modelo ("sedan", "hatchback"), que en ningún otro lado de la app se ve — el
                formulario las agrupa y las muestra como "Auto" / "Camioneta". Y para elegir
                conductor no aporta nada que marca, modelo y capacidad no digan ya. */}
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
          <PillButton label="Elegir este conductor" onPress={handleAccept} loading={accepting} />
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
  mapCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mapBtnText: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium' },
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
  recorridoElegido: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  recorridoElegidoText: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },

  fotosFila: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  fotoChica: { flex: 1, height: 64, borderRadius: 10, backgroundColor: '#00000010' },

  featuresRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  featureChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  featureChipText: { fontSize: 12, fontFamily: 'Sora_500Medium' },

  recorridoFila: { flexDirection: 'row', gap: 12 },
  recorridoLinea: { alignItems: 'center', width: 10 },
  recorridoPunto: { width: 9, height: 9, borderRadius: 999, marginTop: 5 },
  recorridoTramo: { width: StyleSheet.hairlineWidth, flex: 1, minHeight: 22 },
  recorridoTexto: { flex: 1, paddingBottom: 14 },
  recorridoEtiqueta: { fontSize: 11, fontFamily: 'Sora_500Medium', marginBottom: 2 },
  recorridoDireccion: { fontSize: 14, fontFamily: 'Sora_600SemiBold', lineHeight: 19 },
  recorridoCiudad: { fontSize: 12, fontFamily: 'Sora_400Regular', marginTop: 1 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  acceptedBadge: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
});

export default ApplicationDetailScreen;

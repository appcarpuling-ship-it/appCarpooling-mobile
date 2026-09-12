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
import { armarRecorrido, recorridoElegido, armarTripParaMapa, ofertaDelConductor } from '../../../utils/postulacionTrip';
import { collectVehiclePhotoPaths } from '../../../utils/vehiclePhotos';
import VehicleDetailModal from '../../../components/vehicle/VehicleDetailModal';

const ApplicationDetailScreen = ({ route, navigation }) => {
  const { app, requestId, tramoPasajero, seatsNeeded = 1 } = route.params;
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const dark = isDarkMode;
  const ui = useUI();
  const bg         = ui.bg;
  const border     = ui.border;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg;  const accent      = ui.invertBg;

  const [accepting, setAccepting] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState({ visible: false, paymentUrl: null });
  const [recorridoAbierto, setRecorridoAbierto] = useState(false);
  const [vehiculoModalVisible, setVehiculoModalVisible] = useState(false);

  const driver = app.driverSnapshot || {};
  const vehicle = app.vehicleSnapshot || {};
  const recorrido = armarRecorrido(app, tramoPasajero);
  const eleccion = recorridoElegido(app, tramoPasajero);
  const oferta = ofertaDelConductor(app, seatsNeeded);
  const tripParaMapa = armarTripParaMapa(app, tramoPasajero, driver, vehicle);

  // Apilado por defecto, igual que en el detalle del viaje: con paradas la lista completa
  // empujaba el vehículo y el botón de elegir conductor fuera de la primera pantalla.
  const cantidadParadas = Math.max(0, recorrido.length - 2);
  const hayParadasIntermedias = cantidadParadas > 0;
  const recorridoVisible = recorridoAbierto || !hayParadasIntermedias
    ? recorrido
    : [recorrido[0], recorrido[recorrido.length - 1]];

  // Fotos del vehículo, para la tira chica: el resto (color, patente, características) vive
  // en el modal, no acá.
  const fotosVehiculo = collectVehiclePhotoPaths(vehicle);

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

          // Con seña, el lugar NO queda confirmado acá: falta que la transfieras. Decir
          // "¡Viaje confirmado!" en ese caso sería mentirle al pasajero sobre su propia
          // reserva. Ver Trip.requiereSena / Booking.sena en el backend.
          if (res.data?.requiereSena) {
            return {
              title: 'Elegiste a tu conductor',
              message: oferta?.sena
                ? `Transferile la seña de ${oferta.sena} para confirmar tu lugar.`
                : 'Transferile la seña para confirmar tu lugar.',
              primaryLabel: 'Ir a pagar la seña',
              // ApplicationDetailScreen vive en el stack raíz, no en el de un tab: PagarSena
              // está adentro de CarpoolingsTab, así que hay que resolverlo anidado (mismo
              // patrón que notificationNavigation.js) — un 'navigate' plano no la encuentra.
              onPrimary: () => navigation.navigate('Main', {
                screen: 'CarpoolingsTab',
                params: {
                  screen: 'PagarSena',
                  params: { bookingId: res.data.bookingId, tripId: res.data.tripId },
                  initial: false,
                },
              }),
            };
          }

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
        <View style={[styles.card]}>
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
        {/* Con gastos compartidos esta card no se mostraba (pedía driverPrice > 0), así que una
            postulación aparecía en la lista con su modalidad y al abrirla no decía nada: el
            pasajero no tenía forma de saber qué le habían ofrecido. */}
        {oferta && (
          <View style={[styles.card]}>
            {/* "por asiento" pasa al rótulo al sacar la aclaración de abajo: sin eso, $30.000
                puede leerse como el total de la reserva y no como el precio de cada lugar. */}
            <Text style={[styles.sectionLabel, { color: textMuted }]}>{oferta.etiqueta}</Text>
            <Text style={{
              color: textPrimary,
              fontSize: oferta.esPrecio ? 30 : 20,
              fontFamily: 'Sora_800ExtraBold',
              letterSpacing: -1,
            }}>
              {oferta.texto}
            </Text>
            {!oferta.esPrecio && (
              <Text style={{ color: textMuted, fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 17, marginTop: 4 }}>
                {oferta.detalle}
              </Text>
            )}
            {/* Si este conductor pide seña, va acá pegado al precio: es plata que hay que
                adelantar y es parte de lo que se compara entre las propuestas. */}
            {oferta.sena ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <Ionicons name="shield-checkmark-outline" size={15} color={textMuted} />
                <Text style={{ color: textMuted, fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 17, flex: 1 }}>
                  Pide {oferta.sena} de seña por adelantado para reservar.
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Recorrido: lo que el pasajero necesita para decidir si le sirve este conductor.
            Sin esto sólo veía el auto y la calificación, y no por dónde pasa. Apilado por
            defecto, igual que en el detalle del viaje: con paradas la lista completa
            empujaba el vehículo y el botón de elegir conductor fuera de la primera pantalla. */}
        {recorrido.length > 0 && (
          <View style={[styles.card]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>Recorrido</Text>

            {/* Qué eligió al postularse. Va arriba de los puntos porque es el encuadre: sin
                esto, "hace tu mismo tramo" y "no declaró nada" se ven idénticos. */}
            <View style={styles.recorridoElegido}>
              <Ionicons name={eleccion.icono} size={15} color={textPrimary} />
              <Text style={[styles.recorridoElegidoText, { color: textPrimary }]}>{eleccion.texto}</Text>
            </View>

            {hayParadasIntermedias && (
              <TouchableOpacity
                style={styles.paradasToggle}
                onPress={() => setRecorridoAbierto((v) => !v)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: recorridoAbierto }}
                accessibilityLabel={recorridoAbierto ? 'Ocultar paradas intermedias' : 'Ver paradas intermedias'}
              >
                <Text style={[styles.paradasToggleText, { color: textMuted }]}>
                  {recorridoAbierto ? 'Ocultar paradas' : `${cantidadParadas} parada${cantidadParadas !== 1 ? 's' : ''} en el camino`}
                </Text>
                <Ionicons name={recorridoAbierto ? 'chevron-up' : 'chevron-down'} size={16} color={textMuted} />
              </TouchableOpacity>
            )}

            {recorridoVisible.map((punto, i) => (
              <View key={`${punto.etiqueta}-${i}`} style={styles.recorridoFila}>
                <View style={styles.recorridoLinea}>
                  <View style={[
                    styles.recorridoPunto,
                    { backgroundColor: punto.delConductor ? textMuted : accent },
                  ]} />
                  {i < recorridoVisible.length - 1 && (
                    <View style={[styles.recorridoTramo, { backgroundColor: divider }]}>
                      {/* Los puntitos también abren las paradas: misma acción que la
                          flechita de arriba, por si a alguien se le ocurre tocar acá. */}
                      {!recorridoAbierto && hayParadasIntermedias && (
                        <TouchableOpacity
                          style={[styles.railPuntos, { backgroundColor: bg }]}
                          onPress={() => setRecorridoAbierto((v) => !v)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          activeOpacity={0.6}
                          accessibilityRole="button"
                          accessibilityLabel="Ver paradas intermedias"
                        >
                          <Ionicons name="ellipsis-vertical" size={13} color={textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>
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
            style={styles.mapCard}
            onPress={() => navigation.navigate('TripMap', { trip: tripParaMapa })}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={18} color={textPrimary} />
            <Text style={[styles.mapBtnText, { color: textPrimary }]}>Ver trayecto en mapa</Text>
            <Ionicons name="chevron-forward" size={16} color={textMuted} />
          </TouchableOpacity>
        )}

        {/* Vehículo — nombre + fotos, y la flecha abre un modal con el resto (color, patente,
            capacidad, características). Antes todo eso estaba acá y alargaba la pantalla con
            datos que casi nadie mira antes de elegir conductor. Mismo patrón compacto que usa
            TripDetailScreen para el vehículo del viaje ya confirmado. */}
        {Object.keys(vehicle).length > 0 && (
          <View style={[styles.card]}>
            <TouchableOpacity
              style={styles.vehicleHeaderRow}
              onPress={() => setVehiculoModalVisible(true)}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Ver todos los detalles del vehículo"
            >
              <Text style={[styles.sectionLabel, { color: textMuted, marginBottom: 0 }]}>Vehículo</Text>
              <Ionicons name="chevron-forward" size={18} color={textMuted} />
            </TouchableOpacity>

            <View style={styles.vehicleNameRow}>
              <Text style={[styles.vehicleMain, { color: textPrimary }]}>
                {vehicle.brand} {vehicle.model}{vehicle.year ? ` (${vehicle.year})` : ''}
              </Text>
            </View>

            {fotosVehiculo.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.fotosFila, { marginTop: 12 }]}
              >
                {fotosVehiculo.map((f) => (
                  <Image key={f} source={{ uri: buildImageUri(f) }} style={styles.fotoChica} />
                ))}
              </ScrollView>
            ) : null}
          </View>
        )}
      </ScrollView>

      <VehicleDetailModal
        visible={vehiculoModalVisible}
        vehicle={vehicle}
        onClose={() => setVehiculoModalVisible(false)}
      />

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
        <View style={[styles.footer, { backgroundColor: bg, borderTopWidth: 0 }]}>
          <PillButton label="Elegir este conductor" onPress={handleAccept} loading={accepting} />
        </View>
      )}

      {app.status === 'accepted' && (
        <View style={[styles.footer, { backgroundColor: bg, borderTopWidth: 0 }]}>
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
  // Misma dirección validada en TripDetailScreen/TripRequestDetailScreen (2026-09-01):
  // sin tarjetas con fondo+borde apiladas, separadas por espacio en vez de caja.
  content: { padding: 16 },
  card: { marginBottom: 32 },
  // "Ver trayecto en mapa" es un link, no una tarjeta de info — fila simple, sin caja.
  mapCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, paddingVertical: 4 },
  mapBtnText: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium' },
  driverTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  driverName: { fontSize: 18, fontFamily: 'Sora_700Bold', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13 },
  sectionLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  // Vehículo: nombre + fotos, compacto — el resto vive en VehicleDetailModal.
  vehicleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vehicleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  vehicleMain: { fontSize: 16, fontFamily: 'Sora_700Bold' },
  // El punto del pasajero va en negro pleno y el del conductor en gris: de un vistazo se ve
  // cuál es "mi" tramo dentro del recorrido más largo.
  recorridoElegido: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  recorridoElegidoText: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },
  // Mismo toggle que TripDetailScreen para apilar paradas intermedias.
  paradasToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  paradasToggleText: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },

  fotosFila: { flexDirection: 'row', gap: 8 },
  fotoChica: { width: 110, height: 74, borderRadius: 10, backgroundColor: '#00000010' },

  recorridoFila: { flexDirection: 'row', gap: 12 },
  recorridoLinea: { alignItems: 'center', width: 10 },
  recorridoPunto: { width: 9, height: 9, borderRadius: 999, marginTop: 5 },
  recorridoTramo: { width: StyleSheet.hairlineWidth, flex: 1, minHeight: 22 },
  // Los puntitos se centran sobre la línea desbordando a los lados (left negativo y ancho
  // fijo); el fondo de la pantalla los recorta contra la línea, mismo truco que en
  // TripDetailScreen.
  railPuntos: {
    position: 'absolute', top: '50%', marginTop: -11, left: -6.25,
    width: 14, alignItems: 'center', paddingVertical: 3,
  },
  recorridoTexto: { flex: 1, paddingBottom: 14 },
  recorridoEtiqueta: { fontSize: 11, fontFamily: 'Sora_500Medium', marginBottom: 2 },
  recorridoDireccion: { fontSize: 14, fontFamily: 'Sora_600SemiBold', lineHeight: 19 },
  recorridoCiudad: { fontSize: 12, fontFamily: 'Sora_400Regular', marginTop: 1 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  acceptedBadge: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
});

export default ApplicationDetailScreen;

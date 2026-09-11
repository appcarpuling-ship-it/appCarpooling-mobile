import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useUI } from '../../../theme/ui';
import { useAlert } from '../../../context/AlertContext';
import { get_withauth, put_withauth_formdata, buildImageUri } from '../../../services/apiService';
import { appendFile } from '../../../utils/formDataFile';
import { useElegirFoto } from '../../../hooks/useElegirFoto';
import { montoSena } from '../../../utils/sena';
import { reportError } from '../../../utils/sentry';
import PillButton from '../../../components/ui/PillButton';

/**
 * "Tu reserva": el detalle completo de la reserva del pasajero — asientos, dónde sube y baja,
 * qué le paga al conductor y, si el viaje pide seña, cuánto es, a dónde la transfiere y el
 * comprobante que mandó.
 *
 * Se entra desde la sección "Tu reserva" del detalle del viaje y desde "Mis reservas".
 *
 *   navigation.navigate('PagarSena', { bookingId, tripId })   // el nombre de ruta quedó de
 *                                                              // cuando era sólo la seña
 *
 * Los datos de cobro NO vienen con la reserva: los adjunta `getTripById` (`driverDatosCobro`),
 * y sólo a un pasajero de un viaje que pida seña. Por eso se pide el viaje aparte.
 */
const fmtFecha = (d) =>
  new Date(d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

const PagarSenaScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const elegirFoto = useElegirFoto();
  const { bookingId, tripId } = route.params || {};

  const [booking, setBooking] = useState(null);
  const [trip, setTrip] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [b, t] = await Promise.all([
        get_withauth(`/bookings/${bookingId}`),
        get_withauth(`/trips/${tripId}`),
      ]);
      if (b?.success) setBooking(b.data);
      if (t?.success) setTrip(t.data);
    } catch (e) {
      reportError(e, { screen: 'ReservaDetalle', action: 'cargar' });
    } finally {
      setCargando(false);
    }
  }, [bookingId, tripId]);

  // Al entrar y al volver de la cámara: el conductor pudo confirmar mientras tanto.
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  useEffect(() => {
    navigation.setOptions({ title: 'Tu reserva' });
  }, [navigation]);

  const copiar = async (que, valor) => {
    if (!valor) return;
    await Clipboard.setStringAsync(String(valor));
    showAlert('Copiado', `${que} copiado al portapapeles`);
  };

  const mandarComprobante = () => {
    elegirFoto(async (uri) => {
      setErrorEnvio('');
      setSubiendo(true);
      try {
        const fd = new FormData();
        await appendFile(fd, 'comprobante', uri, 'comprobante.jpg');
        const res = await put_withauth_formdata(`/bookings/${bookingId}/sena`, fd);
        if (!res?.success) throw new Error(res?.message || 'No se pudo enviar el comprobante');
        // Sin alert: el estado de la seña de abajo pasa solo a "enviada" y avisa lo mismo.
        setBooking((b) => (b ? { ...b, sena: res.data } : b));
      } catch (e) {
        reportError(e, { screen: 'ReservaDetalle', action: 'mandarComprobante' });
        setErrorEnvio('No pudimos enviar el comprobante. Probá de nuevo.');
      } finally {
        setSubiendo(false);
      }
    // Directo a la galería: el comprobante casi siempre es una captura de la app del banco,
    // no algo que se fotografía en el momento. Un paso menos que elegir "Galería" en un menú.
    }, { soloGaleria: true });
  };

  if (cargando) {
    return (
      <View style={[styles.centro, { backgroundColor: ui.bg }]}>
        <ActivityIndicator size="small" color={ui.textMuted} />
      </View>
    );
  }
  if (!booking || !trip) {
    return (
      <View style={[styles.centro, { backgroundColor: ui.bg }]}>
        <Text style={{ color: ui.textMuted }}>No encontramos la reserva.</Text>
      </View>
    );
  }

  const asientos = booking.seatsBooked || booking.seats || 1;
  const estado = booking.sena?.estado;
  const yaConfirmada = estado === 'confirmada';
  const pideSena = trip.requiereSena || !!estado;
  // Con el viaje ya en curso no tiene sentido seguir pidiendo o mostrando a dónde transferir:
  // el lugar ya se resolvió con o sin la seña. Se arregla hablando con el conductor.
  const viajeEnCurso = trip.status === 'started';
  const monto = montoSena(trip.driverPrice, asientos);
  const cobro = trip.driverDatosCobro;
  const vence = booking.sena?.venceAt ? new Date(booking.sena.venceAt) : null;
  const enviada = booking.sena?.enviadaAt ? new Date(booking.sena.enviadaAt) : null;
  const alConductor = (Number(trip.driverPrice) || 0) * asientos;

  // Si la reserva nació de una solicitud (postulación) no hay seatReservation — sus puntos
  // quedaron como paradas del viaje, no acá. Sin este respaldo, a un pasajero que SÍ eligió
  // dónde subir y bajar se le decía "no elegiste puntos", cuando sí lo hizo.
  const paradaPropia = (kind) => trip.intermediateStops?.find(
    (s) => s.kind === kind && String(s.passenger?._id || s.passenger) === String(booking.passenger?._id || booking.passenger),
  );
  const sube = booking.seatReservation?.pickupLocation?.address || paradaPropia('pickup')?.address;
  const baja = booking.seatReservation?.dropoffLocation?.address || paradaPropia('dropoff')?.address;

  const senaTexto = {
    esperando: { icon: 'hourglass-outline', color: ui.textMuted, t: 'Falta que mandes la seña' },
    enviada: { icon: 'time-outline', color: ui.textMuted, t: 'Comprobante enviado — falta que el conductor lo confirme' },
    confirmada: { icon: 'checkmark-circle-outline', color: '#10B981', t: 'El conductor confirmó que recibió la seña' },
  }[estado];

  const filaCopiable = (rotulo, valor) => (
    <TouchableOpacity
      style={[styles.dato, { borderBottomColor: ui.border }]}
      onPress={() => copiar(rotulo, valor)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Copiar ${rotulo}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.datoRotulo, { color: ui.textMuted }]}>{rotulo}</Text>
        <Text style={[styles.datoValor, { color: ui.text }]}>{valor}</Text>
      </View>
      <Ionicons name="copy-outline" size={18} color={ui.textMuted} />
    </TouchableOpacity>
  );

  const punto = (rotulo, dir) =>
    !!dir && (
      <View style={styles.punto}>
        <Text style={[styles.puntoRotulo, { color: ui.textMuted }]}>{rotulo}</Text>
        <Text style={[styles.puntoDir, { color: ui.text }]}>{dir}</Text>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: ui.bg }}>
    <ScrollView
      style={{ backgroundColor: ui.bg }}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
    >
      {/* Viaje */}
      <View style={[styles.bloque, { borderBottomColor: ui.border }]}>
        <Text style={[styles.ruta, { color: ui.text }]}>
          {trip.origin?.city} → {trip.destination?.city}
        </Text>
        <Text style={[styles.sub, { color: ui.textMuted }]}>
          {fmtFecha(trip.departureDate)}{trip.departureTime ? ` · ${trip.departureTime}` : ''}
        </Text>
        {!!trip.driver?.firstName && (
          <Text style={[styles.sub, { color: ui.textMuted }]}>
            Conductor: {trip.driver.firstName} {trip.driver.lastName || ''}
          </Text>
        )}
      </View>

      {/* Asientos + puntos */}
      <View style={[styles.bloque, { borderBottomColor: ui.border }]}>
        <Text style={[styles.rotuloSeccion, { color: ui.textMuted }]}>TU LUGAR</Text>
        <Text style={[styles.linea, { color: ui.text }]}>
          {asientos} asiento{asientos !== 1 ? 's' : ''}
        </Text>
        {punto('Te recogen en', sube)}
        {punto('Te dejan en', baja)}
        {!sube && !baja && (
          <Text style={[styles.nota, { color: ui.textMuted }]}>
            No elegiste puntos de subida y bajada: coordinás con el conductor.
          </Text>
        )}
      </View>

      {/* Qué paga */}
      <View style={[styles.bloque, { borderBottomColor: ui.border }]}>
        <Text style={[styles.rotuloSeccion, { color: ui.textMuted }]}>PAGO</Text>
        {trip.sinPrecioFijo ? (
          <Text style={[styles.linea, { color: ui.text }]}>
            Gastos compartidos — los arreglás directo con el conductor
          </Text>
        ) : (
          <>
            <View style={styles.pagoRow}>
              <Text style={[styles.linea, { color: ui.text }]}>Le pagás al conductor</Text>
              <Text style={[styles.montoInline, { color: ui.text }]}>
                ${alConductor.toLocaleString('es-AR')}
              </Text>
            </View>
            <Text style={[styles.nota, { color: ui.textMuted }]}>
              {pideSena && monto > 0
                ? `Seña de $${monto.toLocaleString('es-AR')} por adelantado, el resto ($${(alConductor - monto).toLocaleString('es-AR')}) al subir.`
                : 'Se lo pagás directo a él al subir, no por la app.'}
            </Text>
          </>
        )}
      </View>

      {/* Seña — es el último bloque de la pantalla: sin borderBottomColor, styles.bloque
          dibujaba su hairlineWidth en negro (el default de RN sin color propio) justo abajo
          del botón. Sin borde: no hace falta separar de nada, no hay nada después. */}
      {pideSena && (
        <View style={[styles.bloque, { borderBottomWidth: 0, marginBottom: 0 }]}>
          <Text style={[styles.rotuloSeccion, { color: ui.textMuted }]}>SEÑA</Text>

          {!!senaTexto && (
            <View style={styles.senaEstado}>
              <Ionicons name={senaTexto.icon} size={17} color={senaTexto.color} />
              <Text style={[styles.senaEstadoText, { color: ui.text }]}>{senaTexto.t}</Text>
            </View>
          )}

          {estado === 'esperando' && viajeEnCurso ? (
            // El viaje ya salió: ni transferir ni mandar comprobante tiene sentido ya —
            // el lugar se resolvió con o sin la seña. Se arregla hablando con el conductor.
            <Text style={[styles.nota, { color: ui.textMuted }]}>
              El viaje ya salió sin que llegaras a mandar la seña.
            </Text>
          ) : (
            <>
              {estado === 'esperando' && !!vence && (
                <Text style={[styles.nota, { color: ui.textMuted }]}>
                  Tenés tiempo hasta el {fmtFecha(vence)} a las{' '}
                  {vence.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.
                </Text>
              )}

              {/* A dónde transferir — sólo mientras falta pagarla. */}
              {!yaConfirmada && estado !== 'enviada' && ((cobro?.alias || cobro?.cvu) ? (
                <>
                  <Text style={[styles.rotuloSeccion, { color: ui.textMuted, marginTop: 16 }]}>TRANSFERILE A</Text>
                  {!!cobro.titular && (
                    <Text style={[styles.nota, { color: ui.textMuted }]}>Titular: {cobro.titular}</Text>
                  )}
                  {!!cobro.alias && filaCopiable('Alias', cobro.alias)}
                  {!!cobro.cvu && filaCopiable('CVU / CBU', cobro.cvu)}
                </>
              ) : (
                <Text style={[styles.nota, { color: ui.textMuted }]}>
                  El conductor pide seña pero todavía no cargó sus datos de cobro. Preguntale
                  por el chat a dónde transferirle.
                </Text>
              ))}

              {estado === 'esperando' && (
                <>
                  <PillButton
                    label={subiendo ? 'Enviando…' : 'Mandar comprobante'}
                    onPress={mandarComprobante}
                    loading={subiendo}
                    style={{ marginTop: 20 }}
                  />
                  {!!errorEnvio && (
                    <Text style={[styles.error, { color: '#DC2626' }]}>{errorEnvio}</Text>
                  )}
                </>
              )}

              {/* El comprobante que mandó, guardado: es su prueba si después hay un reclamo.
                  No vive en el chat justamente para que no se borre. */}
              {(estado === 'enviada' || yaConfirmada) && !!booking.sena?.comprobanteUrl && (
                <>
                  <Text style={[styles.rotuloSeccion, { color: ui.textMuted, marginTop: 16 }]}>
                    TU COMPROBANTE{enviada ? ` · ${enviada.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}` : ''}
                  </Text>
                  <Image
                    source={{ uri: buildImageUri(booking.sena.comprobanteUrl) }}
                    style={[styles.comprobante, { backgroundColor: ui.surface }]}
                    resizeMode="contain"
                  />
                  {estado === 'enviada' && (
                    <TouchableOpacity onPress={mandarComprobante} disabled={subiendo} activeOpacity={0.7}>
                      <Text style={[styles.link, { color: ui.text }]}>Mandar otra foto</Text>
                    </TouchableOpacity>
                  )}
                  {!!errorEnvio && (
                    <Text style={[styles.error, { color: '#DC2626' }]}>{errorEnvio}</Text>
                  )}
                </>
              )}
            </>
          )}
        </View>
      )}
    </ScrollView>

      {/* Bloquea la pantalla mientras sube: sin esto se podía scrollear, copiar el alias o
          volver atrás a mitad de la subida. */}
      {subiendo && (
        <View style={[styles.overlay, { backgroundColor: ui.bg }]}>
          <ActivityIndicator size="small" color={ui.text} />
          <Text style={[styles.overlayText, { color: ui.textMuted }]}>Enviando comprobante…</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24 },

  bloque: { paddingBottom: 20, marginBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  ruta: { fontSize: 22, fontFamily: 'Sora_700Bold', letterSpacing: -0.5 },
  sub: { fontSize: 13, fontFamily: 'Sora_400Regular', marginTop: 4, textTransform: 'capitalize' },

  rotuloSeccion: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5, marginBottom: 10 },
  linea: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  nota: { fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 18, marginTop: 8 },

  punto: { marginTop: 12 },
  puntoRotulo: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.3, textTransform: 'uppercase' },
  puntoDir: { fontSize: 14, fontFamily: 'Sora_500Medium', marginTop: 2, lineHeight: 19 },

  pagoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  montoInline: { fontSize: 18, fontFamily: 'Sora_700Bold' },

  senaEstado: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  senaEstadoText: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium', lineHeight: 19 },

  dato: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  datoRotulo: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5 },
  datoValor: { fontSize: 17, fontFamily: 'Sora_600SemiBold', marginTop: 3 },

  link: { fontSize: 13, fontFamily: 'Sora_600SemiBold', textAlign: 'center', marginTop: 14 },
  error: { fontSize: 12, fontFamily: 'Sora_500Medium', textAlign: 'center', marginTop: 10 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  overlayText: { fontSize: 13, fontFamily: 'Sora_500Medium' },

  comprobante: { width: '100%', height: 260, borderRadius: 14, marginTop: 4 },

  aviso: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16,
  },
  avisoText: { flex: 1, fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 19 },
});

export default PagarSenaScreen;

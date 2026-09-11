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

  const venceCorto = vence
    ? `${vence.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' })} ${vence.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  // El monto de la seña ya es el titular de la pantalla (ver el bloque PAGO más abajo); acá
  // sólo falta decir en qué anda — un chip chico, no una oración aparte repitiendo "seña".
  const heroEyebrow = {
    esperando: 'Seña a transferir', enviada: 'Seña enviada', confirmada: 'Seña confirmada',
  }[estado] || 'Seña a transferir';
  const heroChip = {
    esperando: venceCorto ? { icon: 'hourglass-outline', color: ui.textMuted, t: `Vence ${venceCorto}` } : null,
    enviada: { icon: 'time-outline', color: ui.textMuted, t: 'Esperando confirmación' },
    confirmada: { icon: 'checkmark-circle', color: '#10B981', t: 'Confirmada' },
  }[estado];

  // Fila con ícono a la izquierda y texto — sin rótulo en mayúsculas arriba de cada dato, el
  // ícono ya dice qué es (igual que la ficha de un viaje de Uber: un círculo para el origen,
  // un cuadrado para el destino, nada de "TE RECOGEN EN" en letra chica encima).
  const filaIcono = (icon, texto, iconColor) =>
    !!texto && (
      <View style={styles.filaIcono}>
        <Ionicons name={icon} size={18} color={iconColor || ui.textMuted} />
        <Text style={[styles.filaIconoTexto, { color: ui.text }]}>{texto}</Text>
      </View>
    );

  const filaCopiable = (icon, rotulo, valor) =>
    !!valor && (
      <TouchableOpacity
        style={styles.filaIcono}
        onPress={() => copiar(rotulo, valor)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Copiar ${rotulo}`}
      >
        <Ionicons name={icon} size={18} color={ui.textMuted} />
        <Text style={[styles.filaIconoTexto, { color: ui.text }]}>{valor}</Text>
        <Ionicons name="copy-outline" size={17} color={ui.textMuted} />
      </TouchableOpacity>
    );

  // El botón principal, si corresponde mostrarlo: se saca del flujo de bloques para poder
  // pegarlo siempre al final de la pantalla (ver el bloque con marginTop:'auto' más abajo),
  // en vez de quedar enterrado adentro del bloque de la seña.
  const mostrarBotonComprobante = pideSena && estado === 'esperando' && !viajeEnCurso;
  const senaResuelta = pideSena && monto > 0 && !(estado === 'esperando' && viajeEnCurso);
  const mostrarTransferirA = senaResuelta && !yaConfirmada && estado !== 'enviada';
  const mostrarComprobante = senaResuelta && (estado === 'enviada' || yaConfirmada) && !!booking.sena?.comprobanteUrl;

  return (
    <View style={{ flex: 1, backgroundColor: ui.bg }}>
    <ScrollView
      style={{ backgroundColor: ui.bg }}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32, flexGrow: 1 }]}
    >
      {/* Viaje */}
      <View style={[styles.bloque, { borderBottomColor: ui.border }]}>
        <Text style={[styles.ruta, { color: ui.text }]}>
          {trip.origin?.city} → {trip.destination?.city}
        </Text>
        <Text style={[styles.sub, { color: ui.textMuted }]}>
          {fmtFecha(trip.departureDate)}{trip.departureTime ? ` · ${trip.departureTime}` : ''}
          {trip.driver?.firstName ? ` · ${trip.driver.firstName} ${trip.driver.lastName || ''}`.trimEnd() : ''}
        </Text>
      </View>

      {/* Asientos + puntos: una fila por dato, con un ícono al lado que dice qué es — nada de
          "TE RECOGEN EN" en mayúsculas arriba de cada dirección. Mismo lenguaje que la ficha
          de un viaje en Uber (un círculo hueco para el origen, uno lleno para el destino). */}
      <View style={[styles.bloque, { borderBottomColor: ui.border }]}>
        {filaIcono('people-outline', `${asientos} asiento${asientos !== 1 ? 's' : ''}`)}
        {filaIcono('ellipse-outline', sube)}
        {filaIcono('ellipse', baja)}
        {!sube && !baja && (
          <Text style={[styles.nota, { color: ui.textMuted, marginTop: 4 }]}>
            No elegiste puntos de subida y bajada: coordinás con el conductor.
          </Text>
        )}
      </View>

      {/* Pago: la seña es el número grande — es lo único que hay que hacer ahora. El total
          del viaje queda como nota chica debajo, no al revés (antes el total era el número
          grande y llevaba a transferir el doble de la seña real). */}
      <View style={[styles.bloque, mostrarTransferirA || mostrarComprobante ? { borderBottomColor: ui.border } : { borderBottomWidth: 0, marginBottom: 0 }]}>
        {trip.sinPrecioFijo ? (
          filaIcono('cash-outline', 'Gastos compartidos — los arreglás directo con el conductor')
        ) : !pideSena || monto <= 0 ? (
          <>
            <View style={styles.pagoRow}>
              <Text style={[styles.linea, { color: ui.text }]}>Le pagás al conductor</Text>
              <Text style={[styles.montoInline, { color: ui.text }]}>
                ${alConductor.toLocaleString('es-AR')}
              </Text>
            </View>
            <Text style={[styles.nota, { color: ui.textMuted }]}>
              Se lo pagás directo a él al subir, no por la app.
            </Text>
          </>
        ) : estado === 'esperando' && viajeEnCurso ? (
          // El viaje ya salió: ni transferir ni mandar comprobante tiene sentido ya — el
          // lugar se resolvió con o sin la seña. Se arregla hablando con el conductor.
          filaIcono('information-circle-outline', 'El viaje ya salió sin que llegaras a mandar la seña.')
        ) : (
          <>
            <Text style={[styles.heroEyebrow, { color: ui.textMuted }]}>{heroEyebrow}</Text>
            <Text style={[styles.heroMonto, { color: ui.text }]}>
              ${monto.toLocaleString('es-AR')}
            </Text>
            {!!heroChip && (
              <View style={[styles.heroChip, { backgroundColor: ui.surface }]}>
                <Ionicons name={heroChip.icon} size={13} color={heroChip.color} />
                <Text style={[styles.heroChipText, { color: heroChip.color }]}>{heroChip.t}</Text>
              </View>
            )}
            <Text style={[styles.nota, { color: ui.textMuted }]}>
              Le pagás ${alConductor.toLocaleString('es-AR')} en total — el resto (${(alConductor - monto).toLocaleString('es-AR')}) al subir.
            </Text>
          </>
        )}
      </View>

      {/* A dónde transferir — sólo mientras falta pagarla. */}
      {mostrarTransferirA && (
        <View style={[styles.bloque, mostrarComprobante ? { borderBottomColor: ui.border } : { borderBottomWidth: 0, marginBottom: 0 }]}>
          {(cobro?.alias || cobro?.cvu) ? (
            <>
              <Text style={[styles.nota, { color: ui.textMuted, marginTop: 0, marginBottom: 4 }]}>
                Transferile a {cobro.titular || `${trip.driver?.firstName || ''} ${trip.driver?.lastName || ''}`.trim()}
              </Text>
              {filaCopiable('at-outline', 'Alias', cobro.alias)}
              {filaCopiable('card-outline', 'CVU / CBU', cobro.cvu)}
            </>
          ) : (
            filaIcono('alert-circle-outline', 'El conductor pide seña pero todavía no cargó sus datos de cobro. Preguntale por el chat a dónde transferirle.')
          )}
        </View>
      )}

      {/* El comprobante que mandó, guardado: es su prueba si después hay un reclamo. No vive
          en el chat justamente para que no se borre. */}
      {mostrarComprobante && (
        <View style={[styles.bloque, { borderBottomWidth: 0, marginBottom: 0 }]}>
          <Image
            source={{ uri: buildImageUri(booking.sena.comprobanteUrl) }}
            style={[styles.comprobante, { backgroundColor: ui.surface }]}
            resizeMode="contain"
          />
          <Text style={[styles.nota, { color: ui.textMuted }]}>
            {estado === 'confirmada' ? 'Confirmado' : 'Enviado'}
            {enviada ? ` el ${enviada.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}` : ''}.
          </Text>
          {estado === 'enviada' && (
            <TouchableOpacity onPress={mandarComprobante} disabled={subiendo} activeOpacity={0.7}>
              <Text style={[styles.link, { color: ui.text }]}>Mandar otra foto</Text>
            </TouchableOpacity>
          )}
          {!!errorEnvio && (
            <Text style={[styles.error, { color: '#DC2626' }]}>{errorEnvio}</Text>
          )}
        </View>
      )}

      {/* Al final del contenido y no en un footer fijo: con `flexGrow:1` en el scroll y
          `marginTop:'auto'` acá, el botón queda pegado abajo cuando la pantalla es corta
          (como un footer fijo) y después del contenido cuando hay que scrollear — nunca
          flotando encima de él. Mismo patrón que "Tu precio" al publicar un viaje. */}
      {mostrarBotonComprobante && (
        <View style={{ marginTop: 'auto', paddingTop: 20 }}>
          <PillButton
            label={subiendo ? 'Enviando…' : 'Mandar comprobante'}
            onPress={mandarComprobante}
            loading={subiendo}
          />
          {!!errorEnvio && (
            <Text style={[styles.error, { color: '#DC2626' }]}>{errorEnvio}</Text>
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

  linea: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  nota: { fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 18, marginTop: 8 },

  pagoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  montoInline: { fontSize: 18, fontFamily: 'Sora_700Bold' },

  // Fila con ícono: el patrón de toda la pantalla ahora — asientos, subida/bajada, alias,
  // CVU. El ícono reemplaza al rótulo en mayúsculas que iba arriba de cada dato.
  filaIcono: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  filaIconoTexto: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium', lineHeight: 19 },

  // La seña: lo único grande de la pantalla, porque es lo único que hay que hacer ahora.
  heroEyebrow: { fontSize: 12, fontFamily: 'Sora_500Medium' },
  heroMonto: { fontSize: 36, fontFamily: 'Sora_800ExtraBold', letterSpacing: -1, marginTop: 2 },
  heroChip: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6,
    marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  heroChipText: { fontSize: 12, fontFamily: 'Sora_600SemiBold' },

  link: { fontSize: 13, fontFamily: 'Sora_600SemiBold', textAlign: 'center', marginTop: 14 },
  error: { fontSize: 12, fontFamily: 'Sora_500Medium', textAlign: 'center', marginTop: 10 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  overlayText: { fontSize: 13, fontFamily: 'Sora_500Medium' },

  comprobante: { width: '100%', height: 260, borderRadius: 14, marginTop: 4, marginBottom: 8 },
});

export default PagarSenaScreen;

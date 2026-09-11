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
 * "Tu reserva": qué tenés que hacer con esta reserva (transferir la seña, si el viaje la
 * pide) y el resto del detalle — asientos, dónde subís y bajás, el comprobante que mandaste.
 *
 * Se entra desde la sección "Tu reserva" del detalle del viaje y desde "Mis reservas".
 *
 *   navigation.navigate('PagarSena', { bookingId, tripId })   // el nombre de ruta quedó de
 *                                                              // cuando era sólo la seña
 *
 * Los datos de cobro NO vienen con la reserva: los adjunta `getTripById` (`driverDatosCobro`),
 * y sólo a un pasajero de un viaje que pida seña. Por eso se pide el viaje aparte.
 *
 * Diseño: un solo título grande diciendo QUÉ HACER Y A QUIÉN ("Transferile $36.400 a Juan"),
 * dos líneas chicas de contexto debajo, y el resto en filas simples con ícono — nada de
 * rótulos en mayúsculas por sección. Mismo principio que la ficha de un viaje en Uber: un
 * único titular grande, todo lo demás es apoyo chico.
 */
const fmtFecha = (d) =>
  new Date(d).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' });

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
  const nombreConductor = trip.driver?.firstName || 'el conductor';
  const avatarUrl = trip.driver?.avatar ? buildImageUri(trip.driver.avatar) : null;
  const iniciales = `${trip.driver?.firstName?.[0] || ''}${trip.driver?.lastName?.[0] || ''}` || '?';

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

  const senaResuelta = pideSena && monto > 0 && !(estado === 'esperando' && viajeEnCurso);
  const mostrarTransferirA = senaResuelta && !yaConfirmada && estado !== 'enviada';
  const mostrarComprobante = senaResuelta && (estado === 'enviada' || yaConfirmada) && !!booking.sena?.comprobanteUrl;
  // El botón principal, si corresponde mostrarlo: se saca del flujo para poder pegarlo
  // siempre al final de la pantalla (ver el bloque con marginTop:'auto' más abajo).
  const mostrarBotonComprobante = pideSena && estado === 'esperando' && !viajeEnCurso;

  // El título es UNA frase con la acción y con quién — "Transferile $36.400 a Juan Pérez" —
  // en vez de un monto suelto con rótulos alrededor. Todo lo demás son datos de apoyo chicos.
  const monedaMonto = monto > 0 ? `$${monto.toLocaleString('es-AR')}` : '';
  const titulo = trip.sinPrecioFijo
    ? `Arreglá los gastos con ${nombreConductor}`
    : !senaResuelta && (!pideSena || monto <= 0)
      ? `Le pagás $${alConductor.toLocaleString('es-AR')} a ${nombreConductor}`
      : estado === 'esperando' && viajeEnCurso
        ? 'El viaje ya salió'
        : {
            esperando: `Transferile ${monedaMonto} a ${nombreConductor}`,
            enviada: `Le mandaste ${monedaMonto} a ${nombreConductor}`,
            confirmada: `Le mandaste ${monedaMonto} a ${nombreConductor}`,
          }[estado];

  // Segunda línea, chica: el estado o la aclaración que le sigue al título.
  const subEstado = trip.sinPrecioFijo
    ? null
    : !senaResuelta && (!pideSena || monto <= 0)
      ? 'Se lo pagás directo a él al subir, no por la app.'
      : estado === 'esperando' && viajeEnCurso
        ? 'Sin que llegaras a mandar la seña — se arregla con el conductor.'
        : {
            esperando: venceCorto ? `Vence ${venceCorto} · el resto ($${(alConductor - monto).toLocaleString('es-AR')}) al subir` : `El resto ($${(alConductor - monto).toLocaleString('es-AR')}) al subir`,
            enviada: 'Esperando que confirme que le llegó',
            confirmada: 'Confirmó que le llegó ✓',
          }[estado];
  const subEstadoColor = estado === 'confirmada' ? '#10B981' : ui.textMuted;

  // Fila simple con ícono: el patrón para todo lo de apoyo (subida, bajada, CVU) — el ícono
  // dice qué es, sin un rótulo en mayúsculas encima.
  const filaIcono = (icon, texto) =>
    !!texto && (
      <View style={styles.filaIcono}>
        <Ionicons name={icon} size={17} color={ui.textMuted} />
        <Text style={[styles.filaIconoTexto, { color: ui.text }]}>{texto}</Text>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: ui.bg }}>
    <ScrollView
      style={{ backgroundColor: ui.bg }}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32, flexGrow: 1 }]}
    >
      {/* Título: una sola frase con la acción y con quién, y la cara de quién — el avatar
          hace de contrapeso visual, como la foto del conductor en la ficha de un viaje. */}
      <View style={styles.headerRow}>
        <Text style={[styles.titulo, { color: ui.text, flex: 1 }]}>{titulo}</Text>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: ui.surface }]}>
            <Text style={[styles.avatarIniciales, { color: ui.textMuted }]}>{iniciales}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.sub, { color: ui.textMuted }]}>
        {trip.origin?.city} → {trip.destination?.city} · {asientos} asiento{asientos !== 1 ? 's' : ''} · {fmtFecha(trip.departureDate)}{trip.departureTime ? ` · ${trip.departureTime}` : ''}
      </Text>
      {!!subEstado && (
        <Text style={[styles.sub, { color: subEstadoColor, marginTop: 3 }]}>{subEstado}</Text>
      )}

      {/* A dónde transferir, como una tarjeta — no filas sueltas flotando en la pantalla.
          Cada dato se copia al tocarlo. */}
      {mostrarTransferirA && (
        <View style={[styles.card, { backgroundColor: ui.surface }]}>
          {!cobro?.alias && !cobro?.cvu ? (
            <View style={styles.filaIcono}>
              <Ionicons name="alert-circle-outline" size={18} color={ui.textMuted} />
              <Text style={[styles.filaIconoTexto, { color: ui.text }]}>
                El conductor todavía no cargó sus datos de cobro. Preguntale por el chat a dónde transferirle.
              </Text>
            </View>
          ) : (
            <>
              {!!cobro.titular && (
                <View style={[styles.filaIcono, (cobro.alias || cobro.cvu) && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.border }]}>
                  <Ionicons name="person-outline" size={18} color={ui.textMuted} />
                  <Text style={[styles.filaIconoTexto, { color: ui.text }]}>{cobro.titular}</Text>
                </View>
              )}
              {!!cobro.alias && (
                <TouchableOpacity
                  style={[styles.filaIcono, !!cobro.cvu && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.border }]}
                  onPress={() => copiar('Alias', cobro.alias)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="at-outline" size={18} color={ui.textMuted} />
                  <Text style={[styles.filaIconoTexto, { color: ui.text }]}>{cobro.alias}</Text>
                  <Ionicons name="copy-outline" size={16} color={ui.textMuted} />
                </TouchableOpacity>
              )}
              {!!cobro.cvu && (
                <TouchableOpacity style={styles.filaIcono} onPress={() => copiar('CVU', cobro.cvu)} activeOpacity={0.7}>
                  <Ionicons name="card-outline" size={18} color={ui.textMuted} />
                  <Text style={[styles.filaIconoTexto, { color: ui.text }]}>{cobro.cvu}</Text>
                  <Ionicons name="copy-outline" size={16} color={ui.textMuted} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {/* El recorrido, como tarjeta también — mismo lenguaje de puntos y línea que el resto
          de la app (detalle del viaje, ficha de la solicitud). */}
      {(sube || baja) ? (
        <View style={[styles.card, styles.rutaCard, { backgroundColor: ui.surface }]}>
          <View style={styles.rutaFila}>
            <View style={[styles.dotIni, { borderColor: ui.text }]} />
            <Text style={[styles.filaIconoTexto, { color: ui.text, flex: 1 }]} numberOfLines={2}>{sube || 'Coordinás con el conductor'}</Text>
          </View>
          {!!(sube && baja) && <View style={[styles.rutaLinea, { backgroundColor: ui.border }]} />}
          <View style={styles.rutaFila}>
            <View style={[styles.dotFin, { backgroundColor: ui.text }]} />
            <Text style={[styles.filaIconoTexto, { color: ui.text, flex: 1 }]} numberOfLines={2}>{baja || 'Coordinás con el conductor'}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: ui.surface }]}>
          {filaIcono('information-circle-outline', 'No elegiste puntos de subida y bajada: coordinás con el conductor.')}
        </View>
      )}

      {/* El comprobante que mandó, guardado: es su prueba si después hay un reclamo. No vive
          en el chat justamente para que no se borre. */}
      {mostrarComprobante && (
        <View style={{ marginTop: 4 }}>
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

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titulo: { fontSize: 25, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.6, lineHeight: 30 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarIniciales: { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  sub: { fontSize: 13, fontFamily: 'Sora_400Regular', marginTop: 8, lineHeight: 18 },

  // Tarjetas: a dónde transferir, y el recorrido. Le dan cuerpo a la pantalla en vez de
  // dejar filas sueltas flotando en un fondo vacío — mismo lenguaje que usa el resto de la
  // app (y Uber) para agrupar datos que van juntos.
  card: { borderRadius: 22, marginTop: 16, overflow: 'hidden' },
  filaIcono: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  filaIconoTexto: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium', lineHeight: 19 },

  rutaCard: { padding: 18 },
  rutaFila: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 7 },
  rutaLinea: { width: 1.5, height: 16, marginLeft: 4.25 },
  dotIni: { width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  dotFin: { width: 9, height: 9, borderRadius: 5 },

  nota: { fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 18, marginTop: 8 },
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

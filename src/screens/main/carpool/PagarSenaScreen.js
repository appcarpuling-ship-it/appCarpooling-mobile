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
 * pide) y el resto del detalle — a quién le transferís, dónde subís y bajás, el comprobante.
 *
 * Se entra desde la sección "Tu reserva" del detalle del viaje y desde "Mis reservas".
 *
 *   navigation.navigate('PagarSena', { bookingId, tripId })   // el nombre de ruta quedó de
 *                                                              // cuando era sólo la seña
 *
 * Los datos de cobro NO vienen con la reserva: los adjunta `getTripById` (`driverDatosCobro`),
 * y sólo a un pasajero de un viaje que pida seña. Por eso se pide el viaje aparte.
 *
 * Orden de la pantalla, de arriba abajo: A QUIÉN (el conductor, con su cara) → CUÁNTO (el
 * monto grande, con su estado) → CÓMO (alias y CVU, para copiar) → EL VIAJE (ruta y paradas,
 * liviano). Cada bloque tiene un peso visual distinto a propósito: el monto es lo único
 * grande, la tarjeta de datos es lo único con fondo, el viaje es sólo texto.
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
      setSubiendo(true);
      try {
        const fd = new FormData();
        await appendFile(fd, 'comprobante', uri, 'comprobante.jpg');
        const res = await put_withauth_formdata(`/bookings/${bookingId}/sena`, fd);
        if (!res?.success) throw new Error(res?.message || 'No se pudo enviar el comprobante');
        navigation.navigate('Result', {
          type: 'success',
          title: '¡Comprobante enviado!',
          message: 'Tu conductor va a confirmar cuando le llegue la seña.',
        });
      } catch (e) {
        // El Result de error lo reporta a Sentry solo (ver ResultScreen), no hace falta acá.
        navigation.navigate('Result', {
          type: 'error',
          title: 'No se pudo enviar',
          message: 'No pudimos enviar el comprobante. Probá de nuevo.',
          error: e,
        });
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
  const enviada = booking.sena?.enviadaAt ? new Date(booking.sena.enviadaAt) : null;
  const alConductor = (Number(trip.driverPrice) || 0) * asientos;
  const nombreConductor = [trip.driver?.firstName, trip.driver?.lastName].filter(Boolean).join(' ') || 'Tu conductor';
  const avatarUrl = trip.driver?.avatar ? buildImageUri(trip.driver.avatar) : null;
  const iniciales = `${trip.driver?.firstName?.[0] || ''}${trip.driver?.lastName?.[0] || ''}`.trim() || '?';

  // Si la reserva nació de una solicitud (postulación) no hay seatReservation — sus puntos
  // quedaron como paradas del viaje, no acá. Sin este respaldo, a un pasajero que SÍ eligió
  // dónde subir y bajar se le decía "no elegiste puntos", cuando sí lo hizo.
  const paradaPropia = (kind) => trip.intermediateStops?.find(
    (s) => s.kind === kind && String(s.passenger?._id || s.passenger) === String(booking.passenger?._id || booking.passenger),
  );
  /**
   * No elegir un punto propio no es "a coordinar": es subir donde arranca el viaje y bajar
   * donde termina. Por eso el último respaldo son las puntas del viaje del conductor — decir
   * "A coordinar" mandaba a preguntar algo que ya está decidido.
   */
  const puntaDelViaje = (p) => p?.address || p?.city || '';
  const sube = booking.seatReservation?.pickupLocation?.address
    || paradaPropia('pickup')?.address
    || puntaDelViaje(trip.origin);
  const baja = booking.seatReservation?.dropoffLocation?.address
    || paradaPropia('dropoff')?.address
    || puntaDelViaje(trip.destination);

  const senaResuelta = pideSena && monto > 0 && !(estado === 'esperando' && viajeEnCurso);
  const mostrarTransferirA = senaResuelta && !yaConfirmada && estado !== 'enviada';
  const mostrarComprobante = senaResuelta && (estado === 'enviada' || yaConfirmada) && !!booking.sena?.comprobanteUrl;
  // El botón principal, si corresponde mostrarlo: se saca del flujo para poder pegarlo
  // siempre al final de la pantalla (ver el bloque con marginTop:'auto' más abajo).
  const mostrarBotonComprobante = pideSena && estado === 'esperando' && !viajeEnCurso;

  const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

  /**
   * El bloque del monto: un rótulo chico, el número grande, y un chip con el estado. Lo
   * único grande de la pantalla es el número, porque es lo único que hay que resolver.
   */
  const hero = trip.sinPrecioFijo
    ? { rotulo: 'Gastos compartidos', monto: 'A convenir', chip: { icon: 'people-outline', t: `Lo arreglás con ${trip.driver?.firstName || 'el conductor'}` } }
    : !senaResuelta && (!pideSena || monto <= 0)
      ? { rotulo: 'Le pagás al conductor', monto: pesos(alConductor), chip: { icon: 'hand-left-outline', t: 'En mano, al subir' } }
      : estado === 'esperando' && viajeEnCurso
        ? { rotulo: 'Seña', monto: pesos(monto), chip: { icon: 'close-circle-outline', t: 'El viaje ya salió sin la seña' } }
        : {
            esperando: {
              rotulo: 'Seña a pagar',
              monto: pesos(monto),
              // Sin "vence el ...": `sena.venceAt` no lo hace cumplir nadie (no hay job que
              // venza una seña impaga). Lo real es que al salir el viaje la reserva se cierra,
              // y la fecha de salida ya está abajo — prometer una hora exacta que el backend
              // no respeta era peor que no decir nada.
              chip: null,
              pie: `Total del viaje: ${pesos(alConductor)}`,
            },
            enviada: {
              rotulo: 'Seña enviada',
              monto: pesos(monto),
              chip: { icon: 'time-outline', t: 'Esperando confirmación' },
              pie: `Total del viaje: ${pesos(alConductor)}`,
            },
            confirmada: {
              rotulo: 'Seña confirmada',
              monto: pesos(monto),
              chip: { icon: 'checkmark-circle', t: 'Ya le llegó', color: '#10B981' },
              pie: `Total del viaje: ${pesos(alConductor)}`,
            },
          }[estado];

  const filaCopiable = (icon, rotulo, valor, conBorde) =>
    !!valor && (
      <TouchableOpacity
        style={[styles.fila, conBorde && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.border }]}
        onPress={() => copiar(rotulo, valor)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Copiar ${rotulo}`}
      >
        <Ionicons name={icon} size={19} color={ui.textMuted} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.filaRotulo, { color: ui.textMuted }]}>{rotulo}</Text>
          <Text style={[styles.filaValor, { color: ui.text }]}>{valor}</Text>
        </View>
        <Ionicons name="copy-outline" size={17} color={ui.textMuted} />
      </TouchableOpacity>
    );

  return (
    <View style={{ flex: 1, backgroundColor: ui.bg }}>
    <ScrollView
      style={{ backgroundColor: ui.bg }}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28, flexGrow: 1 }]}
    >
      {/* A quién. La cara primero: es una transferencia a una persona, no un trámite. */}
      <View style={styles.conductor}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: ui.surface }]}>
            <Text style={[styles.avatarIniciales, { color: ui.textMuted }]}>{iniciales}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.conductorNombre, { color: ui.text }]} numberOfLines={1}>{nombreConductor}</Text>
          <Text style={[styles.conductorRol, { color: ui.textMuted }]}>Conductor</Text>
        </View>
      </View>

      {/* Cuánto. El número grande y solo — nada compite con él en la pantalla. */}
      <View style={styles.montoBloque}>
        <Text style={[styles.montoRotulo, { color: ui.textMuted }]}>{hero.rotulo.toUpperCase()}</Text>
        <Text style={[styles.montoGrande, { color: ui.text }]}>{hero.monto}</Text>
        {!!hero.chip && (
          <View style={[styles.chip, { backgroundColor: ui.surface }]}>
            <Ionicons name={hero.chip.icon} size={14} color={hero.chip.color || ui.textMuted} />
            <Text style={[styles.chipTexto, { color: hero.chip.color || ui.textMuted }]}>{hero.chip.t}</Text>
          </View>
        )}
        {!!hero.pie && (
          <Text style={[styles.montoPie, { color: ui.textMuted }]}>{hero.pie}</Text>
        )}
      </View>

      {/* Cómo. Lo único con fondo en la pantalla, porque es lo único que se toca. */}
      {mostrarTransferirA && (
        <View style={[styles.card, { backgroundColor: ui.surface }]}>
          {!cobro?.alias && !cobro?.cvu ? (
            <View style={styles.fila}>
              <Ionicons name="alert-circle-outline" size={19} color={ui.textMuted} />
              <Text style={[styles.filaValor, { color: ui.text, flex: 1 }]}>
                Todavía no cargó sus datos de cobro. Preguntale por el chat a dónde transferirle.
              </Text>
            </View>
          ) : (
            <>
              {filaCopiable('at-outline', 'Alias', cobro.alias, false)}
              {filaCopiable('card-outline', 'CVU / CBU', cobro.cvu, !!cobro.alias)}
              {/* El titular sólo si NO es el conductor: su nombre ya está arriba con la foto,
                  y repetirlo era una fila que no decía nada nuevo. Cuando la cuenta está a
                  nombre de otro sí importa, y ahí sí aparece. */}
              {!!cobro.titular && cobro.titular.trim().toLowerCase() !== nombreConductor.trim().toLowerCase() && (
                <View style={[styles.fila, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.border }]}>
                  <Ionicons name="person-outline" size={19} color={ui.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.filaRotulo, { color: ui.textMuted }]}>Titular de la cuenta</Text>
                    <Text style={[styles.filaValor, { color: ui.text }]}>{cobro.titular}</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* El comprobante que mandó, guardado: es su prueba si después hay un reclamo. No vive
          en el chat justamente para que no se borre. */}
      {mostrarComprobante && (
        <View style={styles.comprobanteBloque}>
          <Image
            source={{ uri: buildImageUri(booking.sena.comprobanteUrl) }}
            style={[styles.comprobante, { backgroundColor: ui.surface }]}
            resizeMode="cover"
          />
          {estado === 'enviada' && (
            <TouchableOpacity onPress={mandarComprobante} disabled={subiendo} activeOpacity={0.7}>
              <Text style={[styles.link, { color: ui.text }]}>Mandar otra foto</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* El viaje. Sólo texto y los dos puntos: es contexto, no la acción. */}
      <View style={[styles.viaje, { borderTopColor: ui.border }]}>
        <Text style={[styles.viajeRuta, { color: ui.text }]}>
          {trip.origin?.city} → {trip.destination?.city}
        </Text>
        <Text style={[styles.viajeMeta, { color: ui.textMuted }]}>
          {asientos} asiento{asientos !== 1 ? 's' : ''} · {fmtFecha(trip.departureDate)}{trip.departureTime ? ` · ${trip.departureTime}` : ''}
        </Text>

        {!!(sube || baja) && (
          <View style={styles.ruta}>
            <Text style={[styles.montoRotulo, styles.rutaRotulo, { color: ui.textMuted }]}>TU RECORRIDO</Text>
            <View style={styles.rutaFila}>
              <View style={[styles.dotIni, { borderColor: ui.textMuted }]} />
              <Text style={[styles.rutaTexto, { color: ui.text }]} numberOfLines={2}>{sube}</Text>
            </View>
            <View style={[styles.rutaLinea, { backgroundColor: ui.border }]} />
            <View style={styles.rutaFila}>
              <View style={[styles.dotFin, { backgroundColor: ui.textMuted }]} />
              <Text style={[styles.rutaTexto, { color: ui.text }]} numberOfLines={2}>{baja}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Al final del contenido y no en un footer fijo: con `flexGrow:1` en el scroll y
          `marginTop:'auto'` acá, el botón queda pegado abajo cuando la pantalla es corta
          (como un footer fijo) y después del contenido cuando hay que scrollear — nunca
          flotando encima de él. Mismo patrón que "Tu precio" al publicar un viaje. */}
      {mostrarBotonComprobante && (
        <View style={{ marginTop: 'auto', paddingTop: 24 }}>
          <PillButton
            label={subiendo ? 'Enviando…' : 'Mandar comprobante'}
            onPress={mandarComprobante}
            loading={subiendo}
          />
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
  scroll: { paddingHorizontal: 24, paddingTop: 8 },

  // A quién
  conductor: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarIniciales: { fontSize: 17, fontFamily: 'Sora_600SemiBold' },
  conductorNombre: { fontSize: 17, fontFamily: 'Sora_600SemiBold', letterSpacing: -0.2 },
  conductorRol: { fontSize: 13, fontFamily: 'Sora_400Regular', marginTop: 2 },

  // Cuánto
  montoBloque: { marginTop: 34 },
  montoRotulo: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 1.1 },
  montoGrande: { fontSize: 46, fontFamily: 'Sora_800ExtraBold', letterSpacing: -2, marginTop: 6, lineHeight: 52 },
  chip: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 7,
    marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  chipTexto: { fontSize: 12.5, fontFamily: 'Sora_600SemiBold' },
  montoPie: { fontSize: 12.5, fontFamily: 'Sora_400Regular', marginTop: 12 },

  // Cómo
  card: { borderRadius: 22, marginTop: 28, overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 15 },
  filaRotulo: { fontSize: 11, fontFamily: 'Sora_500Medium', letterSpacing: 0.3 },
  filaValor: { fontSize: 15.5, fontFamily: 'Sora_600SemiBold', marginTop: 2 },

  comprobanteBloque: { marginTop: 28 },
  comprobante: { width: '100%', height: 220, borderRadius: 22 },

  // El viaje
  viaje: { marginTop: 30, paddingTop: 26, borderTopWidth: StyleSheet.hairlineWidth },
  viajeRuta: { fontSize: 17, fontFamily: 'Sora_700Bold', letterSpacing: -0.3 },
  viajeMeta: { fontSize: 12.5, fontFamily: 'Sora_400Regular', marginTop: 4 },
  ruta: { marginTop: 16 },
  rutaRotulo: { marginBottom: 12 },
  rutaFila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rutaTexto: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium', lineHeight: 19 },
  rutaLinea: { width: 1.5, height: 18, marginLeft: 4.25, marginVertical: 3 },
  dotIni: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  dotFin: { width: 10, height: 10, borderRadius: 5 },

  link: { fontSize: 13, fontFamily: 'Sora_600SemiBold', textAlign: 'center', marginTop: 14 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  overlayText: { fontSize: 13, fontFamily: 'Sora_500Medium' },
});

export default PagarSenaScreen;

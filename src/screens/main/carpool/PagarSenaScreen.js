import React, { useCallback, useState } from 'react';
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

/**
 * Pagar la seña: a dónde transferir y el comprobante.
 *
 * Pantalla propia, y se entra desde "Mis reservas" cuando el conductor ya te aceptó. Estuvo
 * un rato dentro del detalle del viaje y salió de ahí a pedido: el detalle lo mira cualquiera
 * que pase por el viaje, y los datos bancarios del conductor sólo le importan a la única
 * persona que le tiene que transferir, en el único momento en que le toca hacerlo.
 *
 *   navigation.navigate('PagarSena', { bookingId, tripId })
 *
 * Los datos de cobro NO vienen con la reserva: los adjunta `getTripById` (`driverDatosCobro`)
 * y sólo a un pasajero de un viaje que pida seña, así que la pantalla pide el viaje aparte.
 */
const PagarSenaScreen = ({ route }) => {
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
      reportError(e, { screen: 'PagarSena', action: 'cargar' });
    } finally {
      setCargando(false);
    }
  }, [bookingId, tripId]);

  // Al entrar y al volver de la cámara: el conductor pudo confirmar mientras tanto.
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

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
        setBooking((b) => (b ? { ...b, sena: res.data } : b));
        showAlert('Listo', 'Le avisamos al conductor. Te confirma cuando vea la transferencia.');
      } catch (e) {
        reportError(e, { screen: 'PagarSena', action: 'mandarComprobante' });
        showAlert('Ocurrió algo', 'No pudimos enviar el comprobante. Probá de nuevo.');
      } finally {
        setSubiendo(false);
      }
    }, { titulo: 'Comprobante de la seña', mensaje: '¿De dónde la querés sacar?' });
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

  const estado = booking.sena?.estado;
  const asientos = booking.seatsBooked || booking.seats || 1;
  const monto = montoSena(trip.driverPrice, asientos);
  const cobro = trip.driverDatosCobro;
  const vence = booking.sena?.venceAt ? new Date(booking.sena.venceAt) : null;

  const fila = (rotulo, valor) => (
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

  return (
    <ScrollView
      style={{ backgroundColor: ui.bg }}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
    >
      <View style={[styles.monto, { borderBottomColor: ui.border }]}>
        <Text style={[styles.montoValor, { color: ui.text }]}>
          ${monto.toLocaleString('es-AR')}
        </Text>
        <Text style={[styles.montoPie, { color: ui.textMuted }]}>
          La mitad de ${(Number(trip.driverPrice) * asientos).toLocaleString('es-AR')}
          {asientos > 1 ? ` (${asientos} asientos)` : ''}. El resto se lo pagás al subir.
        </Text>
        {estado === 'esperando' && !!vence && (
          <Text style={[styles.montoPie, { color: ui.textMuted, marginTop: 6 }]}>
            Tenés tiempo hasta el {vence.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' a las '}
            {vence.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.
          </Text>
        )}
      </View>

      {(cobro?.alias || cobro?.cvu) ? (
        <>
          <Text style={[styles.rotuloSeccion, { color: ui.textMuted }]}>TRANSFERILE A</Text>
          {!!cobro.alias && fila('Alias', cobro.alias)}
          {!!cobro.cvu && fila('CVU / CBU', cobro.cvu)}
          {!!cobro.titular && (
            <Text style={[styles.nota, { color: ui.textMuted }]}>Titular: {cobro.titular}</Text>
          )}
        </>
      ) : (
        <Text style={[styles.nota, { color: ui.textMuted }]}>
          El conductor pide seña pero todavía no cargó sus datos de cobro. Preguntale por el
          chat a dónde transferirle.
        </Text>
      )}

      {estado === 'esperando' && (
        <TouchableOpacity
          style={[styles.boton, { backgroundColor: ui.invertBg }]}
          onPress={mandarComprobante}
          disabled={subiendo}
          activeOpacity={0.85}
        >
          <Text style={[styles.botonText, { color: ui.invertText }]}>
            {subiendo ? 'Enviando…' : 'Mandar comprobante'}
          </Text>
        </TouchableOpacity>
      )}

      {estado === 'enviada' && (
        <>
          <View style={[styles.aviso, { borderColor: ui.border }]}>
            <Ionicons name="time-outline" size={18} color={ui.textMuted} />
            <Text style={[styles.avisoText, { color: ui.textMuted }]}>
              Mandaste el comprobante. Falta que el conductor confirme que le llegó.
            </Text>
          </View>
          {!!booking.sena?.comprobanteUrl && (
            <Image
              source={{ uri: buildImageUri(booking.sena.comprobanteUrl) }}
              style={[styles.comprobante, { backgroundColor: ui.surface }]}
              resizeMode="contain"
            />
          )}
          {/* Se puede mandar otra: la primera puede haber salido movida o ser la que no era. */}
          <TouchableOpacity onPress={mandarComprobante} disabled={subiendo} activeOpacity={0.7}>
            <Text style={[styles.link, { color: ui.text }]}>
              {subiendo ? 'Enviando…' : 'Mandar otra foto'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {estado === 'confirmada' && (
        <View style={[styles.aviso, { borderColor: ui.border }]}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
          <Text style={[styles.avisoText, { color: ui.textMuted }]}>
            El conductor confirmó la seña. Tu lugar está reservado.
          </Text>
        </View>
      )}

      <View style={[styles.aviso, { borderColor: ui.border }]}>
        <Ionicons name="information-circle-outline" size={18} color={ui.textMuted} />
        <Text style={[styles.avisoText, { color: ui.textMuted }]}>
          La plata va directo a la cuenta del conductor. Carpuling no la toca ni la retiene.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24 },

  monto: { paddingBottom: 20, marginBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  montoValor: { fontSize: 40, fontFamily: 'Sora_800ExtraBold', letterSpacing: -1.5 },
  montoPie: { fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 19, marginTop: 6 },

  rotuloSeccion: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5, marginBottom: 4 },
  dato: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  datoRotulo: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5 },
  datoValor: { fontSize: 17, fontFamily: 'Sora_600SemiBold', marginTop: 3 },
  nota: { fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 18, marginTop: 10 },

  boton: { marginTop: 24, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  botonText: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  link: { fontSize: 13, fontFamily: 'Sora_600SemiBold', textAlign: 'center', marginTop: 14 },

  comprobante: { width: '100%', height: 260, borderRadius: 14, marginTop: 14 },

  aviso: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, marginTop: 20,
  },
  avisoText: { flex: 1, fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 19 },
});

export default PagarSenaScreen;

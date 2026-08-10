import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Platform, KeyboardAvoidingView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { createTripRequest } from '../../../services/tripRequestService';
import { useUI } from '../../../theme/ui';

const pad = (n) => String(n).padStart(2, '0');
const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// "mar 11 de agosto" se lee de un vistazo; 11/08/2026 hay que descifrarlo.
const fechaLarga = (d) =>
  d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'long' }).replace('.', '');

const lugar = (p) => [p?.address, p?.city, p?.province].filter(Boolean).join(', ') || 'Sin especificar';

const TripRequestDetailsScreen = ({ route, navigation }) => {
  const { origin, destination, waypoints } = route.params || {};
  const paradas = (waypoints || []).length;
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const dark = isDarkMode;
  const ui = useUI();
  const bg       = ui.bg;
  const cardBg   = ui.surface;
  const border   = ui.border;  const divider  = ui.bg;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const accent      = ui.invertBg;
  const accentInverse = ui.invertText;

  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setHours(8, 0, 0, 0);

  const [date, setDate]               = useState(tomorrow);
  const [tempDate, setTempDate]       = useState(tomorrow);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [time, setTime]               = useState(tomorrow);
  const [tempTime, setTempTime]       = useState(tomorrow);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [seatsNeeded, setSeatsNeeded] = useState(1);
  const [loading, setLoading]         = useState(false);

  const onDateChange = (_, selected) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selected) setDate(selected);
    } else {
      if (selected) setTempDate(selected);
    }
  };

  const onTimeChange = (_, selected) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (selected) setTime(selected);
    } else {
      if (selected) setTempTime(selected);
    }
  };

  const handleSubmit = async () => {
    // Momento real elegido, en hora local: solo para validar que sea futuro.
    const departureLocal = new Date(date);
    departureLocal.setHours(time.getHours(), time.getMinutes(), 0, 0);

    if (departureLocal <= new Date()) {
      showAlert('Fecha inválida', 'La fecha y hora deben ser futuras.');
      return;
    }

    // Lo que viaja al backend es el DÍA de calendario a medianoche UTC, que es el contrato
    // que asumen el backend (tripRequestController: filtros de próximas/pasadas) y las
    // pantallas que lo formatean con timeZone UTC. Mandar el momento local convertido a UTC
    // rompía las dos cosas: en UTC-3, una solicitud para hoy 22:00 se guardaba como las
    // 01:00 UTC de mañana y se mostraba —y se filtraba— como del día siguiente.
    // La hora no se pierde: viaja aparte en departureTime.
    const departureDay = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

    setLoading(true);
    try {
      await createTripRequest({
        origin:      { address: origin.address, city: origin.city, coordinates: origin.coordinates },
        destination: { address: destination.address, city: destination.city, coordinates: destination.coordinates },
        intermediateStops: (waypoints || []).map((wp, i) => ({
          address: wp.address,
          city: wp.city || wp.province || '',
          province: wp.province || '',
          coordinates: wp.coordinates,
          order: i + 1,
        })),
        departureDate: departureDay.toISOString(),
        departureTime: formatTime(time),
        seatsNeeded,
        // El precio y la distancia los calcula el backend con el parámetro costoViaje
        // (tripRequestController ~L104-112) y descarta lo que mande el cliente.
      });

      navigation.navigate('Result', {
        type: 'success',
        title: '¡Solicitud publicada!',
        message: 'Los conductores podrán postularse a tu viaje.',
        // Sin onPrimary: cae en el default de Result, que lleva al home. El boton
        // "Ver" solo cambiaba de tab dentro del home y parecia que no hacia nada.
      });
    } catch (err) {
      navigation.navigate('Result', { type: 'error', title: 'Ocurrió algo', message: err?.response?.data?.message || 'No se pudo publicar la solicitud.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* La ruta que venís de elegir en el mapa. No estaba, así que publicabas a ciegas:
              la pantalla anterior es un mapa y acá no quedaba ni rastro de qué viaje pedías. */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.routeRow}>
              <View style={styles.routeRail}>
                <View style={[styles.dot, { borderColor: textPrimary }]} />
                <View style={[styles.railLine, { backgroundColor: textPrimary }]} />
                <View style={[styles.dotFilled, { backgroundColor: textPrimary }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={2}>
                  {lugar(origin)}
                </Text>
                <Text style={[styles.routeText, { color: textPrimary, marginTop: 22 }]} numberOfLines={2}>
                  {lugar(destination)}
                </Text>
              </View>
            </View>
            {paradas > 0 && (
              <Text style={[styles.routeMeta, { color: textMuted, borderTopColor: border }]}>
                {paradas} parada{paradas !== 1 ? 's' : ''} en el camino
              </Text>
            )}
          </View>

          {/* Fecha y hora juntas: son una sola decisión y separadas en dos tarjetas sueltas
              dejaban la pantalla con más aire que contenido. */}
          <Text style={[styles.label, { color: textMuted }]}>¿Cuándo salís?</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <TouchableOpacity
              style={[styles.pickRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border }]}
              onPress={() => { setTempDate(date); setShowDatePicker(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={19} color={textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickLabel, { color: textMuted }]}>Fecha</Text>
                <Text style={[styles.pickValue, { color: textPrimary }]}>{fechaLarga(date)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pickRow}
              onPress={() => { setTempTime(time); setShowTimePicker(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={19} color={textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickLabel, { color: textMuted }]}>Hora</Text>
                <Text style={[styles.pickValue, { color: textPrimary }]}>{formatTime(time)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={textMuted} />
            </TouchableOpacity>
          </View>

          {/* Asientos: la cuenta a la derecha y el rótulo a la izquierda, en vez de un +/- solo
              en el medio de una tarjeta vacía. */}
          <Text style={[styles.label, { color: textMuted }]}>¿Cuántos viajan?</Text>
          <View style={[styles.card, styles.seatsCard, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pickValue, { color: textPrimary }]}>
                {seatsNeeded} asiento{seatsNeeded !== 1 ? 's' : ''}
              </Text>
              <Text style={[styles.pickLabel, { color: textMuted, marginTop: 2 }]}>
                Los que necesitás para vos y quien te acompañe
              </Text>
            </View>
            <View style={styles.seatsRow}>
              <TouchableOpacity
                style={[styles.seatsBtn, { borderColor: border }, seatsNeeded <= 1 && { opacity: 0.35 }]}
                onPress={() => setSeatsNeeded(s => Math.max(1, s - 1))}
                disabled={seatsNeeded <= 1}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="remove" size={20} color={textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.seatsNum, { color: textPrimary }]}>{seatsNeeded}</Text>
              <TouchableOpacity
                style={[styles.seatsBtn, { borderColor: border }, seatsNeeded >= 10 && { opacity: 0.35 }]}
                onPress={() => setSeatsNeeded(s => Math.min(10, s + 1))}
                disabled={seatsNeeded >= 10}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="add" size={20} color={textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Cierra la pantalla con lo que estás por publicar, en una frase. */}
          <Text style={[styles.resumen, { color: textMuted }]}>
            Vas a pedir {seatsNeeded} asiento{seatsNeeded !== 1 ? 's' : ''} para el {fechaLarga(date)} a las {formatTime(time)}.
            Los conductores que hagan ese viaje van a poder ofrecerte lugar.
          </Text>

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: bg, borderTopColor: border }]}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: accent }, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={accentInverse} />
              : <Text style={[styles.btnText, { color: accentInverse }]}>Publicar solicitud</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Date Picker */}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker value={date} mode="date" display="default" minimumDate={new Date()} onChange={onDateChange} />
      )}
      {Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" visible={showDatePicker} onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerBox, { backgroundColor: cardBg }]}>
              <Text style={[styles.pickerTitle, { color: textPrimary, borderBottomColor: divider }]}>Fecha de salida</Text>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={onDateChange}
                textColor={textPrimary}
              />
              <View style={[styles.pickerFooter, { borderTopColor: divider }]}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={[styles.pickerBtn, { color: textMuted }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setDate(tempDate); setShowDatePicker(false); }}>
                  <Text style={[styles.pickerBtn, { color: textPrimary, fontWeight: '600' }]}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Time Picker */}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker value={time} mode="time" display="default" is24Hour onChange={onTimeChange} />
      )}
      {Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" visible={showTimePicker} onRequestClose={() => setShowTimePicker(false)}>
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerBox, { backgroundColor: cardBg }]}>
              <Text style={[styles.pickerTitle, { color: textPrimary, borderBottomColor: divider }]}>Hora de salida</Text>
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                is24Hour
                onChange={onTimeChange}
                textColor={textPrimary}
              />
              <View style={[styles.pickerFooter, { borderTopColor: divider }]}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={[styles.pickerBtn, { color: textMuted }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setTime(tempTime); setShowTimePicker(false); }}>
                  <Text style={[styles.pickerBtn, { color: textPrimary, fontWeight: '600' }]}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { padding: 16 },
  label: {
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 26,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  routeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  routeRail: { alignItems: 'center', paddingTop: 5 },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  dotFilled: { width: 9, height: 9, borderRadius: 5 },
  railLine: { width: 1.5, flex: 1, minHeight: 18, marginVertical: 4 },
  routeText: { fontSize: 14, fontFamily: 'Sora_500Medium', lineHeight: 19 },
  routeMeta: {
    fontSize: 12, textAlign: 'center', paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  pickLabel: { fontSize: 11, fontFamily: 'Sora_500Medium', letterSpacing: 0.3, textTransform: 'uppercase' },
  pickValue: { fontSize: 16, fontFamily: 'Sora_600SemiBold', marginTop: 2 },
  seatsCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  seatsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seatsBtn: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  seatsNum: { fontSize: 18, fontFamily: 'Sora_700Bold', minWidth: 22, textAlign: 'center' },
  resumen: { fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 19, marginTop: 24, paddingHorizontal: 4 },
  footer: { padding: 16, paddingBottom: 24, borderTopWidth: StyleSheet.hairlineWidth },
  btn:     { borderRadius: 999, paddingVertical: 17, alignItems: 'center' },
  btnText: { fontSize: 16, fontFamily: 'Sora_700Bold' },
  // Pickers
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerBox:     { borderRadius: 14, margin: 20, minWidth: 300, overflow: 'hidden' },
  pickerTitle:   { fontSize: 15, fontFamily: 'Sora_600SemiBold', textAlign: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerFooter:  { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  pickerBtn:     { fontSize: 16, paddingHorizontal: 12 },
});

export default TripRequestDetailsScreen;

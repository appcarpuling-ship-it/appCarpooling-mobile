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

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const TripRequestDetailsScreen = ({ route, navigation }) => {
  const { origin, destination, distanceKm } = route.params || {};
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const dark = isDarkMode;
  const bg       = dark ? '#161616' : '#F9FAFB';
  const cardBg   = dark ? '#1F1F1F' : '#FFFFFF';
  const border   = dark ? '#2E2E2E' : '#E5E7EB';
  const divider  = dark ? '#2A2A2A' : '#F0F0F0';
  const textPrimary = dark ? '#FFFFFF' : '#1F2937';
  const textMuted   = dark ? '#9CA3AF' : '#6B7280';
  const accent      = dark ? '#FFFFFF' : '#000000';
  const accentInverse = dark ? '#000000' : '#FFFFFF';

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
    const departureDate = new Date(date);
    departureDate.setHours(time.getHours(), time.getMinutes(), 0, 0);

    if (departureDate <= new Date()) {
      showAlert('Fecha inválida', 'La fecha y hora deben ser futuras.');
      return;
    }

    setLoading(true);
    try {
      await createTripRequest({
        origin:      { address: origin.address, city: origin.city, coordinates: origin.coordinates },
        destination: { address: destination.address, city: destination.city, coordinates: destination.coordinates },
        departureDate: departureDate.toISOString(),
        departureTime: formatTime(time),
        seatsNeeded,
        distanceKm: distanceKm || 0,
        estimatedPrice: Math.round((distanceKm || 0) * 1500 / 100) * 100,
      });

      showAlert('¡Solicitud publicada!', 'Los conductores podrán postularse a tu viaje.', [
        {
          text: 'Ver',
          onPress: () => navigation.navigate('Main', {
            screen: 'HomeTab',
            params: {
              screen: 'Home',
              params: { openTab: 'solicitudes' },
            },
          }),
        },
      ]);
    } catch (err) {
      showAlert('Error', err?.response?.data?.message || 'No se pudo publicar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Fecha */}
          <Text style={[styles.label, { color: textMuted }]}>Fecha de salida</Text>
          <TouchableOpacity
            style={[styles.row, { backgroundColor: cardBg, borderColor: border }]}
            onPress={() => { setTempDate(date); setShowDatePicker(true); }}
          >
            <Ionicons name="calendar-outline" size={18} color={textMuted} style={styles.icon} />
            <Text style={[styles.rowText, { color: textPrimary }]}>{formatDate(date)}</Text>
          </TouchableOpacity>

          {/* Hora */}
          <Text style={[styles.label, { color: textMuted }]}>Hora de salida</Text>
          <TouchableOpacity
            style={[styles.row, { backgroundColor: cardBg, borderColor: border }]}
            onPress={() => { setTempTime(time); setShowTimePicker(true); }}
          >
            <Ionicons name="time-outline" size={18} color={textMuted} style={styles.icon} />
            <Text style={[styles.rowText, { color: textPrimary }]}>{formatTime(time)}</Text>
          </TouchableOpacity>

          {/* Asientos */}
          <Text style={[styles.label, { color: textMuted }]}>Asientos necesarios</Text>
          <View style={[styles.row, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.seatsRow}>
              <TouchableOpacity
                style={[styles.seatsBtn, { borderColor: border }]}
                onPress={() => setSeatsNeeded(s => Math.max(1, s - 1))}
              >
                <Ionicons name="remove" size={20} color={textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.seatsNum, { color: textPrimary }]}>{seatsNeeded}</Text>
              <TouchableOpacity
                style={[styles.seatsBtn, { borderColor: border }]}
                onPress={() => setSeatsNeeded(s => Math.min(10, s + 1))}
              >
                <Ionicons name="add" size={20} color={textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

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
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 6,
    marginLeft: 2,
  },
  row: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon:    { marginRight: 10 },
  rowText: { fontSize: 15 },
  seatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  seatsBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  seatsNum: { fontSize: 22, fontWeight: '700', width: 32, textAlign: 'center' },
  footer: { padding: 16, paddingBottom: 24, borderTopWidth: 1 },
  btn:     { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
  // Pickers
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerBox:     { borderRadius: 14, margin: 20, minWidth: 300, overflow: 'hidden' },
  pickerTitle:   { fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerFooter:  { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  pickerBtn:     { fontSize: 16, paddingHorizontal: 12 },
});

export default TripRequestDetailsScreen;

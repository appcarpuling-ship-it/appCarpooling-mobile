import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUI } from '../../../theme/ui';
import MyTripsScreen from '../carpool/MyTripsScreen';
import MyBookingsScreen from '../carpool/MyBookingsScreen';

/**
 * Raíz del tab Historial: switch "Viajes" (lo que publicaste como conductor) /
 * "Solicitudes" (lo que reservaste como pasajero). Reutiliza MyTripsScreen y
 * MyBookingsScreen con historyMode: sin su título ni su propio toggle próximos/
 * pasados (el historial es solo lo pasado, y el switch de arriba ya alcanza).
 */
const HistoryScreen = (props) => {
  const ui = useUI();
  const [section, setSection] = useState('trips');

  const sections = [
    { key: 'trips', label: 'Viajes' },
    { key: 'requests', label: 'Solicitudes' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]} edges={['top']}>
      <View style={styles.switchWrap}>
        <View style={[styles.pill, { backgroundColor: ui.surface }]}>
          {sections.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.pillItem, section === key && { backgroundColor: ui.invertBg }]}
              onPress={() => setSection(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pillText, { color: section === key ? ui.invertText : ui.textMuted }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.content}>
        {section === 'trips'
          ? <MyTripsScreen {...props} historyMode />
          : <MyBookingsScreen {...props} historyMode />}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  switchWrap: { paddingTop: 8, paddingHorizontal: 24, paddingBottom: 4 },
  pill: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  pillItem: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  pillText: { fontFamily: 'Sora_600SemiBold', fontSize: 14 },
  content: { flex: 1 },
});

export default HistoryScreen;

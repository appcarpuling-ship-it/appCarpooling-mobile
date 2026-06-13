import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Modal, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useColors } from '../../../hooks/useColors';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { get_withauth } from '../../../services/apiService';
import { getOpenTripRequests, applyToTripRequest } from '../../../services/tripRequestService';
import { ENDPOINTS } from '../../../config/api';

const OpenTripRequestsScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const dark = isDarkMode;
  const bg = dark ? '#161616' : '#F9FAFB';
  const cardBg = dark ? '#1F1F1F' : '#FFFFFF';
  const border = dark ? '#333333' : '#E5E7EB';
  const textPrimary = dark ? '#FFFFFF' : '#1F2937';
  const textMuted = dark ? '#9CA3AF' : '#6B7280';
  const accent = dark ? '#FFFFFF' : '#1F2937';
  const accentInverse = dark ? '#000000' : '#FFFFFF';
  const divider = dark ? '#2A2A2A' : '#F3F4F6';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleModal, setVehicleModal] = useState({ visible: false, requestId: null });
  const [applying, setApplying] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getOpenTripRequests();
      if (res.success) setRequests(res.data);
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const res = await get_withauth(ENDPOINTS.MY_VEHICLES);
      if (res.success) setVehicles(res.data || []);
    } catch { /* no-op */ }
  };

  useFocusEffect(useCallback(() => {
    load();
    loadVehicles();
  }, []));

  const handleApplyPress = (requestId) => {
    if (vehicles.length === 0) {
      return showAlert(
        'Sin vehículos',
        'Necesitás tener al menos un vehículo registrado para postularte.',
        [{ text: 'Agregar vehículo', onPress: () => navigation.navigate('ProfileTab', { screen: 'Vehicles' }) }]
      );
    }
    if (vehicles.length === 1) {
      confirmApply(requestId, vehicles[0]._id);
    } else {
      setVehicleModal({ visible: true, requestId });
    }
  };

  const confirmApply = async (requestId, vehicleId) => {
    setVehicleModal({ visible: false, requestId: null });
    setApplying(requestId);
    try {
      const res = await applyToTripRequest(requestId, vehicleId);
      if (res.success) {
        showAlert('¡Postulación enviada!', 'El pasajero revisará tu perfil y vehículo.');
        load();
      }
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      setApplying(null);
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.routeRow}>
          <Ionicons name="radio-button-on" size={13} color="#22C55E" />
          <Text style={[styles.city, { color: textPrimary }]} numberOfLines={1}>{item.origin.city}</Text>
          <Ionicons name="arrow-forward" size={13} color={textMuted} />
          <Text style={[styles.city, { color: textPrimary }]} numberOfLines={1}>{item.destination.city}</Text>
        </View>
        <Text style={[styles.price, { color: textPrimary }]}>${item.pricePerSeat?.toLocaleString()}</Text>
      </View>

      <View style={[styles.meta, { borderTopColor: divider }]}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={13} color={textMuted} />
          <Text style={[styles.metaText, { color: textMuted }]}>{formatDate(item.departureDate)} · {item.departureTime}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="map-outline" size={13} color={textMuted} />
          <Text style={[styles.metaText, { color: textMuted }]}>{item.distanceKm} km</Text>
        </View>
      </View>

      <View style={[styles.bottomRow, { borderTopColor: divider }]}>
        <Text style={[styles.appsCount, { color: item.applicationCount > 0 ? '#F59E0B' : textMuted }]}>
          {item.applicationCount}/5 postulados
        </Text>

        {item.alreadyApplied ? (
          <View style={styles.appliedBadge}>
            <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
            <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '600' }}>Postulado</Text>
          </View>
        ) : item.canApply ? (
          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: accent }, applying === item._id && { opacity: 0.6 }]}
            onPress={() => handleApplyPress(item._id)}
            disabled={!!applying}
          >
            {applying === item._id ? (
              <ActivityIndicator color={accentInverse} size="small" />
            ) : (
              <Text style={[styles.applyBtnText, { color: accentInverse }]}>Postularme</Text>
            )}
          </TouchableOpacity>
        ) : (
          <Text style={{ color: textMuted, fontSize: 12 }}>No disponible</Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={textMuted} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={textMuted} style={{ marginBottom: 12 }} />
          <Text style={{ color: textMuted, fontSize: 15, textAlign: 'center' }}>
            No hay solicitudes abiertas por ahora
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Vehicle selection modal */}
      <Modal
        visible={vehicleModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVehicleModal({ visible: false, requestId: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: textPrimary }]}>¿Con qué vehículo te postulás?</Text>
            <ScrollView>
              {vehicles.map(v => (
                <TouchableOpacity
                  key={v._id}
                  style={[styles.vehicleItem, { borderColor: border }]}
                  onPress={() => confirmApply(vehicleModal.requestId, v._id)}
                >
                  <Ionicons name="car-outline" size={20} color={textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.vehicleName, { color: textPrimary }]}>
                      {v.brand} {v.model} {v.year}
                    </Text>
                    <Text style={{ color: textMuted, fontSize: 12 }}>
                      {v.color} · {v.licensePlate}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.cancelModalBtn, { borderColor: border }]}
              onPress={() => setVehicleModal({ visible: false, requestId: null })}
            >
              <Text style={{ color: textMuted }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  city: { fontSize: 14, fontWeight: '600', flex: 1 },
  price: { fontSize: 15, fontWeight: '700' },
  meta: { borderTopWidth: 1, paddingTop: 8, gap: 5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 8 },
  appsCount: { fontSize: 12 },
  appliedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  applyBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  applyBtnText: { fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  vehicleItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 8 },
  vehicleName: { fontSize: 14, fontWeight: '600' },
  cancelModalBtn: { marginTop: 8, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
});

export default OpenTripRequestsScreen;

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { getMyApplications, cancelTripRequestApplication } from '../../../services/tripRequestService';

const APP_STATUS = {
  pending:  { label: 'Pendiente',  color: '#F59E0B' },
  accepted: { label: 'Aceptado',   color: '#22C55E' },
  rejected: { label: 'Rechazado',  color: '#EF4444' },
};

const MyApplicationsScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const dark = isDarkMode;
  const bg        = dark ? '#161616' : '#F9FAFB';
  const cardBg    = dark ? '#1F1F1F' : '#FFFFFF';
  const border    = dark ? '#333333' : '#E5E7EB';
  const textPrimary = dark ? '#FFFFFF' : '#1F2937';
  const textMuted   = dark ? '#9CA3AF' : '#6B7280';
  const divider     = dark ? '#2A2A2A' : '#F3F4F6';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(null);

  const load = async (isRefreshing = false) => {
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getMyApplications();
      if (res.success) setItems(res.data);
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => load(true);

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleCancel = (requestId) => {
    showAlert(
      'Cancelar postulación',
      '¿Estás seguro? Perderás tu lugar en esta solicitud.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancelar postulación',
          style: 'destructive',
          onPress: async () => {
            setCancelling(requestId);
            try {
              const res = await cancelTripRequestApplication(requestId);
              if (res.success) {
                await load();
                showAlert('Postulación cancelada', 'Ya no estás postulado a esta solicitud.');
              }
            } catch (err) {
              showAlert('Error', err.message);
            } finally {
              setCancelling(null);
            }
          }
        }
      ]
    );
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('es-AR', {
      weekday: 'short', day: '2-digit', month: '2-digit',
    });

  const renderItem = ({ item }) => {
    const appStatus = APP_STATUS[item.myApplication?.status] || { label: item.myApplication?.status, color: textMuted };
    const passenger = item.passenger;
    const passengerName = passenger?.firstName
      ? `${passenger.firstName}${passenger.lastName ? ` ${passenger.lastName}` : ''}`
      : 'Pasajero';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => navigation.getParent('AppStack')?.navigate('TripRequestDetail', {
          requestId: item._id,
          mode: 'driver',
          canApply: false,
          alreadyApplied: true,
        })}
        activeOpacity={0.85}
      >
        {/* Header: passenger + status */}
        <View style={styles.cardHeader}>
          <View style={styles.passengerRow}>
            <View style={[styles.avatar, { backgroundColor: dark ? '#333' : '#E8E8E8' }]}>
              <Text style={[styles.avatarText, { color: textPrimary }]}>
                {`${passenger?.firstName?.[0] || ''}${passenger?.lastName?.[0] || ''}` || '?'}
              </Text>
            </View>
            <Text style={[styles.passengerName, { color: textPrimary }]}>{passengerName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: appStatus.color + '22' }]}>
            <Text style={[styles.statusText, { color: appStatus.color }]}>{appStatus.label}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={[styles.routeRow, { borderTopColor: divider }]}>
          <Ionicons name="radio-button-on" size={12} color="#22C55E" />
          <Text style={[styles.city, { color: textPrimary }]} numberOfLines={1}>{item.origin.city}</Text>
          <Ionicons name="arrow-forward" size={12} color={textMuted} />
          <Text style={[styles.city, { color: textPrimary }]} numberOfLines={1}>{item.destination.city}</Text>
          <Ionicons name="chevron-forward" size={14} color={textMuted} />
        </View>

        {/* Meta */}
        <View style={[styles.metaRow, { borderTopColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>
              {formatDate(item.departureDate)} · {item.departureTime}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>
              ${item.pricePerSeat?.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Accepted highlight */}
        {item.myApplication?.status === 'accepted' && (
          <View style={[styles.acceptedBanner, { borderTopColor: divider }]}>
            <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
            <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '600' }}>
              El pasajero te eligió como conductor
            </Text>
          </View>
        )}

        {item.myApplication?.status === 'pending' && (
          <View style={[styles.cancelRow, { borderTopColor: divider }]}>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); handleCancel(item._id); }}
              disabled={cancelling === item._id}
              style={styles.cancelBtn}
            >
              {cancelling === item._id
                ? <ActivityIndicator size="small" color="#EF4444" />
                : <Text style={styles.cancelBtnText}>Retirar postulación</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={textMuted} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={items.length === 0 ? styles.centerFlex : styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="car-outline" size={48} color={textMuted} style={{ marginBottom: 12 }} />
              <Text style={{ color: textMuted, fontSize: 15, textAlign: 'center' }}>
                Todavía no ofreciste viaje a ninguna solicitud
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  centerFlex: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700' },
  passengerName: { fontSize: 14, fontWeight: '600', flex: 1 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  city: { fontSize: 13, fontWeight: '500', flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12 },
  acceptedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  cancelRow: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'flex-end' },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  cancelBtnText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
});

export default MyApplicationsScreen;

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useColors } from '../../../hooks/useColors';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { getMyTripRequests, cancelTripRequest } from '../../../services/tripRequestService';

const STATUS_LABELS = {
  open: { label: 'Abierta', color: '#22C55E' },
  awaiting_payment: { label: 'Pago pendiente', color: '#F59E0B' },
  paid: { label: 'Confirmada', color: '#3B82F6' },
  cancelled: { label: 'Cancelada', color: '#EF4444' },
  expired: { label: 'Vencida', color: '#9CA3AF' }
};

const MyTripRequestsScreen = ({ navigation }) => {
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

  const load = async () => {
    try {
      setLoading(true);
      const res = await getMyTripRequests();
      if (res.success) setRequests(res.data);
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleCancel = (req) => {
    showAlert(
      'Cancelar solicitud',
      '¿Estás seguro? Los conductores que se postularon serán notificados.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancelar solicitud',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelTripRequest(req._id);
              load();
            } catch (err) {
              showAlert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const renderItem = ({ item }) => {
    const statusInfo = STATUS_LABELS[item.status] || { label: item.status, color: textMuted };
    const pendingApps = item.applications?.filter(a => a.status === 'pending').length || 0;
    const totalApps = item.applications?.length || 0;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => navigation.navigate('TripRequestDetail', { requestId: item._id, mode: 'passenger' })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.routeRow}>
            <Ionicons name="radio-button-on" size={13} color="#22C55E" />
            <Text style={[styles.city, { color: textPrimary }]} numberOfLines={1}>{item.origin.city}</Text>
            <Ionicons name="arrow-forward" size={13} color={textMuted} />
            <Text style={[styles.city, { color: textPrimary }]} numberOfLines={1}>{item.destination.city}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '22' }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>

        <View style={[styles.meta, { borderTopColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>{formatDate(item.departureDate)} {item.departureTime}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>${item.pricePerSeat?.toLocaleString()} por asiento</Text>
          </View>
        </View>

        {item.status === 'open' && (
          <View style={[styles.appsRow, { borderTopColor: divider }]}>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={14} color={pendingApps > 0 ? '#F59E0B' : textMuted} />
              <Text style={[styles.metaText, { color: pendingApps > 0 ? '#F59E0B' : textMuted }]}>
                {totalApps}/5 postulaciones
                {pendingApps > 0 ? ` · ${pendingApps} esperando respuesta` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleCancel(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: '#EF4444', fontSize: 12 }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'awaiting_payment' && (
          <View style={[styles.appsRow, { borderTopColor: divider }]}>
            <Text style={{ color: '#F59E0B', fontSize: 12, flex: 1 }}>
              Conductor aceptado — pendiente de pago
            </Text>
            <Ionicons name="chevron-forward" size={15} color={textMuted} />
          </View>
        )}

        {item.status === 'paid' && item.createdTrip && (
          <View style={[styles.appsRow, { borderTopColor: divider }]}>
            <Text style={{ color: '#22C55E', fontSize: 12, flex: 1 }}>
              ¡Viaje confirmado!
            </Text>
            <Ionicons name="chevron-forward" size={15} color={textMuted} />
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
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={textMuted} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyText, { color: textMuted }]}>No tenés solicitudes todavía</Text>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: accent }]}
            onPress={() => navigation.navigate('CreateTripRequest')}
          >
            <Text style={[styles.createBtnText, { color: accentInverse }]}>Publicar solicitud</Text>
          </TouchableOpacity>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  emptyText: { fontSize: 15 },
  createBtn: { marginTop: 8, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  createBtnText: { fontWeight: '700', fontSize: 14 },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  city: { fontSize: 14, fontWeight: '600', flex: 1 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  meta: { borderTopWidth: 1, paddingTop: 8, gap: 5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12 },
  appsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 8 },
});

export default MyTripRequestsScreen;

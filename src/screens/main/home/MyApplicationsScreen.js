import React, { useState, useCallback, useRef } from 'react';
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
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { useUI } from '../../../theme/ui';

// Sin color: aceptado y pendiente siguen en juego y llevan badge solido;
// rechazado va apagado.
const APP_STATUS = {
  pending:  { label: 'Pendiente', solid: true },
  accepted: { label: 'Aceptado',  solid: true },
  rejected: { label: 'Rechazado', solid: false },
};

const MyApplicationsScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const ui = useUI();
  const dark = isDarkMode;
  const bg        = ui.bg;
  const cardBg    = ui.surface;
  const border    = ui.border;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg;

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const fetchingRef = useRef(false);

  const load = useCallback(async (pageNum = 1, reset = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await getMyApplications({ page: pageNum, limit: LIST_PAGE_SIZE });
      if (res.success) {
        setItems(prev => (reset ? res.data : [...prev, ...res.data]));
        setPage(pageNum);
        setHasMore(res.hasMore ?? false);
      }
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  const onRefresh = () => {
    setRefreshing(true);
    load(1, true);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || fetchingRef.current) return;
    setLoadingMore(true);
    load(page + 1, false);
  };

  useFocusEffect(useCallback(() => { load(1, true); }, [load]));

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
    const appStatus = APP_STATUS[item.myApplication?.status] || { label: item.myApplication?.status, solid: false };
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
          <View style={[styles.statusBadge, { backgroundColor: appStatus.solid ? ui.invertBg : ui.surface }]}>
            <Text style={[styles.statusText, { color: appStatus.solid ? ui.invertText : textMuted }]}>{appStatus.label}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={[styles.routeRow, { borderTopColor: divider }]}>
          <Ionicons name="radio-button-on" size={12} color={textPrimary} />
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
            <Ionicons name="checkmark-circle" size={14} color={textPrimary} />
            <Text style={{ color: ui.text, fontSize: 12, fontWeight: '600' }}>
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
                ? <ActivityIndicator size="small" color={textMuted} />
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
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={textMuted} />
              </View>
            ) : null
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
  avatarText: { fontSize: 12, fontFamily: 'Sora_700Bold' },
  passengerName: { fontSize: 14, fontFamily: 'Sora_600SemiBold', flex: 1 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: 'Sora_600SemiBold' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  city: { fontSize: 13, fontFamily: 'Sora_500Medium', flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12 },
  acceptedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  cancelRow: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'flex-end' },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  cancelBtnText: { fontSize: 12, fontFamily: 'Sora_600SemiBold' },
});

export default MyApplicationsScreen;

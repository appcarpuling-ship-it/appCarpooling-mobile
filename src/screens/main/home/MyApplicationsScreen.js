import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAlert } from '../../../context/AlertContext';
import { getMyApplications, cancelTripRequestApplication } from '../../../services/tripRequestService';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { useUI } from '../../../theme/ui';
import EmptyState from '../../../components/ui/EmptyState';
import { reportError } from '../../../utils/sentry';

// Sin color: aceptado y pendiente siguen en juego y llevan badge solido;
// rechazado va apagado.
const APP_STATUS = {
  pending:  { label: 'Pendiente', solid: true },
  accepted: { label: 'Aceptado',  solid: true },
  rejected: { label: 'Rechazado', solid: false },
};

const MyApplicationsScreen = ({ navigation }) => {
  const { showAlert } = useAlert();

  const ui = useUI();
  const bg        = ui.bg;
  const cardBg    = ui.surface;
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
      reportError(err, { screen: 'MyApplicationsScreen', action: 'loadApplications' });
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
                navigation.navigate('Result', { type: 'success', title: 'Postulación cancelada', message: 'Ya no estás postulado a esta solicitud.' });
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

    // El chip apagado va sobre el fondo de pagina, no sobre `surface`: la card ya
    // es `surface` y pintar el chip del mismo color lo dejaba invisible.
    const chipBg = appStatus.solid ? ui.invertBg : bg;
    const chipFg = appStatus.solid ? ui.invertText : textMuted;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg }]}
        onPress={() => navigation.getParent('AppStack')?.navigate('TripRequestDetail', {
          requestId: item._id,
          mode: 'driver',
          canApply: false,
          alreadyApplied: true,
        })}
        activeOpacity={0.7}
      >
        {/* Cabecera: estado arriba, despues la ruta — mismo bloque que Mis Viajes */}
        <View style={styles.cardHeader}>
          <View style={styles.headerTop}>
            <View style={[styles.statusPill, { backgroundColor: chipBg }]}>
              <Text style={[styles.statusPillText, { color: chipFg }]}>{appStatus.label}</Text>
            </View>
            <View style={styles.passengerRow}>
              <View style={[styles.avatar, { backgroundColor: bg }]}>
                <Text style={[styles.avatarText, { color: textPrimary }]}>
                  {`${passenger?.firstName?.[0] || ''}${passenger?.lastName?.[0] || ''}` || '?'}
                </Text>
              </View>
              <Text style={[styles.passengerName, { color: textMuted }]} numberOfLines={1}>
                {passengerName}
              </Text>
            </View>
          </View>

          <View style={styles.routeBlock}>
            <View style={styles.routeDots}>
              <View style={[styles.dotOrigin, { borderColor: textPrimary }]} />
              <View style={[styles.routeConnector, { backgroundColor: divider }]} />
              <View style={[styles.dotDest, { backgroundColor: textPrimary }]} />
            </View>
            <View style={styles.routeLabels}>
              <Text style={[styles.cityText, { color: textPrimary }]} numberOfLines={1}>
                {item.origin.city}
              </Text>
              <Text style={[styles.cityText, { color: textPrimary, marginTop: 10 }]} numberOfLines={1}>
                {item.destination.city}
              </Text>
            </View>
          </View>
        </View>

        {/* Meta */}
        <View style={[styles.metaRow, { borderTopColor: divider, borderBottomColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>{formatDate(item.departureDate)}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>{item.departureTime}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>
              ${item.pricePerSeat?.toLocaleString()}
            </Text>
          </View>
        </View>

        {item.myApplication?.status === 'accepted' && (
          <View style={styles.acceptedBanner}>
            <Ionicons name="checkmark-circle" size={15} color={textPrimary} />
            <Text style={[styles.acceptedText, { color: textPrimary }]}>
              El pasajero te eligió como conductor
            </Text>
          </View>
        )}

        {item.myApplication?.status === 'pending' && (
          <View style={styles.footerRow}>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); handleCancel(item._id); }}
              disabled={cancelling === item._id}
              style={[styles.footerBtnOutline, { borderColor: divider }]}
            >
              {cancelling === item._id
                ? <ActivityIndicator size="small" color={textMuted} />
                : <Text style={[styles.footerBtnOutlineText, { color: textPrimary }]}>Retirar postulación</Text>
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
              <EmptyState
                image={require('../../../../assets/icons/pngwing.com (20).png')}
                title="Todavía no ofreciste viaje"
                subtitle="Cuando te postules a una solicitud, la vas a ver acá."
              />
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

  // Card: mismo lenguaje que MyTripsScreen (radio 24, sin borde, sombra apenas).
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { padding: 16, paddingBottom: 12, gap: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },

  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  avatar: { width: 28, height: 28, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 11, fontFamily: 'Sora_700Bold' },
  passengerName: { fontSize: 12, fontFamily: 'Sora_600SemiBold', flexShrink: 1 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 11, fontFamily: 'Sora_600SemiBold' },

  routeBlock: { flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 },
  routeDots: { width: 14, alignItems: 'center', paddingVertical: 2 },
  dotOrigin: { width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  routeConnector: { width: 1.5, height: 16, marginVertical: 2 },
  dotDest: { width: 9, height: 9, borderRadius: 2 },
  routeLabels: { flex: 1 },
  cityText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  metaDivider: { width: 1, height: 12 },

  acceptedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  acceptedText: { fontSize: 12, fontFamily: 'Sora_600SemiBold' },

  footerRow: { flexDirection: 'row', padding: 12, gap: 8 },
  footerBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  footerBtnOutlineText: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },
});

export default MyApplicationsScreen;

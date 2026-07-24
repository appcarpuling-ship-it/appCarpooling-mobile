import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { getMyTripRequests, cancelTripRequest } from '../../../services/tripRequestService';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { useUI } from '../../../theme/ui';
import EmptyState from '../../../components/ui/EmptyState';

const STATUS_LABELS = {
  open: { label: 'Abierta', solid: true },
  awaiting_payment: { label: 'Pago pendiente', solid: true },
  paid: { label: 'Confirmada', solid: true },
  cancelled: { label: 'Cancelada', solid: false },
  expired: { label: 'Vencida', solid: false }
};

const isUpcoming = (req) => {
  const isPast = ['cancelled', 'expired'].includes(req.status);
  const depDate = new Date(req.departureDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !isPast && depDate >= today;
};

const MyTripRequestsScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();
  const ui = useUI();
  const bg = ui.bg;
  const cardBg = ui.surface;
  const border = ui.border;
  const textPrimary = ui.text;
  const textMuted = ui.textMuted;
  const accent = ui.text;  const accentInverse = ui.invertText;
  const divider = ui.bg;

  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');
  const fetchingRef = useRef(false);

  // El filtro próximas/pasadas lo hace el backend (`when`): filtrarlo acá dejaba
  // páginas de 3 items sobre 10 pedidos y trababa el scroll infinito.
  const load = useCallback(async (pageNum = 1, reset = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await getMyTripRequests({ page: pageNum, limit: LIST_PAGE_SIZE, when: activeTab });
      if (res.success) {
        setRequests(prev => (reset ? res.data : [...prev, ...res.data]));
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
  }, [activeTab, showAlert]);

  const onRefresh = () => {
    setRefreshing(true);
    load(1, true);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || fetchingRef.current) return;
    setLoadingMore(true);
    load(page + 1, false);
  };

  // Cambiar de pestaña reinicia la lista: cada una pagina por su cuenta.
  useFocusEffect(useCallback(() => {
    setLoading(true);
    load(1, true);
  }, [load]));

  const filteredRequests = requests;

  // timeZone UTC: departureDate de una solicitud es un dia de calendario guardado como
  // medianoche UTC. Sin esto, en UTC-3 se muestra el dia anterior.
  const formatDate = (date) =>
    new Date(date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
      .replace(/^(.)/, c => c.toUpperCase());

  const renderItem = ({ item }) => {
    const statusInfo = STATUS_LABELS[item.status] || { label: item.status, color: textMuted };
    const pendingApps = item.applications?.filter(a => a.status === 'pending').length || 0;
    const totalApps = item.applications?.length || 0;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => navigation.getParent('AppStack')?.navigate('TripRequestDetail', { requestId: item._id, mode: 'passenger' })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.routeRow}>
            <Ionicons name="radio-button-on" size={13} color={textPrimary} />
            <Text style={[styles.city, { color: textPrimary }]} numberOfLines={1}>{item.origin.city}</Text>
            <Ionicons name="arrow-forward" size={13} color={textMuted} />
            <Text style={[styles.city, { color: textPrimary }]} numberOfLines={1}>{item.destination.city}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.solid ? ui.invertBg : ui.surface }]}>
            <Text style={[styles.statusText, { color: statusInfo.solid ? ui.invertText : textMuted }]}>{statusInfo.label}</Text>
          </View>
        </View>

        <View style={[styles.meta, { borderTopColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>{formatDate(item.departureDate)} {item.departureTime}</Text>
          </View>
          {/* <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>${item.pricePerSeat?.toLocaleString()} por asiento</Text>
          </View> */}
        </View>

        {item.status === 'open' && (
          <View style={[styles.appsRow, { borderTopColor: divider }]}>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={14} color={textMuted} />
              <Text style={[styles.metaText, { color: pendingApps > 0 ? ui.textMuted : textMuted }]}>
                {totalApps}/5 postulaciones
                {pendingApps > 0 ? ` · ${pendingApps} esperando respuesta` : ''}
              </Text>
            </View>
          </View>
        )}

        {item.status === 'awaiting_payment' && (
          <View style={[styles.appsRow, { borderTopColor: divider }]}>
            <Text style={{ color: ui.textMuted, fontSize: 12, flex: 1 }}>
              Conductor aceptado — pendiente de pago
            </Text>
            <Ionicons name="chevron-forward" size={15} color={textMuted} />
          </View>
        )}

        {item.status === 'paid' && item.createdTrip && (
          <View style={[styles.appsRow, { borderTopColor: divider }]}>
            <Text style={{ color: ui.text, fontSize: 12, flex: 1 }}>
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

      <View style={styles.header}>
        <Text style={[styles.title, { color: ui.text }]}>
          Tus solicitudes{'\n'}
          <Text style={styles.titleStrong}>publicadas</Text>
        </Text>
      </View>

      {/* Tabs en pill, como el resto de la app */}
      <View style={styles.tabsContainer}>
        <View style={[styles.tabPill, { backgroundColor: ui.surface }]}>
          {['upcoming', 'past'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && { backgroundColor: ui.invertBg }]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? ui.invertText : ui.textMuted }]}>
                {tab === 'upcoming' ? 'Próximas' : 'Pasadas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={textMuted} />
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={filteredRequests.length === 0 ? styles.centerFlex : styles.list}
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
                title={activeTab === 'upcoming' ? 'No tenés solicitudes próximas' : 'No tenés solicitudes pasadas'}
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
  emptyText: { fontSize: 15 },
  createBtn: { marginTop: 8, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  createBtnText: { fontFamily: 'Sora_700Bold', fontSize: 14 },

  // Tabs
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
  title: { fontFamily: 'Sora_300Light', fontSize: 32, lineHeight: 40, letterSpacing: -1 },
  titleStrong: { fontFamily: 'Sora_800ExtraBold' },
  tabsContainer: { paddingHorizontal: 24, paddingBottom: 8 },
  tabPill: { flexDirection: 'row', borderRadius: 999, padding: 5 },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  tabText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },

  list: { padding: 16, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  city: { fontSize: 14, fontFamily: 'Sora_600SemiBold', flex: 1 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: 'Sora_600SemiBold' },
  meta: { borderTopWidth: 1, paddingTop: 8, gap: 5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12 },
  appsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 8 },
});

export default MyTripRequestsScreen;

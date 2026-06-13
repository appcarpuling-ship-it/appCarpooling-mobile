import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { getOpenTripRequests } from '../../../services/tripRequestService';

const OpenTripRequestsScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();

  const dark = isDarkMode;
  const bg = dark ? '#161616' : '#F9FAFB';
  const cardBg = dark ? '#1F1F1F' : '#FFFFFF';
  const border = dark ? '#333333' : '#E5E7EB';
  const textPrimary = dark ? '#FFFFFF' : '#1F2937';
  const textMuted = dark ? '#9CA3AF' : '#6B7280';
  const divider = dark ? '#2A2A2A' : '#F3F4F6';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefreshing = false) => {
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getOpenTripRequests();
      if (res.success) setRequests(res.data);
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => load(true);

  useFocusEffect(useCallback(() => { load(); }, []));

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
      .replace(/^(.)/, c => c.toUpperCase());

  const renderItem = ({ item }) => {
    const passenger = item.passenger;
    const passengerName = passenger?.firstName
      ? `${passenger.firstName}${passenger.lastName ? ` ${passenger.lastName}` : ''}`
      : 'Pasajero';
    const initials = `${passenger?.firstName?.[0] || ''}${passenger?.lastName?.[0] || ''}` || '?';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => navigation.getParent('AppStack')?.navigate('TripRequestDetail', {
          requestId: item._id,
          mode: 'driver',
          canApply: item.canApply,
          alreadyApplied: item.alreadyApplied,
        })}
        activeOpacity={0.85}
      >
        {/* Passenger row */}
        <View style={styles.passengerRow}>
          <View style={[styles.passengerAvatar, { backgroundColor: dark ? '#333' : '#E8E8E8' }]}>
            <Text style={[styles.passengerInitials, { color: textPrimary }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.passengerName, { color: textPrimary }]}>{passengerName}</Text>
            <Text style={[styles.metaText, { color: textMuted }]}>
              {formatDate(item.departureDate)} · {item.departureTime}
            </Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={[styles.price, { color: textPrimary }]}>${item.pricePerSeat?.toLocaleString()}</Text>
            <Ionicons name="chevron-forward" size={14} color={textMuted} />
          </View>
        </View>

        {/* Route */}
        <View style={[styles.routeRow, { borderTopColor: divider }]}>
          <Ionicons name="radio-button-on" size={12} color="#22C55E" />
          <Text style={[styles.city, { color: textPrimary }]} numberOfLines={1}>{item.origin.city}</Text>
          <Ionicons name="arrow-forward" size={12} color={textMuted} />
          <Text style={[styles.city, { color: textPrimary }]} numberOfLines={1}>{item.destination.city}</Text>
        </View>
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  passengerAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  passengerInitials: { fontSize: 14, fontWeight: '700' },
  passengerName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  priceTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  price: { fontSize: 15, fontWeight: '700' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  city: { fontSize: 13, fontWeight: '500', flex: 1 },
  metaText: { fontSize: 12 },
});

export default OpenTripRequestsScreen;

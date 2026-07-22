import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Image, ScrollView,
  Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { useAuth } from '../../../context/AuthContext';
import { getOpenTripRequests, getMyTripRequests } from '../../../services/tripRequestService';
import { buildImageUri } from '../../../services/apiService';
import { ARGENTINA_PROVINCES } from '../../../constants/provinces';
import { PROVINCE_IMAGES } from '../../../constants/provinceImages';
import { getDepartmentsForProvince } from '../../../constants/departmentImages';
import { useUI } from '../../../theme/ui';

const OpenTripRequestsScreen = ({ navigation }) => {
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();
  const { isAuthenticated, user } = useAuth();

  const dark          = isDarkMode;

  const ui = useUI();  const bg            = ui.bg;
  const cardBg        = ui.surface;
  const textPrimary   = dark ? '#FFFFFF'  : '#1F2937';
  const textMuted     = dark ? '#9CA3AF'  : '#6B7280';
  const divider       = dark ? '#2A2A2A'  : '#F0F0F0';
  const accent        = dark ? '#FFFFFF'  : '#000000';
  const borderColor   = dark ? '#404040'  : '#E5E7EB';
  const tripRouteMuted  = dark ? textMuted : '#111827';
  const tripCardChevron = ui.text;
  const tripRouteLine   = ui.textMuted;

  const [requests,   setRequests]   = useState([]);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetchingRef = useRef(false);

  // Filters
  const [originProvince,      setOriginProvince]      = useState('');
  const [originCity,          setOriginCity]          = useState('');
  const [destinationProvince, setDestinationProvince] = useState('');
  const [destinationCity,     setDestinationCity]     = useState('');
  const [selectedDate,        setSelectedDate]        = useState(null);
  const [tempDate,            setTempDate]            = useState(null);

  // Picker modals
  const [showOriginPicker,      setShowOriginPicker]      = useState(false);
  const [originStep,            setOriginStep]            = useState('province');
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [destinationStep,       setDestinationStep]       = useState('province');
  const [showDatePicker,        setShowDatePicker]        = useState(false);

  const hasActiveFilters = originProvince || originCity || destinationProvince || destinationCity || selectedDate;

  const clearFilters = () => {
    setOriginProvince(''); setOriginCity('');
    setDestinationProvince(''); setDestinationCity('');
    setSelectedDate(null);
  };

  // Solo se pagina la lista de abiertas. Las solicitudes propias activas son pocas
  // y van mergeadas únicamente en la primera página; en las siguientes se appendea
  // open y se deduplica por _id, porque una propia puede reaparecer más adelante.
  const load = useCallback(async (pageNum = 1, reset = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const filters = { page: pageNum, limit: LIST_PAGE_SIZE };
      if (originCity)      filters.originCity      = originCity;
      if (destinationCity) filters.destinationCity = destinationCity;
      if (selectedDate) {
        const y = selectedDate.getFullYear();
        const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const d = String(selectedDate.getDate()).padStart(2, '0');
        filters.date = `${y}-${m}-${d}`;
      }

      const wantsMine = reset && isAuthenticated;
      const [openRes, myRes] = await Promise.allSettled([
        getOpenTripRequests(filters),
        wantsMine
          ? getMyTripRequests({ when: 'upcoming', limit: LIST_PAGE_SIZE })
          : Promise.resolve({ success: false }),
      ]);
      const open = openRes.status === 'fulfilled' && openRes.value?.success ? openRes.value.data : [];
      const mine = myRes.status  === 'fulfilled' && myRes.value?.success  ? myRes.value.data  : [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const activeMine = mine.filter(r =>
        r.status === 'open' && new Date(r.departureDate) >= today
      );
      const merged = [...open];
      activeMine.forEach(r => { if (!merged.find(x => x._id === r._id)) merged.push(r); });
      merged.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));

      setRequests(prev => {
        if (reset) return merged;
        const seen = new Set(prev.map(r => r._id));
        return [...prev, ...merged.filter(r => !seen.has(r._id))];
      });
      setPage(pageNum);
      setHasMore(
        openRes.status === 'fulfilled' ? (openRes.value?.hasMore ?? false) : false
      );
    } catch (err) {
      showAlert('Error', err.message);
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
      setLoading(false);
      setRefreshing(false);
    }
  }, [originCity, destinationCity, selectedDate, isAuthenticated]);

  useFocusEffect(useCallback(() => { setLoading(true); load(1, true); }, [load]));

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && date) setSelectedDate(date);
      return;
    }
    if (date) setTempDate(date);
  };

  const renderLocationModal = (
    visible, onClose, step, onStepChange,
    selectedProv, onProvSelect, onCitySelect, provTitle, cityTitle
  ) => {
    const provinces = ARGENTINA_PROVINCES.map(p => ({ key: p, label: p }));
    const depts = getDepartmentsForProvince(selectedProv);

    const handleProvSelect = (p) => {
      onProvSelect(p);
      onStepChange('loading');
      setTimeout(() => onStepChange('department'), 2000);
    };

    const handleClose = () => {
      onClose();
      setTimeout(() => onStepChange('province'), 300);
    };

    const title = step === 'province' ? provTitle : selectedProv;

    return (
      <Modal transparent animationType="slide" visible={visible} onRequestClose={handleClose}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
          <View style={[styles.pickerContainer, { backgroundColor: ui.bg }]}>
            <View style={styles.pickerHeader}>
              {step === 'department' && (
                <TouchableOpacity onPress={() => onStepChange('province')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 10 }}>
                  <Ionicons name="arrow-back" size={22} color={textPrimary} />
                </TouchableOpacity>
              )}
              <Text style={[styles.pickerTitle, { color: textPrimary, flex: 1 }]}>{title}</Text>
              <TouchableOpacity style={[styles.pickerClose, { backgroundColor: ui.surface }]} onPress={handleClose}>
                <Ionicons name="close" size={19} color={textPrimary} />
              </TouchableOpacity>
            </View>

            {(step === 'province' || step === 'loading') && (
              <FlatList
                data={provinces}
                keyExtractor={item => item.key}
                numColumns={2}
                columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
                contentContainerStyle={{ paddingTop: 16, paddingBottom: 24, gap: 12 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = selectedProv === item.key;
                  const cardBgItem = isSelected ? (ui.text) : (ui.surface);
                  const imgTint    = isSelected ? (ui.invertText) : (ui.text);
                  const labelColor = isSelected ? (ui.invertText) : textMuted;
                  return (
                    <TouchableOpacity
                      style={[styles.provinceGridItem, {
                        flex: 1, backgroundColor: cardBgItem,
                        borderColor: isSelected ? cardBgItem : borderColor,
                      }]}
                      onPress={() => handleProvSelect(item.key)}
                      activeOpacity={0.75}
                    >
                      <Image source={PROVINCE_IMAGES[item.key]} style={styles.provinceGridImage} tintColor={imgTint} resizeMode="contain" />
                      <Text style={[styles.provinceGridLabel, { color: labelColor }]} numberOfLines={2}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            {step === 'loading' && (
              <View style={styles.pickerLoadingOverlay}>
                <ActivityIndicator size="large" color={accent} />
              </View>
            )}
            {step === 'department' && (
              <>
                <TouchableOpacity
                  style={[styles.deptAllItem, { backgroundColor: ui.surface, borderColor }]}
                  onPress={() => { onCitySelect(''); handleClose(); }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="grid-outline" size={28} color={textMuted} style={{ marginBottom: 6 }} />
                  <Text style={[styles.provinceGridLabel, { color: textMuted }]}>Todos</Text>
                </TouchableOpacity>
                <FlatList
                  data={depts}
                  keyExtractor={item => item.key}
                  numColumns={2}
                  columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
                  contentContainerStyle={{ paddingTop: 12, paddingBottom: 24, gap: 12 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const cardBgItem = ui.surface;
                    const imgTint    = ui.text;
                    return (
                      <TouchableOpacity
                        style={[styles.provinceGridItem, { flex: 1, backgroundColor: cardBgItem, borderColor }]}
                        onPress={() => { onCitySelect(item.label); handleClose(); }}
                        activeOpacity={0.75}
                      >
                        <Image source={item.image} style={styles.provinceGridImage} tintColor={imgTint} resizeMode="contain" />
                        <Text style={[styles.provinceGridLabel, { color: textMuted }]} numberOfLines={2}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  const renderDateModal = () => {
    if (!showDatePicker) return null;
    if (Platform.OS === 'android') {
      return (
        <DateTimePicker
          value={tempDate || selectedDate || new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={handleDateChange}
        />
      );
    }
    return (
      <Modal transparent animationType="fade" visible={showDatePicker} onRequestClose={() => { setTempDate(null); setShowDatePicker(false); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: ui.surface }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.pickerTitle, { color: textPrimary }]}>Seleccionar Fecha</Text>
              <TouchableOpacity onPress={() => { setTempDate(null); setShowDatePicker(false); }}>
                <Ionicons name="close" size={24} color={textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <DateTimePicker
                value={tempDate || selectedDate || new Date()}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={handleDateChange}
                textColor={textPrimary}
                themeVariant={dark ? 'dark' : 'light'}
              />
            </View>
            <View style={styles.pickerButtons}>
              <TouchableOpacity
                style={[styles.pickerButton, { borderColor }]}
                onPress={() => { setSelectedDate(null); setTempDate(null); setShowDatePicker(false); }}
              >
                <Text style={[styles.pickerButtonText, { color: textMuted }]}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: accent, borderColor: accent }]}
                onPress={() => { if (tempDate) setSelectedDate(tempDate); setTempDate(null); setShowDatePicker(false); }}
              >
                <Text style={[styles.pickerButtonText, { color: dark ? '#000' : '#FFF' }]}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderItem = ({ item }) => {
    const passenger = item.passenger || {};
    const name      = passenger.firstName
      ? `${passenger.firstName}${passenger.lastName ? ` ${passenger.lastName}` : ''}`
      : 'Pasajero';
    const initials  = `${passenger.firstName?.[0] || ''}${passenger.lastName?.[0] || ''}` || '?';
    const totalApps = item.applicationCount ?? item.applications?.length ?? 0;
    const isOwn     = passenger._id === user?._id;

    const totalPrice = (item.pricePerSeat || 0) * (item.seatsNeeded || 1);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg }]}
        onPress={() => navigation.getParent('AppStack')?.navigate('TripRequestDetail', {
          requestId: item._id,
          mode: isOwn ? 'passenger' : 'driver',
          canApply: item.canApply,
          alreadyApplied: item.alreadyApplied,
        })}
        activeOpacity={0.7}
      >
        {/* Header: pasajero + fecha */}
        <View style={styles.headerRow}>
          {passenger.avatar ? (
            <Image source={{ uri: buildImageUri(passenger.avatar) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: ui.bg }]}>
              <Text style={[styles.initials, { color: textMuted }]}>{initials}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={[styles.passengerName, { color: textPrimary }]}>{name}</Text>
            <Text style={[styles.dateText, { color: textMuted }]}>
              {/* timeZone UTC: es un dia de calendario, sin esto en UTC-3 muestra el dia anterior */}
              {new Date(item.departureDate).toLocaleDateString('es-ES', {
                weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
              })}{'  '}{item.departureTime || ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={tripCardChevron} />
        </View>

        <View style={[styles.innerDivider, { backgroundColor: divider }]} />

        {/* Ruta */}
        <View style={styles.routeRow}>
          <View style={styles.routeCol}>
            <View style={[styles.routeDot, { borderColor: accent }]} />
            <View style={[styles.routeLine, { backgroundColor: tripRouteLine }]} />
            <View style={[styles.routeDotFilled, { backgroundColor: accent }]} />
          </View>
          <View style={styles.routeInfo}>
            <Text style={[styles.routeLabel, { color: tripRouteMuted }]}>Origen</Text>
            <Text style={[styles.routeValue, { color: textPrimary }]} numberOfLines={2}>
              {item.origin?.address || item.origin?.city}
            </Text>
            <View style={{ height: 14 }} />
            <Text style={[styles.routeLabel, { color: tripRouteMuted }]}>Destino</Text>
            <Text style={[styles.routeValue, { color: textPrimary }]} numberOfLines={2}>
              {item.destination?.address || item.destination?.city}
            </Text>
          </View>
        </View>

        {/* Footer: asientos + precio */}
        <View style={[styles.footer, { borderTopColor: divider }]}>
          <View style={styles.footerItem}>
            <Ionicons name="person-outline" size={13} color={tripRouteMuted} />
            <Text style={[styles.footerText, { color: tripRouteMuted }]}>
              {item.seatsNeeded} asiento{item.seatsNeeded !== 1 ? 's' : ''}
            </Text>
          </View>
          {isOwn && totalPrice > 0 && (
            <View style={styles.footerItem}>
              <Ionicons name="cash-outline" size={13} color={tripRouteMuted} />
              <Text style={[styles.footerText, { color: tripRouteMuted }]}>
                ${totalPrice.toLocaleString('es-AR')}
              </Text>
            </View>
          )}
          {totalApps > 0 && (
            <View style={styles.footerItem}>
              <Ionicons name="people-outline" size={13} color={tripRouteMuted} />
              <Text style={[styles.footerText, { color: tripRouteMuted }]}>
                {totalApps} postulaci{totalApps !== 1 ? 'ones' : 'ón'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const chipActive  = { backgroundColor: ui.invertBg, borderColor: dark ? 'transparent' : '#000000' };
  const chipDefault = { backgroundColor: ui.surface, borderColor: borderColor };
  const chipTextActive  = { color: ui.invertText };
  const chipTextDefault = { color: textMuted };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
      {/* Filter chips */}
      <View style={[styles.filtersSection, { borderBottomColor: borderColor }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, originCity || originProvince ? chipActive : chipDefault]}
            onPress={() => { setOriginStep(originProvince ? 'department' : 'province'); setShowOriginPicker(true); }}
            activeOpacity={0.7}
          >
            <Ionicons name="radio-button-on" size={14} color={originCity || originProvince ? chipTextActive.color : textMuted} />
            <Text style={[styles.filterChipText, originCity || originProvince ? chipTextActive : chipTextDefault]} numberOfLines={1}>
              {originCity || originProvince || 'Origen'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, destinationCity || destinationProvince ? chipActive : chipDefault]}
            onPress={() => { setDestinationStep(destinationProvince ? 'department' : 'province'); setShowDestinationPicker(true); }}
            activeOpacity={0.7}
          >
            <Ionicons name="location" size={14} color={destinationCity || destinationProvince ? chipTextActive.color : textMuted} />
            <Text style={[styles.filterChipText, destinationCity || destinationProvince ? chipTextActive : chipTextDefault]} numberOfLines={1}>
              {destinationCity || destinationProvince || 'Destino'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedDate ? chipActive : chipDefault]}
            onPress={() => { setTempDate(selectedDate || new Date()); setShowDatePicker(true); }}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={14} color={selectedDate ? chipTextActive.color : textMuted} />
            <Text style={[styles.filterChipText, selectedDate ? chipTextActive : chipTextDefault]}>
              {selectedDate ? selectedDate.toLocaleDateString('es-ES') : 'Fecha'}
            </Text>
          </TouchableOpacity>

          {hasActiveFilters && (
            <TouchableOpacity
              style={[styles.filterChip, { backgroundColor: dark ? '#3A1A1A' : '#FEF2F2', borderColor: dark ? '#5A2A2A' : '#FECACA' }]}
              onPress={clearFilters}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={14} color={textMuted} />
              <Text style={[styles.filterChipText, { color: textMuted }]}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={textMuted} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={textMuted} style={{ marginBottom: 12 }} />
          <Text style={{ color: textMuted, fontSize: 15, textAlign: 'center' }}>
            {hasActiveFilters ? 'Sin resultados para estos filtros' : 'No hay solicitudes abiertas por ahora'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (!hasMore || loadingMore || fetchingRef.current) return;
            setLoadingMore(true);
            load(page + 1, false);
          }}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(1, true); }}
              tintColor={textMuted}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={textMuted} />
              </View>
            ) : null
          }
        />
      )}

      {renderLocationModal(
        showOriginPicker, () => setShowOriginPicker(false),
        originStep, setOriginStep,
        originProvince, setOriginProvince, (city) => { setOriginCity(city); },
        'Seleccionar provincia de origen', 'Seleccionar ciudad de origen'
      )}
      {renderLocationModal(
        showDestinationPicker, () => setShowDestinationPicker(false),
        destinationStep, setDestinationStep,
        destinationProvince, setDestinationProvince, (city) => { setDestinationCity(city); },
        'Seleccionar provincia de destino', 'Seleccionar ciudad de destino'
      )}
      {renderDateModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list:         { padding: 16 },

  filtersSection: { borderBottomWidth: StyleSheet.hairlineWidth },
  filtersRow:     { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontFamily: 'Sora_500Medium' },

  card:            { borderRadius: 14, marginBottom: 12 },
  headerRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  avatar:          { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  initials:        { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  headerInfo:      { flex: 1, gap: 3 },
  passengerName:   { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  dateText:        { fontSize: 12 },
  innerDivider:    { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  routeRow:        { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, gap: 14 },
  routeCol:        { width: 22, alignItems: 'center', paddingTop: 4 },
  routeDot:        { width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  routeLine:       { width: 1.5, height: 28, marginVertical: 3 },
  routeDotFilled:  { width: 9, height: 9, borderRadius: 5 },
  routeInfo:       { flex: 1 },
  routeLabel:      { fontSize: 11, fontFamily: 'Sora_500Medium', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  routeValue:      { fontSize: 14, fontFamily: 'Sora_500Medium' },
  footer:          { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
  footerItem:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText:      { fontSize: 12 },

  // Picker modals
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerContainer: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' },
  pickerHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 14 },
  pickerTitle:     { fontSize: 24, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.5 },
  pickerClose:     { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pickerLoadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  pickerButtons:   { flexDirection: 'row', gap: 12, padding: 16 },
  pickerButton:    { flex: 1, paddingVertical: 14, borderRadius: 999, borderWidth: 1, alignItems: 'center' },
  pickerButtonText: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },

  provinceGridItem:  { borderRadius: 18, padding: 14, alignItems: 'center' },
  provinceGridImage: { width: 48, height: 48, marginBottom: 8 },
  provinceGridLabel: { fontSize: 12, fontFamily: 'Sora_500Medium', textAlign: 'center' },
  deptAllItem:       { borderRadius: 18, padding: 14, alignItems: 'center', marginHorizontal: 24, marginTop: 16 },
});

export default OpenTripRequestsScreen;

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SafePlacesAutocomplete from '../../../components/SafePlacesAutocomplete';
import { get_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useColors } from '../../../hooks/useColors';
import { useAlert } from '../../../context/AlertContext';

import { getGoogleMapsApiKey } from '../../../config/googleMapsEnv';

const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();

const CreateTripGoogleMaps = ({ navigation }) => {
  const { colors, isDarkMode } = useColors();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const isMounted = useRef(true);

  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const waypointInputRefs = useRef([]);

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [activeAutocomplete, setActiveAutocomplete] = useState(null);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const originResultsRef = useRef([]);
  const destinationResultsRef = useRef([]);
  const waypointResultsRef = useRef([]);
  const waypointDebounceTimers = useRef([]);

  const [formData, setFormData] = useState({
    origin: { address: '', city: '', province: '', coordinates: null },
    destination: { address: '', city: '', province: '', coordinates: null },
    waypoints: [],
  });

  useEffect(() => {
    isMounted.current = true;
    loadVehicles();
    return () => { isMounted.current = false; };
  }, []);

  const screenWasBlurred = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (screenWasBlurred.current) {
        setActiveAutocomplete(null);
        setAutocompleteResults([]);
        screenWasBlurred.current = false;
      }
      return () => { screenWasBlurred.current = true; };
    }, [])
  );

  const loadVehicles = async () => {
    try {
      if (!isMounted.current) return;
      setLoadingVehicles(true);
      const response = await get_withauth(ENDPOINTS.MY_VEHICLES);
      if (!isMounted.current) return;
      if (response && response.success && Array.isArray(response.data)) {
        setVehicles(response.data);
      } else {
        setVehicles([]);
      }
    } catch (error) {
      console.error('❌ Error loading vehicles:', error);
      if (isMounted.current) setVehicles([]);
    } finally {
      if (isMounted.current) setLoadingVehicles(false);
    }
  };

  const parseAddressComponents = (components) => {
    let city = '';
    let province = '';
    let street = '';
    let streetNumber = '';
    if (Array.isArray(components)) {
      components.forEach(component => {
        if (Array.isArray(component?.types)) {
          if (component.types.includes('street_number')) streetNumber = component.long_name || '';
          if (component.types.includes('route')) street = component.long_name || '';
          if (component.types.includes('locality')) city = component.long_name || '';
          if (component.types.includes('administrative_area_level_2') && !city) city = component.long_name || '';
          if (component.types.includes('administrative_area_level_1')) province = component.long_name || '';
        }
      });
    }
    if (!city && province) city = province;
    return { city, province, street, streetNumber };
  };

  const handleOriginSelect = (data, details = null) => {
    if (!isMounted.current) return;
    setActiveAutocomplete(null);
    setAutocompleteResults([]);
    if (details?.geometry?.location) {
      const coords = { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng };
      const { city, province, street, streetNumber } = parseAddressComponents(details.address_components);
      const fullStreet = [street, streetNumber].filter(Boolean).join(' ');
      const fullText = [fullStreet || data?.description?.split(',')[0] || '', city, province].filter(Boolean).join(', ');
      setFormData(prev => ({ ...prev, origin: { address: data?.description || '', city, province, country: 'Argentina', coordinates: coords } }));
      if (originInputRef.current?.setAddressText) originInputRef.current.setAddressText(fullText);
    }
  };

  const handleDestinationSelect = (data, details = null) => {
    if (!isMounted.current) return;
    setActiveAutocomplete(null);
    setAutocompleteResults([]);
    if (details?.geometry?.location) {
      const coords = { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng };
      const { city, province, street, streetNumber } = parseAddressComponents(details.address_components);
      const fullStreet = [street, streetNumber].filter(Boolean).join(' ');
      const fullText = [fullStreet || data?.description?.split(',')[0] || '', city, province].filter(Boolean).join(', ');
      setFormData(prev => ({ ...prev, destination: { address: data?.description || '', city, province, country: 'Argentina', coordinates: coords } }));
      if (destinationInputRef.current?.setAddressText) destinationInputRef.current.setAddressText(fullText);
    }
  };

  const handleWaypointSelect = (data, details, waypointIndex) => {
    if (!isMounted.current) return;
    setActiveAutocomplete(null);
    setAutocompleteResults([]);
    if (details?.geometry?.location) {
      const coords = { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng };
      const { city, province, street, streetNumber } = parseAddressComponents(details.address_components);
      const fullStreet = [street, streetNumber].filter(Boolean).join(' ');
      const fullText = [fullStreet || data?.description?.split(',')[0] || '', city, province].filter(Boolean).join(', ');
      setFormData(prev => {
        const newWaypoints = [...prev.waypoints];
        newWaypoints[waypointIndex] = { address: data?.description || '', city, province, coordinates: coords };
        return { ...prev, waypoints: newWaypoints };
      });
      if (waypointInputRefs.current[waypointIndex]?.current?.setAddressText) {
        waypointInputRefs.current[waypointIndex].current.setAddressText(fullText);
      }
    }
  };

  const addWaypoint = () => {
    if (formData.waypoints.length >= 3) {
      showAlert('Límite alcanzado', 'Máximo 3 paradas intermedias permitidas');
      return;
    }
    setFormData(prev => ({ ...prev, waypoints: [...prev.waypoints, { address: '', city: '', province: '', coordinates: null }] }));
    waypointInputRefs.current.push(React.createRef());
    waypointResultsRef.current.push([]);
    waypointDebounceTimers.current.push(null);
  };

  const removeWaypoint = (index) => {
    setFormData(prev => ({ ...prev, waypoints: prev.waypoints.filter((_, i) => i !== index) }));
    waypointInputRefs.current.splice(index, 1);
    waypointResultsRef.current.splice(index, 1);
    waypointDebounceTimers.current.splice(index, 1);
    if (activeAutocomplete === `waypoint-${index}`) {
      setActiveAutocomplete(null);
      setAutocompleteResults([]);
    }
  };

  const clearOrigin = () => {
    setFormData(prev => ({ ...prev, origin: { address: '', city: '', province: '', coordinates: null } }));
    if (originInputRef.current?.setAddressText) originInputRef.current.setAddressText('');
  };

  const clearDestination = () => {
    setFormData(prev => ({ ...prev, destination: { address: '', city: '', province: '', coordinates: null } }));
    if (destinationInputRef.current?.setAddressText) destinationInputRef.current.setAddressText('');
  };

  const handleContinue = () => {
    if (!formData.origin.coordinates || !formData.destination.coordinates) {
      showAlert('Datos incompletos', 'Por favor selecciona origen y destino');
      return;
    }
    if (loadingVehicles) {
      showAlert('Un momento', 'Estamos verificando tus vehículos...');
      return;
    }
    if (!vehicles || vehicles.length === 0) {
      showAlert('Vehículo requerido', 'Necesitas registrar un vehículo antes de crear un viaje', [{ text: 'Cancelar', style: 'cancel' }]);
      return;
    }
    navigation.navigate('TripDetails', {
      origin: formData.origin,
      destination: formData.destination,
      waypoints: formData.waypoints.filter(wp => wp.coordinates !== null),
      distance: null,
      duration: null,
      vehicles,
    });
  };

  if (loadingVehicles) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>Verificando vehículos...</Text>
      </View>
    );
  }

  if (!vehicles || vehicles.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="car-outline" size={64} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tienes vehículos registrados</Text>
        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
          Necesitas registrar un vehículo antes de crear un viaje
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Crear viaje</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Map not available banner */}
        <View style={[styles.mapBanner, { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF', borderColor: isDarkMode ? '#334155' : '#BFDBFE' }]}>
          <Ionicons name="map-outline" size={18} color={isDarkMode ? '#93C5FD' : '#3B82F6'} />
          <Text style={[styles.mapBannerText, { color: isDarkMode ? '#93C5FD' : '#1D4ED8' }]}>
            El mapa interactivo no está disponible en la versión web. Ingresa las direcciones manualmente.
          </Text>
        </View>

        {/* Inputs card */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          {/* Timeline + inputs */}
          <View style={styles.inputsWrapper}>
            {/* Timeline */}
            <View style={styles.timeline}>
              <View style={[styles.originDot, { backgroundColor: colors.success }]} />
              <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
              {formData.waypoints.map((_, i) => (
                <React.Fragment key={i}>
                  <View style={[styles.waypointDot, { backgroundColor: '#666' }]} />
                  <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                </React.Fragment>
              ))}
              <View style={[styles.destinationSquare, { backgroundColor: colors.error }]} />
            </View>

            {/* Inputs */}
            <View style={{ flex: 1 }}>
              {/* Origin */}
              <View style={styles.inputRow}>
                <SafePlacesAutocomplete
                  inputRef={originInputRef}
                  placeholder="¿Desde dónde sales?"
                  onPress={handleOriginSelect}
                  apiKey={GOOGLE_MAPS_API_KEY}
                  debounce={1500}
                  inputType="origin"
                  onFocusChange={(type) => {
                    if (type === 'origin') { setActiveAutocomplete('origin'); setAutocompleteResults(originResultsRef.current); }
                    else if (type !== null) { setActiveAutocomplete(null); setAutocompleteResults([]); }
                  }}
                  onResultsChange={(results) => {
                    originResultsRef.current = results;
                    if (activeAutocomplete === 'origin') setAutocompleteResults(results);
                  }}
                  externalResults={[]}
                  externalLoading={false}
                  styles={{
                    container: { flex: 1 },
                    textInput: { height: 44, color: colors.textPrimary, fontSize: 16, fontWeight: '500', backgroundColor: 'transparent', paddingHorizontal: 12 },
                  }}
                />
                {formData.origin.address ? (
                  <TouchableOpacity onPress={clearOrigin} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Waypoints */}
              {formData.waypoints.map((waypoint, index) => {
                if (!waypointInputRefs.current[index]) waypointInputRefs.current[index] = React.createRef();
                return (
                  <React.Fragment key={`wp-${index}`}>
                    <View style={styles.inputRow}>
                      <SafePlacesAutocomplete
                        inputRef={waypointInputRefs.current[index]}
                        placeholder={`Parada ${index + 1} (opcional)`}
                        onPress={(data, details) => handleWaypointSelect(data, details, index)}
                        apiKey={GOOGLE_MAPS_API_KEY}
                        debounce={1500}
                        inputType={`waypoint-${index}`}
                        onFocusChange={(type) => {
                          if (type === `waypoint-${index}`) { setActiveAutocomplete(`waypoint-${index}`); setAutocompleteResults(waypointResultsRef.current[index] || []); }
                          else if (type !== null) { setActiveAutocomplete(null); setAutocompleteResults([]); }
                        }}
                        onResultsChange={(results) => {
                          waypointResultsRef.current[index] = results;
                          if (activeAutocomplete === `waypoint-${index}`) setAutocompleteResults(results);
                        }}
                        externalResults={[]}
                        externalLoading={false}
                        styles={{
                          container: { flex: 1 },
                          textInput: { height: 44, color: colors.textPrimary, fontSize: 16, fontWeight: '500', backgroundColor: 'transparent', paddingHorizontal: 12 },
                        }}
                      />
                      <TouchableOpacity onPress={() => removeWaypoint(index)} style={styles.clearBtn}>
                        <Ionicons name="close-circle" size={18} color={waypoint.address ? colors.error : colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  </React.Fragment>
                );
              })}

              {/* Add waypoint */}
              {formData.waypoints.length < 3 && (
                <>
                  <TouchableOpacity onPress={addWaypoint} style={styles.addWaypointBtn}>
                    <Ionicons name="add-circle" size={20} color={colors.primary} />
                    <Text style={[styles.addWaypointText, { color: colors.primary }]}>Agregar parada</Text>
                  </TouchableOpacity>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                </>
              )}

              {/* Destination */}
              <View style={styles.inputRow}>
                <SafePlacesAutocomplete
                  inputRef={destinationInputRef}
                  placeholder="¿A dónde vas?"
                  onPress={handleDestinationSelect}
                  apiKey={GOOGLE_MAPS_API_KEY}
                  debounce={1500}
                  inputType="destination"
                  onFocusChange={(type) => {
                    if (type === 'destination') { setActiveAutocomplete('destination'); setAutocompleteResults(destinationResultsRef.current); }
                    else if (type !== null) { setActiveAutocomplete(null); setAutocompleteResults([]); }
                  }}
                  onResultsChange={(results) => {
                    destinationResultsRef.current = results;
                    if (activeAutocomplete === 'destination') setAutocompleteResults(results);
                  }}
                  externalResults={[]}
                  externalLoading={false}
                  styles={{
                    container: { flex: 1 },
                    textInput: { height: 44, color: colors.textPrimary, fontSize: 16, fontWeight: '500', backgroundColor: 'transparent', paddingHorizontal: 12 },
                  }}
                />
                {formData.destination.address ? (
                  <TouchableOpacity onPress={clearDestination} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          {/* Autocomplete results */}
          {activeAutocomplete && autocompleteResults.length > 0 && (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={[styles.results, { borderTopColor: colors.border }]}
              nestedScrollEnabled
            >
              {autocompleteResults.map((item) => (
                <TouchableOpacity
                  key={item.place_id}
                  style={[styles.resultRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&key=${GOOGLE_MAPS_API_KEY}&language=es&fields=address_components,geometry,formatted_address`;
                    fetch(detailsUrl)
                      .then(res => res.json())
                      .then(data => {
                        if (data?.result) {
                          if (activeAutocomplete === 'origin') handleOriginSelect({ description: item.description }, data.result);
                          else if (activeAutocomplete === 'destination') handleDestinationSelect({ description: item.description }, data.result);
                          else if (activeAutocomplete?.startsWith('waypoint-')) {
                            const idx = parseInt(activeAutocomplete.split('-')[1]);
                            handleWaypointSelect({ description: item.description }, data.result, idx);
                          }
                        }
                      });
                    setActiveAutocomplete(null);
                    setAutocompleteResults([]);
                  }}
                  activeOpacity={0.6}
                >
                  <View style={[styles.resultIcon, { backgroundColor: isDarkMode ? '#292929' : '#F3F4F6' }]}>
                    <Ionicons name="location-sharp" size={16} color={isDarkMode ? '#FFF' : '#292929'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resultMain, { color: colors.textPrimary }]} numberOfLines={1}>
                      {item.structured_formatting?.main_text || item.description}
                    </Text>
                    <Text style={[styles.resultSub, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.structured_formatting?.secondary_text || ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Continue button */}
        <TouchableOpacity
          style={[
            styles.continueBtn,
            { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' },
            (!formData.origin.coordinates || !formData.destination.coordinates) && { opacity: 0.4 },
          ]}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={[styles.continueBtnText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>
            Confirmar ruta
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  statusText: { marginTop: 16, fontSize: 14 },
  emptyText: { fontSize: 20, fontWeight: '600', marginTop: 24, textAlign: 'center' },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  mapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  mapBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  inputsWrapper: { flexDirection: 'row', alignItems: 'stretch' },
  timeline: {
    width: 28,
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 8,
  },
  originDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { flex: 1, width: 2, marginVertical: 4, minHeight: 20 },
  waypointDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: 'transparent' },
  destinationSquare: { width: 10, height: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingRight: 8 },
  divider: { height: 1, marginLeft: 12, marginRight: 12 },
  clearBtn: { padding: 6 },
  addWaypointBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingLeft: 12, paddingRight: 16 },
  addWaypointText: { marginLeft: 8, fontSize: 16, fontWeight: '500' },
  results: { borderTopWidth: 1, maxHeight: 220 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  resultIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  resultMain: { fontSize: 15, fontWeight: '500' },
  resultSub: { fontSize: 13, marginTop: 2 },
  continueBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  continueBtnText: { fontSize: 16, fontWeight: '700' },
});

export default CreateTripGoogleMaps;

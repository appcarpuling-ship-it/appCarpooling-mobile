import React, { useState, useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';

// Mapa de un punto de un pasajero —recogida o bajada—, con un solo marcador. Se abre desde
// Reservas Recibidas con { coordinates:{latitude,longitude}, address, label? }.
const PickupMapScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { coordinates, address, label } = route.params || {};

  // El mapa se suelta al perder el foco: es una vista nativa cara y en un stack sigue montada
  // aunque no se vea. Apilar varias fue lo que hizo que iOS matara la app por RAM.
  const estaEnfoco = useIsFocused();

  // El punto solo no le dice al conductor si le queda cerca o cruzando la ciudad. Con su
  // propia posición en el mapa lo ve de una, igual que en "Ver trayecto en el mapa".
  const [showMyLocation, setShowMyLocation] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => { if (!cancelled && status === 'granted') setShowMyLocation(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const region = coordinates?.latitude
    ? { latitude: coordinates.latitude, longitude: coordinates.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: -34.6037, longitude: -58.3816, latitudeDelta: 0.5, longitudeDelta: 0.5 };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={ui.isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Solo con la pantalla enfocada: ver PointPickerScreen. */}
      {estaEnfoco && <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        paddingAdjustmentBehavior="never"
        showsUserLocation={showMyLocation}
        showsMyLocationButton={false}
      >
        {coordinates?.latitude && (
          Platform.OS === 'android'
            ? <Marker coordinate={{ latitude: coordinates.latitude, longitude: coordinates.longitude }} anchor={{ x: 0.5, y: 0.5 }} image={require('../../../assets/marker-origin.png')} />
            // Sin hijos, react-native-maps dibuja el pin rojo por defecto de Google, que
            // no se parece a nada del resto de la app. Este es el mismo marcador que usa
            // "Ver trayecto en el mapa" para el origen (TripMapScreen).
            : <Marker coordinate={{ latitude: coordinates.latitude, longitude: coordinates.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.pinHalo}><View style={styles.pinCore} /></View>
              </Marker>
        )}
      </MapView>}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: ui.card }]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={ui.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.addressCard, { backgroundColor: ui.card, paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.addressLabel, { color: ui.textMuted }]}>{(label || 'Punto de recogida').toUpperCase()}</Text>
        <Text style={[styles.addressText, { color: ui.text }]}>{address || 'Sin dirección'}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  pinHalo: { width: 22, height: 22, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  pinCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#010101' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 40, height: 40, borderRadius: 999, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  addressCard: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 24, paddingTop: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
  },
  addressLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5, marginBottom: 6 },
  addressText: { fontSize: 16, fontFamily: 'Sora_600SemiBold', lineHeight: 22 },
});

export default PickupMapScreen;

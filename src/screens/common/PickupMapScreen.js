import React, { useState, useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { View, Text, Image, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '../../utils/mapProvider';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';

// El marcador va siempre sobre una placa blanca (ver pinBadge), así que no hace falta la
// variante clara/oscura del ícono: el negro sobre blanco se ve igual en los dos modos.
const ICONO_PASAJERO = require('../../../assets/icons/icon-passenger-black.png');

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
        provider={MAP_PROVIDER}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        paddingAdjustmentBehavior="never"
        showsUserLocation={showMyLocation}
        /* Sin edificios 3D, POIs ni interiores: texturas que ocupan RAM y no aportan acá. */
        showsBuildings={false}
        showsIndoors={false}
        showsPointsOfInterest={false}
        showsMyLocationButton={false}
      >
        {/* El ícono de pasajero va ACÁ, en el marcador: esta pantalla es siempre el punto de
            recogida o bajada de un pasajero, así que no hace falta condición para mostrarlo. */}
        {coordinates?.latitude && (
          <Marker coordinate={{ latitude: coordinates.latitude, longitude: coordinates.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.pinBadge}>
              <Image source={ICONO_PASAJERO} style={styles.pinIcon} resizeMode="contain" />
            </View>
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
  // Placa blanca con borde: sobre un mapa oscuro un ícono negro solo se funde con el fondo,
  // igual que le pasaba al punto sin el anillo blanco antes de este cambio.
  pinBadge: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  pinIcon: { width: 20, height: 20 },
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

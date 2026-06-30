import React from 'react';
import { View, Text } from 'react-native';

const MapView = ({ style, children }) => (
  <View style={[{ backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }, style]}>
    <Text style={{ color: '#6b7280' }}>Mapa no disponible en web</Text>
    {children}
  </View>
);

export const Marker = () => null;
export const Polyline = () => null;
export const PROVIDER_GOOGLE = 'google';

export default MapView;

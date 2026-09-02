import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DeviceInfo from 'react-native-device-info';

/**
 * ponytail: herramienta de UNA sola vez para verificar a ojo que el pop-al-root de tabs
 * (MainTabNavigator) libera memoria de verdad, sacando la pila de pantallas que quedaban
 * vivas al cambiar de tab (ver commit f61ff0c). Sacar este componente y su import de
 * MainTabNavigator una vez confirmado — no es algo para dejar en la app.
 *
 * Oculto por defecto: aparece con mantener presionado el logo de Inicio (ver HomeScreen).
 * getUsedMemorySync ya viene con react-native-device-info (dependencia ya instalada).
 */
export default function MemoryHUD() {
  const [mb, setMb] = useState(null);

  useEffect(() => {
    const tick = () => {
      try {
        setMb(Math.round(DeviceInfo.getUsedMemorySync() / 1024 / 1024));
      } catch {
        // no-op: si el método no está en este binario (build viejo), no mostrar nada.
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (mb === null) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.text}>{mb} MB</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 50,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 9999,
    elevation: 9999,
  },
  text: {
    color: '#00FF88',
    fontSize: 12,
    fontWeight: '700',
  },
});

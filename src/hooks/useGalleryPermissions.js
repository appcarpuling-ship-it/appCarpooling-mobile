import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';
import { showAlertAsync } from '../context/AlertContext';
import { reportError } from '../utils/sentry';

/**
 * Selector de imágenes.
 *
 * La galería NO pide permisos: desde expo-image-picker 17 (SDK 54),
 * `launchImageLibraryAsync` abre el selector del sistema (Android Photo Picker /
 * PHPicker en iOS), que corre en otro proceso y devuelve solo lo que el usuario
 * elige. Por eso no hace falta acceso a la galería.
 *
 * Antes esto consultaba los permisos antes de abrir, y eso causaba dos problemas:
 * la demora de un viaje extra al código nativo, y que a veces no abriera nada
 * (si el estado no daba exactamente 'granted' —p. ej. acceso parcial en Android—
 * se cortaba y mostraba un modal). Además un listener de AppState reseteaba el
 * estado y volvía a consultar en cada vuelta al primer plano, que es justo lo que
 * pasa al volver de elegir la foto.
 *
 * La cámara sí necesita permiso: la foto la saca la app, no el sistema.
 */
export const useGalleryPermissions = () => {
  // Se mantiene por la API del hook: hoy el modal de galería no se usa nunca.
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const openSettings = () => {
    Linking.openSettings();
    setShowPermissionModal(false);
  };

  const pickImage = async (options = {}) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        ...options,
      });
      return result.canceled ? null : result.assets[0];
    } catch (error) {
      reportError(error, { hook: 'useGalleryPermissions', action: 'pickImage' });
      showAlertAsync('Error', 'No se pudo abrir la galería');
      return null;
    }
  };

  /**
   * Saca una foto con la cámara. Permisos aparte de los de galería: los textos que ve
   * el usuario salen del plugin expo-image-picker en app.json (cameraPermission), así
   * que esto necesita build nativo nuevo — por OTA no alcanza.
   */
  const takePhoto = async (options = {}) => {
    try {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        // Denegado para siempre: volver a pedirlo no muestra nada, hay que ir a Ajustes.
        if (!canAskAgain) {
          showAlertAsync(
            'Permiso de cámara',
            'Habilitá la cámara para Carpuling desde los ajustes del teléfono.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Ir a ajustes', onPress: openSettings },
            ]
          );
        } else {
          showAlertAsync('Permiso de cámara', 'Necesitamos la cámara para sacar la foto.');
        }
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        ...options,
      });

      return result.canceled ? null : result.assets[0];
    } catch (error) {
      reportError(error, { hook: 'useGalleryPermissions', action: 'takePhoto' });
      showAlertAsync('Error', 'No se pudo abrir la cámara');
      return null;
    }
  };

  return {
    showPermissionModal,
    setShowPermissionModal,
    pickImage,
    takePhoto,
    openSettings,
    // La galería ya no necesita permiso: se mantienen para no tocar las pantallas que
    // los consumen (VehicleFormScreen hace `if (!hasPermission) return`).
    handlePermissionRequest: async () => true,
    forceRefreshPermissions: async () => 'granted',
  };
};

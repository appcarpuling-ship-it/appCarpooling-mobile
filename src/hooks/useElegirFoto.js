import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useGalleryPermissions } from './useGalleryPermissions';
import { useAlert } from '../context/AlertContext';

/**
 * El selector Cámara / Galería / Cancelar, en un solo lugar.
 *
 * El mismo bloque estaba copiado en RegisterScreen, EditProfileScreen y VehicleFormScreen
 * —tres veces las mismas 40 líneas, con la comprensión de que cambia sólo el setter—. Al
 * sumar el envío de fotos por el chat iban a ser cuatro, así que se extrajo acá.
 *
 *   const elegirFoto = useElegirFoto();
 *   elegirFoto((uri) => setFoto(uri), { titulo: 'Enviar foto' });
 *
 * La imagen vuelve YA comprimida (1200px de ancho, JPEG 70%): una foto de cámara moderna
 * son 4-8 MB y el límite de subida son 10, así que sin esto la subida falla o tarda una
 * eternidad con datos móviles.
 */
export const useElegirFoto = () => {
  const { handlePermissionRequest, takePhoto } = useGalleryPermissions();
  const { showAlert } = useAlert();

  const comprimir = async (uri) => {
    try {
      const r = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      return r.uri;
    } catch {
      // Si falla el manipulador se manda el original: peor es no poder mandar nada.
      return uri;
    }
  };

  /**
   * @param {(uri: string) => void} onElegida
   * @param {object}   [opts]
   * @param {string}   [opts.titulo]     título del selector
   * @param {string}   [opts.mensaje]
   * @param {boolean}  [opts.recortar]   deja recortar antes de confirmar
   * @param {Function} [opts.onEmpezar]  para prender un spinner mientras comprime
   * @param {Function} [opts.onTerminar]
   */
  return (onElegida, opts = {}) => {
    const {
      titulo = 'Subir foto',
      mensaje = '¿De dónde la querés sacar?',
      recortar = false,
      onEmpezar,
      onTerminar,
    } = opts;

    const usar = async (uri) => {
      if (!uri) return;
      onEmpezar?.();
      try {
        onElegida(await comprimir(uri));
      } finally {
        onTerminar?.();
      }
    };

    showAlert(titulo, mensaje, [
      {
        text: 'Cámara',
        onPress: async () => {
          const asset = await takePhoto({ allowsEditing: recortar, quality: 0.85 });
          await usar(asset?.uri);
        },
      },
      {
        text: 'Galería',
        onPress: async () => {
          const hasPermission = await handlePermissionRequest();
          if (!hasPermission) return;
          try {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsMultipleSelection: false,
              allowsEditing: recortar,
              quality: 0.85,
            });
            if (!result.canceled) await usar(result.assets?.[0]?.uri);
          } catch {
            showAlert('Ocurrió algo', 'No pudimos abrir esa imagen.');
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };
};

export default useElegirFoto;

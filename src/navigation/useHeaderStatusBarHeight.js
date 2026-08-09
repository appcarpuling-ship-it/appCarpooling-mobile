import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Alto que el header de los stacks reserva para la barra de estado.
 *
 * React Navigation ya usa el inset del sistema por su cuenta, así que esto no corrige
 * un cálculo: agrega aire. En Android con edge-to-edge el recorte de la cámara baja un
 * par de píxeles más que el inset de la barra de estado, y la flecha de atrás termina
 * pegada al borde del notch. En iOS el inset alcanza, así que ahí no se toca.
 *
 * Vive acá y no repetido en cada stack porque son cuatro navegadores con el mismo
 * header y el mismo problema.
 */
export const useHeaderStatusBarHeight = () => {
  const insets = useSafeAreaInsets();
  return insets.top + (Platform.OS === 'android' ? 8 : 0);
};

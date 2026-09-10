import { useWindowDimensions } from 'react-native';

/**
 * Ancho de pantalla para layouts (carruseles, tarjetas, grillas).
 *
 * Sale de `useWindowDimensions` y NO de `Dimensions.get('window')` a nivel de módulo: en web
 * ese valor queda clavado en el tamaño que tenía la ventana al cargar, y al achicarla las
 * tarjetas quedaban gigantes. El hook además sigue los resize.
 *
 * Tope por defecto 480: la app es un teléfono en vertical, en una ventana de escritorio ancha
 * las tarjetas no tienen que crecer sin límite.
 */
export function useScreenWidth(max = 480) {
  const { width } = useWindowDimensions();
  return Math.min(width || 390, max);
}

export default useScreenWidth;

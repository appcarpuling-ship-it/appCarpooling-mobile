import { useEffect, useRef, useState } from 'react';

/**
 * Mantiene `true` al menos `minMs`, aunque `active` pase a false antes.
 *
 * Sin esto, un loading que resuelve rapidísimo (fetch en caché, conexión rápida) hace que
 * el skeleton aparezca y desaparezca casi en el mismo frame — el swap abrupto entre el
 * placeholder y el contenido real se siente como que "salta" la pantalla en vez de una
 * carga real. Con el mínimo, la transición es perceptible y se lee como intencional.
 */
export function useMinDuration(active, minMs = 400) {
  const [shown, setShown] = useState(active);
  const startedAtRef = useRef(active ? Date.now() : null);

  useEffect(() => {
    if (active) {
      startedAtRef.current = Date.now();
      setShown(true);
      return undefined;
    }
    if (startedAtRef.current == null) {
      setShown(false);
      return undefined;
    }
    const elapsed = Date.now() - startedAtRef.current;
    if (elapsed >= minMs) {
      setShown(false);
      return undefined;
    }
    const t = setTimeout(() => setShown(false), minMs - elapsed);
    return () => clearTimeout(t);
  }, [active, minMs]);

  return shown;
}

export default useMinDuration;

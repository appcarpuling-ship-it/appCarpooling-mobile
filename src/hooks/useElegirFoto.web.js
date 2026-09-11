import { useAlert } from '../context/AlertContext';

/**
 * Versión web de `useElegirFoto`.
 *
 * En el navegador no hay "Cámara / Galería": es un `<input type="file">` y listo. El
 * diálogo de la versión nativa acá salía como dos pastillas vacías (ver captura del
 * usuario), así que se saltea entero.
 *
 * Misma firma que la nativa: `elegirFoto((uri) => ..., { onEmpezar, onTerminar })`.
 * El `uri` que devuelve es un blob URL — `appendFile` en web hace `fetch(uri).blob()`,
 * así que funciona igual que un uri de ImagePicker.
 */
const comprimir = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    // Una foto de cámara de celular moderna son 4-8 MB y el límite de subida son 10.
    if (file.size < 3 * 1024 * 1024) {
      resolve(url);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob ? URL.createObjectURL(blob) : url);
        },
        'image/jpeg',
        0.7,
      );
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });

export const useElegirFoto = () => {
  const { showAlert } = useAlert();

  return (onElegida, opts = {}) => {
    const { onEmpezar, onTerminar } = opts;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showAlert('Ocurrió algo', 'Elegí una imagen.');
        return;
      }
      onEmpezar?.();
      try {
        onElegida(await comprimir(file));
      } finally {
        onTerminar?.();
      }
    };
    input.click();
  };
};

export default useElegirFoto;

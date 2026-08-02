import { Image, Platform } from 'react-native';
import { reportError } from './sentry';

// React Native acepta fd.append(campo, { uri, name, type }) y su polyfill de
// FormData lo convierte en archivo. El navegador NO: append() serializa el
// objeto como "[object Object]" y lo manda como campo de texto, así que multer
// recibe cero archivos y el endpoint responde 400. En web hay que subir un Blob.
const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  gif: 'image/gif',
};

const typeFor = (filename) => {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return MIME[ext] || 'image/jpeg';
};

/**
 * Agrega un archivo local (uri de ImagePicker/cámara) a un FormData, en el
 * formato que espera cada plataforma. Siempre hay que await-earlo: en web
 * necesita leer el blob.
 */
/**
 * Android: si el ContentResolver no puede abrir alguno de los archivos, el
 * NetworkingModule de React Native aborta el request ENTERO antes de mandarlo.
 * Axios lo ve como "Network Error" sin respuesta, o sea igual que estar sin
 * internet, y el servidor no se entera de nada: ninguna subida multipart desde
 * Android llegó nunca al backend, mientras las de iOS entraban siempre.
 * Chequear el archivo antes convierte ese fallo mudo en un error con nombre.
 */
const isReadable = (uri) =>
  new Promise((resolve) => Image.getSize(uri, () => resolve(true), () => resolve(false)));

export async function appendFile(fd, field, uri, fallbackName) {
  if (!uri) return;

  if (Platform.OS === 'android' && !(await isReadable(uri))) {
    const error = new Error(`No pudimos leer la imagen de "${field}". Volvé a elegirla.`);
    // El scheme del uri es el dato que falta para saber por qué el
    // ContentResolver lo rechaza (file://, content://, algo del picker).
    reportError(error, { helper: 'appendFile', field, uri });
    throw error;
  }

  const fromUri = uri.split('/').pop();
  const base = fallbackName || fromUri || `${field}.jpg`;
  const name = base.includes('.') ? base : `${base}.jpg`;
  const type = typeFor(name);

  if (Platform.OS === 'web') {
    const blob = await fetch(uri).then((r) => r.blob());
    fd.append(field, blob, name);
    return;
  }

  fd.append(field, { uri, name, type });
}

export default appendFile;

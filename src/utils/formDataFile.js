import { Platform } from 'react-native';

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
export async function appendFile(fd, field, uri, fallbackName) {
  if (!uri) return;

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

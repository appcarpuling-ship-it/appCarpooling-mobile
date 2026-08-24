/**
 * Rutas únicas de fotos de un vehículo: `photo` principal + array `photos`, sin duplicar.
 *
 * Extraído de TripDetailScreen, que era el único lugar que lo tenía, para que TripMapScreen
 * pudiera usarlo sin copiarlo.
 */
export function collectVehiclePhotoPaths(vehicle) {
  if (!vehicle) return [];
  const raw = [];
  if (vehicle.photo) raw.push(vehicle.photo);
  if (Array.isArray(vehicle.photos)) raw.push(...vehicle.photos);
  const seen = new Set();
  const out = [];
  for (const p of raw) {
    if (p == null || typeof p !== 'string') continue;
    const norm = p.trim();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

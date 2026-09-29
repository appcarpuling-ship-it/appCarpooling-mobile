import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import { imageForType } from '../../utils/vehicleImage';
import { buildImageUri } from '../../services/apiService';

// La foto ocupa un alto fijo, pero ATENCIÓN: fijo no es lo mismo que pegada arriba de la
// pantalla. Es un elemento más del ScrollView (ver el render) — sube y baja con el resto del
// detalle. Antes vivía en un View aparte por encima del scroll, con los botones de
// editar/eliminar y el resumen de papeles flotando arriba: quedaba fija mientras el detalle se
// movía debajo, y encima tapaba parte de la foto. Ahora la foto queda limpia y esas dos cosas
// bajaron a texto plano (ver acciones y DOCUMENTACIÓN).
const HERO_H = 220;

const FEATURES = [
  { key: 'ac', label: 'Aire acondicionado', icon: 'snow-outline' },
  { key: 'music', label: 'Música', icon: 'musical-notes-outline' },
  { key: 'smoking', label: 'Se puede fumar', icon: 'flame-outline' },
  { key: 'pets', label: 'Mascotas', icon: 'paw-outline' },
  { key: 'luggage', label: 'Equipaje grande', icon: 'bag-handle-outline' },
];

// Mismas etiquetas que el selector de VehicleFormScreen: si difieren, el mismo tipo se
// muestra con dos nombres distintos según la pantalla.
const TYPE_LABELS = {
  sedan: 'Auto',
  hatchback: 'Auto',
  suv: 'Auto-camioneta',
  van: 'Camioneta',
  pickup: 'Camioneta',
  otro: 'Otro',
};

const fecha = (d) => {
  const t = d ? new Date(d) : null;
  if (!t || isNaN(t)) return null;
  return t.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Estado de un papel del vehículo, leyendo el vencimiento como lo que importa: un seguro
 * vencido es tan inservible como no tenerlo, así que no alcanza con "cargado / no cargado".
 */
const estadoDoc = (url, vence) => {
  if (!url) return { texto: 'Falta cargarlo', alerta: true };
  const f = vence ? new Date(vence) : null;
  if (f && !isNaN(f) && f < new Date()) return { texto: `Vencido el ${fecha(vence)}`, alerta: true };
  if (f && !isNaN(f)) return { texto: `Vence el ${fecha(vence)}`, alerta: false };
  return { texto: 'Cargado', alerta: false };
};

/**
 * Un vehículo a página completa: la foto arriba y todo el detalle scrolleando abajo, TODO
 * dentro del mismo scroll — nada queda fijo mientras el resto se mueve.
 *
 * Lo usan "Mis vehículos" (VehicleDetailScreen, al tocar una fila del índice) y el selector
 * de vehículo para un viaje, que son la misma pantalla con distintos botones: `acciones` son
 * Editar/Eliminar, en texto junto al título — en la lista propia sí, en el selector no.
 *
 * @param {Object} vehicle
 * @param {number} width        ancho de la página
 * @param {Array}  acciones     [{ icon, onPress, label }], junto al título
 * @param {number} aireAbajo    espacio extra al final del scroll, para lo que flote encima
 *                              de la pantalla
 */
const VehicleShowcase = ({ vehicle, width, acciones = [], aireAbajo = 0 }) => {
  const ui = useUI();
  const [fotoIndex, setFotoIndex] = useState(0);

  const fotos = (vehicle.photos || []).filter(Boolean);
  // `photo` es el campo viejo de una sola foto, y su default es una de picsum que no es el
  // auto de nadie: se ignora, como ya hacía la lista.
  const fotoSuelta = vehicle.photo && !vehicle.photo.includes('picsum') ? vehicle.photo : null;
  const galeria = fotos.length ? fotos : (fotoSuelta ? [fotoSuelta] : []);
  const fotoActual = galeria[Math.min(fotoIndex, galeria.length - 1)];

  const activas = FEATURES.filter((f) => vehicle.features?.[f.key]);
  const tipo = TYPE_LABELS[vehicle.type] || vehicle.type;
  const subtitulo = [vehicle.year, tipo, vehicle.color].filter(Boolean).join(' · ');

  const docs = [
    { label: 'Seguro', ...estadoDoc(vehicle.insuranceUrl, vehicle.insuranceExpiry) },
    { label: 'VTV / RTO', ...estadoDoc(vehicle.inspectionUrl, vehicle.inspectionExpiry) },
    { label: 'Cédula verde', ...estadoDoc(vehicle.registrationCardUrl, null) },
  ];

  const editarAccion = acciones.find((a) => a.icon === 'create-outline');
  const eliminarAccion = acciones.find((a) => a.icon === 'trash-outline');

  // Hasta 4 fotos entran repartidas a lo ancho de la pantalla, que se ven mejor que
  // amontonadas a la izquierda. De 5 para arriba no entrarían sin achicarse a nada: ahí pasa
  // a carrusel horizontal, con las miniaturas a tamaño fijo.
  const enCarrusel = galeria.length > 4;
  const anchoMini = enCarrusel
    ? 104
    : Math.floor((width - 40 - 8 * (galeria.length - 1)) / Math.max(galeria.length, 1));

  const carga = [
    vehicle.cargoSpaceLiters ? `${vehicle.cargoSpaceLiters} L de baúl` : null,
    vehicle.maxCargoWeightKg ? `hasta ${vehicle.maxCargoWeightKg} kg` : null,
  ].filter(Boolean);

  return (
    <ScrollView
      style={{ width, flex: 1 }}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + aireAbajo }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { height: HERO_H, backgroundColor: ui.surface }]}>
        {fotoActual ? (
          <Image source={{ uri: buildImageUri(fotoActual) }} style={styles.heroImg} resizeMode="cover" />
        ) : (
          // Sin fotos, el dibujo del tipo. El ícono genérico de auto hacía que una camioneta
          // y un sedán sin fotos se vieran idénticos.
          <Image source={imageForType(vehicle.type)} style={styles.heroFallback} resizeMode="contain" />
        )}
      </View>

      {/* Miniaturas: tocarlas cambia la foto grande, en vez de ser una fila decorativa. */}
      {galeria.length > 1 && (() => {
        const minis = galeria.map((foto, i) => (
          <TouchableOpacity key={`${foto}-${i}`} onPress={() => setFotoIndex(i)} activeOpacity={0.8}>
            <Image
              source={{ uri: buildImageUri(foto) }}
              style={[
                styles.miniatura,
                { width: anchoMini },
                { backgroundColor: ui.surface, borderColor: i === fotoIndex ? ui.text : 'transparent' },
              ]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ));
        return enCarrusel ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniaturas}>
            {minis}
          </ScrollView>
        ) : (
          <View style={styles.miniaturas}>{minis}</View>
        );
      })()}

      <Text style={[styles.nombre, { color: ui.text }]} numberOfLines={2}>
        {vehicle.brand} {vehicle.model}
      </Text>
      {!!subtitulo && <Text style={[styles.subtitulo, { color: ui.textMuted }]}>{subtitulo}</Text>}

      <View style={styles.chips}>
        {!!vehicle.licensePlate && (
          <View style={[styles.chip, { backgroundColor: ui.invertBg }]}>
            <Text style={[styles.chipText, { color: ui.invertText }]}>{vehicle.licensePlate}</Text>
          </View>
        )}
        {!!vehicle.capacity && (
          <View style={[styles.chip, { backgroundColor: ui.surface }]}>
            <Text style={[styles.chipText, { color: ui.text }]}>{vehicle.capacity} asientos</Text>
          </View>
        )}
      </View>

      {/* Comodidades y documentación comparten el mismo patrón: renglones separados por una
          línea fina, sin chips ni pastillas — es lo que reemplaza a las dos versiones viejas,
          una en chips y otra en filas sueltas con íconos de estado. */}
      {activas.length > 0 && (
        <View style={styles.bloque}>
          <Text style={[styles.bloqueTitulo, { color: ui.textMuted }]}>COMODIDADES</Text>
          {activas.map((f, i) => (
            <View
              key={f.key}
              style={[styles.renglon, { borderTopColor: ui.border }, i === activas.length - 1 && { borderBottomWidth: 1, borderBottomColor: ui.border }]}
            >
              <Ionicons name={f.icon} size={18} color={ui.text} />
              <Text style={[styles.renglonTexto, { color: ui.text }]}>{f.label}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.bloque}>
        <Text style={[styles.bloqueTitulo, { color: ui.textMuted }]}>DOCUMENTACIÓN</Text>
        {docs.map((d, i) => (
          <View
            key={d.label}
            style={[styles.renglon, styles.renglonDoc, { borderTopColor: ui.border }, i === docs.length - 1 && { borderBottomWidth: 1, borderBottomColor: ui.border }]}
          >
            <Text style={[styles.docLabel, { color: ui.text }]}>{d.label}</Text>
            <View style={styles.docEstadoFila}>
              {d.alerta && <Ionicons name="alert-circle" size={14} color={ui.text} />}
              <Text style={[styles.docEstado, { color: d.alerta ? ui.text : ui.textMuted }, d.alerta && styles.docEstadoAlerta]}>
                {d.texto}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {carga.length > 0 && (
        <View style={styles.bloque}>
          <Text style={[styles.bloqueTitulo, { color: ui.textMuted }]}>CARGA</Text>
          <Text style={[styles.cargaText, { color: ui.text }]}>{carga.join(' · ')}</Text>
        </View>
      )}

      {/* Editar/Eliminar al pie, mismo patrón que Compartir/Cancelar en el detalle del viaje:
          dos botones pill a flex 1, dentro del flujo del scroll (no una barra fija). Sólo en
          la ficha propia — el selector de vehículo no pasa `acciones`. */}
      {(editarAccion || eliminarAccion) && (
        <View style={styles.footer}>
          {!!editarAccion && (
            <TouchableOpacity
              style={[styles.footerBtnOutline, { borderColor: ui.border }]}
              onPress={editarAccion.onPress}
              accessibilityRole="button"
              accessibilityLabel={editarAccion.label}
            >
              <Text style={[styles.footerBtnOutlineText, { color: ui.text }]}>Editar</Text>
            </TouchableOpacity>
          )}
          {!!eliminarAccion && (
            <TouchableOpacity
              style={[styles.footerBtnOutline, { backgroundColor: '#EF4444', borderColor: '#EF4444' }]}
              onPress={eliminarAccion.onPress}
              accessibilityRole="button"
              accessibilityLabel={eliminarAccion.label}
            >
              <Text style={[styles.footerBtnOutlineText, { color: '#FFFFFF' }]}>Eliminar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16 },

  hero: { borderRadius: 20, overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%' },
  heroFallback: { width: '100%', height: '100%', padding: 24 },

  miniaturas: { flexDirection: 'row', gap: 8, paddingTop: 10 },
  // Alto fijo y ancho variable: repartidas a lo ancho quedan apaisadas, que es la forma de
  // una foto de auto. Cuadradas y grandes (dos fotos = dos cuadrados enormes) se comían la
  // pantalla.
  miniatura: { height: 80, borderRadius: 14, borderWidth: 2 },

  nombre: { fontFamily: 'Sora_800ExtraBold', fontSize: 24, letterSpacing: -0.6, marginTop: 20 },
  subtitulo: { fontFamily: 'Sora_500Medium', fontSize: 13, marginTop: 4 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontFamily: 'Sora_600SemiBold', fontSize: 12 },

  bloque: { marginTop: 22 },
  bloqueTitulo: { fontFamily: 'Sora_700Bold', fontSize: 11, letterSpacing: 0.6, marginBottom: 2 },
  renglon: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: 1 },
  renglonTexto: { fontFamily: 'Sora_500Medium', fontSize: 14, flex: 1 },
  renglonDoc: { justifyContent: 'space-between' },
  docLabel: { fontFamily: 'Sora_600SemiBold', fontSize: 14 },
  docEstadoFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docEstado: { fontFamily: 'Sora_500Medium', fontSize: 13 },
  docEstadoAlerta: { fontFamily: 'Sora_700Bold' },
  cargaText: { fontFamily: 'Sora_500Medium', fontSize: 14, marginTop: 8 },

  // Mismas medidas que footerBtnOutline en TripDetailScreen (52 de alto, pill, 1.5 de borde):
  // es el estilo de botón de acción de toda la app, no algo nuevo para esta pantalla.
  footer: { flexDirection: 'row', gap: 10, marginTop: 28 },
  footerBtnOutline: {
    flex: 1, height: 52, borderRadius: 999, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  footerBtnOutlineText: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
});

export default VehicleShowcase;

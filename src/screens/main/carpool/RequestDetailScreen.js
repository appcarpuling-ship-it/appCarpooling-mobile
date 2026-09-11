import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { buildImageUri } from '../../../services/apiService';
import { useUI } from '../../../theme/ui';
import { montoSena } from '../../../utils/sena';
import {
  getStatusConSena,
  estadoDe,
  esperandoRespuesta,
  seatsLabelEs,
  fmtCuando,
} from '../../../utils/solicitudes';

const fmtFechaHora = (d) =>
  !d ? '' : new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) +
    ' a las ' + new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

/**
 * Una solicitud de reserva entera: para qué viaje es, quién la pidió, su mensaje, dónde sube
 * y dónde baja, cuánto te desvía, la seña (si el viaje la pide) y los botones para
 * aceptarla/rechazarla o confirmar que la seña llegó.
 *
 * Se abre desde la bandeja (TripRequestsScreen) tocando una fila. Va como PANTALLA y no como
 * modal: el modal dejaba un parpadeo en blanco al cerrarse y en Android su botón de atrás se
 * escapaba a la navegación, sacando al conductor de la pantalla. Además es lo que ya hace el
 * resto de la app —VehiclePicker, DriverPricePicker, PointPicker son todas pantallas—.
 *
 *   navigation.navigate('RequestDetail', { request, trip, tripId, onAceptar, onRechazar, onConfirmarSena })
 *     request     la solicitud tal como la devuelve /bookings/trip/:id
 *     trip        el viaje (selectedTrip de la bandeja) — para el contexto y el precio/seña
 *     tripId      para poder abrir el perfil del pasajero en el contexto de este viaje
 *     onAceptar   () => void, lo resuelve la bandeja (abre el diálogo de confirmación)
 *     onRechazar  () => void, ídem (abre el cuadro del motivo)
 *     onConfirmarSena () => void, ídem — sólo si el viaje pide seña y el pasajero ya la mandó
 */
const RequestDetailScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { request, trip, tripId, onAceptar, onRechazar, onConfirmarSena } = route.params || {};
  const [fotoAmpliada, setFotoAmpliada] = useState(false);

  if (!request) {
    return (
      <View style={[styles.vacio, { backgroundColor: ui.bg }]}>
        <Text style={{ color: ui.textMuted }}>No encontramos la solicitud.</Text>
      </View>
    );
  }

  const rs = estadoDe(request);
  const pendiente = esperandoRespuesta(rs);
  const status = getStatusConSena(request);
  const sena = request.sena?.estado;
  const seats = request.seatsBooked || request.seatsRequested || 1;
  const avatarUrl = request.passenger?.avatar ? buildImageUri(request.passenger.avatar) : null;
  const puntos = [
    { punto: request.seatReservation?.pickupLocation, rotulo: 'Sube en', fin: false },
    { punto: request.seatReservation?.dropoffLocation, rotulo: 'Baja en', fin: true },
  ].filter(({ punto }) => punto?.address);

  const pideSena = trip?.requiereSena || !!sena;
  const alConductor = (Number(trip?.driverPrice) || 0) * seats;
  const monto = montoSena(trip?.driverPrice, seats);

  /**
   * El goBack va ANTES del callback, no después.
   *
   * Los dos callbacks navegan —aceptar abre el diálogo de confirmación, rechazar el cuadro del
   * motivo—, así que al revés las dos acciones caen en el mismo tick: el navigate apila la
   * pantalla nueva y el goBack se la lleva puesta. El síntoma es que el botón "no hace nada".
   * Mismo orden que VehiclePicker y DriverPricePicker, por el mismo motivo.
   */
  const salirY = (fn) => () => {
    navigation.goBack();
    fn?.();
  };

  return (
    <View style={[styles.container, { backgroundColor: ui.bg, paddingTop: insets.top + 6 }]}>
      <View style={[styles.header, { borderBottomColor: ui.bg }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={[styles.headerBtn, { backgroundColor: ui.surface }]}
          accessibilityRole="button"
          accessibilityLabel="Volver a las solicitudes"
        >
          <Ionicons name="arrow-back" size={20} color={ui.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ui.text }]}>Solicitud</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        {/* El viaje al que corresponde esta solicitud: sin esto, abrir la ficha de golpe
            perdía todo el contexto de la bandeja (qué viaje, cuándo sale). */}
        {!!trip && (
          <View>
            <Text style={[styles.ruta, { color: ui.text }]}>
              {trip.origin?.city} → {trip.destination?.city}
            </Text>
            <Text style={[styles.rutaSub, { color: ui.textMuted }]}>
              {trip.departureDate ? new Date(trip.departureDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
              {trip.departureTime ? ` · ${trip.departureTime}` : ''}
            </Text>
          </View>
        )}

        {/* Quién pide. Toca y vas a su perfil. */}
        <TouchableOpacity
          style={[styles.passengerRow, { backgroundColor: ui.surface }]}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate('UserProfile', { userId: request.passenger?._id, tripId })
          }
          disabled={!request.passenger?._id}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: ui.bg }]}>
              <Text style={[styles.avatarInitials, { color: ui.textMuted }]}>
                {request.passenger?.firstName?.[0]}{request.passenger?.lastName?.[0]}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.passengerName, { color: ui.text }]} numberOfLines={1}>
              {request.passenger?.firstName} {request.passenger?.lastName}
            </Text>
            <Text style={[styles.reqSub, { color: ui.textMuted }]} numberOfLines={1}>
              {seatsLabelEs(seats)} · pidió {fmtCuando(request.createdAt)}
            </Text>
          </View>
          {!!request.passenger?._id && (
            <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
          )}
        </TouchableOpacity>

        <View style={styles.filaEntre}>
          {/* El estado sólo cuando NO es "esperando": con los botones Aceptar y Rechazar
              abajo, un cartel que diga "esperando tu aprobación" no agrega nada. */}
          {!pendiente ? (
            <View style={[styles.statusPill, { backgroundColor: status.solid ? ui.invertBg : ui.surface }]}>
              <Text style={[styles.statusPillText, { color: status.solid ? ui.invertText : ui.textMuted }]}>
                {status.label}
              </Text>
            </View>
          ) : <View />}
          {!trip?.sinPrecioFijo && alConductor > 0 && (
            <Text style={[styles.precio, { color: ui.text }]}>
              ${alConductor.toLocaleString('es-AR')}
            </Text>
          )}
        </View>

        {!!request.message && (
          <Text style={[styles.mensaje, { color: ui.textMuted, borderColor: ui.border }]}>
            "{request.message}"
          </Text>
        )}

        {puntos.length > 0 && (
          <View style={[styles.rutaCard, { backgroundColor: ui.surface }]}>
            {puntos.map(({ punto, rotulo, fin }, i) => {
              const hasCoords = punto.coordinates?.latitude != null;
              return (
                <View key={rotulo}>
                  <View style={styles.rutaFila}>
                    <View style={fin ? [styles.dotFin, { backgroundColor: ui.text }] : [styles.dotIni, { borderColor: ui.text }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.puntoRotulo, { color: ui.textMuted }]}>{rotulo}</Text>
                      <Text style={[styles.puntoDir, { color: ui.text }]}>{punto.address}</Text>
                    </View>
                    {hasCoords && (
                      <TouchableOpacity
                        style={[styles.mapBtn, { backgroundColor: ui.bg, borderColor: ui.border }]}
                        onPress={() =>
                          navigation.navigate('PickupMap', {
                            coordinates: punto.coordinates,
                            address: punto.address,
                            label: rotulo,
                          })
                        }
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver ${rotulo} en el mapa`}
                      >
                        <Ionicons name="map-outline" size={18} color={ui.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {i < puntos.length - 1 && <View style={[styles.rutaDivider, { backgroundColor: ui.bg }]} />}
                </View>
              );
            })}

            {/* Cuánto lo saca de su camino. Las dos direcciones solas no le dicen nada al
                conductor si no conoce el barrio: este número es lo que le permite decidir. */}
            {!!request.desvioEtiqueta && (
              <View style={[styles.desvio, { borderTopColor: ui.bg }]}>
                <Ionicons
                  name={request.desvioKm > 2 ? 'git-branch-outline' : 'checkmark-circle-outline'}
                  size={14}
                  color={request.desvioKm > 2 ? ui.textMuted : '#10B981'}
                />
                <Text style={[styles.desvioText, { color: request.desvioKm > 2 ? ui.textMuted : '#10B981' }]}>
                  {request.desvioEtiqueta}
                </Text>
              </View>
            )}
          </View>
        )}

        {request.status === 'rejected' && !!request.rejectionReason && (
          <Text style={[styles.rechazo, { color: ui.textMuted, borderColor: ui.border }]}>
            Motivo del rechazo: {request.rejectionReason}
          </Text>
        )}

        {/* Seña: cuánto es, en qué anda, y el comprobante — sigue visible después de
            confirmada, como registro de lo que el pasajero transfirió. */}
        {pideSena && (
          <View style={[styles.senaCard, { backgroundColor: ui.surface }]}>
            <View style={styles.senaHeader}>
              <Text style={[styles.rotuloSeccion, { color: ui.textMuted, marginBottom: 0 }]}>SEÑA</Text>
              {monto > 0 && (
                <Text style={[styles.senaMonto, { color: ui.text }]}>${monto.toLocaleString('es-AR')}</Text>
              )}
            </View>

            {sena === 'esperando' && (
              <View style={styles.senaEstado}>
                <Ionicons name="hourglass-outline" size={16} color={ui.textMuted} />
                <Text style={[styles.senaEstadoText, { color: ui.textMuted }]}>
                  Ya lo aceptaste. Avisamos cuando suba el comprobante.
                </Text>
              </View>
            )}

            {sena === 'enviada' && (
              <View style={styles.senaEstado}>
                <Ionicons name="time-outline" size={16} color={ui.textMuted} />
                <Text style={[styles.senaEstadoText, { color: ui.textMuted }]}>
                  Mandó el comprobante{request.sena?.enviadaAt ? ` el ${fmtFechaHora(request.sena.enviadaAt)}` : ''}. Confirmá si te llegó.
                </Text>
              </View>
            )}

            {sena === 'confirmada' && (
              <View style={styles.senaEstado}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
                <Text style={[styles.senaEstadoText, { color: ui.textMuted }]}>
                  Confirmaste que te llegó{request.sena?.confirmadaAt ? ` el ${fmtFechaHora(request.sena.confirmadaAt)}` : ''}.
                </Text>
              </View>
            )}

            {/* Una captura se edita, así que no prueba nada por sí sola: sirve para que el
                conductor sepa qué buscar en su cuenta. Quien confirma es él. */}
            {!!request.sena?.comprobanteUrl && (sena === 'enviada' || sena === 'confirmada') && (
              <TouchableOpacity
                onPress={() => setFotoAmpliada(true)}
                activeOpacity={0.85}
                style={styles.comprobanteTouch}
              >
                <Image
                  source={{ uri: buildImageUri(request.sena.comprobanteUrl) }}
                  style={[styles.comprobante, { backgroundColor: ui.bg }]}
                  resizeMode="cover"
                />
                <View style={[styles.comprobanteZoom, { backgroundColor: ui.bg }]}>
                  <Ionicons name="expand-outline" size={15} color={ui.text} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {pendiente && (
          <View style={styles.acciones}>
            <TouchableOpacity
              style={[styles.btnReject, { borderColor: ui.border }]}
              onPress={salirY(onRechazar)}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnRejectText, { color: ui.text }]}>Rechazar</Text>
            </TouchableOpacity>
            {sena !== 'esperando' && (
              <TouchableOpacity
                style={[styles.btnAccept, { backgroundColor: ui.invertBg }]}
                onPress={salirY(sena === 'enviada' ? onConfirmarSena : onAceptar)}
                activeOpacity={0.8}
              >
                <Text style={[styles.btnAcceptText, { color: ui.invertText }]}>
                  {sena === 'enviada' ? 'Me llegó la seña' : 'Aceptar'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={fotoAmpliada} transparent animationType="fade" onRequestClose={() => setFotoAmpliada(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setFotoAmpliada(false)}>
          {!!request.sena?.comprobanteUrl && (
            <Image
              source={{ uri: buildImageUri(request.sena.comprobanteUrl) }}
              style={styles.overlayImg}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: 'Sora_700Bold', fontSize: 20, letterSpacing: -0.5, textAlign: 'center' },

  body: { padding: 20, gap: 16 },

  ruta: { fontSize: 20, fontFamily: 'Sora_700Bold', letterSpacing: -0.5 },
  rutaSub: { fontSize: 13, fontFamily: 'Sora_400Regular', marginTop: 3, textTransform: 'capitalize' },

  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  passengerName: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  reqSub: { fontSize: 13, fontFamily: 'Sora_400Regular', marginTop: 3 },

  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -6 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 11, fontFamily: 'Sora_600SemiBold' },
  precio: { fontSize: 17, fontFamily: 'Sora_700Bold' },

  mensaje: {
    fontSize: 13.5, fontFamily: 'Sora_400Regular', lineHeight: 20, fontStyle: 'italic',
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14,
  },

  rutaCard: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  rutaFila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5 },
  puntoRotulo: { fontSize: 11, fontFamily: 'Sora_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.3 },
  puntoDir: { fontSize: 14, fontFamily: 'Sora_600SemiBold', lineHeight: 19, marginTop: 1 },
  mapBtn: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  dotIni: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, flexShrink: 0 },
  dotFin: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  rutaDivider: { height: 1, marginLeft: 20 },
  desvio: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  desvioText: { fontSize: 12, fontFamily: 'Sora_600SemiBold' },

  rechazo: {
    fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 19,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14,
  },

  senaCard: { borderRadius: 18, padding: 16, gap: 12 },
  senaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rotuloSeccion: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5 },
  senaMonto: { fontSize: 20, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.5 },
  senaEstado: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  senaEstadoText: { flex: 1, fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 19 },

  comprobanteTouch: { borderRadius: 14, overflow: 'hidden' },
  comprobante: { width: '100%', height: 220, borderRadius: 14 },
  comprobanteZoom: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
  },

  acciones: { flexDirection: 'row', gap: 10, marginTop: 4 },
  // Rechazar con contorno en vez de gris sobre gris: como estaba parecía deshabilitado.
  btnReject: { flex: 1, height: 48, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  btnRejectText: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  btnAccept: { flex: 1.4, height: 48, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  btnAcceptText: { fontSize: 15, fontFamily: 'Sora_700Bold' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  overlayImg: { width: '100%', height: '80%' },
});

export default RequestDetailScreen;

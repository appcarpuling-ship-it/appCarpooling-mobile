/**
 * Lo que comparten la bandeja de solicitudes (TripRequestsScreen) y la ficha de una solicitud
 * (RequestDetailScreen). Vive acá porque las dos pantallas tienen que decir lo mismo: si una
 * traduce `reserved` como "Confirmada" y la otra como "Reservada", el conductor ve dos estados
 * distintos para la misma reserva según dónde mire.
 */

/**
 * Los 8 valores del enum `reservationStatus` del backend, más los del viaje.
 * Faltaban payment_failed, trip_completed y expired: caían al default y la pantalla le
 * mostraba la clave cruda ("trip_completed") al conductor.
 */
const ESTADOS = {
  // del viaje
  pending:          { solid: true,  label: 'Pendiente' },
  confirmed:        { solid: true,  label: 'Confirmado' },
  cancelled:        { solid: false, label: 'Cancelado' },
  completed:        { solid: false, label: 'Completado' },
  // de la reserva del asiento
  pending_approval: { solid: true,  label: 'Esperando tu aprobación' },
  pending_payment:  { solid: true,  label: 'Pago pendiente' },
  payment_failed:   { solid: true,  label: 'Pago fallido' },
  reserved:         { solid: true,  label: 'Confirmada' },
  trip_completed:   { solid: false, label: 'Viaje completado' },
  expired:          { solid: false, label: 'Vencida' },
  rejected:         { solid: false, label: 'Rechazada' },
};

export const getStatus = (status) => ESTADOS[status] || { solid: false, label: '—' };

/** El estado que vale: el de la reserva del asiento si existe, si no el del booking. */
export const estadoDe = (item) => item?.seatReservation?.reservationStatus || item?.status;

/** Las dos claves con las que el backend dice "todavía no respondiste". */
export const esperandoRespuesta = (rs) => rs === 'pending_approval' || rs === 'pending';

export const seatsLabelEs = (n) => {
  const s = Math.max(1, Number(n) || 1);
  return s === 1 ? '1 asiento' : `${s} asientos`;
};

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Cuándo pidió, contado como lo cuenta una persona. En una bandeja lo que importa es hace
 * cuánto que está esperando, no la fecha exacta: "hoy" pesa distinto que "mar, 26 ago".
 */
export const fmtCuando = (d) => {
  const t = d ? new Date(d) : null;
  if (!t || isNaN(t)) return '';
  const dias = Math.floor((Date.now() - t.getTime()) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return fmtDate(d);
};

/**
 * El desvío partido en dos para la fila de la bandeja: el número manda y la aclaración va
 * abajo, chica. `desvioEtiqueta` viene armada del backend y es "+2,1 km de desvío" o
 * "Te queda de paso".
 */
export const partirDesvio = (etiqueta) => {
  if (!etiqueta) return null;
  if (!etiqueta.startsWith('+')) return { fuerte: 'De paso', pie: null };
  return { fuerte: etiqueta.replace(' de desvío', ''), pie: 'de desvío' };
};

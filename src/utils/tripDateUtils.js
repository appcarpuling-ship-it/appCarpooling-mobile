/** true si la fecha del viaje es hoy (compara solo año/mes/día, hora local) */
export const isTripToday = (departureDate) => {
  if (!departureDate) return false;
  const today = new Date();
  const trip  = new Date(departureDate);
  return (
    trip.getFullYear() === today.getFullYear() &&
    trip.getMonth()    === today.getMonth()    &&
    trip.getDate()     === today.getDate()
  );
};

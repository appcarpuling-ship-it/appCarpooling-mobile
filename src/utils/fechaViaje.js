/**
 * Cómo se leen y se escriben las fechas de un viaje.
 *
 * Vive acá porque lo comparten las dos pantallas que arman un viaje —publicar uno y pedirlo—,
 * y porque el formato que espera el backend ('YYYY-MM-DD' y 'HH:MM') tiene que salir de un
 * solo lugar: cuando estaba repetido, una pantalla mandaba la fecha en UTC y la otra en hora
 * local, y el mismo viaje aparecía con un día de diferencia según por dónde se hubiera creado.
 */

const dosDigitos = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' en hora LOCAL, que es el contrato con el backend. */
const isoDeFecha = (d) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;

/** 'HH:MM' en 24 horas. */
const horaDeFecha = (d) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;

const mismoDia = (a, b) => isoDeFecha(a) === isoDeFecha(b);

const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

const conMayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * La fecha dicha como la diría una persona: "Hoy", "Mañana", el día de la semana dentro de los
 * próximos siete, y recién después la fecha con número. Todo se calcula contra hoy, así que no
 * hay ningún texto fijo que envejezca.
 */
const fechaLegible = (fecha) => {
    const hoy = new Date();
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    if (mismoDia(fecha, hoy)) return 'Hoy';
    if (mismoDia(fecha, manana)) return 'Mañana';
    const dias = Math.round((new Date(isoDeFecha(fecha)) - new Date(isoDeFecha(hoy))) / 86400000);
    const diaSemana = conMayuscula(fecha.toLocaleDateString('es-AR', { weekday: 'long' }));
    if (dias > 1 && dias <= 7) return `${diaSemana} ${fecha.getDate()}`;
    return `${diaSemana} ${fecha.getDate()} ${NOMBRE_MES[fecha.getMonth()].slice(0, 3)}`;
};

/** Mañana a las 8: el viaje más común, y nunca queda en el pasado. */
const manianaALasOcho = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
};

const conMiles = (n) => Number(n).toLocaleString('es-AR');
const soloDigitos = (v) => parseInt(String(v).replace(/\D/g, ''), 10) || 0;

module.exports = {
    isoDeFecha,
    horaDeFecha,
    mismoDia,
    fechaLegible,
    manianaALasOcho,
    conMayuscula,
    conMiles,
    soloDigitos,
    NOMBRE_MES,
};

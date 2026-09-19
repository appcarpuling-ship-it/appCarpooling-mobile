import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Platform,
    Modal,
    BackHandler,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAP_PROVIDER } from '../../../utils/mapProvider';
import RutaPolyline from '../../../components/map/RutaPolyline';
import DateTimeRow from '../../../components/ui/DateTimeRow';
import { decodePolyline } from '../../../utils/routePoints';
import { senaLegible } from '../../../utils/sena';
import { post_withauth, buildImageUri } from '../../../services/apiService';
import { useAlert } from '../../../context/AlertContext';
import { useUI } from '../../../theme/ui';
import { useAuth } from '../../../context/AuthContext';
import { ENDPOINTS } from '../../../config/api';
import { imageForType } from '../../../utils/vehicleImage';
import { reportError } from '../../../utils/sentry';

/**
 * Publicar un viaje: una sola hoja sobre el mapa del recorrido.
 *
 * Reemplaza al formulario de tres pasos que había acá. La diferencia no es cosmética: el viaje
 * llega con TODO completo (mañana a las 8, el auto de siempre, todos sus asientos, el precio de
 * referencia de la ruta) y cada fila se toca sólo para corregir. Publicar es un toque, y el
 * botón nunca está deshabilitado porque nunca falta nada.
 *
 * Lo que se manda al backend y cómo se valida NO cambió: es el mismo POST /trips de antes.
 *
 * Sobre el tamaño de letra: en iPhone se puede agrandar la tipografía del sistema y una fila con
 * alto fijo se parte. Por eso las filas no tienen altura fija, el rótulo cede ancho antes que el
 * valor, y los textos llevan `maxFontSizeMultiplier`: escalan, pero hasta donde siguen entrando.
 */

const MAX_FS = 1.3; // tope de escalado de la tipografía del sistema (ver arriba)
const ULTIMO_VEHICULO = '@carpuling:ultimo_vehiculo';
const DIAS_EN_TIRA = 60;

const dosDigitos = (n) => String(n).padStart(2, '0');
const isoDeFecha = (d) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
const horaDeFecha = (d) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
const mismoDia = (a, b) => isoDeFecha(a) === isoDeFecha(b);

const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const conMayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * La fecha dicha como la diría una persona: "Hoy", "Mañana", el día de la semana dentro de los
 * próximos siete, y recién después la fecha con número. Todo se calcula contra hoy, así que no
 * hay nada fijo que envejezca.
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

const conMiles = (n) => Number(n).toLocaleString('es-AR');
const soloDigitos = (v) => parseInt(String(v).replace(/\D/g, ''), 10) || 0;

/**
 * Las piezas de la pantalla viven ACÁ, fuera del componente, y no adentro.
 *
 * Definirlas adentro las vuelve a crear en cada render: React las ve como tipos distintos y
 * desmonta y vuelve a montar todo su contenido. El síntoma concreto era que el campo del
 * precio perdía el foco a cada tecla, porque su selector se remontaba entero.
 */
const T = (props) => <Text maxFontSizeMultiplier={MAX_FS} {...props} />;

const Toggle = ({ on, ui }) => (
    <View style={[styles.toggle, { backgroundColor: on ? ui.text : ui.border }]}>
        <View style={[styles.toggleBola, { backgroundColor: on ? ui.invertText : ui.textMuted }, on && styles.toggleBolaOn]} />
    </View>
);

/** Una fila de la hoja: rótulo a la izquierda, valor a la derecha. */
const Fila = ({ ui, rotulo, valor, sub, apagado, alerta, onPress, ultimo, children }) => (
    <TouchableOpacity
        style={[styles.fila, !ultimo && { borderBottomColor: ui.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.6}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${rotulo}${valor ? `: ${valor}` : ''}`}
    >
        <T style={[styles.filaRotulo, { color: alerta ? '#B45309' : ui.textMuted }]}>{rotulo}</T>
        {children || (
            <View style={styles.filaValorCaja}>
                <T
                    style={[styles.filaValor, { color: apagado ? ui.textMuted : ui.text }, apagado && styles.filaValorApagado]}
                    numberOfLines={2}
                >
                    {valor}
                </T>
                {!!sub && <T style={[styles.filaSub, { color: ui.textMuted }]} numberOfLines={1}>{sub}</T>}
            </View>
        )}
        {!!onPress && <Ionicons name="chevron-forward" size={17} color={ui.border} style={styles.filaChevron} />}
    </TouchableOpacity>
);

/** Los selectores: una hoja que sube desde abajo, encima de la del viaje. */
const Selector = ({ ui, insets, visible, titulo, sub, onClose, children }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
        <TouchableOpacity style={styles.velo} activeOpacity={1} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.selector, { backgroundColor: ui.surface, paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
            <View style={[styles.agarre, { backgroundColor: ui.border }]} />
            <T style={[styles.selectorTitulo, { color: ui.text }]}>{titulo}</T>
            {!!sub && <T style={[styles.selectorSub, { color: ui.textMuted }]}>{sub}</T>}
            {children}
            <TouchableOpacity style={[styles.botonon, { backgroundColor: ui.invertBg }]} onPress={onClose} activeOpacity={0.85}>
                <T style={[styles.botononTexto, { color: ui.invertText }]}>Listo</T>
            </TouchableOpacity>
        </View>
    </Modal>
);

const TripDetails = ({ navigation, route }) => {
    const { origin, destination, waypoints, distance, duration, routePolyline, vehicles = [] } = route.params;
    const insets = useSafeAreaInsets();
    const { showAlert } = useAlert();
    const { user } = useAuth();
    const ui = useUI();
    // El MapView nativo pesa cientos de MB: se desmonta al perder el foco. Sin esto, apilar
    // pantallas con mapa lleva la RAM al límite y iOS termina matando la app.
    const enfocada = useIsFocused();

    const [loading, setLoading] = useState(false);
    const [hoja, setHoja] = useState(null); // qué selector está abierto

    // ── Los valores del viaje, todos con algo puesto de entrada ─────────────────────────
    const [cuando, setCuando] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(8, 0, 0, 0);
        return d;
    });
    const [vehiculoId, setVehiculoId] = useState(null);
    const [asientos, setAsientos] = useState(0);
    const [precio, setPrecio] = useState('');
    const [sinPrecioFijo, setSinPrecioFijo] = useState(false);
    const [requiereSena, setRequiereSena] = useState(false);
    const [reglas, setReglas] = useState({
        allowSmoking: false,
        allowPets: false,
        womenOnly: false,
        largeLuggageAllowed: false,
    });
    const [referencia, setReferencia] = useState(null); // { distanceKm, precioPorAsiento }
    const [pickerHora, setPickerHora] = useState(false);

    const vehiculo = vehicles.find((v) => v._id === vehiculoId) || null;
    const capacidad = Number(vehiculo?.capacity) || 0;
    const cobroLegible = user?.datosCobro?.alias || user?.datosCobro?.cvu || '';

    // Vehículo por defecto: el del último viaje que publicó, o el primero que tenga.
    useEffect(() => {
        let vivo = true;
        (async () => {
            if (!vehicles.length) return;
            let elegido = vehicles[0]._id;
            try {
                const guardado = await AsyncStorage.getItem(ULTIMO_VEHICULO);
                if (guardado && vehicles.some((v) => v._id === guardado)) elegido = guardado;
            } catch {
                /* sin preferencia guardada queda el primero */
            }
            if (vivo) setVehiculoId(elegido);
        })();
        return () => { vivo = false; };
    }, [vehicles]);

    // Todos los asientos del auto, que es lo que más conviene al conductor. Si cambia de
    // vehículo se recalcula, para que nunca queden más lugares que asientos.
    useEffect(() => {
        if (capacidad > 0) setAsientos((prev) => (prev > 0 && prev <= capacidad ? prev : capacidad));
    }, [capacidad]);

    // Cuánto se suele cobrar en esta ruta. Es sólo una referencia: si falla o no hay distancia,
    // la pantalla anda igual y el precio arranca vacío.
    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const res = await post_withauth('/trips/precio-referencia', { origin, destination });
                if (!vivo || !res?.success || !res.data?.disponible) return;
                setReferencia(res.data);
                setPrecio((actual) => (actual ? actual : conMiles(res.data.precioPorAsiento)));
            } catch (e) {
                reportError(e, { screen: 'TripDetails', action: 'precioReferencia' });
            }
        })();
        return () => { vivo = false; };
    }, [origin, destination]);

    // ── El mapa del recorrido ───────────────────────────────────────────────────────────
    const puntos = useMemo(() => {
        const coords = routePolyline ? decodePolyline(routePolyline) : [];
        if (coords.length) return coords;
        // Sin trazado guardado, al menos las dos puntas para que el mapa encuadre el viaje.
        return [origin?.coordinates, destination?.coordinates].filter(
            (c) => Number.isFinite(c?.latitude) && Number.isFinite(c?.longitude),
        );
    }, [routePolyline, origin, destination]);
    const hayTrazado = puntos.length > 2;

    const mapaRef = useRef(null);
    const [mapaListo, setMapaListo] = useState(false);
    const [mapaAncho, setMapaAncho] = useState(0);

    const region = useMemo(() => {
        if (!puntos.length) return undefined;
        const lats = puntos.map((p) => p.latitude);
        const lngs = puntos.map((p) => p.longitude);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.05),
            longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.05),
        };
    }, [puntos]);

    // En Android `initialRegion` se aplica antes de que la vista nativa mida y queda ignorada:
    // el encuadre se pide cuando el mapa está listo Y ya tiene ancho (mismo criterio que
    // BookingScreen). El `bottom` grande deja el recorrido en la franja que la hoja no tapa.
    useEffect(() => {
        if (!mapaListo || !mapaAncho || puntos.length < 2) return;
        mapaRef.current?.fitToCoordinates(puntos, {
            edgePadding: { top: 90, right: 50, bottom: 340, left: 50 },
            animated: false,
        });
    }, [mapaListo, mapaAncho, puntos.length]);

    // Al volver de otra pantalla el mapa se remonta y nace sin encuadrar: las señales se
    // reinician para que el efecto de arriba vuelva a correr.
    useEffect(() => {
        if (!enfocada) { setMapaListo(false); setMapaAncho(0); }
    }, [enfocada]);

    // ── Navegación ──────────────────────────────────────────────────────────────────────
    // Sin header: el mapa va a pantalla completa y volver es el botón flotante de arriba.
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    // El botón físico de Android cierra el selector abierto antes que la pantalla.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (hoja) { setHoja(null); return true; }
            return false;
        });
        return () => sub.remove();
    }, [hoja]);

    // ── Publicar ────────────────────────────────────────────────────────────────────────
    const precioNumero = soloDigitos(precio);
    const totalLleno = sinPrecioFijo ? 0 : precioNumero * (asientos || 0);
    const senaPreview = senaLegible(precioNumero);

    const faltaVehiculo = !vehiculo;
    const faltaPrecio = !sinPrecioFijo && precioNumero <= 0;
    const faltaCobro = requiereSena && !sinPrecioFijo && !cobroLegible;

    const publicar = async () => {
        // Nada bloquea el botón: si falta algo, se abre la fila que lo resuelve.
        if (faltaVehiculo) {
            if (vehicles.length) setHoja('vehiculo');
            else navigation.navigate('ProfileTab', { screen: 'VehicleForm', initial: false });
            return;
        }
        if (faltaPrecio) { setHoja('precio'); return; }
        // Sin asientos el backend rechaza el viaje. Con un vehículo sin capacidad cargada no hay
        // nada que elegir, así que ahí se manda a corregir el vehículo en vez de abrir un
        // selector vacío.
        if (!asientos) {
            if (capacidad > 0) { setHoja('asientos'); return; }
            showAlert('Revisá tu vehículo', 'No tiene cargada la cantidad de asientos. Editalo en Mis vehículos y volvé a publicar.');
            return;
        }
        if (cuando <= new Date()) {
            showAlert('Revisá la salida', 'La fecha y la hora tienen que ser futuras.');
            setHoja('cuando');
            return;
        }

        setLoading(true);
        try {
            const tripData = {
                vehicle: vehiculo._id,
                origin,
                destination,
                intermediateStops: (waypoints || []).map((wp, i) => ({
                    address: wp.address,
                    city: wp.city,
                    province: wp.province,
                    coordinates: wp.coordinates,
                    order: wp.order ?? i + 1,
                })),
                // Ruta ya calculada en el mapa: se guarda para no volver a pedir Directions al verla.
                ...(routePolyline && { routePolyline }),
                departureDate: isoDeFecha(cuando),
                departureTime: horaDeFecha(cuando),
                availableSeats: asientos,
                pricePerSeat: 0,
                // Lo que le cobra a cada pasajero, y que le pagan a él al llegar. La conexión
                // (lo que cobra la app) la calcula el server aparte y no se manda desde acá.
                driverPrice: sinPrecioFijo ? 0 : precioNumero,
                sinPrecioFijo,
                // Con "gastos compartidos" no hay precio del cual sacar la mitad; el server lo
                // normaliza igual (backend/utils/sena.js).
                requiereSena: !sinPrecioFijo && requiereSena,
                notes: '',
                rules: {
                    smokingAllowed: reglas.allowSmoking,
                    petsAllowed: reglas.allowPets,
                    womenOnly: reglas.womenOnly,
                    largeLuggageAllowed: reglas.largeLuggageAllowed,
                },
            };

            const response = await post_withauth(ENDPOINTS.CREATE_TRIP, tripData);
            if (response.success) {
                // Para preseleccionarlo la próxima vez.
                AsyncStorage.setItem(ULTIMO_VEHICULO, vehiculo._id).catch(() => {});
                navigation.navigate('Result', {
                    type: 'success',
                    title: 'Viaje publicado',
                    message: 'Ya pueden verlo y reservar tu viaje.',
                    primaryLabel: 'Continuar',
                    onPrimary: () => navigation.navigate('Main', {
                        screen: 'CarpoolingsTab',
                        params: { screen: 'Carpoolings' },
                    }),
                });
            } else {
                navigation.navigate('Result', { type: 'error', title: 'Ocurrió algo', message: response.message || 'No pudimos crear el viaje en este momento.' });
            }
        } catch (error) {
            // Bloqueado por saldo pendiente. Se trata aparte del resto de los errores porque NO
            // es una falla: el conductor puede resolverlo, y lo que necesita es entender por qué
            // y adónde ir.
            if (error.response?.data?.code === 'SALDO_PENDIENTE') {
                showAlert(
                    'Tenés saldo pendiente',
                    error.response.data.message || 'Saldá tu cuenta para volver a publicar viajes.',
                    [
                        { text: 'Ahora no', style: 'cancel' },
                        { text: 'Ver mi saldo', onPress: () => navigation.navigate('ProfileTab', { screen: 'Saldo', initial: false }) },
                    ],
                );
                return;
            }
            navigation.navigate('Result', { type: 'error', title: 'Ocurrió algo', message: error.message || 'No pudimos crear el viaje en este momento.' });
        } finally {
            setLoading(false);
        }
    };

    // La tira de días arranca en hoy y avanza: se corre sola cada día, no hay fechas fijas.
    const diasDeLaTira = useMemo(() => {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        return Array.from({ length: DIAS_EN_TIRA }, (_, i) => {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() + i);
            return d;
        });
    }, []);

    const elegirDia = (dia) => {
        const nueva = new Date(cuando);
        nueva.setFullYear(dia.getFullYear(), dia.getMonth(), dia.getDate());
        setCuando(nueva);
    };
    const onHora = (event, elegida) => {
        if (Platform.OS === 'android') setPickerHora(false);
        if (!elegida || (Platform.OS === 'android' && event?.type !== 'set')) return;
        const nueva = new Date(cuando);
        nueva.setHours(elegida.getHours(), elegida.getMinutes(), 0, 0);
        setCuando(nueva);
    };

    const REGLAS = [
        { key: 'allowSmoking', label: 'Se puede fumar', icon: 'flame-outline' },
        { key: 'allowPets', label: 'Acepto mascotas', icon: 'paw-outline' },
        { key: 'largeLuggageAllowed', label: 'Equipaje grande', icon: 'bag-handle-outline' },
        // Sólo para conductoras, igual que en la pantalla anterior.
        ...(user?.gender === 'female'
            ? [{ key: 'womenOnly', label: 'Solo mujeres', icon: 'woman-outline', sub: 'Sólo lo ven pasajeras' }]
            : []),
    ];
    const reglasActivas = REGLAS.filter((r) => reglas[r.key]);

    const fotoDelVehiculo = (v) => {
        const fotos = (v.photos || []).filter(Boolean);
        // `photo` es el campo viejo, y su default es una de picsum que no es el auto de nadie.
        const suelta = v.photo && !v.photo.includes('picsum') ? v.photo : null;
        return fotos[0] || suelta || null;
    };

    return (
        <View style={[styles.pantalla, { backgroundColor: ui.bg }]}>
            {/* El recorrido, de fondo. No se puede mover: es contexto, no un mapa para operar. */}
            {enfocada && !!region && (
                <MapView
                    ref={mapaRef}
                    provider={MAP_PROVIDER}
                    style={StyleSheet.absoluteFill}
                    initialRegion={region}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    toolbarEnabled={false}
                    onMapReady={() => setMapaListo(true)}
                    onLayout={(e) => setMapaAncho(e.nativeEvent.layout.width)}
                >
                    {hayTrazado && <RutaPolyline coordinates={puntos} width={5} color={ui.isDarkMode ? '#FFFFFF' : '#111111'} />}
                    {!!origin?.coordinates && <Marker coordinate={origin.coordinates} tracksViewChanges={false} />}
                    {!!destination?.coordinates && <Marker coordinate={destination.coordinates} tracksViewChanges={false} />}
                </MapView>
            )}

            <TouchableOpacity
                style={[styles.volver, { backgroundColor: ui.surface, top: insets.top + 8 }]}
                onPress={() => navigation.goBack()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Volver al recorrido"
            >
                <Ionicons name="chevron-back" size={22} color={ui.text} />
            </TouchableOpacity>

            {/* La hoja del viaje */}
            <View style={[styles.hoja, { backgroundColor: ui.surface, paddingBottom: Math.max(insets.bottom, 14) + 6 }]}>
                <View style={[styles.agarre, { backgroundColor: ui.border }]} />
                <View style={styles.encabezado}>
                    <T style={[styles.titulo, { color: ui.text }]}>Tu viaje</T>
                    <T style={[styles.ruta, { color: ui.textMuted }]} numberOfLines={1}>
                        {origin?.city || origin?.address} → {destination?.city || destination?.address}
                        {waypoints?.length ? ` · ${waypoints.length} parada${waypoints.length !== 1 ? 's' : ''}` : ''}
                    </T>
                </View>

                <ScrollView style={styles.lista} showsVerticalScrollIndicator={false} bounces={false}>
                    <Fila
                        ui={ui}
                        rotulo="Sale"
                        valor={`${fechaLegible(cuando)} · ${horaDeFecha(cuando)}`}
                        onPress={() => setHoja('cuando')}
                    />
                    <Fila
                        ui={ui}
                        rotulo="Vehículo"
                        valor={vehiculo ? `${vehiculo.brand} ${vehiculo.model}` : 'Agregá tu vehículo'}
                        sub={vehiculo?.licensePlate}
                        apagado={faltaVehiculo}
                        alerta={faltaVehiculo}
                        onPress={() => (vehicles.length
                            ? setHoja('vehiculo')
                            : navigation.navigate('ProfileTab', { screen: 'VehicleForm', initial: false }))}
                    />
                    <Fila
                        ui={ui}
                        rotulo="Lugares que ofrecés"
                        valor={asientos ? `${asientos} asiento${asientos !== 1 ? 's' : ''}` : 'Elegí cuántos'}
                        apagado={!asientos}
                        onPress={vehiculo ? () => setHoja('asientos') : undefined}
                    />
                    <Fila
                        ui={ui}
                        rotulo="Cada pasajero paga"
                        valor={sinPrecioFijo ? 'A convenir' : precioNumero > 0 ? `$${conMiles(precioNumero)}` : 'Poné tu precio'}
                        apagado={faltaPrecio}
                        onPress={() => setHoja('precio')}
                    />
                    <Fila
                        ui={ui}
                        rotulo={senaPreview && !sinPrecioFijo ? `Pedir seña de ${senaPreview}` : 'Pedir seña'}
                        onPress={sinPrecioFijo ? undefined : () => setRequiereSena((v) => !v)}
                    >
                        <View style={styles.filaValorCaja}>
                            <Toggle on={requiereSena && !sinPrecioFijo} ui={ui} />
                        </View>
                    </Fila>
                    {requiereSena && !sinPrecioFijo && (
                        <Fila
                        ui={ui}
                            rotulo="Te pagan a"
                            valor={cobroLegible || 'Cargá tu CVU o alias'}
                            apagado={!cobroLegible}
                            alerta={faltaCobro}
                            onPress={() => navigation.navigate('ProfileTab', { screen: 'DatosCobro', initial: false })}
                        />
                    )}
                    <Fila
                        ui={ui}
                        rotulo="Reglas del viaje"
                        valor={reglasActivas.length ? reglasActivas.map((r) => r.label).join(' · ') : 'Ninguna'}
                        apagado={!reglasActivas.length}
                        onPress={() => setHoja('reglas')}
                        ultimo
                    />

                    {!sinPrecioFijo && totalLleno > 0 && (
                        <View style={[styles.total, { backgroundColor: ui.bg }]}>
                            <T style={[styles.totalRotulo, { color: ui.textMuted }]}>Si viajás lleno cobrás</T>
                            <T style={[styles.totalMonto, { color: ui.text }]}>${conMiles(totalLleno)}</T>
                        </View>
                    )}
                </ScrollView>

                <TouchableOpacity
                    style={[styles.botonon, { backgroundColor: ui.invertBg }, loading && { opacity: 0.6 }]}
                    onPress={publicar}
                    disabled={loading}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                >
                    {loading
                        ? <ActivityIndicator color={ui.invertText} size="small" />
                        : <T style={[styles.botononTexto, { color: ui.invertText }]}>Publicar viaje</T>}
                </TouchableOpacity>
            </View>

            {/* ── Cuándo: los días salen del calendario real y la hora del reloj del teléfono ── */}
            <Selector
                ui={ui}
                insets={insets}
                visible={hoja === 'cuando'}
                titulo="¿Cuándo salís?"
                sub={distance && duration ? `${distance} · ${duration}` : undefined}
                onClose={() => setHoja(null)}
            >
                <T style={[styles.mes, { color: ui.text }]}>
                    {`${conMayuscula(NOMBRE_MES[cuando.getMonth()])} ${cuando.getFullYear()}`}
                </T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tira}>
                    {diasDeLaTira.map((dia) => {
                        const elegido = mismoDia(dia, cuando);
                        return (
                            <TouchableOpacity
                                key={dia.toISOString()}
                                style={[styles.dia, { backgroundColor: elegido ? ui.text : ui.bg }]}
                                onPress={() => elegirDia(dia)}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityState={{ selected: elegido }}
                                accessibilityLabel={dia.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            >
                                <T style={[styles.diaSemana, { color: elegido ? ui.invertText : ui.textMuted }]}>
                                    {dia.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}
                                </T>
                                <T style={[styles.diaNumero, { color: elegido ? ui.invertText : ui.text }]}>{dia.getDate()}</T>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* La hora, por plataforma. En web el picker nativo de RN no corre: se usa el
                    <input type="time"> del navegador, igual que hacía el paso de fecha anterior. */}
                {Platform.OS === 'web' ? (
                    <DateTimeRow
                        mode="time"
                        icon="time-outline"
                        value={horaDeFecha(cuando)}
                        onChange={(v) => {
                            const [h, m] = String(v).split(':').map(Number);
                            if (Number.isNaN(h) || Number.isNaN(m)) return;
                            const nueva = new Date(cuando);
                            nueva.setHours(h, m, 0, 0);
                            setCuando(nueva);
                        }}
                        isLast
                        colors={{ textPrimary: ui.text, textMuted: ui.textMuted, divider: ui.border, isDark: ui.isDarkMode }}
                    />
                ) : Platform.OS === 'ios' ? (
                    <DateTimePicker
                        value={cuando}
                        mode="time"
                        display="spinner"
                        onChange={onHora}
                        textColor={ui.text}
                        themeVariant={ui.isDarkMode ? 'dark' : 'light'}
                        style={styles.rueda}
                    />
                ) : (
                    <>
                        <TouchableOpacity
                            style={[styles.horaCaja, { backgroundColor: ui.bg }]}
                            onPress={() => setPickerHora(true)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={`Hora de salida: ${horaDeFecha(cuando)}`}
                        >
                            <Ionicons name="time-outline" size={19} color={ui.textMuted} />
                            <T style={[styles.horaTexto, { color: ui.text }]}>{horaDeFecha(cuando)}</T>
                            <Ionicons name="chevron-forward" size={16} color={ui.border} />
                        </TouchableOpacity>
                        {pickerHora && <DateTimePicker value={cuando} mode="time" display="default" is24Hour onChange={onHora} />}
                    </>
                )}
            </Selector>

            {/* ── Vehículo ────────────────────────────────────────────────────────────────── */}
            <Selector
                ui={ui}
                insets={insets}
                visible={hoja === 'vehiculo'}
                titulo="¿Con qué vehículo?"
                sub="Los lugares se ajustan al que elijas"
                onClose={() => setHoja(null)}
            >
                <ScrollView style={styles.listaAutos} showsVerticalScrollIndicator={false}>
                    {vehicles.map((v) => {
                        const elegido = v._id === vehiculoId;
                        const foto = fotoDelVehiculo(v);
                        return (
                            <TouchableOpacity
                                key={v._id}
                                style={[styles.auto, { backgroundColor: elegido ? ui.text : ui.bg }]}
                                onPress={() => { setVehiculoId(v._id); setHoja(null); }}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityState={{ selected: elegido }}
                            >
                                <Image
                                    source={foto ? { uri: buildImageUri(foto) } : imageForType(v.type)}
                                    style={[styles.autoFoto, { backgroundColor: ui.surface }]}
                                    resizeMode={foto ? 'cover' : 'contain'}
                                />
                                <View style={styles.autoTexto}>
                                    <T style={[styles.autoNombre, { color: elegido ? ui.invertText : ui.text }]} numberOfLines={1}>
                                        {v.brand} {v.model}
                                    </T>
                                    <T style={[styles.autoSub, { color: elegido ? ui.invertText : ui.textMuted }]} numberOfLines={1}>
                                        {[v.licensePlate, v.capacity ? `${v.capacity} lugares` : null].filter(Boolean).join(' · ')}
                                    </T>
                                </View>
                                {elegido && <Ionicons name="checkmark" size={20} color={ui.invertText} />}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                {/* El carrusel con fotos y papeles ya existe: para el que quiera mirar el detalle. */}
                <TouchableOpacity
                    onPress={() => {
                        setHoja(null);
                        navigation.navigate('VehiclePicker', {
                            vehicles,
                            selectedId: vehiculoId,
                            onSelect: (id) => setVehiculoId(id),
                        });
                    }}
                    activeOpacity={0.7}
                    style={styles.verDetalle}
                >
                    <T style={[styles.verDetalleTexto, { color: ui.textMuted }]}>Ver fotos y documentación</T>
                </TouchableOpacity>
            </Selector>

            {/* ── Asientos ────────────────────────────────────────────────────────────────── */}
            <Selector
                ui={ui}
                insets={insets}
                visible={hoja === 'asientos'}
                titulo="¿Cuántos lugares ofrecés?"
                sub={vehiculo ? `Tu ${vehiculo.brand} ${vehiculo.model} tiene ${capacidad}` : undefined}
                onClose={() => setHoja(null)}
            >
                <View style={styles.asientos}>
                    <View style={[styles.asiento, styles.asientoVolante, { borderColor: ui.border }]}>
                        <Ionicons name="person" size={18} color={ui.textMuted} />
                        <T style={[styles.asientoNum, { color: ui.textMuted }]}>VOS</T>
                    </View>
                    {Array.from({ length: capacidad }, (_, i) => i + 1).map((n) => {
                        const ofrecido = n <= asientos;
                        return (
                            <TouchableOpacity
                                key={n}
                                style={[styles.asiento, { backgroundColor: ofrecido ? ui.text : ui.bg }]}
                                // Tocar el último ofrecido lo saca; tocar cualquier otro ofrece hasta ahí.
                                onPress={() => setAsientos(n === asientos ? n - 1 : n)}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityState={{ selected: ofrecido }}
                                accessibilityLabel={`Ofrecer ${n} asiento${n !== 1 ? 's' : ''}`}
                            >
                                <Ionicons name={ofrecido ? 'person' : 'person-outline'} size={18} color={ofrecido ? ui.invertText : ui.textMuted} />
                                <T style={[styles.asientoNum, { color: ofrecido ? ui.invertText : ui.textMuted }]}>{n}</T>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <T style={[styles.pie, { color: ui.textMuted }]}>
                    {asientos === capacidad
                        ? 'Ofrecés todos los lugares del auto.'
                        : `Ofrecés ${asientos} de ${capacidad}: ${capacidad - asientos} queda${capacidad - asientos !== 1 ? 'n' : ''} libre${capacidad - asientos !== 1 ? 's' : ''}.`}
                </T>
            </Selector>

            {/* ── Precio ──────────────────────────────────────────────────────────────────── */}
            <Selector ui={ui} insets={insets} visible={hoja === 'precio'} titulo="¿Cuánto cobrás?" sub="Por pasajero" onClose={() => setHoja(null)}>
                <View style={[styles.segmento, { backgroundColor: ui.bg }]}>
                    {[
                        { fijo: false, label: 'Precio fijo' },
                        { fijo: true, label: 'Gastos compartidos' },
                    ].map((op) => {
                        const activo = sinPrecioFijo === op.fijo;
                        return (
                            <TouchableOpacity
                                key={op.label}
                                style={[styles.segmentoBoton, activo && { backgroundColor: ui.surface }]}
                                onPress={() => {
                                    setSinPrecioFijo(op.fijo);
                                    // Sin precio no hay mitad que calcular: la seña se apaga sola.
                                    if (op.fijo) setRequiereSena(false);
                                }}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityState={{ selected: activo }}
                            >
                                <T style={[styles.segmentoTexto, { color: activo ? ui.text : ui.textMuted }]}>{op.label}</T>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {sinPrecioFijo ? (
                    <T style={[styles.explica, { color: ui.textMuted }]}>
                        No fijás un precio: los gastos del viaje los arreglás directo con cada pasajero.
                    </T>
                ) : (
                    <>
                        <TextInput
                            style={[styles.precioInput, { color: precioNumero > 0 ? ui.text : ui.textMuted }]}
                            value={precioNumero > 0 ? `$${conMiles(precioNumero)}` : ''}
                            onChangeText={(v) => setPrecio(conMiles(soloDigitos(v)))}
                            placeholder="$0"
                            placeholderTextColor={ui.textMuted}
                            keyboardType="number-pad"
                            maxFontSizeMultiplier={1.1}
                            accessibilityLabel="Precio por pasajero"
                        />
                        <T style={[styles.pie, { color: ui.textMuted }]}>
                            {referencia
                                ? `En esta ruta (${referencia.distanceKm} km) se suele cobrar $${conMiles(referencia.precioPorAsiento)}`
                                : 'Te lo pagan a vos, directo.'}
                        </T>
                    </>
                )}
            </Selector>

            {/* ── Reglas ──────────────────────────────────────────────────────────────────── */}
            <Selector ui={ui} insets={insets} visible={hoja === 'reglas'} titulo="Reglas del viaje" sub="Opcional. Aparecen en tu aviso." onClose={() => setHoja(null)}>
                {REGLAS.map((r, i) => (
                    <TouchableOpacity
                        key={r.key}
                        style={[styles.regla, i < REGLAS.length - 1 && { borderBottomColor: ui.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                        onPress={() => setReglas((prev) => ({ ...prev, [r.key]: !prev[r.key] }))}
                        activeOpacity={0.7}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: !!reglas[r.key] }}
                    >
                        <Ionicons name={r.icon} size={20} color={ui.text} />
                        <View style={styles.reglaTexto}>
                            <T style={[styles.reglaLabel, { color: ui.text }]}>{r.label}</T>
                            {!!r.sub && <T style={[styles.filaSub, { color: ui.textMuted, textAlign: 'left' }]}>{r.sub}</T>}
                        </View>
                        <Toggle on={!!reglas[r.key]} ui={ui} />
                    </TouchableOpacity>
                ))}
            </Selector>
        </View>
    );
};

const styles = StyleSheet.create({
    pantalla: { flex: 1 },
    volver: {
        position: 'absolute', left: 14, zIndex: 4,
        width: 38, height: 38, borderRadius: 999,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    },

    // La hoja no tiene alto fijo: crece con su contenido (y con la tipografía del sistema)
    // hasta un tope, y de ahí en más la lista scrollea.
    hoja: {
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3,
        maxHeight: '82%',
        borderTopLeftRadius: 26, borderTopRightRadius: 26,
        paddingHorizontal: 18, paddingTop: 10,
        shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 12,
    },
    agarre: { width: 38, height: 4, borderRadius: 9, alignSelf: 'center', marginBottom: 12 },
    encabezado: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
    titulo: { fontSize: 21, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.7 },
    ruta: { fontSize: 12, fontFamily: 'Sora_400Regular', flexShrink: 1, textAlign: 'right' },
    lista: { flexGrow: 0 },

    // Fila: el rótulo cede ancho antes que el valor, y ninguno tiene alto fijo.
    fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    filaRotulo: { fontSize: 13.5, fontFamily: 'Sora_500Medium', flexShrink: 1 },
    filaValorCaja: { marginLeft: 'auto', alignItems: 'flex-end', flexShrink: 1 },
    filaValor: { fontSize: 14.5, fontFamily: 'Sora_700Bold', letterSpacing: -0.2, textAlign: 'right' },
    filaValorApagado: { fontFamily: 'Sora_500Medium' },
    filaSub: { fontSize: 11, fontFamily: 'Sora_400Regular', marginTop: 1, textAlign: 'right' },
    filaChevron: { marginLeft: 2 },

    total: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12 },
    totalRotulo: { fontSize: 12, fontFamily: 'Sora_400Regular', flexShrink: 1 },
    totalMonto: { fontSize: 18, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.5 },

    botonon: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
    botononTexto: { fontSize: 15.5, fontFamily: 'Sora_600SemiBold' },

    toggle: { width: 46, height: 27, borderRadius: 999, padding: 2.5, justifyContent: 'center' },
    toggleBola: { width: 22, height: 22, borderRadius: 11 },
    toggleBolaOn: { alignSelf: 'flex-end' },

    // Selectores
    velo: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
    selector: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        borderTopLeftRadius: 26, borderTopRightRadius: 26,
        paddingHorizontal: 18, paddingTop: 10, maxHeight: '86%',
    },
    selectorTitulo: { fontSize: 20, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.6 },
    selectorSub: { fontSize: 12, fontFamily: 'Sora_400Regular', marginTop: 2 },

    mes: { fontSize: 13, fontFamily: 'Sora_600SemiBold', marginTop: 14 },
    tira: { gap: 8, paddingVertical: 10, paddingRight: 8 },
    dia: { width: 50, paddingVertical: 9, borderRadius: 14, alignItems: 'center' },
    diaSemana: { fontSize: 10, fontFamily: 'Sora_500Medium', textTransform: 'uppercase' },
    diaNumero: { fontSize: 16, fontFamily: 'Sora_700Bold', letterSpacing: -0.3, marginTop: 1 },
    rueda: { alignSelf: 'stretch' },
    horaCaja: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginTop: 4 },
    horaTexto: { flex: 1, fontSize: 17, fontFamily: 'Sora_700Bold', letterSpacing: -0.3 },

    listaAutos: { flexGrow: 0, marginTop: 12 },
    auto: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 10, marginBottom: 8 },
    autoFoto: { width: 56, height: 42, borderRadius: 10 },
    autoTexto: { flex: 1, minWidth: 0 },
    autoNombre: { fontSize: 14.5, fontFamily: 'Sora_700Bold', letterSpacing: -0.2 },
    autoSub: { fontSize: 11.5, fontFamily: 'Sora_400Regular', marginTop: 1 },
    verDetalle: { paddingVertical: 10, alignItems: 'center' },
    verDetalleTexto: { fontSize: 12.5, fontFamily: 'Sora_600SemiBold' },

    asientos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' },
    asiento: { width: 58, paddingVertical: 10, borderRadius: 14, alignItems: 'center', gap: 2 },
    asientoVolante: { borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: 'transparent' },
    asientoNum: { fontSize: 10, fontFamily: 'Sora_700Bold', letterSpacing: 0.2 },

    segmento: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4, marginTop: 14 },
    segmentoBoton: { flex: 1, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
    segmentoTexto: { fontSize: 12.5, fontFamily: 'Sora_600SemiBold' },

    precioInput: {
        fontSize: 42, fontFamily: 'Sora_800ExtraBold', letterSpacing: -1.6,
        textAlign: 'center', paddingVertical: 14, lineHeight: 52,
    },
    explica: { fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 19, marginTop: 16, textAlign: 'center' },
    pie: { fontSize: 11.5, fontFamily: 'Sora_400Regular', lineHeight: 17, marginTop: 8, textAlign: 'center' },

    regla: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, marginTop: 2 },
    reglaTexto: { flex: 1, minWidth: 0 },
    reglaLabel: { fontSize: 14, fontFamily: 'Sora_500Medium' },
});

export default TripDetails;

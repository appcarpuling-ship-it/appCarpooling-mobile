import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
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
    Keyboard,
    TouchableWithoutFeedback,
    BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import DateTimeRow from '../../../components/ui/DateTimeRow';
import { senaLegible } from '../../../utils/sena';
import { post_withauth } from '../../../services/apiService';
import { useAlert } from '../../../context/AlertContext';
import { useColors } from '../../../hooks/useColors';
import { useUI } from '../../../theme/ui';
import { useAuth } from '../../../context/AuthContext';
import { ENDPOINTS } from '../../../config/api';

// El alta del viaje en pasos. El primero —elegir las direcciones en el mapa— es la pantalla
// anterior (CreateTripGoogleMaps); acá empieza el segundo. Una sola pantalla con `step` en vez
// de tres pantallas porque el formulario es uno solo: partirlo obligaría a arrastrar formData
// entre rutas y a validar lo mismo en tres lugares.
const PASOS = [
    { titulo: 'Vehículo y asientos' },
    { titulo: 'Fecha y hora' },
    { titulo: 'Preferencias' },
];

const TripDetails = ({ navigation, route }) => {
    const { origin, destination, waypoints, distance, duration, routePolyline, vehicles } = route.params;
    const insets = useSafeAreaInsets();
    const { showAlert } = useAlert();
    const { user } = useAuth();

    const ui          = useUI();
    const bg          = ui.bg;
    const cardBg      = ui.surface;
    const border      = ui.border;
    const textPrimary = ui.text;
    const textMuted   = ui.textMuted;
    const divider     = ui.bg;

    const [step, setStep] = useState(1);
    const scrollRef = useRef(null);

    // El botón "Continuar" vive al final del scroll (como el resto de la app) pero con
    // `marginTop:'auto'` sobre un contentContainer `flexGrow:1`: cuando el paso es corto queda
    // pegado abajo igual que un footer fijo; cuando es largo, queda después del contenido y se
    // scrollea. Antes era un footer fijo que el teclado tapaba.
    //
    // Con el teclado abierto en Android (SDK 54 no achica la ventana): se suma su alto como
    // espacio al final para poder scrollear el input a la vista. iOS lo sube solo con
    // `automaticallyAdjustKeyboardInsets`.
    const [alturaTeclado, setAlturaTeclado] = useState(0);
    useEffect(() => {
        if (Platform.OS !== 'android') return undefined;
        const show = Keyboard.addListener('keyboardDidShow', (e) => setAlturaTeclado(e.endCoordinates?.height || 0));
        const hide = Keyboard.addListener('keyboardDidHide', () => setAlturaTeclado(0));
        return () => { show.remove(); hide.remove(); };
    }, []);
    // Al enfocar asientos/precio, un scroll suave para acercar el input al tope. `scrollToEnd`
    // scrolleaba de más (dejaba todo el paso pegado al teclado); esto lo acerca sin exagerar.
    const scrollFieldAboveKeyboard = () => {
        if (Platform.OS !== 'android') return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 260, animated: true }));
        });
    };
    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());

    const [formData, setFormData] = useState({
        vehicle:        '',
        departureDate:  '',
        departureTime:  '',
        availableSeats: '',
        driverPrice:    '',
        sinPrecioFijo:  false,
        requiereSena:   false,

        notes:          '',
        allowSmoking:        false,
        allowPets:           false,
        womenOnly:           false,
        largeLuggageAllowed: false,
    });

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    // Vista previa de la seña mientras escribe el precio. El número final lo deriva el
    // server con la misma regla (la mitad), esto es sólo para que sepa qué está ofreciendo.
    const senaPreview = senaLegible(parseInt(String(formData.driverPrice).replace(/\./g, ''), 10) || 0);
    // Sin CVU ni alias cargados, pedir seña no sirve: el pasajero no tiene a dónde transferir.
    const tieneDatosCobro = Boolean(user?.datosCobro?.cvu || user?.datosCobro?.alias);

    // Mínimo para el <input type="date"> de web (equivalente a minimumDate={new Date()}).
    const todayStr = (() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    })();

    const onDateChange = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate && event?.type === 'set') {
            setDate(selectedDate);
            const y = selectedDate.getFullYear();
            const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const d = String(selectedDate.getDate()).padStart(2, '0');
            handleChange('departureDate', `${y}-${m}-${d}`);
        }
    };

    const onTimeChange = (event, selectedTime) => {
        setShowTimePicker(false);
        if (selectedTime && event?.type === 'set') {
            setTime(selectedTime);
            const h = selectedTime.getHours().toString().padStart(2, '0');
            const m = selectedTime.getMinutes().toString().padStart(2, '0');
            handleChange('departureTime', `${h}:${m}`);
        }
    };

    const formatDateDisplay = (s) => {
        if (!s) return '';
        const [y, m, d] = s.split('-');
        return `${d}/${m}/${y}`;
    };

    const formatTimeDisplay = (s) => {
        if (!s) return '';
        const [h, m] = s.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${display}:${m} ${ampm}`;
    };

    const esUltimoPaso = step === PASOS.length;

    const selectedVehicle = vehicles?.find(v => v?._id === formData.vehicle);
    /** Tope de asientos: los que tiene el auto elegido. Lo mismo lo revisa el backend. */
    const maxAsientos = Number(selectedVehicle?.capacity) || 0;

    /**
     * Qué le falta al paso actual, en texto. Devuelve null si está completo.
     * Se valida por paso y no sólo al publicar: llegar al final para que recién ahí te digan
     * que faltaba el vehículo es peor que no tener pasos.
     */
    const faltante = (() => {
        if (step === 1) {
            if (!formData.vehicle) return 'Elegí con qué vehículo vas a viajar';
            const asientos = parseInt(formData.availableSeats, 10);
            if (!asientos || asientos < 1) return 'Indicá cuántos asientos ofrecés';
            // Red de seguridad: el campo ya no deja escribir de más, pero si el auto se cambia
            // DESPUÉS de cargar los asientos, el número viejo puede quedar pasado de tope.
            if (maxAsientos && asientos > maxAsientos) {
                return `Tu ${selectedVehicle.brand} ${selectedVehicle.model} tiene ${maxAsientos} asiento${maxAsientos !== 1 ? 's' : ''}`;
            }
            // El precio se valida acá y no recién al publicar: está marcado con * en este paso,
            // y enterarse dos pasos después de que faltaba es lo que los pasos vienen a evitar.
            // En "Gastos compartidos" no hay precio que poner: es carpooling real, se
            // arregla directo con los pasajeros.
            if (!formData.sinPrecioFijo && !(parseInt(String(formData.driverPrice).replace(/\./g, ''), 10) > 0)) {
                return 'Poné cuánto le cobrás a cada pasajero';
            }
            return null;
        }
        if (step === 2) {
            if (!formData.departureDate) return 'Elegí la fecha de salida';
            if (!formData.departureTime) return 'Elegí la hora de salida';
            return null;
        }
        return null; // las preferencias son todas opcionales
    })();

    const irAlSiguientePaso = () => {
        if (faltante) return;
        Keyboard.dismiss();
        setStep((s) => Math.min(s + 1, PASOS.length));
        // Sin esto el paso nuevo arranca a mitad de scroll, donde quedó el anterior.
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    };

    const volver = () => {
        if (step > 1) {
            setStep((s) => s - 1);
            scrollRef.current?.scrollTo({ y: 0, animated: false });
            return true;
        }
        return false; // en el primer paso, atrás es volver al mapa
    };

    // La flecha del header y el botón físico de Android tienen que retroceder de paso, no
    // salir del formulario: salir tira todo lo cargado hasta acá.
    useLayoutEffect(() => {
        navigation.setOptions({
            title: PASOS[step - 1].titulo,
            headerLeft: () => (
                <TouchableOpacity
                    onPress={() => { if (!volver()) navigation.goBack(); }}
                    style={{ paddingVertical: 10, paddingRight: 10, paddingLeft: 4, marginLeft: Platform.OS === 'android' ? 6 : 4 }}
                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Volver"
                >
                    <Ionicons name="chevron-back" size={26} color={textPrimary} />
                </TouchableOpacity>
            ),
        });
    }, [navigation, step, textPrimary]);

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', volver);
        return () => sub.remove();
    }, [step]);

    const handleCreateTrip = async () => {
        const { vehicle, departureDate, departureTime, availableSeats, driverPrice } = formData;
        if (!vehicle || !departureDate || !departureTime || !availableSeats) {
            showAlert('Ocurrió algo', 'Por favor completá todos los campos obligatorios');
            return;
        }

        // El precio es obligatorio y lo pone el conductor: es lo que el pasajero ve antes de
        // reservar y con lo que se compara contra los demás viajes. Sin esto, publicar sin
        // querer un viaje en $0 es un click de distancia.
        const precioConductor = parseInt(String(driverPrice).replace(/\./g, ''), 10) || 0;
        if (!formData.sinPrecioFijo && precioConductor <= 0) {
            showAlert('Falta el precio', 'Poné cuánto le cobrás a cada pasajero por el viaje.');
            return;
        }

        setLoading(true);
        try {
            const tripData = {
                vehicle,
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
                departureDate: formData.departureDate,
                departureTime: formData.departureTime,
                availableSeats: parseInt(availableSeats),
                pricePerSeat: 0,
                // Lo que le cobra a cada pasajero, y que le pagan a él al llegar. La conexión
                // (lo que cobra la app) la calcula el server aparte y no se manda desde acá.
                driverPrice: precioConductor,
                // El server lo ignora igual si sinPrecioFijo viene en true: fuerza 0.
                sinPrecioFijo: formData.sinPrecioFijo === true,
                // El pasajero adelanta la mitad para reservar. Con "gastos compartidos" no
                // hay precio del cual sacarla, así que se apaga acá también (el server la
                // normaliza igual — ver backend/utils/sena.js).
                requiereSena: formData.sinPrecioFijo !== true && formData.requiereSena === true,
                notes: formData.notes,
                rules: {
                    smokingAllowed:      formData.allowSmoking,
                    petsAllowed:         formData.allowPets,
                    womenOnly:           formData.womenOnly,
                    largeLuggageAllowed: formData.largeLuggageAllowed,
                },
            };

            const response = await post_withauth(ENDPOINTS.CREATE_TRIP, tripData);
            if (response.success) {
                navigation.navigate('Result', {
                    type: 'success',
                    title: 'Viaje Publicado',
                    message: 'Tu viaje ha sido creado con éxito. Ahora otros usuarios podrán verlo.',
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
            // Bloqueado por saldo pendiente. Se trata aparte del resto de los errores porque
            // NO es una falla: el conductor puede resolverlo, y lo que necesita es entender
            // por qué y adónde ir. Un "Ocurrió algo" genérico lo dejaría sin saber qué hacer.
            if (error.response?.data?.code === 'SALDO_PENDIENTE') {
                showAlert(
                    'Tenés saldo pendiente',
                    error.response.data.message || 'Saldá tu cuenta para volver a publicar viajes.',
                    [
                        { text: 'Ahora no', style: 'cancel' },
                        { text: 'Ver mi saldo', onPress: () => navigation.navigate('ProfileTab', { screen: 'Saldo', initial: false }) }
                    ]
                );
                return;
            }
            navigation.navigate('Result', { type: 'error', title: 'Ocurrió algo', message: error.message || 'No pudimos crear el viaje en este momento.' });
        } finally {
            setLoading(false);
        }
    };

    // El recorrido completo, con las paradas que el conductor eligió en el mapa. Antes esta
    // tarjeta mostraba sólo origen y destino: las paradas se mandaban igual al backend, pero
    // acá no aparecían por ningún lado y parecía que se habían perdido.
    const textoDelPunto = (p) => [p?.address, p?.city, p?.province].filter(Boolean).join(', ');
    const puntosDelViaje = [
        { tipo: 'origen', label: 'Origen', texto: textoDelPunto(origin) },
        ...(waypoints || []).map((wp, i) => ({
            tipo: 'parada',
            label: `Parada ${i + 1}`,
            texto: textoDelPunto(wp),
        })),
        { tipo: 'destino', label: 'Destino', texto: textoDelPunto(destination) },
    ];

    const preferences = [
        { key: 'allowSmoking',        label: 'Permitir fumar',        icon: 'ban-outline' },
        { key: 'allowPets',           label: 'Permitir mascotas',     icon: 'paw-outline' },
        ...(user?.gender === 'female' ? [{ key: 'womenOnly', label: 'Solo mujeres', icon: 'woman-outline' }] : []),
        { key: 'largeLuggageAllowed', label: 'Equipaje grande',       icon: 'bag-handle-outline' },
    ];

    return (
        <>
            <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['left', 'right']}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    {/* `automaticallyAdjustKeyboardInsets` en vez de KeyboardAwareScrollView.
                        Esa librería (0.9.5, sin mantenimiento desde 2021) llama a APIs del
                        renderer viejo —UIManager.viewIsDescendantOf, measureInWindow sobre un
                        findNodeHandle— que en la New Architecture de Expo SDK 54 no existen, y
                        justo se disparan al enfocar un input: es la causa más probable de que
                        la app se cerrara sola en esta pantalla. En iOS ajusta el contentInset
                        solo con el teclado y sube el campo enfocado, sin JS de por medio. */}
                    <ScrollView
                        ref={scrollRef}
                        style={styles.flex}
                        contentContainerStyle={[
                            styles.scroll,
                            { paddingBottom: (alturaTeclado > 0 ? alturaTeclado : Math.max(insets.bottom, 12)) + 16 },
                        ]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        automaticallyAdjustKeyboardInsets
                    >

                        {/* Progreso: en qué paso estás y cuántos faltan. Sin esto el formulario por pasos se
                            siente más largo que el de una sola pantalla, porque no se ve el final. */}
                        <View style={styles.progreso}>
                            {PASOS.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.progresoTramo,
                                        { backgroundColor: i < step ? textPrimary : divider },
                                    ]}
                                />
                            ))}
                        </View>
                        <Text style={[styles.progresoTexto, { color: textMuted }]}>
                            Paso {step} de {PASOS.length} · {PASOS[step - 1].titulo}
                        </Text>

                        {/* Ruta */}
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            {/* Cada punto es UNA fila con su círculo al lado de su texto, igual que en
                                el detalle del viaje. Con la columna de círculos aparte —alto fijo— las
                                paradas intermedias desincronizaban el punto de su dirección. */}
                            <View style={styles.routeList}>
                                {puntosDelViaje.map((punto, i) => (
                                    <View key={`punto-${i}`} style={styles.routePoint}>
                                        <View style={styles.routeRail}>
                                            {punto.tipo === 'origen'
                                                ? <View style={[styles.dotOrigin, { borderColor: textPrimary }]} />
                                                : punto.tipo === 'destino'
                                                    ? <View style={[styles.dotDest, { backgroundColor: textPrimary }]} />
                                                    : <View style={[styles.dotParada, { backgroundColor: textMuted }]} />}
                                            {i < puntosDelViaje.length - 1 && (
                                                <View style={[styles.line, { backgroundColor: border }]} />
                                            )}
                                        </View>
                                        <View style={[styles.routeBody, i < puntosDelViaje.length - 1 && styles.routeBodyGap]}>
                                            <Text style={[styles.routeLabel, { color: textMuted }]}>{punto.label}</Text>
                                            <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={1}>
                                                {punto.texto}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                            {distance && duration && (
                                <Text style={[styles.routeMeta, { color: textMuted, borderTopColor: divider }]}>
                                    {distance} · {duration}
                                </Text>
                            )}
                        </View>


                        {step === 1 && (
                            <>
                        {/* Vehículo */}
                        <Text style={[styles.sectionLabel, { color: textPrimary }]}>VEHÍCULO</Text>
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            <TouchableOpacity
                                style={styles.vehicleRow}
                                onPress={() => navigation.navigate('VehiclePicker', {
                                    vehicles,
                                    selectedId: formData.vehicle,
                                    onSelect: (vehicleId) => handleChange('vehicle', vehicleId),
                                })}
                                activeOpacity={0.7}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={[
                                        styles.vehicleName,
                                        { color: formData.vehicle ? textPrimary : textMuted },
                                    ]}>
                                        {selectedVehicle
                                            ? `${selectedVehicle.brand} ${selectedVehicle.model}`
                                            : 'Seleccionar vehículo'}
                                    </Text>
                                    {/* La placa y los asientos alcanzan para reconocer el auto: ya
                                        es el SUYO, no hace falta que decida nada más con este dato —
                                        las características (A/C, música, etc.) no aportaban acá. */}
                                    {selectedVehicle && (
                                        <Text style={[styles.vehicleSub, { color: textMuted }]} numberOfLines={1}>
                                            {selectedVehicle.licensePlate}
                                            {selectedVehicle.capacity ? `  ·  ${selectedVehicle.capacity} asientos` : ''}
                                        </Text>
                                    )}
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={textPrimary} />
                            </TouchableOpacity>
                        </View>

                        {/* Detalles */}
                        <Text style={[styles.sectionLabel, { color: textPrimary }]}>ASIENTOS Y PRECIO</Text>
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            <View style={[styles.inputRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }, !selectedVehicle && { opacity: 0.5 }]}>
                                <Ionicons name="people-outline" size={19} color={textPrimary} />
                                <TextInput
                                    style={[styles.input, { color: textPrimary }]}
                                    placeholder={
                                        selectedVehicle
                                            ? `Asientos disponibles * (hasta ${maxAsientos})`
                                            : 'Primero elegí un vehículo'
                                    }
                                    placeholderTextColor={textMuted}
                                    value={formData.availableSeats}
                                    editable={!!selectedVehicle}
                                    onFocus={scrollFieldAboveKeyboard}
                                    // No se puede ofrecer más de lo que entra en el auto: el campo
                                    // recorta al tope en vez de dejar escribir un número que el
                                    // backend va a rechazar recién al publicar, tres pasos después.
                                    onChangeText={(v) => {
                                        const digitos = v.replace(/\D/g, '');
                                        if (!digitos) return handleChange('availableSeats', '');
                                        const n = Math.min(parseInt(digitos, 10), maxAsientos || 8);
                                        handleChange('availableSeats', String(n));
                                    }}
                                    keyboardType="numeric"
                                    maxLength={2}
                                />
                            </View>

                            {/* Cómo cobrás. Es una elección entre dos modalidades, no una
                                casilla suelta: con precio fijo no hay nada que "compartir", y
                                con gastos compartidos no hay precio que fijar. Por eso el campo
                                de precio de abajo desaparece cuando esto se prende, en vez de
                                quedar ahí pidiendo un número que no va a usar nadie.

                                Lo que Carpuling cobra NO cambia entre modalidades: son los
                                mismos $2.000 por asiento ocupado en los dos casos. Se dice
                                explícito acá para que no parezca que "compartir gastos" es una
                                forma de no pagar la comisión. */}
                            {/* El toggle es el mismo que usan las preferencias del viaje, no el
                                Switch nativo: el verde de iOS es el unico color fuerte en una
                                pantalla en blanco y negro y se lleva toda la atencion.
                                Toda la fila es tocable, como en preferencias. */}
                            <TouchableOpacity
                                style={[styles.inputRow, { alignItems: 'flex-start' }]}
                                onPress={() => handleChange('sinPrecioFijo', !formData.sinPrecioFijo)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="pricetags-outline" size={19} color={textPrimary} style={{ marginTop: 2 }} />
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={{ color: textPrimary, fontSize: 15, fontFamily: 'Sora_500Medium', flex: 1 }}>
                                            Gastos compartidos
                                        </Text>
                                        <View style={[
                                            styles.toggle,
                                            { backgroundColor: formData.sinPrecioFijo ? textPrimary : divider },
                                        ]}>
                                            <View style={[
                                                styles.toggleCircle,
                                                { backgroundColor: formData.sinPrecioFijo ? ui.invertText : textMuted },
                                                formData.sinPrecioFijo && styles.toggleOn,
                                            ]} />
                                        </View>
                                    </View>
                                    <Text style={{ color: textMuted, fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 17, marginTop: 4 }}>
                                        {formData.sinPrecioFijo
                                            ? 'Arreglás los gastos directo con tus pasajeros.'
                                            : 'Vos fijás el precio y te pagan directo a vos.'} Carpuling cobra $2.000 por asiento aparte.
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* El precio va pegado a los asientos porque es "por asiento" igual que
                                ellos. Es libre: es con lo que el conductor compite contra los otros
                                viajes, y el pasajero lo ve antes de reservar. Con gastos compartidos
                                se deshabilita en vez de desaparecer: sacarlo de golpe del layout
                                hacía que todo lo de abajo saltara feo al tocar el toggle. */}
                            <View
                                style={[styles.inputRow, formData.sinPrecioFijo && { opacity: 0.4 }]}
                                pointerEvents={formData.sinPrecioFijo ? 'none' : 'auto'}
                            >
                                <Ionicons name="cash-outline" size={19} color={textPrimary} />
                                <TextInput
                                    style={[styles.input, { color: textPrimary }]}
                                    placeholder="Precio por pasajero *"
                                    placeholderTextColor={textMuted}
                                    value={formData.driverPrice ? `$${formData.driverPrice}` : ''}
                                    editable={!formData.sinPrecioFijo}
                                    onFocus={scrollFieldAboveKeyboard}
                                    onChangeText={v => {
                                        const digits = v.replace(/\D/g, '');
                                        handleChange('driverPrice', digits
                                            ? Number(digits).toLocaleString('es-AR')
                                            : '');
                                    }}
                                    keyboardType="number-pad"
                                    // Es el último campo del paso y el teclado lo tapaba. El scroll
                                    // de acá cubre el caso de venir de otro input (teclado ya
                                    // arriba); el de keyboardDidShow, el de abrirlo desde cero.
                                />
                            </View>

                            {/* Seña: el pasajero adelanta la mitad para reservar. Es el
                                compromiso contra el que se baja a último momento, cuando el
                                conductor ya contaba con esa plata.
                                Se deshabilita con "Gastos compartidos" en vez de desaparecer
                                (sin precio por asiento no hay mitad que calcular; el server lo
                                fuerza igual, ver utils/sena.js) — mismo criterio que el precio,
                                para que el toggle no haga saltar todo el formulario. */}
                            <TouchableOpacity
                                style={[styles.inputRow, { alignItems: 'flex-start' }, formData.sinPrecioFijo && { opacity: 0.4 }]}
                                onPress={() => handleChange('requiereSena', !formData.requiereSena)}
                                activeOpacity={0.7}
                                disabled={formData.sinPrecioFijo}
                            >
                                <Ionicons name="shield-checkmark-outline" size={19} color={textPrimary} style={{ marginTop: 2 }} />
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={{ color: textPrimary, fontSize: 15, fontFamily: 'Sora_500Medium', flex: 1 }}>
                                            Pedir seña
                                        </Text>
                                        <View style={[
                                            styles.toggle,
                                            { backgroundColor: formData.requiereSena ? textPrimary : divider },
                                        ]}>
                                            <View style={[
                                                styles.toggleCircle,
                                                { backgroundColor: formData.requiereSena ? ui.invertText : textMuted },
                                                formData.requiereSena && styles.toggleOn,
                                            ]} />
                                        </View>
                                    </View>
                                    <Text style={{ color: textMuted, fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 17, marginTop: 4 }}>
                                        {senaPreview
                                            ? `Te adelanta ${senaPreview} por asiento, el resto, al subir.`
                                            : 'Te adelanta la mitad para reservar, el resto, al subir.'}
                                    </Text>
                                    {/* Tocable: sin esto el conductor lee "cargá tu CVU" y tiene
                                        que salir a buscar dónde. Lleva derecho a la pantalla. */}
                                    {formData.requiereSena && !tieneDatosCobro && (
                                        <TouchableOpacity
                                            onPress={() => navigation.navigate('ProfileTab', { screen: 'DatosCobro', initial: false })}
                                            activeOpacity={0.7}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}
                                        >
                                            <Text style={{ color: '#B45309', fontSize: 12, fontFamily: 'Sora_500Medium', lineHeight: 17, flex: 1 }}>
                                                Cargá tu CVU o alias, si no el pasajero no sabe a dónde transferirte.
                                            </Text>
                                            <Ionicons name="chevron-forward" size={14} color="#B45309" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </TouchableOpacity>
                        </View>
                        {/* <View style={[styles.inputRow, { alignItems: 'flex-start' }]}>
                            <Ionicons name="document-text-outline" size={19} color={textMuted} style={{ marginTop: 2 }} />
                            <TextInput
                                style={[styles.input, styles.textArea, { color: textPrimary }]}
                                placeholder="Notas adicionales (opcional)"
                                placeholderTextColor={textMuted}
                                value={formData.notes}
                                onChangeText={v => handleChange('notes', v)}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                        </View> */}

                            </>
                        )}

                        {step === 2 && (
                            <>
                        {/* Fecha y hora */}
                        <Text style={[styles.sectionLabel, { color: textPrimary }]}>FECHA Y HORA DE SALIDA</Text>
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            {Platform.OS === 'web' ? (
                                <>
                                    <DateTimeRow
                                        mode="date"
                                        icon="calendar-outline"
                                        value={formData.departureDate}
                                        min={todayStr}
                                        onChange={(v) => handleChange('departureDate', v)}
                                        colors={{ textPrimary, textMuted, divider, isDark: ui.isDarkMode }}
                                    />
                                    <DateTimeRow
                                        mode="time"
                                        icon="time-outline"
                                        value={formData.departureTime}
                                        onChange={(v) => handleChange('departureTime', v)}
                                        isLast
                                        colors={{ textPrimary, textMuted, divider, isDark: ui.isDarkMode }}
                                    />
                                </>
                            ) : (
                                <>
                            <TouchableOpacity
                                style={[styles.selectRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }]}
                                onPress={() => setShowDatePicker(true)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="calendar-outline" size={19} color={textPrimary} />
                                <Text style={[styles.selectText, { color: formData.departureDate ? textPrimary : textMuted }]}>
                                    {formData.departureDate ? formatDateDisplay(formData.departureDate) : 'Seleccionar fecha'}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={textPrimary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.selectRow}
                                onPress={() => setShowTimePicker(true)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="time-outline" size={19} color={textPrimary} />
                                <Text style={[styles.selectText, { color: formData.departureTime ? textPrimary : textMuted }]}>
                                    {formData.departureTime ? formatTimeDisplay(formData.departureTime) : 'Seleccionar hora'}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={textPrimary} />
                            </TouchableOpacity>
                                </>
                            )}
                        </View>

                            </>
                        )}

                        {step === 3 && (
                            <>
                        {/* Preferencias */}
                        <Text style={[styles.sectionLabel, { color: textPrimary }]}>PREFERENCIAS</Text>
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            {preferences.map((p, index) => (
                                <TouchableOpacity
                                    key={p.key}
                                    style={[
                                        styles.prefRow,
                                        index < preferences.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
                                    ]}
                                    onPress={() => handleChange(p.key, !formData[p.key])}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.prefIcon, { backgroundColor: divider }]}>
                                        <Ionicons name={p.icon} size={17} color={textPrimary} />
                                    </View>
                                    <Text style={[styles.prefText, { color: textPrimary }]}>{p.label}</Text>
                                    <View style={[
                                        styles.toggle,
                                        { backgroundColor: formData[p.key] ? textPrimary : divider },
                                    ]}>
                                        <View style={[
                                            styles.toggleCircle,
                                            { backgroundColor: formData[p.key] ? (ui.invertText) : textMuted },
                                            formData[p.key] && styles.toggleOn,
                                        ]} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>

                            </>
                        )}

                        {/* El botón, al final del contenido y no en un footer fijo. El texto de
                            "qué falta" se renderiza siempre (vacío si no hay nada) para que el
                            botón no cambie de alto entre pasos. */}
                        <View style={[styles.footerScroll, { borderTopColor: divider }]}>
                            <Text style={[styles.faltante, { color: textMuted }]} numberOfLines={1}>
                                {faltante || ' '}
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.submitBtn,
                                    { backgroundColor: ui.invertBg },
                                    (loading || !!faltante) && { opacity: 0.4 },
                                ]}
                                onPress={esUltimoPaso ? handleCreateTrip : irAlSiguientePaso}
                                disabled={loading || !!faltante}
                                activeOpacity={0.85}
                            >
                                {loading
                                    ? <ActivityIndicator color={ui.invertText} size="small" />
                                    : <Text style={[styles.submitText, { color: ui.invertText }]}>
                                        {esUltimoPaso ? 'Publicar viaje' : 'Continuar'}
                                      </Text>
                                }
                            </TouchableOpacity>
                        </View>

                    </ScrollView>
                    </TouchableWithoutFeedback>

            </SafeAreaView>

            {/* Date Picker */}
            {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} minimumDate={new Date()} />
            )}
            {Platform.OS === 'ios' && (
                <Modal transparent animationType="fade" visible={showDatePicker} onRequestClose={() => setShowDatePicker(false)}>
                    <View style={styles.pickerOverlay}>
                        <View style={[styles.pickerBox, { backgroundColor: cardBg }]}>
                            <View style={styles.pickerHeader}>
                                <Text style={[styles.pickerHeaderTitle, { color: textPrimary }]}>Fecha de salida</Text>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Ionicons name="close" size={24} color={textPrimary} />
                                </TouchableOpacity>
                            </View>
                            <View style={{ paddingHorizontal: 16, alignItems: 'center' }}>
                                <DateTimePicker
                                    value={date}
                                    mode="date"
                                    display="spinner"
                                    onChange={(_, d) => { if (d) setDate(d); }}
                                    minimumDate={new Date()}
                                    textColor={textPrimary}
                                    themeVariant={ui.isDarkMode ? 'dark' : 'light'}
                                />
                            </View>
                            <View style={styles.pickerButtons}>
                                <TouchableOpacity style={[styles.pickerButton, { borderColor: border }]} onPress={() => setShowDatePicker(false)}>
                                    <Text style={[styles.pickerButtonText, { color: textMuted }]}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.pickerButton, { backgroundColor: ui.invertBg, borderColor: ui.invertBg }]} onPress={() => onDateChange({ type: 'set' }, date)}>
                                    <Text style={[styles.pickerButtonText, { color: ui.invertText }]}>Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Time Picker */}
            {Platform.OS === 'android' && showTimePicker && (
                <DateTimePicker value={time} mode="time" display="default" onChange={onTimeChange} />
            )}
            {Platform.OS === 'ios' && (
                <Modal transparent animationType="fade" visible={showTimePicker} onRequestClose={() => setShowTimePicker(false)}>
                    <View style={styles.pickerOverlay}>
                        <View style={[styles.pickerBox, { backgroundColor: cardBg }]}>
                            <View style={styles.pickerHeader}>
                                <Text style={[styles.pickerHeaderTitle, { color: textPrimary }]}>Hora de salida</Text>
                                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                                    <Ionicons name="close" size={24} color={textPrimary} />
                                </TouchableOpacity>
                            </View>
                            <View style={{ paddingHorizontal: 16, alignItems: 'center' }}>
                                <DateTimePicker
                                    value={time}
                                    mode="time"
                                    display="spinner"
                                    onChange={(_, t) => { if (t) setTime(t); }}
                                    textColor={textPrimary}
                                    themeVariant={ui.isDarkMode ? 'dark' : 'light'}
                                />
                            </View>
                            <View style={styles.pickerButtons}>
                                <TouchableOpacity style={[styles.pickerButton, { borderColor: border }]} onPress={() => setShowTimePicker(false)}>
                                    <Text style={[styles.pickerButtonText, { color: textMuted }]}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.pickerButton, { backgroundColor: ui.invertBg, borderColor: ui.invertBg }]} onPress={() => onTimeChange({ type: 'set' }, time)}>
                                    <Text style={[styles.pickerButtonText, { color: ui.invertText }]}>Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    flex:      { flex: 1 },
    // flexGrow: el contenido ocupa al menos toda la altura del scroll aunque el paso sea corto,
    // para que el footer (marginTop:'auto') pueda irse al fondo. paddingBottom se pone inline
    // (safe area / alto del teclado).
    scroll:    { padding: 16, gap: 8, flexGrow: 1 },

    sectionLabel: {
        fontSize: 11,
        fontFamily: 'Sora_600SemiBold',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginLeft: 4,
        marginTop: 8,
        marginBottom: 4,
    },

    card: {
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
    },

    // Route
    routeList: {
        padding: 16,
    },
    routePoint: {
        flexDirection: 'row',
        gap: 12,
    },
    routeRail: {
        width: 9,
        alignItems: 'center',
        paddingTop: 3,
    },
    dotOrigin: {
        width: 9,
        height: 9,
        borderRadius: 5,
        borderWidth: 2,
    },
    dotDest: {
        width: 9,
        height: 9,
        borderRadius: 5,
    },
    dotParada: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginVertical: 1.5,
    },
    line: {
        width: 1,
        flex: 1,
        marginVertical: 4,
        minHeight: 18,
    },
    routeBody: {
        flex: 1,
    },
    routeBodyGap: {
        paddingBottom: 14,
    },
    routeLabel: {
        fontSize: 11,
        fontFamily: 'Sora_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 2,
    },
    routeText: {
        fontSize: 14,
        fontFamily: 'Sora_600SemiBold',
    },
    routeMeta: {
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 10,
        borderTopWidth: 1,
    },

    // Select row
    selectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    selectText: {
        flex: 1,
        fontSize: 15,
    },

    // Vehicle row
    vehicleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 12,
    },
    vehicleName: {
        fontSize: 17,
        fontFamily: 'Sora_700Bold',
    },
    vehicleSub: {
        fontSize: 13,
        fontFamily: 'Sora_500Medium',
        marginTop: 2,
    },

    // Input row
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    input: {
        flex: 1,
        fontSize: 15,
    },
    textArea: {
        minHeight: 72,
        paddingTop: 0,
    },
    // Preferences
    prefRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 14,
    },
    prefIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    prefText: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'Sora_500Medium',
    },
    toggle: {
        width: 46,
        height: 26,
        borderRadius: 13,
        padding: 2,
        justifyContent: 'center',
    },
    toggleCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
    },
    toggleOn: {
        alignSelf: 'flex-end',
    },

    // Submit
    progreso: { flexDirection: 'row', gap: 6, marginTop: 18 },
    progresoTramo: { flex: 1, height: 3, borderRadius: 999 },
    progresoTexto: { fontSize: 12, fontFamily: 'Sora_500Medium', marginTop: 8, marginBottom: 4 },
    faltante: { fontSize: 13, fontFamily: 'Sora_400Regular', textAlign: 'center', marginBottom: 10 },
    // `marginTop:'auto'` empuja el botón al fondo del scroll cuando el paso es corto (queda
    // como un footer fijo); cuando el contenido llena la pantalla, colapsa a 0 y el botón va
    // después del contenido. Los márgenes negativos devuelven la línea al ancho completo.
    footerScroll: {
        marginTop: 'auto',
        marginHorizontal: -16,
        paddingHorizontal: 20,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    submitBtn: {
        borderRadius: 999,
        paddingVertical: 16,
        alignItems: 'center',
    },
    submitText: {
        fontSize: 16,
        fontFamily: 'Sora_600SemiBold',
    },


    // Pickers
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerBox: {
        borderRadius: 28,
        marginHorizontal: 24,
        width: '88%',
        maxHeight: '85%',
        overflow: 'hidden',
    },
    pickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 22,
        paddingBottom: 14,
    },
    pickerHeaderTitle: {
        fontSize: 22,
        fontFamily: 'Sora_800ExtraBold',
        letterSpacing: -0.5,
    },
    pickerButtons: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
    },
    pickerButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 999,
        borderWidth: 1,
        alignItems: 'center',
    },
    pickerButtonText: {
        fontSize: 15,
        fontFamily: 'Sora_600SemiBold',
    },
});

export default TripDetails;

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Modal,
    Platform,
    Animated,
    PanResponder,
    useWindowDimensions,
    KeyboardAvoidingView,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '../../utils/mapProvider';
import RutaPolyline from '../map/RutaPolyline';
import DateTimeRow from '../ui/DateTimeRow';
import { horaDeFecha, mismoDia, conMayuscula, NOMBRE_MES, proximaHora } from '../../utils/fechaViaje';

// Los mismos PNG que usa el mapa de elegir direcciones, para que el viaje se vea igual de
// punta a punta.
const MARCADOR_ORIGEN = require('../../../assets/marker-origin.png');
const MARCADOR_DESTINO = require('../../../assets/marker-dest.png');

/**
 * Las piezas de "una hoja sobre el mapa": el patrón con el que se arma un viaje, tanto cuando
 * el conductor lo publica como cuando el pasajero lo pide.
 *
 * Las dos pantallas muestran lo mismo —el recorrido de fondo y una hoja con una fila por dato,
 * que se toca para corregir— así que el mapa, las filas y los selectores viven acá y no
 * duplicados. Lo que cambia entre una y otra son las filas, que las pone cada pantalla.
 *
 * Todo esto está FUERA de los componentes de pantalla a propósito: definido adentro, React lo
 * recrea en cada render y desmonta su contenido — el campo del precio perdía el foco a cada
 * tecla por eso mismo.
 */

/** Tope de escalado de la tipografía del sistema: el texto crece, pero sin romper las filas. */
export const MAX_FS = 1.3;

export const T = (props) => <Text maxFontSizeMultiplier={MAX_FS} {...props} />;

export const Toggle = ({ on, ui }) => (
    <View style={[estilos.toggle, { backgroundColor: on ? ui.text : ui.border }]}>
        <View style={[estilos.toggleBola, { backgroundColor: on ? ui.invertText : ui.textMuted }, on && estilos.toggleBolaOn]} />
    </View>
);

/**
 * Una fila de la hoja: rótulo a la izquierda, valor a la derecha.
 *
 * Sin alto fijo y con el rótulo cediendo ancho antes que el valor: con la tipografía del
 * sistema agrandada (sobre todo en iPhone) una fila de alto fijo se parte.
 */
export const Fila = ({ ui, rotulo, valor, sub, apagado, alerta, onPress, ultimo, children }) => (
    <TouchableOpacity
        style={[estilos.fila, !ultimo && { borderBottomColor: ui.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.6}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${rotulo}${valor ? `: ${valor}` : ''}`}
    >
        <T style={[estilos.filaRotulo, { color: alerta ? '#B45309' : ui.textMuted }]}>{rotulo}</T>
        {children || (
            <View style={estilos.filaValorCaja}>
                <T
                    style={[estilos.filaValor, { color: apagado ? ui.textMuted : ui.text }, apagado && estilos.filaValorApagado]}
                    numberOfLines={2}
                >
                    {valor}
                </T>
                {!!sub && <T style={[estilos.filaSub, { color: ui.textMuted }]} numberOfLines={1}>{sub}</T>}
            </View>
        )}
        {/* Sin flecha cuando la fila tiene un interruptor: la flecha promete que se abre algo. */}
        {!!onPress && !children && <Ionicons name="chevron-forward" size={17} color={ui.border} style={estilos.filaChevron} />}
    </TouchableOpacity>
);

/** Un selector: una hoja que sube desde abajo, encima de la del viaje. */
export const Selector = ({ ui, insets, visible, titulo, sub, onClose, listoApagado, children }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
        <TouchableOpacity style={estilos.velo} activeOpacity={1} onPress={onClose} accessibilityLabel="Cerrar" />
        {/* El selector se apoya abajo, justo donde aparece el teclado: sin esto, al escribir el
            precio el teclado tapaba el número que se estaba escribiendo. */}
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={estilos.tecladoWrap}
            pointerEvents="box-none"
        >
        <View style={[estilos.selector, { backgroundColor: ui.surface, paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
            <View style={[estilos.agarre, { backgroundColor: ui.border }]} />
            <T style={[estilos.selectorTitulo, { color: ui.text }]}>{titulo}</T>
            {!!sub && <T style={[estilos.selectorSub, { color: ui.textMuted }]}>{sub}</T>}
            {children}
            <TouchableOpacity
                style={[estilos.boton, { backgroundColor: ui.invertBg }, listoApagado && { opacity: 0.35 }]}
                onPress={onClose}
                disabled={listoApagado}
                activeOpacity={0.85}
                accessibilityState={{ disabled: !!listoApagado }}
            >
                <T style={[estilos.botonTexto, { color: ui.invertText }]}>Listo</T>
            </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
    </Modal>
);

const DIAS_EN_TIRA = 60;

/**
 * Cuándo sale el viaje. Nada prearmado: los días salen del calendario real arrancando en hoy
 * —así la tira se corre sola cada día y nunca ofrece una fecha pasada— y la hora es la del
 * reloj del teléfono, con cualquier valor.
 */
export const SelectorDeCuando = ({ ui, insets, visible, onClose, cuando: elegido, onCambiar, titulo = '¿Cuándo salís?', sub }) => {
    const [pickerHora, setPickerHora] = useState(false);
    // `elegido` es null hasta que la persona toca un día: no se propone ninguna salida. La rueda
    // de la hora arranca en la próxima hora en punto, y recién cuenta cuando hay día elegido.
    const [cuando, setCuando] = useState(() => elegido || proximaHora());
    // Si desde afuera cambia lo elegido, el selector lo sigue.
    useEffect(() => { if (elegido) setCuando(elegido); }, [elegido]);

    const dias = useMemo(() => {
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
        onCambiar(nueva);
    };

    const onHora = (event, elegida) => {
        if (Platform.OS === 'android') setPickerHora(false);
        if (!elegida || (Platform.OS === 'android' && event?.type !== 'set')) return;
        const nueva = new Date(cuando);
        nueva.setHours(elegida.getHours(), elegida.getMinutes(), 0, 0);
        setCuando(nueva);
        // Sin día elegido la hora queda en la rueda pero no se guarda: elegir sólo la hora no
        // fija una fecha, y hoy no es una fecha que se pueda dar por hecha.
        if (elegido) onCambiar(nueva);
    };

    return (
        <Selector ui={ui} insets={insets} visible={visible} titulo={titulo} sub={sub} onClose={onClose} listoApagado={!elegido}>
            <T style={[estilos.mes, { color: ui.text }]}>
                {`${conMayuscula(NOMBRE_MES[cuando.getMonth()])} ${cuando.getFullYear()}`}
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.tira}>
                {dias.map((dia) => {
                    const seleccionado = !!elegido && mismoDia(dia, cuando);
                    return (
                        <TouchableOpacity
                            key={dia.toISOString()}
                            style={[estilos.dia, { backgroundColor: seleccionado ? ui.text : ui.bg }]}
                            onPress={() => elegirDia(dia)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityState={{ selected: seleccionado }}
                            accessibilityLabel={dia.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        >
                            <T style={[estilos.diaSemana, { color: seleccionado ? ui.invertText : ui.textMuted }]}>
                                {dia.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}
                            </T>
                            <T style={[estilos.diaNumero, { color: seleccionado ? ui.invertText : ui.text }]}>{dia.getDate()}</T>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* La hora, por plataforma. En web el picker nativo de RN no corre: se usa el
                <input type="time"> del navegador. */}
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
                        if (elegido) onCambiar(nueva);
                    }}
                    isLast
                    colors={{ textPrimary: ui.text, textMuted: ui.textMuted, divider: ui.border, isDark: ui.isDarkMode }}
                />
            ) : Platform.OS === 'ios' ? (
                // `locale` es lo que saca el a.m./p.m.: sin esto la rueda sale en 12 horas según
                // el idioma del teléfono, mientras el resto de la app muestra 24. El alto es
                // explícito porque el spinner de iOS se recortaba arriba y abajo.
                <DateTimePicker
                    value={cuando}
                    mode="time"
                    display="spinner"
                    locale="es-AR"
                    onChange={onHora}
                    textColor={ui.text}
                    themeVariant={ui.isDarkMode ? 'dark' : 'light'}
                    style={estilos.rueda}
                />
            ) : (
                <>
                    <TouchableOpacity
                        style={[estilos.horaCaja, { backgroundColor: ui.bg }]}
                        onPress={() => setPickerHora(true)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Hora de salida: ${horaDeFecha(cuando)}`}
                    >
                        <Ionicons name="time-outline" size={19} color={ui.textMuted} />
                        <T style={[estilos.horaTexto, { color: ui.text }]}>{horaDeFecha(cuando)}</T>
                        <Ionicons name="chevron-forward" size={16} color={ui.border} />
                    </TouchableOpacity>
                    {pickerHora && <DateTimePicker value={cuando} mode="time" display="default" is24Hour onChange={onHora} />}
                </>
            )}
        </Selector>
    );
};

/**
 * El recorrido de fondo, y se puede mover: arrastrar, hacer zoom y mirar el camino de verdad.
 * El botón de arriba a la derecha vuelve a encuadrar el viaje entero cuando te perdiste.
 *
 * Se desmonta al perder el foco (`useIsFocused`): el MapView nativo pesa cientos de MB y
 * apilar pantallas con mapa llevaba la RAM al límite hasta que iOS mataba la app.
 */
export const MapaDelRecorrido = ({ ui, puntos, origin, destination, aireAbajo = 340, topBoton = 0 }) => {
    const enfocada = useIsFocused();
    const mapaRef = useRef(null);
    const [listo, setListo] = useState(false);
    const [ancho, setAncho] = useState(0);

    const region = useMemo(() => {
        if (!puntos?.length) return undefined;
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
    // el encuadre se pide cuando el mapa está listo Y ya tiene ancho. El `bottom` es el alto de
    // la hoja, para que el recorrido caiga en la franja que queda a la vista.
    const cantidadDePuntos = puntos?.length || 0;
    const encuadrar = useCallback((animado) => {
        if (cantidadDePuntos < 2) return;
        mapaRef.current?.fitToCoordinates(puntos, {
            edgePadding: { top: 90, right: 50, bottom: aireAbajo, left: 50 },
            animated: animado,
        });
        // `puntos` se arma nuevo en cada render: la dependencia es cuántos son.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cantidadDePuntos, aireAbajo]);

    useEffect(() => {
        if (!listo || !ancho) return;
        encuadrar(false);
    }, [listo, ancho, encuadrar]);

    // Al volver de otra pantalla el mapa se remonta y nace sin encuadrar: las señales se
    // reinician para que el efecto de arriba vuelva a correr.
    useEffect(() => {
        if (!enfocada) { setListo(false); setAncho(0); }
    }, [enfocada]);

    if (!enfocada || !region) return null;

    return (
        <>
        <MapView
            ref={mapaRef}
            provider={MAP_PROVIDER}
            style={StyleSheet.absoluteFill}
            initialRegion={region}
            // Se puede mirar el camino: mover y hacer zoom. Girar e inclinar quedan apagados
            // porque desorientan y no aportan nada para ver una ruta entre ciudades.
            scrollEnabled
            zoomEnabled
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            onMapReady={() => setListo(true)}
            onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        >
            {/* Con dos puntos (sólo las puntas) no hay trazado real que dibujar: sería una recta
                que no es el camino. */}
            {cantidadDePuntos > 2 && (
                <RutaPolyline coordinates={puntos} width={5} color={ui.isDarkMode ? '#FFFFFF' : '#111111'} />
            )}
            {/* Los mismos marcadores que el mapa donde se eligieron las direcciones: el punto
                negro con borde blanco, redondo el origen y cuadrado el destino. En Android van
                como PNG porque la vista custom no sigue a la cámara y queda corrida del trazado
                (mismo motivo que en CreateTripGoogleMaps). */}
            {!!origin?.coordinates && (
                Platform.OS === 'android'
                    ? <Marker coordinate={origin.coordinates} anchor={{ x: 0.5, y: 0.5 }} image={MARCADOR_ORIGEN} />
                    : (
                        <Marker coordinate={origin.coordinates} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                            <View style={estilos.marcadorOrigen}><View style={estilos.marcadorPunto} /></View>
                        </Marker>
                    )
            )}
            {!!destination?.coordinates && (
                Platform.OS === 'android'
                    ? <Marker coordinate={destination.coordinates} anchor={{ x: 0.5, y: 0.5 }} image={MARCADOR_DESTINO} />
                    : (
                        <Marker coordinate={destination.coordinates} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                            <View style={estilos.marcadorDestino}><View style={estilos.marcadorPunto} /></View>
                        </Marker>
                    )
            )}
        </MapView>
        {/* Volver al recorrido completo. Aparece sólo si hay algo que encuadrar. */}
        {cantidadDePuntos >= 2 && (
            <TouchableOpacity
                style={[estilos.recentrar, { backgroundColor: ui.surface, top: topBoton }]}
                onPress={() => encuadrar(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Ver el recorrido completo"
            >
                <Ionicons name="scan-outline" size={19} color={ui.text} />
            </TouchableOpacity>
        )}
        </>
    );
};

/**
 * La hoja de abajo: mide lo que miden sus filas, y se puede bajar de un arrastre para mirar el
 * mapa.
 *
 * El alto lo da el contenido (con un tope) y no una fracción de la pantalla: con seis filas una
 * hoja del 74% dejaba un hueco enorme en el medio. Bajarla no cambia su alto sino su posición
 * (`translateY`, que además anda con el driver nativo): queda asomando el encabezado y el botón
 * de publicar, así nunca se pierde de vista.
 *
 * Son dos posiciones y no libre: un sheet que queda a cualquier altura obliga a acomodarlo, y
 * acá sólo hay dos cosas que mirar.
 */
export const HojaArrastrable = ({ ui, insets, onAltura, children }) => {
    const { height: alturaPantalla } = useWindowDimensions();
    const [alto, setAlto] = useState(0);

    const ty = useRef(new Animated.Value(0)).current;
    const posicion = useRef(0); // dónde está apoyada: 0 arriba, `bajada` abajo
    // El PanResponder se crea una sola vez y no ve los valores de este render: los lee de refs.
    const medidas = useRef({ bajada: 0 });
    // Cuánto asoma de la hoja cuando está bajada: agarre + encabezado + botón.
    const asoma = 150 + Math.max(insets.bottom, 14);
    medidas.current.bajada = Math.max(0, alto - asoma);
    const avisar = useRef(onAltura);
    avisar.current = onAltura;

    // El contenido cambió de tamaño (apareció una fila, se agrandó la letra): si estaba bajada,
    // que no quede fuera de rango.
    useEffect(() => {
        if (posicion.current > medidas.current.bajada) {
            posicion.current = medidas.current.bajada;
            ty.setValue(posicion.current);
        }
    }, [alto, ty]);

    const pan = useRef(
        PanResponder.create({
            // Sólo si el gesto es claramente vertical: si no, se come los toques de las filas.
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
            onPanResponderMove: (_, g) => {
                ty.setValue(Math.min(medidas.current.bajada, Math.max(0, posicion.current + g.dy)));
            },
            onPanResponderRelease: (_, g) => {
                const { bajada } = medidas.current;
                const donde = Math.min(bajada, Math.max(0, posicion.current + g.dy));
                // Un movimiento rápido manda aunque no haya llegado a la mitad.
                const destino = g.vy > 0.5 ? bajada : g.vy < -0.5 ? 0 : (donde > bajada / 2 ? bajada : 0);
                posicion.current = destino;
                Animated.spring(ty, { toValue: destino, useNativeDriver: true, bounciness: 2, speed: 14 }).start();
            },
        }),
    ).current;

    return (
        <Animated.View
            onLayout={(e) => {
                const nuevo = Math.round(e.nativeEvent.layout.height);
                setAlto(nuevo);
                avisar.current?.(nuevo);
            }}
            style={[
                estilos.hoja,
                {
                    maxHeight: Math.round(alturaPantalla * 0.8),
                    backgroundColor: ui.surface,
                    paddingBottom: Math.max(insets.bottom, 14) + 6,
                    transform: [{ translateY: ty }],
                },
            ]}
        >
            {/* El área de arrastre es toda la franja de arriba, no la rayita de 4px. */}
            <View {...pan.panHandlers} style={estilos.zonaAgarre} accessibilityRole="adjustable" accessibilityLabel="Arrastrá para ver el mapa">
                <View style={[estilos.agarre, { backgroundColor: ui.border }]} />
            </View>
            {children}
        </Animated.View>
    );
};

/** El botón de volver, flotando sobre el mapa (la pantalla no tiene header). */
export const BotonVolver = ({ ui, top, onPress, label = 'Volver' }) => (
    <TouchableOpacity
        style={[estilos.volver, { backgroundColor: ui.surface, top }]}
        onPress={onPress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={label}
    >
        <Ionicons name="chevron-back" size={22} color={ui.text} />
    </TouchableOpacity>
);

export const estilos = StyleSheet.create({
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
        borderTopLeftRadius: 26, borderTopRightRadius: 26,
        paddingHorizontal: 18,
        shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 12,
    },
    agarre: { width: 38, height: 4, borderRadius: 9, alignSelf: 'center' },
    // Franja de arriba de la hoja: es lo que se agarra para subirla o bajarla.
    zonaAgarre: { paddingTop: 10, paddingBottom: 12, marginHorizontal: -18, alignItems: 'center' },
    marcadorOrigen: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
    marcadorDestino: { width: 22, height: 22, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
    marcadorPunto: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#000000', borderWidth: 2, borderColor: '#FFFFFF' },
    recentrar: {
        position: 'absolute', right: 14, zIndex: 4,
        width: 38, height: 38, borderRadius: 999,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    },
    encabezado: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
    titulo: { fontSize: 21, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.7 },
    ruta: { fontSize: 12, fontFamily: 'Sora_400Regular', flexShrink: 1, textAlign: 'right' },
    // Se achica antes que empujar el botón fuera de la pantalla, pero sin estirarse para llenar.
    lista: { flexGrow: 0, flexShrink: 1 },

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

    boton: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
    botonTexto: { fontSize: 15.5, fontFamily: 'Sora_600SemiBold' },

    toggle: { width: 46, height: 27, borderRadius: 999, padding: 2.5, justifyContent: 'center' },
    toggleBola: { width: 22, height: 22, borderRadius: 11 },
    toggleBolaOn: { alignSelf: 'flex-end' },

    velo: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
    tecladoWrap: { flex: 1, justifyContent: 'flex-end' },
    selector: {
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
    rueda: { alignSelf: 'stretch', height: 190 },
    horaCaja: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginTop: 4 },
    horaTexto: { flex: 1, fontSize: 17, fontFamily: 'Sora_700Bold', letterSpacing: -0.3 },

    // Las personas de "cuántos viajan" y los asientos que ofrece el conductor: la misma fila.
    personas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' },
    persona: { width: 58, paddingVertical: 10, borderRadius: 14, alignItems: 'center', gap: 2 },
    personaVolante: { borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: 'transparent' },
    personaNum: { fontSize: 10, fontFamily: 'Sora_700Bold', letterSpacing: 0.2 },

    pie: { fontSize: 11.5, fontFamily: 'Sora_400Regular', lineHeight: 17, marginTop: 8, textAlign: 'center' },
});

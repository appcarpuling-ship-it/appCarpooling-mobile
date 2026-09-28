import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Modal,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { mismoDia, NOMBRE_MES, proximaHora } from '../../utils/fechaViaje';

/**
 * Las filas y los selectores con los que se arma un viaje, tanto cuando el conductor lo publica
 * como cuando el pasajero lo pide: las dos pantallas son una lista de filas —una por dato, que
 * se toca para corregir— así que viven acá y no duplicadas. Lo que cambia entre una y otra son
 * las filas, que las pone cada pantalla.
 *
 * Hasta hace poco esto también tenía el mapa de fondo y la hoja arrastrable que se le apoyaba
 * encima (MapaDelRecorrido, HojaArrastrable, BotonVolver). Se sacó: el origen/destino ya se
 * eligieron con mapa en el paso anterior, y un segundo MapView acá sólo sumaba RAM sin agregar
 * información nueva.
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

const DIAS_EN_RUEDA = 60;
const MINUTOS_PASO = 1;
const RUEDA_ITEM_ALTO = 44;
// Impar de renglones visibles (2 arriba + el del medio + 2 abajo), como en la referencia.
const RUEDA_ALTO = RUEDA_ITEM_ALTO * 5;
const RUEDA_PADDING = (RUEDA_ALTO - RUEDA_ITEM_ALTO) / 2;

/**
 * Una columna de la rueda: una lista que se scrollea y encastra ítem por ítem
 * (`snapToInterval`). El de arriba y abajo quedan con padding para que el primer y el último
 * ítem real puedan llegar al centro, bajo la franja resaltada.
 *
 * No confirma nada por su cuenta: sólo avisa qué índice quedó centrado, y sólo cuando fue un
 * arrastre de la persona (`onScrollBeginDrag`) — el salto inicial a la posición de partida
 * (`scrollTo` en el efecto) también dispara `onScroll`, y ese no cuenta como elegir.
 *
 * ponytail: en web (react-native-web) el ScrollView no tiene el snap nativo de iOS/Android —
 * queda scrolleable igual, pero puede asentar unos px salteado del ítem exacto. Si algún día
 * se nota, se arregla con un scroll-snap-type CSS específico para esa plataforma.
 */
const ColumnaRueda = ({ ui, items, formatear, indice, onElegirIndice, alinear = 'center', ancho }) => {
    const scrollRef = useRef(null);
    const arrastrando = useRef(false);
    const [indiceVivo, setIndiceVivo] = useState(indice);

    useEffect(() => {
        setIndiceVivo(indice);
        // Mientras la persona la está arrastrando, la columna ya sabe dónde está por su propio
        // scroll — re-centrarla acá encima pelea con el gesto en curso.
        if (!arrastrando.current) {
            scrollRef.current?.scrollTo({ y: indice * RUEDA_ITEM_ALTO, animated: false });
        }
    }, [indice]);

    const alScrollear = (e) => {
        const y = e.nativeEvent.contentOffset.y;
        const i = Math.max(0, Math.min(items.length - 1, Math.round(y / RUEDA_ITEM_ALTO)));
        if (i !== indiceVivo) {
            setIndiceVivo(i);
            if (arrastrando.current) onElegirIndice(i);
        }
    };

    return (
        <ScrollView
            ref={scrollRef}
            style={{ flex: ancho || 1 }}
            showsVerticalScrollIndicator={false}
            snapToInterval={RUEDA_ITEM_ALTO}
            decelerationRate="fast"
            onScrollBeginDrag={() => { arrastrando.current = true; }}
            // No en onScrollEndDrag: con snapToInterval, soltar el dedo sigue con inercia hasta
            // encastrar, y esa animación también dispara onScroll — cortar acá antes de tiempo
            // hace que el efecto de arriba pelee con la animación de encastre.
            onMomentumScrollEnd={() => { arrastrando.current = false; }}
            onScroll={alScrollear}
            scrollEventThrottle={32}
            contentContainerStyle={{ paddingVertical: RUEDA_PADDING }}
        >
            {items.map((it, i) => (
                <View key={i} style={[estilos.ruedaItem, { alignItems: alinear === 'left' ? 'flex-start' : 'center' }]}>
                    <T
                        style={[
                            estilos.ruedaItemTexto,
                            { color: i === indiceVivo ? ui.text : ui.textMuted },
                            i === indiceVivo && estilos.ruedaItemTextoCentro,
                        ]}
                    >
                        {formatear(it)}
                    </T>
                </View>
            ))}
        </ScrollView>
    );
};

/**
 * Cuándo sale el viaje: una rueda de tres columnas (día, hora, minuto) que se scrollean cada
 * una por su lado, con una franja fija resaltada en el medio — como el selector de horario de
 * Uber. Nada prearmado: la rueda arranca mostrando hoy y la próxima hora en punto, pero eso NO
 * se guarda como elegido hasta que la persona mueve alguna columna con el dedo.
 */
export const SelectorDeCuando = ({ ui, insets, visible, onClose, cuando: elegido, onCambiar, titulo = '¿Cuándo salís?', sub }) => {
    const [cuando, setCuando] = useState(() => elegido || proximaHora());
    // Si desde afuera cambia lo elegido, el selector lo sigue.
    useEffect(() => { if (elegido) setCuando(elegido); }, [elegido]);

    const dias = useMemo(() => {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        return Array.from({ length: DIAS_EN_RUEDA }, (_, i) => {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() + i);
            return d;
        });
    }, []);
    const horas = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
    const minutos = useMemo(() => Array.from({ length: 60 / MINUTOS_PASO }, (_, i) => i * MINUTOS_PASO), []);

    const diaIndice = Math.max(0, dias.findIndex((d) => mismoDia(d, cuando)));
    const horaIndice = cuando.getHours();
    const minutoIndice = Math.round(cuando.getMinutes() / MINUTOS_PASO) % minutos.length;

    // Cada columna comparte esta misma lógica: arma la fecha nueva a partir de la actual y del
    // índice que quedó centrado, y la comunica para afuera — mover cualquiera de las tres
    // columnas cuenta como "elegir", no hace falta pasar primero por el día.
    const comprometer = (nueva) => {
        setCuando(nueva);
        onCambiar(nueva);
    };
    const onElegirDia = (i) => {
        const nueva = new Date(cuando);
        nueva.setFullYear(dias[i].getFullYear(), dias[i].getMonth(), dias[i].getDate());
        comprometer(nueva);
    };
    const onElegirHora = (i) => {
        const nueva = new Date(cuando);
        nueva.setHours(horas[i], cuando.getMinutes(), 0, 0);
        comprometer(nueva);
    };
    const onElegirMinuto = (i) => {
        const nueva = new Date(cuando);
        nueva.setMinutes(minutos[i], 0, 0);
        comprometer(nueva);
    };

    return (
        <Selector ui={ui} insets={insets} visible={visible} titulo={titulo} sub={sub} onClose={onClose} listoApagado={!elegido}>
            <View style={estilos.rueda}>
                <View style={[estilos.ruedaResaltado, { backgroundColor: ui.bg }]} />
                <ColumnaRueda ui={ui} items={dias} ancho={2.1} alinear="left" indice={diaIndice} onElegirIndice={onElegirDia}
                    formatear={(d) => `${d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')} ${d.getDate()} ${NOMBRE_MES[d.getMonth()].slice(0, 3)}`}
                />
                <ColumnaRueda ui={ui} items={horas} indice={horaIndice} onElegirIndice={onElegirHora}
                    formatear={(h) => String(h).padStart(2, '0')}
                />
                <ColumnaRueda ui={ui} items={minutos} indice={minutoIndice} onElegirIndice={onElegirMinuto}
                    formatear={(m) => String(m).padStart(2, '0')}
                />
                {/* Degradé arriba/abajo: RN no tiene mask-image, así que se simula con dos
                    gradientes que se apoyan encima y se funden con el fondo de la hoja. */}
                <LinearGradient
                    colors={[ui.surface, `${ui.surface}00`]}
                    style={estilos.ruedaDegradeArriba}
                    pointerEvents="none"
                />
                <LinearGradient
                    colors={[`${ui.surface}00`, ui.surface]}
                    style={estilos.ruedaDegradeAbajo}
                    pointerEvents="none"
                />
            </View>
        </Selector>
    );
};


export const estilos = StyleSheet.create({
    pantalla: { flex: 1 },
    agarre: { width: 38, height: 4, borderRadius: 9, alignSelf: 'center' },
    titulo: { fontSize: 21, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.7 },

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

    // Mismo pill que el resto de los botones primarios de la app (TripDetailScreen,
    // MyTripsScreen): height fijo + borderRadius 999, no paddingVertical + radius chico.
    boton: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    botonTexto: { fontSize: 16, fontFamily: 'Sora_600SemiBold' },

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

    // La rueda de día/hora/minuto de SelectorDeCuando: tres columnas independientes con una
    // franja fija resaltada en el medio (ruedaResaltado, detrás de las tres) y un degradé
    // arriba/abajo que las funde con el fondo de la hoja.
    rueda: { flexDirection: 'row', gap: 4, marginTop: 14, height: RUEDA_ALTO },
    ruedaResaltado: {
        position: 'absolute', left: 0, right: 0, top: (RUEDA_ALTO - RUEDA_ITEM_ALTO) / 2,
        height: RUEDA_ITEM_ALTO, borderRadius: 14, zIndex: -1,
    },
    ruedaItem: { height: RUEDA_ITEM_ALTO, justifyContent: 'center', paddingHorizontal: 6 },
    ruedaItemTexto: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
    ruedaItemTextoCentro: { fontSize: 18, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.3 },
    ruedaDegradeArriba: { position: 'absolute', left: 0, right: 0, top: 0, height: RUEDA_PADDING, zIndex: 1 },
    ruedaDegradeAbajo: { position: 'absolute', left: 0, right: 0, bottom: 0, height: RUEDA_PADDING, zIndex: 1 },

    // El input grande y centrado de un selector con un solo número: precio, asientos,
    // personas. Un solo lugar así los tres quedan iguales.
    numeroGrande: {
        fontSize: 42, fontFamily: 'Sora_800ExtraBold', letterSpacing: -1.6,
        textAlign: 'center', paddingVertical: 14, lineHeight: 52,
    },

    pie: { fontSize: 11.5, fontFamily: 'Sora_400Regular', lineHeight: 17, marginTop: 8, textAlign: 'center' },
});

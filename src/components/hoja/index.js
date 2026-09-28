import React, { useMemo, useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import DateTimeRow from '../ui/DateTimeRow';
import { horaDeFecha, mismoDia, conMayuscula, NOMBRE_MES, proximaHora } from '../../utils/fechaViaje';

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

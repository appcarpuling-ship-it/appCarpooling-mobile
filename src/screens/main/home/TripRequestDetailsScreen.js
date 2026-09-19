import React, { useState, useMemo, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../../theme/ui';
import { useAlert } from '../../../context/AlertContext';
import { createTripRequest } from '../../../services/tripRequestService';
import {
    T, Fila, Selector, SelectorDeCuando, MapaDelRecorrido, BotonVolver, HojaArrastrable,
    estilos as hoja,
} from '../../../components/hoja';
import { horaDeFecha, fechaLegible, manianaALasOcho } from '../../../utils/fechaViaje';

/**
 * Pedir un viaje: la misma hoja sobre el mapa con la que se publica uno.
 *
 * El pasajero decide mucho menos que el conductor —el precio, el vehículo y el recorrido fino
 * los pone quien se postula—, así que son dos filas y el pedido sale de un toque.
 *
 * Lo que sí hace falta es explicar el mecanismo: pedir un viaje NO es reservarlo. Quien nunca
 * usó la app no tiene forma de saber que lo que sigue son propuestas para comparar, y si eso
 * no se dice antes de publicar, se entera esperando una confirmación que no va a llegar.
 */

/**
 * Tope de lugares por pedido. Es de la app: el modelo admite hasta 8, pero pedir más de 4
 * lugares juntos no entra en un auto particular, que es de lo que se trata acá.
 */
const MAX_PERSONAS = 4;

const TripRequestDetailsScreen = ({ route, navigation }) => {
    const { origin, destination, waypoints } = route.params || {};
    const insets = useSafeAreaInsets();
    const ui = useUI();
    const { showAlert } = useAlert();

    const [cuando, setCuando] = useState(manianaALasOcho);
    const [personas, setPersonas] = useState(1);
    const [loading, setLoading] = useState(false);
    const [selector, setSelector] = useState(null);
    // Cuánto ocupa la hoja: es el espacio que el mapa tiene que dejar libre al encuadrar.
    const [altoHoja, setAltoHoja] = useState(0);

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (selector) { setSelector(null); return true; }
            return false;
        });
        return () => sub.remove();
    }, [selector]);

    // Sin trazado calculado: el recorrido de una solicitud son sus puntos, y el conductor que se
    // postule propone el suyo.
    const puntos = useMemo(() => [origin, ...(waypoints || []), destination]
        .map((p) => p?.coordinates)
        .filter((c) => Number.isFinite(c?.latitude) && Number.isFinite(c?.longitude)),
    [origin, destination, waypoints]);

    const publicar = async () => {
        const salida = new Date(cuando);
        if (salida <= new Date()) {
            showAlert('Revisá la salida', 'La fecha y la hora tienen que ser futuras.');
            setSelector('cuando');
            return;
        }

        setLoading(true);
        try {
            await createTripRequest({
                origin: { address: origin.address, city: origin.city, province: origin.province || '', coordinates: origin.coordinates },
                destination: { address: destination.address, city: destination.city, province: destination.province || '', coordinates: destination.coordinates },
                intermediateStops: (waypoints || []).map((wp, i) => ({
                    address: wp.address,
                    city: wp.city || wp.province || '',
                    province: wp.province || '',
                    coordinates: wp.coordinates,
                    order: i + 1,
                })),
                // El DÍA de calendario a medianoche UTC, que es el contrato que asumen el backend
                // (filtros de próximas/pasadas) y las pantallas que lo formatean con timeZone UTC.
                // Mandar el momento local convertido a UTC rompía las dos cosas: en UTC-3, una
                // solicitud para hoy a las 22:00 se guardaba como la 01:00 UTC de mañana y se
                // mostraba —y se filtraba— como del día siguiente. La hora viaja aparte.
                departureDate: new Date(Date.UTC(cuando.getFullYear(), cuando.getMonth(), cuando.getDate())).toISOString(),
                departureTime: horaDeFecha(cuando),
                seatsNeeded: personas,
                // El precio y la distancia los calcula el backend con el parámetro costoViaje y
                // descarta lo que mande el cliente.
            });

            navigation.navigate('Result', {
                type: 'success',
                title: '¡Pedido publicado!',
                message: 'Los conductores que hagan esta ruta ya pueden ofrecerte lugar.',
            });
        } catch (err) {
            navigation.navigate('Result', {
                type: 'error',
                title: 'Ocurrió algo',
                message: err?.response?.data?.message || 'No se pudo publicar el pedido.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[hoja.pantalla, { backgroundColor: ui.bg }]}>
            <MapaDelRecorrido
                ui={ui}
                puntos={puntos}
                origin={origin}
                destination={destination}
                aireAbajo={altoHoja + 40}
                topBoton={insets.top + 8}
            />
            <BotonVolver ui={ui} top={insets.top + 8} onPress={() => navigation.goBack()} label="Volver al recorrido" />

            {/* Arranca más baja que la de publicar: acá hay dos filas, no seis. */}
            <HojaArrastrable ui={ui} insets={insets} alta={0.6} baja={0.3} onAltura={setAltoHoja}>
                <View style={hoja.encabezado}>
                    <T style={[hoja.titulo, { color: ui.text }]}>Tu pedido</T>
                    <T style={[hoja.ruta, { color: ui.textMuted }]} numberOfLines={1}>
                        {origin?.city || origin?.address} → {destination?.city || destination?.address}
                        {waypoints?.length ? ` · ${waypoints.length} parada${waypoints.length !== 1 ? 's' : ''}` : ''}
                    </T>
                </View>

                <ScrollView style={hoja.lista} showsVerticalScrollIndicator={false} bounces={false}>
                    <Fila
                        ui={ui}
                        rotulo="Salís"
                        valor={`${fechaLegible(cuando)} · ${horaDeFecha(cuando)}`}
                        onPress={() => setSelector('cuando')}
                    />
                    <Fila
                        ui={ui}
                        rotulo="Cuántos viajan"
                        valor={`${personas} ${personas === 1 ? 'persona' : 'personas'}`}
                        onPress={() => setSelector('personas')}
                        ultimo
                    />

                    {/* Lo más importante de la pantalla: qué es lo que está por pasar. Va ANTES del
                        botón, no después, porque es lo que decide si el pedido tiene sentido. */}
                    <View style={[styles.explica, { backgroundColor: ui.bg }]}>
                        {[
                            { icon: 'megaphone-outline', t: 'Los conductores que hagan esta ruta ven tu pedido.' },
                            { icon: 'people-outline', t: 'Hasta 5 se postulan, cada uno con su precio y su auto.' },
                            { icon: 'checkmark-done-outline', t: 'Vos comparás y elegís uno. Recién ahí se arma el viaje.' },
                        ].map((p) => (
                            <View key={p.icon} style={styles.explicaFila}>
                                <Ionicons name={p.icon} size={18} color={ui.text} />
                                <T style={[styles.explicaTexto, { color: ui.text }]}>{p.t}</T>
                            </View>
                        ))}
                        <T style={[hoja.pie, { color: ui.textMuted, textAlign: 'left', marginTop: 10 }]}>
                            No pagás nada por pedirlo y podés cancelarlo cuando quieras. El pedido queda
                            publicado 48 horas.
                        </T>
                    </View>
                </ScrollView>

                <TouchableOpacity
                    style={[hoja.boton, { backgroundColor: ui.invertBg }, loading && { opacity: 0.6 }]}
                    onPress={publicar}
                    disabled={loading}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                >
                    {loading
                        ? <ActivityIndicator color={ui.invertText} size="small" />
                        : <T style={[hoja.botonTexto, { color: ui.invertText }]}>Publicar pedido</T>}
                </TouchableOpacity>
            </HojaArrastrable>

            <SelectorDeCuando
                ui={ui}
                insets={insets}
                visible={selector === 'cuando'}
                cuando={cuando}
                onCambiar={setCuando}
                onClose={() => setSelector(null)}
            />

            <Selector
                ui={ui}
                insets={insets}
                visible={selector === 'personas'}
                titulo="¿Cuántos viajan?"
                sub="Contando a quien te acompañe"
                onClose={() => setSelector(null)}
            >
                <View style={hoja.personas}>
                    {Array.from({ length: MAX_PERSONAS }, (_, i) => i + 1).map((n) => {
                        const incluida = n <= personas;
                        return (
                            <TouchableOpacity
                                key={n}
                                style={[hoja.persona, { backgroundColor: incluida ? ui.text : ui.bg }]}
                                onPress={() => setPersonas(n)}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityState={{ selected: n === personas }}
                                accessibilityLabel={`${n} ${n === 1 ? 'persona' : 'personas'}`}
                            >
                                <Ionicons name={incluida ? 'person' : 'person-outline'} size={18} color={incluida ? ui.invertText : ui.textMuted} />
                                <T style={[hoja.personaNum, { color: incluida ? ui.invertText : ui.textMuted }]}>{n}</T>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <T style={[hoja.pie, { color: ui.textMuted }]}>
                    {personas === 1
                        ? 'Necesitás un lugar.'
                        : `Necesitás ${personas} lugares juntos en el mismo auto.`}
                </T>
            </Selector>
        </View>
    );
};

const styles = StyleSheet.create({
    explica: { borderRadius: 16, padding: 14, marginTop: 14, gap: 10 },
    explicaFila: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    explicaTexto: { flex: 1, fontSize: 13, fontFamily: 'Sora_500Medium', lineHeight: 19 },
});

export default TripRequestDetailsScreen;

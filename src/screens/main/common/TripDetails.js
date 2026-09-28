import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    BackHandler,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { decodePolyline } from '../../../utils/routePoints';
import { senaLegible } from '../../../utils/sena';
import { post_withauth, put_withauth_formdata, buildImageUri } from '../../../services/apiService';
import { useAlert } from '../../../context/AlertContext';
import { useUI } from '../../../theme/ui';
import { useAuth } from '../../../context/AuthContext';
import { ENDPOINTS } from '../../../config/api';
import { imageForType } from '../../../utils/vehicleImage';
import { reportError } from '../../../utils/sentry';
import {
    T, Toggle, Fila, Selector, SelectorDeCuando, MapaDelRecorrido, BotonVolver, HojaArrastrable,
    estilos as hoja,
} from '../../../components/hoja';
import { isoDeFecha, horaDeFecha, fechaLegible, conMiles, soloDigitos } from '../../../utils/fechaViaje';

/**
 * Publicar un viaje: una sola hoja sobre el mapa del recorrido.
 *
 * Reemplaza al formulario de tres pasos que había acá. Todo el viaje se ve de un vistazo en una
 * hoja, y cada fila abre un selector chico en vez de llevar a otro paso.
 *
 * NADA viene decidido de antemano: ni la salida, ni el vehículo, ni los lugares, ni el precio.
 * Un valor por defecto es una decisión tomada en nombre del conductor —y con el precio, además,
 * una cifra que no tiene ningún dato real detrás— así que las filas arrancan vacías y las elige
 * él. El botón nunca está apagado: si falta algo, abre la fila que falta.
 *
 * Lo que se manda al backend y cómo se valida NO cambió: es el mismo POST /trips de antes.
 *
 * Las piezas comunes con "pedir un viaje" (el mapa, las filas, los selectores) viven en
 * `components/hoja`.
 */

/** Un asiento del auto. Tocarlo ofrece hasta ahí; tocar el último lo saca. */
const AsientoTocable = ({ n, asientos, setAsientos, ui }) => {
    const ofrecido = n <= asientos;
    return (
        <TouchableOpacity
            style={[styles.asiento, { backgroundColor: ofrecido ? ui.text : ui.bg }]}
            onPress={() => setAsientos(n === asientos ? n - 1 : n)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: ofrecido }}
            accessibilityLabel={`Ofrecer ${n} asiento${n !== 1 ? 's' : ''}`}
        >
            <Ionicons name={ofrecido ? 'person' : 'person-outline'} size={17} color={ofrecido ? ui.invertText : ui.textMuted} />
            <T style={[styles.asientoTexto, { color: ofrecido ? ui.invertText : ui.textMuted }]}>
                {ofrecido ? 'LIBRE' : '—'}
            </T>
        </TouchableOpacity>
    );
};

const TripDetails = ({ navigation, route }) => {
    const { origin, destination, waypoints, distance, duration, routePolyline, vehicles = [] } = route.params;
    const insets = useSafeAreaInsets();
    const { showAlert } = useAlert();
    const { user, refreshUser } = useAuth();
    const ui = useUI();

    const [loading, setLoading] = useState(false);
    const [selector, setSelector] = useState(null); // qué selector está abierto

    // ── Los valores del viaje: todos vacíos hasta que el conductor los elige ───────────
    const [cuando, setCuando] = useState(null);
    const [vehiculoId, setVehiculoId] = useState(null);
    const [asientos, setAsientos] = useState(0);
    const [precio, setPrecio] = useState('');
    const [sinPrecioFijo, setSinPrecioFijo] = useState(false);
    const [requiereSena, setRequiereSena] = useState(false);
    // Para conductores con ruta/día/horario fijos: cuando este viaje se complete, el server
    // publica solo el de la semana que viene (mismo día/hora), sin que haya que repetirlo a mano.
    const [repetirSemanalmente, setRepetirSemanalmente] = useState(false);
    const [reglas, setReglas] = useState({
        allowSmoking: false,
        allowPets: false,
        womenOnly: false,
        largeLuggageAllowed: false,
    });
    const [alias, setAlias] = useState(user?.datosCobro?.alias || '');
    const [cvu, setCvu] = useState(user?.datosCobro?.cvu || '');
    const [guardandoCobro, setGuardandoCobro] = useState(false);
    // Cuánto ocupa la hoja: es el espacio que el mapa tiene que dejar libre al encuadrar.
    const [altoHoja, setAltoHoja] = useState(0);

    const vehiculo = vehicles.find((v) => v._id === vehiculoId) || null;
    const capacidad = Number(vehiculo?.capacity) || 0;
    const cobroLegible = (alias || cvu || '').trim();

    /**
     * Guarda el alias y el CVU al cerrar el selector, con el mismo endpoint que la pantalla de
     * datos de cobro del perfil. Se guarda al cerrar y no con un botón aparte: el botón de ese
     * selector ya dice "Listo".
     */
    const guardarCobro = async () => {
        setSelector(null);
        const nuevoAlias = alias.trim();
        const nuevoCvu = cvu.trim();
        if (nuevoAlias === (user?.datosCobro?.alias || '') && nuevoCvu === (user?.datosCobro?.cvu || '')) return;
        if (nuevoCvu && nuevoCvu.length !== 22) {
            showAlert('Revisá el CVU', `Tiene que tener 22 dígitos y pusiste ${nuevoCvu.length}.`);
            return;
        }
        setGuardandoCobro(true);
        try {
            const fd = new FormData();
            // Se mandan siempre, incluso vacíos, para poder borrar un dato que ya no querés.
            fd.append('datosCobro_alias', nuevoAlias);
            fd.append('datosCobro_cvu', nuevoCvu);
            fd.append('datosCobro_titular', user?.datosCobro?.titular || '');
            const res = await put_withauth_formdata(ENDPOINTS.UPDATE_PROFILE, fd);
            if (!res?.success) throw new Error(res?.message || 'No se pudo guardar');
            await refreshUser();
        } catch (e) {
            reportError(e, { screen: 'TripDetails', action: 'guardarDatosCobro' });
            showAlert('Ocurrió algo', 'No pudimos guardar tus datos de cobro. Probá de nuevo.');
        } finally {
            setGuardandoCobro(false);
        }
    };

    // Si cambia de vehículo y ya había elegido más lugares de los que tiene el nuevo, se ajustan al
    // tope: nunca pueden quedar más lugares que asientos.
    useEffect(() => {
        if (capacidad > 0) setAsientos((prev) => (prev > capacidad ? capacidad : prev));
    }, [capacidad]);

    // El trazado que ya calculó el mapa del paso anterior; sin él, al menos las dos puntas.
    const puntos = useMemo(() => {
        const coords = routePolyline ? decodePolyline(routePolyline) : [];
        if (coords.length) return coords;
        return [origin?.coordinates, destination?.coordinates].filter(
            (c) => Number.isFinite(c?.latitude) && Number.isFinite(c?.longitude),
        );
    }, [routePolyline, origin, destination]);

    // El botón físico de Android cierra el selector abierto antes que la pantalla.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (selector) { setSelector(null); return true; }
            return false;
        });
        return () => sub.remove();
    }, [selector]);

    // ── Publicar ────────────────────────────────────────────────────────────────────────
    const precioNumero = soloDigitos(precio);
    const senaPreview = senaLegible(precioNumero);

    const faltaVehiculo = !vehiculo;
    const faltaPrecio = !sinPrecioFijo && precioNumero <= 0;
    const faltaCobro = requiereSena && !sinPrecioFijo && !cobroLegible;

    const publicar = async () => {
        // Nada apaga el botón: si falta algo, se abre la fila que lo resuelve, de arriba para
        // abajo, en el mismo orden en que se ven.
        if (!cuando) { setSelector('cuando'); return; }
        if (faltaVehiculo) {
            if (vehicles.length) setSelector('vehiculo');
            else navigation.navigate('ProfileTab', { screen: 'VehicleForm', initial: false });
            return;
        }
        // Sin asientos el backend rechaza el viaje. Con un vehículo sin capacidad cargada no hay
        // nada que elegir, así que ahí se manda a corregir el vehículo en vez de abrir un
        // selector vacío.
        if (!asientos) {
            if (capacidad > 0) { setSelector('asientos'); return; }
            showAlert('Revisá tu vehículo', 'No tiene cargada la cantidad de asientos. Editalo en Mis vehículos y volvé a publicar.');
            return;
        }
        if (faltaPrecio) { setSelector('precio'); return; }
        if (cuando <= new Date()) {
            showAlert('Revisá la salida', 'La fecha y la hora tienen que ser futuras.');
            setSelector('cuando');
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
                repetirSemanalmente,
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

            {/* La hoja del viaje: arranca alta y se baja de un arrastre para mirar el mapa. */}
            <HojaArrastrable ui={ui} insets={insets} onAltura={setAltoHoja}>
                <View style={hoja.encabezado}>
                    <T style={[hoja.titulo, { color: ui.text }]}>Tu viaje</T>
                    <T style={[hoja.ruta, { color: ui.textMuted }]} numberOfLines={1}>
                        {origin?.city || origin?.address} → {destination?.city || destination?.address}
                        {waypoints?.length ? ` · ${waypoints.length} parada${waypoints.length !== 1 ? 's' : ''}` : ''}
                    </T>
                </View>

                <ScrollView style={hoja.lista} showsVerticalScrollIndicator={false} bounces={false}>
                    <Fila
                        ui={ui}
                        rotulo="Sale"
                        valor={cuando ? `${fechaLegible(cuando)} · ${horaDeFecha(cuando)}` : 'Elegí cuándo'}
                        apagado={!cuando}
                        onPress={() => setSelector('cuando')}
                    />
                    <Fila
                        ui={ui}
                        rotulo="Repetir todas las semanas"
                        sub="Al completarlo, se publica solo el de la semana que viene"
                        onPress={() => setRepetirSemanalmente((v) => !v)}
                    >
                        <View style={hoja.filaValorCaja}>
                            <Toggle on={repetirSemanalmente} ui={ui} />
                        </View>
                    </Fila>
                    <Fila
                        ui={ui}
                        rotulo="Vehículo"
                        valor={vehiculo ? `${vehiculo.brand} ${vehiculo.model}` : vehicles.length ? 'Elegí tu vehículo' : 'Agregá tu vehículo'}
                        sub={vehiculo?.licensePlate}
                        apagado={faltaVehiculo}
                        onPress={() => (vehicles.length
                            ? setSelector('vehiculo')
                            : navigation.navigate('ProfileTab', { screen: 'VehicleForm', initial: false }))}
                    />
                    <Fila
                        ui={ui}
                        rotulo="Lugares que ofrecés"
                        valor={asientos ? `${asientos} asiento${asientos !== 1 ? 's' : ''}` : 'Elegí cuántos'}
                        apagado={!asientos}
                        // Los lugares dependen del auto: sin vehículo, la fila lleva a elegirlo.
                        onPress={() => setSelector(vehiculo ? 'asientos' : 'vehiculo')}
                    />
                    <Fila
                        ui={ui}
                        rotulo="Cada pasajero paga"
                        valor={sinPrecioFijo ? 'A convenir' : precioNumero > 0 ? `$${conMiles(precioNumero)}` : 'Poné el precio'}
                        apagado={faltaPrecio}
                        onPress={() => setSelector('precio')}
                    />
                    <Fila
                        ui={ui}
                        rotulo={senaPreview && !sinPrecioFijo ? `Pedir seña de ${senaPreview}` : 'Pedir seña'}
                        onPress={sinPrecioFijo ? undefined : () => setRequiereSena((v) => !v)}
                    >
                        <View style={hoja.filaValorCaja}>
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
                            // Se edita en esta misma pantalla: salir a Perfil desmontaba el
                            // formulario y al volver había que rehacer el viaje entero.
                            onPress={() => setSelector('cobro')}
                        />
                    )}
                    <Fila
                        ui={ui}
                        rotulo="Reglas del viaje"
                        // Contadas y no listadas: con tres reglas el texto se comía dos renglones
                        // y desbordaba la fila. Cuáles son se ven al tocarla.
                        valor={reglasActivas.length
                            ? `${reglasActivas.length} ${reglasActivas.length === 1 ? 'regla' : 'reglas'}`
                            : 'Ninguna'}
                        apagado={!reglasActivas.length}
                        onPress={() => setSelector('reglas')}
                        ultimo
                    />

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
                        : <T style={[hoja.botonTexto, { color: ui.invertText }]}>Publicar viaje</T>}
                </TouchableOpacity>
            </HojaArrastrable>

            <SelectorDeCuando
                ui={ui}
                insets={insets}
                visible={selector === 'cuando'}
                cuando={cuando}
                onCambiar={setCuando}
                onClose={() => setSelector(null)}
                sub={distance && duration ? `${distance} · ${duration}` : undefined}
            />

            {/* ── Vehículo ────────────────────────────────────────────────────────────────── */}
            <Selector
                ui={ui}
                insets={insets}
                visible={selector === 'vehiculo'}
                titulo="¿Con qué vehículo?"
                sub="Los lugares se ajustan al que elijas"
                onClose={() => setSelector(null)}
            >
                <ScrollView style={styles.listaAutos} showsVerticalScrollIndicator={false}>
                    {vehicles.map((v) => {
                        const elegido = v._id === vehiculoId;
                        const foto = fotoDelVehiculo(v);
                        return (
                            <TouchableOpacity
                                key={v._id}
                                style={[styles.auto, { backgroundColor: elegido ? ui.text : ui.bg }]}
                                onPress={() => { setVehiculoId(v._id); setSelector(null); }}
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
                        setSelector(null);
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
                visible={selector === 'asientos'}
                titulo="¿Cuántos lugares ofrecés?"
                sub={vehiculo ? `Tu ${vehiculo.brand} ${vehiculo.model} tiene ${capacidad}` : undefined}
                onClose={() => setSelector(null)}
                listoApagado={!asientos}
            >
                {/* El auto visto desde arriba: adelante el volante y el acompañante, atrás el
                    resto. Los lugares se ofrecen en orden —primero el de adelante— porque el
                    viaje guarda CUÁNTOS asientos hay libres, no cuáles. */}
                <View style={styles.planoAuto}>
                    <View style={styles.autoFila}>
                        <View style={[styles.asiento, styles.asientoConductor, { borderColor: ui.border }]}>
                            <Ionicons name="person" size={17} color={ui.textMuted} />
                            <T style={[styles.asientoTexto, { color: ui.textMuted }]}>VOS</T>
                        </View>
                        {capacidad >= 1 && <AsientoTocable n={1} asientos={asientos} setAsientos={setAsientos} ui={ui} />}
                    </View>
                    {capacidad > 1 && (
                        <View style={styles.autoFila}>
                            {Array.from({ length: capacidad - 1 }, (_, i) => i + 2).map((n) => (
                                <AsientoTocable key={n} n={n} asientos={asientos} setAsientos={setAsientos} ui={ui} />
                            ))}
                        </View>
                    )}
                </View>
                <T style={[hoja.pie, { color: ui.textMuted }]}>
                    {!asientos
                        ? 'Tocá los asientos que ofrecés a pasajeros.'
                        : asientos === capacidad
                            ? `Ofrecés los ${capacidad} lugares libres del auto.`
                            : `Ofrecés ${asientos} de ${capacidad}. Los otros ${capacidad - asientos} te los guardás.`}
                </T>
            </Selector>

            {/* ── Precio ──────────────────────────────────────────────────────────────────── */}
            <Selector
                ui={ui}
                insets={insets}
                visible={selector === 'precio'}
                titulo="¿Cuánto cobrás?"
                sub="Por pasajero"
                onClose={() => setSelector(null)}
                listoApagado={!sinPrecioFijo && precioNumero <= 0}
            >
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
                        <T style={[hoja.pie, { color: ui.textMuted }]}>Te lo pagan a vos, directo.</T>
                    </>
                )}
            </Selector>

            {/* ── Dónde te pagan la seña ──────────────────────────────────────────────────── */}
            <Selector
                ui={ui}
                insets={insets}
                visible={selector === 'cobro'}
                titulo="¿Dónde te pagan?"
                sub="Es lo que ve el pasajero para transferirte"
                onClose={guardarCobro}
            >
                <View style={[styles.campo, { backgroundColor: ui.bg }]}>
                    <T style={[styles.campoRotulo, { color: ui.textMuted }]}>ALIAS</T>
                    <TextInput
                        style={[styles.campoInput, { color: ui.text }]}
                        value={alias}
                        onChangeText={setAlias}
                        placeholder="tu.alias.mp"
                        placeholderTextColor={ui.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxFontSizeMultiplier={1.2}
                    />
                </View>
                <View style={[styles.campo, { backgroundColor: ui.bg }]}>
                    <T style={[styles.campoRotulo, { color: ui.textMuted }]}>CVU O CBU</T>
                    <TextInput
                        style={[styles.campoInput, { color: ui.text }]}
                        value={cvu}
                        onChangeText={(t) => setCvu(t.replace(/\D/g, '').slice(0, 22))}
                        placeholder="22 dígitos"
                        placeholderTextColor={ui.textMuted}
                        keyboardType="number-pad"
                        maxFontSizeMultiplier={1.2}
                    />
                </View>
                <T style={[hoja.pie, { color: ui.textMuted }]}>
                    {guardandoCobro
                        ? 'Guardando…'
                        : 'Con uno de los dos alcanza. Queda guardado en tu perfil.'}
                </T>
            </Selector>

            {/* ── Reglas ──────────────────────────────────────────────────────────────────── */}
            <Selector
                ui={ui}
                insets={insets}
                visible={selector === 'reglas'}
                titulo="Reglas del viaje"
                sub="Opcional. Aparecen en tu aviso."
                onClose={() => setSelector(null)}
            >
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
                            {!!r.sub && <T style={[styles.reglaSub, { color: ui.textMuted }]}>{r.sub}</T>}
                        </View>
                        <Toggle on={!!reglas[r.key]} ui={ui} />
                    </TouchableOpacity>
                ))}
            </Selector>
        </View>
    );
};

// Sólo lo que es propio de publicar un viaje; el resto sale de `components/hoja`.
const styles = StyleSheet.create({
    // El auto visto desde arriba
    planoAuto: { borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', padding: 12, marginTop: 14, gap: 10, alignSelf: 'center', borderColor: 'transparent' },
    autoFila: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
    asiento: { width: 66, paddingVertical: 11, borderRadius: 14, alignItems: 'center', gap: 3 },
    asientoConductor: { borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: 'transparent' },
    asientoTexto: { fontSize: 9.5, fontFamily: 'Sora_700Bold', letterSpacing: 0.3 },

    campo: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },
    campoRotulo: { fontSize: 10, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.6 },
    campoInput: { fontSize: 16, fontFamily: 'Sora_600SemiBold', paddingVertical: 4, marginTop: 2 },

    // Tope de alto: con muchos vehículos la lista empujaba el botón fuera de la pantalla.
    listaAutos: { flexGrow: 0, maxHeight: 290, marginTop: 12 },
    auto: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 10, marginBottom: 8 },
    autoFoto: { width: 56, height: 42, borderRadius: 10 },
    autoTexto: { flex: 1, minWidth: 0 },
    autoNombre: { fontSize: 14.5, fontFamily: 'Sora_700Bold', letterSpacing: -0.2 },
    autoSub: { fontSize: 11.5, fontFamily: 'Sora_400Regular', marginTop: 1 },
    verDetalle: { paddingVertical: 10, alignItems: 'center' },
    verDetalleTexto: { fontSize: 12.5, fontFamily: 'Sora_600SemiBold' },

    segmento: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4, marginTop: 14 },
    segmentoBoton: { flex: 1, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
    segmentoTexto: { fontSize: 12.5, fontFamily: 'Sora_600SemiBold' },

    precioInput: {
        fontSize: 42, fontFamily: 'Sora_800ExtraBold', letterSpacing: -1.6,
        textAlign: 'center', paddingVertical: 14, lineHeight: 52,
    },
    explica: { fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 19, marginTop: 16, textAlign: 'center' },

    regla: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, marginTop: 2 },
    reglaTexto: { flex: 1, minWidth: 0 },
    reglaLabel: { fontSize: 14, fontFamily: 'Sora_500Medium' },
    reglaSub: { fontSize: 11, fontFamily: 'Sora_400Regular', marginTop: 1 },
});

export default TripDetails;

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { get_withauth, delete_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useUI } from '../../../theme/ui';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { reportError } from '../../../utils/sentry';
import VehicleShowcase from '../../../components/vehicle/VehicleShowcase';
import { useScreenWidth } from '../../../hooks/useScreenWidth';

/**
 * La ficha de UN vehículo: foto, datos, comodidades y estado de los papeles.
 *
 * Es lo que antes era la pantalla entera de "Mis vehículos", cuando cada auto ocupaba una
 * página de un carrusel. Ahora la lista es el índice (VehiclesScreen) y el detalle vive acá,
 * que es lo que permitió sacarle a la lista todo lo que no sirve para elegir.
 *
 * Mismo VehicleShowcase que usa VehiclePickerScreen; la única diferencia son los dos botones
 * sobre la foto, que allá no van.
 */
const VehicleDetailScreen = () => {
  const SCREEN_W = useScreenWidth();
  const navigation = useNavigation();
  const route = useRoute();
  const ui = useUI();
  const insets = useSafeAreaInsets();

  const [vehicle, setVehicle] = useState(route.params?.vehicle || null);

  // Al volver de editarlo, los params siguen teniendo la versión vieja y la ficha mostraba
  // los datos de antes. No hay GET /vehicles/:id, así que se relee la propia lista.
  // ponytail: una sola página. Con más de LIST_PAGE_SIZE autos no lo encuentra y se queda con
  // lo que tenía, que es exactamente lo de hoy; si algún día eso pasa, va un endpoint por id.
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      const id = route.params?.vehicle?._id;
      if (!id) return undefined;

      get_withauth(ENDPOINTS.MY_VEHICLES, { page: 1, limit: LIST_PAGE_SIZE })
        .then((res) => {
          if (!vivo || !res?.success || !Array.isArray(res.data)) return;
          const fresco = res.data.find((v) => v._id === id);
          if (fresco) setVehicle(fresco);
        })
        .catch((error) => reportError(error, { screen: 'VehicleDetailScreen', action: 'refrescar' }));

      return () => {
        vivo = false;
      };
    }, [route.params?.vehicle?._id])
  );

  const handleDelete = () => {
    navigation.navigate('Confirm', {
      title: 'Eliminar Vehículo',
      message: '¿Seguro que querés eliminar este vehículo?',
      confirmLabel: 'Eliminar',
      destructive: true,
      onConfirm: async () => {
        const response = await delete_withauth(ENDPOINTS.DELETE_VEHICLE(vehicle._id));
        if (!response.success) throw new Error(response.message || 'No se pudo eliminar el vehículo');
        // Sin volver a ninguna parte a propósito: el Result de éxito resetea el stack al Home,
        // así que esta pantalla, que quedó apuntando a un auto que ya no existe, se va con él.
      },
      successParams: { title: 'Vehículo eliminado', message: 'Ya no figura en tu lista.' },
      errorParams: { title: 'Ocurrió algo' },
    });
  };

  if (!vehicle) return <View style={[styles.container, { backgroundColor: ui.bg }]} />;

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
      <VehicleShowcase
        vehicle={vehicle}
        width={SCREEN_W}
        aireAbajo={insets.bottom + 20}
        acciones={[
          {
            icon: 'create-outline',
            label: 'Editar vehículo',
            onPress: () => navigation.navigate('VehicleForm', { vehicle }),
          },
          { icon: 'trash-outline', label: 'Eliminar vehículo', onPress: handleDelete },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default VehicleDetailScreen;

import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, AppState } from 'react-native';

export const useGalleryPermissions = () => {
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [accessConfirmed, setAccessConfirmed] = useState(false); // Nuevo estado para recordar acceso exitoso

  // Log cuando cambie el estado del modal
  useEffect(() => {
    console.log('🔄 Estado del modal de permisos:', showPermissionModal);
  }, [showPermissionModal]);

  // Verificar permisos al cargar el hook
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  // Verificar permisos cuando la app vuelve al primer plano
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App volvió al primer plano, verificando permisos...');
        // Reset del estado confirmado y re-verificar permisos
        setAccessConfirmed(false);
        setTimeout(() => {
          forceRefreshPermissions();
        }, 500); // Pequeño delay para asegurar que los cambios se reflejen
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, []);

  const checkPermissionStatus = async () => {
    try {
      const result = await ImagePicker.getMediaLibraryPermissionsAsync();
      console.log('🔍 Verificando permisos - Resultado completo:', result);
      console.log('🔍 Estado:', result.status);
      console.log('🔍 Puede pedir permisos:', result.canAskAgain);
      console.log('🔍 Otorgado:', result.granted);
      
      setPermissionStatus(result.status);
      return result.status;
    } catch (error) {
      console.error('Error verificando permisos:', error);
      return 'denied';
    }
  };

  const testGalleryAccess = async () => {
    console.log('🧪 Probando acceso directo a la galería...');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.1, // Baja calidad para test rápido
      });
      
      if (!result.canceled) {
        console.log('✅ ¡Acceso a galería exitoso! Los permisos están funcionando.');
        setPermissionStatus('granted');
        setAccessConfirmed(true); // Marcar que confirmamos el acceso
        setShowPermissionModal(false);
        return result.assets[0];
      } else {
        console.log('❌ Usuario canceló la selección');
        return null;
      }
    } catch (error) {
      console.error('❌ Error accediendo a galería:', error);
      console.log('Esto confirma que no hay permisos reales');
      setAccessConfirmed(false); // Marcar que no hay acceso
      return null;
    }
  };

  const forceRefreshPermissions = async () => {
    console.log('🔄 Forzando actualización de permisos...');
    // Reset del estado de acceso confirmado para forzar re-verificación
    setAccessConfirmed(false);
    
    // En iOS, a veces necesitamos un pequeño delay
    await new Promise(resolve => setTimeout(resolve, 100));
    const newStatus = await checkPermissionStatus();
    console.log('✅ Permisos actualizados:', newStatus);
    
    // Si ahora tenemos permisos, cerrar el modal
    if (newStatus === 'granted') {
      console.log('🎉 Permisos otorgados! Cerrando modal...');
      setAccessConfirmed(true);
      setShowPermissionModal(false);
    }
    
    return newStatus;
  };

  const requestPermission = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setPermissionStatus(status);
      
      if (status === 'granted') {
        setShowPermissionModal(false);
        return true;
      } else if (status === 'denied') {
        // Si el permiso fue denegado permanentemente, mostrar modal
        setShowPermissionModal(true);
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Error solicitando permisos:', error);
      return false;
    }
  };

  const openSettings = () => {
    Linking.openSettings();
    setShowPermissionModal(false);
  };

  const handlePermissionRequest = async () => {
    // Si ya confirmamos que el acceso funciona, no mostrar modal
    if (accessConfirmed) {
      console.log('✅ Acceso ya confirmado previamente, omitiendo verificación');
      return true;
    }

    // Siempre verificar el estado actual primero
    const currentStatus = await checkPermissionStatus();
    
    console.log('Estado actual del permiso:', currentStatus);
    
    if (currentStatus === 'granted') {
      console.log('✅ Permisos ya otorgados, cerrando modal...');
      setShowPermissionModal(false); // Cerrar modal si está abierto
      setAccessConfirmed(true); // Marcar como confirmado
      return true;
    }
    
    if (currentStatus === 'undetermined') {
      console.log('Permiso no determinado, solicitando...');
      return await requestPermission();
    }
    
    // Si el permiso fue denegado, mostrar modal para ir a configuración
    console.log('❌ Permiso denegado, mostrando modal...');
    setShowPermissionModal(true);
    return false;
  };

  const showPermissionAlert = () => {
    Alert.alert(
      'Permisos de Galería',
      'Para seleccionar imágenes necesitamos acceso a tu galería. ¿Quieres ir a configuración para habilitarlo?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Ir a Configuración',
          onPress: openSettings,
        },
      ]
    );
  };

  const pickImage = async (options = {}) => {
    const hasPermission = await handlePermissionRequest();
    
    if (!hasPermission) {
      // Si la API dice que no hay permisos, intentar abrir la galería directamente
      // Esto maneja el caso de iOS + Expo Go donde la API miente
      console.log('🧪 API dice no permisos, intentando acceso directo...');
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          ...options,
        });

        if (!result.canceled) {
          console.log('✅ ¡Acceso directo exitoso! Marcando permisos como confirmados.');
          setAccessConfirmed(true);
          setPermissionStatus('granted');
          setShowPermissionModal(false); // Cerrar modal si está abierto
          return result.assets[0];
        } else {
          console.log('❌ Usuario canceló la selección');
          return null;
        }
      } catch (error) {
        console.error('❌ Error en acceso directo:', error);
        // Si el acceso directo también falla, el modal ya se mostró en handlePermissionRequest
        return null;
      }
    }

    // Si tenemos permisos confirmados, proceder normalmente
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        ...options,
      });

      if (!result.canceled) {
        return result.assets[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error seleccionando imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
      return null;
    }
  };

  return {
    permissionStatus,
    showPermissionModal,
    setShowPermissionModal,
    pickImage,
    requestPermission,
    openSettings,
    handlePermissionRequest,
    showPermissionAlert,
    forceRefreshPermissions,
    testGalleryAccess,
  };
};
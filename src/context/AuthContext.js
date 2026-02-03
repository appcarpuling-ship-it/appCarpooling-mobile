import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { post_public, get_withauth, put_withauth, post_withauth_formdata, put_withauth_formdata } from '../services/apiService';
import { ENDPOINTS, API_CONFIG } from '../config/api';
import socketService from '../services/socketService';
import {
  registerForPushNotificationsAsync,
  savePushTokenToServer,
  removePushTokenFromServer
} from '../services/pushNotificationService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Retornar valores por defecto en lugar de lanzar error para evitar problemas con hooks
    console.warn('useAuth: AuthContext no disponible, usando valores por defecto');
    return {
      user: null,
      loading: false,
      isAuthenticated: false,
      login: () => Promise.resolve({ success: false }),
      register: () => Promise.resolve({ success: false }),
      logout: () => {},
      updateProfile: () => Promise.resolve({ success: false }),
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Cargar usuario al iniciar la app
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');

      if (token && userData) {
        setUser(JSON.parse(userData));
        setIsAuthenticated(true);
        // Conectar WebSocket cuando el usuario ya está autenticado
        socketService.connect();
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await post_public(ENDPOINTS.LOGIN, { email, password });

      if (response.success) {
        const { token, user } = response.data;
        await AsyncStorage.setItem('token', token);
        await AsyncStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        setIsAuthenticated(true);
        // Conectar WebSocket después del login
        socketService.connect();

        // Registrar push notifications
        try {
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) {
            await savePushTokenToServer(pushToken);
            console.log('✅ Push token registrado exitosamente');
          }
        } catch (pushError) {
          console.log('⚠️ Error registrando push notifications:', pushError);
          // No bloquear el login si falla el registro de push
        }

        return { success: true };
      }

      // Si el usuario no está verificado, pasar la información
      if (response.requiresVerification) {
        return {
          success: false,
          message: response.message,
          requiresVerification: true,
          email: response.data?.email
        };
      }

      return { success: false, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const register = async (userData) => {
    try {
      // Determinar si es FormData o JSON
      const isFormData = userData instanceof FormData;

      let response;
      if (isFormData) {
        // Usar función especial para FormData
        response = await post_withauth_formdata(ENDPOINTS.REGISTER, userData);
      } else {
        response = await post_public(ENDPOINTS.REGISTER, userData);
      }

      if (response.success) {
        // Redirigir a verificación de email
        return { success: true, data: response.data };
      }

      return { success: false, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const verifyEmail = async (email, verificationCode) => {
    try {
      console.log('🔐 [verifyEmail] Verificando código:', { email, verificationCode });
      console.log('🔐 [verifyEmail] URL endpoint:', `${API_CONFIG.BASE_URL}${ENDPOINTS.VERIFY_EMAIL}`);

      const response = await post_public(ENDPOINTS.VERIFY_EMAIL, {
        email,
        verificationCode,
      });

      console.log('🔐 [verifyEmail] Respuesta completa:', response);

      if (response.success) {
        return { success: true, data: response.data };
      }

      // Diagnóstico detallado del error
      console.error('❌ [verifyEmail] Verification failed:', {
        message: response.message,
        status: response.status,
        fullResponse: response
      });

      return {
        success: false,
        message: response.message || 'Error al verificar código',
        isBackendIssue: response.message?.includes('Usuario no encontrado') ||
                        response.message?.includes('not found') ||
                        !response.message
      };
    } catch (error) {
      console.error('❌ [verifyEmail] Error completo:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
        url: `${API_CONFIG.BASE_URL}${ENDPOINTS.VERIFY_EMAIL}`
      });

      // Detectar si es un error de backend no implementado
      const isEndpointMissing = error.response?.status === 404 ||
                               error.message?.includes('Not Found') ||
                               error.message?.includes('Cannot POST');

      const isUserNotFound = error.message?.includes('Usuario no encontrado') ||
                            error.message?.includes('User not found');

      return {
        success: false,
        message: error.message || 'Error de conexión al verificar código',
        isBackendIssue: isEndpointMissing || isUserNotFound,
        errorDetails: {
          type: isEndpointMissing ? 'ENDPOINT_MISSING' : isUserNotFound ? 'USER_NOT_FOUND' : 'CONNECTION_ERROR',
          status: error.response?.status,
          url: `${API_CONFIG.BASE_URL}${ENDPOINTS.VERIFY_EMAIL}`
        }
      };
    }
  };

  const resendVerification = async (email) => {
    try {
      console.log('📧 [resendVerification] Reenviando código a:', email);
      console.log('📧 [resendVerification] URL endpoint:', `${API_CONFIG.BASE_URL}${ENDPOINTS.RESEND_VERIFICATION}`);

      const response = await post_public(ENDPOINTS.RESEND_VERIFICATION, { email });

      console.log('📧 [resendVerification] Respuesta completa:', response);

      if (response.success) {
        return { success: true };
      }

      return { success: false, message: response.message || 'Error al reenviar código' };
    } catch (error) {
      console.error('❌ [resendVerification] Error completo:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
        url: `${API_CONFIG.BASE_URL}${ENDPOINTS.RESEND_VERIFICATION}`
      });

      return {
        success: false,
        message: error.message || 'Error de conexión al reenviar código',
        isBackendIssue: error.response?.status === 404 ||
                        error.message?.includes('Not Found') ||
                        error.message?.includes('Cannot POST') ||
                        error.message?.includes('Usuario no encontrado')
      };
    }
  };

  const logout = async () => {
    try {
      console.log('🔐 AuthContext.logout - INICIANDO');
      console.log('🔐 AuthContext.logout - Estado antes: isAuthenticated:', isAuthenticated, 'user:', user);

      // Eliminar push token del servidor
      try {
        await removePushTokenFromServer();
        console.log('✅ Push token eliminado del servidor');
      } catch (pushError) {
        console.log('⚠️ Error eliminando push token:', pushError);
      }

      // Desconectar WebSocket antes de cerrar sesión
      console.log('🔐 AuthContext.logout - Desconectando WebSocket...');
      socketService.disconnect();

      console.log('🔐 AuthContext.logout - Eliminando token y user de AsyncStorage...');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');

      console.log('🔐 AuthContext.logout - Actualizando estado...');
      setUser(null);
      setIsAuthenticated(false);

      console.log('✅ AuthContext.logout - COMPLETADO - isAuthenticated debería ser false ahora');
      console.log('✅ AuthContext.logout - El AppNavigator debería detectar el cambio y re-renderizar');
    } catch (error) {
      console.error('❌ AuthContext.logout - Error al cerrar sesión:', error);
      throw error;
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await put_withauth(ENDPOINTS.UPDATE_PROFILE, profileData);

      if (response.success) {
        const updatedUser = response.data;
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        return { success: true };
      }

      return { success: false, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const refreshUser = async () => {
    try {
      const response = await get_withauth(ENDPOINTS.GET_ME);

      if (response.success) {
        const userData = response.data;
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      }
    } catch (error) {
      console.error('Error refrescando usuario:', error);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    verifyEmail,
    resendVerification,
    logout,
    updateProfile,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { post_public, get_withauth, put_withauth } from '../services/apiService';
import { ENDPOINTS, API_CONFIG } from '../config/api';
import socketService from '../services/socketService';
import { registerSessionInvalidHandler, registerAccountDisabledHandler } from '../services/authSession';
import {
  registerForPushNotificationsAsync,
  savePushTokenToServer,
  removePushTokenFromServer
} from '../services/pushNotificationService';
import * as AppleAuthentication from 'expo-apple-authentication';

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
      loginWithJwt: () => Promise.resolve({ success: false }),
      loginWithApple: () => Promise.resolve({ success: false }),
      register: () => Promise.resolve({ success: false }),
      logout: () => {},
      updateProfile: () => Promise.resolve({ success: false }),
      refreshUser: async () => {},
      accountBlocked: null,
      clearAccountBlocked: () => {},
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  /** null cuando no hay bloqueo; { supportEmail } cuando un admin bloqueó la cuenta. */
  const [accountBlocked, setAccountBlocked] = useState(null);

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
        // Registrar push token en cada apertura de app
        try {
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) {
            await savePushTokenToServer(pushToken);
          }
        } catch (pushError) {
          console.log('⚠️ Error registrando push token en loadUser:', pushError);
        }
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
      const res = error.response;
      if (res?.status === 403 && res?.data?.requiresVerification) {
        return {
          success: false,
          message: res.data.message || 'Por favor verificá tu email antes de iniciar sesión.',
          requiresVerification: true,
          email: res.data.data?.email,
        };
      }
      // El login usa post_public, que va por axios directo y NO pasa por el
      // interceptor de la instancia `api`: el bloqueo hay que atajarlo acá.
      if (res?.status === 401 && res?.data?.code === 'ACCOUNT_DISABLED') {
        setAccountBlocked({
          supportEmail: res.data.supportEmail || null,
          supportWhatsapp: res.data.supportWhatsapp || null,
        });
        return { success: false, accountDisabled: true, message: res.data.message };
      }
      return { success: false, message: error.message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await post_public(ENDPOINTS.REGISTER, userData);

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
      const status = error.response?.status;
      const serverMessage = error.response?.data?.message;

      // 4xx = respuesta válida del servidor (código mal, expirado, etc.); no es bug ni crash
      if (status >= 400 && status < 500) {
        console.log('🔐 [verifyEmail] Validación:', { status, message: serverMessage || error.message });
      } else {
        console.error('❌ [verifyEmail] Error completo:', {
          message: error.message,
          stack: error.stack,
          response: error.response?.data,
          status,
          url: `${API_CONFIG.BASE_URL}${ENDPOINTS.VERIFY_EMAIL}`,
        });
      }

      // Detectar si es un error de backend no implementado
      const isEndpointMissing = status === 404 ||
                               error.message?.includes('Not Found') ||
                               error.message?.includes('Cannot POST');

      const isUserNotFound = error.message?.includes('Usuario no encontrado') ||
                            error.message?.includes('User not found');

      return {
        success: false,
        message: serverMessage || error.message || 'Error de conexión al verificar código',
        isBackendIssue: isEndpointMissing || isUserNotFound,
        errorDetails: {
          type: isEndpointMissing ? 'ENDPOINT_MISSING' : isUserNotFound ? 'USER_NOT_FOUND' : 'CONNECTION_ERROR',
          status,
          url: `${API_CONFIG.BASE_URL}${ENDPOINTS.VERIFY_EMAIL}`,
        },
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

  const logout = useCallback(async () => {
    try {
      console.log('🔐 AuthContext.logout - INICIANDO');

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

      console.log('✅ AuthContext.logout - COMPLETADO');
    } catch (error) {
      console.error('❌ AuthContext.logout - Error al cerrar sesión:', error);
      throw error;
    }
  }, []);

  // 401 / token inválido / socket auth: mismo flujo que logout (estado + push + socket)
  useEffect(() => {
    registerSessionInvalidHandler(logout);
    return () => registerSessionInvalidHandler(null);
  }, [logout]);

  // Cuenta bloqueada por un admin: además del logout, se guarda el correo de
  // soporte para que AppNavigator muestre la pantalla explicando qué pasó. Si
  // solo hiciéramos logout, el usuario volvería al login sin entender por qué.
  useEffect(() => {
    registerAccountDisabledHandler(async (info) => {
      await logout();
      setAccountBlocked({
        supportEmail: info?.supportEmail || null,
        supportWhatsapp: info?.supportWhatsapp || null,
      });
    });
    return () => registerAccountDisabledHandler(null);
  }, [logout]);

  const clearAccountBlocked = useCallback(() => setAccountBlocked(null), []);

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

  // Helper compartido: persiste sesión SSO y conecta servicios
  const _completeSsoLogin = async (token, user) => {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    setIsAuthenticated(true);
    socketService.connect();
    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) await savePushTokenToServer(pushToken);
    } catch {}
    return { success: true };
  };

  const loginWithJwt = async (token) => {
    try {
      await AsyncStorage.setItem('token', token);
      const response = await get_withauth(ENDPOINTS.GET_ME);
      if (response.success) {
        const user = response.data;
        await AsyncStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        setIsAuthenticated(true);
        socketService.connect();
        try {
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) await savePushTokenToServer(pushToken);
        } catch {}
        return { success: true };
      }
      await AsyncStorage.removeItem('token');
      return { success: false, message: response.message };
    } catch (error) {
      await AsyncStorage.removeItem('token');
      return { success: false, message: error.message };
    }
  };

  const loginWithApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const response = await post_public(ENDPOINTS.APPLE_AUTH, {
        identityToken: credential.identityToken,
        fullName: credential.fullName,
        email: credential.email,
      });
      if (response.success) {
        return await _completeSsoLogin(response.data.token, response.data.user);
      }
      return { success: false, message: response.message };
    } catch (error) {
      if (error.code === 'ERR_REQUEST_CANCELED') return { success: false, cancelled: true };
      return { success: false, message: error.message };
    }
  };

  const refreshUser = useCallback(async () => {
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
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    loginWithJwt,
    loginWithApple,
    register,
    verifyEmail,
    resendVerification,
    logout,
    updateProfile,
    refreshUser,
    accountBlocked,
    clearAccountBlocked,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

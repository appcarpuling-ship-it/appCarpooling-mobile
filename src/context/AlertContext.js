import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import AlertModal from '../components/modals/AlertModal';

const AlertContext = createContext(null);

// API imperativa para usar desde hooks o fuera de componentes React
export const alertRef = { current: null };

export const AlertProvider = ({ children }) => {
  const [alertState, setAlertState] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  const showAlert = useCallback((title, message, buttons = []) => {
    setAlertState({
      visible: true,
      title: title || '',
      message: message || '',
      buttons: buttons.length > 0 ? buttons : [{ text: 'OK' }],
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    alertRef.current = { showAlert, hideAlert };
    return () => { alertRef.current = null; };
  }, [showAlert, hideAlert]);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <AlertModal
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onRequestClose={hideAlert}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert debe usarse dentro de AlertProvider');
  }
  return context;
};

// Reemplazo directo de Alert.alert para usar en hooks o fuera de componentes
export const showAlertAsync = (title, message, buttons = []) => {
  if (alertRef.current?.showAlert) {
    alertRef.current.showAlert(title, message, buttons.length > 0 ? buttons : [{ text: 'OK' }]);
  } else {
    // Fallback si no hay provider (ej: en tests)
    const { Alert } = require('react-native');
    Alert.alert(title, message, buttons.length > 0 ? buttons : [{ text: 'OK' }]);
  }
};

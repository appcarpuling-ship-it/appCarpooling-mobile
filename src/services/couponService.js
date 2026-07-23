import { post_withauth, get_withauth } from './apiService';

/**
 * Servicio para canjear y consultar cupones (viaje gratis / % descuento / monto fijo).
 * El cupón se aplica automáticamente en el backend al reservar/aceptar un viaje;
 * este servicio solo canjea el código y lista el estado.
 */

/**
 * Canjear un código de cupón
 * @param {string} code
 * @returns {Promise<Object>} - { success, message, data? }
 */
export const redeemCoupon = async (code) => {
  try {
    const response = await post_withauth('/coupons/redeem', { code });
    return response;
  } catch (error) {
    console.error('Error canjeando cupón:', error);
    throw error;
  }
};

/**
 * Obtener mis cupones canjeados
 * @returns {Promise<Object>} - { success, data, count }
 */
export const getMyCoupons = async () => {
  try {
    const response = await get_withauth('/coupons/my-coupons');
    return response;
  } catch (error) {
    console.error('Error obteniendo cupones:', error);
    throw error;
  }
};

/**
 * Format Utilities
 * Funciones de formato reutilizables
 */

/**
 * Formatea un número como moneda argentina
 * @param amount Cantidad a formatear
 * @returns String formateado (ej: "$15.000,00")
 */
export const formatCurrency = (amount: number): string => {
  if (isNaN(amount)) return '$0,00';
  
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Formatea una fecha
 * @param date Fecha a formatear
 * @param format Tipo de formato: 'short' | 'long' | 'time'
 * @returns String formateado
 */
export const formatDate = (
  date: string | Date, 
  format: 'short' | 'long' | 'time' | 'datetime' = 'short'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '-';

  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString('es-AR');
    case 'long':
      return dateObj.toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'time':
      return dateObj.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'datetime':
      return dateObj.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    default:
      return dateObj.toLocaleDateString('es-AR');
  }
};

/**
 * Formatea un número con separadores de miles
 * @param number Número a formatear
 * @returns String formateado (ej: "15.000")
 */
export const formatNumber = (number: number): string => {
  if (isNaN(number)) return '0';
  
  return new Intl.NumberFormat('es-AR').format(number);
};

/**
 * Formatea un porcentaje
 * @param value Valor decimal (ej: 0.15 para 15%)
 * @param decimals Cantidad de decimales
 * @returns String formateado (ej: "15,00%")
 */
export const formatPercentage = (value: number, decimals: number = 2): string => {
  if (isNaN(value)) return '0%';
  
  return new Intl.NumberFormat('es-AR', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

/**
 * Trunca un texto si excede el largo máximo
 * @param text Texto a truncar
 * @param maxLength Largo máximo
 * @param suffix Sufijo para indicar truncamiento
 * @returns Texto truncado
 */
export const truncateText = (
  text: string, 
  maxLength: number, 
  suffix: string = '...'
): string => {
  if (!text || text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Capitaliza la primera letra de cada palabra
 * @param text Texto a capitalizar
 * @returns Texto capitalizado
 */
export const capitalize = (text: string): string => {
  if (!text) return '';
  
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Limpia un string de caracteres especiales
 * @param text Texto a limpiar
 * @returns Texto limpio
 */
export const sanitizeString = (text: string): string => {
  if (!text) return '';
  
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
};

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Valida que un número esté en un rango
 * @param value Valor a validar
 * @param min Valor mínimo
 * @param max Valor máximo
 * @returns Boolean
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return !isNaN(value) && value >= min && value <= max;
};

/**
 * Valida que un número sea positivo
 * @param value Valor a validar
 * @returns Boolean
 */
export const isPositiveNumber = (value: number | string): boolean => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num > 0;
};

/**
 * Valida que un número sea entero positivo
 * @param value Valor a validar
 * @returns Boolean
 */
export const isPositiveInteger = (value: number | string): boolean => {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  return !isNaN(num) && num > 0 && Number.isInteger(num);
};

/**
 * Valida y normaliza un precio
 * @param value Valor a validar
 * @param min Precio mínimo (default 0)
 * @param max Precio máximo (opcional)
 * @returns Número validado o null si es inválido
 */
export const validatePrice = (value: number | string, min: number = 0, max?: number): number | null => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num) || num < min) return null;
  if (max !== undefined && num > max) return null;
  
  return Math.round(num * 100) / 100; // Redondear a 2 decimales
};

/**
 * Valida y normaliza una cantidad
 * @param value Valor a validar
 * @param min Cantidad mínima (default 0)
 * @param max Cantidad máxima (opcional)
 * @returns Número validado o null si es inválido
 */
export const validateQuantity = (value: number | string, min: number = 0, max?: number): number | null => {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (isNaN(num) || num < min) return null;
  if (max !== undefined && num > max) return null;
  if (!Number.isInteger(num)) return null;
  
  return num;
};

/**
 * Valida un email
 * @param email Email a validar
 * @returns Boolean
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || email.trim().length === 0) return true; // Email opcional es válido
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Valida un teléfono (Argentina)
 * @param phone Teléfono a validar
 * @returns Boolean
 */
export const isValidPhone = (phone: string): boolean => {
  if (!phone || phone.trim().length === 0) return false;
  
  // Formato: 11-1234-5678 o 1112345678
  const phoneRegex = /^(\d{2}[-.]?\d{4}[-.]?\d{4}|\d{10})$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Valida que un string no esté vacío
 * @param value String a validar
 * @param minLength Largo mínimo
 * @returns Boolean
 */
export const isRequiredString = (value: string, minLength: number = 1): boolean => {
  if (!value) return false;
  return value.trim().length >= minLength;
};

/**
 * Valida una fecha
 * @param date Fecha a validar
 * @param allowPast Permitir fechas pasadas (default true)
 * @returns Boolean
 */
export const isValidDate = (date: string | Date, allowPast: boolean = true): boolean => {
  if (!date) return false;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return false;
  if (!allowPast && dateObj < new Date()) return false;
  
  return true;
};

/**
 * Clamp un número entre un mínimo y máximo
 * @param value Valor a clamear
 * @param min Mínimo
 * @param max Máximo
 * @returns Número clameado
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

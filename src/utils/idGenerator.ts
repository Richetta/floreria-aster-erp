/**
 * ID Generator Utility
 * Genera IDs únicos usando UUID v4
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Genera un ID único para entidades del sistema
 * @returns UUID string
 */
export const generateId = (): string => {
  return uuidv4();
};

/**
 * Genera un ID con prefijo para entidades específicas
 * @param prefix Prefijo para el ID (ej: 'p', 'c', 'o')
 * @returns ID con formato: prefix-uuid
 */
export const generateIdWithPrefix = (prefix: string): string => {
  return `${prefix}-${uuidv4()}`;
};

/**
 * Genera un código de producto único
 * @returns Código con formato: P-XXXXX
 */
export const generateProductCode = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `P-${timestamp}`;
};

/**
 * Genera un código de barras EAN-13 válido
 * @param prefix Prefijo de 2-3 dígitos
 * @returns Código EAN-13 válido
 */
export const generateEAN13 = (prefix: string = '779'): string => {
  // Generar 9 dígitos aleatorios
  let code = prefix;
  while (code.length < 12) {
    code += Math.floor(Math.random() * 10);
  }

  // Calcular dígito verificador
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return code + checkDigit;
};

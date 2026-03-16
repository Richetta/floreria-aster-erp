/**
 * Debounce Hook
 * Retrasa la ejecución de una función hasta que haya pasado un tiempo sin ser llamada
 */

import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Hook para debouncear un valor
 * @param value Valor a debouncear
 * @param delay Milisegundos de delay (default: 300)
 * @returns Valor debounceado
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para debouncear una función
 * @param fn Función a debouncear
 * @param delay Milisegundos de delay (default: 300)
 * @returns Función debounceada
 */
export function useDebounceCallback<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounceCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        fn(...args);
      }, delay);
    },
    [fn, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debounceCallback as T;
}

/**
 * Función utilitaria para debounce (no React)
 * @param fn Función a debouncear
 * @param delay Milisegundos de delay
 * @returns Función debounceada
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as T & { cancel: () => void };
}

/**
 * Función utilitaria para throttle (ejecuta máximo una vez cada X ms)
 * @param fn Función a throttear
 * @param limit Milisegundos de límite
 * @returns Función throttleada
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number = 300
): T {
  let inThrottle = false;

  const throttled = (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };

  return throttled as T;
}

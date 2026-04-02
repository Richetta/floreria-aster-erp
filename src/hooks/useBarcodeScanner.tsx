import { useEffect, useRef } from 'react';

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  isActive?: boolean;
}

export const useBarcodeScanner = ({ onScan, isActive = true }: UseBarcodeScannerProps) => {
  const buffer = useRef('');
  const lastKeyTime = useRef(0);
  // Un lector normalmente pone entre 10ms y 30ms entre cada tecla emulada.
  // 50ms es un umbral seguro para diferenciar un humano (siempre > 80ms) de la maquina
  const SCAN_DELAY_THRESHOLD = 50; 

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar eventos si el objetivo es un input de texto, textarea donde el 
      // usuario podría querer realmente que el escáner "escriba" como teclado regular,
      // O si queremos permitir escanear aún si está enfocado en un input, podemos remover esto.
      // Por consistencia en ERPs: si escaneas mientras estás enfocado en la barra de búsqueda general 
      // de productos, a veces "quieres" el hook. 
      // Si el elemento activo es un input del DOM, lo dejaremos pasar solo si es de tipo "text", "search".
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const activeType = (document.activeElement as HTMLInputElement)?.type?.toLowerCase();
      
      const isInputFocused = activeTag === 'input' && ['text', 'search', 'number'].includes(activeType);
      
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;

      if (e.key === 'Enter') {
        // Ejecutar el escaneo solo si hay data y vino suficientemente rápido
        if (buffer.current.length > 3) { // Asumimos un código de barras de más de 3 letras/números
          onScan(buffer.current);
          buffer.current = ''; // Limpiar
          
          // Si estaba en un input y decidimos atrapar el enter:
          if (isInputFocused) {
            e.preventDefault();
          }
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Es un caracter imprimible
        if (timeDiff > SCAN_DELAY_THRESHOLD && timeDiff < 1000) {
          // Fue tipeado por humano porque tomó más tiempo que el threshold
          // Reset buffer
          buffer.current = e.key;
        } else {
          // Viene volando, acumular
          buffer.current += e.key;
        }
      } else {
         // Otras teclas como Shift, Backspace, limpiar si el tiempo pasó.
         if (timeDiff > SCAN_DELAY_THRESHOLD) {
             buffer.current = '';
         }
      }

      lastKeyTime.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, isActive]);
};

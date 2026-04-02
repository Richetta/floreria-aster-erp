import { useEffect, useRef, useState, useCallback } from 'react';

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  isActive?: boolean;
}

export const useBarcodeScanner = ({ onScan, isActive = true }: UseBarcodeScannerProps) => {
  const buffer = useRef('');
  const lastKeyTime = useRef(0);
  const scanStartTime = useRef(0);
  const isScanningRef = useRef(false);
  // Un lector normalmente pone entre 10ms y 30ms entre cada tecla emulada.
  // 50ms es un umbral seguro para diferenciar un humano (siempre > 80ms) de la maquina
  const SCAN_DELAY_THRESHOLD = 50;
  const MAX_SCAN_TIME = 2000; // Tiempo máximo para un escaneo completo (2 segundos)

  // Estado para indicar visualmente si está escuchando un escaneo
  const [isScanning, setIsScanning] = useState(false);

  // Validación de formato de código de barras
  const isValidBarcode = useCallback((code: string): boolean => {
    // EAN-13: 13 dígitos
    if (/^\d{13}$/.test(code)) return true;
    // EAN-8: 8 dígitos
    if (/^\d{8}$/.test(code)) return true;
    // UPC-A: 12 dígitos
    if (/^\d{12}$/.test(code)) return true;
    // CODE128/CODE39: cualquier combinación de 4+ caracteres alfanuméricos
    if (/^[a-zA-Z0-9]{4,}$/.test(code)) return true;
    return false;
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const activeType = (document.activeElement as HTMLInputElement)?.type?.toLowerCase();
      const isInputFocused = activeTag === 'input' && ['text', 'search', 'number'].includes(activeType);

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;

      // Detectar inicio de escaneo
      if (e.key.length === 1 && timeDiff < SCAN_DELAY_THRESHOLD && buffer.current.length === 0) {
        scanStartTime.current = currentTime;
        isScanningRef.current = true;
        setIsScanning(true);
      }

      if (e.key === 'Enter') {
        // Ejecutar el escaneo solo si hay data y vino suficientemente rápido
        const scanDuration = currentTime - scanStartTime.current;
        if (buffer.current.length >= 4 && (timeDiff < SCAN_DELAY_THRESHOLD || scanDuration < MAX_SCAN_TIME)) {
          const scannedCode = buffer.current;
          buffer.current = '';
          isScanningRef.current = false;
          setIsScanning(false);

          // Solo procesar si es un código válido
          if (isValidBarcode(scannedCode)) {
            onScan(scannedCode);
          } else {
            console.warn('[BarcodeScanner] Código inválido detectado:', scannedCode);
          }

          // Si estaba en un input y decidimos atrapar el enter:
          if (isInputFocused) {
            e.preventDefault();
          }
        } else if (buffer.current.length > 0) {
          // Limpiar buffer si no es válido
          buffer.current = '';
          isScanningRef.current = false;
          setIsScanning(false);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Es un caracter imprimible
        if (timeDiff > SCAN_DELAY_THRESHOLD && timeDiff < 1000) {
          // Fue tipeado por humano porque tomó más tiempo que el threshold
          // Reset buffer - pero solo si no estamos en medio de un escaneo
          if (!isScanningRef.current) {
            buffer.current = e.key;
          }
        } else if (timeDiff < SCAN_DELAY_THRESHOLD) {
          // Viene volando (escáner), acumular
          buffer.current += e.key;
        }
      } else {
        // Otras teclas como Shift, Backspace, Tab, etc. - limpiar buffer SIEMPRE
        buffer.current = '';
        isScanningRef.current = false;
        setIsScanning(false);
      }

      lastKeyTime.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, isActive, isValidBarcode]);

  // Exponer estado de escaneo para la UI
  return { isScanning };
};

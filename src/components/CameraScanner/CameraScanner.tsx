import React, { useState, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { X } from 'lucide-react';
import './CameraScanner.css';

interface CameraScannerProps {
    onScan: (code: string) => void;
    onClose: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScan, onClose }) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="camera-scanner-overlay">
            <div className="camera-scanner-container">
                <div className="camera-scanner-header">
                    <h3 className="text-body font-bold">Escanear Código</h3>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>
                
                <div className="camera-scanner-view barcode-format">
                    {!hasError ? (
                        <>
                            <Scanner
                                onScan={(results) => {
                                    if (results && results.length > 0) {
                                        onScan(results[0].rawValue);
                                    }
                                }}
                                onError={(error) => {
                                    console.error('Camera scanner error:', error);
                                    setHasError(true);
                                }}
                                components={{
                                    onOff: true,
                                    torch: true,
                                    zoom: true,
                                    finder: false, // Usamos un finder personalizado de CSS para que sea "alargado" 
                                }}
                                styles={{
                                    container: { width: '100%', height: '100%' }
                                }}
                            />
                            {/* Visor personalizado alargado para códigos de barra */}
                            <div className="barcode-finder">
                                <div className="barcode-scan-line"></div>
                            </div>
                        </>
                    ) : (
                        <div className="camera-scanner-error">
                            <p>No se pudo acceder a la cámara o el navegador no es compatible.</p>
                            <button className="btn btn-primary mt-4" onClick={onClose}>
                                Cerrar
                            </button>
                        </div>
                    )}
                </div>
                <div className="camera-scanner-footer">
                    <p className="text-small text-muted">Apunta la cámara hacia un código de barras o código QR de producto.</p>
                </div>
            </div>
        </div>
    );
};

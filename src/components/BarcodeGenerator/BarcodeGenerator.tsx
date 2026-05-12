import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import './BarcodeGenerator.css';

interface BarcodeGeneratorProps {
    value: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    format?: 'EAN13' | 'CODE128' | 'CODE39';
    className?: string;
    style?: React.CSSProperties;
    margin?: number;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
    value,
    width = 2,
    height = 100,
    displayValue = true,
    format = 'CODE128',
    className = '',
    style,
    margin = 2,
}) => {
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (imgRef.current && value) {
            try {
                JsBarcode(imgRef.current, value, {
                    format,
                    width,
                    height,
                    displayValue,
                    margin,
                    fontOptions: 'bold',
                    font: 'monospace',
                    textAlign: 'center',
                    textPosition: 'bottom',
                    textMargin: 2,
                    fontSize: 14,
                    background: '#ffffff',
                    lineColor: '#000000'
                });
            } catch (error) {
                console.error('Error generating barcode:', error);
            }
        }
    }, [value, width, height, displayValue, format, margin]);

    return (
        <div className={`barcode-container ${className}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
            <img ref={imgRef} alt={`Barcode ${value}`} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', ...style }} />
        </div>
    );
};

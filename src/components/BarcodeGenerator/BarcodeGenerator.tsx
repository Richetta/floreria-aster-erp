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
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
    value,
    width = 2,
    height = 100,
    displayValue = true,
    format = 'CODE128',
    className = ''
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current && value) {
            try {
                JsBarcode(canvasRef.current, value, {
                    format,
                    width,
                    height,
                    displayValue,
                    margin: 10,
                    fontOptions: 'bold',
                    font: 'monospace',
                    textAlign: 'center',
                    textPosition: 'bottom',
                    textMargin: 2,
                    fontSize: 16,
                    background: '#ffffff',
                    lineColor: '#000000'
                });
            } catch (error) {
                console.error('Error generating barcode:', error);
            }
        }
    }, [value, width, height, displayValue, format]);

    return (
        <div className={`barcode-container ${className}`}>
            <canvas ref={canvasRef} />
        </div>
    );
};

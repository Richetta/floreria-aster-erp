import React from 'react';
import { LabelLayoutConfig } from './LabelLayoutConfig';
import { BarcodeGenerator } from '../BarcodeGenerator/BarcodeGenerator';

interface PrintableLabelProps {
    product: {
        name: string;
        code: string;
        price: number;
    };
    barcodeValue: string;
    layout: LabelLayoutConfig;
}

export const PrintableLabel: React.FC<PrintableLabelProps> = ({ product, barcodeValue, layout }) => {
    return (
        <div style={{
            position: 'relative',
            width: `${layout.width}mm`,
            height: `${layout.height}mm`,
            background: 'white',
            overflow: 'hidden',
            border: '1px dashed #ccc', // Keep for preview boundaries
            pageBreakInside: 'avoid'
        }}>
            {layout.name.visible && (
                <div style={{
                    position: 'absolute',
                    left: `${layout.name.x}px`,
                    top: `${layout.name.y}px`,
                    width: `${layout.name.w}px`,
                    height: `${layout.name.h}px`,
                    fontSize: `${layout.name.fontSize || 14}px`,
                    fontWeight: layout.name.fontWeight || 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    overflow: 'hidden',
                    lineHeight: 1.1
                }}>
                    {product.name}
                </div>
            )}

            {layout.barcode.visible && (
                <div style={{
                    position: 'absolute',
                    left: `${layout.barcode.x}px`,
                    top: `${layout.barcode.y}px`,
                    width: `${layout.barcode.w}px`,
                    height: `${layout.barcode.h}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <BarcodeGenerator value={barcodeValue} displayValue={false} height={layout.barcode.h * 0.8} width={1.5} />
                </div>
            )}

            {layout.code.visible && (
                <div style={{
                    position: 'absolute',
                    left: `${layout.code.x}px`,
                    top: `${layout.code.y}px`,
                    width: `${layout.code.w}px`,
                    height: `${layout.code.h}px`,
                    fontSize: `${layout.code.fontSize || 10}px`,
                    fontWeight: layout.code.fontWeight || 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace'
                }}>
                    {barcodeValue}
                </div>
            )}

            {layout.price.visible && (
                <div style={{
                    position: 'absolute',
                    left: `${layout.price.x}px`,
                    top: `${layout.price.y}px`,
                    width: `${layout.price.w}px`,
                    height: `${layout.price.h}px`,
                    fontSize: `${layout.price.fontSize || 16}px`,
                    fontWeight: layout.price.fontWeight || 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    ${product.price.toLocaleString()}
                </div>
            )}
        </div>
    );
};

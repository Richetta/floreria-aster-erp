import React from 'react';
import type { LabelLayoutConfig } from './LabelLayoutConfig';
import { BarcodeGenerator } from '../BarcodeGenerator/BarcodeGenerator';

interface PrintableLabelProps {
    product: {
        name: string;
        code: string;
        price: number;
    };
    barcodeValue: string;
    layout: LabelLayoutConfig;
    /** If true, border is hidden (for actual print). Default shows dashed border for preview. */
    hideBorder?: boolean;
}

/**
 * Renders a label using percentage-based coordinates so the layout is pixel-perfect
 * for both the on-screen preview AND the printed output.
 * The container dimensions MUST be set by the parent (in mm for print, or px for preview).
 */
export const PrintableLabel: React.FC<PrintableLabelProps> = ({ product, barcodeValue, layout, hideBorder }) => {
    return (
        <div style={{
            position: 'relative',
            width: `${layout.width}mm`,
            height: `${layout.height}mm`,
            background: 'white',
            overflow: 'hidden',
            border: hideBorder ? 'none' : '0.2mm solid #ddd',
            boxSizing: 'border-box',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
        }}>
            {layout.name.visible && (
                <div style={{
                    position: 'absolute',
                    left: `${layout.name.x}%`,
                    top: `${layout.name.y}%`,
                    width: `${layout.name.w}%`,
                    height: `${layout.name.h}%`,
                    fontSize: `${layout.name.fontSize || 7}pt`,
                    fontWeight: layout.name.fontWeight || 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center' as const,
                    overflow: 'hidden',
                    lineHeight: 1.1,
                    boxSizing: 'border-box',
                }}>
                    {product.name}
                </div>
            )}

            {layout.barcode.visible && (
                <div style={{
                    position: 'absolute',
                    left: `${layout.barcode.x}%`,
                    top: `${layout.barcode.y}%`,
                    width: `${layout.barcode.w}%`,
                    height: `${layout.barcode.h}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                }}>
                    <BarcodeGenerator
                        value={barcodeValue}
                        displayValue={false}
                        height={30}
                        width={1.2}
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                    />
                </div>
            )}

            {layout.code.visible && (
                <div style={{
                    position: 'absolute',
                    left: `${layout.code.x}%`,
                    top: `${layout.code.y}%`,
                    width: `${layout.code.w}%`,
                    height: `${layout.code.h}%`,
                    fontSize: `${layout.code.fontSize || 6}pt`,
                    fontWeight: layout.code.fontWeight || 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    letterSpacing: '0.02em',
                    boxSizing: 'border-box',
                }}>
                    {barcodeValue}
                </div>
            )}

            {layout.price.visible && (
                <div style={{
                    position: 'absolute',
                    left: `${layout.price.x}%`,
                    top: `${layout.price.y}%`,
                    width: `${layout.price.w}%`,
                    height: `${layout.price.h}%`,
                    fontSize: `${layout.price.fontSize || 7}pt`,
                    fontWeight: layout.price.fontWeight || 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                }}>
                    ${product.price.toLocaleString()}
                </div>
            )}
        </div>
    );
};

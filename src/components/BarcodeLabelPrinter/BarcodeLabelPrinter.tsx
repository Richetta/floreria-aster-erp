import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Printer, X, Edit3, Check, X as XIcon, Settings, Minus, Plus } from 'lucide-react';
import { LabelEditor } from '../LabelEditor/LabelEditor';
import { PrintableLabel } from '../LabelEditor/PrintableLabel';
import { getSavedLabelLayout } from '../LabelEditor/LabelLayoutConfig';
import type { LabelLayoutConfig } from '../LabelEditor/LabelLayoutConfig';
import './BarcodeLabelPrinter.css';

interface Product {
    id: string;
    code: string;
    name: string;
    price: number;
    cost?: number;
}

interface BarcodeLabelPrinterProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
    initialQuantity?: number;
}

export const BarcodeLabelPrinter: React.FC<BarcodeLabelPrinterProps> = ({
    product,
    isOpen,
    onClose,
    initialQuantity = 1
}) => {
    const [barcodeCode, setBarcodeCode] = useState(product?.code || '');
    const [isEditing, setIsEditing] = useState(false);
    const [tempCode, setTempCode] = useState('');
    const [isDesigning, setIsDesigning] = useState(false);
    const [layout, setLayout] = useState<LabelLayoutConfig>(getSavedLabelLayout());
    const [quantity, setQuantity] = useState(initialQuantity);
    const printRootRef = useRef<ReturnType<typeof createRoot> | null>(null);

    useEffect(() => {
        if (product) {
            setBarcodeCode(product.code);
            setTempCode(product.code);
            setIsEditing(false);
            setLayout(getSavedLabelLayout());
        }
    }, [product]);

    const handlePrint = useCallback(() => {
        if (!product) return;
        
        let portal = document.getElementById('barcode-print-portal') as HTMLDivElement | null;
        if (!portal) {
            portal = document.createElement('div');
            portal.id = 'barcode-print-portal';
            portal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; background:white; z-index:99999;';
            document.body.appendChild(portal);
        }

        const labels = Array.from({ length: quantity }, (_, i) => (
            <div key={i} style={{ display: 'inline-block', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <PrintableLabel
                    product={product}
                    barcodeValue={barcodeCode}
                    layout={layout}
                    hideBorder={true}
                />
            </div>
        ));

        const content = (
            <div style={{ padding: '5mm', background: 'white', display: 'flex', flexWrap: 'wrap', gap: '2mm' }}>
                {labels}
            </div>
        );

        if (printRootRef.current) {
            printRootRef.current.unmount();
        }
        const root = createRoot(portal);
        printRootRef.current = root;
        root.render(content);

        portal.style.display = 'block';
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                portal!.style.display = 'none';
                if (printRootRef.current) {
                    printRootRef.current.unmount();
                    printRootRef.current = null;
                }
                onClose();
            }, 500);
        }, 300);
    }, [product, barcodeCode, layout, quantity, onClose]);

    const handleSaveCode = () => {
        if (tempCode.trim()) {
            setBarcodeCode(tempCode.trim());
            setIsEditing(false);
        }
    };

    const handleSaveDesign = (newLayout: LabelLayoutConfig) => {
        setLayout(newLayout);
        setIsDesigning(false);
    };

    if (!isOpen || !product) return null;

    if (isDesigning) {
        return (
            <div className="barcode-label-printer-overlay">
                <div className="barcode-label-printer-modal" style={{ maxWidth: '860px', width: '96vw' }}>
                    <LabelEditor
                        product={{ name: product.name, code: barcodeCode, price: product.price }}
                        labelWidth={layout.width}
                        labelHeight={layout.height}
                        onSave={handleSaveDesign}
                        onCancel={() => setIsDesigning(false)}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="barcode-label-printer-overlay">
            <div className="barcode-label-printer-modal">
                {/* Header */}
                <div className="barcode-label-printer-header">
                    <div className="header-left">
                        <h3 className="barcode-title">
                            <Printer size={20} className="barcode-title-icon" />
                            Imprimir Etiquetas
                        </h3>
                        <p className="barcode-subtitle">Producto: <strong>{product.name}</strong></p>
                    </div>
                    <button className="barcode-close-btn" onClick={onClose} title="Cerrar">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="barcode-label-printer-body">
                    {/* Controls row */}
                    <div className="blp-controls-row">
                        <button className="barcode-edit-btn design-btn" onClick={() => setIsDesigning(true)}>
                            <Settings size={15} />
                            Personalizar diseño
                        </button>

                        {!isEditing ? (
                            <button className="barcode-edit-btn" onClick={() => { setTempCode(barcodeCode); setIsEditing(true); }}>
                                <Edit3 size={15} />
                                Editar código
                            </button>
                        ) : (
                            <div className="edit-input-group">
                                <input
                                    type="text"
                                    className="barcode-code-input"
                                    value={tempCode}
                                    onChange={e => setTempCode(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveCode(); if (e.key === 'Escape') setIsEditing(false); }}
                                    placeholder="Código de barras"
                                    autoFocus
                                />
                                <button className="barcode-save-btn" onClick={handleSaveCode} disabled={!tempCode.trim()}>
                                    <Check size={15} /> Guardar
                                </button>
                                <button className="barcode-cancel-edit-btn" onClick={() => setIsEditing(false)}>
                                    <XIcon size={15} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    <div className="blp-preview-area">
                        <div className="blp-preview-label">
                            Vista previa — {layout.width}×{layout.height}mm
                        </div>
                        <div className="blp-preview-canvas">
                            <PrintableLabel product={product} barcodeValue={barcodeCode} layout={layout} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="barcode-label-printer-actions">
                    <div className="quantity-selector">
                        <label className="form-label">Cantidad:</label>
                        <button className="qty-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))}>
                            <Minus size={14} />
                        </button>
                        <input
                            type="number"
                            min="1"
                            max="500"
                            value={quantity}
                            onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="form-input quantity-input"
                        />
                        <button className="qty-btn" onClick={() => setQuantity(q => q + 1)}>
                            <Plus size={14} />
                        </button>
                    </div>
                    <button className="barcode-cancel-btn" onClick={onClose}>Cancelar</button>
                    <button className="barcode-print-btn" onClick={handlePrint}>
                        <Printer size={17} />
                        Imprimir {quantity} {quantity === 1 ? 'etiqueta' : 'etiquetas'}
                    </button>
                </div>
            </div>
        </div>
    );
};

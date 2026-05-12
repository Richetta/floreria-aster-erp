import React, { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, Edit3, Check, X as XIcon, Settings } from 'lucide-react';
import { LabelEditor } from '../LabelEditor/LabelEditor';
import { PrintableLabel } from '../LabelEditor/PrintableLabel';
import { getSavedLabelLayout, LabelLayoutConfig } from '../LabelEditor/LabelLayoutConfig';
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
    quantity?: number;
}

export const BarcodeLabelPrinter: React.FC<BarcodeLabelPrinterProps> = ({
    product,
    isOpen,
    onClose,
    quantity = 1
}) => {
    const componentRef = useRef<HTMLDivElement>(null);
    const [barcodeCode, setBarcodeCode] = useState(product?.code || '');
    const [isEditing, setIsEditing] = useState(false);
    const [tempCode, setTempCode] = useState('');
    const [isDesigning, setIsDesigning] = useState(false);
    const [layout, setLayout] = useState<LabelLayoutConfig>(getSavedLabelLayout());

    // Reset state when product changes
    useEffect(() => {
        if (product) {
            setBarcodeCode(product.code);
            setTempCode(product.code);
            setIsEditing(false);
        }
    }, [product]);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Etiquetas-${barcodeCode}`,
        onAfterPrint: onClose,
    });

    const handleStartEdit = () => {
        setTempCode(barcodeCode);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setTempCode(barcodeCode);
        setIsEditing(false);
    };

    const handleSaveEdit = () => {
        if (tempCode.trim()) {
            setBarcodeCode(tempCode.trim());
            setIsEditing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    const handleSaveDesign = () => {
        setLayout(getSavedLabelLayout());
        setIsDesigning(false);
    };

    if (!isOpen || !product) return null;

    if (isDesigning) {
        return (
            <div className="barcode-label-printer-overlay">
                <div className="barcode-label-printer-modal" style={{ maxWidth: '900px' }}>
                    <LabelEditor 
                        product={{ name: product.name, code: barcodeCode, price: product.price }} 
                        onSave={handleSaveDesign} 
                        onCancel={() => setIsDesigning(false)} 
                    />
                </div>
            </div>
        );
    }

    // Generate multiple labels
    const labels = Array.from({ length: quantity }, (_, i) => i);

    return (
        <div className="barcode-label-printer-overlay">
            <div className="barcode-label-printer-modal">
                <div className="barcode-label-printer-header">
                    <div className="header-left">
                        <h3 className="barcode-title">
                            <Printer size={20} className="barcode-title-icon" />
                            Imprimir Etiquetas
                        </h3>
                        <p className="barcode-subtitle">Código: <strong>{barcodeCode}</strong></p>
                    </div>
                    <button className="barcode-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="barcode-label-printer-body">
                    {/* Edit Controls */}
                    <div className="barcode-edit-section">
                        <div className="edit-controls" style={{ justifyContent: 'space-between' }}>
                            <button className="barcode-edit-btn" onClick={() => setIsDesigning(true)} style={{ color: '#4b5563', borderColor: '#d1d5db' }}>
                                <Settings size={16} />
                                <span>Diseño</span>
                            </button>
                            
                            {!isEditing ? (
                                <button className="barcode-edit-btn" onClick={handleStartEdit}>
                                    <Edit3 size={16} />
                                    <span>Editar Código</span>
                                </button>
                            ) : (
                                <div className="edit-input-group">
                                    <input
                                        type="text"
                                        className="barcode-code-input"
                                        value={tempCode}
                                        onChange={(e) => setTempCode(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Nuevo código de barras"
                                        autoFocus
                                    />
                                    <button className="barcode-save-btn" onClick={handleSaveEdit} disabled={!tempCode.trim()}>
                                        <Check size={16} />
                                        <span>Guardar</span>
                                    </button>
                                    <button className="barcode-cancel-edit-btn" onClick={handleCancelEdit}>
                                        <XIcon size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview */}
                    <div ref={componentRef} className="labels-preview">
                        {labels.map((_, index) => (
                            <div key={index} className="barcode-label-wrapper" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                                <PrintableLabel product={product} barcodeValue={barcodeCode} layout={layout} />
                            </div>
                        ))}
                    </div>

                    {/* Print Button */}
                    <div className="barcode-label-printer-actions">
                        <div className="quantity-selector">
                            <label className="form-label">Cantidad:</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={quantity}
                                readOnly
                                className="form-input quantity-input"
                            />
                        </div>
                        <button className="barcode-cancel-btn" onClick={onClose}>
                            Cancelar
                        </button>
                        <button className="barcode-print-btn" onClick={handlePrint}>
                            <Printer size={18} />
                            <span>Imprimir {quantity} {quantity === 1 ? 'Etiqueta' : 'Etiquetas'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

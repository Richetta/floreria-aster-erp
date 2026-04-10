import React, { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, Edit3, Check, X as XIcon } from 'lucide-react';
import { BarcodeGenerator } from '../BarcodeGenerator/BarcodeGenerator';
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

    if (!isOpen || !product) return null;

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
                        <div className="edit-controls">
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
                            <div key={index} className="barcode-label">
                                <div className="label-header">
                                    <h4 className="label-product-name">{product.name}</h4>
                                </div>

                                <div className="label-barcode">
                                    <BarcodeGenerator
                                        value={barcodeCode}
                                        width={2}
                                        height={60}
                                        format="CODE128"
                                    />
                                </div>

                                <div className="label-code">
                                    <span className="label-code-label">Código:</span>
                                    <span className="label-code-value">{barcodeCode}</span>
                                </div>

                                <div className="label-footer">
                                    <div className="label-price">
                                        <span className="label-price-label">Precio:</span>
                                        <span className="label-price-value">${product.price.toLocaleString()}</span>
                                    </div>
                                    {product.cost && (
                                        <div className="label-cost">
                                            <span className="label-cost-label">Costo:</span>
                                            <span className="label-cost-value">${product.cost.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
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

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X } from 'lucide-react';
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

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Etiquetas-${product?.code}`,
        onAfterPrint: onClose,
    });

    if (!isOpen || !product) return null;

    // Generate multiple labels
    const labels = Array.from({ length: quantity }, (_, i) => i);

    return (
        <div className="barcode-label-printer-overlay">
            <div className="barcode-label-printer-modal">
                <div className="barcode-label-printer-header">
                    <h3 className="text-h3 flex items-center gap-2">
                        <Printer size={20} />
                        Imprimir Etiquetas de Código de Barras
                    </h3>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="barcode-label-printer-body">
                    {/* Preview */}
                    <div ref={componentRef} className="labels-preview">
                        {labels.map((_, index) => (
                            <div key={index} className="barcode-label">
                                <div className="label-header">
                                    <h4 className="label-product-name">{product.name}</h4>
                                </div>
                                
                                <div className="label-barcode">
                                    <BarcodeGenerator
                                        value={product.code}
                                        width={2}
                                        height={60}
                                        format="CODE128"
                                    />
                                </div>

                                <div className="label-code">
                                    <span className="label-code-label">Código:</span>
                                    <span className="label-code-value">{product.code}</span>
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
                                className="form-input"
                                style={{ width: '80px' }}
                            />
                        </div>
                        <button className="btn btn-secondary" onClick={onClose}>
                            Cancelar
                        </button>
                        <button className="btn btn-primary" onClick={handlePrint}>
                            <Printer size={18} />
                            Imprimir {quantity} {quantity === 1 ? 'Etiqueta' : 'Etiquetas'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

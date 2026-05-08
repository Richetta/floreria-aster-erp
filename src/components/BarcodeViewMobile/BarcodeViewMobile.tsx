import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, Share } from 'lucide-react';
import { BarcodeGenerator } from '../BarcodeGenerator/BarcodeGenerator';
import './BarcodeViewMobile.css';

interface Product {
    id: string;
    code: string;
    name: string;
    price: number;
}

interface BarcodeViewMobileProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
}

export const BarcodeViewMobile: React.FC<BarcodeViewMobileProps> = ({
    product,
    isOpen,
    onClose
}) => {
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Barcode-${product?.code || 'product'}`,
    });

    if (!isOpen || !product) return null;

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Código de Barras: ${product.name}`,
                    text: `Código: ${product.code} - Precio: $${product.price}`,
                    url: window.location.href
                });
            } catch (err) {
                console.log('Error sharing:', err);
            }
        }
    };

    return (
        <div className="barcode-view-mobile-overlay">
            <div className="barcode-view-mobile-sheet">
                <div className="barcode-view-header">
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                    <h3>Código de Barras</h3>
                    <div className="header-actions">
                        <button className="action-icon-btn" onClick={handleShare}>
                            <Share size={22} />
                        </button>
                    </div>
                </div>

                <div className="barcode-view-content">
                    <div className="product-brief">
                        <h4 className="product-name">{product.name}</h4>
                        <p className="product-code">SKU: {product.code}</p>
                        <p className="product-price">${product.price.toLocaleString('es-AR')}</p>
                    </div>

                    <div className="barcode-display-card">
                        <div ref={componentRef} className="printable-barcode">
                            <div className="print-only-header">
                                <h3>{product.name}</h3>
                                <p>${product.price.toLocaleString('es-AR')}</p>
                            </div>
                            <BarcodeGenerator 
                                value={product.code} 
                                width={2.5}
                                height={120}
                                displayValue={true}
                            />
                        </div>
                    </div>

                    <p className="barcode-hint">
                        Escanea este código en el mostrador o usa el botón de imprimir para generar etiquetas.
                    </p>
                </div>

                <div className="barcode-view-footer">
                    <button className="print-btn-mobile" onClick={handlePrint}>
                        <Printer size={20} />
                        <span>Imprimir Etiqueta</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

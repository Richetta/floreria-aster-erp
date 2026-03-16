import React, { useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X } from 'lucide-react';
import './TicketPrinter.css';

export type TicketData = {
    type: 'sale' | 'order';
    id: string;
    date: string;
    customerName?: string;
    customerPhone?: string;
    items: {
        name: string;
        quantity: number;
        unitPrice: number;
        total: number;
    }[];
    subtotal: number;
    discount?: number;
    total: number;
    paymentMethod?: string;
    advancePayment?: number;
    notes?: string;
};

interface TicketPrinterProps {
    ticketData: TicketData | null;
    isOpen: boolean;
    onClose: () => void;
    shopName?: string;
    shopPhone?: string;
    shopAddress?: string;
    shopCUIT?: string;
}

export const TicketPrinter: React.FC<TicketPrinterProps> = ({
    ticketData,
    isOpen,
    onClose,
    shopName = 'Florería Aster',
    shopPhone = '',
    shopAddress = '',
    shopCUIT = ''
}) => {
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Ticket-${ticketData?.id}`,
        onAfterPrint: onClose,
    });

    useEffect(() => {
        if (isOpen && ticketData) {
            // Auto-print after a short delay
            const timer = setTimeout(() => {
                handlePrint();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen, ticketData, handlePrint]);

    if (!isOpen || !ticketData) return null;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount: number) => {
        return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    };

    return (
        <div className="ticket-printer-overlay">
            <div className="ticket-printer-modal">
                <div className="ticket-printer-header">
                    <h3 className="text-h3 flex items-center gap-2">
                        <Printer size={20} />
                        Vista Previa del Ticket
                    </h3>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ticket-printer-body">
                    {/* Ticket Preview */}
                    <div ref={componentRef} className="ticket-preview">
                        {/* Header */}
                        <div className="ticket-header">
                            <h1 className="ticket-shop-name">{shopName}</h1>
                            {shopCUIT && <p className="ticket-shop-cuit">CUIT: {shopCUIT}</p>}
                            {shopAddress && <p className="ticket-shop-address">{shopAddress}</p>}
                            {shopPhone && <p className="ticket-shop-phone">Tel: {shopPhone}</p>}
                            <div className="ticket-divider"></div>
                        </div>

                        {/* Ticket Info */}
                        <div className="ticket-info">
                            <div className="ticket-row">
                                <span className="ticket-label">Tipo:</span>
                                <span className="ticket-value">
                                    {ticketData.type === 'sale' ? 'VENTA' : 'PEDIDO'}
                                </span>
                            </div>
                            <div className="ticket-row">
                                <span className="ticket-label">Nº:</span>
                                <span className="ticket-value">{ticketData.id}</span>
                            </div>
                            <div className="ticket-row">
                                <span className="ticket-label">Fecha:</span>
                                <span className="ticket-value">{formatDate(ticketData.date)}</span>
                            </div>
                            {ticketData.customerName && (
                                <div className="ticket-row">
                                    <span className="ticket-label">Cliente:</span>
                                    <span className="ticket-value">{ticketData.customerName}</span>
                                </div>
                            )}
                            {ticketData.customerPhone && (
                                <div className="ticket-row">
                                    <span className="ticket-label">Tel:</span>
                                    <span className="ticket-value">{ticketData.customerPhone}</span>
                                </div>
                            )}
                            <div className="ticket-divider"></div>
                        </div>

                        {/* Items */}
                        <div className="ticket-items">
                            <div className="ticket-items-header">
                                <span className="ticket-col-name">Producto</span>
                                <span className="ticket-col-qty">Cant.</span>
                                <span className="ticket-col-price">Precio</span>
                                <span className="ticket-col-total">Total</span>
                            </div>
                            <div className="ticket-divider"></div>
                            {ticketData.items.map((item, index) => (
                                <div key={index} className="ticket-item-row">
                                    <span className="ticket-col-name">{item.name}</span>
                                    <span className="ticket-col-qty">{item.quantity}</span>
                                    <span className="ticket-col-price">{formatCurrency(item.unitPrice)}</span>
                                    <span className="ticket-col-total">{formatCurrency(item.total)}</span>
                                </div>
                            ))}
                            <div className="ticket-divider"></div>
                        </div>

                        {/* Totals */}
                        <div className="ticket-totals">
                            <div className="ticket-total-row">
                                <span className="ticket-total-label">Subtotal:</span>
                                <span className="ticket-total-value">{formatCurrency(ticketData.subtotal)}</span>
                            </div>
                            {ticketData.discount && ticketData.discount > 0 && (
                                <div className="ticket-total-row discount">
                                    <span className="ticket-total-label">Descuento:</span>
                                    <span className="ticket-total-value">-{formatCurrency(ticketData.discount)}</span>
                                </div>
                            )}
                            {ticketData.type === 'order' && ticketData.advancePayment && (
                                <div className="ticket-total-row">
                                    <span className="ticket-total-label">Seña/Adelanto:</span>
                                    <span className="ticket-total-value">-{formatCurrency(ticketData.advancePayment)}</span>
                                </div>
                            )}
                            <div className="ticket-total-row grand-total">
                                <span className="ticket-total-label">TOTAL:</span>
                                <span className="ticket-total-value">{formatCurrency(ticketData.total)}</span>
                            </div>
                            {ticketData.type === 'order' && ticketData.advancePayment && (
                                <div className="ticket-total-row pending">
                                    <span className="ticket-total-label">Saldo Pendiente:</span>
                                    <span className="ticket-total-value">
                                        {formatCurrency(ticketData.total - (ticketData.advancePayment || 0))}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Payment Method */}
                        {ticketData.paymentMethod && (
                            <div className="ticket-payment">
                                <span className="ticket-label">Pago:</span>
                                <span className="ticket-value">
                                    {ticketData.paymentMethod === 'cash' ? 'Efectivo' :
                                     ticketData.paymentMethod === 'card' ? 'Tarjeta' :
                                     ticketData.paymentMethod === 'transfer' ? 'Transferencia' :
                                     ticketData.paymentMethod}
                                </span>
                            </div>
                        )}

                        {/* Notes */}
                        {ticketData.notes && (
                            <div className="ticket-notes">
                                <p>{ticketData.notes}</p>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="ticket-footer">
                            <div className="ticket-divider"></div>
                            <p className="ticket-footer-text">¡Gracias por su compra!</p>
                            <p className="ticket-footer-text">{shopName}</p>
                            <p className="ticket-footer-text-small">Este ticket es un comprobante válido</p>
                        </div>
                    </div>

                    {/* Print Button */}
                    <div className="ticket-printer-actions">
                        <button className="btn btn-secondary" onClick={onClose}>
                            Cancelar
                        </button>
                        <button className="btn btn-primary" onClick={handlePrint}>
                            <Printer size={18} />
                            Imprimir Ticket
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

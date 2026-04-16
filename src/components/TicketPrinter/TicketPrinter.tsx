import React, { useRef, useEffect, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
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
    showWatermark?: boolean; // True for free plan
}

export const TicketPrinter: React.FC<TicketPrinterProps> = ({
    ticketData,
    isOpen,
    onClose,
    showWatermark = false
}) => {
    const componentRef = useRef<HTMLDivElement>(null);
    const [planSlug, setPlanSlug] = useState<string>('');
    const shopInfo = useStore(state => state.shopInfo);

    // Load plan from localStorage (set during login)
    useEffect(() => {
        const stored = localStorage.getItem('subscription_plan_slug');
        if (stored) setPlanSlug(stored);
    }, []);

    // Determine if watermark should show
    const shouldWatermark = showWatermark || planSlug === 'semilla';

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Ticket-${ticketData?.id}`,
        onAfterPrint: onClose,
    });

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

    // Obtenemos los datos de la identidad de la floreria o aplicamos un default.
    const finalShopName = shopInfo?.name || 'MI JARDÍN';
    const finalShopPhone = shopInfo?.phone || '';
    const finalShopAddress = shopInfo?.address || '';
    const finalShopInstagram = shopInfo?.instagram || '';

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
                            <h1 className="ticket-shop-name">{finalShopName}</h1>
                            {finalShopAddress && <p className="ticket-shop-address">{finalShopAddress}</p>}
                            {finalShopPhone && <p className="ticket-shop-phone">WP: {finalShopPhone}</p>}
                            {finalShopInstagram && <p className="ticket-shop-ig">IG: {finalShopInstagram}</p>}
                            <div className="ticket-divider"></div>
                        </div>

                        {/* Ticket Info */}
                        <div className="ticket-info">
                            <div className="ticket-row">
                                <span className="ticket-label">COMPROBANTE:</span>
                                <span className="ticket-value">
                                    {ticketData.type === 'sale' ? 'VENTA' : 'PEDIDO'}
                                </span>
                            </div>
                            <div className="ticket-row">
                                <span className="ticket-label">TICKET Nº:</span>
                                <span className="ticket-value">#{ticketData.id}</span>
                            </div>
                            <div className="ticket-row">
                                <span className="ticket-label">FECHA:</span>
                                <span className="ticket-value">{formatDate(ticketData.date)}</span>
                            </div>
                            {(ticketData.customerName || ticketData.customerPhone) && (
                                <>
                                    <div className="ticket-divider"></div>
                                    {ticketData.customerName && (
                                        <div className="ticket-row">
                                            <span className="ticket-label">CLIENTE:</span>
                                            <span className="ticket-value">{ticketData.customerName}</span>
                                        </div>
                                    )}
                                    {ticketData.customerPhone && (
                                        <div className="ticket-row">
                                            <span className="ticket-label">TEL:</span>
                                            <span className="ticket-value">{ticketData.customerPhone}</span>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="ticket-divider"></div>
                        </div>

                        {/* Items */}
                        <div className="ticket-items">
                            <div className="ticket-items-header">
                                <span className="ticket-col-qty">CANT</span>
                                <span className="ticket-col-name">DESCRIPCION</span>
                                <span className="ticket-col-total">IMPORTE</span>
                            </div>
                            <div className="ticket-divider-thin"></div>
                            {ticketData.items.map((item, index) => (
                                <React.Fragment key={index}>
                                    <div className="ticket-item-row-basic">
                                        <span className="ticket-col-qty">{item.quantity}</span>
                                        <span className="ticket-col-name">{item.name}</span>
                                        <span className="ticket-col-total">{formatCurrency(item.total)}</span>
                                    </div>
                                    {/* Precio unitario if quantity > 1 */}
                                    {item.quantity > 1 && (
                                        <div className="ticket-item-subtext">
                                            {item.quantity} x {formatCurrency(item.unitPrice)}
                                        </div>
                                    )}
                                </React.Fragment>
                            ))}
                            <div className="ticket-divider"></div>
                        </div>

                        {/* Totals */}
                        <div className="ticket-totals">
                            <div className="ticket-total-row">
                                <span className="ticket-total-label">SUBTOTAL:</span>
                                <span className="ticket-total-value">{formatCurrency(ticketData.subtotal)}</span>
                            </div>
                            {ticketData.discount && ticketData.discount > 0 ? (
                                <div className="ticket-total-row discount">
                                    <span className="ticket-total-label">DESCUENTO:</span>
                                    <span className="ticket-total-value">-{formatCurrency(ticketData.discount)}</span>
                                </div>
                            ) : null}
                            <div className="ticket-total-row grand-total">
                                <span className="ticket-total-label">TOTAL:</span>
                                <span className="ticket-total-value">{formatCurrency(ticketData.total)}</span>
                            </div>

                            {ticketData.type === 'order' && ticketData.advancePayment ? (
                                <>
                                    <div className="ticket-total-row advance">
                                        <span className="ticket-total-label">SEÑA/PAGO:</span>
                                        <span className="ticket-total-value">{formatCurrency(ticketData.advancePayment)}</span>
                                    </div>
                                    <div className="ticket-total-row pending">
                                        <span className="ticket-total-label">FALTA ABONAR:</span>
                                        <span className="ticket-total-value">
                                            {formatCurrency(ticketData.total - ticketData.advancePayment)}
                                        </span>
                                    </div>
                                </>
                            ) : null}
                        </div>

                        {/* Payment Method */}
                        {ticketData.paymentMethod && (
                            <div className="ticket-payment">
                                <div className="ticket-divider-thin"></div>
                                <div className="ticket-row">
                                    <span className="ticket-label">MEDIO DE PAGO:</span>
                                    <span className="ticket-value">
                                        {ticketData.paymentMethod === 'cash' ? 'EFECTIVO' :
                                            ticketData.paymentMethod === 'card' ? 'TARJETA' :
                                                ticketData.paymentMethod === 'transfer' ? 'TRANSFERENCIA' :
                                                    ticketData.paymentMethod.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {ticketData.notes && (
                            <div className="ticket-notes">
                                <p className="ticket-label">NOTAS:</p>
                                <p>{ticketData.notes}</p>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="ticket-footer">
                            <div className="ticket-divider"></div>
                            <p className="ticket-footer-msg">¡GRACIAS POR SU COMPRA!</p>
                            <p className="ticket-footer-shop">{finalShopName}</p>
                            {shouldWatermark && (
                                <div className="ticket-watermark">
                                    <p className="watermark-text">Powered by Mi Jardín ERP</p>
                                </div>
                            )}
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

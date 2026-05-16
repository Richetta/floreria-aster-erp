import React, { useState, useEffect } from 'react';
import { 
    X, 
    ShoppingBag, 
    TrendingUp, 
    Clock, 
    Package
} from 'lucide-react';
import './CustomerHistoryModal.css';

interface CustomerHistoryModalProps {
    customerId: string;
    customerName: string;
    onClose: () => void;
}

export const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({
    customerId,
    customerName,
    onClose
}) => {
    const [history, setHistory] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem('auth_token');
                const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                const baseUrl = import.meta.env.PROD
                  ? '/api'
                  : (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`);
                const res = await fetch(`${baseUrl}/customers/${customerId}/history`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!res.ok) throw new Error('Error al cargar el historial');
                const data = await res.json();
                setHistory(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [customerId]);

    if (isLoading) {
        return (
            <div className="modal-overlay">
                <div className="history-modal-content loading">
                    <div className="spinner"></div>
                    <p>Cargando historial de {customerName}...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="history-modal-content" onClick={e => e.stopPropagation()}>
                <div className="history-header">
                    <div className="header-info">
                        <h2 className="text-h2">Historial de {customerName}</h2>
                        <p className="text-small text-muted">Línea de tiempo de actividad y consumos</p>
                    </div>
                    <button className="close-btn" onClick={onClose}><X size={24} /></button>
                </div>

                <div className="history-body">
                    {/* Stats Bar */}
                    <div className="history-stats-grid">
                        <div className="stat-card-premium">
                            <ShoppingBag className="stat-icon" size={20} />
                            <div className="stat-value">${history?.total_spent?.toLocaleString() || 0}</div>
                            <div className="stat-label">Total Gastado</div>
                        </div>
                        <div className="stat-card-premium">
                            <Package className="stat-icon" size={20} />
                            <div className="stat-value">{history?.total_orders || 0}</div>
                            <div className="stat-label">Pedidos Totales</div>
                        </div>
                        <div className="stat-card-premium">
                            <TrendingUp className="stat-icon" size={20} />
                            <div className="stat-value">
                                ${history?.total_orders > 0 ? (history.total_spent / history.total_orders).toFixed(0) : 0}
                            </div>
                            <div className="stat-label">Ticket Promedio</div>
                        </div>
                    </div>

                    <h3 className="section-title-premium mt-6">Línea de Tiempo</h3>
                    
                    <div className="timeline">
                        {history?.orders?.length > 0 ? (
                            history.orders.map((order: any) => (
                                <div key={order.id} className="timeline-item">
                                    <div className="timeline-marker"></div>
                                    <div className="timeline-content">
                                        <div className="timeline-date">
                                            {new Date(order.created_at).toLocaleDateString('es-AR', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </div>
                                        <div className="timeline-card">
                                            <div className="card-header">
                                                <span className="order-number">Pedido #{order.order_number || order.id.substring(0, 5)}</span>
                                                <span className={`status-badge ${order.status}`}>{order.status}</span>
                                            </div>
                                            <div className="card-total">${Number(order.total_amount).toLocaleString()}</div>
                                            {order.delivery_method === 'delivery' && (
                                                <div className="card-delivery">
                                                    Envío a: {order.delivery_address_street} {order.delivery_address_number}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-history">
                                <Clock size={48} className="empty-icon" />
                                <p>Este cliente aún no tiene pedidos registrados.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

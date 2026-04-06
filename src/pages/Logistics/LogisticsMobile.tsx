import { useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import './LogisticsMobile.css';

export const LogisticsMobile = () => {
    const orders = useStore(state => state.orders);
    const updateOrderStatus = useStore(state => state.updateOrderStatus);
    const loadOrders = useStore(state => state.loadOrders);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const activeDeliveries = useMemo(() => 
        (orders || []).filter(o => o.status === 'ready' || o.status === 'out_for_delivery')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        [orders]
    );

    const handleOpenMap = (address: any) => {
        const query = `${address?.street || ''} ${address?.number || ''} ${address?.city || ''}`.trim();
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
    };

    const handleCall = (phone: string) => {
        window.open(`tel:${phone.replace(/\D/g, '')}`, '_blank');
    };

    const handleWhatsApp = (phone: string) => {
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
    };

    return (
        <div className="logistics-mobile-wrapper">
            <header className="mobile-logistics-header">
                <h2>Rutas y Entregas</h2>
                <div className="logistics-stats">
                    <div className="stat-pill">
                        <span className="material-symbols-rounded">inventory_2</span>
                        {activeDeliveries.filter(o => o.status === 'ready').length} Listos
                    </div>
                    <div className="stat-pill active">
                        <span className="material-symbols-rounded">local_shipping</span>
                        {activeDeliveries.filter(o => o.status === 'out_for_delivery').length} En viaje
                    </div>
                </div>
            </header>

            <div className="delivery-feed">
                {activeDeliveries.length === 0 ? (
                    <div className="empty-deliveries">
                        <span className="material-symbols-rounded">task_alt</span>
                        <p>No hay entregas pendientes</p>
                    </div>
                ) : (
                    activeDeliveries.map(order => (
                        <div key={order.id} className={`delivery-m-card ${order.status}`}>
                            <div className="d-m-header">
                                <div className="d-m-customer">
                                    <h3>{order.customerName}</h3>
                                    <span className="d-m-id">ID: #{order.id.slice(-4).toUpperCase()}</span>
                                </div>
                                <span className={`d-m-badge ${order.status}`}>
                                    {order.status === 'ready' ? 'Listo' : 'En Camino'}
                                </span>
                            </div>

                            <div className="d-m-body">
                                <div className="d-m-address" onClick={() => handleOpenMap(order.deliveryAddress)}>
                                    <span className="material-symbols-rounded">location_on</span>
                                    <div className="addr-text">
                                        <p>{order.deliveryAddress?.street} {order.deliveryAddress?.number}</p>
                                        <span>{order.deliveryAddress?.city || 'Rosario'}</span>
                                    </div>
                                    <span className="material-symbols-rounded chevron">chevron_right</span>
                                </div>
                                
                                {order.deliveryAddress?.reference && (
                                    <div className="d-m-note">
                                        <span className="material-symbols-rounded">info</span>
                                        <p>{order.deliveryAddress.reference}</p>
                                    </div>
                                )}
                            </div>

                            <div className="d-m-actions">
                                <button className="d-action-btn phone" onClick={() => handleCall(order.contactPhone || order.customerPhone || '')}>
                                    <span className="material-symbols-rounded">call</span>
                                </button>
                                <button className="d-action-btn whatsapp" onClick={() => handleWhatsApp(order.contactPhone || order.customerPhone || '')}>
                                    <span className="material-symbols-rounded">message</span>
                                </button>
                                
                                {order.status === 'ready' ? (
                                    <button className="d-confirm-btn start" onClick={() => updateOrderStatus(order.id, 'out_for_delivery')}>
                                        <span className="material-symbols-rounded">local_shipping</span>
                                        Iniciar Viaje
                                    </button>
                                ) : (
                                    <button className="d-confirm-btn finish" onClick={() => updateOrderStatus(order.id, 'delivered')}>
                                        <span className="material-symbols-rounded">check_circle</span>
                                        Entregado
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

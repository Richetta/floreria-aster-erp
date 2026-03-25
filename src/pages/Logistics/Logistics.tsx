import { useMemo, useEffect } from 'react';
import {
    Truck,
    MapPin,
    Phone,
    CheckCircle2,
    Clock,
    Navigation,
    Package
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import './Logistics.css';

export const Logistics = () => {
    const orders = useStore(state => state.orders);
    const updateOrderStatus = useStore(state => state.updateOrderStatus);
    const loadOrders = useStore(state => state.loadOrders);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const readyOrders = useMemo(() =>
        (orders || []).filter(o => o.status === 'ready' || o.status === 'pending').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        [orders]
    );

    const shippingOrders = useMemo(() =>
        (orders || []).filter(o => o.status === 'out_for_delivery'),
        [orders]
    );

    const handleStartShipping = (id: string) => {
        updateOrderStatus(id, 'out_for_delivery');
    };

    const handleCompleteDelivery = (id: string) => {
        updateOrderStatus(id, 'delivered');
    };

    const handleOpenMap = (address: any) => {
        const query = `${address?.street || ''} ${address?.number || ''} ${address?.city || ''}`.trim();
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
    };

    const handleCallCustomer = (phone: string) => {
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
    };

    return (
        <div className="logistics-page p-6">
            <header className="page-header mb-8">
                <h1 className="text-h1">Rutas y Entregas</h1>
                <p className="text-body mt-2 text-muted">Panel de control para el repartidor. Gestiona envíos en tiempo real.</p>
            </header>

            <div className="logistics-grid">
                {/* Pending Deliveries */}
                <section className="logistics-section">
                    <h2 className="text-h3 mb-6 flex items-center gap-2">
                        <Clock size={24} className="text-warning" />
                        Listos para Salir ({readyOrders.length})
                    </h2>

                    <div className="delivery-list">
                        {readyOrders.length === 0 ? (
                            <div className="empty-state text-center py-12 card">
                                <Package size={48} className="mx-auto mb-4 opacity-20" />
                                <p>No hay pedidos listos para retiro.</p>
                            </div>
                        ) : (
                            readyOrders.map(order => (
                                <div key={order.id} className="card delivery-card ready">
                                    <div className="delivery-header mb-4">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-h4">{order.customerName}</h4>
                                            <span className="badge badge-warning">Listo</span>
                                        </div>
                                        <p className="text-small text-muted">ID: #{order.id.split('-')[0]}</p>
                                    </div>

                                    <div className="delivery-info space-y-3 mb-6">
                                        {order.deliveryMethod === 'delivery' ? (
                                            <>
                                                <div className="flex items-start gap-3">
                                                    <MapPin size={18} className="text-primary mt-1" />
                                                    <div>
                                                        <p className="text-body font-medium">
                                                            {order.deliveryAddress?.street || 'Dirección pendiente'} 
                                                            {order.deliveryAddress?.number && ` ${order.deliveryAddress.number}`}
                                                        </p>
                                                        {order.deliveryAddress?.floor && (
                                                            <p className="text-micro text-muted">{order.deliveryAddress.floor}</p>
                                                        )}
                                                        {order.deliveryAddress?.city && (
                                                            <p className="text-micro text-muted">{order.deliveryAddress.city}</p>
                                                        )}
                                                        {order.deliveryAddress?.reference && (
                                                            <p className="text-micro text-muted mt-1">{order.deliveryAddress.reference}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Phone size={18} className="text-primary" />
                                                    <p className="text-body font-medium">
                                                        {order.contactPhone || order.customerPhone || 'Sin teléfono'}
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-3 bg-surface-hover p-3 rounded-lg">
                                                <MapPin size={18} className="text-success" />
                                                <p className="text-body font-medium">Retiro por local</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 mb-4">
                                        {order.deliveryMethod === 'delivery' && order.deliveryAddress?.street && (
                                            <button 
                                                className="btn btn-secondary flex-1 text-small flex items-center justify-center gap-2"
                                                onClick={() => handleOpenMap(order.deliveryAddress)}
                                            >
                                                <MapPin size={14} /> Ver Mapa
                                            </button>
                                        )}
                                        <button 
                                            className="btn btn-secondary flex-1 text-small flex items-center justify-center gap-2"
                                            onClick={() => handleCallCustomer(order.contactPhone || order.customerPhone || '')}
                                        >
                                            <Phone size={14} /> Llamar
                                        </button>
                                    </div>

                                    <button
                                        className="btn btn-primary w-full flex items-center justify-center gap-2 py-3"
                                        onClick={() => handleStartShipping(order.id)}
                                    >
                                        <Truck size={20} />
                                        Iniciar Envío
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Shipping In Progress */}
                <section className="logistics-section">
                    <h2 className="text-h3 mb-6 flex items-center gap-2">
                        <Navigation size={24} className="text-primary" />
                        En Camino ({shippingOrders.length})
                    </h2>

                    <div className="delivery-list">
                        {shippingOrders.length === 0 ? (
                            <div className="empty-state text-center py-12 border-2 border-dashed border-border rounded-xl">
                                <Truck size={48} className="mx-auto mb-4 opacity-10" />
                                <p className="text-muted">No hay entregas en curso.</p>
                            </div>
                        ) : (
                            shippingOrders.map(order => (
                                <div key={order.id} className="card delivery-card shipping active-shipping">
                                    <div className="delivery-header mb-4">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-h4">{order.customerName}</h4>
                                            <span className="badge badge-primary pulse">En Camino</span>
                                        </div>
                                        <p className="text-small text-muted">ID: #{order.id.split('-')[0]}</p>
                                    </div>

                                    <div className="delivery-info space-y-3 mb-6">
                                        {order.deliveryMethod === 'delivery' ? (
                                            <>
                                                <div className="flex items-start gap-3">
                                                    <MapPin size={18} className="text-primary mt-1" />
                                                    <div>
                                                        <p className="text-body font-medium">
                                                            {order.deliveryAddress?.street || 'Dirección pendiente'} 
                                                            {order.deliveryAddress?.number && ` ${order.deliveryAddress.number}`}
                                                        </p>
                                                        {order.deliveryAddress?.city && (
                                                            <p className="text-micro text-muted">{order.deliveryAddress.city}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    {order.deliveryAddress?.street && (
                                                        <button 
                                                            className="btn btn-secondary flex-1 text-small flex items-center justify-center gap-2"
                                                            onClick={() => handleOpenMap(order.deliveryAddress)}
                                                        >
                                                            <MapPin size={14} /> Ver Mapa
                                                        </button>
                                                    )}
                                                    <button 
                                                        className="btn btn-secondary flex-1 text-small flex items-center justify-center gap-2"
                                                        onClick={() => handleCallCustomer(order.contactPhone || order.customerPhone || '')}
                                                    >
                                                        <Phone size={14} /> Llamar
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-3 bg-surface-hover p-3 rounded-lg">
                                                <MapPin size={18} className="text-success" />
                                                <p className="text-body font-medium">Listo para retiro</p>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        className="btn btn-success w-full flex items-center justify-center gap-2 py-3"
                                        onClick={() => handleCompleteDelivery(order.id)}
                                    >
                                        <CheckCircle2 size={20} />
                                        Confirmar Entrega
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            {/* Mock Map Panel */}
            <section className="mt-8 card logistics-map-panel">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-h3">Optimización de Ruta</h3>
                    <span className="text-small text-muted italic">Simulación de tráfico activa</span>
                </div>
                <div className="map-placeholder">
                    <div className="map-overlay">
                        <div className="route-marker marker-start">A</div>
                        <div className="route-line"></div>
                        <div className="route-marker marker-end">B</div>
                    </div>
                    <p className="text-body text-center mt-4">Integración con Google Maps API pendiente de configuración de Key</p>
                </div>
            </section>
        </div>
    );
};

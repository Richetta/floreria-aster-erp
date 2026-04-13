import { useMemo, useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import type { OptimizedRouteResult } from '../../utils/routeOptimizer';
import { optimizeRoute, generateOptimizedMapsUrl } from '../../utils/routeOptimizer';
import { isGoogleMapsConfigured } from '../../utils/googleMaps';
import { api } from '../../services/api';
import './LogisticsMobile.css';

export const LogisticsMobile = () => {
    const orders = useStore(state => state.orders);
    const updateOrderStatus = useStore(state => state.updateOrderStatus);
    const loadOrders = useStore(state => state.loadOrders);
    const shopInfo = useStore(state => state.shopInfo);

    const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRouteResult | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    const handleOptimizeRoute = useCallback(async () => {
        setIsOptimizing(true);
        setError(null);

        try {
            // Try backend first
            try {
                const response = await api.getLogisticsDeliveries();

                if (response.deliveries && response.deliveries.length > 0) {
                    const floristAddr = response.floristAddress || shopInfo?.address || '';

                    if (!floristAddr) {
                        setError('Configura la dirección de la florería en Ajustes');
                        setIsOptimizing(false);
                        return;
                    }

                    const deliveriesAsOrders = response.deliveries.map((d: any) => ({
                        ...d,
                        customerName: d.guest_name || 'Cliente',
                        deliveryAddress: d.delivery_address || {
                            street: d.delivery_address_street,
                            number: d.delivery_address_number,
                            floor: d.delivery_address_floor,
                            city: d.delivery_address_city,
                            reference: d.delivery_address_reference
                        }
                    }));

                    const result = await optimizeRoute(deliveriesAsOrders, floristAddr);
                    setOptimizedRoute(result);
                    setIsOptimizing(false);
                    return;
                }
            } catch (err) {
                console.warn('Backend not available');
            }

            // Fallback to frontend
            const deliveries = activeDeliveries.filter(o => o.deliveryMethod === 'delivery' && o.deliveryAddress?.street);

            if (deliveries.length === 0) {
                setError('No hay entregas para optimizar');
                setIsOptimizing(false);
                return;
            }

            const floristAddress = shopInfo?.address;
            if (!floristAddress) {
                setError('Configura la dirección de la florería en Ajustes');
                setIsOptimizing(false);
                return;
            }

            const result = await optimizeRoute(deliveries, floristAddress);
            setOptimizedRoute(result);
        } catch (err) {
            setError('Error al optimizar');
        } finally {
            setIsOptimizing(false);
        }
    }, [activeDeliveries, shopInfo]);

    const handleOpenOptimizedRoute = useCallback(() => {
        if (!optimizedRoute) return;

        const url = generateOptimizedMapsUrl(optimizedRoute);
        window.open(url, '_blank');
    }, [optimizedRoute]);

    // Get optimized delivery order
    const getOptimizedOrderIndex = useCallback((orderId: string) => {
        if (!optimizedRoute) return -1;
        return optimizedRoute.points.findIndex(p => p.order.id === orderId);
    }, [optimizedRoute]);

    const isGoogleMapsAvailable = isGoogleMapsConfigured();

    return (
        <div className="logistics-mobile-wrapper">
            <header className="mobile-logistics-header">
                <div className="header-top">
                    <h2>Rutas y Entregas</h2>
                    {isGoogleMapsAvailable && (
                        <button
                            className="btn-optimize"
                            onClick={handleOptimizeRoute}
                            disabled={isOptimizing || activeDeliveries.length === 0}
                        >
                            {isOptimizing ? (
                                <span className="material-symbols-rounded animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-rounded">route</span>
                            )}
                        </button>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="error-banner">
                        <span className="material-symbols-rounded">error</span>
                        <p>{error}</p>
                        <button onClick={() => setError(null)}>×</button>
                    </div>
                )}

                {/* Route Stats */}
                {optimizedRoute && (
                    <div className="route-stats-card">
                        <div className="stats-row">
                            <div className="stat-item">
                                <span className="material-symbols-rounded">location_on</span>
                                <div>
                                    <small>Paradas</small>
                                    <strong>{optimizedRoute.points.length}</strong>
                                </div>
                            </div>
                            <div className="stat-item">
                                <span className="material-symbols-rounded">straighten</span>
                                <div>
                                    <small>Distancia</small>
                                    <strong>{optimizedRoute.totalDistance.text}</strong>
                                </div>
                            </div>
                            <div className="stat-item">
                                <span className="material-symbols-rounded">schedule</span>
                                <div>
                                    <small>Tiempo</small>
                                    <strong>{optimizedRoute.totalDuration.text}</strong>
                                </div>
                            </div>
                        </div>
                        <button className="btn-open-maps" onClick={handleOpenOptimizedRoute}>
                            <span className="material-symbols-rounded">open_in_new</span>
                            Abrir en Google Maps
                        </button>
                    </div>
                )}

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
                    activeDeliveries.map(order => {
                        const optIndex = getOptimizedOrderIndex(order.id);
                        const isOptimized = optIndex >= 0;

                        return (
                            <div key={order.id} className={`delivery-m-card ${order.status} ${isOptimized ? 'optimized' : ''}`}>
                                {isOptimized && (
                                    <div className="opt-badge">
                                        <span className="material-symbols-rounded">navigation</span>
                                        #{optIndex + 1}
                                    </div>
                                )}

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

                                    {isOptimized && optimizedRoute?.points[optIndex]?.distanceFromPrevious && (
                                        <div className="d-m-distance">
                                            <span className="material-symbols-rounded">navigation</span>
                                            <span>
                                                {optimizedRoute.points[optIndex].distanceFromPrevious.text} · {optimizedRoute.points[optIndex].durationFromPrevious?.text}
                                            </span>
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
                        );
                    })
                )}
            </div>
        </div>
    );
};

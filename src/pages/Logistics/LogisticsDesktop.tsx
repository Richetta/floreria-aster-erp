import { useMemo, useEffect, useState, useCallback } from 'react';
import {
    Truck,
    MapPin,
    Phone,
    CheckCircle2,
    Clock,
    Navigation,
    Package,
    Route,
    ExternalLink,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { MapMarker, MapRoute } from '../../components/GoogleMap/GoogleMap';
import { GoogleMap } from '../../components/GoogleMap/GoogleMap';
import type { OptimizedRouteResult } from '../../utils/routeOptimizer';
import { optimizeRoute, generateOptimizedMapsUrl } from '../../utils/routeOptimizer';
import { isGoogleMapsConfigured } from '../../utils/googleMaps';
import { api } from '../../services/api';
import './Logistics.css';

export const LogisticsDesktop = () => {
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

    const handleOptimizeRoute = useCallback(async () => {
        setIsOptimizing(true);
        setError(null);

        try {
            // Try to fetch from backend first
            try {
                const response = await api.getLogisticsDeliveries();

                if (response.deliveries && response.deliveries.length > 0) {
                    const floristAddr = response.floristAddress || shopInfo?.address || '';

                    if (!floristAddr) {
                        setError('No se encontró la dirección de la florería. Configúrala en Ajustes.');
                        setIsOptimizing(false);
                        return;
                    }

                    // Convert backend deliveries to Order format
                    const deliveriesAsOrders = response.deliveries.map((d: any) => ({
                        ...d,
                        customer_name: d.guest_name || 'Cliente',
                        delivery_address: d.delivery_address || {
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
            } catch (backendError) {
                console.warn('Backend not available, using frontend data:', backendError);
            }

            // Fallback to frontend data
            const deliveries = readyOrders.filter(o => o.deliveryMethod === 'delivery' && o.deliveryAddress?.street);

            if (deliveries.length === 0) {
                setError('No hay entregas pendientes para optimizar');
                setIsOptimizing(false);
                return;
            }

            const floristAddress = shopInfo?.address;
            if (!floristAddress) {
                setError('No se encontró la dirección de la florería. Configúrala en Ajustes.');
                setIsOptimizing(false);
                return;
            }

            const result = await optimizeRoute(deliveries, floristAddress);
            setOptimizedRoute(result);
        } catch (err) {
            console.error('Error optimizing route:', err);
            setError('Error al optimizar la ruta. Inténtalo de nuevo.');
        } finally {
            setIsOptimizing(false);
        }
    }, [readyOrders, shopInfo]);

    const handleOpenOptimizedRoute = useCallback(() => {
        if (!optimizedRoute) return;

        const url = generateOptimizedMapsUrl(optimizedRoute);
        window.open(url, '_blank');
    }, [optimizedRoute]);

    const handleMarkerClick = useCallback((marker: MapMarker) => {
        console.log('Marker clicked:', marker.title);
    }, []);

    // Prepare map data
    const mapMarkers: MapMarker[] = useMemo(() => {
        if (!optimizedRoute) return [];

        const markers: MapMarker[] = [];

        // Add florist location (start point)
        if (optimizedRoute.floristCoordinates) {
            markers.push({
                position: optimizedRoute.floristCoordinates,
                label: 'A',
                title: 'Florería (Inicio)',
                color: '#10B981',
                info: optimizedRoute.floristAddress
            });
        }

        // Add delivery points
        optimizedRoute.points.forEach((point, index) => {
            if (point.coordinates) {
                const customerName = point.order.customerName || point.order.customer_name || `Entrega ${index + 1}`;
                const distanceText = point.distanceFromPrevious?.text || '';
                const durationText = point.durationFromPrevious?.text || '';

                markers.push({
                    position: point.coordinates,
                    label: String.fromCharCode(66 + index), // B, C, D, etc.
                    title: customerName,
                    color: '#A855F7',
                    info: `${point.address}${distanceText ? `<br/><small>${distanceText} · ${durationText}</small>` : ''}`
                });
            }
        });

        return markers;
    }, [optimizedRoute]);

    const mapRoutes: MapRoute[] = useMemo(() => {
        if (!optimizedRoute || optimizedRoute.points.length === 0) return [];

        // Create a route line connecting all points
        const path: Array<{ lat: number; lng: number }> = [];

        if (optimizedRoute.floristCoordinates) {
            path.push(optimizedRoute.floristCoordinates);
        }

        optimizedRoute.points.forEach(point => {
            if (point.coordinates) {
                path.push(point.coordinates);
            }
        });

        return [{
            path,
            color: '#A855F7',
            weight: 4
        }];
    }, [optimizedRoute]);

    const isGoogleMapsAvailable = isGoogleMapsConfigured();

    return (
        <div className="logistics-page p-6">
            <header className="page-header mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-h1">Rutas y Entregas</h1>
                        <p className="text-body mt-2 text-muted">Panel de control para el repartidor. Gestiona envíos en tiempo real.</p>
                    </div>
                    <button
                        className="btn btn-primary flex items-center gap-2"
                        onClick={handleOptimizeRoute}
                        disabled={isOptimizing || readyOrders.length === 0}
                    >
                        {isOptimizing ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Optimizando...
                            </>
                        ) : (
                            <>
                                <Route size={20} />
                                Optimizar Ruta
                            </>
                        )}
                    </button>
                </div>
            </header>

            {/* Error Message */}
            {error && (
                <div className="card bg-red-50 border-red-200 p-4 mb-6 flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-600 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-small text-red-800">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">×</button>
                </div>
            )}

            {/* Route Optimization Stats */}
            {optimizedRoute && (
                <div className="card mb-6 bg-gradient-to-r from-purple-50 to-green-50 border-purple-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div>
                                <p className="text-micro text-muted">Entregas</p>
                                <p className="text-h2">{optimizedRoute.points.length}</p>
                            </div>
                            <div>
                                <p className="text-micro text-muted">Distancia Total</p>
                                <p className="text-h2">{optimizedRoute.totalDistance.text}</p>
                            </div>
                            <div>
                                <p className="text-micro text-muted">Tiempo Estimado</p>
                                <p className="text-h2">{optimizedRoute.totalDuration.text}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                className="btn btn-secondary flex items-center gap-2"
                                onClick={handleOptimizeRoute}
                            >
                                <Route size={16} />
                                Recalcular
                            </button>
                            <button
                                className="btn btn-primary flex items-center gap-2"
                                onClick={handleOpenOptimizedRoute}
                            >
                                <ExternalLink size={16} />
                                Abrir en Google Maps
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Route Optimization Map Panel */}
            <section className="mt-8 card logistics-map-panel">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-h3 flex items-center gap-2">
                            <Route size={24} className="text-primary" />
                            Optimización de Ruta
                        </h3>
                        <p className="text-small text-muted mt-1">
                            {isGoogleMapsAvailable
                                ? 'Mapa interactivo con ruta optimizada desde la florería'
                                : 'Configura tu API Key de Google Maps para activar el mapa interactivo'}
                        </p>
                    </div>
                    {optimizedRoute && (
                        <div className="flex gap-2">
                            <span className="badge badge-success">
                                {optimizedRoute.points.length} paradas
                            </span>
                        </div>
                    )}
                </div>

                {/* Interactive Google Map */}
                {isGoogleMapsAvailable ? (
                    <div className="map-wrapper">
                        <GoogleMap
                            markers={mapMarkers}
                            routes={mapRoutes}
                            height="450px"
                            className="route-map"
                            onMarkerClick={handleMarkerClick}
                        />

                        {/* Route Steps */}
                        {optimizedRoute && optimizedRoute.points.length > 0 && (
                            <div className="route-steps mt-4">
                                <div className="route-step-item">
                                    <div className="route-step-marker" style={{ background: '#10B981' }}>
                                        A
                                    </div>
                                    <div className="route-step-content">
                                        <p className="route-step-title">Florería (Punto de Salida)</p>
                                        <p className="route-step-address">{optimizedRoute.floristAddress}</p>
                                    </div>
                                </div>

                                {optimizedRoute.points.map((point, index) => {
                                    const customerName = point.order.customerName || point.order.customer_name || `Entrega ${index + 1}`;
                                    const contactPhone = point.order.contactPhone || point.order.contact_phone;
                                    const customerPhone = point.order.customerPhone || point.order.customer_phone;
                                    const deliveryAddr = point.order.deliveryAddress || point.order.delivery_address;

                                    return (
                                        <div key={point.order.id} className="route-step-item">
                                            <div className="route-step-marker" style={{ background: '#A855F7' }}>
                                                {String.fromCharCode(66 + index)}
                                            </div>
                                            <div className="route-step-content">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="route-step-title">
                                                            {customerName}
                                                        </p>
                                                        <p className="route-step-address">{point.address}</p>
                                                        {deliveryAddr?.reference && (
                                                            <p className="route-step-note">{deliveryAddr.reference}</p>
                                                        )}
                                                    </div>
                                                    {point.distanceFromPrevious && (
                                                        <div className="route-step-distance">
                                                            <Navigation size={14} />
                                                            <span>{point.distanceFromPrevious.text}</span>
                                                            <span className="text-muted">·</span>
                                                            <span>{point.durationFromPrevious?.text}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        className="btn btn-secondary text-small flex items-center gap-1"
                                                        onClick={() => handleOpenMap(deliveryAddr)}
                                                    >
                                                        <MapPin size={14} /> Ver
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary text-small flex items-center gap-1"
                                                        onClick={() => handleCallCustomer(contactPhone || customerPhone || '')}
                                                    >
                                                        <Phone size={14} /> Llamar
                                                    </button>
                                                    {point.order.status === 'ready' && (
                                                        <button
                                                            className="btn btn-primary text-small flex items-center gap-1"
                                                            onClick={() => handleStartShipping(point.order.id)}
                                                        >
                                                            <Truck size={14} /> Iniciar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="map-placeholder">
                        <div className="map-overlay">
                            <div className="route-marker marker-start">A</div>
                            <div className="route-line"></div>
                            <div className="route-marker marker-end">B</div>
                        </div>
                        <div className="text-center mt-4">
                            <p className="text-body mb-2">Integración con Google Maps API pendiente de configuración de Key</p>
                            <button
                                className="btn btn-secondary text-small"
                                onClick={() => window.open('https://console.cloud.google.com/google/maps-apis', '_blank')}
                            >
                                <ExternalLink size={14} /> Configurar API Key
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

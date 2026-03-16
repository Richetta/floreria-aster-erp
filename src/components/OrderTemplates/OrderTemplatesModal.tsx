import { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, ShoppingCart, Star, X, Users } from 'lucide-react';
import { useStore } from '../../store/useStore';
import './OrderTemplates.css';

interface OrderTemplate {
    id: string;
    name: string;
    customer_id?: string;
    customer_name?: string;
    items: {
        product_id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
    }[];
    delivery_method: 'pickup' | 'delivery';
    notes?: string;
    isFavorite: boolean;
}

interface OrderTemplatesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadTemplate: (template: OrderTemplate) => void;
}

export const OrderTemplatesModal: React.FC<OrderTemplatesModalProps> = ({
    isOpen,
    onClose,
    onLoadTemplate
}) => {
    const orders = useStore(state => state.orders);
    const [templates, setTemplates] = useState<OrderTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadTemplates();
        }
    }, [isOpen]);

    const loadTemplates = () => {
        setIsLoading(true);

        // Cargar templates guardados en localStorage
        const savedTemplates = localStorage.getItem('order_templates');
        if (savedTemplates) {
            setTemplates(JSON.parse(savedTemplates));
        } else {
            // Generar templates automáticos basados en pedidos frecuentes
            generateTemplatesFromOrders();
        }

        setIsLoading(false);
    };

    const generateTemplatesFromOrders = () => {
        // Agrupar pedidos por cliente y encontrar patrones
        const customerOrders = orders.reduce((acc, order) => {
            if (!order.customerId) return acc;

            if (!acc[order.customerId]) {
                acc[order.customerId] = [];
            }
            acc[order.customerId].push(order);
            return acc;
        }, {} as Record<string, typeof orders>);

        const generatedTemplates: OrderTemplate[] = [];

        Object.entries(customerOrders).forEach(([customerId, customerOrders]) => {
            // Si el cliente tiene 3+ pedidos, crear template con items más frecuentes
            if (customerOrders.length >= 2) {
                const itemCounts = new Map<string, { count: number, price: number, name: string }>();

                customerOrders.forEach(order => {
                    order.items?.forEach(item => {
                        const key = item.product_id || item.package_id;
                        if (!key) return;

                        const existing = itemCounts.get(key);
                        if (existing) {
                            existing.count++;
                            existing.price = item.unit_price;
                            existing.name = item.product_name;
                        } else {
                            itemCounts.set(key, {
                                count: 1,
                                price: item.unit_price,
                                name: item.product_name
                            });
                        }
                    });
                });

                // Crear template con items que se repiten
                const frequentItems = Array.from(itemCounts.entries())
                    .filter(([_, data]) => data.count >= 2)
                    .map(([id, data]) => ({
                        product_id: id,
                        product_name: data.name,
                        quantity: Math.round(data.count / customerOrders.length * 2),
                        unit_price: data.price
                    }));

                if (frequentItems.length > 0) {
                    generatedTemplates.push({
                        id: `template-${customerId}-${Date.now()}`,
                        name: `Pedido frecuente - ${customerOrders[0].customerName}`,
                        customer_id: customerId,
                        customer_name: customerOrders[0].customerName,
                        items: frequentItems.slice(0, 10), // Máximo 10 items
                        delivery_method: customerOrders[0].deliveryMethod || 'pickup',
                        notes: 'Generado automáticamente',
                        isFavorite: false
                    });
                }
            }
        });

        if (generatedTemplates.length > 0) {
            setTemplates(generatedTemplates);
            localStorage.setItem('order_templates', JSON.stringify(generatedTemplates));
        }
    };

    const handleDeleteTemplate = (templateId: string) => {
        const newTemplates = templates.filter(t => t.id !== templateId);
        setTemplates(newTemplates);
        localStorage.setItem('order_templates', JSON.stringify(newTemplates));
    };

    const handleToggleFavorite = (templateId: string) => {
        const newTemplates = templates.map(t =>
            t.id === templateId ? { ...t, isFavorite: !t.isFavorite } : t
        );
        setTemplates(newTemplates);
        localStorage.setItem('order_templates', JSON.stringify(newTemplates));
    };

    const handleLoadTemplate = (template: OrderTemplate) => {
        onLoadTemplate(template);
        onClose();
    };

    if (!isOpen) return null;

    // Ordenar: favoritos primero
    const sortedTemplates = [...templates].sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return 0;
    });

    return (
        <div className="order-templates-overlay">
            <div className="order-templates-modal">
                <div className="order-templates-header">
                    <h2 className="text-h2 flex items-center gap-2">
                        <Copy size={24} className="text-primary" />
                        Plantillas de Pedidos
                    </h2>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="order-templates-body">
                    {isLoading ? (
                        <div className="loading-state text-center py-12">
                            <div className="spinner" style={{
                                width: 50,
                                height: 50,
                                border: '4px solid #e5e7eb',
                                borderTopColor: '#9b51e0',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto 1rem'
                            }}></div>
                            <p className="text-muted">Cargando plantillas...</p>
                        </div>
                    ) : sortedTemplates.length === 0 ? (
                        <div className="empty-state text-center py-12">
                            <Copy size={48} className="mx-auto mb-4 opacity-20" />
                            <h3 className="text-h3 text-muted mb-2">Sin plantillas</h3>
                            <p className="text-body text-muted mb-4">
                                Las plantillas se generan automáticamente de tus pedidos frecuentes.
                            </p>
                            <p className="text-small text-muted">
                                Hacé al menos 2 pedidos similares para que aparezca una plantilla.
                            </p>
                        </div>
                    ) : (
                        <div className="templates-list">
                            {sortedTemplates.map(template => (
                                <div key={template.id} className="template-card">
                                    <div className="template-header">
                                        <div className="template-title-row">
                                            <h4 className="template-name">{template.name}</h4>
                                            <button
                                                className="btn-icon favorite-btn"
                                                onClick={() => handleToggleFavorite(template.id)}
                                            >
                                                <Star
                                                    size={20}
                                                    className={template.isFavorite ? 'text-warning fill-warning' : 'text-muted'}
                                                />
                                            </button>
                                        </div>
                                        {template.customer_name && (
                                            <p className="template-customer text-small text-muted">
                                                <Users size={14} className="inline mr-1" />
                                                {template.customer_name}
                                            </p>
                                        )}
                                    </div>

                                    <div className="template-items">
                                        <div className="items-header flex items-center gap-2 text-small text-muted mb-2">
                                            <ShoppingCart size={14} />
                                            <span>{template.items.length} productos frecuentes</span>
                                        </div>
                                        <ul className="items-list">
                                            {template.items.slice(0, 5).map((item, idx) => (
                                                <li key={idx} className="item-row text-small">
                                                    <span className="item-quantity">{item.quantity}x</span>
                                                    <span className="item-name">{item.product_name}</span>
                                                </li>
                                            ))}
                                            {template.items.length > 5 && (
                                                <li className="item-row text-small text-muted">
                                                    ... y {template.items.length - 5} productos más
                                                </li>
                                            )}
                                        </ul>
                                    </div>

                                    <div className="template-footer">
                                        <div className="template-meta">
                                            <span className="badge badge-primary">
                                                {template.delivery_method === 'delivery' ? 'Envío' : 'Retiro'}
                                            </span>
                                        </div>
                                        <div className="template-actions">
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleDeleteTemplate(template.id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleLoadTemplate(template)}
                                            >
                                                <Plus size={16} />
                                                Usar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

import { Bell, AlertCircle, CheckCircle2, Calendar, DollarSign, Package } from 'lucide-react';
import { useStore } from '../../store/useStore';
import './NotificationsPanel.css';

interface Notification {
    id: string;
    type: 'birthday' | 'debt' | 'stock' | 'order' | 'supplier';
    priority: 'high' | 'medium' | 'low';
    title: string;
    message: string;
    date: string;
    customerId?: string;
    productId?: string;
    supplierId?: string;
}

export const NotificationsPanel = () => {
    const customers = useStore(state => state.customers);
    const products = useStore(state => state.products);
    const suppliers = useStore(state => state.suppliers);

    // Generate notifications
    const notifications: Notification[] = [];

    // Helper for date difference
    const getDaysDiff = (dateStr: string) => {
        if (!dateStr) return 999;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateStr);
        target.setHours(0, 0, 0, 0);
        
        // Match only day and month for birthdays
        const nextTarget = new Date(today.getFullYear(), target.getMonth(), target.getDate());
        if (nextTarget < today) nextTarget.setFullYear(today.getFullYear() + 1);
        
        return Math.ceil((nextTarget.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Birthday/Anniversary notifications (next 7 days)
    customers.forEach(customer => {
        if (customer.birthday) {
            const daysUntil = getDaysDiff(customer.birthday);
            if (daysUntil <= 7) {
                notifications.push({
                    id: `bday-${customer.id}`,
                    type: 'birthday',
                    priority: daysUntil <= 1 ? 'high' : 'medium',
                    title: `🎂 Cumpleaños: ${customer.name}`,
                    message: daysUntil === 0 
                        ? '¡Es hoy!' 
                        : (daysUntil === 1 ? '¡Mañana!' : `Faltan ${daysUntil} días`),
                    date: new Date().toISOString(),
                    customerId: customer.id
                });
            }
        }

        if (customer.anniversary) {
            const daysUntil = getDaysDiff(customer.anniversary);
            if (daysUntil <= 7) {
                notifications.push({
                    id: `anniv-${customer.id}`,
                    type: 'birthday',
                    priority: daysUntil <= 1 ? 'high' : 'medium',
                    title: `💍 Aniversario: ${customer.name}`,
                    message: daysUntil === 0 
                        ? '¡Es hoy!' 
                        : (daysUntil === 1 ? '¡Mañana!' : `Faltan ${daysUntil} días`),
                    date: new Date().toISOString(),
                    customerId: customer.id
                });
            }
        }
    });

    // Supplier Visit notifications (next 3 days)
    suppliers.forEach(supplier => {
        // En useStore.ts se mapea api.next_visit_date a supplier.lastVisit (confuso, pero así está hoy)
        if (supplier.lastVisit) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const visitDate = new Date(supplier.lastVisit);
            visitDate.setHours(0, 0, 0, 0);
            
            const diffTime = visitDate.getTime() - today.getTime();
            const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysUntil >= 0 && daysUntil <= 3) {
                notifications.push({
                    id: `supp-${supplier.id}`,
                    type: 'supplier',
                    priority: daysUntil <= 1 ? 'high' : 'medium',
                    title: `🚚 Visita: ${supplier.name}`,
                    message: daysUntil === 0 
                        ? 'Viene hoy' 
                        : (daysUntil === 1 ? 'Viene mañana' : `Viene en ${daysUntil} días`),
                    date: new Date().toISOString(),
                    supplierId: supplier.id
                });
            }
        }
    });

    // Debt notifications
    customers.forEach(customer => {
        if (customer.debtBalance > 0) {
            notifications.push({
                id: `debt-${customer.id}`,
                type: 'debt',
                priority: customer.debtBalance > 50000 ? 'high' : 'medium',
                title: `💰 Deuda: ${customer.name}`,
                message: `Debe $${customer.debtBalance.toLocaleString()}`,
                date: new Date().toISOString(),
                customerId: customer.id
            });
        }
    });

    // Stock alerts
    products.forEach(product => {
        if (product.stock <= product.min) {
            notifications.push({
                id: `stock-${product.id}`,
                type: 'stock',
                priority: product.stock === 0 ? 'high' : 'medium',
                title: `📦 Stock Bajo: ${product.name}`,
                message: product.stock === 0 
                    ? '¡Sin stock!' 
                    : `Quedan ${product.stock} (Mínimo: ${product.min})`,
                date: new Date().toISOString(),
                productId: product.id
            });
        }
    });

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    notifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'birthday': return <Calendar size={20} />;
            case 'supplier': return <Package size={20} />;
            case 'debt': return <DollarSign size={20} />;
            case 'stock': return <Package size={20} />;
            case 'order': return <CheckCircle2 size={20} />;
            default: return <AlertCircle size={20} />;
        }
    };

    const getNotificationClass = (type: string, priority: string) => {
        const baseClass = `notification-item ${priority}`;
        return `${baseClass} ${type}`;
    };

    return (
        <div className="notifications-panel">
            <div className="notifications-header">
                <div className="flex items-center gap-2">
                    <Bell size={24} className="text-primary" />
                    <h2 className="text-h2">Centro de Notificaciones</h2>
                </div>
                <span className="notification-count">{notifications.length}</span>
            </div>

            {notifications.length === 0 ? (
                <div className="empty-notifications">
                    <CheckCircle2 size={48} className="text-success opacity-20" />
                    <h3 className="text-h3">¡Todo en orden!</h3>
                    <p className="text-muted">No hay notificaciones pendientes</p>
                </div>
            ) : (
                <div className="notifications-list">
                    {notifications.map(notification => (
                        <div key={notification.id} className={getNotificationClass(notification.type, notification.priority)}>
                            <div className="notification-icon">
                                {getNotificationIcon(notification.type)}
                            </div>
                            <div className="notification-content">
                                <h4 className="notification-title">{notification.title}</h4>
                                <p className="notification-message">{notification.message}</p>
                                <span className="notification-date">
                                    {new Date(notification.date).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="notification-priority">
                                {notification.priority === 'high' && (
                                    <span className="priority-badge high">!</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {notifications.length > 0 && (
                <div className="notifications-summary">
                    <div className="summary-item">
                        <Calendar size={16} />
                        <span>{notifications.filter(n => n.type === 'birthday').length} Fechas</span>
                    </div>
                    <div className="summary-item">
                        <DollarSign size={16} />
                        <span>{notifications.filter(n => n.type === 'debt').length} Deudas</span>
                    </div>
                    <div className="summary-item">
                        <Package size={16} />
                        <span>{notifications.filter(n => n.type === 'stock').length} Stock</span>
                    </div>
                </div>
            )}
        </div>
    );
};

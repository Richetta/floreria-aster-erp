import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../Sidebar/Sidebar';
import { MobileBottomNav } from '../MobileBottomNav/MobileBottomNav';
import { NotificationsPanel } from '../Notifications/NotificationsPanel';
import { TrialBanner } from '../Subscription/UsageWarning';
import { useSubscription } from '../../store/useSubscription';
import { useStore } from '../../store/useStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { X } from 'lucide-react';
import '../../styles/mobile-compact-overrides.css';
import './Layout.css';

export const Layout = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const location = useLocation();
    const { status, trialEndsAt, planName, showUpgradeModal } = useSubscription();

    const customers = useStore(state => state.customers);
    const products = useStore(state => state.products);
    const suppliers = useStore(state => state.suppliers);
    const markNotificationsAsSeen = useStore(state => state.markNotificationsAsSeen);
    const loadShopInfo = useStore(state => state.loadShopInfo);

    // Load shop info on mount
    useEffect(() => {
        loadShopInfo();
    }, [loadShopInfo]);

    // Close overlays on route change (mobile)
    useEffect(() => {
        setIsSidebarOpen(false);
        setIsNotificationsOpen(false);
    }, [location.pathname]);

    const handleOpenNotifications = () => {
        setIsNotificationsOpen(true);
        // Calculamos el count actual para marcarlo como visto
        let count = 0;
        const getDaysDiff = (dateStr: string) => {
            if (!dateStr) return 999;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
            const nextTarget = new Date(today.getFullYear(), target.getMonth(), target.getDate());
            if (nextTarget < today) nextTarget.setFullYear(today.getFullYear() + 1);
            return Math.ceil((nextTarget.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        };
        customers.forEach(c => {
            if (c.birthday && getDaysDiff(c.birthday) <= 7) count++;
            if (c.anniversary && getDaysDiff(c.anniversary) <= 7) count++;
            if (c.debtBalance > 0) count++;
        });
        products.forEach(p => { if (p.stock <= p.min) count++; });
        suppliers.forEach(s => {
            if (s.lastVisit) {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const visitDate = new Date(s.lastVisit); visitDate.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((visitDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntil >= 0 && daysUntil <= 3) count++;
            }
        });
        markNotificationsAsSeen(count);
    };

    // Escuchar evento custom para abrir notificaciones desde DashboardMobile
    useEffect(() => {
        const handleOpen = () => handleOpenNotifications();
        window.addEventListener('open-notifications', handleOpen);
        return () => window.removeEventListener('open-notifications', handleOpen);
    }, [handleOpenNotifications]);

    // Close sidebar on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsSidebarOpen(false);
                setIsNotificationsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);


    return (
        <div className="app-container">
            {/* Panel de Notificaciones Desplegable (botón movido al Dashboard) */}
            {isMobile && (location.pathname === '/' || location.pathname === '/dashboard') && (
                <>
                    <div className={`global-notifications-overlay ${isNotificationsOpen ? 'open' : ''}`}>
                        <div className="notifications-overlay-header">
                            <h3>Notificaciones</h3>
                            <button className="close-notif-btn" onClick={() => setIsNotificationsOpen(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="notifications-overlay-body">
                            <NotificationsPanel />
                        </div>
                    </div>
                </>
            )}

            {/* Sidebar Desktop y Mobile */}
            <aside className={`sidebar-container ${isSidebarOpen ? 'open' : ''}`}>
                <Sidebar onClose={() => setIsSidebarOpen(false)} />
            </aside>

            {/* Overlay para cerrar sidebar en mobile */}
            {isSidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <main className={`main-content ${location.pathname === '/pos' ? 'pos-page' : ''}`}>
                <div className="page-container">
                    {/* Trial / Cancellation banner */}
                    {status === 'trial' && trialEndsAt && (
                        <TrialBanner
                            trialEndsAt={trialEndsAt}
                            planName={planName}
                            onUpgradeClick={() => showUpgradeModal('Actualizá tu plan para mantener todas las funciones activas.')}
                        />
                    )}
                    <Outlet />
                </div>
            </main>

            {/* Navegación Inferior - Solo visible en mobile (excepto en POS) */}
            {isMobile && location.pathname !== '/pos' && <MobileBottomNav />}
        </div>
    );
};

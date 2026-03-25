import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from '../Sidebar/Sidebar';
import { BottomNav } from '../BottomNav/BottomNav';
import { useStore } from '../../store/useStore';
import './Layout.css';

export const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const loadShopInfo = useStore(state => state.loadShopInfo);

    // Load shop info on mount
    useEffect(() => {
        loadShopInfo();
    }, [loadShopInfo]);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Close sidebar on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsSidebarOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const isPosPage = location.pathname === '/pos';

    return (
        <div className="app-container">
            {/* Mobile Header with Hamburger */}
            <header className="mobile-header">
                <button
                    className="hamburger-btn"
                    onClick={() => setIsSidebarOpen(true)}
                    aria-label="Abrir menú"
                >
                    <Menu size={24} />
                </button>
                <span className="mobile-brand">
                    <span className="mobile-brand-icon">✿</span>
                    Aster
                </span>
            </header>

            {/* Sidebar Overlay (mobile) */}
            {isSidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <main className={`main-content ${isPosPage ? 'pos-page' : ''}`}>
                <div className="page-container">
                    <Outlet />
                </div>
            </main>

            {/* Bottom Navigation (mobile only) */}
            <BottomNav />
        </div>
    );
};

import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from '../Sidebar/Sidebar';
import { BottomNav } from '../BottomNav/BottomNav';
import { useStore } from '../../store/useStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import './Layout.css';

export const Layout = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
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


    return (
        <div className="app-container">
            {/* Header móvil - Solo visible en < 768px */}
            {isMobile && (
                <header className="mobile-header">
                    <button 
                        className="hamburger-btn"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu size={24} />
                    </button>
                    <div className="mobile-brand">
                        <span className="mobile-brand-icon">🌸</span>
                        <span>Aster</span>
                    </div>
                </header>
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
                    <Outlet />
                </div>
            </main>

            {/* Navegación Inferior - Solo visible en mobile */}
            {isMobile && <BottomNav />}
        </div>
    );
};

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { Toaster } from './components/Toaster/Toaster';
import { Layout } from './components/Layout/Layout';
import { Login } from './pages/Login/Login';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Products } from './pages/Products/Products';
import { Packages } from './pages/Packages/Packages';
import { Orders } from './pages/Orders/Orders';
import { POS } from './pages/POS/POS';
import { Customers } from './pages/Customers/Customers';
import { Suppliers } from './pages/Suppliers/Suppliers';
import { Waste } from './pages/Waste/Waste';
import { Logistics } from './pages/Logistics/Logistics';
import { Menu } from './pages/Menu/Menu';
import { Settings } from './pages/Settings/Settings';
import { Finances } from './pages/Finances/Finances';
import { Sales } from './pages/Sales/Sales';
import { Purchases } from './pages/Purchases/Purchases';
import { Reports } from './pages/Reports/Reports';
import { CashRegister } from './pages/CashRegister/CashRegister';
import { StockMovements } from './pages/StockMovements/StockMovements';
import { Reminders } from './pages/Reminders/Reminders';
import { useAuth } from './store/useAuth';

// ============================================
// PROTECTED ROUTE COMPONENT
// ============================================

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="loading-content">
                    <div className="loading-spinner-large">
                        <div className="spinner"></div>
                    </div>
                    <p className="loading-text">Cargando Florería Aster...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};

// ============================================
// PUBLIC ROUTE COMPONENT (redirect if authenticated)
// ============================================

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="loading-content">
                    <div className="loading-spinner-large">
                        <div className="spinner"></div>
                    </div>
                    <p className="loading-text">Cargando...</p>
                </div>
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

// ============================================
// MAIN APP
// ============================================

function App() {
    const { checkAuth } = useAuth();

    useEffect(() => {
        checkAuth();
    }, []);

    return (
        <ErrorBoundary>
            <Toaster />
            <BrowserRouter>
                <Routes>
                    {/* Public Routes */}
                    <Route
                        path="/login"
                        element={
                            <PublicRoute>
                                <Login />
                            </PublicRoute>
                        }
                    />

                    {/* Protected Routes */}
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <Layout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<Dashboard />} />
                        <Route path="pos" element={<POS />} />
                        <Route path="ventas" element={<Sales />} />
                        <Route path="pedidos" element={<Orders />} />
                        <Route path="productos" element={<Products />} />
                        <Route path="paquetes" element={<Packages />} />
                        <Route path="clientes" element={<Customers />} />
                        <Route path="proveedores" element={<Suppliers />} />
                        <Route path="mermas" element={<Waste />} />
                        <Route path="logistica" element={<Logistics />} />
                        <Route path="compras" element={<Purchases />} />
                        <Route path="menu" element={<Menu />} />
                        <Route path="finanzas" element={<Finances />} />
                        <Route path="reportes" element={<Reports />} />
                        <Route path="caja" element={<CashRegister />} />
                        <Route path="stock" element={<StockMovements />} />
                        <Route path="recordatorios" element={<Reminders />} />
                        <Route path="configuracion" element={<Settings />} />
                    </Route>

                    {/* 404 Route */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

export default App;

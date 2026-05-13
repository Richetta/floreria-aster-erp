import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SubscriptionProvider, FeatureRouteGuard } from './store/useSubscription';
import { UpgradeModal } from './components/Subscription/UpgradeModal';
import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { Toaster } from './components/Toaster/Toaster';
import { Layout } from './components/Layout/Layout';
import { Login } from './pages/Login/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Packages } from './pages/Packages';
import { Orders } from './pages/Orders';
import { POS } from './pages/POS';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { Waste } from './pages/Waste';
import { Logistics } from './pages/Logistics';
import { Menu } from './pages/Menu/Menu';
import { Settings } from './pages/Settings';
import { Finances } from './pages/Finances';
import { Sales } from './pages/Sales';
import { Purchases } from './pages/Purchases';
import { Reports } from './pages/Reports';
import { CashRegister } from './pages/CashRegister';
import { StockMovements } from './pages/StockMovements';
import Restock from './pages/Restock';
import { Reminders } from './pages/Reminders';
import { CalendarDesktop } from './pages/Calendar';
import { ToolsHub } from './pages/Tools';
import { BarcodePrinter } from './pages/Tools/BarcodePrinter';
import { useAuth } from './store/useAuth';
import { SubscriptionSuccess, SubscriptionFailure, SubscriptionPending } from './pages/Subscription/SubscriptionResult';

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
                    <p className="loading-text">Cargando Florería Mi Jardín...</p>
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
            <SubscriptionProvider>
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

                    {/* Subscription Result Pages — public so MP can redirect here */}
                    <Route path="/suscripcion/exito" element={<SubscriptionSuccess />} />
                    <Route path="/suscripcion/error" element={<SubscriptionFailure />} />
                    <Route path="/suscripcion/pendiente" element={<SubscriptionPending />} />

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
                        <Route 
                            path="paquetes" 
                            element={<FeatureRouteGuard feature="packages"><Packages /></FeatureRouteGuard>} 
                        />
                        <Route path="clientes" element={<Customers />} />
                        <Route path="proveedores" element={<Suppliers />} />
                        <Route 
                            path="mermas" 
                            element={<FeatureRouteGuard feature="waste"><Waste /></FeatureRouteGuard>} 
                        />
                        <Route 
                            path="logistica" 
                            element={<FeatureRouteGuard feature="logistics"><Logistics /></FeatureRouteGuard>} 
                        />
                        <Route 
                            path="compras" 
                            element={<FeatureRouteGuard feature="purchases"><Purchases /></FeatureRouteGuard>} 
                        />
                        <Route path="menu" element={<Menu />} />
                        <Route path="finanzas" element={<Finances />} />
                        <Route 
                            path="reportes" 
                            element={<FeatureRouteGuard feature="reports"><Reports /></FeatureRouteGuard>} 
                        />
                        <Route 
                            path="caja" 
                            element={<FeatureRouteGuard feature="cashRegister"><CashRegister /></FeatureRouteGuard>} 
                        />
                        <Route 
                            path="stock" 
                            element={<FeatureRouteGuard feature="stockMovements"><StockMovements /></FeatureRouteGuard>} 
                        />
                        <Route 
                            path="reposicion" 
                            element={<FeatureRouteGuard feature="restock"><Restock /></FeatureRouteGuard>} 
                        />
                        <Route 
                            path="recordatorios" 
                            element={<FeatureRouteGuard feature="reminders"><Reminders /></FeatureRouteGuard>} 
                        />
                        <Route 
                            path="calendario" 
                            element={<FeatureRouteGuard feature="calendar"><CalendarDesktop /></FeatureRouteGuard>} 
                        />
                        <Route path="configuracion" element={<Settings />} />
                        <Route path="herramientas" element={<ToolsHub />} />
                        <Route path="herramientas/codigos" element={<BarcodePrinter />} />
                    </Route>

                    {/* 404 Route */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <UpgradeModal />
            </SubscriptionProvider>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

export default App;

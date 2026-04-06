import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import './StockMovementsMobile.css';

type MovementType = 'sale' | 'order' | 'purchase' | 'adjustment' | 'waste' | 'return' | 'transfer';

export const StockMovementsMobile = () => {
    const [movements, setMovements] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filters, setFilters] = useState({
        product_id: '',
        from_date: '',
        to_date: '',
        type: ''
    });
    const [stockSummary, setStockSummary] = useState<any>(null);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        loadMovements();
        loadSummary();
    }, []);

    const loadMovements = async () => {
        setIsLoading(true);
        try {
            const params: any = { limit: 100 };
            if (filters.product_id) params.product_id = filters.product_id;
            if (filters.from_date) params.from_date = filters.from_date;
            if (filters.to_date) params.to_date = filters.to_date;
            if (filters.type) params.type = filters.type;

            const data = await api.getStockMovements(params);
            setMovements(data);
        } catch (error) {
            console.error('Error loading movements:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadSummary = async () => {
        try {
            const summary = await api.getStockSummary();
            setStockSummary(summary);
        } catch (error) {
            console.error('Error loading summary:', error);
        }
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleApplyFilters = () => {
        loadMovements();
        setShowFilters(false);
    };

    const handleClearFilters = () => {
        setFilters({ product_id: '', from_date: '', to_date: '', type: '' });
        loadMovements();
    };

    const getMovementTypeLabel = (type: MovementType) => {
        const labels: Record<MovementType, string> = {
            sale: 'Venta', order: 'Pedido', purchase: 'Compra',
            adjustment: 'Ajuste', waste: 'Merma', return: 'Devolución', transfer: 'Transferencia'
        };
        return labels[type] || type;
    };

    const getMovementTypeIcon = (type: MovementType) => {
        if (['sale', 'order', 'waste'].includes(type)) return 'trending_down';
        return 'trending_up';
    };

    const getMovementTypeColor = (type: MovementType) => {
        if (['sale', 'order', 'waste'].includes(type)) return '#ef4444';
        return '#22c55e';
    };

    return (
        <div className="stock-mobile-wrapper">
            <header className="stock-mobile-header">
                <h2>Stock</h2>
                <button
                    className={`icon-btn-ghost ${showFilters ? 'active' : ''}`}
                    onClick={() => setShowFilters(!showFilters)}
                >
                    <span className="material-symbols-rounded">filter_list</span>
                </button>
            </header>

            {/* Summary Cards */}
            {stockSummary && (
                <div className="stock-metrics-row">
                    <div className="stock-metric-card">
                        <span className="material-symbols-rounded icon-package">inventory</span>
                        <div className="metric-value">{stockSummary.total_products}</div>
                        <div className="metric-label">Productos</div>
                    </div>
                    <div className="stock-metric-card">
                        <span className="material-symbols-rounded icon-stock">package</span>
                        <div className="metric-value">{stockSummary.total_stock}</div>
                        <div className="metric-label">Unidades</div>
                    </div>
                    <div className="stock-metric-card warning">
                        <span className="material-symbols-rounded">warning</span>
                        <div className="metric-value">{stockSummary.low_stock_count}</div>
                        <div className="metric-label">Stock Bajo</div>
                    </div>
                    <div className="stock-metric-card danger">
                        <span className="material-symbols-rounded">error</span>
                        <div className="metric-value">{stockSummary.out_of_stock_count}</div>
                        <div className="metric-label">Sin Stock</div>
                    </div>
                </div>
            )}

            {/* Filters Panel */}
            {showFilters && (
                <div className="stock-filters-panel">
                    <div className="filter-group">
                        <label>Tipo</label>
                        <select
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                        >
                            <option value="">Todos</option>
                            <option value="sale">Ventas</option>
                            <option value="purchase">Compras</option>
                            <option value="adjustment">Ajustes</option>
                            <option value="waste">Mermas</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Desde</label>
                        <input
                            type="date"
                            value={filters.from_date}
                            onChange={(e) => handleFilterChange('from_date', e.target.value)}
                        />
                    </div>
                    <div className="filter-group">
                        <label>Hasta</label>
                        <input
                            type="date"
                            value={filters.to_date}
                            onChange={(e) => handleFilterChange('to_date', e.target.value)}
                        />
                    </div>
                    <div className="filter-actions">
                        <button className="btn-apply" onClick={handleApplyFilters}>Aplicar</button>
                        <button className="btn-clear" onClick={handleClearFilters}>Limpiar</button>
                    </div>
                </div>
            )}

            {/* Movements Timeline */}
            <div className="stock-movements-content">
                {isLoading ? (
                    <div className="stock-loading">
                        <div className="spinner-stock"></div>
                        <p>Cargando...</p>
                    </div>
                ) : movements.length === 0 ? (
                    <div className="stock-empty">
                        <span className="material-symbols-rounded">inventory_2</span>
                        <h3>Sin movimientos</h3>
                        <p>No hay movimientos con estos filtros</p>
                    </div>
                ) : (
                    <div className="movements-timeline">
                        {movements.map(m => (
                            <div key={m.id} className="movement-item">
                                <div className="movement-icon" style={{ background: `${getMovementTypeColor(m.movement_type)}15` }}>
                                    <span className="material-symbols-rounded" style={{ color: getMovementTypeColor(m.movement_type) }}>
                                        {getMovementTypeIcon(m.movement_type)}
                                    </span>
                                </div>
                                <div className="movement-body">
                                    <div className="movement-top">
                                        <div className="movement-product">{m.product_name}</div>
                                        <div className={`movement-qty ${m.quantity > 0 ? 'positive' : 'negative'}`}>
                                            {m.quantity > 0 ? '+' : ''}{m.quantity}
                                        </div>
                                    </div>
                                    <div className="movement-bottom">
                                        <span className="movement-type-badge" style={{ background: `${getMovementTypeColor(m.movement_type)}15`, color: getMovementTypeColor(m.movement_type) }}>
                                            {getMovementTypeLabel(m.movement_type)}
                                        </span>
                                        <span className="movement-date">
                                            {new Date(m.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

import { useState, useEffect } from 'react';
import {
    Package,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Filter,
    Download,
    Search
} from 'lucide-react';
import { api } from '../../services/api';
import './StockMovements.css';

type MovementType = 'sale' | 'order' | 'purchase' | 'adjustment' | 'waste' | 'return' | 'transfer';

export const StockMovements = () => {
    const [movements, setMovements] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filters, setFilters] = useState({
        product_id: '',
        from_date: '',
        to_date: '',
        type: ''
    });
    const [stockSummary, setStockSummary] = useState<any>(null);

    // Load movements
    useEffect(() => {
        loadMovements();
        loadSummary();
    }, []);

    const loadMovements = async () => {
        setIsLoading(true);
        try {
            const params: any = { limit: 200 };
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
    };

    const handleClearFilters = () => {
        setFilters({
            product_id: '',
            from_date: '',
            to_date: '',
            type: ''
        });
        loadMovements();
    };

    const handleExport = () => {
        const csv = [
            ['Fecha', 'Producto', 'Código', 'Tipo', 'Cantidad', 'Stock Después', 'Notas'].join(','),
            ...movements.map(m => [
                new Date(m.created_at).toLocaleDateString('es-AR'),
                `"${m.product_name}"`,
                m.product_code,
                getMovementTypeLabel(m.movement_type),
                m.quantity,
                m.balance_after,
                `"${m.notes || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `movimientos_stock_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const getMovementTypeLabel = (type: MovementType) => {
        const labels: Record<MovementType, string> = {
            sale: 'Venta',
            order: 'Pedido',
            purchase: 'Compra',
            adjustment: 'Ajuste',
            waste: 'Merma',
            return: 'Devolución',
            transfer: 'Transferencia'
        };
        return labels[type] || type;
    };

    const getMovementTypeIcon = (type: MovementType) => {
        if (type === 'sale' || type === 'order' || type === 'waste') {
            return <TrendingDown size={16} className="text-danger" />;
        }
        return <TrendingUp size={16} className="text-success" />;
    };

    const getMovementTypeClass = (type: MovementType) => {
        if (type === 'sale' || type === 'order' || type === 'waste') {
            return 'badge-danger';
        }
        return 'badge-success';
    };

    return (
        <div className="stock-movements-page">
            <header className="page-header mb-6">
                <div>
                    <h1 className="text-h1">Movimientos de Stock</h1>
                    <p className="text-body mt-2">Historial completo de entradas y salidas de productos</p>
                </div>
                <button className="btn btn-secondary" onClick={handleExport}>
                    <Download size={20} />
                    Exportar
                </button>
            </header>

            {/* Summary Cards */}
            {stockSummary && (
                <div className="metrics-grid mb-6">
                    <div className="metric-card">
                        <div className="metric-icon bg-primary-light">
                            <Package size={24} className="text-primary" />
                        </div>
                        <div className="metric-data">
                            <span className="text-small text-muted">Total Productos</span>
                            <h2 className="text-h2">{stockSummary.total_products}</h2>
                        </div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-icon bg-success-light">
                            <TrendingUp size={24} className="text-success" />
                        </div>
                        <div className="metric-data">
                            <span className="text-small text-muted">Stock Total</span>
                            <h2 className="text-h2">{stockSummary.total_stock} unid.</h2>
                        </div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-icon bg-warning-light">
                            <AlertCircle size={24} className="text-warning" />
                        </div>
                        <div className="metric-data">
                            <span className="text-small text-muted">Stock Bajo</span>
                            <h2 className="text-h2 text-warning">{stockSummary.low_stock_count}</h2>
                        </div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-icon bg-danger-light">
                            <AlertCircle size={24} className="text-danger" />
                        </div>
                        <div className="metric-data">
                            <span className="text-small text-muted">Sin Stock</span>
                            <h2 className="text-h2 text-danger">{stockSummary.out_of_stock_count}</h2>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="card mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={20} className="text-primary" />
                    <h3 className="text-h3">Filtros</h3>
                </div>

                <div className="filters-grid">
                    <div className="form-group">
                        <label className="form-label">Tipo de Movimiento</label>
                        <select
                            className="form-input"
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                        >
                            <option value="">Todos</option>
                            <option value="sale">Ventas</option>
                            <option value="purchase">Compras</option>
                            <option value="adjustment">Ajustes</option>
                            <option value="waste">Mermas</option>
                            <option value="return">Devoluciones</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Desde</label>
                        <input
                            type="date"
                            className="form-input"
                            value={filters.from_date}
                            onChange={(e) => handleFilterChange('from_date', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Hasta</label>
                        <input
                            type="date"
                            className="form-input"
                            value={filters.to_date}
                            onChange={(e) => handleFilterChange('to_date', e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Buscar Producto</label>
                        <div className="search-input-wrapper">
                            <Search size={18} className="text-muted" />
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Nombre o código..."
                                value={filters.product_id}
                                onChange={(e) => handleFilterChange('product_id', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-4">
                    <button className="btn btn-primary" onClick={handleApplyFilters}>
                        Aplicar Filtros
                    </button>
                    <button className="btn btn-secondary" onClick={handleClearFilters}>
                        Limpiar
                    </button>
                </div>
            </div>

            {/* Movements Table */}
            <div className="card">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-h3">Historial de Movimientos</h3>
                    <span className="text-small text-muted">
                        {movements.length} movimientos
                    </span>
                </div>

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
                        <p className="text-muted">Cargando movimientos...</p>
                    </div>
                ) : movements.length === 0 ? (
                    <div className="empty-state text-center py-12">
                        <Package size={48} className="mx-auto mb-4 opacity-20" />
                        <h3 className="text-h3 text-muted mb-2">Sin movimientos</h3>
                        <p className="text-body text-muted">No hay movimientos que mostrar con los filtros actuales.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Fecha/Hora</th>
                                    <th>Producto</th>
                                    <th>Código</th>
                                    <th>Tipo</th>
                                    <th className="text-right">Cantidad</th>
                                    <th className="text-right">Stock Después</th>
                                    <th>Notas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.map(movement => (
                                    <tr key={movement.id}>
                                        <td className="text-micro">
                                            {new Date(movement.created_at).toLocaleDateString('es-AR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="font-medium">{movement.product_name}</td>
                                        <td className="text-muted font-mono text-small">{movement.product_code}</td>
                                        <td>
                                            <span className={`badge ${getMovementTypeClass(movement.movement_type)}`}>
                                                {getMovementTypeIcon(movement.movement_type)}
                                                <span className="ml-1">{getMovementTypeLabel(movement.movement_type)}</span>
                                            </span>
                                        </td>
                                        <td className={`text-right font-bold ${
                                            movement.quantity > 0 ? 'text-success' : 'text-danger'
                                        }`}>
                                            {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                                        </td>
                                        <td className="text-right font-medium">{movement.balance_after}</td>
                                        <td className="text-muted text-small">
                                            {movement.notes || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

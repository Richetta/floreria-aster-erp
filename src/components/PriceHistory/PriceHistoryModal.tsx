import { useState, useMemo, useEffect } from 'react';
import { History, TrendingUp, TrendingDown, X, Calendar, Loader2 } from 'lucide-react';
import { 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    LineChart,
    Line
} from 'recharts';
import { useStore } from '../../store/useStore';
import './PriceHistoryModal.css';

interface PriceHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    productId?: string;
}

interface PriceChange {
    id: string;
    productId: string;
    productName: string;
    oldCost?: number;
    oldPrice?: number;
    newCost: number;
    newPrice: number;
    changedBy?: string;
    reason?: string;
    date: string;
}

export const PriceHistoryModal = ({ isOpen, onClose, productId }: PriceHistoryModalProps) => {
    const products = useStore(state => state.products);

    const [selectedProduct, setSelectedProduct] = useState<string>(productId || 'all');
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const getPriceHistory = useStore(state => state.getPriceHistory);

    useEffect(() => {
        if (!isOpen) return;

        const loadHistory = async () => {
            if (selectedProduct === 'all') {
                setHistoryData([]); 
                return;
            }
            setIsLoading(true);
            try {
                const data = await getPriceHistory(selectedProduct);
                setHistoryData(data);
            } finally {
                setIsLoading(false);
            }
        };
        loadHistory();
    }, [isOpen, selectedProduct, getPriceHistory]);

    // Format price history from API data
    const priceHistory: PriceChange[] = useMemo(() => {
        return historyData
            .map(item => ({
                id: item.id,
                productId: item.product_id,
                productName: products.find(p => p.id === item.product_id)?.name || 'Producto',
                oldPrice: item.old_price,
                newPrice: item.new_price,
                oldCost: item.old_cost,
                newCost: item.new_cost,
                date: item.created_at,
                reason: item.reason || 'Actualización manual'
            }))
            .filter(item => {
                const itemDate = new Date(item.date);
                const today = new Date();
                
                if (dateRange === '7d') {
                    return (today.getTime() - itemDate.getTime()) <= (7 * 24 * 60 * 60 * 1000);
                } else if (dateRange === '30d') {
                    return (today.getTime() - itemDate.getTime()) <= (30 * 24 * 60 * 60 * 1000);
                } else if (dateRange === '90d') {
                    return (today.getTime() - itemDate.getTime()) <= (90 * 24 * 60 * 60 * 1000);
                }
                
                return true;
            })
    }, [historyData, products, dateRange]);

    const chartData = useMemo(() => {
        return [...priceHistory]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(item => ({
                date: new Date(item.date).toLocaleDateString(),
                precio: item.newPrice,
                costo: item.newCost
            }));
    }, [priceHistory]);

    const productsList = useMemo(() => {
        return products;
    }, [products]);

    const totalIncreases = priceHistory.filter(h => h.newPrice > h.oldPrice!).length;
    const totalDecreases = priceHistory.filter(h => h.newPrice < h.oldPrice!).length;

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="price-history-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="flex items-center gap-2">
                        <History size={24} className="text-primary" />
                        <h2 className="text-h2">Historial de Precios</h2>
                    </div>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-filters">
                    <div className="filter-group">
                        <label className="filter-label">Producto:</label>
                        <select
                            className="form-input"
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                        >
                            <option value="all">Todos los productos</option>
                            {productsList.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label className="filter-label">Período:</label>
                        <div className="date-range-selector">
                            <button
                                className={`range-btn ${dateRange === '7d' ? 'active' : ''}`}
                                onClick={() => setDateRange('7d')}
                            >
                                7 días
                            </button>
                            <button
                                className={`range-btn ${dateRange === '30d' ? 'active' : ''}`}
                                onClick={() => setDateRange('30d')}
                            >
                                30 días
                            </button>
                            <button
                                className={`range-btn ${dateRange === '90d' ? 'active' : ''}`}
                                onClick={() => setDateRange('90d')}
                            >
                                90 días
                            </button>
                            <button
                                className={`range-btn ${dateRange === 'all' ? 'active' : ''}`}
                                onClick={() => setDateRange('all')}
                            >
                                Todo
                            </button>
                        </div>
                    </div>
                </div>

                <div className="history-summary">
                    <div className="summary-card">
                        <TrendingUp size={20} className="text-success" />
                        <div>
                            <span className="summary-value">{totalIncreases}</span>
                            <span className="summary-label">Aumentos</span>
                        </div>
                    </div>
                    <div className="summary-card">
                        <TrendingDown size={20} className="text-danger" />
                        <div>
                            <span className="summary-value">{totalDecreases}</span>
                            <span className="summary-label">Disminuciones</span>
                        </div>
                    </div>
                    <div className="summary-card">
                        <Calendar size={20} className="text-primary" />
                        <div>
                            <span className="summary-value">{priceHistory.length}</span>
                            <span className="summary-label">Cambios Totales</span>
                        </div>
                    </div>
                </div>

                {selectedProduct !== 'all' && priceHistory.length > 0 && (
                    <div className="chart-container mb-6 bg-surface p-4 rounded-xl border border-border" style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis 
                                    dataKey="date" 
                                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis 
                                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(val) => `$${val}`}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'var(--card-bg)', 
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="precio" 
                                    stroke="var(--primary)" 
                                    strokeWidth={3} 
                                    dot={{ r: 4, fill: 'var(--primary)' }}
                                    name="Precio"
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="costo" 
                                    stroke="var(--success)" 
                                    strokeWidth={2} 
                                    strokeDasharray="5 5"
                                    dot={{ r: 3, fill: 'var(--success)' }}
                                    name="Costo"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                <div className="history-table-container">
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Producto</th>
                                <th>Precio Anterior</th>
                                <th>Precio Nuevo</th>
                                <th>Cambio</th>
                                <th>Motivo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12">
                                        <Loader2 size={48} className="animate-spin text-primary mx-auto" />
                                        <p className="mt-4 text-muted">Cargando historial...</p>
                                    </td>
                                </tr>
                            ) : priceHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="empty-state">
                                        <History size={48} className="opacity-20" />
                                        <p>No hay cambios de precio en este período</p>
                                    </td>
                                </tr>
                            ) : (
                                priceHistory.map((item, idx) => (
                                    <tr key={item.id} className={idx % 2 === 0 ? 'even' : 'odd'}>
                                        <td>
                                            <div className="date-cell">
                                                <Calendar size={14} />
                                                <span>{new Date(item.date).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="product-name">{item.productName}</td>
                                        <td className="old-price">
                                            ${item.oldPrice?.toLocaleString() || 'N/A'}
                                        </td>
                                        <td className="new-price">
                                            ${item.newPrice.toLocaleString()}
                                        </td>
                                        <td>
                                            <span className={`change-badge ${item.newPrice > item.oldPrice! ? 'increase' : 'decrease'}`}>
                                                {item.newPrice > item.oldPrice! ? (
                                                    <TrendingUp size={14} />
                                                ) : (
                                                    <TrendingDown size={14} />
                                                )}
                                                {((item.newPrice - item.oldPrice!) / item.oldPrice! * 100).toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="reason">{item.reason || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { WasteBuilderModal } from '../../components/WasteBuilder/WasteBuilderModal';
import { useModal } from '../../hooks/useModal';
import './WasteMobile.css';

const isThisWeek = (date: Date) => {
    const today = new Date();
    const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
    return date >= firstDay;
};

const isThisMonth = (date: Date) => {
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

export const WasteMobile = () => {
    const products = useStore(state => state.products);
    const transactions = useStore(state => state.transactions);
    const loadProducts = useStore(state => state.loadProducts);
    const loadTransactions = useStore(state => state.loadTransactions);

    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'week'>('month');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { showAlert } = useModal();

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([loadProducts(), loadTransactions()]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const rawWasteHistory = useMemo(() =>
        (transactions || []).filter(t => t.category === 'Merma').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        [transactions]
    );

    const dateFilteredHistory = useMemo(() => {
        return (rawWasteHistory || []).filter(h => {
            const d = new Date(h.date);
            if (dateFilter === 'week') return isThisWeek(d);
            if (dateFilter === 'month') return isThisMonth(d);
            return true;
        });
    }, [rawWasteHistory, dateFilter]);

    const filteredHistory = useMemo(() => {
        return (dateFilteredHistory || []).filter(h =>
            h.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [dateFilteredHistory, searchTerm]);

    const totalLossValue = useMemo(() =>
        (dateFilteredHistory || []).reduce((sum, t) => sum + t.amount, 0),
        [dateFilteredHistory]
    );

    const chartData = useMemo(() => {
        const grouped = (dateFilteredHistory || []).reduce((acc: any, t) => {
            const dateObj = new Date(t.date);
            const dayKey = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
            if (!acc[dayKey]) acc[dayKey] = { date: dayKey, total: 0 };
            acc[dayKey].total += t.amount;
            return acc;
        }, {});
        return Object.values(grouped).reverse();
    }, [dateFilteredHistory]);

    const topLostProducts = useMemo(() => {
        const productLosses = (dateFilteredHistory || []).reduce((acc: any, t) => {
            const pId = t.relatedId || 'unknown';
            if (!acc[pId]) acc[pId] = { id: pId, totalAmount: 0, count: 0 };
            acc[pId].totalAmount += t.amount;
            acc[pId].count += 1;
            return acc;
        }, {});

        const sorted = Object.values(productLosses).sort((a: any, b: any) => b.totalAmount - a.totalAmount).slice(0, 3);
        return sorted.map((item: any) => {
            const prod = products.find(p => p.id === item.id);
            return { ...item, name: prod ? prod.name : 'Producto Eliminado' };
        });
    }, [dateFilteredHistory, products]);

    const handleExport = () => {
        if(dateFilteredHistory.length === 0) {
            showAlert({ title: 'Sin datos', message: 'No hay datos para exportar.', variant: 'info' });
            return;
        }
        let csv = 'Fecha,Producto/Motivo,Costo Perdido\n';
        dateFilteredHistory.forEach(h => {
            const row = `"${new Date(h.date).toLocaleDateString()}","${h.description}","${h.amount}"`;
            csv += row + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `reporte_mermas_${dateFilter}.csv`);
        a.click();
    };

    return (
        <div className="waste-mobile-wrapper">
            {/* Header */}
            <header className="waste-mobile-header">
                <div className="header-left">
                    <h2>Mermas</h2>
                    <span className="header-subtitle">Pérdidas y desperdicios</span>
                </div>
                <button className="icon-btn-export" onClick={handleExport}>
                    <span className="material-symbols-rounded">download</span>
                </button>
            </header>

            {/* Date Filter Scroll */}
            <div className="waste-date-filters">
                {[
                    { id: 'week', label: 'Semana' },
                    { id: 'month', label: 'Mes' },
                    { id: 'all', label: 'Todo' }
                ].map(f => (
                    <button
                        key={f.id}
                        className={`date-chip ${dateFilter === f.id ? 'active' : ''}`}
                        onClick={() => setDateFilter(f.id as any)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="waste-loading">
                    <div className="spinner-waste"></div>
                    <p>Cargando...</p>
                </div>
            ) : (
                <div className="waste-mobile-content">
                    {/* Financial Impact Card */}
                    <div className="impact-card">
                        <div className="impact-icon">
                            <span className="material-symbols-rounded">trending_down</span>
                        </div>
                        <div className="impact-body">
                            <div className="impact-label">Pérdida Total</div>
                            <div className="impact-value">${totalLossValue.toLocaleString()}</div>
                            <div className="impact-subtitle">Dinero irrecuperable en el periodo</div>
                        </div>
                    </div>

                    {/* Chart */}
                    {chartData.length > 0 && (
                        <div className="waste-chart-box">
                            <h4>Tendencia de Pérdidas</h4>
                            <div className="waste-chart">
                                <ResponsiveContainer width="100%" height={160}>
                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D1CDBF" />
                                        <XAxis dataKey="date" tick={{fontSize: 9}} dy={5} />
                                        <YAxis tick={{fontSize: 9}} tickFormatter={(val) => `$${val}`} />
                                        <Tooltip formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, 'Pérdida']} />
                                        <Area type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorLoss)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Top 3 Products */}
                    {topLostProducts.length > 0 && (
                        <div className="waste-section-box">
                            <h4>Top Productos Problemáticos</h4>
                            <div className="top-products-list">
                                {topLostProducts.map((item: any, idx: number) => (
                                    <div key={item.id} className="top-product-item">
                                        <div className="rank-circle">#{idx + 1}</div>
                                        <div className="top-product-info">
                                            <div className="top-product-name">{item.name}</div>
                                            <div className="top-product-loss">-${item.totalAmount.toLocaleString()}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* History with Search */}
                    <div className="waste-history-section">
                        <div className="waste-search-box">
                            <span className="material-symbols-rounded">search</span>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="waste-history-list">
                            {filteredHistory.length === 0 ? (
                                <div className="empty-history">
                                    <span className="material-symbols-rounded">inventory_2</span>
                                    <p>Sin registros</p>
                                </div>
                            ) : (
                                filteredHistory.slice(0, 20).map(h => (
                                    <div key={h.id} className="history-item">
                                        <div className="history-body">
                                            <div className="history-title">
                                                {h.description.replace('Merma: ', '')}
                                            </div>
                                            <div className="history-subtitle">
                                                {new Date(h.date).toLocaleDateString('es-AR', { 
                                                    day: '2-digit', 
                                                    month: 'short',
                                                    hour: '2-digit', 
                                                    minute: '2-digit' 
                                                })}
                                            </div>
                                        </div>
                                        <div className="history-amount">
                                            -${h.amount.toLocaleString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* FAB Button */}
                    <button className="waste-fab-btn" onClick={() => setIsModalOpen(true)}>
                        <span className="material-symbols-rounded">add</span>
                        <span>Reportar Pérdida</span>
                    </button>
                </div>
            )}

            <WasteBuilderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};

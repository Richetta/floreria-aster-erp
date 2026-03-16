import { useState, useMemo, useEffect } from 'react';
import {
    Trash2,
    Search,
    TrendingDown,
    Calendar,
    Download,
    Plus,
    BarChart2,
    AlertOctagon
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { WasteBuilderModal } from '../../components/WasteBuilder/WasteBuilderModal';
import './Waste.css';

// Helpers para fechas
const isThisWeek = (date: Date) => {
    const today = new Date();
    const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
    return date >= firstDay;
};

const isThisMonth = (date: Date) => {
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

export const Waste = () => {
    const products = useStore(state => state.products);
    const transactions = useStore(state => state.transactions);
    const loadProducts = useStore(state => state.loadProducts);
    const loadTransactions = useStore(state => state.loadTransactions);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Load data from backend on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([loadProducts(), loadTransactions()]);
            setIsLoading(false);
        };
        loadData();
    }, []);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'week'>('month');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 1. Obtener todas las transacciones de Merma reales
    const rawWasteHistory = useMemo(() => 
        transactions.filter(t => t.category === 'Merma').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        [transactions]
    );

    // 2. Filtrar por Fecha
    const dateFilteredHistory = useMemo(() => {
        return rawWasteHistory.filter(h => {
            const d = new Date(h.date);
            if (dateFilter === 'week') return isThisWeek(d);
            if (dateFilter === 'month') return isThisMonth(d);
            return true;
        });
    }, [rawWasteHistory, dateFilter]);

    // 3. Filtrar por Búsqueda
    const filteredHistory = useMemo(() => {
        return dateFilteredHistory.filter(h =>
            h.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [dateFilteredHistory, searchTerm]);

    // 4. Métricas Clave
    const totalLossValue = useMemo(() =>
        dateFilteredHistory.reduce((sum, t) => sum + t.amount, 0),
        [dateFilteredHistory]
    );

    // 5. Datos para el Gráfico (Pérdidas agrupadas por día)
    const chartData = useMemo(() => {
        const grouped = dateFilteredHistory.reduce((acc: any, t) => {
            // "2026-03-10T14:30:00" -> "10 Mar"
            const dateObj = new Date(t.date);
            const dayKey = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
            
            if (!acc[dayKey]) acc[dayKey] = { date: dayKey, total: 0 };
            acc[dayKey].total += t.amount;
            return acc;
        }, {});

        // Convertir a array y ordenar cronológicamente
        return Object.values(grouped).reverse();
    }, [dateFilteredHistory]);

    // 6. Ranking Top 3 Productos Perdidos
    const topLostProducts = useMemo(() => {
        const productLosses = dateFilteredHistory.reduce((acc: any, t) => {
            // asumiendo description format "Merma: 2x Rosas (Motivo)"
            // El relatedId de la transaction de merma esconde el productId!
            const pId = t.relatedId || 'unknown';
            if (!acc[pId]) acc[pId] = { id: pId, totalAmount: 0, count: 0 };
            acc[pId].totalAmount += t.amount;
            acc[pId].count += 1;
            return acc;
        }, {});

        const sorted = Object.values(productLosses).sort((a: any, b: any) => b.totalAmount - a.totalAmount).slice(0, 3);
        
        // Match con el nombre real
        return sorted.map((item: any) => {
            const prod = products.find(p => p.id === item.id);
            return {
                ...item,
                name: prod ? prod.name : 'Producto Eliminado'
            };
        });
    }, [dateFilteredHistory, products]);

    // Export Handler
    const handleExport = () => {
        if(dateFilteredHistory.length === 0) return alert('No hay datos para exportar.');
        let csv = 'Fecha,Producto/Motivo,Costo Perdido\n';
        dateFilteredHistory.forEach(h => {
            const row = `"${new Date(h.date).toLocaleDateString()}","${h.description}","${h.amount}"`;
            csv += row + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `reporte_mermas_${dateFilter}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="waste-page p-6">
            {/* Loading State */}
            {isLoading && (
                <div className="loading-overlay" style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(255,255,255,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="spinner" style={{
                            width: 50,
                            height: 50,
                            border: '4px solid #e5e7eb',
                            borderTopColor: '#9b51e0',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1rem'
                        }}></div>
                        <p style={{ color: '#64748b', fontWeight: 500 }}>Cargando mermas...</p>
                    </div>
                </div>
            )}

            <header className="page-header mb-8 flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-h1 flex items-center gap-3">
                        <AlertOctagon className="text-danger" size={32} />
                        Mermas y Desperdicios
                    </h1>
                    <p className="text-body mt-2 text-muted">Auditoría financiera de pérdidas y stock caducado.</p>
                </div>
                <div className="flex gap-3">
                    <button className="btn btn-outline flex items-center gap-2" onClick={handleExport}>
                        <Download size={18} />
                        Exportar CSV
                    </button>
                    <button className="btn btn-danger btn-lg flex items-center gap-2 shadow-danger" onClick={() => setIsModalOpen(true)}>
                        <Plus size={20} />
                        Reportar Pérdida
                    </button>
                </div>
            </header>

            {/* Filtros Globales de Fecha */}
            <div className="date-filters mb-6 flex gap-2 overflow-x-auto pb-2">
                <button 
                    className={`filter-chip ${dateFilter === 'week' ? 'active bg-danger text-white border-danger' : ''}`}
                    onClick={() => setDateFilter('week')}
                >
                    Esta Semana
                </button>
                <button 
                    className={`filter-chip ${dateFilter === 'month' ? 'active bg-danger text-white border-danger' : ''}`}
                    onClick={() => setDateFilter('month')}
                >
                    Este Mes
                </button>
                <button 
                    className={`filter-chip ${dateFilter === 'all' ? 'active bg-danger text-white border-danger' : ''}`}
                    onClick={() => setDateFilter('all')}
                >
                    Histórico Completo
                </button>
            </div>

            <div className="dashboard-grid">
                {/* Panel Izquierdo: Métricas y Gráficos */}
                <div className="dashboard-main-col space-y-6">
                    
                    {/* Tarjeta de Impacto Financiero */}
                    <div className="card bg-danger-light border border-danger-light p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-small font-bold uppercase tracking-wider text-danger mb-1 flex items-center gap-2">
                                    <TrendingDown size={16} /> Impacto Financiero Total
                                </h3>
                                <div className="text-h1 text-danger font-black">${totalLossValue.toLocaleString()}</div>
                                <p className="text-small text-danger opacity-80 mt-1">Dinero irrecuperable en el periodo seleccionado.</p>
                            </div>
                            <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
                                <Trash2 size={32} className="text-danger" />
                            </div>
                        </div>
                    </div>

                    {/* Gráfico de Tendencias */}
                    <div className="card p-6">
                        <h3 className="text-h3 mb-4 flex items-center gap-2">
                            <BarChart2 size={20} className="text-primary" />
                            Tendencia de Pérdidas
                        </h3>
                        <div className="chart-container" style={{ height: '300px', width: '100%' }}>
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-danger)" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="var(--color-danger)" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: 'var(--color-text-muted)', fontSize: 12}} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--color-text-muted)', fontSize: 12}} tickFormatter={(val) => `$${val}`} />
                                        <Tooltip 
                                            formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, 'Pérdida']}
                                            labelStyle={{ color: 'var(--color-text)' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }}
                                        />
                                        <Area type="monotone" dataKey="total" stroke="var(--color-danger)" strokeWidth={3} fillOpacity={1} fill="url(#colorLoss)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted flex-col gap-2">
                                    <BarChart2 size={32} className="opacity-20" />
                                    <p>No hay datos suficientes para graficar en este periodo.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Panel Derecho: Top y Culpables */}
                <div className="dashboard-side-col space-y-6">
                    
                    {/* Top 3 Culpables */}
                    <div className="card p-6">
                        <h3 className="text-body font-bold mb-4 uppercase text-muted tracking-wider text-micro">Top Productos Problemáticos</h3>
                        {topLostProducts.length > 0 ? (
                            <div className="space-y-4">
                                {topLostProducts.map((item: any, idx: number) => (
                                    <div key={item.id} className="flex justify-between items-center p-3 bg-surface rounded-lg border border-border">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-danger/10 text-danger flex items-center justify-center font-bold text-small">
                                                #{idx + 1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-small truncate max-w-[120px]" title={item.name}>{item.name}</p>
                                                <p className="text-micro text-muted font-bold text-danger">-${item.totalAmount.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-small text-muted text-center py-4">No hay datos de pérdida.</p>
                        )}
                    </div>

                    {/* Historial Corto */}
                    <div className="card p-6 flex flex-col flex-1" style={{ minHeight: '350px' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-body font-bold uppercase text-muted tracking-wider text-micro">Últimas Bajas</h3>
                            <div className="search-pill-small w-32">
                                <Search size={14} className="text-muted" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="text-micro w-full"
                                />
                            </div>
                        </div>

                        <div className="waste-history-list overflow-y-auto flex-1 pr-2" style={{ maxHeight: '350px' }}>
                            {filteredHistory.length === 0 ? (
                                <div className="text-center py-8 text-muted">
                                    <p className="text-small">No hay registros detallados.</p>
                                </div>
                            ) : (
                                filteredHistory.slice(0, 15).map(h => (
                                    <div key={h.id} className="px-3 py-3 border-b border-border/50 last:border-0 hover:bg-surface transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-small text-text line-clamp-2">{h.description.replace('Merma: ', '')}</h4>
                                            <span className="text-small font-bold text-danger ml-2 whitespace-nowrap">-${h.amount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center text-micro text-muted gap-1">
                                            <Calendar size={12} />
                                            {new Date(h.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal "Mesa de Armado" pero para Reportar Bajas */}
            <WasteBuilderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};

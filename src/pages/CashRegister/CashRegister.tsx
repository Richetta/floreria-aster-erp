import React, { useState, useEffect } from 'react';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Wallet,
    FileText,
    Download,
    CheckCircle2,
    AlertCircle,
    Calendar,
    Unlock,
    X
} from 'lucide-react';
import { api } from '../../services/api';
import './CashRegister.css';

export const CashRegister = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailySummary, setDailySummary] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showClosingModal, setShowClosingModal] = useState(false);
    const [showOpeningModal, setShowOpeningModal] = useState(false);
    const [openingData, setOpeningData] = useState({
        opening_balance: 0,
        notes: ''
    });
    const [closingData, setClosingData] = useState({
        opening_balance: 0,
        observed_cash: '',
        notes: ''
    });
    const [closingResult, setClosingResult] = useState<any>(null);
    const [cashInDrawer, setCashInDrawer] = useState<any>(null);
    const [cashStatus, setCashStatus] = useState<{is_open: boolean; is_closed: boolean; opening: any} | null>(null);

    // Load daily summary
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Check cash status first
                const status = await api.getCashRegisterStatus(selectedDate);
                setCashStatus(status);
                
                // Load summary
                const summary = await api.getDailySummary(selectedDate);
                setDailySummary(summary);
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [selectedDate]);

    // Load cash in drawer
    useEffect(() => {
        const loadCashInDrawer = async () => {
            try {
                const cash = await api.getCashInDrawer();
                setCashInDrawer(cash);
            } catch (error) {
                console.error('Error loading cash in drawer:', error);
            }
        };
        loadCashInDrawer();
    }, []);

    const handleOpenClosing = () => {
        if (!cashStatus?.is_open) {
            alert('Primero debés abrir la caja');
            return;
        }
        setClosingData({
            opening_balance: cashStatus.opening?.opening_balance || 0,
            observed_cash: '',
            notes: ''
        });
        setClosingResult(null);
        setShowClosingModal(true);
    };

    const handleOpenOpening = () => {
        setOpeningData({
            opening_balance: 0,
            notes: ''
        });
        setShowOpeningModal(true);
    };

    const handleCreateOpening = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.openCashRegister({
                date: selectedDate,
                opening_balance: openingData.opening_balance,
                notes: openingData.notes || undefined
            });
            alert('Caja abierta exitosamente');
            setShowOpeningModal(false);
            // Reload status
            const status = await api.getCashRegisterStatus(selectedDate);
            setCashStatus(status);
        } catch (error: any) {
            alert('Error al abrir caja: ' + error.message);
        }
    };

    const handleCreateClosing = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await api.createClosing({
                date: selectedDate,
                opening_balance: closingData.opening_balance,
                observed_cash: closingData.observed_cash ? parseFloat(closingData.observed_cash) : undefined,
                notes: closingData.notes || undefined
            });
            setClosingResult(result);
        } catch (error: any) {
            alert('Error al crear cierre: ' + error.message);
        }
    };

    const handleExport = async () => {
        try {
            const summary = dailySummary;
            const csv = [
                ['Fecha', selectedDate],
                ['Tipo', 'Categoría', 'Método', 'Monto', 'Descripción'],
                ...summary.transactions.map((t: any) => [
                    t.type,
                    t.category,
                    t.payment_method,
                    t.amount,
                    `"${t.description || ''}"`
                ]),
                [],
                ['RESUMEN'],
                ['Total Ventas', summary.sales.total],
                ['Total Cobros', summary.payments_received.total],
                ['Total Egresos', summary.expenses.total],
                ['Balance', summary.balance]
            ].map(row => row.join(',')).join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cierre_${selectedDate}.csv`;
            a.click();
        } catch (error) {
            alert('Error al exportar');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(amount) || 0);
    };

    return (
        <div className="cash-register-page">
            <header className="page-header mb-6">
                <div>
                    <h1 className="text-h1">Cierre de Caja</h1>
                    <p className="text-body mt-2">Control diario de ingresos, egresos y balance</p>
                    {cashStatus && (
                        <div className={`cash-status-badge ${cashStatus.is_open ? 'open' : 'closed'}`}>
                            {cashStatus.is_open ? (
                                <>
                                    <CheckCircle2 size={16} />
                                    <span>Caja Abierta - Fondo inicial: {formatCurrency(cashStatus.opening?.opening_balance || 0)}</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={16} />
                                    <span>Caja Cerrada</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    {!cashStatus?.is_open && !cashStatus?.is_closed && (
                        <button className="btn btn-success" onClick={handleOpenOpening}>
                            <Unlock size={20} />
                            Abrir Caja
                        </button>
                    )}
                    {cashStatus?.is_open && (
                        <button className="btn btn-primary" onClick={handleOpenClosing}>
                            <FileText size={20} />
                            Cerrar Caja
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={handleExport}>
                        <Download size={20} />
                        Exportar
                    </button>
                </div>
            </header>

            {/* Date Selector */}
            <div className="card mb-6">
                <div className="flex items-center gap-4">
                    <Calendar size={20} className="text-primary" />
                    <label className="form-label">Fecha:</label>
                    <input
                        type="date"
                        className="form-input"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{ width: '200px' }}
                    />
                </div>
            </div>

            {/* Cash in Drawer */}
            {cashInDrawer && (
                <div className="card mb-6 bg-success-light border border-success">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Wallet size={32} className="text-success" />
                            <div>
                                <p className="text-small text-muted">Efectivo en Caja</p>
                                <h2 className="text-h2 text-success">
                                    {formatCurrency(cashInDrawer.cash_in_drawer)}
                                </h2>
                            </div>
                        </div>
                        <div className="text-right text-small text-muted">
                            <p>Saldo inicial: {formatCurrency(cashInDrawer.opening_balance)}</p>
                            <p>{cashInDrawer.transactions_count} transacciones hoy</p>
                        </div>
                    </div>
                </div>
            )}

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
                    <p className="text-muted">Cargando resumen...</p>
                </div>
            ) : dailySummary && (
                <>
                    {/* Summary Cards */}
                    <div className="metrics-grid mb-6">
                        <div className="metric-card income">
                            <div className="metric-icon bg-success-light">
                                <TrendingUp size={24} className="text-success" />
                            </div>
                            <div className="metric-data">
                                <span className="text-small text-muted">Ventas del Día</span>
                                <h2 className="text-h2 text-success">
                                    {formatCurrency(dailySummary.sales.total)}
                                </h2>
                                <p className="text-micro text-muted">
                                    {dailySummary.sales.count} transacciones
                                </p>
                            </div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-icon bg-primary-light">
                                <DollarSign size={24} className="text-primary" />
                            </div>
                            <div className="metric-data">
                                <span className="text-small text-muted">Cobros de Deudas</span>
                                <h2 className="text-h2 text-primary">
                                    {formatCurrency(dailySummary.payments_received.total)}
                                </h2>
                                <p className="text-micro text-muted">
                                    {dailySummary.payments_received.count} cobros
                                </p>
                            </div>
                        </div>

                        <div className="metric-card expense">
                            <div className="metric-icon bg-danger-light">
                                <TrendingDown size={24} className="text-danger" />
                            </div>
                            <div className="metric-data">
                                <span className="text-small text-muted">Egresos del Día</span>
                                <h2 className="text-h2 text-danger">
                                    {formatCurrency(dailySummary.expenses.total)}
                                </h2>
                                <p className="text-micro text-muted">
                                    {dailySummary.expenses.count} gastos
                                </p>
                            </div>
                        </div>

                        <div className="metric-card balance">
                            <div className="metric-icon bg-primary-light">
                                <Wallet size={24} className="text-primary" />
                            </div>
                            <div className="metric-data">
                                <span className="text-small text-muted">Balance del Día</span>
                                <h2 className={`text-h2 ${dailySummary.balance >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {formatCurrency(dailySummary.balance)}
                                </h2>
                                <p className="text-micro text-muted">
                                    Saldo final: {formatCurrency(dailySummary.closing_balance)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Payment Methods Breakdown */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div className="card">
                            <h3 className="text-h3 mb-4">Ingresos por Método de Pago</h3>
                            <div className="breakdown-list">
                                <div className="breakdown-item">
                                    <span className="breakdown-label">Efectivo</span>
                                    <span className="breakdown-value text-success">
                                        {formatCurrency(dailySummary.sales.cash + dailySummary.payments_received.cash)}
                                    </span>
                                </div>
                                <div className="breakdown-item">
                                    <span className="breakdown-label">Tarjeta</span>
                                    <span className="breakdown-value text-primary">
                                        {formatCurrency(dailySummary.sales.card + dailySummary.payments_received.card)}
                                    </span>
                                </div>
                                <div className="breakdown-item">
                                    <span className="breakdown-label">Transferencia</span>
                                    <span className="breakdown-value">
                                        {formatCurrency(dailySummary.sales.transfer + dailySummary.payments_received.transfer)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <h3 className="text-h3 mb-4">Egresos por Categoría</h3>
                            <div className="breakdown-list">
                                {Object.entries(dailySummary.expenses.by_category || {}).map(([category, amount]) => (
                                    <div key={category} className="breakdown-item">
                                        <span className="breakdown-label">{category}</span>
                                        <span className="breakdown-value text-danger">
                                            {formatCurrency(amount as number)}
                                        </span>
                                    </div>
                                ))}
                                {Object.keys(dailySummary.expenses.by_category || {}).length === 0 && (
                                    <p className="text-muted text-center py-4">Sin egresos registrados</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Transactions List */}
                    <div className="card">
                        <h3 className="text-h3 mb-4">Movimientos del Día</h3>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Hora</th>
                                        <th>Tipo</th>
                                        <th>Categoría</th>
                                        <th>Método</th>
                                        <th>Descripción</th>
                                        <th className="text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailySummary.transactions.map((t: any) => (
                                        <tr key={t.id}>
                                            <td className="text-micro">
                                                {new Date(t.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td>
                                                <span className={`badge ${
                                                    t.type === 'sale' || t.type === 'payment_received' 
                                                        ? 'badge-success' 
                                                        : 'badge-danger'
                                                }`}>
                                                    {t.type === 'sale' ? 'Venta' : 
                                                     t.type === 'payment_received' ? 'Cobro' : 
                                                     t.type === 'expense' ? 'Gasto' : 'Pago Prov.'}
                                                </span>
                                            </td>
                                            <td>{t.category}</td>
                                            <td>
                                                {t.payment_method === 'cash' ? 'Efectivo' :
                                                 t.payment_method === 'card' ? 'Tarjeta' :
                                                 t.payment_method === 'transfer' ? 'Transferencia' : '-'}
                                            </td>
                                            <td>{t.description}</td>
                                            <td className={`text-right font-bold ${
                                                t.type === 'sale' || t.type === 'payment_received' 
                                                    ? 'text-success' 
                                                    : 'text-danger'
                                            }`}>
                                                {t.type === 'sale' || t.type === 'payment_received' ? '+' : '-'}
                                                {formatCurrency(t.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Closing Modal */}
            {showClosingModal && (
                <div className="modal-overlay" onClick={() => setShowClosingModal(false)}>
                    <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="modal-header flex justify-between items-center mb-6">
                            <h2 className="text-h2">Cerrar Caja del Día</h2>
                            <button className="btn-icon" onClick={() => setShowClosingModal(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        {!closingResult ? (
                            <form onSubmit={handleCreateClosing}>
                                <div className="form-group mb-4">
                                    <label className="form-label">Fecha</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={selectedDate}
                                        readOnly
                                    />
                                </div>

                                <div className="form-group mb-4">
                                    <label className="form-label">Saldo Inicial (Efectivo)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={closingData.opening_balance}
                                        onChange={(e) => setClosingData({...closingData, opening_balance: parseFloat(e.target.value) || 0})}
                                        step="0.01"
                                    />
                                    <p className="text-micro text-muted mt-1">
                                        Efectivo que había en caja al comenzar el día
                                    </p>
                                </div>

                                <div className="form-group mb-4">
                                    <label className="form-label">Efectivo Observado (Opcional)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={closingData.observed_cash}
                                        onChange={(e) => setClosingData({...closingData, observed_cash: e.target.value})}
                                        placeholder="Contá el efectivo y completá este campo"
                                        step="0.01"
                                        autoFocus
                                    />
                                    <p className="text-micro text-muted mt-1">
                                        Si no completás, se usa el esperado del sistema
                                    </p>
                                </div>

                                <div className="form-group mb-6">
                                    <label className="form-label">Notas / Observaciones</label>
                                    <textarea
                                        className="form-input"
                                        rows={3}
                                        value={closingData.notes}
                                        onChange={(e) => setClosingData({...closingData, notes: e.target.value})}
                                        placeholder="Ej: Faltante por cambio mal dado, etc."
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        className="btn btn-secondary flex-1"
                                        onClick={() => setShowClosingModal(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary flex-1"
                                    >
                                        <CheckCircle2 size={18} />
                                        Crear Cierre
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="closing-result text-center">
                                <div className="result-icon mb-4">
                                    <CheckCircle2 size={64} className="text-success" />
                                </div>
                                <h3 className="text-h2 mb-4">¡Cierre Creado!</h3>
                                
                                <div className="result-summary bg-surface p-4 rounded-lg mb-4">
                                    <div className="result-row flex justify-between mb-2">
                                        <span className="text-muted">Saldo Inicial:</span>
                                        <span className="font-bold">{formatCurrency(closingResult.closing.opening_balance)}</span>
                                    </div>
                                    <div className="result-row flex justify-between mb-2">
                                        <span className="text-muted">Efectivo Esperado:</span>
                                        <span className="font-bold">{formatCurrency(closingResult.closing.expected_cash)}</span>
                                    </div>
                                    {closingResult.closing.observed_cash && (
                                        <>
                                            <div className="result-row flex justify-between mb-2">
                                                <span className="text-muted">Efectivo Observado:</span>
                                                <span className="font-bold">{formatCurrency(closingResult.closing.observed_cash)}</span>
                                            </div>
                                            <div className={`result-row flex justify-between text-lg ${
                                                closingResult.closing.discrepancy >= 0 
                                                    ? 'text-success' 
                                                    : 'text-danger'
                                            }`}>
                                                <span className="font-bold">
                                                    {closingResult.closing.discrepancy >= 0 ? 'Sobrante' : 'Faltante'}:
                                                </span>
                                                <span className="font-bold">
                                                    {formatCurrency(Math.abs(closingResult.closing.discrepancy))}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {closingResult.closing.notes && (
                                    <div className="notes bg-surface-hover p-3 rounded-lg mb-4 text-left">
                                        <p className="text-small text-muted">Notas:</p>
                                        <p className="text-small">{closingResult.closing.notes}</p>
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary w-full"
                                    onClick={() => setShowClosingModal(false)}
                                >
                                    Cerrar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Opening Modal */}
            {showOpeningModal && (
                <div className="modal-overlay" onClick={() => setShowOpeningModal(false)}>
                    <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="modal-header flex justify-between items-center mb-6">
                            <h2 className="text-h2">Abrir Caja del Día</h2>
                            <button className="btn-icon" onClick={() => setShowOpeningModal(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateOpening}>
                            <div className="form-group mb-4">
                                <label className="form-label">Fecha</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={selectedDate}
                                    readOnly
                                />
                            </div>

                            <div className="form-group mb-4">
                                <label className="form-label">Fondo Inicial (Efectivo)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={openingData.opening_balance}
                                    onChange={(e) => setOpeningData({...openingData, opening_balance: parseFloat(e.target.value) || 0})}
                                    step="0.01"
                                    autoFocus
                                />
                                <p className="text-micro text-muted mt-1">
                                    Efectivo que hay en caja al comenzar el día
                                </p>
                            </div>

                            <div className="form-group mb-6">
                                <label className="form-label">Notas / Observaciones</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    value={openingData.notes}
                                    onChange={(e) => setOpeningData({...openingData, notes: e.target.value})}
                                    placeholder="Ej: Billetes de $1000: 5, $500: 10, etc."
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    className="btn btn-secondary flex-1"
                                    onClick={() => setShowOpeningModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-success flex-1"
                                >
                                    <Unlock size={18} />
                                    Abrir Caja
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

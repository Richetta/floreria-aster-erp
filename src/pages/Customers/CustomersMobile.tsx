import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useNavigate } from 'react-router-dom';
import './CustomersMobile.css';

export const CustomersMobile = () => {
    const navigate = useNavigate();
    const customers = useStore((state) => state.customers);
    const loadCustomers = useStore((state) => state.loadCustomers);

    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'debt'>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    useEffect(() => {
        loadCustomers();
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadCustomers();
        setIsRefreshing(false);
    };

    const filteredCustomers = useMemo(() => {
        let base = (customers || []).filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm)
        );

        if (filter === 'debt') {
            base = base.filter(c => (Number(c.debtBalance) || 0) > 0);
        }

        return base.sort((a, b) => a.name.localeCompare(b.name));
    }, [customers, searchTerm, filter]);

    return (
        <div className="customers-mobile-wrapper">
            <header className="mobile-customers-header">
                <div className="customers-header-top">
                    <h2>Clientes</h2>
                    <div className="header-actions">
                        <button className="sync-btn" onClick={handleRefresh} title="Sincronizar">
                            <span className={`material-symbols-rounded ${isRefreshing ? 'spinning' : ''}`}>cloud_sync</span>
                        </button>
                    </div>
                </div>

                <div className="customers-search-box">
                    <span className="material-symbols-rounded search-icon">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nombre o teléfono..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <div className="divider-v"></div>
                    <button className="filter-toggle-btn" onClick={() => setIsFiltersOpen(true)}>
                        <span className="material-symbols-rounded">tune</span>
                        {filter !== 'all' && (
                            <span className="filter-badge-dot"></span>
                        )}
                    </button>
                </div>
            </header>

            <div className="customers-feed-list">
                {filteredCustomers.length === 0 ? (
                    <div className="empty-customers">
                        <span className="material-symbols-rounded">group</span>
                        <p>No se encontraron clientes</p>
                    </div>
                ) : (
                    filteredCustomers.map(customer => (
                        <div key={customer.id} className="customer-item-card animate-fade-in" onClick={() => navigate(`/clientes?edit=${customer.id}`)}>
                            <div className="c-item-main">
                                <div className="c-avatar">
                                    {customer.name.charAt(0)}
                                </div>
                                <div className="c-item-info">
                                    <h4 className="c-item-name">{customer.name}</h4>
                                    <span className="c-item-phone">
                                        <span className="material-symbols-rounded">call</span>
                                        {customer.phone}
                                    </span>
                                </div>
                                <div className="c-item-trailing">
                                    {(Number(customer.debtBalance) || 0) > 0 ? (
                                        <div className="debt-badge">
                                            <span className="debt-label">Debe</span>
                                            <span className="debt-value">${(Number(customer.debtBalance) || 0).toLocaleString()}</span>
                                        </div>
                                    ) : (
                                        <span className="material-symbols-rounded text-success">check_circle</span>
                                    )}
                                </div>
                            </div>
                            <div className="c-item-actions">
                                <button className="c-action-btn c-wa" onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}`, '_blank');
                                }}>
                                    <span className="material-symbols-rounded">chat</span>
                                    WhatsApp
                                </button>
                                <button className="c-action-btn c-edit" onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/clientes?edit=${customer.id}`);
                                }}>
                                    <span className="material-symbols-rounded">edit</span>
                                    Editar
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <button className="mobile-fab-add" onClick={() => navigate('/clientes')}>
                <span className="material-symbols-rounded">person_add</span>
            </button>

            {/* Filters Bottom Sheet */}
            <div className={`filters-bottom-sheet ${isFiltersOpen ? 'open' : ''}`}>
                <div className="filters-sheet-overlay" onClick={() => setIsFiltersOpen(false)} />
                <div className="filters-sheet-content">
                    <div className="filters-sheet-header">
                        <h3>Filtros</h3>
                        <button className="close-sheet-btn" onClick={() => setIsFiltersOpen(false)}>
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    <div className="filters-sheet-body">
                        <div className="filter-group">
                            <h4>Estado de Cuenta</h4>
                            <div className="filter-chips">
                                <button
                                    className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
                                    onClick={() => setFilter('all')}
                                >
                                    Todos ({customers.length})
                                </button>
                                <button
                                    className={`filter-chip ${filter === 'debt' ? 'active' : ''}`}
                                    onClick={() => setFilter('debt')}
                                >
                                    Con Deuda ({(customers || []).filter(c => (Number(c.debtBalance) || 0) > 0).length})
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="filters-sheet-footer">
                        <button className="apply-filters-btn" onClick={() => setIsFiltersOpen(false)}>
                            Aplicar Filtros
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

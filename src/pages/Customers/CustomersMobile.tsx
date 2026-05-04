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
                        <button className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`} onClick={handleRefresh} title="Sincronizar">
                            <span className="material-symbols-rounded">refresh</span>
                        </button>
                    </div>
                </div>

                <div className="customers-search-box-container">
                    <div className="customers-search-box">
                        <span className="material-symbols-rounded search-icon">search</span>
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="clear-search" onClick={() => setSearchTerm('')}>
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="customers-quick-filters">
                    <button
                        className={`quick-filter-chip ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        Todos ({customers.length})
                    </button>
                    <button
                        className={`quick-filter-chip ${filter === 'debt' ? 'active' : ''}`}
                        onClick={() => setFilter('debt')}
                    >
                        Con Deuda ({(customers || []).filter(c => (Number(c.debtBalance) || 0) > 0).length})
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
                    filteredCustomers.map(customer => {
                        const hasDebt = (Number(customer.debtBalance) || 0) > 0;
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
                        const charCode = customer.name.charCodeAt(0) || 0;
                        const bgColor = colors[charCode % colors.length];

                        return (
                            <div key={customer.id} className="cust-list-item animate-fade-in" onClick={() => navigate(`/clientes?edit=${customer.id}`)}>
                                <div className="cust-item-leading">
                                    <div className="cust-avatar" style={{ background: bgColor }}>
                                        {customer.name.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                <div className="cust-item-content">
                                    <div className="cust-item-name">{customer.name}</div>
                                    <div className="cust-item-phone">
                                        <span className="material-symbols-rounded">call</span>
                                        {customer.phone || 'Sin teléfono'}
                                    </div>
                                </div>
                                <div className="cust-item-trailing">
                                    <div className="cust-actions-row">
                                        <button className="cust-icon-btn text-success" onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}`, '_blank');
                                        }}>
                                            <span className="material-symbols-rounded">chat</span>
                                        </button>
                                        <button className="cust-icon-btn" onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/clientes?edit=${customer.id}`);
                                        }}>
                                            <span className="material-symbols-rounded">chevron_right</span>
                                        </button>
                                    </div>
                                    {hasDebt && (
                                        <div className="cust-debt-indicator">
                                            Debe ${(Number(customer.debtBalance) || 0).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <button className="mobile-fab-add" onClick={() => navigate('/clientes')}>
                <span className="material-symbols-rounded">person_add</span>
            </button>
        </div>
    );
};

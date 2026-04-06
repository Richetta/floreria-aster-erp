import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useNavigate } from 'react-router-dom';
import './SuppliersMobile.css';

export const SuppliersMobile = () => {
    const navigate = useNavigate();
    const suppliers = useStore((state) => state.suppliers);
    const loadSuppliers = useStore((state) => state.loadSuppliers);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadSuppliers();
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadSuppliers();
        setIsRefreshing(false);
    };

    const filteredSuppliers = useMemo(() => {
        return (suppliers || []).filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.phone?.includes(searchTerm) ||
            s.category?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [suppliers, searchTerm]);

    return (
        <div className="suppliers-mobile-wrapper">
            <header className="mobile-suppliers-header">
                <div className="suppliers-header-top">
                    <h2>Proveedores</h2>
                    <button className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`} onClick={handleRefresh}>
                        <span className="material-symbols-rounded">refresh</span>
                    </button>
                </div>

                <div className="suppliers-search-box">
                    <span className="material-symbols-rounded">search</span>
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre o rubro..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </header>

            <div className="suppliers-feed-list">
                {filteredSuppliers.length === 0 ? (
                    <div className="empty-suppliers">
                        <span className="material-symbols-rounded">local_shipping</span>
                        <p>No se encontraron proveedores</p>
                    </div>
                ) : (
                    filteredSuppliers.map(supplier => (
                        <div key={supplier.id} className="supplier-item-card animate-fade-in" onClick={() => {
                            // Link to edit or info
                        }}>
                            <div className="s-item-main">
                                <div className="s-icon-box">
                                    <span className="material-symbols-rounded">handshake</span>
                                </div>
                                <div className="s-item-info">
                                    <span className="s-item-cat">{supplier.category || 'Sin Rubro'}</span>
                                    <h4 className="s-item-name">{supplier.name}</h4>
                                    <div className="s-item-meta">
                                        {supplier.phone && (
                                            <span className="s-meta-phone">
                                                <span className="material-symbols-rounded">call</span>
                                                {supplier.phone}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="s-item-footer">
                                <button className="s-action-btn wa" onClick={(e) => {
                                    e.stopPropagation();
                                    if(supplier.phone) window.open(`https://wa.me/${supplier.phone.replace(/\D/g, '')}`, '_blank');
                                }}>
                                    <span className="material-symbols-rounded">chat</span>
                                    WhatsApp
                                </button>
                                <button className="s-action-btn edit">
                                    <span className="material-symbols-rounded">edit</span>
                                    Editar
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <button className="mobile-fab-add" onClick={() => navigate('/proveedores')}>
                <span className="material-symbols-rounded">add_business</span>
            </button>
        </div>
    );
};

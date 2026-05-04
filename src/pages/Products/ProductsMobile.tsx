import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore'; 
import type { Product } from '../../store/useStore';
import { ProductModal } from '../../components/ProductModal/ProductModal';
import { ConfirmModal } from '../../components/ui/Modals';
import { useModal } from '../../hooks/useModal'; 
import { CameraScanner } from '../../components/CameraScanner/CameraScanner';
import './ProductsMobile.css';

export const ProductsMobile = () => {
    const products = useStore((state) => state.products);
    const categories = useStore((state) => state.categories);
    const brands = useStore((state) => state.brands);
    const loadProducts = useStore((state) => state.loadProducts);
    const loadCategories = useStore((state) => state.loadCategories);
    const loadBrands = useStore((state) => state.loadBrands);
    const deleteProduct = useStore((state) => state.deleteProduct);
    const customFilters = useStore((state) => state.customFilters);
    const loadCustomFilters = useStore((state) => state.loadCustomFilters);

    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('Todos');
    const [activeBrand, setActiveBrand] = useState<string>('Todas');
    const [activeCustomFilters, setActiveCustomFilters] = useState<Record<string, string[]>>({});
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const { confirmModal, showConfirm } = useModal();

    useEffect(() => {
        loadProducts();
        loadCategories();
        loadBrands();
        loadCustomFilters();
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await Promise.allSettled([loadProducts(), loadCategories(), loadBrands(), loadCustomFilters()]);
        setIsRefreshing(false);
    };

    const handleEdit = (product: Product) => {   
        setProductToEdit(product);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setProductToEdit(null);
        setIsModalOpen(true);
    };

    const handleDelete = async (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        const confirmed = await showConfirm({    
            title: '¿Eliminar producto?',       
            message: `¿Estás seguro de eliminar "${product.name}"? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            variant: 'danger'
        });
        if (confirmed) {
            deleteProduct(product.id);
        }
    };

    const filteredProducts = useMemo(() => {     
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||      
                (p.code || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;  
            const matchesBrand = activeBrand === 'Todas' || (p.brand_id === activeBrand || (activeBrand === '' && !p.brand_id));
            
            const matchesCustomFilters = Object.entries(activeCustomFilters).every(([, optionIds]) => {
                if (!optionIds || optionIds.length === 0) return true;
                const pOpts = (p as any).custom_filter_options || [];
                return optionIds.some(optId => pOpts.includes(optId));
            });

            return matchesSearch && matchesCategory && matchesBrand && matchesCustomFilters;
        });
    }, [products, searchTerm, activeCategory, activeBrand, activeCustomFilters]);  

    return (
        <div className="products-mobile-wrapper">
            <header className="mobile-products-header">
                <div className="products-header-top">
                    <h2>Inventario</h2>
                    <div className="header-actions">
                        <button className="icon-btn-ghost" onClick={() => setIsScannerOpen(true)}>
                            <span className="material-symbols-rounded">qr_code_scanner</span>
                        </button>
                        <button className={`icon-btn-ghost ${isRefreshing ? 'spinning' : ''}`} onClick={handleRefresh}>
                            <span className="material-symbols-rounded">refresh</span>
                        </button>
                    </div>
                </div>

                <div className="products-search-box-container">
                    <div className="products-search-box">
                        <span className="material-symbols-rounded search-icon">search</span>
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={searchTerm}       
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="clear-search" onClick={() => setSearchTerm('')}>
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        )}
                    </div>
                    <button className="filter-toggle-btn" onClick={() => setIsFiltersOpen(true)}>
                        <span className="material-symbols-rounded">tune</span>
                        {(activeCategory !== 'Todos' || activeBrand !== 'Todas' || Object.values(activeCustomFilters).some(f => f.length > 0)) && (
                            <span className="filter-badge-dot"></span>
                        )}
                    </button>
                </div>

                {/* Filter Chips row directly under search */}
                <div className="products-quick-filters">
                    <button
                        className={`quick-filter-chip ${activeCategory === 'Todos' ? 'active' : ''}`}
                        onClick={() => setActiveCategory('Todos')}
                    >
                        Todos
                    </button>
                    {(categories || []).map(cat => (
                        <button
                            key={cat}
                            className={`quick-filter-chip ${activeCategory === cat ? 'active' : ''}`}
                            onClick={() => setActiveCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </header>

            <div className="products-feed-list"> 
                {filteredProducts.length === 0 ? (
                    <div className="empty-products">
                        <span className="material-symbols-rounded">inventory_2</span>
                        <p>{searchTerm ? 'No se encontraron coincidencias' : 'No hay productos que coincidan con los filtros'}</p>
                        {(searchTerm || activeCategory !== 'Todos' || activeBrand !== 'Todas') && (
                            <button className="clear-search-btn" onClick={() => {
                                setSearchTerm('');
                                setActiveCategory('Todos');
                                setActiveBrand('Todas');
                            }}>
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                ) : (
                    filteredProducts.map(product => (
                        <div key={product.id} className="inv-list-item animate-fade-in" onClick={() => handleEdit(product)}>
                            <div className="inv-item-leading">
                                <div className="inv-icon-circle">
                                    <span className="material-symbols-rounded">
                                        {product.category?.toLowerCase().includes('flor') ? 'local_florist' : 
                                         product.category?.toLowerCase().includes('planta') ? 'potted_plant' : 
                                         'inventory_2'}
                                    </span>
                                </div>
                            </div>
                            <div className="inv-item-content">
                                <div className="inv-item-name">{product.name}</div>
                                <div className="inv-item-stock">Stock: {product.stock}</div>
                            </div>
                            <div className="inv-item-trailing">
                                <div className="inv-item-price">${product.price.toLocaleString('es-AR')}</div>
                                <button className="inv-item-menu" onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(e, product); // Replacing three dots menu with delete for now since click edits
                                }}>
                                    <span className="material-symbols-rounded">delete_outline</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <button className="mobile-fab-add" onClick={handleCreate}>
                <span className="material-symbols-rounded">add</span>
            </button>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                productToEdit={productToEdit}    
                initialCategory={activeCategory !== 'Todos' ? activeCategory : undefined}
            />

            {confirmModal && <ConfirmModal {...confirmModal} />}

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
                        {/* Categories */}
                        <div className="filter-group">
                            <h4>Categorías</h4>
                            <div className="filter-chips">
                                {['Todos', ...(categories || [])].map(cat => (
                                    <button
                                        key={cat}
                                        className={`filter-chip ${activeCategory === cat ? 'active' : ''}`}      
                                        onClick={() => setActiveCategory(cat)}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Brands */}
                        <div className="filter-group">
                            <h4>Marcas</h4>
                            <div className="filter-chips">
                                {['Todas', ...(brands || []).map(b => b.name)].map(brandName => {
                                    const brandId = brandName === 'Todas' ? 'Todas' : (brands.find(b => b.name === brandName)?.id || '');
                                    return (
                                        <button
                                            key={brandName}
                                            className={`filter-chip ${activeBrand === brandId ? 'active' : ''}`}      
                                            onClick={() => setActiveBrand(brandId)}
                                        >
                                            {brandName}
                                        </button>
                                    );
                                })}
                                <button
                                    className={`filter-chip ${activeBrand === '' ? 'active' : ''}`}      
                                    onClick={() => setActiveBrand('')}
                                >
                                    Sin Marca
                                </button>
                            </div>
                        </div>

                        {/* Custom Filters */}
                        {(customFilters || []).map(cf => (
                            <div key={cf.id} className="filter-group">
                                <h4>{cf.name}</h4>
                                <div className="filter-chips">
                                    <button
                                        className={`filter-chip ${(activeCustomFilters[cf.id] || []).length === 0 ? 'active' : ''}`}
                                        onClick={() => setActiveCustomFilters(prev => ({ ...prev, [cf.id]: [] }))}
                                    >
                                        Todos
                                    </button>
                                    {(cf.options || []).map(opt => {
                                        const activeOpts = activeCustomFilters[cf.id] || [];
                                        const isActive = activeOpts.includes(opt.id);
                                        return (
                                            <button
                                                key={opt.id}
                                                className={`filter-chip ${isActive ? 'active' : ''}`}
                                                onClick={() => {
                                                    const next = isActive 
                                                        ? activeOpts.filter(id => id !== opt.id)
                                                        : [...activeOpts, opt.id];
                                                    setActiveCustomFilters(prev => ({ ...prev, [cf.id]: next }));
                                                }}
                                            >
                                                {opt.value}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="filters-sheet-footer">
                        <button className="apply-filters-btn" onClick={() => setIsFiltersOpen(false)}>
                            Aplicar Filtros
                        </button>
                    </div>
                </div>
            </div>

            {isScannerOpen && (
                <CameraScanner
                    onScan={(code) => {
                        setSearchTerm(code);
                        setIsScannerOpen(false);
                    }}
                    onClose={() => setIsScannerOpen(false)}
                />
            )}
        </div>
    );
};

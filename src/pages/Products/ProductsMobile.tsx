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
                        <button className="sync-btn" onClick={handleRefresh} title="Sincronizar con PC">
                            <span className={`material-symbols-rounded ${isRefreshing ? 'spinning' : ''}`}>cloud_sync</span>
                        </button>
                    </div>
                </div>

                <div className="products-search-box">
                    <span className="material-symbols-rounded search-icon">search</span>
                    <input
                        type="text"
                        placeholder="Buscar o escanear..."
                        value={searchTerm}       
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <button className="scanner-btn" onClick={() => setIsScannerOpen(true)}>
                        <span className="material-symbols-rounded">qr_code_scanner</span>
                    </button>
                    <div className="divider-v"></div>
                    <button className="filter-toggle-btn" onClick={() => setIsFiltersOpen(true)}>
                        <span className="material-symbols-rounded">tune</span>
                        {(activeCategory !== 'Todos' || activeBrand !== 'Todas' || Object.values(activeCustomFilters).some(f => f.length > 0)) && (
                            <span className="filter-badge-dot"></span>
                        )}
                    </button>
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
                        <div key={product.id} className="product-item-card animate-fade-in" onClick={() => handleEdit(product)}>
                            <div className="p-item-main">
                                <div className="p-item-info">
                                    <div className="flex flex-col">
                                        <span className="p-item-cat">{product.category || 'Sin Categoría'}</span>
                                        {product.brand_name && <span className="p-item-brand">{product.brand_name}</span>}
                                    </div>
                                    <h4 className="p-item-name">{product.name}</h4>
                                    <span className="p-item-code">#{product.code}</span>
                                </div>
                                <div className="p-item-stock-box">
                                    <div className={`stock-status ${product.stock <= product.min ? 'low' : 'ok'}`}>
                                        <span className="stock-number">{product.stock}</span>     
                                        <span className="stock-label">Stock</span>
                                    </div>       
                                </div>
                            </div>
                            <div className="p-item-footer">
                                <div className="p-item-pricing">
                                    <span className="p-item-cost">Costo: ${(product.cost || 0).toLocaleString('es-AR')}</span>
                                    <span className="p-item-price">${product.price.toLocaleString('es-AR')}</span>
                                </div>
                                <div className="p-item-actions">
                                    <button className="p-edit-mini" onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(product);
                                    }}>
                                        <span className="material-symbols-rounded">edit</span>    
                                    </button>    
                                    <button className="p-delete-mini" onClick={(e) => handleDelete(e, product)}>
                                        <span className="material-symbols-rounded">delete</span>  
                                    </button>    
                                </div>
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

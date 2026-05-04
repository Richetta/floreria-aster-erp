import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore'; 
import type { Product } from '../../store/useStore';
import { ProductModal } from '../../components/ProductModal/ProductModal';

import './ProductsMobile.css';

export const ProductsMobile = () => {
    const products = useStore((state) => state.products);
    const categories = useStore((state) => state.categories);
    const brands = useStore((state) => state.brands);
    const loadProducts = useStore((state) => state.loadProducts);
    const loadCategories = useStore((state) => state.loadCategories);
    const loadBrands = useStore((state) => state.loadBrands);

    const customFilters = useStore((state) => state.customFilters);
    const loadCustomFilters = useStore((state) => state.loadCustomFilters);

    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('Todos');
    const [activeBrand, setActiveBrand] = useState<string>('Todas');
    const [activeCustomFilters, setActiveCustomFilters] = useState<Record<string, string[]>>({});
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);


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
                    <button className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`} onClick={handleRefresh}>
                        <span className="material-symbols-rounded">refresh</span>
                    </button>
                </div>

                <div className="products-search-box">
                    <span className="material-symbols-rounded">search</span>
                    <input
                        type="text"
                        placeholder="Buscar producto o código..."
                        value={searchTerm}       
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="products-filters-scroll-group">
                    <div className="products-categories-scroll">
                        {['Todos', ...(categories || [])].map(cat => (
                            <button
                                key={cat}
                                className={`cat-pill ${activeCategory === cat ? 'active' : ''}`}      
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="products-brands-scroll" style={{ marginTop: '8px' }}>
                        {['Todas', ...(brands || []).map(b => b.name)].map(brandName => {
                            const brandId = brandName === 'Todas' ? 'Todas' : (brands.find(b => b.name === brandName)?.id || '');
                            return (
                                <button
                                    key={brandName}
                                    className={`brand-pill ${activeBrand === brandId ? 'active' : ''}`}      
                                    onClick={() => setActiveBrand(brandId)}
                                >
                                    {brandName}
                                </button>
                            );
                        })}
                        <button
                            className={`brand-pill ${activeBrand === '' ? 'active' : ''}`}      
                            onClick={() => setActiveBrand('')}
                        >
                            Sin Marca
                        </button>
                    </div>

                    {/* Custom Filters Scroll Groups */}
                    {(customFilters || []).map(cf => (
                        <div key={cf.id} className="products-brands-scroll" style={{ marginTop: '8px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#6B7280', padding: '0 4px', alignSelf: 'center' }}>{cf.name}:</span>
                            <button
                                className={`brand-pill ${(activeCustomFilters[cf.id] || []).length === 0 ? 'active' : ''}`}
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
                                        className={`brand-pill ${isActive ? 'active' : ''}`}
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
                        <div key={product.id} className="product-item-card animate-fade-in" onClick={() => handleEdit(product)}>
                            <div className="p-item-main">
                                <div className="p-item-info">
                                    <h4 className="p-item-name">{product.name}</h4>
                                    <div className="p-item-meta">
                                        <span className="p-item-code">#{product.code}</span>
                                        <span className="p-item-cat">{product.category || 'Sin Categoría'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-item-right">
                                <div className="p-item-pricing">
                                    <span className="p-item-price">${product.price.toLocaleString('es-AR')}</span>
                                    <span className="p-item-cost">Costo: ${(product.cost || 0).toLocaleString('es-AR')}</span>
                                </div>
                                <div className={`stock-status ${product.stock <= product.min ? 'low' : 'ok'}`}>
                                    {product.stock}
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


        </div>
    );
};

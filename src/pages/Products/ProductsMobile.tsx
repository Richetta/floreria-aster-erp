import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore'; 
import type { Product } from '../../store/useStore';
import { ProductModal } from '../../components/ProductModal/ProductModal';
import { ConfirmModal } from '../../components/ui/Modals';
import { useModal } from '../../hooks/useModal'; 
import './ProductsMobile.css';

export const ProductsMobile = () => {
    const products = useStore((state) => state.products);
    const categories = useStore((state) => state.categories);
    const brands = useStore((state) => state.brands);
    const loadProducts = useStore((state) => state.loadProducts);
    const loadCategories = useStore((state) => state.loadCategories);
    const loadBrands = useStore((state) => state.loadBrands);
    const deleteProduct = useStore((state) => state.deleteProduct);

    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('Todos');
    const [activeBrand, setActiveBrand] = useState<string>('Todas');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const { confirmModal, showConfirm } = useModal();

    useEffect(() => {
        loadProducts();
        loadCategories();
        loadBrands();
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await Promise.allSettled([loadProducts(), loadCategories(), loadBrands()]);
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
            return matchesSearch && matchesCategory && matchesBrand;
        });
    }, [products, searchTerm, activeCategory, activeBrand]);  

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
        </div>
    );
};

import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Search, Upload, FileDown, Folder, Tag, Grid3x3, List, MoreVertical, Edit2, Barcode, Trash2, Settings, X, CheckSquare, Square } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useStore } from '../../store/useStore';
import type { Product } from '../../store/useStore';
import type { Category } from '../../store/slices/types';
import { ProductModal } from '../../components/ProductModal/ProductModal';
import { BulkPriceUpdateModal } from '../../components/BulkPriceUpdate/BulkPriceUpdateModal';
import { PriceHistoryModal } from '../../components/PriceHistory/PriceHistoryModal';
import { BarcodeLabelPrinter } from '../../components/BarcodeLabelPrinter/BarcodeLabelPrinter';
import CsvImportModal from '../../components/CsvImportModal/CsvImportModal';
import { PrintableCatalog } from '../../components/PrintableCatalog/PrintableCatalog';
import { CategoryTree } from '../../components/CategoryTree/CategoryTree';
import { useDebounce } from '../../hooks/useDebounce';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal, AlertModal } from '../../components/ui/Modals';
import './Products.css';

export const ProductsDesktop = () => {
    // Store
    const products = useStore((state) => state.products);
    const categoriesData = useStore((state) => state.categoriesData);
    const brands = useStore((state) => state.brands);
    
    const loadProducts = useStore((state) => state.loadProducts);
    const loadCategories = useStore((state) => state.loadCategories);
    const loadBrands = useStore((state) => state.loadBrands);
    const loadSuppliers = useStore((state) => state.loadSuppliers);
    
    const addCategory = useStore((state) => state.addCategory);
    const renameCategory = useStore((state) => state.renameCategory);
    const deleteCategory = useStore((state) => state.deleteCategory);
    const deleteProduct = useStore((state) => state.deleteProduct);
    

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Load data on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                await Promise.allSettled([
                    loadProducts(),
                    loadCategories(true), // Include hierarchy
                    loadBrands(),
                    loadSuppliers()
                ]);
            } catch (err) {
                console.error("Error loading products data:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // State
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [activeCategories, setActiveCategories] = useState<string[]>([]);
    const [activeBrands, setActiveBrands] = useState<string[]>([]);

    // Modals visibility
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    
    // Dropdown visibility
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);

    // UI State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'code'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    
    // Modals state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
    const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false);
    const [showBarcodePrinter, setShowBarcodePrinter] = useState(false);
    const [productForBarcode, setProductForBarcode] = useState<Product | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);

    // Refs & Print
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Catalogo_Mi Jardín_${activeCategories.join('_') || 'Todos'}`,
    });

    // Custom modal hook
    const { alertModal, confirmModal, showConfirm } = useModal();

    // Filtered Products
    const filteredProducts = useMemo(() => {
        if (!products) return [];
        let result = products.filter(p => {
            const matchesCategory = activeCategories.length === 0 || activeCategories.includes(p.category) || (activeCategories.includes('Sin Categoría') && !p.category);
            const matchesBrand = activeBrands.length === 0 || (p.brand_id && activeBrands.includes(p.brand_id)) || (activeBrands.includes('Sin Marca') && !p.brand_id);
            const matchesSearch = p.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (p.code || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
            return matchesCategory && matchesBrand && matchesSearch;
        });
        
        result = [...result].sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'name': comparison = a.name.localeCompare(b.name); break;
                case 'price': comparison = a.price - b.price; break;
                case 'stock': comparison = a.stock - b.stock; break;
                case 'code': comparison = (a.code || '').localeCompare(b.code || ''); break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        
        return result;
    }, [products, activeCategories, activeBrands, debouncedSearchTerm, sortBy, sortOrder]);

    // Handlers
    const handleAddSubCategory = (parentId: string) => {
        const name = prompt('Nombre de la sub-carpeta:');
        if (name) addCategory(name, parentId);
    };

    const handleCreateRootCategory = () => {
        const name = prompt('Nombre de la nueva carpeta:');
        if (name) addCategory(name);
    };

    const handleRenameCategoryAction = (cat: Category) => {
        const newName = prompt('Nuevo nombre para la carpeta:', cat.name);
        if (newName && newName !== cat.name) renameCategory(cat.name, newName);
    };

    const handleDeleteCategoryAction = async (cat: Category) => {
        const confirmed = await showConfirm({
            title: '¿Eliminar carpeta?',
            message: `Se eliminará "${cat.name}". Los productos se moverán a "Sin Categoría".`,
            confirmText: 'Eliminar',
            variant: 'danger'
        });
        if (confirmed) {
            deleteCategory(cat.name);
            setActiveCategories(prev => prev.filter(c => c !== cat.name));
        }
    };

    const handleDeleteProduct = async (product: Product) => {
        const confirmed = await showConfirm({
            title: '¿Eliminar producto?',
            message: `Vas a eliminar "${product.name}". Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            variant: 'danger'
        });
        if (confirmed) {
            await deleteProduct(product.id);
        }
    };

    return (
        <div className="inventory-container">
            {isLoading && (
                <div className="loading-overlay">
                    <div className="spinner-container">
                        <div className="spinner"></div>
                        <p>Cargando catálogo...</p>
                    </div>
                </div>
            )}
            <div className="products-layout">
                {/* Main Content */}
                <main className="products-main">
                    <div className="unified-toolbar card mb-4">
                        <div className="toolbar-top-row">
                            <div className="toolbar-title-group">
                                <h1 className="text-h2 font-bold m-0">Catálogo</h1>
                                <span className="badge bg-surface-hover text-muted">{filteredProducts.length} productos</span>
                            </div>
                            
                            <div className="toolbar-actions-group">
                                <div className="more-actions-dropdown">
                                    <button
                                        className={`btn btn-secondary ${showMoreMenu ? 'active' : ''}`}
                                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                                    >
                                        <MoreVertical size={18} />
                                        <span className="hidden-mobile">Más</span>
                                    </button>
                                    {showMoreMenu && (
                                        <>
                                            <div className="dropdown-overlay" onClick={() => setShowMoreMenu(false)} />
                                            <div className="dropdown-menu">
                                                <button className="dropdown-item" onClick={() => { setIsPriceHistoryOpen(true); setShowMoreMenu(false); }}>
                                                    <Upload size={18} /> Historial de Precios
                                                </button>
                                                <button className="dropdown-item" onClick={() => { setShowImportModal(true); setShowMoreMenu(false); }}>
                                                    <Upload size={18} /> Importar
                                                </button>
                                                <div className="dropdown-divider"></div>
                                                <button className="dropdown-item" onClick={() => { setIsBulkUpdateOpen(true); setShowMoreMenu(false); }}>
                                                    <Tag size={18} /> Actualizar Precios
                                                </button>
                                                <button className="dropdown-item" onClick={() => { handlePrint(); setShowMoreMenu(false); }}>
                                                    <FileDown size={18} /> Exportar como PDF
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button className="btn btn-primary" onClick={() => { setProductToEdit(null); setIsModalOpen(true); }}>
                                    <Plus size={20} className="mr-2" />
                                    Nuevo Producto
                                </button>
                            </div>
                        </div>

                        <div className="toolbar-bottom-row pt-4 mt-4 border-t border-border flex flex-wrap items-center justify-between gap-4">
                            <div className="search-pill flex-1 min-w-[280px]">
                                <Search size={18} className="text-muted" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o código..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Category Filter Dropdown */}
                                <div className="relative">
                                    <button 
                                        className="category-select-group flex items-center gap-2 px-3 py-1 bg-surface-hover rounded-xl border border-border"
                                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                    >
                                        <Folder size={16} className="text-muted" />
                                        <span className="font-medium text-small text-main">
                                            {activeCategories.length === 0 ? 'Todas las carpetas' : `${activeCategories.length} carpetas`}
                                        </span>
                                    </button>
                                    {isCategoryDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-[98]" onClick={() => setIsCategoryDropdownOpen(false)} />
                                            <div className="absolute top-full mt-2 left-0 w-64 bg-white border border-border rounded-xl shadow-lg z-[99] p-2 max-h-[300px] overflow-y-auto">
                                                {categoriesData.map(c => (
                                                    <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-surface-hover rounded cursor-pointer">
                                                        {activeCategories.includes(c.name) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-muted" />}
                                                        <span className={activeCategories.includes(c.name) ? 'font-bold' : ''}>{c.name}</span>
                                                        <input type="checkbox" className="hidden" checked={activeCategories.includes(c.name)} onChange={(e) => {
                                                            if (e.target.checked) setActiveCategories([...activeCategories, c.name]);
                                                            else setActiveCategories(activeCategories.filter(a => a !== c.name));
                                                        }} />
                                                    </label>
                                                ))}
                                                <label className="flex items-center gap-2 p-2 hover:bg-surface-hover rounded cursor-pointer">
                                                    {activeCategories.includes('Sin Categoría') ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-muted" />}
                                                    <span className={activeCategories.includes('Sin Categoría') ? 'font-bold' : ''}>Sin Categoría</span>
                                                    <input type="checkbox" className="hidden" checked={activeCategories.includes('Sin Categoría')} onChange={(e) => {
                                                        if (e.target.checked) setActiveCategories([...activeCategories, 'Sin Categoría']);
                                                        else setActiveCategories(activeCategories.filter(a => a !== 'Sin Categoría'));
                                                    }} />
                                                </label>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button 
                                    className="btn-icon bg-surface-hover border border-border rounded-xl px-3 py-1 flex items-center gap-2 text-small font-medium hover:text-primary transition-colors"
                                    onClick={() => setIsCategoryModalOpen(true)}
                                    title="Administrar Carpetas"
                                >
                                    <Settings size={16} /> <span className="hidden-mobile">Carpetas</span>
                                </button>
                                
                                {/* Brand Filter Dropdown */}
                                <div className="relative">
                                    <button 
                                        className="category-select-group flex items-center gap-2 px-3 py-1 bg-surface-hover rounded-xl border border-border"
                                        onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                                    >
                                        <Tag size={16} className="text-muted" />
                                        <span className="font-medium text-small text-main">
                                            {activeBrands.length === 0 ? 'Todas las marcas' : `${activeBrands.length} marcas`}
                                        </span>
                                    </button>
                                    {isBrandDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-[98]" onClick={() => setIsBrandDropdownOpen(false)} />
                                            <div className="absolute top-full mt-2 left-0 w-64 bg-white border border-border rounded-xl shadow-lg z-[99] p-2 max-h-[300px] overflow-y-auto">
                                                {brands.map(b => (
                                                    <label key={b.id} className="flex items-center gap-2 p-2 hover:bg-surface-hover rounded cursor-pointer">
                                                        {activeBrands.includes(b.id) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-muted" />}
                                                        <span className={activeBrands.includes(b.id) ? 'font-bold' : ''}>{b.name}</span>
                                                        <input type="checkbox" className="hidden" checked={activeBrands.includes(b.id)} onChange={(e) => {
                                                            if (e.target.checked) setActiveBrands([...activeBrands, b.id]);
                                                            else setActiveBrands(activeBrands.filter(a => a !== b.id));
                                                        }} />
                                                    </label>
                                                ))}
                                                <label className="flex items-center gap-2 p-2 hover:bg-surface-hover rounded cursor-pointer">
                                                    {activeBrands.includes('Sin Marca') ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-muted" />}
                                                    <span className={activeBrands.includes('Sin Marca') ? 'font-bold' : ''}>Sin Marca</span>
                                                    <input type="checkbox" className="hidden" checked={activeBrands.includes('Sin Marca')} onChange={(e) => {
                                                        if (e.target.checked) setActiveBrands([...activeBrands, 'Sin Marca']);
                                                        else setActiveBrands(activeBrands.filter(a => a !== 'Sin Marca'));
                                                    }} />
                                                </label>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="sort-controls flex items-center gap-1 bg-surface-hover border border-border rounded-xl px-2 py-1">
                                    <select
                                        className="form-input text-small border-none bg-transparent m-0 py-1 h-8 focus:ring-0 font-medium"
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as any)}
                                    >
                                        <option value="name">Ordenar: Nombre</option>
                                        <option value="code">Ordenar: Código</option>
                                        <option value="price">Ordenar: Precio</option>
                                        <option value="stock">Ordenar: Stock</option>
                                    </select>
                                    <button
                                        className="btn-icon p-1 hover-primary rounded bg-surface border border-border shadow-sm"
                                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                        title="Cambiar dirección"
                                    >
                                        {sortOrder === 'asc' ? '↓' : '↑'}
                                    </button>
                                </div>

                                <div className="view-toggle flex gap-1 bg-surface-hover border border-border rounded-xl p-1">
                                    <button
                                        className={`btn-icon p-1 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-muted hover:text-primary hover:bg-surface'}`}
                                        onClick={() => setViewMode('grid')}
                                    >
                                        <Grid3x3 size={16} />
                                    </button>
                                    <button
                                        className={`btn-icon p-1 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-muted hover:text-primary hover:bg-surface'}`}
                                        onClick={() => setViewMode('list')}
                                    >
                                        <List size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface rounded-xl border border-border shadow-sm p-4 min-h-[500px]">
                        {filteredProducts.length === 0 ? (
                            <div className="empty-state">
                                <Search size={64} className="text-muted mb-4 opacity-10" />
                                <h2 className="text-h2 font-black mb-2">No se encontraron productos</h2>
                                <p className="text-body text-muted mb-6">Prueba ajustando los filtros o la búsqueda</p>
                            </div>
                        ) : (
                            <div className="sheet-body">
                                {viewMode === 'grid' ? (
                                    <table className="sheet-table">
                                        <thead>
                                            <tr>
                                                <th>CÓDIGO</th>
                                                <th>PRODUCTO</th>
                                                <th className="text-right">COSTO</th>
                                                <th className="text-right">PRECIO</th>
                                                <th className="text-center">STOCK</th>
                                                <th className="text-right">ACCIONES</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredProducts.map((p) => (
                                                <tr key={p.id} className={p.stock <= p.min ? 'stock-warning' : ''}>
                                                    <td className="font-mono text-small text-muted">{p.code}</td>
                                                    <td>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-primary">{p.name}</span>
                                                            {p.brand_name && <span className="text-micro text-muted uppercase tracking-wider">{p.brand_name}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="text-right text-muted">${p.cost?.toLocaleString() || '-'}</td>
                                                    <td className="text-right font-medium">${p.price.toLocaleString()}</td>
                                                    <td className="text-center">
                                                        <span className={`stock-pill ${p.stock <= p.min ? 'danger' : 'success'}`}>
                                                            {p.stock}
                                                        </span>
                                                    </td>
                                                    <td className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button className="btn-icon text-muted hover:text-danger" onClick={() => handleDeleteProduct(p)} title="Eliminar Producto">
                                                                <Trash2 size={18} />
                                                            </button>
                                                            <button className="btn-icon text-muted hover:text-primary" onClick={() => { setProductForBarcode(p); setShowBarcodePrinter(true); }} title="Imprimir Código de Barras">
                                                                <Barcode size={18} />
                                                            </button>
                                                            <button className="btn-icon text-muted hover:text-primary" onClick={() => { setProductToEdit(p); setIsModalOpen(true); }} title="Editar Producto">
                                                                <Edit2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="product-list-view">
                                        {filteredProducts.map((p) => (
                                            <div key={p.id} className="product-list-item flex justify-between items-center mb-2">
                                                <div>
                                                    <h4 className="m-0 font-bold">{p.name}</h4>
                                                    <p className="text-micro text-muted m-0">{p.code} • {p.brand_name || 'Sin Marca'}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="font-bold text-primary m-0 text-right">${p.price.toLocaleString()}</p>
                                                        <span className={`text-micro stock-pill ${p.stock <= p.min ? 'danger' : 'success'}`}>{p.stock} unid.</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 ml-4">
                                                    <button className="btn-icon text-muted hover:text-danger bg-surface" onClick={() => handleDeleteProduct(p)} title="Eliminar Producto">
                                                        <Trash2 size={18} />
                                                    </button>
                                                    <button className="btn-icon text-muted hover:text-primary bg-surface" onClick={() => { setProductForBarcode(p); setShowBarcodePrinter(true); }} title="Imprimir Código de Barras">
                                                        <Barcode size={18} />
                                                    </button>
                                                    <button className="btn-icon text-muted hover:text-primary bg-surface" onClick={() => { setProductToEdit(p); setIsModalOpen(true); }} title="Editar Producto">
                                                        <Edit2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Modals */}
            <ProductModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                productToEdit={productToEdit}
                initialCategory={activeCategories.length === 1 ? activeCategories[0] : undefined}
            />
            {isBulkUpdateOpen && <BulkPriceUpdateModal isOpen={isBulkUpdateOpen} onClose={() => setIsBulkUpdateOpen(false)} />}
            {isPriceHistoryOpen && <PriceHistoryModal isOpen={isPriceHistoryOpen} onClose={() => setIsPriceHistoryOpen(false)} />}
            {showImportModal && <CsvImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} />}
            
            <BarcodeLabelPrinter
                product={productForBarcode}
                isOpen={showBarcodePrinter}
                onClose={() => { setShowBarcodePrinter(false); setProductForBarcode(null); }}
                quantity={1}
            />

            {confirmModal && <ConfirmModal {...confirmModal} />}
            {alertModal && <AlertModal {...alertModal} />}

            <div style={{ display: 'none' }}>
                <PrintableCatalog 
                    ref={printRef} 
                    products={filteredProducts} 
                    categoryName={activeCategories.join(', ') || 'Todos'} 
                />
            </div>

            {isCategoryModalOpen && (
                <div className="modal-overlay" onClick={() => setIsCategoryModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2 className="text-h2 font-bold m-0 text-main flex items-center gap-2">
                                <Folder size={24} className="text-primary"/> Administrar Carpetas
                            </h2>
                            <button className="modal-close-btn" onClick={() => setIsCategoryModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body p-6">
                            <div className="flex justify-between items-center mb-6">
                                <p className="text-muted m-0">Organiza y modifica tus carpetas de productos.</p>
                                <button className="btn btn-primary" onClick={handleCreateRootCategory}>
                                    <Plus size={20} className="mr-2" />
                                    Nueva Carpeta
                                </button>
                            </div>
                            <div className="bg-surface rounded-xl border border-border p-4">
                                <CategoryTree 
                                    categories={categoriesData}
                                    activeCategory={activeCategories.length === 1 ? activeCategories[0] : 'Todos'}
                                    onSelect={(cat) => {
                                        if (cat === 'Todos') setActiveCategories([]);
                                        else setActiveCategories([cat]);
                                    }}
                                    onAddSub={handleAddSubCategory}
                                    onRename={handleRenameCategoryAction}
                                    onDelete={handleDeleteCategoryAction}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

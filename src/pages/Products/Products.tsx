import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Check, X, Edit2, Trash2, Search, Folder, FolderPlus, List, Grid3x3, TrendingUp, History, Printer, Upload, FileDown } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useStore } from '../../store/useStore';
import type { Product } from '../../store/useStore';
import { ProductModal } from '../../components/ProductModal/ProductModal';
import { BulkPriceUpdateModal } from '../../components/BulkPriceUpdate/BulkPriceUpdateModal';
import { PriceHistoryModal } from '../../components/PriceHistory/PriceHistoryModal';
import { BarcodeLabelPrinter } from '../../components/BarcodeLabelPrinter/BarcodeLabelPrinter';
import { CsvImportModal } from '../../components/CsvImportModal/CsvImportModal';
import { PrintableCatalog } from '../../components/PrintableCatalog/PrintableCatalog';
import { useDebounce } from '../../hooks/useDebounce';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal, AlertModal } from '../../components/ui/Modals';
import './Products.css';

export const Products = () => {
    // Store
    const products = useStore((state) => state.products);
    const categories = useStore((state) => state.categories);
    const addCategory = useStore((state) => state.addCategory);
    const renameCategory = useStore((state) => state.renameCategory);
    const deleteCategory = useStore((state) => state.deleteCategory);
    const deleteProduct = useStore((state) => state.deleteProduct);
    const loadProducts = useStore((state) => state.loadProducts);
    const loadCategories = useStore((state) => state.loadCategories);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Load products and categories from backend on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                await Promise.allSettled([
                    loadProducts(),
                    loadCategories()
                ]);
            } catch (err) {
                console.error("Error loading products/categories:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // State
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300); // 300ms debounce
    const [activeCategory, setActiveCategory] = useState<string>('Todos');

    // Refs
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Catalogo_Aster_${activeCategory}`,
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [isEditingCategory, setIsEditingCategory] = useState(false);
    const [categoryNameInput, setCategoryNameInput] = useState('');
    
    // New state for view mode and sorting
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'code'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
    const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false);
    const [productForBarcode, setProductForBarcode] = useState<Product | null>(null);
    const [showBarcodePrinter, setShowBarcodePrinter] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    // Custom modal hook
    const { alertModal, confirmModal, showConfirm } = useModal();

    // Ensure activeCategory stays valid if categories changes
    useEffect(() => {
        if (activeCategory !== 'Todos' && categories && categories.length > 0 && !categories.includes(activeCategory)) {
            setActiveCategory('Todos');
        }
    }, [categories, activeCategory]);

    // Filtered Products for the active folder
    const filteredProducts = useMemo(() => {
        if (!products) return [];
        let result = (products || []).filter(p => {
            const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
            const matchesSearch = p.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                p.code.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
        
        // Apply sorting
        result = [...result].sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'price':
                    comparison = a.price - b.price;
                    break;
                case 'stock':
                    comparison = a.stock - b.stock;
                    break;
                case 'code':
                    comparison = a.code.localeCompare(b.code);
                    break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        
        return result;
    }, [products, activeCategory, searchTerm, sortBy, sortOrder]);

    // Handlers
    const handleAddCategory = () => {
        const name = prompt('Nombre de la nueva carpeta:');
        if (name) {
            addCategory(name);
            setActiveCategory(name);
        }
    };

    const handleRenameCategory = () => {
        if (categoryNameInput && categoryNameInput !== activeCategory) {
            renameCategory(activeCategory, categoryNameInput);
            setActiveCategory(categoryNameInput);
        }
        setIsEditingCategory(false);
    };

    const handleOpenEditModal = (product: Product) => {
        setProductToEdit(product);
        setIsModalOpen(true);
    };

    const handleOpenCreateModal = () => {
        setProductToEdit(null);
        setIsModalOpen(true);
    };

    const handlePrintBarcode = (product: Product) => {
        setProductForBarcode(product);
        setShowBarcodePrinter(true);
    };

    return (
        <div className="inventory-container">
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
                        <p style={{ color: '#64748b', fontWeight: 500 }}>Cargando productos...</p>
                    </div>
                </div>
            )}

            {/* Folder Tabs Removed - Now integrated into the unified toolbar */}

            {/* Unified Header & Toolbar */}
            <div className="unified-toolbar card mb-4">
                <div className="toolbar-top-row">
                    <div className="toolbar-title-group">
                        <h1 className="text-h2 font-bold m-0">Catálogo</h1>
                        <span className="badge bg-surface-hover text-muted">{filteredProducts.length} productos</span>
                    </div>
                    
                    <div className="toolbar-actions-group">
                        {/* More Actions Dropdown */}
                        <div className="more-actions-dropdown" style={{ position: 'relative' }}>
                            <button
                                className={`btn btn-secondary ${showMoreMenu ? 'active' : ''}`}
                                onClick={() => setShowMoreMenu(!showMoreMenu)}
                                title="Más acciones"
                            >
                                <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>⋯</span>
                                <span className="hidden-mobile">Más</span>
                            </button>
                                                   {showMoreMenu && (
                                <>
                                    <div
                                        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                                        onClick={() => setShowMoreMenu(false)}
                                    />
                                    <div className="dropdown-menu" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '0.5rem',
                                        background: 'var(--color-surface)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-lg)',
                                        boxShadow: 'var(--shadow-lg)',
                                        zIndex: 100,
                                        minWidth: '220px',
                                        padding: '0.5rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.125rem'
                                    }}>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => { setIsPriceHistoryOpen(true); setShowMoreMenu(false); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: '0.9375rem', color: 'var(--color-text-main)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <History size={18} /> Historial de Precios
                                        </button>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => { setShowImportModal(true); setShowMoreMenu(false); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: '0.9375rem', color: 'var(--color-text-main)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <Upload size={18} /> Importar
                                        </button>
                                        <div style={{ height: '1px', background: 'var(--color-border)', margin: '0.25rem 0' }}></div>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => { setIsBulkUpdateOpen(true); setShowMoreMenu(false); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: '0.9375rem', color: 'var(--color-text-main)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <TrendingUp size={18} /> Actualizar Precios
                                        </button>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => { handlePrint(); setShowMoreMenu(false); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: '0.9375rem', color: 'var(--color-text-main)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <FileDown size={18} /> Exportar como PDF
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setProductToEdit(null); // Changed from setEditingProduct to setProductToEdit
                                setIsModalOpen(true);
                            }}
                        >
                            <Plus size={20} className="mr-2" />
                            Nuevo Producto
                        </button>
                    </div>
                </div>

                <div className="toolbar-bottom-row pt-4 mt-4 border-t border-border flex flex-wrap items-center justify-between gap-4">
                    {/* Search Pill */}
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
                        {/* Category Dropdown replacing tabs */}
                        <div className="category-select-group flex items-center gap-2 bg-surface-hover p-1 rounded-lg border border-border">
                            <Folder size={16} className="text-muted ml-2 hidden-mobile" />
                            {isEditingCategory ? (
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        className="form-input text-small py-1 px-2 m-0 h-8"
                                        value={categoryNameInput}
                                        onChange={(e) => setCategoryNameInput(e.target.value)}
                                        autoFocus
                                    />
                                    <button className="btn-icon text-success p-1" onClick={handleRenameCategory}>
                                        <Check size={16} />
                                    </button>
                                    <button className="btn-icon text-muted p-1" onClick={() => setIsEditingCategory(false)}>
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <select
                                    className="form-input border-none bg-transparent font-medium py-1 m-0 h-8 focus:ring-0"
                                    value={activeCategory}
                                    onChange={(e) => {
                                        setActiveCategory(e.target.value);
                                        setIsEditingCategory(false);
                                    }}
                                >
                                    <option value="Todos">Todas las categorías</option>
                                    <optgroup label="Carpetas">
                                        {(categories || []).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </optgroup>
                                    {(products || []).some(p => p.category === 'Sin Categoría') && (
                                        <option value="Sin Categoría">Sin Categoría</option>
                                    )}
                                </select>
                            )}
                            
                            {/* Category Actions */}
                            <div className="flex gap-1 border-l border-border pl-1 ml-1 pr-1">
                                <button
                                    className="btn-icon text-muted p-1 hover-primary"
                                    onClick={handleAddCategory}
                                    title="Nueva Categoría"
                                >
                                    <FolderPlus size={16} />
                                </button>
                                {activeCategory !== 'Todos' && activeCategory !== 'Sin Categoría' && !isEditingCategory && (
                                    <>
                                        <button
                                            className="btn-icon text-muted p-1 hover-primary"
                                            onClick={() => {
                                                setCategoryNameInput(activeCategory);
                                                setIsEditingCategory(true);
                                            }}
                                            title="Renombrar Categoría"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            className="btn-icon text-muted p-1 hover-danger"
                                            onClick={async () => {
                                                const confirmed = await showConfirm({
                                                    title: '¿Eliminar categoría?',
                                                    message: `Se eliminará "${activeCategory}". Los productos se moverán a "Sin Categoría".`,
                                                    confirmText: 'Eliminar',
                                                    variant: 'danger'
                                                });
                                                if (confirmed) {
                                                    deleteCategory(activeCategory);
                                                    setActiveCategory('Todos');
                                                }
                                            }}
                                            title="Eliminar Categoría"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Sort Controls */}
                        <div className="sort-controls flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
                            <select
                                className="form-input text-small border-none bg-transparent m-0 py-1 h-8 focus:ring-0"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                            >
                                <option value="name">Nombre</option>
                                <option value="code">Código</option>
                                <option value="price">Precio</option>
                                <option value="stock">Stock</option>
                            </select>
                            <div className="w-px h-4 bg-border"></div>
                            <button
                                className="btn-icon p-1 w-8 h-8 flex items-center justify-center text-muted hover-primary"
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                title={sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
                            >
                                {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="view-toggle flex gap-1 bg-surface border border-border rounded-lg p-1 m-0">
                            <button
                                className={`btn-icon p-1 w-8 h-8 flex items-center justify-center rounded-md transition-colors ${viewMode === 'grid' ? 'bg-surface-hover text-primary' : 'text-muted'}`}
                                onClick={() => setViewMode('grid')}
                                title="Vista de Grilla"
                            >
                                <Grid3x3 size={16} />
                            </button>
                            <button
                                className={`btn-icon p-1 w-8 h-8 flex items-center justify-center rounded-md transition-colors ${viewMode === 'list' ? 'bg-surface-hover text-primary' : 'text-muted'}`}
                                onClick={() => setViewMode('list')}
                                title="Vista de Lista"
                            >
                                <List size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* List/Grid Content Area */}
            <div className="bg-surface rounded-xl border border-border shadow-sm p-4">      {/* Products List */}
                <div className="sheet-body">
                    {filteredProducts.length === 0 ? (
                        <div className="empty-state">
                            <Folder size={64} className="text-muted mb-4 opacity-10" />
                            <h2 className="text-h2 font-black mb-2">Esta carpeta está vacía</h2>
                            <p className="text-body text-muted mb-6">Empezá a cargar tus flores o importá una lista existente</p>
                            
                            <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                                <button className="btn btn-primary btn-lg" onClick={handleOpenCreateModal}>
                                    <Plus size={20} />
                                    <span>Crear Producto</span>
                                </button>
                                <div className="flex gap-2">
                                    <button className="btn btn-secondary flex-1" onClick={() => setShowImportModal(true)}>
                                        <Upload size={18} />
                                        <span>Importar Lista</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Grid View */}
                            {viewMode === 'grid' && (
                                <table className="sheet-table">
                                    <thead>
                                        <tr>
                                            <th>CÓDIGO</th>
                                            <th>NOMBRE DEL PRODUCTO</th>
                                            <th className="text-right">COSTO</th>
                                            <th className="text-right">PRECIO</th>
                                            <th className="text-right">MARGEN</th>
                                            <th className="text-center">STOCK</th>
                                            <th className="text-right">ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProducts.map((p) => {
                                            const margin = p.cost && p.price ? ((p.price - p.cost) / p.cost) * 100 : 0;
                                            return (
                                            <tr key={p.id} className={p.stock <= p.min ? 'stock-warning' : ''}>
                                                <td className="font-mono text-small text-muted">{p.code}</td>
                                                <td className="font-bold text-primary">{p.name}</td>
                                                <td className="text-right text-muted">${p.cost?.toLocaleString() || '-'}</td>
                                                <td className="text-right font-medium">${p.price.toLocaleString()}</td>
                                                <td className="text-right">
                                                    <span className={`text-small font-bold ${margin >= 50 ? 'text-success' : margin >= 30 ? 'text-warning' : 'text-danger'}`}>
                                                        {margin > 0 ? `${margin.toFixed(0)}%` : '-'}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    <span className={`stock-pill ${p.stock <= p.min ? 'danger' : 'success'}`}>
                                                        {p.stock}
                                                    </span>
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            className="btn-icon hover-primary" 
                                                            onClick={() => handlePrintBarcode(p)}
                                                            title="Imprimir código de barras"
                                                        >
                                                            <Printer size={18} />
                                                        </button>
                                                        <button className="btn-icon hover-primary" onClick={() => handleOpenEditModal(p)}>
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button className="btn-icon hover-danger" onClick={() => deleteProduct(p.id)}>
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            )}
                            
                            {/* List View */}
                            {viewMode === 'list' && (
                                <div className="product-list-view">
                                    {filteredProducts.map((p) => (
                                        <div key={p.id} className="product-list-item">
                                            <div className="product-list-info">
                                                <div className="product-list-header">
                                                    <h4 className="product-list-name">{p.name}</h4>
                                                    <span className="product-list-code">{p.code}</span>
                                                </div>
                                                <div className="product-list-meta">
                                                    <span className="text-muted">Categoría: {p.category}</span>
                                                    {p.stock <= p.min && (
                                                        <span className="text-danger font-bold">• Stock bajo</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="product-list-actions">
                                                <div className="product-list-price">${p.price.toLocaleString()}</div>
                                                <div className="product-list-stock">
                                                    <span className={`stock-pill ${p.stock <= p.min ? 'danger' : 'success'}`}>
                                                        {p.stock}
                                                    </span>
                                                </div>
                                                <div className="product-list-buttons flex gap-1">
                                                    <button className="btn-icon hover-primary" onClick={() => handleOpenEditModal(p)}>
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button className="btn-icon hover-danger" onClick={() => deleteProduct(p.id)}>
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Mobile List (Accessible Sheet) */}
            <div className="mobile-sheet hidden-desktop">
                {filteredProducts.map(p => (
                    <div key={p.id} className="mobile-product-card" onClick={() => handleOpenEditModal(p)}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold">{p.name}</h3>
                                <p className="text-small text-muted font-mono">{p.code}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-primary">${p.price.toLocaleString()}</p>
                                <span className={`stock-pill text-micro ${p.stock <= p.min ? 'danger' : 'success'}`}>
                                    {p.stock} unid.
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                productToEdit={productToEdit}
                initialCategory={activeCategory}
            />
            
            <BulkPriceUpdateModal
                isOpen={isBulkUpdateOpen}
                onClose={() => setIsBulkUpdateOpen(false)}
            />
            
            <PriceHistoryModal
                isOpen={isPriceHistoryOpen}
                onClose={() => setIsPriceHistoryOpen(false)}
            />

            <BarcodeLabelPrinter
                product={productForBarcode}
                isOpen={showBarcodePrinter}
                onClose={() => {
                    setShowBarcodePrinter(false);
                    setProductForBarcode(null);
                }}
                quantity={1}
            />

            <CsvImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
            />

            {confirmModal && <ConfirmModal {...confirmModal} />}
            {alertModal && <AlertModal {...alertModal} />}

            {/* Hidden Printable Catalog */}
            <div style={{ display: 'none' }}>
                <PrintableCatalog 
                    ref={printRef} 
                    products={filteredProducts} 
                    categoryName={activeCategory} 
                />
            </div>
        </div>
    );
};

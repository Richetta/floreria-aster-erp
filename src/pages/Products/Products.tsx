import { useState, useMemo, useEffect } from 'react';
import { Plus, Check, X, Edit2, Trash2, Search, Folder, List, Grid3x3, TrendingUp, History, Printer, Upload, FileText } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Product } from '../../store/useStore';
import { ProductModal } from '../../components/ProductModal/ProductModal';
import { BulkPriceUpdateModal } from '../../components/BulkPriceUpdate/BulkPriceUpdateModal';
import { PriceHistoryModal } from '../../components/PriceHistory/PriceHistoryModal';
import { BarcodeLabelPrinter } from '../../components/BarcodeLabelPrinter/BarcodeLabelPrinter';
import { CsvImportModal } from '../../components/CsvImportModal/CsvImportModal';
import { OCRImportModal } from '../../components/OCRImportModal/OCRImportModal';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { useDebounce } from '../../hooks/useDebounce';
import './Products.css';

export const Products = () => {
    // Store
    const products = useStore((state) => state.products);
    const categories = useStore((state) => state.categories);
    const addCategory = useStore((state) => state.addCategory);
    const renameCategory = useStore((state) => state.renameCategory);
    const deleteCategory = useStore((state) => state.deleteCategory);
    const addProduct = useStore((state) => state.addProduct);
    const deleteProduct = useStore((state) => state.deleteProduct);
    const loadProducts = useStore((state) => state.loadProducts);
    const loadCategories = useStore((state) => state.loadCategories);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Load products and categories from backend on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([
                loadProducts(),
                loadCategories()
            ]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    // State
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300); // 300ms debounce
    const [activeCategory, setActiveCategory] = useState<string>('Todos');
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
    const [showCsvImport, setShowCsvImport] = useState(false);
    const [showOCRImport, setShowOCRImport] = useState(false);

    // Ensure activeCategory stays valid if categories changes
    useEffect(() => {
        if (activeCategory !== 'Todos' && categories && categories.length > 0 && !categories.includes(activeCategory)) {
            setActiveCategory('Todos');
        }
    }, [categories, activeCategory]);

    // Filtered Products for the active folder
    const filteredProducts = useMemo(() => {
        if (!products) return [];
        let result = products.filter(p => {
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

    const handleOCRImport = async (products: any[]) => {
        // Import each product
        for (const ocrProduct of products) {
            await addProduct({
                id: generateIdWithPrefix('p'),
                code: ocrProduct.code,
                name: ocrProduct.name,
                category: activeCategory,
                price: ocrProduct.price,
                cost: ocrProduct.price * 0.5, // Default 50% margin
                stock: ocrProduct.stock || 0,
                min: ocrProduct.min || 5,
                tags: []
            });
        }
        await loadProducts();
        alert(`✅ ${products.length} productos importados exitosamente`);
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

            {/* Folder Tabs (Physical Metaphor) */}
            <div className="folder-tabs-wrapper">
                <div className="folder-tabs">
                    <button
                        className={`folder-tab ${activeCategory === 'Todos' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveCategory('Todos');
                            setIsEditingCategory(false);
                        }}
                    >
                        <span className="tab-label">Todos</span>
                        {activeCategory === 'Todos' && (
                            <span className="tab-indicator" />
                        )}
                    </button>
                    {(categories || []).map((cat) => (
                        <button
                            key={cat}
                            className={`folder-tab ${activeCategory === cat ? 'active' : ''}`}
                            onClick={() => {
                                setActiveCategory(cat);
                                setIsEditingCategory(false);
                            }}
                        >
                            <span className="tab-label">{cat}</span>
                            {activeCategory === cat && (
                                <span className="tab-indicator" />
                            )}
                        </button>
                    ))}
                    {(products || []).some(p => p.category === 'Sin Categoría') && (
                        <button
                            className={`folder-tab ${activeCategory === 'Sin Categoría' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveCategory('Sin Categoría');
                                setIsEditingCategory(false);
                            }}
                        >
                            <span className="tab-label">Sin Categoría</span>
                            {activeCategory === 'Sin Categoría' && (
                                <span className="tab-indicator" />
                            )}
                        </button>
                    )}
                    <button className="folder-tab add-tab" onClick={handleAddCategory}>
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {/* Active Sheet Content */}
            <div className="physical-sheet card">
                <header className="sheet-header">
                    <div className="header-left">
                        {isEditingCategory ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    className="form-input text-h2"
                                    value={categoryNameInput}
                                    onChange={(e) => setCategoryNameInput(e.target.value)}
                                    autoFocus
                                />
                                <button className="btn-icon text-success" onClick={handleRenameCategory}>
                                    <Check size={20} />
                                </button>
                                <button className="btn-icon text-muted" onClick={() => setIsEditingCategory(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <h1 className="text-h1 sheet-title">{activeCategory}</h1>
                                {activeCategory !== 'Todos' && activeCategory !== 'Sin Categoría' && (
                                    <>
                                        <button
                                            className="btn-icon text-muted"
                                            onClick={() => {
                                                setCategoryNameInput(activeCategory);
                                                setIsEditingCategory(true);
                                            }}
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            className="btn-icon text-danger"
                                            onClick={() => {
                                                if (confirm(`¿Eliminar la carpeta "${activeCategory}"? Los productos se moverán a "Sin Categoría".`)) {
                                                    deleteCategory(activeCategory);
                                                    setActiveCategory('Todos');
                                                }
                                            }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                        <p className="text-body text-muted mt-1">
                            {filteredProducts.length} productos en esta carpeta
                        </p>
                    </div>

                    <div className="header-actions">
                        <div className="search-pill">
                            <Search size={18} className="text-muted" />
                            <input
                                type="text"
                                placeholder="Buscar en esta carpeta..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        {/* View Mode Toggle */}
                        <div className="view-toggle flex gap-1">
                            <button
                                className={`btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Vista de Grilla"
                            >
                                <Grid3x3 size={18} />
                            </button>
                            <button
                                className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                                title="Vista de Lista"
                            >
                                <List size={18} />
                            </button>
                        </div>
                        
                        {/* Sort Controls */}
                        <div className="sort-controls flex items-center gap-2">
                            <select
                                className="form-input text-small"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                            >
                                <option value="name">Nombre</option>
                                <option value="code">Código</option>
                                <option value="price">Precio</option>
                                <option value="stock">Stock</option>
                            </select>
                            <button
                                className="btn-icon"
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                title={sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
                            >
                                {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                        
                        <button
                            className="btn btn-secondary btn-lg"
                            onClick={() => setIsPriceHistoryOpen(true)}
                        >
                            <History size={20} />
                            <span className="hidden-mobile">Historial</span>
                        </button>

                        <button
                            className="btn btn-secondary btn-lg"
                            onClick={() => setShowOCRImport(true)}
                            title="Digitalizar lista de precios con OCR"
                        >
                            <FileText size={20} />
                            <span className="hidden-mobile">Digitalizar (OCR)</span>
                        </button>

                        <button
                            className="btn btn-secondary btn-lg"
                            onClick={() => setShowCsvImport(true)}
                        >
                            <Upload size={20} />
                            <span className="hidden-mobile">Importar CSV</span>
                        </button>

                        <button
                            className="btn btn-secondary btn-lg"
                            onClick={() => setIsBulkUpdateOpen(true)}
                        >
                            <TrendingUp size={20} />
                            <span className="hidden-mobile">Actualizar Precios</span>
                        </button>
                        
                        <button className="btn btn-primary btn-lg shadow-primary" onClick={handleOpenCreateModal}>
                            <Plus size={20} />
                            <span>Nuevo Producto</span>
                        </button>
                    </div>
                </header>

                {/* Products List */}
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
                                    <button className="btn btn-secondary flex-1" onClick={() => setShowOCRImport(true)}>
                                        <FileText size={18} />
                                        <span>Digitalizar</span>
                                    </button>
                                    <button className="btn btn-secondary flex-1" onClick={() => setShowCsvImport(true)}>
                                        <Upload size={18} />
                                        <span>Importar CSV</span>
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
                isOpen={showCsvImport}
                onClose={() => setShowCsvImport(false)}
            />

            <OCRImportModal
                isOpen={showOCRImport}
                onClose={() => setShowOCRImport(false)}
                onImport={handleOCRImport}
            />
        </div>
    );
};

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Plus, Search, Upload, FileDown, Folder, Tag, Grid3x3, List,
    MoreVertical, Edit2, Barcode, Trash2, Settings, X, CheckSquare,
    Square, TrendingUp, Package, DollarSign, AlertTriangle, Check
} from 'lucide-react';
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
import { usePlanGuard, useFeatureGuard } from '../../store/useSubscription';
import { BulkEditModal } from '../../components/BulkEditModal/BulkEditModal';
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
    const bulkDeleteProducts = useStore((state) => state.bulkDeleteProducts);
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
    const { guard: guardProduct } = usePlanGuard('products');
    const { requireFeature } = useFeatureGuard();

    const handleNewProduct = () => {
        guardProduct(() => { setProductToEdit(null); setIsModalOpen(true); });
    };
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
    const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false);
    const [showBarcodePrinter, setShowBarcodePrinter] = useState(false);
    const [productForBarcode, setProductForBarcode] = useState<Product | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showBulkEditModal, setShowBulkEditModal] = useState(false);

    // Product selection for bulk operations
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

    const toggleProductSelection = (productId: string) => {
        setSelectedProductIds(prev => {
            const next = new Set(prev);
            if (next.has(productId)) next.delete(productId);
            else next.add(productId);
            return next;
        });
    };

    const clearSelection = () => setSelectedProductIds(new Set());

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
            const isUncategorized = !p.category || p.category === '' || p.category === 'Sin Categoría';
            const matchesCategory = activeCategories.length === 0 || activeCategories.includes(p.category) || (activeCategories.includes('Sin Categoría') && isUncategorized);
            const isUnbranded = !p.brand_id || p.brand_id === '';
            const matchesBrand = activeBrands.length === 0 || (p.brand_id && activeBrands.includes(p.brand_id)) || (activeBrands.includes('Sin Marca') && isUnbranded);
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

    // Bulk selection helpers (must be after filteredProducts)
    const toggleSelectAll = () => {
        if (selectedProductIds.size === filteredProducts.length) {
            setSelectedProductIds(new Set());
        } else {
            setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
        }
    };

    const selectedProducts = useMemo(() =>
        filteredProducts.filter(p => selectedProductIds.has(p.id)),
        [filteredProducts, selectedProductIds]
    );

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
            message: `¿Qué quieres hacer con los productos dentro de "${cat.name}"?`,
            confirmText: 'Solo Carpeta',
            cancelText: 'Vaciarlos y Eliminar',
            variant: 'danger'
        });

        // Use custom confirmation for the second option since showConfirm might be binary
        if (confirmed !== null) {
            await deleteCategory(cat.id, !confirmed);
            // Wait for category to be deleted from store as well
            if (activeCategories.includes(cat.name)) {
                setActiveCategories(prev => prev.filter(c => c !== cat.name));
            }
        }
    };

    const handleBulkDelete = async () => {
        const confirmed = await showConfirm({
            title: '¿Eliminar productos seleccionados?',
            message: `Borrarás ${selectedProductIds.size} productos permanentemente. Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar Todo',
            variant: 'danger'
        });
        if (confirmed) {
            await bulkDeleteProducts(Array.from(selectedProductIds));
            clearSelection();
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

    // Render category options with hierarchy indentation
    const renderCategoryOptions = (categories: typeof categoriesData, level: number): React.ReactNode => {
        return categories.map(cat => (
            <React.Fragment key={cat.id}>
                <label className="filter-option category-option" style={{ '--indent-level': level } as React.CSSProperties}>
                    <input
                        type="checkbox"
                        checked={activeCategories.includes(cat.name)}
                        onChange={(e) => {
                            if (e.target.checked) setActiveCategories([...activeCategories, cat.name]);
                            else setActiveCategories(activeCategories.filter(a => a !== cat.name));
                        }}
                    />
                    {activeCategories.includes(cat.name) ? (
                        <CheckSquare size={16} className="filter-checkbox checked" />
                    ) : (
                        <Square size={16} className="filter-checkbox" />
                    )}
                    {level > 0 && <span className="category-indent">└ </span>}
                    <span className="filter-option-text">{cat.name}</span>
                </label>
                {cat.children && cat.children.length > 0 && renderCategoryOptions(cat.children, level + 1)}
            </React.Fragment>
        ));
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
                    {/* Stats Cards */}
                    <div className="stats-cards-grid">
                        <div className="stat-card">
                            <div className="stat-icon stat-icon-primary">
                                <Package size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{products?.length || 0}</span>
                                <span className="stat-label">Total Productos</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon stat-icon-success">
                                <TrendingUp size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{filteredProducts.length}</span>
                                <span className="stat-label">Mostrando</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon stat-icon-warning">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{products?.filter(p => p.stock <= p.min).length || 0}</span>
                                <span className="stat-label">Stock Bajo</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon stat-icon-dollar">
                                <DollarSign size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">${(products?.reduce((sum, p) => sum + (p.price * p.stock), 0) || 0).toLocaleString()}</span>
                                <span className="stat-label">Valor Inventario</span>
                            </div>
                        </div>
                    </div>

                    {/* Unified Toolbar */}
                    <div className="unified-toolbar">
                        <div className="toolbar-header">
                            <div className="toolbar-header-left">
                                <div className="toolbar-title-wrapper">
                                    <h1 className="toolbar-title">
                                        <Package size={28} className="toolbar-title-icon" />
                                        Catálogo de Productos
                                    </h1>
                                    <span className="toolbar-subtitle">
                                        {filteredProducts.length} de {products?.length || 0} productos
                                    </span>
                                </div>
                            </div>
                            <div className="toolbar-header-right">
                                <div className="more-actions-dropdown relative">
                                    <button
                                        className={`toolbar-btn ${showMoreMenu ? 'active' : ''}`}
                                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                                        title="Más acciones"
                                    >
                                        <MoreVertical size={20} />
                                    </button>
                                    {showMoreMenu && (
                                        <>
                                            <div className="dropdown-overlay" onClick={() => setShowMoreMenu(false)} />
                                            <div className="dropdown-menu">
                                                <button className="dropdown-item" onClick={() => { setIsPriceHistoryOpen(true); setShowMoreMenu(false); }}>
                                                    <TrendingUp size={18} /> Ver Historial de Precios
                                                </button>
                                                <button className="dropdown-item" onClick={() => { setShowImportModal(true); setShowMoreMenu(false); }}>
                                                    <Upload size={18} /> Importar Productos
                                                </button>
                                                <div className="dropdown-divider"></div>
                                                <button className="dropdown-item" onClick={() => { setIsBulkUpdateOpen(true); setShowMoreMenu(false); }}>
                                                    <Tag size={18} /> Actualizar Precios Masivamente
                                                </button>
                                                <button className="dropdown-item" onClick={() => { handlePrint(); setShowMoreMenu(false); }}>
                                                    <FileDown size={18} /> Descargar Catálogo PDF
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button
                                    className="toolbar-btn"
                                    onClick={() => setIsCategoryModalOpen(true)}
                                    title="Administrar categorías"
                                >
                                    <Settings size={20} />
                                    <span className="btn-text">Carpetas</span>
                                </button>
                                <button className="btn btn-primary" onClick={handleNewProduct}>
                                    <Plus size={20} />
                                    <span className="btn-text">Nuevo Producto</span>
                                </button>
                            </div>
                        </div>

                        {/* Filters Bar */}
                        <div className="toolbar-filters">
                            {/* Search */}
                            <div className="search-input-wrapper">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o código..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="search-input"
                                />
                                {searchTerm && (
                                    <button className="clear-search" onClick={() => setSearchTerm('')}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Category Filter */}
                            <div className="filter-dropdown-wrapper">
                                <button
                                    className={`filter-dropdown-btn ${activeCategories.length > 0 ? 'active' : ''}`}
                                    onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                >
                                    <Folder size={16} />
                                    <span className="filter-label">
                                        {activeCategories.length === 0 ? 'Categorías' : `${activeCategories.length}`}
                                    </span>
                                    {activeCategories.length > 0 && (
                                        <span className="filter-badge">{activeCategories.length}</span>
                                    )}
                                </button>
                                {isCategoryDropdownOpen && (
                                    <>
                                        <div className="dropdown-overlay" onClick={() => setIsCategoryDropdownOpen(false)} />
                                        <div className="filter-dropdown">
                                            <div className="filter-dropdown-header">
                                                <span>Categorías</span>
                                                <button
                                                    className="clear-filter-btn"
                                                    onClick={() => { setActiveCategories([]); setIsCategoryDropdownOpen(false); }}
                                                >
                                                    Limpiar
                                                </button>
                                            </div>
                                            <div className="filter-dropdown-content">
                                                {renderCategoryOptions(categoriesData, 0)}
                                                <label className="filter-option">
                                                    <input
                                                        type="checkbox"
                                                        checked={activeCategories.includes('Sin Categoría')}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setActiveCategories([...activeCategories, 'Sin Categoría']);
                                                            else setActiveCategories(activeCategories.filter(a => a !== 'Sin Categoría'));
                                                        }}
                                                    />
                                                    {activeCategories.includes('Sin Categoría') ? (
                                                        <CheckSquare size={16} className="filter-checkbox checked" />
                                                    ) : (
                                                        <Square size={16} className="filter-checkbox" />
                                                    )}
                                                    <span className="filter-option-text">Sin Categoría</span>
                                                </label>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Brand Filter */}
                            <div className="filter-dropdown-wrapper">
                                <button
                                    className={`filter-dropdown-btn ${activeBrands.length > 0 ? 'active' : ''}`}
                                    onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                                >
                                    <Tag size={16} />
                                    <span className="filter-label">
                                        {activeBrands.length === 0 ? 'Marcas' : `${activeBrands.length}`}
                                    </span>
                                    {activeBrands.length > 0 && (
                                        <span className="filter-badge">{activeBrands.length}</span>
                                    )}
                                </button>
                                {isBrandDropdownOpen && (
                                    <>
                                        <div className="dropdown-overlay" onClick={() => setIsBrandDropdownOpen(false)} />
                                        <div className="filter-dropdown">
                                            <div className="filter-dropdown-header">
                                                <span>Marcas</span>
                                                <button
                                                    className="clear-filter-btn"
                                                    onClick={() => { setActiveBrands([]); setIsBrandDropdownOpen(false); }}
                                                >
                                                    Limpiar
                                                </button>
                                            </div>
                                            <div className="filter-dropdown-content">
                                                {brands.map(b => (
                                                    <label key={b.id} className="filter-option">
                                                        <input
                                                            type="checkbox"
                                                            checked={activeBrands.includes(b.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setActiveBrands([...activeBrands, b.id]);
                                                                else setActiveBrands(activeBrands.filter(a => a !== b.id));
                                                            }}
                                                        />
                                                        {activeBrands.includes(b.id) ? (
                                                            <CheckSquare size={16} className="filter-checkbox checked" />
                                                        ) : (
                                                            <Square size={16} className="filter-checkbox" />
                                                        )}
                                                        <span className="filter-option-text">{b.name}</span>
                                                    </label>
                                                ))}
                                                <label className="filter-option">
                                                    <input
                                                        type="checkbox"
                                                        checked={activeBrands.includes('Sin Marca')}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setActiveBrands([...activeBrands, 'Sin Marca']);
                                                            else setActiveBrands(activeBrands.filter(a => a !== 'Sin Marca'));
                                                        }}
                                                    />
                                                    {activeBrands.includes('Sin Marca') ? (
                                                        <CheckSquare size={16} className="filter-checkbox checked" />
                                                    ) : (
                                                        <Square size={16} className="filter-checkbox" />
                                                    )}
                                                    <span className="filter-option-text">Sin Marca</span>
                                                </label>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Sort Controls */}
                            <div className="sort-controls-wrapper">
                                <select
                                    className="sort-select"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                >
                                    <option value="name">Ordenar: Nombre</option>
                                    <option value="code">Ordenar: Código</option>
                                    <option value="price">Ordenar: Precio</option>
                                    <option value="stock">Ordenar: Stock</option>
                                </select>
                                <button
                                    className="sort-direction-btn"
                                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                    title={sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
                                >
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                </button>
                            </div>

                            {/* View Toggle */}
                            <div className="view-toggle">
                                <button
                                    className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                    onClick={() => setViewMode('grid')}
                                    title="Vista de Tabla"
                                >
                                    <Grid3x3 size={18} />
                                    <span className="view-toggle-label">Tabla</span>
                                </button>
                                <button
                                    className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                                    onClick={() => setViewMode('list')}
                                    title="Vista de Lista"
                                >
                                    <List size={18} />
                                    <span className="view-toggle-label">Lista</span>
                                </button>
                            </div>

                            {/* Bulk Actions */}
                            {selectedProductIds.size > 0 && (
                                <div className="bulk-actions-toolbar flex items-center gap-2">
                                    <button
                                        className="btn-bulk-edit"
                                        onClick={() => setShowBulkEditModal(true)}
                                    >
                                        <Check size={16} />
                                        Editar {selectedProductIds.size}
                                    </button>
                                    <button
                                        className="btn-bulk-delete"
                                        onClick={handleBulkDelete}
                                    >
                                        <Trash2 size={16} />
                                        Eliminar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Products Display */}
                    <div className="products-display-card">
                        {filteredProducts.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <Package size={80} />
                                </div>
                                <h2 className="empty-state-title">No se encontraron productos</h2>
                                <p className="empty-state-description">
                                    {searchTerm || activeCategories.length > 0 || activeBrands.length > 0
                                        ? 'Intenta ajustar los filtros de búsqueda'
                                        : 'Comienza agregando tu primer producto al catálogo'}
                                </p>
                                {(!searchTerm && activeCategories.length === 0 && activeBrands.length === 0) && (
                                    <button className="btn btn-primary btn-lg" onClick={handleNewProduct}>
                                        <Plus size={20} />
                                        Agregar Producto
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="products-content">
                                {viewMode === 'grid' ? (
                                    <table className="products-table">
                                        <thead>
                                            <tr>
                                                <th className="col-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                                                        onChange={toggleSelectAll}
                                                        className="bulk-checkbox"
                                                    />
                                                </th>
                                                <th className="col-code">CÓDIGO</th>
                                                <th className="col-product">PRODUCTO</th>
                                                <th className="col-category">CATEGORÍA</th>
                                                <th className="col-cost text-right">COSTO</th>
                                                <th className="col-price text-right">PRECIO</th>
                                                <th className="col-stock text-center">STOCK</th>
                                                <th className="col-actions text-right">ACCIONES</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredProducts.map((p, index) => (
                                                <tr key={p.id} className={`product-row ${p.stock <= p.min ? 'low-stock' : ''} ${selectedProductIds.has(p.id) ? 'selected-row' : ''}`} style={{ animationDelay: `${index * 0.03}s` }}>
                                                    <td className="col-checkbox">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedProductIds.has(p.id)}
                                                            onChange={() => toggleProductSelection(p.id)}
                                                            className="bulk-checkbox"
                                                        />
                                                    </td>
                                                    <td className="col-code">
                                                        <span className="code-text">{p.code}</span>
                                                    </td>
                                                    <td className="col-product">
                                                        <div className="product-info">
                                                            <span className="product-name">{p.name}</span>
                                                            {p.brand_name && (
                                                                <span className="product-brand">{p.brand_name}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="col-category">
                                                        {p.category_name || p.category ? (
                                                            <span className="category-badge">
                                                                <Folder size={12} />
                                                                {p.category_name || p.category}
                                                            </span>
                                                        ) : (
                                                            <span className="category-badge" style={{ color: '#9CA3AF', background: '#F9FAFB' }}>
                                                                Sin categoría
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="col-cost text-right">
                                                        <span className="cost-value">${p.cost?.toLocaleString() || '-'}</span>
                                                    </td>
                                                    <td className="col-price text-right">
                                                        <span className="price-value">${p.price.toLocaleString()}</span>
                                                    </td>
                                                    <td className="col-stock text-center">
                                                        <span className={`stock-badge ${p.stock <= p.min ? 'low' : 'ok'}`}>
                                                            {p.stock}
                                                        </span>
                                                    </td>
                                                    <td className="col-actions text-right">
                                                        <div className="action-buttons">
                                                            <button
                                                                className="action-btn delete"
                                                                onClick={() => handleDeleteProduct(p)}
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={18} strokeWidth={2} />
                                                            </button>
                                                            <button
                                                                className="action-btn barcode"
                                                                onClick={() => requireFeature('barcode', () => { setProductForBarcode(p); setShowBarcodePrinter(true); })}
                                                                title="Código de barras"
                                                            >
                                                                <Barcode size={18} strokeWidth={2} />
                                                            </button>
                                                            <button
                                                                className="action-btn edit"
                                                                onClick={() => { setProductToEdit(p); setIsModalOpen(true); }}
                                                                title="Editar"
                                                            >
                                                                <Edit2 size={18} strokeWidth={2} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="list-view">
                                        {filteredProducts.map((p, index) => (
                                            <div key={p.id} className="list-item-card" style={{ animationDelay: `${index * 0.03}s` }}>
                                                <div className="list-item-main">
                                                    <div className="list-item-header">
                                                        <div className="list-item-title-group">
                                                            <h4 className="list-item-name">{p.name}</h4>
                                                            {p.brand_name && (
                                                                <span className="list-item-brand">{p.brand_name}</span>
                                                            )}
                                                        </div>
                                                        <span className={`stock-badge ${p.stock <= p.min ? 'low' : 'ok'}`}>
                                                            {p.stock} unid.
                                                        </span>
                                                    </div>
                                                    <div className="list-item-details">
                                                        <div className="list-item-meta">
                                                            <span className="meta-item">
                                                                <span className="meta-label">Código:</span>
                                                                <span className="meta-value">{p.code}</span>
                                                            </span>
                                                            <span className="meta-item">
                                                                {p.category_name || p.category ? (
                                                                    <span className="category-badge">
                                                                        <Folder size={12} />
                                                                        {p.category_name || p.category}
                                                                    </span>
                                                                ) : (
                                                                    <span className="category-badge" style={{ color: '#9CA3AF', background: '#F9FAFB' }}>
                                                                        Sin categoría
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <span className="meta-item">
                                                                <span className="meta-label">Costo:</span>
                                                                <span className="meta-value">${p.cost?.toLocaleString() || '-'}</span>
                                                            </span>
                                                        </div>
                                                        <div className="list-item-price">
                                                            <span className="price-label">Precio</span>
                                                            <span className="price-amount">${p.price.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="list-item-actions">
                                                    <button
                                                        className="list-action-btn delete"
                                                        onClick={() => handleDeleteProduct(p)}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={18} strokeWidth={2} />
                                                    </button>
                                                    <button
                                                        className="list-action-btn barcode"
                                                        onClick={() => requireFeature('barcode', () => { setProductForBarcode(p); setShowBarcodePrinter(true); })}
                                                        title="Código de barras"
                                                    >
                                                        <Barcode size={18} strokeWidth={2} />
                                                    </button>
                                                    <button
                                                        className="list-action-btn edit"
                                                        onClick={() => { setProductToEdit(p); setIsModalOpen(true); }}
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={18} strokeWidth={2} />
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

            {/* Bulk Edit Modal */}
            <BulkEditModal
                selectedProducts={selectedProducts}
                isOpen={showBulkEditModal}
                onClose={() => { setShowBulkEditModal(false); clearSelection(); }}
            />

            <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '100%' }}>
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
                                <Folder size={24} className="text-primary" /> Administrar Carpetas
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

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Plus, Upload, FileDown, Folder, Tag, Grid3x3, List,
    MoreVertical, Edit2, Barcode, Trash2, Settings, X, CheckSquare,
    Square, TrendingUp, Package, DollarSign, AlertTriangle, Check,
    ChevronRight, ChevronDown
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
    const customFilters = useStore((state) => state.customFilters);

    const loadProducts = useStore((state) => state.loadProducts);
    const loadCategories = useStore((state) => state.loadCategories);
    const loadBrands = useStore((state) => state.loadBrands);
    const loadSuppliers = useStore((state) => state.loadSuppliers);
    const loadCustomFilters = useStore((state) => state.loadCustomFilters);

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
                    loadSuppliers(),
                    loadCustomFilters()
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
    const [activeCustomFilters, setActiveCustomFilters] = useState<Record<string, string[]>>({});
    const [openFilterDropdownId, setOpenFilterDropdownId] = useState<string | null>(null);
    const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
    
    // Custom filter creation state
    const [isCreateFilterModalOpen, setIsCreateFilterModalOpen] = useState(false);
    const [newFilterName, setNewFilterName] = useState('');
    const [newOptionValue, setNewOptionValue] = useState('');
    const addCustomFilter = useStore((state) => state.addCustomFilter);
    const addCustomFilterOption = useStore((state) => state.addCustomFilterOption);

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

    // Helper to get all sub-categories recursively
    const getAllSubCategoryNames = (catName: string): string[] => {
        const result: string[] = [];
        const findAndAddChildren = (list: Category[]) => {
            for (const c of list) {
                if (c.name.toLowerCase() === catName.toLowerCase()) {
                    const addDescendants = (children: Category[]) => {
                        for (const child of children) {
                            result.push(child.name);
                            if (child.children && child.children.length > 0) {
                                addDescendants(child.children);
                            }
                        }
                    };
                    if (c.children && c.children.length > 0) {
                        addDescendants(c.children);
                    }
                    return true;
                }
                if (c.children && c.children.length > 0) {
                    if (findAndAddChildren(c.children)) return true;
                }
            }
            return false;
        };
        findAndAddChildren(categoriesData);
        return result;
    };

    const allActiveCategoriesWithSubs = useMemo(() => {
        const allSet = new Set<string>();
        for (const catName of activeCategories) {
            allSet.add(catName);
            const subs = getAllSubCategoryNames(catName);
            subs.forEach(s => allSet.add(s));
        }
        return Array.from(allSet);
    }, [activeCategories, categoriesData]);

    // Filtered Products
    const filteredProducts = useMemo(() => {
        if (!products) return [];
        let result = products.filter(p => {
            const isUncategorized = !p.category || p.category === '' || p.category === 'Sin Categoría';
            const matchesCategory = allActiveCategoriesWithSubs.length === 0 || allActiveCategoriesWithSubs.includes(p.category) || (allActiveCategoriesWithSubs.includes('Sin Categoría') && isUncategorized);
            const isUnbranded = !p.brand_id || p.brand_id === '';
            const matchesBrand = activeBrands.length === 0 || (p.brand_id && activeBrands.includes(p.brand_id)) || (activeBrands.includes('Sin Marca') && isUnbranded);
            const matchesSearch = p.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (p.code || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());

            const matchesCustomFilters = Object.entries(activeCustomFilters).every(([, optionIds]) => {
                if (!optionIds || optionIds.length === 0) return true;
                const pOpts = (p as any).custom_filter_options || [];
                return optionIds.some(optId => pOpts.includes(optId));
            });

            return matchesCategory && matchesBrand && matchesSearch && matchesCustomFilters;
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
    }, [products, activeCategories, activeBrands, activeCustomFilters, debouncedSearchTerm, sortBy, sortOrder]);

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

    const renderCategoryOptions = (categories: typeof categoriesData, level: number): React.ReactNode => {
        return categories.map(cat => {
            const hasChildren = cat.children && cat.children.length > 0;
            const isExpanded = expandedCategoryIds.includes(cat.id);
            
            return (
                <React.Fragment key={cat.id}>
                    <div className="flex items-center w-full" style={{ paddingLeft: `${level * 12}px`, marginBottom: '2px' }}>
                        {hasChildren ? (
                            <button
                                type="button"
                                className="category-filter-toggle"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setExpandedCategoryIds(prev => 
                                        prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                                    );
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#6B7280',
                                    borderRadius: '6px',
                                    transition: 'all 0.2s',
                                    marginRight: '2px'
                                }}
                            >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        ) : (
                            <span style={{ width: '26px' }} />
                        )}
                        <label 
                            className="filter-option flex-1" 
                            style={{ 
                                margin: 0, 
                                padding: '0.5rem 0.75rem', 
                                display: 'flex', 
                                alignItems: 'center',
                                gap: '0.5rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={activeCategories.includes(cat.name)}
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    if (e.target.checked) setActiveCategories([...activeCategories, cat.name]);
                                    else setActiveCategories(activeCategories.filter(a => a !== cat.name));
                                }}
                            />
                            {activeCategories.includes(cat.name) ? (
                                <CheckSquare size={16} className="filter-checkbox checked" style={{ color: '#4F7A5A' }} />
                            ) : (
                                <Square size={16} className="filter-checkbox" style={{ color: '#9CA3AF' }} />
                            )}
                            <span className="filter-option-text" style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>{cat.name}</span>
                        </label>
                    </div>
                    {hasChildren && isExpanded && renderCategoryOptions(cat.children || [], level + 1)}
                </React.Fragment>
            );
        });
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
            <div className={`products-layout ${isSidebarOpen ? 'with-sidebar' : ''}`}>
                {/* Sidebar */}
                <aside className={`products-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                    <div className="sidebar-header">
                        <h3 className="sidebar-title">Carpetas</h3>
                        <button className="sidebar-toggle-inner" onClick={() => setIsSidebarOpen(false)}>
                            <X size={18} />
                        </button>
                    </div>
                    <div className="sidebar-content">
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
                        
                        <div className="sidebar-extra-filters">
                            <h3 className="sidebar-title mt-6">Otras Carpetas</h3>
                            <label className="sidebar-filter-option">
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
                </aside>

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
                        <header className="toolbar-header">
                            <div className="toolbar-header-left">
                                <div className="toolbar-title-wrapper">
                                    <h1 className="toolbar-title">
                                        {!isSidebarOpen && (
                                            <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(true)}>
                                                <Folder size={20} />
                                            </button>
                                        )}
                                        <TrendingUp className="toolbar-title-icon" size={32} />
                                        Stock de Productos
                                    </h1>
                                    <span className="toolbar-subtitle">
                                        Mostrando {filteredProducts.length} de {products.length} productos
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
                        </header>

                        {/* Filters Bar */}
                        <div className="toolbar-filters">
                            {/* Clear All Filters Button */}
                            {(searchTerm || activeCategories.length > 0 || activeBrands.length > 0 || Object.values(activeCustomFilters).some(v => v.length > 0)) && (
                                <button 
                                    className="clear-all-filters-btn"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setActiveCategories([]);
                                        setActiveBrands([]);
                                        setActiveCustomFilters({});
                                        setOpenFilterDropdownId(null);
                                    }}
                                >
                                    <X size={14} />
                                    <span>Limpiar Filtros</span>
                                </button>
                            )}

                            {/* Search */}
                            <div className="search-input-wrapper">
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o código..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="search-input no-icon"
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
                                        {activeCategories.length === 0 ? 'Categorías' : `Carpetas (${activeCategories.length})`}
                                    </span>
                                    {activeCategories.length > 0 && (
                                        <div 
                                            className="filter-quick-clear"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveCategories([]);
                                            }}
                                        >
                                            <X size={12} />
                                        </div>
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
                                        {activeBrands.length === 0 ? 'Marcas' : `Marcas (${activeBrands.length})`}
                                    </span>
                                    {activeBrands.length > 0 && (
                                        <div 
                                            className="filter-quick-clear"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveBrands([]);
                                            }}
                                        >
                                            <X size={12} />
                                        </div>
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

                            {/* Custom Filters */}
                            {(customFilters || []).map(cf => {
                                const activeOpts = activeCustomFilters[cf.id] || [];
                                const isOpen = openFilterDropdownId === cf.id;
                                
                                return (
                                    <div key={cf.id} className="filter-dropdown-wrapper">
                                        <button
                                            className={`filter-dropdown-btn ${activeOpts.length > 0 ? 'active' : ''}`}
                                            onClick={() => setOpenFilterDropdownId(isOpen ? null : cf.id)}
                                        >
                                            <Tag size={16} />
                                            <span className="filter-label">
                                                {activeOpts.length === 0 ? cf.name : `${cf.name} (${activeOpts.length})`}
                                            </span>
                                            {activeOpts.length > 0 && (
                                                <div 
                                                    className="filter-quick-clear"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveCustomFilters(prev => ({ ...prev, [cf.id]: [] }));
                                                    }}
                                                >
                                                    <X size={12} />
                                                </div>
                                            )}
                                        </button>
                                        {isOpen && (
                                            <>
                                                <div className="dropdown-overlay" onClick={() => setOpenFilterDropdownId(null)} />
                                                <div className="filter-dropdown">
                                                    <div className="filter-dropdown-header">
                                                        <span>{cf.name}</span>
                                                        <button
                                                            className="clear-filter-btn"
                                                            onClick={() => { 
                                                                setActiveCustomFilters(prev => ({ ...prev, [cf.id]: [] })); 
                                                                setOpenFilterDropdownId(null); 
                                                            }}
                                                        >
                                                            Limpiar
                                                        </button>
                                                    </div>
                                                    <div className="filter-dropdown-content">
                                                        {(cf.options || []).map(opt => (
                                                            <label key={opt.id} className="filter-option">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={activeOpts.includes(opt.id)}
                                                                    onChange={(e) => {
                                                                        const next = e.target.checked 
                                                                            ? [...activeOpts, opt.id] 
                                                                            : activeOpts.filter(o => o !== opt.id);
                                                                        setActiveCustomFilters(prev => ({ ...prev, [cf.id]: next }));
                                                                    }}
                                                                />
                                                                {activeOpts.includes(opt.id) ? (
                                                                    <CheckSquare size={16} className="filter-checkbox checked" />
                                                                ) : (
                                                                    <Square size={16} className="filter-checkbox" />
                                                                )}
                                                                <span className="filter-option-text">{opt.value}</span>
                                                            </label>
                                                        ))}
                                                        
                                                        {/* Add Option */}
                                                        <div style={{ padding: '0.5rem', borderTop: '1px solid #E5E7EB', display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                            <input 
                                                                type="text" 
                                                                placeholder="Nueva opción..."
                                                                value={newOptionValue}
                                                                onChange={(e) => setNewOptionValue(e.target.value)}
                                                                style={{ padding: '0.25rem', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '0.875rem', width: '100%' }}
                                                            />
                                                            <button 
                                                                onClick={async () => {
                                                                    if (newOptionValue.trim()) {
                                                                        await addCustomFilterOption(cf.id, newOptionValue.trim());
                                                                        setNewOptionValue('');
                                                                    }
                                                                }}
                                                                style={{ padding: '0.25rem 0.5rem', background: '#4F7A5A', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Add Custom Filter Button */}
                            {(customFilters || []).length < 10 && (
                                <button
                                    className="filter-dropdown-btn"
                                    onClick={() => setIsCreateFilterModalOpen(true)}
                                    title="Agregar nuevo filtro"
                                    style={{ borderStyle: 'dashed', borderColor: '#D1D5DB' }}
                                >
                                    <Plus size={16} />
                                    <span className="filter-label">Filtro</span>
                                </button>
                            )}

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
                                                        {p.category ? (
                                                            <span className="category-badge">
                                                                <Folder size={12} />
                                                                {p.category}
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
                                                                {p.category ? (
                                                                    <span className="category-badge">
                                                                        <Folder size={12} />
                                                                        {p.category}
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
            {/* Create Custom Filter Modal */}
            {isCreateFilterModalOpen && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal-container" style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>Crear Filtro Personalizado</h3>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Nombre del Filtro</label>
                            <input 
                                type="text" 
                                value={newFilterName}
                                onChange={(e) => setNewFilterName(e.target.value)}
                                placeholder="Ej: Color, Tamaño, Temporada..."
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button 
                                onClick={() => {
                                    setIsCreateFilterModalOpen(false);
                                    setNewFilterName('');
                                }}
                                style={{ padding: '0.5rem 1rem', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer', color: '#374151' }}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={async () => {
                                    if (newFilterName.trim()) {
                                        await addCustomFilter(newFilterName.trim());
                                        setIsCreateFilterModalOpen(false);
                                        setNewFilterName('');
                                    }
                                }}
                                style={{ padding: '0.5rem 1rem', background: '#4F7A5A', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                disabled={!newFilterName.trim()}
                            >
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}
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

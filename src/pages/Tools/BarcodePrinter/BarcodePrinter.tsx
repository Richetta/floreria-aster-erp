import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store/useStore';
import type { Category } from '../../../store/slices/types';
import { 
    ChevronRight, ChevronDown, Folder, FolderOpen, 
    Package, Plus, Trash2, Search, ArrowLeft,
    X, Printer
} from 'lucide-react';
import { getSavedLabelLayout } from '../../../components/LabelEditor/LabelLayoutConfig';
import { PrintableLabel } from '../../../components/LabelEditor/PrintableLabel';
import './BarcodePrinter.css';

type LabelConfig = {
    paperSize: 'a4' | 'carta' | 'rollo' | 'custom';
    paperW: number; paperH: number;
    labelW: number; labelH: number;
    labelPreset: 'small' | 'medium' | 'large' | 'xl' | 'custom';
    format: 'CODE128' | 'EAN13' | 'CODE39';
    showName: boolean; showPrice: boolean; showCode: boolean;
    marginTop: number; marginLeft: number;
    gapH: number; gapV: number;
};

type SelectedProduct = { id: string; name: string; barcode: string; price: number; category: string; qty: number };

const LABEL_PRESETS: Record<string, { w: number; h: number; label: string }> = {
    small: { w: 38, h: 21, label: 'Pequeña (38×21mm)' },
    medium: { w: 50, h: 25, label: 'Mediana (50×25mm)' },
    large: { w: 70, h: 35, label: 'Grande (70×35mm)' },
    xl: { w: 100, h: 50, label: 'XL (100×50mm)' },
};

const PAPER_PRESETS: Record<string, { w: number; h: number; label: string }> = {
    a4: { w: 210, h: 297, label: 'A4 (210×297mm)' },
    carta: { w: 216, h: 279, label: 'Carta (216×279mm)' },
    rollo: { w: 80, h: 297, label: 'Rollo (80mm ancho)' },
};

const defaultConfig: LabelConfig = {
    paperSize: 'a4', paperW: 210, paperH: 297,
    labelW: 50, labelH: 25, labelPreset: 'medium',
    format: 'CODE128', showName: true, showPrice: true, showCode: false,
    marginTop: 10, marginLeft: 7, gapH: 3, gapV: 3,
};

export const BarcodePrinter = () => {
    const navigate = useNavigate();
    const products = useStore(s => s.products);
    const categoriesData = useStore(s => s.categoriesData);
    const loadProducts = useStore(s => s.loadProducts);
    const loadCategories = useStore(s => s.loadCategories);

    const [step, setStep] = useState(1);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<SelectedProduct[]>([]);
    const [config, setConfig] = useState<LabelConfig>(defaultConfig);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadProducts(); loadCategories(true); }, []);

    // Build recursive category tree
    const catTree = useMemo(() => {
        if (!categoriesData || categoriesData.length === 0) return [];

        // Check if data is already nested
        const isAlreadyNested = categoriesData.some(c => c.children && c.children.length > 0);
        if (isAlreadyNested) return categoriesData;

        // Otherwise build tree from flat list
        const buildTree = (parentId: string | null = null): any[] => {
            return categoriesData
                .filter(c => c.parent_id === parentId || (parentId === null && !c.parent_id))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(c => ({
                    ...c,
                    children: buildTree(c.id)
                }));
        };
        return buildTree(null).sort((a, b) => a.name.localeCompare(b.name));
    }, [categoriesData]);

    // Products filtered by search
    const filteredProducts = useMemo(() => {
        const s = search.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(s) || (p.barcode || '').includes(s) || p.code.includes(s)
        );
    }, [products, search]);

    // Auto-expand tree when searching
    useEffect(() => {
        if (search) {
            const newExpanded = new Set<string>();
            const addParents = (cat: Category) => {
                newExpanded.add(cat.id);
                if (cat.parent_id) {
                    const parent = categoriesData.find(c => c.id === cat.parent_id);
                    if (parent) addParents(parent);
                }
            };

            categoriesData.forEach(c => {
                const hasMatch = filteredProducts.some(p => p.category === c.name);
                if (hasMatch) addParents(c);
            });
            if (newExpanded.size > 0) setExpandedIds(prev => new Set([...Array.from(prev), ...Array.from(newExpanded)]));
        }
    }, [search, filteredProducts, categoriesData]);

    const isSelected = (id: string) => selected.some(s => s.id === id);

    const toggleProduct = (p: any) => {
        if (isSelected(p.id)) {
            setSelected(prev => prev.filter(s => s.id !== p.id));
        } else {
            setSelected(prev => [...prev, {
                id: p.id, name: p.name, barcode: p.barcode || p.code || p.id,
                price: p.price, category: p.category, qty: 1
            }]);
        }
    };

    // Helper to get all descendants of a category name
    const getDescendants = (catName: string): string[] => {
        const result: string[] = [catName];
        const findChildren = (name: string) => {
            const cat = (categoriesData || []).find(c => c.name === name);
            if (cat) {
                const children = (categoriesData || []).filter(c => c.parent_id === cat.id);
                // Also check if already nested
                const nestedChildren = (cat as any).children || [];
                
                const allChildren = [...children, ...nestedChildren];
                allChildren.forEach(ch => {
                    if (!result.includes(ch.name)) {
                        result.push(ch.name);
                        findChildren(ch.name);
                    }
                });
            }
        };
        findChildren(catName);
        return result;
    };

    const toggleCategoryRecursive = (catName: string) => {
        const catsToToggle = getDescendants(catName);
        const prods = products.filter(p => catsToToggle.includes(p.category));
        const allSelected = prods.length > 0 && prods.every(p => isSelected(p.id));

        if (allSelected) {
            setSelected(prev => prev.filter(s => !prods.some(p => p.id === s.id)));
        } else {
            const toAdd = prods.filter(p => !isSelected(p.id)).map(p => ({
                id: p.id, name: p.name, barcode: p.barcode || p.code || p.id,
                price: p.price, category: p.category, qty: 1
            }));
            setSelected(prev => [...prev, ...toAdd]);
        }
    };

    const useStockQuantities = () => {
        setSelected(prev => prev.map(s => {
            const p = products.find(x => x.id === s.id);
            return p ? { ...s, qty: Math.max(1, Math.floor(p.stock)) } : s;
        }));
    };

    const addStockQuantities = () => {
        setSelected(prev => prev.map(s => {
            const p = products.find(x => x.id === s.id);
            return p ? { ...s, qty: s.qty + Math.max(0, Math.floor(p.stock)) } : s;
        }));
    };

    const updateQty = (id: string, qty: number) => {
        setSelected(prev => prev.map(s => s.id === id ? { ...s, qty: Math.max(1, qty) } : s));
    };

    const totalLabels = selected.reduce((sum, s) => sum + s.qty, 0);

    // Calculate grid
    const cols = Math.floor((config.paperW - config.marginLeft * 2 + config.gapH) / (config.labelW + config.gapH));
    const rows = Math.floor((config.paperH - config.marginTop * 2 + config.gapV) / (config.labelH + config.gapV));
    const labelsPerPage = Math.max(1, cols * rows);
    const totalPages = Math.ceil(totalLabels / labelsPerPage);

    // Build flat label array
    const allLabels = useMemo(() => {
        const arr: SelectedProduct[] = [];
        selected.forEach(s => { for (let i = 0; i < s.qty; i++) arr.push(s); });
        return arr;
    }, [selected]);

    const handlePaperChange = (size: string) => {
        if (size === 'custom') {
            setConfig((c: LabelConfig) => ({ ...c, paperSize: 'custom' as any }));
        } else {
            const p = PAPER_PRESETS[size];
            setConfig((c: LabelConfig) => ({ ...c, paperSize: size as any, paperW: p.w, paperH: p.h }));
        }
    };

    const handleLabelPreset = (preset: string) => {
        if (preset === 'custom') {
            setConfig((c: LabelConfig) => ({ ...c, labelPreset: 'custom' as any }));
        } else {
            const p = LABEL_PRESETS[preset];
            setConfig((c: LabelConfig) => ({ ...c, labelPreset: preset as any, labelW: p.w, labelH: p.h }));
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="barcode-printer-page">
            {/* Header */}
            <div className="bp-header">
                <button className="bp-back" onClick={() => step === 1 ? navigate('/herramientas') : setStep(s => s - 1)}>
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1>Imprimir Códigos de Barra</h1>
                    <p className="bp-subtitle">Paso {step} de 3 — {step === 1 ? 'Seleccionar productos' : step === 2 ? 'Configurar etiquetas' : 'Vista previa'}</p>
                </div>
            </div>

            {/* Stepper */}
            <div className="bp-stepper">
                {[1, 2, 3].map(s => (
                    <div key={s} className={`bp-step ${step === s ? 'active' : step > s ? 'done' : ''}`}>
                        <div className="bp-step-dot">{step > s ? '✓' : s}</div>
                        <span>{s === 1 ? 'Productos' : s === 2 ? 'Configurar' : 'Imprimir'}</span>
                    </div>
                ))}
            </div>

            {/* STEP 1: Select Products */}
            {step === 1 && (
                <div className="bp-step1">
                    <div className="bp-selector-panel">
                        <div className="bp-search">
                            <Search size={18} />
                            <input placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        <div className="bp-cat-tree">
                            <div className="bp-tree-header">
                                <button className="bp-select-all" onClick={() => {
                                    if (selected.length === products.length) setSelected([]);
                                    else setSelected(products.map(p => ({
                                        id: p.id, name: p.name, barcode: p.barcode || p.code || p.id,
                                        price: p.price, category: p.category, qty: 1
                                    })));
                                }}>
                                    {selected.length === products.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                                </button>
                            </div>

                            <div className="bp-tree-content">
                                {catTree.map(cat => (
                                    <CategoryFolder
                                        key={cat.id}
                                        cat={cat}
                                        level={0}
                                        products={products}
                                        filteredProducts={filteredProducts}
                                        isSelected={isSelected}
                                        toggleProduct={toggleProduct}
                                        toggleCategory={toggleCategoryRecursive}
                                        expandedIds={expandedIds}
                                        setExpandedIds={setExpandedIds}
                                    />
                                ))}

                                {/* Products without category */}
                                {(() => {
                                    const uncategorized = filteredProducts.filter(p => !p.category || p.category === '' || p.category === 'Sin Categoría');
                                    if (uncategorized.length === 0) return null;
                                    const isUncatExpanded = expandedIds.has('uncategorized');
                                    
                                    const toggleUncat = () => {
                                        const next = new Set(expandedIds);
                                        if (isUncatExpanded) next.delete('uncategorized');
                                        else next.add('uncategorized');
                                        setExpandedIds(next);
                                    };

                                    return (
                                        <div className="bp-cat-group uncategorized">
                                            <div className="bp-cat-header">
                                                <button className="bp-expand-btn" onClick={toggleUncat}>
                                                    {isUncatExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                </button>
                                                <label className="bp-cat-label">
                                                    <input type="checkbox"
                                                        checked={uncategorized.length > 0 && uncategorized.every(p => isSelected(p.id))}
                                                        onChange={() => toggleCategoryRecursive('Sin Categoría')}
                                                    />
                                                    {isUncatExpanded ? <FolderOpen size={18} /> : <Folder size={18} />}
                                                    Sin categoría <span className="bp-cat-count">({uncategorized.length})</span>
                                                </label>
                                            </div>
                                            {isUncatExpanded && (
                                                <div className="bp-cat-products">
                                                    {uncategorized.map(p => (
                                                        <label key={p.id} className="bp-product-row">
                                                            <input type="checkbox" checked={isSelected(p.id)} onChange={() => toggleProduct(p)} />
                                                            <div className="bp-prod-info">
                                                                <span className="bp-prod-name">{p.name}</span>
                                                                <span className="bp-prod-code">{p.barcode || p.code || p.id}</span>
                                                            </div>
                                                            <span className="bp-prod-stock">Stock: {p.stock}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Selected panel */}
                    <div className="bp-selected-panel">
                        <div className="bp-selected-header">
                            <h3>Seleccionados ({selected.length} productos, {totalLabels} etiquetas)</h3>
                            {selected.length > 0 && (
                                <div className="bp-mass-actions">
                                    <button className="bp-action-btn" onClick={useStockQuantities} title="Setea la cantidad de cada etiqueta igual al stock actual">
                                        <Package size={14} /> Usar Stock
                                    </button>
                                    <button className="bp-action-btn" onClick={addStockQuantities} title="Suma el stock actual a la cantidad seleccionada">
                                        <Plus size={14} /> Sumar Stock
                                    </button>
                                    <button className="bp-action-btn danger" onClick={() => setSelected([])}>
                                        <Trash2 size={14} /> Limpiar
                                    </button>
                                </div>
                            )}
                        </div>
                        {selected.length === 0 ? (
                            <div className="bp-empty">Seleccioná productos del panel izquierdo</div>
                        ) : (
                            <div className="bp-selected-list">
                                {selected.map(s => (
                                    <div key={s.id} className="bp-selected-item">
                                        <div className="bp-sel-info">
                                            <span className="bp-sel-name">{s.name}</span>
                                            <span className="bp-sel-code">{s.barcode}</span>
                                        </div>
                                        <div className="bp-sel-qty">
                                            <button onClick={() => updateQty(s.id, s.qty - 1)}>−</button>
                                            <input type="number" value={s.qty} min={1}
                                                onChange={e => updateQty(s.id, parseInt(e.target.value) || 1)} />
                                            <button onClick={() => updateQty(s.id, s.qty + 1)}>+</button>
                                        </div>
                                        <button className="bp-sel-remove" onClick={() => setSelected(prev => prev.filter(x => x.id !== s.id))}>
                                            <X size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button className="bp-next-btn" disabled={selected.length === 0} onClick={() => setStep(2)}>
                            Siguiente → Configurar
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 2: Configure */}
            {step === 2 && (
                <div className="bp-step2">
                    <div className="bp-config-section">
                        <h3>📄 Tipo de Hoja</h3>
                        <div className="bp-config-row">
                            {Object.entries(PAPER_PRESETS).map(([k, v]) => (
                                <button key={k} className={`bp-option ${config.paperSize === k ? 'active' : ''}`}
                                    onClick={() => handlePaperChange(k)}>{v.label}</button>
                            ))}
                            <button className={`bp-option ${config.paperSize === 'custom' ? 'active' : ''}`}
                                onClick={() => handlePaperChange('custom')}>Personalizado</button>
                        </div>
                        {config.paperSize === 'custom' && (
                            <div className="bp-custom-size">
                                <label>Ancho (mm) <input type="number" value={config.paperW}
                                    onChange={e => setConfig((c: LabelConfig) => ({ ...c, paperW: +e.target.value }))} /></label>
                                <label>Alto (mm) <input type="number" value={config.paperH}
                                    onChange={e => setConfig((c: LabelConfig) => ({ ...c, paperH: +e.target.value }))} /></label>
                            </div>
                        )}
                    </div>

                    <div className="bp-config-section">
                        <h3>🏷️ Tamaño de Etiqueta</h3>
                        <div className="bp-config-row">
                            {Object.entries(LABEL_PRESETS).map(([k, v]) => (
                                <button key={k} className={`bp-option ${config.labelPreset === k ? 'active' : ''}`}
                                    onClick={() => handleLabelPreset(k)}>{v.label}</button>
                            ))}
                            <button className={`bp-option ${config.labelPreset === 'custom' ? 'active' : ''}`}
                                onClick={() => handleLabelPreset('custom')}>Personalizado</button>
                        </div>
                        {config.labelPreset === 'custom' && (
                            <div className="bp-custom-size">
                                <label>Ancho (mm) <input type="number" value={config.labelW}
                                    onChange={e => setConfig((c: LabelConfig) => ({ ...c, labelW: +e.target.value }))} /></label>
                                <label>Alto (mm) <input type="number" value={config.labelH}
                                    onChange={e => setConfig((c: LabelConfig) => ({ ...c, labelH: +e.target.value }))} /></label>
                            </div>
                        )}
                    </div>

                    <div className="bp-config-section">
                        <h3>📐 Márgenes y Espaciado</h3>
                        <div className="bp-custom-size">
                            <label>Margen sup. (mm) <input type="number" value={config.marginTop}
                                onChange={e => setConfig((c: LabelConfig) => ({ ...c, marginTop: +e.target.value }))} /></label>
                            <label>Margen izq. (mm) <input type="number" value={config.marginLeft}
                                onChange={e => setConfig((c: LabelConfig) => ({ ...c, marginLeft: +e.target.value }))} /></label>
                            <label>Gap H (mm) <input type="number" value={config.gapH}
                                onChange={e => setConfig((c: LabelConfig) => ({ ...c, gapH: +e.target.value }))} /></label>
                            <label>Gap V (mm) <input type="number" value={config.gapV}
                                onChange={e => setConfig((c: LabelConfig) => ({ ...c, gapV: +e.target.value }))} /></label>
                        </div>
                    </div>

                    <div className="bp-config-section">
                        <h3>🔤 Formato de Código</h3>
                        <div className="bp-config-row">
                            {(['CODE128', 'EAN13', 'CODE39'] as const).map(f => (
                                <button key={f} className={`bp-option ${config.format === f ? 'active' : ''}`}
                                    onClick={() => setConfig((c: LabelConfig) => ({ ...c, format: f }))}>{f}</button>
                            ))}
                        </div>
                    </div>

                    <div className="bp-config-section">
                        <h3>📝 Contenido de la Etiqueta</h3>
                        <div className="bp-checkboxes">
                            <label><input type="checkbox" checked={config.showName}
                                onChange={e => setConfig((c: LabelConfig) => ({ ...c, showName: e.target.checked }))} /> Nombre del producto</label>
                            <label><input type="checkbox" checked={config.showPrice}
                                onChange={e => setConfig((c: LabelConfig) => ({ ...c, showPrice: e.target.checked }))} /> Precio</label>
                            <label><input type="checkbox" checked={config.showCode}
                                onChange={e => setConfig((c: LabelConfig) => ({ ...c, showCode: e.target.checked }))} /> Código interno</label>
                        </div>
                    </div>

                    <div className="bp-config-summary">
                        <p>{cols} columnas × {rows} filas = <strong>{labelsPerPage} etiquetas/hoja</strong></p>
                        <p>{totalLabels} etiquetas totales → <strong>{totalPages} hoja(s)</strong></p>
                    </div>

                    <div className="bp-step-actions">
                        <button className="bp-back-btn" onClick={() => setStep(1)}>← Volver</button>
                        <button className="bp-next-btn" onClick={() => setStep(3)}>Vista Previa →</button>
                    </div>
                </div>
            )}

            {/* STEP 3: Preview & Print */}
            {step === 3 && (
                <div className="bp-step3">
                    <div className="bp-preview-toolbar">
                        <span>{totalLabels} etiquetas en {totalPages} hoja(s) — {cols}×{rows} por hoja</span>
                        <div className="bp-preview-actions">
                            <button className="bp-back-btn" onClick={() => setStep(2)}><ArrowLeft size={20} /> Configurar</button>
                            <button className="bp-print-btn" onClick={handlePrint}>
                                <Printer size={20} /> Imprimir
                            </button>
                        </div>
                    </div>

                    <div className="bp-preview-scroll">
                        <div ref={printRef} className="bp-print-area" id="barcode-print-area">
                            {Array.from({ length: totalPages }).map((_, pageIdx) => {
                                const pageLabels = allLabels.slice(pageIdx * labelsPerPage, (pageIdx + 1) * labelsPerPage);
                                return (
                                    <div key={pageIdx} className="bp-page"
                                        style={{
                                            width: `${config.paperW}mm`, height: `${config.paperH}mm`,
                                            padding: `${config.marginTop}mm ${config.marginLeft}mm`,
                                        }}>
                                        <div className="bp-page-grid" style={{
                                            display: 'grid',
                                            gridTemplateColumns: `repeat(${cols}, ${config.labelW}mm)`,
                                            gap: `${config.gapV}mm ${config.gapH}mm`,
                                        }}>
                                            {pageLabels.map((label: SelectedProduct, i: number) => (
                                                <BarcodeLabel key={`${pageIdx}-${i}`} product={label} config={config} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Recursive Category Component
const CategoryFolder = ({ 
    cat, level, products, filteredProducts, isSelected, 
    toggleProduct, toggleCategory, expandedIds, setExpandedIds 
}: any) => {
    const isExpanded = expandedIds.has(cat.id);
    const catProds = filteredProducts.filter((p: any) => p.category === cat.name);
    
    // Check if this category or any descendant has products matching filter
    const hasVisibleContent = useMemo(() => {
        if (catProds.length > 0) return true;
        const checkChildren = (children: any[]): boolean => {
            return children.some(c => 
                filteredProducts.some((p: any) => p.category === c.name) || 
                (c.children && checkChildren(c.children))
            );
        };
        return checkChildren(cat.children || []);
    }, [cat, catProds, filteredProducts]);

    if (!hasVisibleContent) return null;

    const toggleExpand = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const next = new Set(expandedIds);
        if (isExpanded) next.delete(cat.id);
        else next.add(cat.id);
        setExpandedIds(next);
    };

    return (
        <div className="bp-cat-group" style={{ marginLeft: level > 0 ? '12px' : '0' }}>
            <div className="bp-cat-header">
                <button className="bp-expand-btn" onClick={toggleExpand}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <label className="bp-cat-label">
                    <input type="checkbox"
                        checked={catProds.length > 0 && catProds.every((p: any) => isSelected(p.id))}
                        onChange={() => toggleCategory(cat.name)}
                    />
                    {isExpanded ? <FolderOpen size={18} /> : <Folder size={18} />}
                    <span className="bp-cat-name">{cat.name}</span>
                    <span className="bp-cat-count">({catProds.length})</span>
                </label>
            </div>

            {isExpanded && (
                <div className="bp-cat-content">
                    <div className="bp-cat-products">
                        {catProds.map((p: any) => (
                            <label key={p.id} className="bp-product-row">
                                <input type="checkbox" checked={isSelected(p.id)} onChange={() => toggleProduct(p)} />
                                <div className="bp-prod-info">
                                    <span className="bp-prod-name">{p.name}</span>
                                    <span className="bp-prod-code">{p.barcode || p.code || p.id}</span>
                                </div>
                                <span className="bp-prod-stock">Stock: {p.stock}</span>
                            </label>
                        ))}
                    </div>
                    {cat.children?.map((sub: any) => (
                        <CategoryFolder
                            key={sub.id}
                            cat={sub}
                            level={level + 1}
                            products={products}
                            filteredProducts={filteredProducts}
                            isSelected={isSelected}
                            toggleProduct={toggleProduct}
                            toggleCategory={toggleCategory}
                            expandedIds={expandedIds}
                            setExpandedIds={setExpandedIds}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Individual barcode label component
const BarcodeLabel = ({ product, config }: { product: SelectedProduct; config: LabelConfig }) => {
    // We get the saved layout but override its dimensions with the selected paper label config
    const baseLayout = getSavedLabelLayout();
    const layout = {
        ...baseLayout,
        width: config.labelW,
        height: config.labelH,
        name: { ...baseLayout.name, visible: config.showName },
        price: { ...baseLayout.price, visible: config.showPrice },
        code: { ...baseLayout.code, visible: config.showCode },
    };

    return (
        <div className="bp-label-wrapper" style={{ width: `${config.labelW}mm`, height: `${config.labelH}mm`, overflow: 'hidden' }}>
            <PrintableLabel 
                product={{ name: product.name, code: product.barcode, price: product.price }} 
                barcodeValue={product.barcode} 
                layout={layout} 
            />
        </div>
    );
};

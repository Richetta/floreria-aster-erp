import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store/useStore';
import type { Category } from '../../../store/slices/types';
import JsBarcode from 'jsbarcode';
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
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadProducts(); loadCategories(true); }, []);

    // Build category tree from categoriesData
    const catTree = useMemo(() => {
        const roots = (categoriesData || []).filter(c => !c.parent_id);
        return roots.map(r => ({
            ...r,
            children: (categoriesData || []).filter(c => c.parent_id === r.id)
        }));
    }, [categoriesData]);

    // Products filtered by search
    const filteredProducts = useMemo(() => {
        const s = search.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(s) || (p.barcode || '').includes(s) || p.code.includes(s)
        );
    }, [products, search]);

    const isSelected = (id: string) => selected.some(s => s.id === id);

    const toggleProduct = (p: any) => {
        if (isSelected(p.id)) {
            setSelected(prev => prev.filter(s => s.id !== p.id));
        } else {
            setSelected(prev => [...prev, {
                id: p.id, name: p.name, barcode: p.barcode || p.code,
                price: p.price, category: p.category, qty: 1
            }]);
        }
    };

    const toggleCategory = (catName: string) => {
        const prods = products.filter(p => p.category === catName);
        const allSelected = prods.every(p => isSelected(p.id));
        if (allSelected) {
            setSelected(prev => prev.filter(s => !prods.some(p => p.id === s.id)));
        } else {
            const toAdd = prods.filter(p => !isSelected(p.id)).map(p => ({
                id: p.id, name: p.name, barcode: p.barcode || p.code,
                price: p.price, category: p.category, qty: 1
            }));
            setSelected(prev => [...prev, ...toAdd]);
        }
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
            setConfig(c => ({ ...c, paperSize: 'custom' as any }));
        } else {
            const p = PAPER_PRESETS[size];
            setConfig(c => ({ ...c, paperSize: size as any, paperW: p.w, paperH: p.h }));
        }
    };

    const handleLabelPreset = (preset: string) => {
        if (preset === 'custom') {
            setConfig(c => ({ ...c, labelPreset: 'custom' as any }));
        } else {
            const p = LABEL_PRESETS[preset];
            setConfig(c => ({ ...c, labelPreset: preset as any, labelW: p.w, labelH: p.h }));
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
                    <span className="material-symbols-rounded">arrow_back</span>
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
                            <span className="material-symbols-rounded">search</span>
                            <input placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        <div className="bp-cat-tree">
                            <button className="bp-select-all" onClick={() => {
                                if (selected.length === products.length) setSelected([]);
                                else setSelected(products.map(p => ({
                                    id: p.id, name: p.name, barcode: p.barcode || p.code,
                                    price: p.price, category: p.category, qty: 1
                                })));
                            }}>
                                {selected.length === products.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                            </button>

                            {catTree.map(cat => {
                                const catProds = filteredProducts.filter(p => p.category === cat.name);
                                if (catProds.length === 0 && !cat.children?.some((ch: Category) =>
                                    filteredProducts.some(p => p.category === ch.name)
                                )) return null;

                                return (
                                    <div key={cat.id} className="bp-cat-group">
                                        <label className="bp-cat-label">
                                            <input type="checkbox"
                                                checked={catProds.length > 0 && catProds.every(p => isSelected(p.id))}
                                                onChange={() => toggleCategory(cat.name)}
                                            />
                                            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>folder</span>
                                            {cat.name} <span className="bp-cat-count">({catProds.length})</span>
                                        </label>
                                        <div className="bp-cat-products">
                                            {catProds.map(p => (
                                                <label key={p.id} className="bp-product-row">
                                                    <input type="checkbox" checked={isSelected(p.id)} onChange={() => toggleProduct(p)} />
                                                    <span className="bp-prod-name">{p.name}</span>
                                                    <span className="bp-prod-code">{p.barcode || p.code}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {cat.children?.map((sub: Category) => {
                                            const subProds = filteredProducts.filter(p => p.category === sub.name);
                                            if (subProds.length === 0) return null;
                                            return (
                                                <div key={sub.id} className="bp-subcat-group">
                                                    <label className="bp-cat-label bp-subcat-label">
                                                        <input type="checkbox"
                                                            checked={subProds.every(p => isSelected(p.id))}
                                                            onChange={() => toggleCategory(sub.name)}
                                                        />
                                                        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>subdirectory_arrow_right</span>
                                                        {sub.name} <span className="bp-cat-count">({subProds.length})</span>
                                                    </label>
                                                    <div className="bp-cat-products bp-sub-products">
                                                        {subProds.map(p => (
                                                            <label key={p.id} className="bp-product-row">
                                                                <input type="checkbox" checked={isSelected(p.id)} onChange={() => toggleProduct(p)} />
                                                                <span className="bp-prod-name">{p.name}</span>
                                                                <span className="bp-prod-code">{p.barcode || p.code}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}

                            {/* Products without category */}
                            {(() => {
                                const uncategorized = filteredProducts.filter(p => !p.category || p.category === '');
                                if (uncategorized.length === 0) return null;
                                return (
                                    <div className="bp-cat-group">
                                        <label className="bp-cat-label">
                                            <input type="checkbox"
                                                checked={uncategorized.every(p => isSelected(p.id))}
                                                onChange={() => toggleCategory('')}
                                            />
                                            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>folder_off</span>
                                            Sin categoría <span className="bp-cat-count">({uncategorized.length})</span>
                                        </label>
                                        <div className="bp-cat-products">
                                            {uncategorized.map(p => (
                                                <label key={p.id} className="bp-product-row">
                                                    <input type="checkbox" checked={isSelected(p.id)} onChange={() => toggleProduct(p)} />
                                                    <span className="bp-prod-name">{p.name}</span>
                                                    <span className="bp-prod-code">{p.barcode || p.code}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Selected panel */}
                    <div className="bp-selected-panel">
                        <h3>Seleccionados ({selected.length} productos, {totalLabels} etiquetas)</h3>
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
                                            <span className="material-symbols-rounded">close</span>
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
                                    onChange={e => setConfig(c => ({ ...c, paperW: +e.target.value }))} /></label>
                                <label>Alto (mm) <input type="number" value={config.paperH}
                                    onChange={e => setConfig(c => ({ ...c, paperH: +e.target.value }))} /></label>
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
                                    onChange={e => setConfig(c => ({ ...c, labelW: +e.target.value }))} /></label>
                                <label>Alto (mm) <input type="number" value={config.labelH}
                                    onChange={e => setConfig(c => ({ ...c, labelH: +e.target.value }))} /></label>
                            </div>
                        )}
                    </div>

                    <div className="bp-config-section">
                        <h3>📐 Márgenes y Espaciado</h3>
                        <div className="bp-custom-size">
                            <label>Margen sup. (mm) <input type="number" value={config.marginTop}
                                onChange={e => setConfig(c => ({ ...c, marginTop: +e.target.value }))} /></label>
                            <label>Margen izq. (mm) <input type="number" value={config.marginLeft}
                                onChange={e => setConfig(c => ({ ...c, marginLeft: +e.target.value }))} /></label>
                            <label>Gap H (mm) <input type="number" value={config.gapH}
                                onChange={e => setConfig(c => ({ ...c, gapH: +e.target.value }))} /></label>
                            <label>Gap V (mm) <input type="number" value={config.gapV}
                                onChange={e => setConfig(c => ({ ...c, gapV: +e.target.value }))} /></label>
                        </div>
                    </div>

                    <div className="bp-config-section">
                        <h3>🔤 Formato de Código</h3>
                        <div className="bp-config-row">
                            {(['CODE128', 'EAN13', 'CODE39'] as const).map(f => (
                                <button key={f} className={`bp-option ${config.format === f ? 'active' : ''}`}
                                    onClick={() => setConfig(c => ({ ...c, format: f }))}>{f}</button>
                            ))}
                        </div>
                    </div>

                    <div className="bp-config-section">
                        <h3>📝 Contenido de la Etiqueta</h3>
                        <div className="bp-checkboxes">
                            <label><input type="checkbox" checked={config.showName}
                                onChange={e => setConfig(c => ({ ...c, showName: e.target.checked }))} /> Nombre del producto</label>
                            <label><input type="checkbox" checked={config.showPrice}
                                onChange={e => setConfig(c => ({ ...c, showPrice: e.target.checked }))} /> Precio</label>
                            <label><input type="checkbox" checked={config.showCode}
                                onChange={e => setConfig(c => ({ ...c, showCode: e.target.checked }))} /> Código interno</label>
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
                            <button className="bp-back-btn" onClick={() => setStep(2)}>← Configurar</button>
                            <button className="bp-print-btn" onClick={handlePrint}>
                                <span className="material-symbols-rounded">print</span> Imprimir
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
                                            {pageLabels.map((label, i) => (
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

// Individual barcode label component
const BarcodeLabel = ({ product, config }: { product: SelectedProduct; config: LabelConfig }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (svgRef.current && product.barcode) {
            try {
                JsBarcode(svgRef.current, product.barcode, {
                    format: config.format,
                    width: 1.5,
                    height: config.labelH * 0.4 * 3.78, // mm to px approx
                    displayValue: false,
                    margin: 0,
                });
            } catch {
                // fallback for invalid barcode
                try {
                    JsBarcode(svgRef.current, product.barcode, {
                        format: 'CODE128', width: 1.5,
                        height: config.labelH * 0.4 * 3.78,
                        displayValue: false, margin: 0,
                    });
                } catch { /* ignore */ }
            }
        }
    }, [product.barcode, config.format, config.labelH]);

    return (
        <div className="bp-label" style={{ width: `${config.labelW}mm`, height: `${config.labelH}mm` }}>
            {config.showName && <div className="bp-label-name">{product.name}</div>}
            <svg ref={svgRef} className="bp-label-barcode" />
            <div className="bp-label-code-text">{product.barcode}</div>
            {config.showPrice && <div className="bp-label-price">${product.price.toLocaleString()}</div>}
        </div>
    );
};

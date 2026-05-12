import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store/useStore';
import { 
    Plus, Search, ArrowLeft,
    Printer, Eye
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import './BarcodePrinterMobile.css';

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
    small: { w: 38, h: 21, label: '38×21mm' },
    medium: { w: 50, h: 25, label: '50×25mm' },
    large: { w: 70, h: 35, label: '70×35mm' },
    xl: { w: 100, h: 50, label: '100×50mm' },
};

const PAPER_PRESETS: Record<string, { w: number; h: number; label: string }> = {
    a4: { w: 210, h: 297, label: 'A4' },
    carta: { w: 216, h: 279, label: 'Carta' },
    rollo: { w: 80, h: 297, label: 'Rollo' },
};

const defaultConfig: LabelConfig = {
    paperSize: 'a4', paperW: 210, paperH: 297,
    labelW: 50, labelH: 25, labelPreset: 'medium',
    format: 'CODE128', showName: true, showPrice: true, showCode: false,
    marginTop: 10, marginLeft: 7, gapH: 3, gapV: 3,
};

export const BarcodePrinterMobile = () => {
    const navigate = useNavigate();
    const products = useStore(s => s.products);
    const loadProducts = useStore(s => s.loadProducts);
    const loadCategories = useStore(s => s.loadCategories);

    const [step, setStep] = useState(1);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<SelectedProduct[]>([]);
    const [config, setConfig] = useState<LabelConfig>(defaultConfig);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadProducts(); loadCategories(true); }, []);

    const filteredProducts = useMemo(() => {
        const s = search.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(s) || (p.barcode || '').includes(s) || (p.code || '').includes(s)
        );
    }, [products, search]);

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

    const updateQty = (id: string, qty: number) => {
        setSelected(prev => prev.map(s => s.id === id ? { ...s, qty: Math.max(1, qty) } : s));
    };

    const totalLabels = selected.reduce((sum, s) => sum + s.qty, 0);
    const cols = Math.floor((config.paperW - config.marginLeft * 2 + config.gapH) / (config.labelW + config.gapH));
    const rows = Math.floor((config.paperH - config.marginTop * 2 + config.gapV) / (config.labelH + config.gapV));
    const labelsPerPage = Math.max(1, cols * rows);
    const totalPages = Math.ceil(totalLabels / labelsPerPage);

    const allLabels = useMemo(() => {
        const arr: SelectedProduct[] = [];
        selected.forEach(s => { for (let i = 0; i < s.qty; i++) arr.push(s); });
        return arr;
    }, [selected]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="bpm-container">
            <header className="bpm-header">
                <button className="bpm-back" onClick={() => step === 1 ? navigate('/productos') : setStep(s => s - 1)}>
                    <ArrowLeft size={24} />
                </button>
                <div className="bpm-title-group">
                    <h1>Imprimir Etiquetas</h1>
                    <span className="bpm-step-indicator">Paso {step} de 3</span>
                </div>
            </header>

            <div className="bpm-stepper">
                {[1, 2, 3].map(s => (
                    <div key={s} className={`bpm-step ${step === s ? 'active' : step > s ? 'done' : ''}`} />
                ))}
            </div>

            <main className="bpm-main">
                {step === 1 && (
                    <div className="bpm-step-selection">
                        <div className="bpm-search-bar">
                            <Search size={20} />
                            <input placeholder="Buscar productos..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        <div className="bpm-list">
                            {filteredProducts.slice(0, 50).map(p => (
                                <div key={p.id} className={`bpm-item ${isSelected(p.id) ? 'selected' : ''}`} onClick={() => toggleProduct(p)}>
                                    <div className="bpm-item-info">
                                        <span className="name">{p.name}</span>
                                        <span className="code">{p.barcode || p.code || 'S/C'}</span>
                                    </div>
                                    <div className="bpm-item-checkbox">
                                        {isSelected(p.id) && <Plus size={16} />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {selected.length > 0 && (
                            <div className="bpm-floating-next">
                                <div className="info">
                                    <strong>{selected.length}</strong> seleccionados
                                </div>
                                <button onClick={() => setStep(2)}>
                                    Configurar <ArrowLeft size={20} style={{ transform: 'rotate(180deg)' }} />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {step === 2 && (
                    <div className="bpm-step-config">
                        <section className="config-group">
                            <label>Hojas</label>
                            <div className="config-grid">
                                {Object.entries(PAPER_PRESETS).map(([k, v]) => (
                                    <button key={k} className={config.paperSize === k ? 'active' : ''} 
                                        onClick={() => setConfig(c => ({...c, paperSize: k as any, paperW: v.w, paperH: v.h}))}>
                                        {v.label}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="config-group">
                            <label>Tamaño Etiqueta</label>
                            <div className="config-grid">
                                {Object.entries(LABEL_PRESETS).map(([k, v]) => (
                                    <button key={k} className={config.labelPreset === k ? 'active' : ''}
                                        onClick={() => setConfig(c => ({...c, labelPreset: k as any, labelW: v.w, labelH: v.h}))}>
                                        {v.label}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="config-group">
                            <label>Cantidades</label>
                            <div className="qty-list">
                                {selected.map(s => (
                                    <div key={s.id} className="qty-item">
                                        <span>{s.name}</span>
                                        <div className="qty-controls">
                                            <button onClick={() => updateQty(s.id, s.qty - 1)}>−</button>
                                            <input type="number" value={s.qty} onChange={e => updateQty(s.id, parseInt(e.target.value) || 1)} />
                                            <button onClick={() => updateQty(s.id, s.qty + 1)}>+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="bpm-actions">
                            <button className="primary" onClick={() => setStep(3)}>
                                <Eye size={20} /> Vista Previa
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="bpm-step-preview">
                        <div className="preview-info">
                            <p>{totalLabels} etiquetas en {totalPages} hoja(s)</p>
                            <p>{cols} col × {rows} filas por hoja</p>
                        </div>

                        <div className="preview-scroll">
                            <div ref={printRef} className="bpm-print-area">
                                {Array.from({ length: totalPages }).map((_, pageIdx) => {
                                    const pageLabels = allLabels.slice(pageIdx * labelsPerPage, (pageIdx + 1) * labelsPerPage);
                                    return (
                                        <div key={pageIdx} className="bpm-page"
                                            style={{
                                                width: `${config.paperW}mm`, height: `${config.paperH}mm`,
                                                padding: `${config.marginTop}mm ${config.marginLeft}mm`,
                                            }}>
                                            <div className="bpm-page-grid" style={{
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

                        <div className="bpm-actions">
                            <button className="primary" onClick={handlePrint}>
                                <Printer size={20} /> Imprimir Todo
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

const BarcodeLabel = ({ product, config }: { product: SelectedProduct; config: LabelConfig }) => {
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (imgRef.current && product.barcode) {
            try {
                JsBarcode(imgRef.current, product.barcode, {
                    format: config.format,
                    width: 1.5,
                    height: config.labelH * 0.4 * 3.78,
                    displayValue: false,
                    margin: 0,
                });
            } catch { /* ignore */ }
        }
    }, [product.barcode, config.format, config.labelH]);

    return (
        <div className="bpm-label" style={{ width: `${config.labelW}mm`, height: `${config.labelH}mm` }}>
            {config.showName && <div className="bpm-label-name">{product.name}</div>}
            <img ref={imgRef} alt={product.barcode} />
            <div className="bpm-label-code">{product.barcode}</div>
            {config.showPrice && <div className="bpm-label-price">${product.price.toLocaleString()}</div>}
        </div>
    );
};

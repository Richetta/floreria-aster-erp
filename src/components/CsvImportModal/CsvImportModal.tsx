import React, { useState, useMemo } from 'react';
import { 
    X, Upload, FileText, Check, AlertCircle, 
    ChevronRight, FileSpreadsheet,
    Database, RefreshCw, PlusCircle, Download, Sparkles,
    Search, Percent, DollarSign, CheckSquare, Square
} from 'lucide-react';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import './CsvImportModal.css';

interface CsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (result: any) => void;
}

interface ParsedRow {
    _id: string;
    selected: boolean;
    code: string;
    name: string;
    cost: number;
    margin: number;
    price: number;
    stock: number;
    category: string;
    brand: string;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const parseDataIntoRows = (rawData: any[]): ParsedRow[] => {
    return rawData.map((row, idx) => {
        const getVal = (keys: string[]) => {
            if (!row) return '';
            for (const k of keys) {
                const foundKey = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase());
                if (foundKey) return row[foundKey];
            }
            return '';
        };

        const code = getVal(['código', 'codigo', 'code', 'sku']) || '';
        const name = getVal(['nombre', 'name', 'producto', 'artículo', 'articulo']) || `Producto Sin Nombre (${idx + 1})`;
        const costRaw = getVal(['costo', 'cost', 'precio de costo', 'precio costo']);
        const priceRaw = getVal(['precio', 'price', 'precio de venta', 'venta']);
        const stockRaw = getVal(['stock', 'cantidad', 'qty', 'quantity']);
        const category = getVal(['categoría', 'categoria', 'category', 'rubro', 'carpeta']);
        const brand = getVal(['marca', 'brand']);

        const cost = parseFloat(String(costRaw).replace(/[^0-9.-]+/g, "")) || 0;
        let price = parseFloat(String(priceRaw).replace(/[^0-9.-]+/g, "")) || 0;

        // Custom symbol parse if manual overrides
        if (typeof priceRaw === 'string') {
            if (priceRaw.includes('$$')) {
                price = parseFloat(priceRaw.replace(/[^\d.]/g, '')) || price;
            } else if (priceRaw.includes('%')) {
                const percent = parseFloat(priceRaw.replace(/[^\d.-]/g, '')) || 0;
                price = cost * (1 + percent / 100);
            }
        }

        let margin = 0;
        if (cost > 0 && price > 0) {
            margin = Math.round(((price - cost) / cost) * 100);
        }

        return {
            _id: generateId(),
            selected: true,
            code: String(code),
            name: String(name),
            cost,
            margin,
            price: Math.round(price),
            stock: parseInt(stockRaw) || 0,
            category: String(category),
            brand: String(brand)
        };
    });
};

const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const categories = useStore(state => state.categories) || [];
    const brands = useStore(state => state.brands) || [];

    const [step, setStep] = useState(1);
    const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [pasteText, setPasteText] = useState('');
    const [importResult, setImportResult] = useState<{ updated: number, created: number } | null>(null);

    // Pre-import state
    const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
    const [bulkMargin, setBulkMargin] = useState<string>('');
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkBrand, setBulkBrand] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handlePreview = async () => {
        setIsLoading(true);
        setError(null);

        try {
            let rawData: any[] = [];
            if (activeTab === 'file' && file) {
                const parseResponse = await api.parseFile(file);
                rawData = parseResponse.data;
            } else if (activeTab === 'text' && pasteText.trim()) {
                const parseResponse = await api.request<any>('/import-data/parse-text', {
                    method: 'POST',
                    body: JSON.stringify({ text: pasteText })
                });
                rawData = parseResponse.data;
            }

            if (!rawData || rawData.length === 0) throw new Error('No se encontraron datos interpretables.');

            setPreviewData(parseDataIntoRows(rawData));
            setStep(2);
        } catch (err: any) {
            setError(err.message || 'Error al procesar la información');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const finalDataToImport = previewData.filter(r => r.selected).map(r => ({
                Código: r.code,
                Nombre: r.name,
                Precio: r.price,
                Costo: r.cost,
                Stock: r.stock,
                Categoría: r.category,
                Marca: r.brand,
                // Fallbacks to be 100% resilient
                code: r.code,
                name: r.name,
                price: r.price,
                cost: r.cost,
                stock: r.stock,
                category_name: r.category,
                brand_name: r.brand,
                margin_percent: r.margin
            }));

            if (finalDataToImport.length === 0) {
                throw new Error("No has seleccionado ninguna fila para importar.");
            }

            const importResponse = await api.request<any>('/import-data/bulk-import', {
                method: 'POST',
                body: JSON.stringify({
                    data: finalDataToImport,
                    update_prices: true,
                    update_stock: true
                })
            });

            setImportResult({
                updated: importResponse.updated || 0,
                created: importResponse.created || 0
            });
            setStep(3);
        } catch (err: any) {
            setError(err.message || 'Error durante la importación real');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        const csvContent = 'Código,Nombre,Precio,Costo,Stock,Categoría,Marca\nPROD001,Producto Ejemplo,1000,500,10,Plantas,Mi Jardín';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'plantilla_productos.csv';
        link.click();
    };

    const handleClose = () => {
        if (importResult && onSuccess) {
            onSuccess(importResult);
        }
        onClose();
        if (importResult) window.location.reload();
    };

    // --- Data Grid Logic ---
    const filteredPreview = useMemo(() => {
        if (!searchTerm) return previewData;
        const low = searchTerm.toLowerCase();
        return previewData.filter(r => 
            r.name.toLowerCase().includes(low) || 
            r.code.toLowerCase().includes(low) ||
            r.category.toLowerCase().includes(low) ||
            r.brand.toLowerCase().includes(low)
        );
    }, [previewData, searchTerm]);

    const toggleAll = () => {
        const allSelected = filteredPreview.every(r => r.selected);
        const filteredIds = new Set(filteredPreview.map(r => r._id));
        setPreviewData(prev => prev.map(r => filteredIds.has(r._id) ? { ...r, selected: !allSelected } : r));
    };

    const toggleRow = (id: string) => {
        setPreviewData(prev => prev.map(r => r._id === id ? { ...r, selected: !r.selected } : r));
    };

    const updateRow = (id: string, field: keyof ParsedRow, value: any) => {
        setPreviewData(prev => prev.map(r => {
            if (r._id !== id) return r;
            const updated = { ...r, [field]: value };
            
            // Recalculate interrelated price/cost/margin
            if (field === 'cost' || field === 'margin') {
                updated.price = Math.round(updated.cost * (1 + updated.margin / 100));
            } else if (field === 'price') {
                if (updated.cost > 0) {
                    updated.margin = Math.round(((updated.price - updated.cost) / updated.cost) * 100);
                }
            }
            return updated;
        }));
    };

    const applyBulkMargin = () => {
        if (bulkMargin === '') return;
        const m = Number(bulkMargin);
        setPreviewData(prev => prev.map(r => {
            if (!r.selected) return r;
            return {
                ...r,
                margin: m,
                price: Math.round(r.cost * (1 + m / 100))
            };
        }));
    };

    const applyBulkCategory = () => {
        if (!bulkCategory) return;
        setPreviewData(prev => prev.map(r => r.selected ? { ...r, category: bulkCategory } : r));
    };

    const applyBulkBrand = () => {
        if (!bulkBrand) return;
        setPreviewData(prev => prev.map(r => r.selected ? { ...r, brand: bulkBrand } : r));
    };

    // Safe uniquely identifiable categories and brands for selects
    const categoryOptions = Array.from(new Set([...categories.map((c: any) => c?.name || c), ...previewData.map(r => r.category).filter(Boolean)]));
    const brandOptions = Array.from(new Set([...brands.map((b: any) => b?.name || b), ...previewData.map(r => r.brand).filter(Boolean)]));

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" style={{ maxWidth: step === 2 ? '1400px' : '1000px', width: step === 2 ? '98vw' : '95vw' }} onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div className="modal-header">
                    <h2 className="text-h2 flex items-center gap-2 text-white"><Database size={24} /> Importar Productos</h2>
                    <button className="modal-close-btn" onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Stepper */}
                <div className="import-stepper">
                    <div className={`step-item ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                        <div className="step-number">{step > 1 ? <Check size={14} /> : '1'}</div>
                        <span>Configurar</span>
                    </div>
                    <div className="step-divider" />
                    <div className={`step-item ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                        <div className="step-number">{step > 2 ? <Check size={14} /> : '2'}</div>
                        <span>Vista Previa Dinámica</span>
                    </div>
                    <div className="step-divider" />
                    <div className={`step-item ${step >= 3 ? 'active' : ''}`}>
                        <div className="step-number">3</div>
                        <span>Finalizar</span>
                    </div>
                </div>

                <div className="import-modal-content p-0">
                    {step === 1 && (
                        <div className="animate-fadeIn p-8">
                            <div className="import-tabs">
                                <button 
                                    className={`import-tab ${activeTab === 'file' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('file')}
                                >
                                    <FileSpreadsheet size={18} /> Archivo Excel/CSV
                                </button>
                                <button 
                                    className={`import-tab ${activeTab === 'text' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('text')}
                                >
                                    <FileText size={18} /> Pegar Texto
                                </button>
                            </div>

                            {activeTab === 'file' ? (
                                <div className="file-dropzone">
                                    <input type="file" onChange={handleFileChange} accept=".csv,.xlsx,.xls" />
                                    <div className="dropzone-icon">
                                        <Upload size={32} />
                                    </div>
                                    <div className="dropzone-text">
                                        <h3 className="text-h3 font-bold">{file ? file.name : 'Arrastrá tu archivo aquí o hacé clic'}</h3>
                                        <p className="text-body text-muted">{file ? `${(file.size / 1024).toFixed(2)} KB` : 'Soportamos Excel (XLSX, XLS) y CSV'}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="paste-area-wrapper">
                                    <textarea 
                                        className="paste-textarea"
                                        placeholder="Pegá aquí el contenido de tu lista...&#10;Código, Nombre, Precio..."
                                        value={pasteText}
                                        onChange={(e) => setPasteText(e.target.value)}
                                    />
                                    <div className="paste-helper text-small text-muted mt-3 p-3 bg-surface border border-border rounded-lg">
                                        <p className="font-bold mb-1"><Sparkles size={14} className="inline mr-1 text-primary" /> Funcionalidad inteligente de precios:</p>
                                        <ul className="list-disc pl-5 m-0 space-y-1">
                                            <li>Para <strong>subir un porcentaje</strong>, usá <code className="bg-surface-hover px-1 rounded">+10%</code></li>
                                            <li>Para <strong>sumar dinero fijo</strong> al valor actual, usá <code className="bg-surface-hover px-1 rounded">+$10</code> o <code className="bg-surface-hover px-1 rounded">$10</code></li>
                                            <li>Para <strong>imponer un precio fijo exacto</strong>, usá <code className="bg-surface-hover px-1 rounded">$$2000</code></li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 flex justify-between items-center">
                                <button onClick={handleDownloadTemplate} className="btn-text text-primary flex items-center gap-2">
                                    <Download size={16} /> Descargar plantilla de ejemplo
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-fadeIn preview-grid-container flex flex-col h-full">
                            {/* Toolbar for bulk actions */}
                            <div className="grid-toolbar p-4 bg-surface border-b border-border flex flex-wrap gap-4 items-center justify-between">
                                <div className="flex items-center gap-2 flex-grow max-w-sm">
                                    <div className="search-bar w-full">
                                        <Search className="search-icon" size={18} />
                                        <input 
                                            type="text" 
                                            placeholder="Buscar productos en la lista..." 
                                            className="form-input search-input pl-10"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="bulk-actions flex flex-wrap gap-3 items-center">
                                    <span className="text-small font-bold text-muted mr-2 flex items-center gap-1">
                                        <Sparkles size={16} className="text-primary"/> Acciones Masivas
                                    </span>
                                    
                                    {/* Categoria Bulk */}
                                    <div className="flex items-center gap-1">
                                        <select className="form-input text-small py-1 h-9" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
                                            <option value="">Clasificar Carpeta...</option>
                                            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <button className="btn btn-secondary py-1 px-2 h-9" onClick={applyBulkCategory} disabled={!bulkCategory}>Aplicar</button>
                                    </div>

                                    {/* Marca Bulk */}
                                    <div className="flex items-center gap-1">
                                        <select className="form-input text-small py-1 h-9" value={bulkBrand} onChange={e => setBulkBrand(e.target.value)}>
                                            <option value="">Clasificar Marca...</option>
                                            {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                        <button className="btn btn-secondary py-1 px-2 h-9" onClick={applyBulkBrand} disabled={!bulkBrand}>Aplicar</button>
                                    </div>

                                    {/* Margen Bulk */}
                                    <div className="flex items-center gap-1 border-l pl-3 ml-1">
                                        <span className="text-small text-muted flex items-center"><Percent size={14} className="mr-1"/> Ganancia:</span>
                                        <input 
                                            type="number" 
                                            className="form-input text-small py-1 h-9 w-20" 
                                            placeholder="%" 
                                            value={bulkMargin} 
                                            onChange={e => setBulkMargin(e.target.value)}
                                        />
                                        <button className="btn btn-secondary py-1 px-2 h-9" onClick={applyBulkMargin} disabled={bulkMargin === ''}>Aplicar</button>
                                    </div>
                                </div>
                            </div>

                            {/* Data Table */}
                            <div className="table-wrapper overflow-auto" style={{ maxHeight: 'calc(80vh - 200px)' }}>
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-surface-hover sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="p-3 border-b border-border w-10 text-center">
                                                <button onClick={toggleAll} className="text-muted hover:text-primary">
                                                    {filteredPreview.length > 0 && filteredPreview.every(r => r.selected) ? <CheckSquare size={18} className="text-primary"/> : <Square size={18} />}
                                                </button>
                                            </th>
                                            <th className="p-3 border-b border-border text-micro font-bold uppercase text-muted">Código</th>
                                            <th className="p-3 border-b border-border text-micro font-bold uppercase text-muted">Nombre del Producto</th>
                                            <th className="p-3 border-b border-border text-micro font-bold uppercase text-muted">Carpeta</th>
                                            <th className="p-3 border-b border-border text-micro font-bold uppercase text-muted">Marca</th>
                                            <th className="p-3 border-b border-border text-micro font-bold uppercase text-muted w-24">Stock</th>
                                            <th className="p-3 border-b border-border text-micro font-bold uppercase text-muted w-32">Costo ($)</th>
                                            <th className="p-3 border-b border-border text-micro font-bold uppercase text-muted w-28">Margen (%)</th>
                                            <th className="p-3 border-b border-border text-micro font-bold uppercase text-muted w-32">P. Venta ($)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPreview.map((row) => (
                                            <tr key={row._id} className={`border-b border-border/50 hover:bg-surface transition-colors ${row.selected ? '' : 'opacity-50'}`}>
                                                <td className="p-2 text-center">
                                                    <button onClick={() => toggleRow(row._id)} className="text-muted hover:text-primary pt-1">
                                                        {row.selected ? <CheckSquare size={18} className="text-primary"/> : <Square size={18} />}
                                                    </button>
                                                </td>
                                                <td className="p-2">
                                                    <input 
                                                        className="form-input text-small py-1 px-2 w-full bg-transparent border-transparent hover:border-border focus:bg-white"
                                                        value={row.code}
                                                        onChange={e => updateRow(row._id, 'code', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input 
                                                        className="form-input text-small py-1 px-2 w-full bg-transparent border-transparent hover:border-border focus:bg-white font-medium"
                                                        value={row.name}
                                                        onChange={e => updateRow(row._id, 'name', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input 
                                                        className="form-input text-micro py-1 px-2 w-full bg-transparent border-transparent hover:border-border focus:bg-white"
                                                        value={row.category}
                                                        placeholder="Ninguna"
                                                        onChange={e => updateRow(row._id, 'category', e.target.value)}
                                                        list="categories-list"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input 
                                                        className="form-input text-micro py-1 px-2 w-full bg-transparent border-transparent hover:border-border focus:bg-white"
                                                        value={row.brand}
                                                        placeholder="Ninguna"
                                                        onChange={e => updateRow(row._id, 'brand', e.target.value)}
                                                        list="brands-list"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input 
                                                        type="number"
                                                        className="form-input text-small py-1 px-2 w-full bg-transparent border-transparent hover:border-border focus:bg-white"
                                                        value={row.stock}
                                                        onChange={e => updateRow(row._id, 'stock', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <div className="relative">
                                                        <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted"/>
                                                        <input 
                                                            type="number"
                                                            className="form-input text-small py-1 pl-6 pr-2 w-full bg-transparent border-transparent hover:border-border focus:bg-white"
                                                            value={row.cost}
                                                            onChange={e => updateRow(row._id, 'cost', Number(e.target.value))}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-2">
                                                    <div className="relative">
                                                        <input 
                                                            type="number"
                                                            className="form-input text-small py-1 pl-2 pr-6 w-full bg-transparent border-transparent hover:border-border focus:bg-white text-right"
                                                            value={row.margin}
                                                            onChange={e => updateRow(row._id, 'margin', Number(e.target.value))}
                                                        />
                                                        <Percent size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted"/>
                                                    </div>
                                                </td>
                                                <td className="p-2">
                                                    <div className="relative">
                                                        <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted"/>
                                                        <input 
                                                            type="number"
                                                            className="form-input text-small py-1 pl-6 pr-2 w-full font-bold text-primary bg-transparent border-transparent hover:border-border focus:bg-white"
                                                            value={row.price}
                                                            onChange={e => updateRow(row._id, 'price', Number(e.target.value))}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredPreview.length === 0 && (
                                    <div className="p-12 text-center text-muted font-medium">No se encontraron productos.</div>
                                )}
                            </div>
                            
                            <datalist id="categories-list">
                                {categoryOptions.map(c => <option key={c} value={c} />)}
                            </datalist>
                            <datalist id="brands-list">
                                {brandOptions.map(b => <option key={b} value={b} />)}
                            </datalist>
                        </div>
                    )}

                    {step === 3 && importResult && (
                        <div className="success-state text-center animate-fadeIn p-12">
                            <div className="success-icon-large mb-4">
                                <Check size={64} />
                            </div>
                            <h2 className="text-h2 mb-2">¡Importación Exitosa!</h2>
                            <p className="text-muted mb-8">Los {importResult.created + importResult.updated} datos han sido integrados correctamente a la base de datos.</p>

                            <div className="import-summary-results flex justify-center gap-6">
                                <div className="result-card-premium p-6 bg-surface rounded-xl border border-border flex flex-col items-center">
                                    <PlusCircle size={32} className="text-success mb-2" />
                                    <div className="text-h2 text-success font-black">{importResult.created}</div>
                                    <div className="text-label uppercase tracking-widest text-muted">Nuevos Creados</div>
                                </div>
                                <div className="result-card-premium p-6 bg-surface rounded-xl border border-border flex flex-col items-center">
                                    <RefreshCw size={32} className="text-primary mb-2" />
                                    <div className="text-h2 text-primary font-black">{importResult.updated}</div>
                                    <div className="text-label uppercase tracking-widest text-muted">Actualizados</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="import-error-msg m-4 p-4 bg-danger/10 text-danger border border-danger/30 rounded-lg flex items-center gap-2">
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}
                </div>

                <div className="import-modal-footer p-4 bg-surface border-t border-border flex justify-end gap-3 rounded-b-xl">
                    {step === 1 && (
                        <>
                            <button className="btn-premium-secondary" onClick={onClose}>Cancelar</button>
                            <button 
                                className="btn-premium-primary" 
                                onClick={handlePreview}
                                disabled={isLoading || (activeTab === 'file' ? !file : !pasteText.trim())}
                            >
                                {isLoading ? <RefreshCw size={18} className="animate-spin" /> : 'Procesar Vista Previa'} <ChevronRight size={18} />
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <button className="btn-premium-secondary" onClick={() => setStep(1)}>Atrás</button>
                            <button 
                                className="btn-premium-primary" 
                                onClick={handleImport}
                                disabled={isLoading || previewData.filter(r => r.selected).length === 0}
                            >
                                {isLoading ? <RefreshCw size={18} className="animate-spin" /> : `Confirmar e Importar (${previewData.filter(r => r.selected).length})`}
                            </button>
                        </>
                    )}

                    {step === 3 && (
                        <button className="btn-premium-primary" onClick={handleClose}>Finalizar</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CsvImportModal;
import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle2, Download, Settings, Plus, Layers, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../ui/Modals';
import type { Category } from '../../types';
import './CsvImportModal.css';

interface CsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
    isOpen,
    onClose
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [parsedData, setParsedData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);
    const [step, setStep] = useState<'upload' | 'preview' | 'confirm' | 'result'>('upload');
    const [importMode, setImportMode] = useState<'file' | 'text'>('file');
    const [pastedText, setPastedText] = useState('');
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [stockAction, setStockAction] = useState<'set' | 'add'>('add');

    // Import options
    const [updateCosts, setUpdateCosts] = useState(true);
    const [updatePrices, setUpdatePrices] = useState(true);
    const [updateStock, setUpdateStock] = useState(false);
    const [autoMargin, setAutoMargin] = useState(false);
    const [marginPercent, setMarginPercent] = useState(50);

    // Categories
    const [categories, setCategories] = useState<Category[]>([]);
    const [globalCategoryId, setGlobalCategoryId] = useState<string>('');

    const { alertModal, showAlert } = useModal();

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const fetchCategories = async () => {
        try {
            const data = await api.getCategories();
            setCategories(data);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    if (!isOpen) return null;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validExtensions = ['.csv', '.xlsx', '.txt', '.pdf', '.docx'];
        const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (!hasValidExt) {
            showAlert({ title: 'Archivo inválido', message: 'Por favor seleccioná un archivo válido (CSV, XLSX, TXT, PDF o DOCX)', variant: 'warning' });
            return;
        }

        setIsLoading(true);

        try {
            const result = await api.parseFile(file);
            setParsedData(result);
            setStep('preview');
        } catch (error: any) {
            showAlert({ title: 'Error', message: 'Error al leer el archivo: ' + error.message, variant: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTextSubmit = async () => {
        if (!pastedText.trim()) return;

        setIsLoading(true);
        try {
            // Client-side parsing for pasted text
            const lines = pastedText.split('\n').filter(l => l.trim());
            const data = lines.map(line => {
                let remainingText = line;
                
                // 1. Extract Code (e.g., "P-001", "ABC-123")
                const codeMatch = remainingText.match(/\b([A-Z0-9]+-[A-Z0-9]+|[A-Z]{2,}[0-9]+)\b/i);
                let code = '';
                if (codeMatch) {
                    code = codeMatch[0].toUpperCase();
                    remainingText = remainingText.replace(codeMatch[0], '');
                }

                // 2. Extract Cost (starts with $$)
                const costMatch = remainingText.match(/\$\$\s*(\$|USD)?\s*(\d+([,.]\d+)*)/i);
                let cost = 0;
                if (costMatch) {
                    const costVal = costMatch[2].replace(/\./g, '').replace(',', '.');
                    cost = Number(costVal);
                    remainingText = remainingText.replace(costMatch[0], '');
                }

                // 3. Extract Price (starts with a single $)
                const priceMatch = remainingText.match(/\$\s*(\$|USD)?\s*(\d+([,.]\d+)*)/i);
                let price = 0;
                if (priceMatch) {
                    const priceVal = priceMatch[2].replace(/\./g, '').replace(',', '.');
                    price = Number(priceVal);
                    remainingText = remainingText.replace(priceMatch[0], '');
                }

                // 4. Extract Stock (starts with +)
                const stockMatch = remainingText.match(/\+\s*(\d+)/);
                let stock = 0;
                if (stockMatch) {
                    stock = Number(stockMatch[1]);
                    remainingText = remainingText.replace(stockMatch[0], '');
                }

                // 5. Fallback: if no price matched, look for any other number
                if (price === 0) {
                    const anyNumberMatch = remainingText.match(/(\$|USD)?\s*(\d+([,.]\d+)*)/i);
                    if (anyNumberMatch) {
                        const val = anyNumberMatch[2].replace(/\./g, '').replace(',', '.');
                        price = Number(val);
                        remainingText = remainingText.replace(anyNumberMatch[0], '');
                    }
                }

                return {
                    code: code,
                    name: remainingText.replace(/\s+/g, ' ').trim() || 'Producto sin nombre',
                    cost: cost,
                    price: price,
                    stock: stock,
                    category_id: globalCategoryId || null
                };
            });

            setParsedData({
                method: 'Texto Pegado',
                filename: 'Texto manual',
                total_rows: data.length,
                data: data
            });
            setStep('preview');
        } catch (error: any) {
            showAlert({ title: 'Error', message: 'Error al procesar el texto: ' + error.message, variant: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        if (!parsedData) return;

        setIsLoading(true);
        const data = parsedData.data;
        const CHUNK_SIZE = 200;
        const totalItems = data.length;
        setImportProgress({ current: 0, total: totalItems });
        
        let aggregatedResult = { updated: 0, created: 0, errors: [] as any[] };

        try {
            for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE);
                const result = await api.importPrices(chunk, {
                    update_costs: updateCosts,
                    update_prices: updatePrices,
                    update_stock: updateStock,
                    stock_action: stockAction,
                    auto_margin: autoMargin,
                    margin_percent: marginPercent
                });

                aggregatedResult.updated += result.updated;
                aggregatedResult.created += result.created;
                aggregatedResult.errors = [...aggregatedResult.errors, ...result.errors];
                
                setImportProgress({ current: Math.min(i + CHUNK_SIZE, totalItems), total: totalItems });
            }

            setImportResult(aggregatedResult);
            setStep('result');
        } catch (error: any) {
            console.error('[IMPORT] Error:', error);
            const errorMessage = error.message.includes('404') 
                ? 'Error 404: El servidor no encontró la ruta de importación. Verificá la configuración de la API.'
                : error.message;
            showAlert({ title: 'Error', message: 'Error al importar: ' + errorMessage, variant: 'error' });
        } finally {
            setIsLoading(false);
            setImportProgress({ current: 0, total: 0 });
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const csv = await api.exportProductsTemplate();
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'productos_aster.csv';
            a.click();
        } catch (error) {
            showAlert({ title: 'Error', message: 'Error al descargar plantilla', variant: 'error' });
        }
    };

    const handleClose = () => {
        setParsedData(null);
        setImportResult(null);
        setStep('upload');
        setImportMode('file');
        setPastedText('');
        onClose();
    };

    return (
        <div className="csv-import-overlay">
            <div className="csv-import-modal">
                <div className="csv-import-header">
                    <h2 className="text-h2 flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Upload size={24} className="text-primary" />
                        </div>
                        <span className="font-black text-slate-800">Importar Productos</span>
                    </h2>
                    <button className="btn-icon hover:bg-slate-100 rounded-full p-2 transition-colors" onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="csv-import-body">
                    {/* STEP 1: UPLOAD / PASTE */}
                    {step === 'upload' && (
                        <div className="import-step">
                            <div className="flex border-b mb-8 border-slate-200">
                                <button
                                    className={`px-8 py-3 font-bold transition-all relative ${importMode === 'file' ? 'text-primary' : 'text-muted hover:text-slate-600'}`}
                                    onClick={() => setImportMode('file')}
                                >
                                    Archivo
                                    {importMode === 'file' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
                                </button>
                                <button
                                    className={`px-8 py-3 font-bold transition-all relative ${importMode === 'text' ? 'text-primary' : 'text-muted hover:text-slate-600'}`}
                                    onClick={() => setImportMode('text')}
                                >
                                    Pegar Texto
                                    {importMode === 'text' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
                                </button>
                            </div>

                            {importMode === 'file' ? (
                                <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv,.xlsx,.txt,.pdf,.docx"
                                        onChange={handleFileSelect}
                                        style={{ display: 'none' }}
                                    />
                                    <div className="flex flex-col items-center">
                                        <div className="p-6 bg-primary/5 rounded-3xl mb-4">
                                            <Upload size={48} className="text-primary opacity-60" />
                                        </div>
                                        <h3 className="text-h3 font-bold text-slate-800 mb-2">Arrastrá cualquier archivo aquí</h3>
                                        <p className="text-body text-muted mb-6">Excel (XLSX), CSV, Word, PDF o Texto</p>
                                        <button className="btn btn-primary px-8" disabled={isLoading}>
                                            {isLoading ? 'Procesando...' : 'Seleccionar Archivo'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="paste-area">
                                    <textarea
                                        className="form-input w-full min-h-[220px] mb-6 p-6 font-mono text-small border-2 border-slate-100 focus:border-primary rounded-2xl shadow-inner bg-slate-50/50"
                                        placeholder={`Pegá aquí tu lista de productos... Ejemplo:
P-001 Ramo de Rosas $1500
P-002 Margaritas $$800 $1200
ABC-123 Tulipanes $950

Símbolos:
  $ = Precio de venta
  $$ = Costo (podés usar ambos: $$800 $1200)
  + = Cantidad de stock (ej: +50)`}
                                        value={pastedText}
                                        onChange={(e) => setPastedText(e.target.value)}
                                    />
                                    <button
                                        className="btn btn-primary w-full py-4 font-bold text-lg rounded-2xl shadow-lg shadow-primary/20"
                                        onClick={handleTextSubmit}
                                        disabled={isLoading || !pastedText.trim()}
                                    >
                                        {isLoading ? 'Procesando...' : 'Procesar Texto'}
                                    </button>
                                </div>
                            )}

                            <div className="import-instructions mt-10">
                                <h4 className="text-h4 mb-6 flex items-center gap-2 text-slate-800 font-bold">
                                    <FileText size={22} className="text-primary" />
                                    Guía Rápida de Importación
                                </h4>
                                
                                <div className="instructions-layout">
                                    <div className="instructions-steps">
                                        <div className="instruction-step">
                                            <div className="step-icon flex-shrink-0">1</div>
                                            <div className="step-content">
                                                <strong className="text-slate-800">Subí tu archivo o pegá texto</strong>
                                                <p>Soportamos casi cualquier formato comercial para tu comodidad.</p>
                                            </div>
                                        </div>
                                        <div className="instruction-step">
                                            <div className="step-icon flex-shrink-0">2</div>
                                            <div className="step-content">
                                                <strong className="text-slate-800">Inteligencia Automática</strong>
                                                <p>Detectamos códigos, nombres y precios de forma inteligente.</p>
                                            </div>
                                        </div>
                                        <div className="instruction-step">
                                            <div className="step-icon flex-shrink-0">3</div>
                                            <div className="step-content">
                                                <strong className="text-slate-800">Revisión Flexible</strong>
                                                <p>Podrás editar cada fila manualmente antes de confirmar el guardado.</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="instructions-advanced bg-slate-50/80 p-6 rounded-2xl border border-slate-100">
                                        <h5 className="advanced-title text-slate-800 font-bold mb-4">Atajos útiles:</h5>
                                        <div className="shortcuts-list space-y-3">
                                            <div className="shortcut-item flex items-center gap-3">
                                                <kbd className="px-2 py-1 bg-white border border-slate-200 rounded shadow-sm text-primary font-bold font-mono">$</kbd> 
                                                <span className="text-small text-slate-600">Precio Venta</span>
                                            </div>
                                            <div className="shortcut-item flex items-center gap-3">
                                                <kbd className="px-2 py-1 bg-white border border-slate-200 rounded shadow-sm text-primary font-bold font-mono">$$</kbd> 
                                                <span className="text-small text-slate-600">Costo Unitario</span>
                                            </div>
                                            <div className="shortcut-item flex items-center gap-3">
                                                <kbd className="px-2 py-1 bg-white border border-slate-200 rounded shadow-sm text-primary font-bold font-mono">+</kbd> 
                                                <span className="text-small text-slate-600">Sumar Stock</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="template-btn mt-8 flex items-center gap-3 w-full justify-center transition-all hover:bg-primary/10"
                                    onClick={handleDownloadTemplate}
                                >
                                    <Download size={18} />
                                    Descargar plantilla CSV de referencia
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PREVIEW */}
                    {step === 'preview' && parsedData && (
                        <div className="import-step animate-fade-in">
                            <div className="preview-summary">
                                <div className="summary-card">
                                    <div className="p-3 bg-success/10 rounded-xl">
                                        <CheckCircle2 size={24} className="text-success" />
                                    </div>
                                    <div>
                                        <p className="text-h2 font-black text-slate-800 leading-tight">{parsedData.total_rows}</p>
                                        <p className="text-micro font-bold uppercase tracking-wider text-muted">Productos detectados</p>
                                    </div>
                                </div>
                                <div className="summary-card">
                                    <div className="p-3 bg-primary/10 rounded-xl">
                                        <FileText size={24} className="text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-small font-bold text-slate-800 truncate max-w-[150px]">{parsedData.filename}</p>
                                        <p className="text-micro font-bold uppercase tracking-wider text-muted">Origen: {parsedData.method}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="editable-preview">
                                <div className="flex justify-between items-center mb-4 px-1">
                                    <h4 className="text-body font-black text-slate-800">Revisá y Editá los Datos</h4>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 bg-slate-100 p-1.5 px-3 rounded-xl border border-slate-200">
                                            <Layers size={14} className="text-primary" />
                                            <span className="text-micro font-bold text-muted whitespace-nowrap">Categoría global:</span>
                                            <select 
                                                className="table-input py-0 text-micro border-none bg-transparent h-auto font-bold text-slate-700"
                                                value={globalCategoryId}
                                                onChange={(e) => {
                                                    const cid = e.target.value;
                                                    setGlobalCategoryId(cid);
                                                    const newData = parsedData.data.map((row: any) => ({
                                                        ...row,
                                                        category_id: cid || null
                                                    }));
                                                    setParsedData({ ...parsedData, data: newData });
                                                }}
                                            >
                                                <option value="">(Ninguna)</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            className="btn btn-secondary btn-sm rounded-xl py-2 px-3 flex items-center gap-2"
                                            onClick={() => {
                                                const newItem = { code: '', name: '', cost: 0, price: 0, stock: 0, category_id: globalCategoryId || null };
                                                const newData = [newItem, ...parsedData.data];
                                                setParsedData({ ...parsedData, data: newData, total_rows: newData.length });
                                            }}
                                        >
                                            <Plus size={14} /> Fila
                                        </button>
                                    </div>
                                </div>
                                <div className="preview-table-container">
                                    <div className="table-scroll-area">
                                        <table className="preview-table">
                                            <thead>
                                                <tr>
                                                    <th>Código</th>
                                                    <th>Nombre</th>
                                                    <th>Categoría</th>
                                                    <th style={{ width: '100px' }}>Costo</th>
                                                    <th style={{ width: '100px' }}>Precio</th>
                                                    <th style={{ width: '80px' }}>Stock</th>
                                                    <th style={{ width: '40px' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parsedData.data.map((row: any, i: number) => (
                                                    <tr key={i}>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                value={row.code || ''}
                                                                onChange={(e) => {
                                                                    const newData = [...parsedData.data];
                                                                    newData[i] = { ...row, code: e.target.value };
                                                                    setParsedData({ ...parsedData, data: newData });
                                                                }}
                                                                className="table-input font-mono font-bold"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                value={row.name || ''}
                                                                onChange={(e) => {
                                                                    const newData = [...parsedData.data];
                                                                    newData[i] = { ...row, name: e.target.value };
                                                                    setParsedData({ ...parsedData, data: newData });
                                                                }}
                                                                className="table-input font-bold"
                                                            />
                                                        </td>
                                                        <td>
                                                            <select
                                                                value={row.category_id || ''}
                                                                onChange={(e) => {
                                                                    const newData = [...parsedData.data];
                                                                    newData[i] = { ...row, category_id: e.target.value || null };
                                                                    setParsedData({ ...parsedData, data: newData });
                                                                }}
                                                                className="table-input font-medium"
                                                            >
                                                                <option value="">(Sin categ.)</option>
                                                                {categories.map(c => (
                                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                value={row.cost || 0}
                                                                onChange={(e) => {
                                                                    const newData = [...parsedData.data];
                                                                    newData[i] = { ...row, cost: Number(e.target.value) };
                                                                    setParsedData({ ...parsedData, data: newData });
                                                                }}
                                                                className="table-input text-right font-bold"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                value={row.price || 0}
                                                                onChange={(e) => {
                                                                    const newData = [...parsedData.data];
                                                                    newData[i] = { ...row, price: Number(e.target.value) };
                                                                    setParsedData({ ...parsedData, data: newData });
                                                                }}
                                                                className="table-input text-right text-primary font-black"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                value={row.stock || 0}
                                                                onChange={(e) => {
                                                                    const newData = [...parsedData.data];
                                                                    newData[i] = { ...row, stock: Number(e.target.value) };
                                                                    setParsedData({ ...parsedData, data: newData });
                                                                }}
                                                                className="table-input text-center font-bold"
                                                            />
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn-icon text-danger hover:bg-danger/10 p-2 rounded-lg"
                                                                onClick={() => {
                                                                    const newData = parsedData.data.filter((_: any, idx: number) => idx !== i);
                                                                    setParsedData({ ...parsedData, data: newData, total_rows: newData.length });
                                                                }}
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="import-actions">
                                <button className="btn btn-secondary px-8 font-bold" onClick={() => setStep('upload')}>
                                    Volver
                                </button>
                                <button
                                    className="btn btn-primary px-12 font-black shadow-lg shadow-primary/20"
                                    onClick={() => setStep('confirm')}
                                >
                                    Continuar
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* STEP 3: CONFIRM (Summary) */}
                    {step === 'confirm' && parsedData && (
                        <div className="import-step animate-fade-in">
                            <div className="flex items-center gap-4 mb-8 bg-primary/5 p-6 rounded-2xl border border-primary/10">
                                <div className="p-3 bg-primary/10 rounded-xl">
                                    <CheckCircle2 size={32} className="text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-h3 font-bold text-slate-800">Casi listo para importar</h3>
                                    <p className="text-small text-muted">Ajustá las preferencias de actualización y confirmá para comenzar.</p>
                                </div>
                            </div>

                            <div className="preview-summary">
                                <div className="summary-card">
                                    <div className="p-3 bg-success/10 rounded-xl">
                                        <Layers size={24} className="text-success" />
                                    </div>
                                    <div>
                                        <p className="text-h3 font-black text-slate-800 leading-tight">{parsedData.total_rows}</p>
                                        <p className="text-micro uppercase tracking-wider text-muted font-bold">Productos</p>
                                    </div>
                                </div>
                                <div className="summary-card">
                                    <div className="p-3 bg-primary/10 rounded-xl">
                                        <FileText size={24} className="text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-small font-bold truncate max-w-[140px] text-slate-800">{parsedData.filename || 'Texto Pegado'}</p>
                                        <p className="text-micro uppercase tracking-wider text-muted font-bold">Origen</p>
                                    </div>
                                </div>
                            </div>

                            <div className="import-options space-y-6">
                                <div className="option-group">
                                    <h4 className="text-body font-bold mb-6 flex items-center gap-2 text-slate-800">
                                        <Settings size={20} className="text-primary" />
                                        Preferencias de Actualización
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className={`option-selector ${updateCosts ? 'active' : ''}`}>
                                            <input type="checkbox" checked={updateCosts} onChange={(e) => setUpdateCosts(e.target.checked)} />
                                            <div className="selector-content">
                                                <strong>Actualizar Costos</strong>
                                                <span>Se ajustará el costo unitario de cada producto.</span>
                                            </div>
                                        </label>

                                        <label className={`option-selector ${updatePrices ? 'active' : ''}`}>
                                            <input type="checkbox" checked={updatePrices} onChange={(e) => setUpdatePrices(e.target.checked)} />
                                            <div className="selector-content">
                                                <strong>Actualizar Precios</strong>
                                                <span>Se aplicarán los nuevos precios de venta.</span>
                                            </div>
                                        </label>

                                        <label className={`option-selector ${updateStock ? 'active' : ''}`}>
                                            <input type="checkbox" checked={updateStock} onChange={(e) => setUpdateStock(e.target.checked)} />
                                            <div className="selector-content">
                                                <strong>Actualizar Stock</strong>
                                                <span>Se modificarán las cantidades disponibles.</span>
                                            </div>
                                        </label>

                                        {updateStock && (
                                            <div className="col-span-full animate-fade-in">
                                                <div className="stock-mode-selector">
                                                    <button 
                                                        className={stockAction === 'add' ? 'active' : ''}
                                                        onClick={() => setStockAction('add')}
                                                    >
                                                        Sumar al Stock actual
                                                    </button>
                                                    <button 
                                                        className={stockAction === 'set' ? 'active' : ''}
                                                        onClick={() => setStockAction('set')}
                                                    >
                                                        Sobreescribir Stock
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="option-group">
                                    <h4 className="text-body font-bold mb-6 flex items-center gap-2 text-slate-800">
                                        <TrendingUp size={20} className="text-primary" />
                                        Margen y Automatización
                                    </h4>
                                    
                                    <label className={`option-selector ${autoMargin ? 'active' : ''}`}>
                                        <input type="checkbox" checked={autoMargin} onChange={(e) => setAutoMargin(e.target.checked)} />
                                        <div className="selector-content">
                                            <strong>Margen Automático</strong>
                                            <span>Calcular precios basándose en costos + {marginPercent}%</span>
                                        </div>
                                    </label>

                                    {autoMargin && (
                                        <div className="mt-8 px-2 animate-fade-in">
                                            <input
                                                type="range"
                                                min="0"
                                                max="200"
                                                step="5"
                                                value={marginPercent}
                                                onChange={(e) => setMarginPercent(Number(e.target.value))}
                                                className="w-full accent-primary"
                                            />
                                            <div className="flex justify-between text-micro font-bold text-muted mt-3">
                                                <span>0%</span>
                                                <span className="text-primary text-small">{marginPercent}% de Margen</span>
                                                <span>200%</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="import-actions">
                                <button className="btn btn-secondary px-8 font-bold" onClick={() => setStep('preview')}>
                                    Volver
                                </button>
                                <button 
                                    className="btn btn-primary btn-lg px-12 flex-1 relative overflow-hidden group" 
                                    onClick={handleImport}
                                    disabled={isLoading}
                                >
                                    <span className="relative z-10">
                                        {isLoading ? (
                                            <div className="flex items-center justify-center gap-3">
                                                <div className="loader-small" />
                                                Importando {importProgress.current}/{importProgress.total}...
                                            </div>
                                        ) : (
                                            'COMENZAR IMPORTACIÓN'
                                        )}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: RESULT */}
                    {step === 'result' && importResult && (
                        <div className="import-step animate-fade-in">
                            <div className="result-screen">
                                <div className="result-icon-container">
                                    <CheckCircle2 size={48} className="text-success" />
                                </div>
                                <h2 className="text-h1 font-black text-slate-800 mb-2">¡Todo listo!</h2>
                                <p className="text-body text-muted mb-8">La importación se procesó correctamente.</p>
                                
                                <div className="preview-summary max-w-md mx-auto">
                                    <div className="summary-card flex-col items-center text-center p-6">
                                        <span className="text-h2 font-black text-success leading-tight">{importResult.updated}</span>
                                        <span className="text-micro font-bold uppercase text-muted">Actualizados</span>
                                    </div>
                                    <div className="summary-card flex-col items-center text-center p-6">
                                        <span className="text-h2 font-black text-primary leading-tight">{importResult.created}</span>
                                        <span className="text-micro font-bold uppercase text-muted">Creados</span>
                                    </div>
                                    {importResult.errors.length > 0 && (
                                        <div className="summary-card flex-col items-center text-center p-6 border-danger/20 bg-danger/5">
                                            <span className="text-h2 font-black text-danger leading-tight">{importResult.errors.length}</span>
                                            <span className="text-micro font-bold uppercase text-muted">Errores</span>
                                        </div>
                                    )}
                                </div>

                                {importResult.errors.length > 0 && (
                                    <div className="mt-8 text-left max-w-lg mx-auto">
                                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                                            <h4 className="text-body font-bold mb-4 text-slate-800 flex items-center gap-2">
                                                <X size={18} className="text-danger" />
                                                Detalle de Errores ({importResult.errors.length}):
                                            </h4>
                                            <div className="max-h-[180px] overflow-y-auto space-y-2 pr-2">
                                                {importResult.errors.map((error: any, i: number) => (
                                                    <div key={i} className="text-small bg-white p-3 rounded-xl border border-slate-100 flex justify-between shadow-sm">
                                                        <span className="font-mono text-muted">{error.code || 'N/A'}:</span>
                                                        <span className="text-slate-700 font-medium ml-4">{error.error}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="import-actions mt-8">
                                <button className="btn btn-primary btn-lg w-full" onClick={handleClose}>
                                    Finalizar y Cerrar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};

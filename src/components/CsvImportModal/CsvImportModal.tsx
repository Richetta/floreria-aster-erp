import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle2, Download, Settings, Plus, Layers } from 'lucide-react';
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
                    <h2 className="text-h2 flex items-center gap-2">
                        <Upload size={24} className="text-primary" />
                        Importar Productos
                    </h2>
                    <button className="btn-icon" onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="csv-import-body">
                    {/* STEP 1: UPLOAD / PASTE */}
                    {step === 'upload' && (
                        <div className="import-step">
                            <div className="flex border-b mb-6 border-slate-700">
                                <button
                                    className={`px-6 py-2 font-medium transition-all ${importMode === 'file' ? 'border-b-2 border-primary text-primary' : 'text-muted'}`}
                                    onClick={() => setImportMode('file')}
                                >
                                    Archivo
                                </button>
                                <button
                                    className={`px-6 py-2 font-medium transition-all ${importMode === 'text' ? 'border-b-2 border-primary text-primary' : 'text-muted'}`}
                                    onClick={() => setImportMode('text')}
                                >
                                    Pegar Texto
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
                                    <Upload size={48} className="text-muted mb-4" />
                                    <h3 className="text-h3 mb-2">Arrastrá cualquier archivo aquí</h3>
                                    <p className="text-body text-muted mb-4">PDF, Excel, Word, CSV o Texto</p>
                                    <button className="btn btn-secondary" disabled={isLoading}>
                                        {isLoading ? 'Procesando...' : 'Seleccionar Archivo'}
                                    </button>
                                </div>
                            ) : (
                                <div className="paste-area">
                                    <textarea
                                        className="form-input w-full min-h-[200px] mb-4 p-4 font-mono text-small"
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
                                        className="btn btn-primary w-full"
                                        onClick={handleTextSubmit}
                                        disabled={isLoading || !pastedText.trim()}
                                    >
                                        {isLoading ? 'Procesando...' : 'Procesar Texto'}
                                    </button>
                                </div>
                            )}

                            <div className="import-instructions mt-8">
                                <h4 className="text-h4 mb-4 flex items-center gap-2 text-primary-dark">
                                    <FileText size={20} />
                                    Guía Rápida de Importación
                                </h4>
                                
                                <div className="instructions-layout">
                                    <div className="instructions-steps">
                                        <div className="instruction-step">
                                            <div className="step-icon">1</div>
                                            <div className="step-content">
                                                <strong>Subí tu archivo o pegá texto</strong>
                                                <p>Soportamos Excel (XLSX), CSV, Word, PDF o texto plano.</p>
                                            </div>
                                        </div>
                                        <div className="instruction-step">
                                            <div className="step-icon">2</div>
                                            <div className="step-content">
                                                <strong>Inteligencia Automática</strong>
                                                <p>El sistema busca códigos (Ej: P-101), nombres y precios extraídos dinámicamente.</p>
                                            </div>
                                        </div>
                                        <div className="instruction-step">
                                            <div className="step-icon">3</div>
                                            <div className="step-content">
                                                <strong>Revisión Flexible</strong>
                                                <p>En el próximo paso podrás editar todo cómodamente antes de guardarlo en tu base de datos.</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="instructions-advanced">
                                        <h5 className="advanced-title">Atajos para Pegar Texto:</h5>
                                        <div className="shortcuts-list">
                                            <div className="shortcut-item">
                                                <kbd>$</kbd> <span>Precio Venta (ej: $1500)</span>
                                            </div>
                                            <div className="shortcut-item">
                                                <kbd>$$</kbd> <span>Costo (ej: $$800)</span>
                                            </div>
                                            <div className="shortcut-item">
                                                <kbd>+</kbd> <span>Stock (ej: +50)</span>
                                            </div>
                                        </div>
                                        <div className="shortcut-example">
                                            <span className="example-label">Ejemplo combinando:</span>
                                            <code>P-004 Rosas $$800 $1200 +30</code>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="btn btn-outline mt-5 flex items-center gap-2 w-full justify-center template-btn"
                                    onClick={handleDownloadTemplate}
                                >
                                    <Download size={16} />
                                    Descargar plantilla de ejemplo
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PREVIEW */}
                    {step === 'preview' && parsedData && (
                        <div className="import-step">
                            <div className="preview-summary">
                                <div className="summary-card">
                                    <CheckCircle2 size={24} className="text-success" />
                                    <div>
                                        <p className="text-h3">{parsedData.total_rows}</p>
                                        <p className="text-small text-muted">Productos detectados</p>
                                    </div>
                                </div>
                                <div className="summary-card">
                                    <FileText size={24} className="text-primary" />
                                    <div>
                                        <p className="text-small font-bold truncate max-w-[120px]">{parsedData.filename}</p>
                                        <p className="text-micro text-muted">Método: {parsedData.method}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="preview-table-container editable-preview">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-h4">Revisá y Editá los Datos:</h4>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 bg-slate-800/50 p-1 px-3 rounded-lg border border-slate-700">
                                            <Layers size={14} className="text-primary" />
                                            <span className="text-micro text-muted whitespace-nowrap">Aplicar categoría a todos:</span>
                                            <select 
                                                className="table-input py-1 text-micro border-none bg-transparent h-auto"
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
                                            className="btn btn-secondary btn-sm flex items-center gap-1"
                                            onClick={() => {
                                                const newItem = { code: '', name: '', cost: 0, price: 0, stock: 0, category_id: globalCategoryId || null };
                                                const newData = [newItem, ...parsedData.data];
                                                setParsedData({ ...parsedData, data: newData, total_rows: newData.length });
                                            }}
                                        >
                                            <Plus size={14} /> Agregar Fila
                                        </button>
                                    </div>
                                </div>
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
                                                            className="table-input"
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
                                                            className="table-input"
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
                                                            className="table-input"
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
                                                            className="table-input"
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
                                                            className="table-input"
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
                                                            className="table-input"
                                                        />
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="btn-icon text-danger p-1"
                                                            onClick={() => {
                                                                const newData = parsedData.data.filter((_: any, idx: number) => idx !== i);
                                                                setParsedData({ ...parsedData, data: newData, total_rows: newData.length });
                                                            }}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="import-actions">
                                <button className="btn btn-secondary" onClick={() => setStep('upload')}>
                                    Volver
                                </button>
                                <button
                                    className="btn btn-primary"
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
                            <div className="flex items-center gap-3 mb-6 bg-primary/10 p-4 rounded-xl border border-primary/20">
                                <CheckCircle2 size={32} className="text-primary" />
                                <div>
                                    <h3 className="text-h3 font-bold">Resumen de Importación</h3>
                                    <p className="text-small text-muted">Confirmá los datos y la configuración antes de procesar.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="summary-card p-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <p className="text-micro uppercase tracking-wider text-muted mb-1 font-bold">Total de Productos</p>
                                    <p className="text-h1 font-black text-primary leading-none">{parsedData.total_rows}</p>
                                </div>
                                <div className="summary-card p-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <p className="text-micro uppercase tracking-wider text-muted mb-1 font-bold">Archivo/Origen</p>
                                    <p className="text-body font-bold truncate max-w-full text-white">{parsedData.filename || 'Pasted Text'}</p>
                                </div>
                            </div>

                            <div className="import-options space-y-6">
                                <div className="option-group bg-slate-800/20 p-5 rounded-2xl border border-slate-700/30">
                                    <h4 className="text-body font-bold mb-4 flex items-center gap-2">
                                        <Layers size={18} className="text-primary" />
                                        ¿Qué datos querés actualizar?
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <label className={`option-selector ${updateCosts ? 'active' : ''}`}>
                                            <input type="checkbox" checked={updateCosts} onChange={(e) => setUpdateCosts(e.target.checked)} />
                                            <div className="selector-content">
                                                <strong>Costos</strong>
                                                <span>Actualizar costo unitario</span>
                                            </div>
                                        </label>

                                        <label className={`option-selector ${updatePrices ? 'active' : ''}`}>
                                            <input type="checkbox" checked={updatePrices} onChange={(e) => setUpdatePrices(e.target.checked)} />
                                            <div className="selector-content">
                                                <strong>Precios</strong>
                                                <span>Actualizar precio de venta</span>
                                            </div>
                                        </label>

                                        <label className={`option-selector ${updateStock ? 'active' : ''}`}>
                                            <input type="checkbox" checked={updateStock} onChange={(e) => setUpdateStock(e.target.checked)} />
                                            <div className="selector-content">
                                                <strong>Stock</strong>
                                                <span>Actualizar unidades disponibles</span>
                                            </div>
                                        </label>

                                        {updateStock && (
                                            <div className="stock-mode-selector col-span-full mt-2 bg-slate-900/50 p-2 rounded-xl flex">
                                                <button 
                                                    className={`flex-1 py-2 text-small font-bold rounded-lg transition-all ${stockAction === 'add' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}
                                                    onClick={() => setStockAction('add')}
                                                >
                                                    Sumar al Stock actual
                                                </button>
                                                <button 
                                                    className={`flex-1 py-2 text-small font-bold rounded-lg transition-all ${stockAction === 'set' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}
                                                    onClick={() => setStockAction('set')}
                                                >
                                                    Sobreescribir Stock
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="option-group bg-slate-800/20 p-5 rounded-2xl border border-slate-700/30">
                                    <h4 className="text-body font-bold mb-4 flex items-center gap-2">
                                        <Settings size={18} className="text-primary" />
                                        Automatización
                                    </h4>
                                    
                                    <label className={`option-selector ${autoMargin ? 'active' : ''}`}>
                                        <input type="checkbox" checked={autoMargin} onChange={(e) => setAutoMargin(e.target.checked)} />
                                        <div className="selector-content">
                                            <strong>Margen Automático</strong>
                                            <span>Calcular precios basándose en costos + {marginPercent}%</span>
                                        </div>
                                    </label>

                                    {autoMargin && (
                                        <div className="mt-4 px-4">
                                            <input
                                                type="range"
                                                min="0"
                                                max="200"
                                                step="5"
                                                value={marginPercent}
                                                onChange={(e) => setMarginPercent(Number(e.target.value))}
                                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                            <div className="flex justify-between text-micro text-muted mt-2">
                                                <span>0%</span>
                                                <span className="text-primary font-bold">{marginPercent}% Margen</span>
                                                <span>200%</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="import-actions mt-8">
                                <button className="btn btn-secondary btn-lg px-8" onClick={() => setStep('preview')}>
                                    Volver
                                </button>
                                <button 
                                    className="btn btn-primary btn-lg px-12 flex-1 relative overflow-hidden group" 
                                    onClick={handleImport}
                                    disabled={isLoading}
                                >
                                    <span className="relative z-10">
                                        {isLoading ? (
                                            <div className="flex items-center gap-3">
                                                <div className="loader-small" />
                                                Procesando {importProgress.current}/{importProgress.total}...
                                            </div>
                                        ) : (
                                            'CONFIRMAR E IMPORTAR AHORA'
                                        )}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: RESULT */}
                    {step === 'result' && importResult && (
                        <div className="import-step">
                            <div className="import-result">
                                <div className="result-icon">
                                    <CheckCircle2 size={64} className="text-success" />
                                </div>
                                <h3 className="text-h2 mb-4">¡Importación Completada!</h3>
                                
                                <div className="result-summary">
                                    <div className="result-item">
                                        <span className="result-label">Actualizados:</span>
                                        <span className="result-value text-success">{importResult.updated}</span>
                                    </div>
                                    <div className="result-item">
                                        <span className="result-label">Creados:</span>
                                        <span className="result-value text-primary">{importResult.created}</span>
                                    </div>
                                    {importResult.errors.length > 0 && (
                                        <div className="result-item">
                                            <span className="result-label">Errores:</span>
                                            <span className="result-value text-danger">{importResult.errors.length}</span>
                                        </div>
                                    )}
                                </div>

                                {importResult.errors.length > 0 && (
                                    <div className="errors-detail mt-6 bg-danger/5 border border-danger/20 p-4 rounded-xl">
                                        <h4 className="text-body font-bold mb-3 text-danger flex items-center gap-2">
                                            <X size={18} />
                                            Detalle de Errores ({importResult.errors.length}):
                                        </h4>
                                        <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                                            {importResult.errors.map((error: any, i: number) => (
                                                <div key={i} className="error-item text-small bg-slate-900/50 p-2 rounded border border-slate-700/50 flex justify-between">
                                                    <span className="font-mono text-muted">{error.code || 'N/A'}:</span>
                                                    <span className="text-white ml-2 text-right">{error.error}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-micro text-muted mt-3">
                                            Los productos con error no fueron procesados. Podés corregirlos e intentar de nuevo.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="import-actions">
                                <button className="btn btn-primary" onClick={handleClose}>
                                    Cerrar
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

import React, { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle2, Download, Settings, Plus } from 'lucide-react';
import { api } from '../../services/api';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../ui/Modals';
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
    const [step, setStep] = useState<'upload' | 'preview' | 'options' | 'result'>('upload');
    const [importMode, setImportMode] = useState<'file' | 'text'>('file');
    const [pastedText, setPastedText] = useState('');

    // Import options
    const [updateCosts, setUpdateCosts] = useState(true);
    const [updatePrices, setUpdatePrices] = useState(true);
    const [updateStock, setUpdateStock] = useState(false);
    const [autoMargin, setAutoMargin] = useState(false);
    const [marginPercent, setMarginPercent] = useState(50);

    const { alertModal, showAlert } = useModal();

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
                // Better regex for codes: Starts with letter/number + hyphen + letter/number
                // Also catches things like "ABC-123", "P-400", "FLOWER-1"
                const codeMatch = line.match(/\b([A-Z0-9]+-[A-Z0-9]+|[A-Z]{2,}[0-9]+)\b/i);

                // Detect cost (with $$) and price (with $)
                // costMatch picks up the $$... part
                const costMatch = line.match(/\$\$\s*(\$|USD)?\s*(\d+([,.]\d+)*)/i);
                
                // priceMatch picks up $... but NOT $$...
                // We use lookbehind and lookahead to ensure it's a SINGLE $
                const priceMatch = line.match(/(?<!\$)\$\s*(?!\$)\s*(\$|USD)?\s*(\d+([,.]\d+)*)/i);

                // Detect stock with + symbol
                const stockMatch = line.match(/\+\s*(\d+)/);

                // For removal from name, we need the full matched strings
                const matchStrings = {
                    code: codeMatch ? codeMatch[0] : null,
                    cost: costMatch ? costMatch[0] : null,
                    price: priceMatch ? priceMatch[0] : null,
                    stock: stockMatch ? stockMatch[0] : null
                };

                // Fallback: search for any number NOT already picked up
                let anyPriceMatch = null;
                if (!priceMatch) {
                    const allNumbers = line.match(/(\$|USD)?\s*(\d+([,.]\d+)*)/gi);
                    if (allNumbers) {
                        anyPriceMatch = allNumbers.find(m => {
                            if (matchStrings.cost && m.includes(matchStrings.cost.replace(/\$\$/g, ''))) return false;
                            if (matchStrings.stock && m.includes(matchStrings.stock.replace(/\+/g, ''))) return false;
                            if (matchStrings.code && m.includes(matchStrings.code)) return false;
                            return true;
                        });
                    }
                }

                let name = line;
                Object.values(matchStrings).forEach(m => {
                    if (m) name = name.replace(m, '');
                });
                if (anyPriceMatch && !priceMatch) {
                    name = name.replace(anyPriceMatch, '');
                }

                const parseNumber = (match: RegExpMatchArray | null | string, groupIndex: number = 2) => {
                    if (!match) return 0;
                    const str = typeof match === 'string' ? match : match[groupIndex];
                    if (!str) return 0;
                    return Number(str.replace(/\./g, '').replace(',', '.'));
                };

                return {
                    code: codeMatch ? codeMatch[0].toUpperCase() : '',
                    name: name.replace(/\s+/g, ' ').trim() || 'Producto sin nombre',
                    cost: costMatch ? parseNumber(costMatch, 2) : 0,
                    price: priceMatch ? parseNumber(priceMatch, 2) : (anyPriceMatch ? parseNumber(anyPriceMatch, 2) : 0),
                    stock: stockMatch ? Number(stockMatch[1]) : 0
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
        try {
            // Use only the edited data from the preview table
            const result = await api.importPrices(parsedData.data, {
                update_costs: updateCosts,
                update_prices: updatePrices,
                update_stock: updateStock,
                auto_margin: autoMargin,
                margin_percent: marginPercent
            });
            setImportResult(result);
            setStep('result');
        } catch (error: any) {
            showAlert({ title: 'Error', message: 'Error al importar: ' + error.message, variant: 'error' });
        } finally {
            setIsLoading(false);
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

                            <div className="import-instructions mt-6">
                                <h4 className="text-h4 mb-3 flex items-center gap-2">
                                    <FileText size={18} />
                                    Instrucciones de Importación
                                </h4>
                                <div className="instructions-grid">
                                    <div className="instruction-item">
                                        <div className="step-num">1</div>
                                        <p><strong>Formatos:</strong> Podés subir listas en PDF, Excel, Word o pegar texto directamente.</p>
                                    </div>
                                    <div className="instruction-item">
                                        <div className="step-num">2</div>
                                        <p><strong>Detección automática:</strong> El sistema busca códigos (ej: P-101) y precios.</p>
                                    </div>
                                    <div className="instruction-item">
                                        <div className="step-num">3</div>
                                        <p><strong>Símbolos para pegar texto:</strong></p>
                                        <ul className="symbol-list">
                                            <li><code>$</code> = Precio de venta (ej: <code>$1500</code>)</li>
                                            <li><code>$$</code> = Costo (ej: <code>$$800</code>)</li>
                                            <li><code>+</code> = Stock (ej: <code>+50</code>)</li>
                                            <li>Podés combinar: <code>$$800 $1200 +30</code></li>
                                        </ul>
                                    </div>
                                    <div className="instruction-item">
                                        <div className="step-num">4</div>
                                        <p><strong>Edición:</strong> Revisá y corregí los datos antes de guardar en el próximo paso.</p>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-outline mt-4 flex items-center gap-2 w-full justify-center"
                                    onClick={handleDownloadTemplate}
                                >
                                    <Download size={16} />
                                    Descargar plantilla ejemplo
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
                                    <button
                                        className="btn btn-secondary btn-sm flex items-center gap-1"
                                        onClick={() => {
                                            const newItem = { code: '', name: '', cost: 0, price: 0, stock: 0 };
                                            const newData = [newItem, ...parsedData.data];
                                            setParsedData({ ...parsedData, data: newData, total_rows: newData.length });
                                        }}
                                    >
                                        <Plus size={14} /> Agregar Fila
                                    </button>
                                </div>
                                <div className="table-scroll-area">
                                    <table className="preview-table">
                                        <thead>
                                            <tr>
                                                <th>Código</th>
                                                <th>Nombre</th>
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
                                    onClick={() => setStep('options')}
                                >
                                    Continuar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: OPTIONS */}
                    {step === 'options' && (
                        <div className="import-step">
                            <h3 className="text-h3 mb-4">Opciones de Importación</h3>

                            <div className="import-options">
                                <div className="option-group">
                                    <h4 className="text-h4 mb-3">¿Qué datos querés actualizar?</h4>
                                    
                                    <label className="option-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={updateCosts}
                                            onChange={(e) => setUpdateCosts(e.target.checked)}
                                        />
                                        <span>Actualizar Costos</span>
                                    </label>

                                    <label className="option-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={updatePrices}
                                            onChange={(e) => setUpdatePrices(e.target.checked)}
                                        />
                                        <span>Actualizar Precios</span>
                                    </label>

                                    <label className="option-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={updateStock}
                                            onChange={(e) => setUpdateStock(e.target.checked)}
                                        />
                                        <span>Actualizar Stock</span>
                                    </label>
                                </div>

                                <div className="option-group">
                                    <h4 className="text-h4 mb-3 flex items-center gap-2">
                                        <Settings size={18} />
                                        Configuración de Precios
                                    </h4>
                                    
                                    <label className="option-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={autoMargin}
                                            onChange={(e) => setAutoMargin(e.target.checked)}
                                        />
                                        <span>Calcular precio automáticamente con margen</span>
                                    </label>

                                    {autoMargin && (
                                        <div className="margin-input ml-6 mt-2">
                                            <label className="form-label">Margen (%):</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={marginPercent}
                                                onChange={(e) => setMarginPercent(Number(e.target.value))}
                                                min="0"
                                                max="200"
                                                style={{ width: '100px' }}
                                            />
                                            <p className="text-micro text-muted mt-1">
                                                Precio = Costo × (1 + {marginPercent}%)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="import-actions">
                                <button className="btn btn-secondary" onClick={() => setStep('preview')}>
                                    Volver
                                </button>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={handleImport}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Importando...' : 'Importar Datos'}
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
                                    <div className="errors-detail mt-4">
                                        <h4 className="text-h4 mb-2">Errores:</h4>
                                        {importResult.errors.slice(0, 10).map((error: any, i: number) => (
                                            <div key={i} className="error-item text-small">
                                                {error.code}: {error.error}
                                            </div>
                                        ))}
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

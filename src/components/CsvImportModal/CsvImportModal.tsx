import React, { useState } from 'react';
import { 
    X, Upload, FileText, Check, AlertCircle, 
    ChevronRight, FileSpreadsheet,
    Database, RefreshCw, PlusCircle, Download
} from 'lucide-react';
import { api } from '../../services/api';
import './CsvImportModal.css';

interface CsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (result: any) => void;
}

const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [pasteText, setPasteText] = useState('');
    const [importResult, setImportResult] = useState<{ updated: number, created: number } | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleImport = async () => {
        setIsLoading(true);
        setError(null);

        try {
            let dataToImport;

            if (activeTab === 'file' && file) {
                const formData = new FormData();
                formData.append('file', file);
                
                const parseResponse = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/import-data/parse-file`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: formData
                });

                if (!parseResponse.ok) throw new Error('Error al procesar el archivo');
                dataToImport = await parseResponse.json();
            } else if (activeTab === 'text' && pasteText.trim()) {
                const parseResponse = await api.request<any>('/import-data/parse-text', {
                    method: 'POST',
                    body: JSON.stringify({ text: pasteText })
                });
                dataToImport = parseResponse.data;
            }

            if (!dataToImport) throw new Error('No hay datos para importar');

            const importResponse = await api.request<any>('/import-data/bulk-import', {
                method: 'POST',
                body: JSON.stringify({
                    data: dataToImport,
                    update_prices: true,
                    update_stock: false
                })
            });

            setImportResult({
                updated: importResponse.updated || 0,
                created: importResponse.created || 0
            });
            setStep(3);
        } catch (err: any) {
            setError(err.message || 'Error durante la importación');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        const csvContent = 'Código,Nombre,Precio,Costo,Stock,Categoría,Marca\nPROD001,Producto Ejemplo,1000,500,10,Flores,Mi Jardín';
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

    return (
        <div className="import-modal-overlay" onClick={handleClose}>
            <div className="import-modal-container" onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div className="import-modal-header">
                    <h2><Database size={24} /> Importar Productos</h2>
                    <button className="import-modal-close" onClick={handleClose}>
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
                        <span>Revisar</span>
                    </div>
                    <div className="step-divider" />
                    <div className={`step-item ${step >= 3 ? 'active' : ''}`}>
                        <div className="step-number">3</div>
                        <span>Finalizar</span>
                    </div>
                </div>

                <div className="import-modal-content">
                    {step === 1 && (
                        <div className="animate-fadeIn">
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
                                        <h3>{file ? file.name : 'Arrastrá tu archivo aquí'}</h3>
                                        <p>{file ? `${(file.size / 1024).toFixed(2)} KB` : 'Soportamos Excel (XLSX, XLS) y CSV'}</p>
                                    </div>
                                </div>
                            ) : (
                                <textarea 
                                    className="paste-textarea"
                                    placeholder="Pegá aquí el contenido de tu lista...&#10;Ejemplo: Código, Nombre, Precio..."
                                    value={pasteText}
                                    onChange={(e) => setPasteText(e.target.value)}
                                />
                            )}

                            <div className="mt-6">
                                <button onClick={handleDownloadTemplate} className="btn-text text-primary flex items-center gap-2">
                                    <Download size={16} /> Descargar plantilla de ejemplo
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="text-center py-8 animate-fadeIn">
                            <div className="pulse-icon mb-4">
                                <RefreshCw size={48} className="text-primary spinning-icon" />
                            </div>
                            <h3 className="text-h3">Preparado para procesar</h3>
                            <p className="text-muted">Se actualizarán los precios y se crearán los productos inexistentes.</p>
                        </div>
                    )}

                    {step === 3 && importResult && (
                        <div className="success-state text-center animate-fadeIn">
                            <div className="success-icon-large mb-4">
                                <Check size={64} />
                            </div>
                            <h2 className="text-h2 mb-2">¡Importación Exitosa!</h2>
                            <p className="text-muted mb-8">Los datos han sido integrados correctamente.</p>

                            <div className="import-summary-results">
                                <div className="result-card-premium">
                                    <div className="result-val">{importResult.created}</div>
                                    <div className="result-lab">Nuevos</div>
                                    <PlusCircle size={20} className="text-success" />
                                </div>
                                <div className="result-card-premium">
                                    <div className="result-val">{importResult.updated}</div>
                                    <div className="result-lab">Actualizados</div>
                                    <RefreshCw size={20} className="text-primary" />
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="import-error-msg mt-4">
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}
                </div>

                <div className="import-modal-footer">
                    {step === 1 && (
                        <>
                            <button className="btn-premium-secondary" onClick={onClose}>Cancelar</button>
                            <button 
                                className="btn-premium-primary" 
                                onClick={() => setStep(2)}
                                disabled={activeTab === 'file' ? !file : !pasteText.trim()}
                            >
                                Continuar <ChevronRight size={18} />
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <button className="btn-premium-secondary" onClick={() => setStep(1)}>Atrás</button>
                            <button 
                                className="btn-premium-primary" 
                                onClick={handleImport}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Procesando...' : 'Confirmar e Importar'}
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
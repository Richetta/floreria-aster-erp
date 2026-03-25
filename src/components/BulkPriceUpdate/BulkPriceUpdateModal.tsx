import { useState, useCallback, useEffect, useMemo } from 'react';
import { Upload, Download, X, Check, AlertCircle, Search } from 'lucide-react';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../ui/Modals';
import './BulkPriceUpdateModal.css';

interface BulkPriceUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface PriceChange {
    productId: string;
    productName: string;
    oldPrice: number;
    newPrice: number;
    change: number;
    changePercent: number;
}

export const BulkPriceUpdateModal = ({ isOpen, onClose }: BulkPriceUpdateModalProps) => {
    const products = useStore(state => state.products);
    const updateProduct = useStore(state => state.updateProduct);
    const addTransaction = useStore(state => state.addTransaction);

    const [isLoading, setIsLoading] = useState(false);
    const { alertModal, showAlert } = useModal();

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [percentageIncrease, setPercentageIncrease] = useState<number>(0);
    const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
    const [previewChanges, setPreviewChanges] = useState<PriceChange[]>([]);
    const [csvData, setCsvData] = useState<any[]>([]);
    const [importMode, setImportMode] = useState<'percentage' | 'csv' | 'manual'>('percentage');

    // New states for selection and search
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

    // Categorías disponibles
    const categories = useMemo(() => ['all', ...Array.from(new Set(products.map(p => p.category)))], [products]);

    // Productos filtrados por categoría y búsqueda
    const visibleProducts = useMemo(() => products.filter(p => {
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.code.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    }), [products, selectedCategory, searchTerm]);

    const handleToggleAll = () => {
        if (selectedProductIds.size === visibleProducts.length && visibleProducts.length > 0) {
            setSelectedProductIds(new Set());
        } else {
            setSelectedProductIds(new Set(visibleProducts.map(p => p.id)));
        }
    };

    const handleToggleProduct = (id: string) => {
        const newSet = new Set(selectedProductIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedProductIds(newSet);
    };

    // Calcular cambios cuando cambian los inputs
    const calculateChanges = useCallback(() => {
        const changes: PriceChange[] = [];

        if (importMode === 'percentage') {
            products.forEach(product => {
                if (!selectedProductIds.has(product.id)) return;
                const oldPrice = product.price;
                const newPrice = oldPrice * (1 + percentageIncrease / 100);
                changes.push({
                    productId: product.id,
                    productName: product.name,
                    oldPrice,
                    newPrice: Math.round(newPrice),
                    change: Math.round(newPrice - oldPrice),
                    changePercent: percentageIncrease
                });
            });
        } else if (importMode === 'manual') {
            products.forEach(product => {
                if (!selectedProductIds.has(product.id)) return;
                if (customPrices[product.id]) {
                    const oldPrice = product.price;
                    const newPrice = customPrices[product.id];
                    changes.push({
                        productId: product.id,
                        productName: product.name,
                        oldPrice,
                        newPrice,
                        change: newPrice - oldPrice,
                        changePercent: Math.round(((newPrice - oldPrice) / oldPrice) * 100)
                    });
                }
            });
        } else if (importMode === 'csv' && csvData.length > 0) {
            csvData.forEach((row: any) => {
                const product = products.find(p => 
                    p.code === row.codigo || p.name.toLowerCase() === row.nombre?.toLowerCase()
                );
                if (product && row.precio) {
                    const oldPrice = product.price;
                    const newPrice = parseFloat(row.precio);
                    changes.push({
                        productId: product.id,
                        productName: product.name,
                        oldPrice,
                        newPrice,
                        change: newPrice - oldPrice,
                        changePercent: Math.round(((newPrice - oldPrice) / oldPrice) * 100)
                    });
                }
            });
        }

        setPreviewChanges(changes);
    }, [products, percentageIncrease, customPrices, csvData, importMode, selectedProductIds]);

    // Calcular cambios automáticamente
    useEffect(() => {
        calculateChanges();
    }, [calculateChanges]);

    // Manejar archivo (CSV/Excel) usando la API de parseo inteligente
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const result = await api.parseFile(file);
            // Mapear los datos de la API al formato esperado por el modal
            const mappedData = result.data.map((item: any) => ({
                codigo: item.code,
                nombre: item.name,
                precio: item.price
            }));
            setCsvData(mappedData);
        } catch (error: any) {
            showAlert({ 
                title: 'Error al leer archivo', 
                message: error.message || 'No se pudo procesar el archivo. Asegurate de que sea un Excel o CSV válido.', 
                variant: 'error' 
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Descargar plantilla CSV
    const downloadTemplate = () => {
        const headers = 'codigo,nombre,precio\n';
        const rows = products.slice(0, 5).map(p => 
            `${p.code},${p.name},${p.price}`
        ).join('\n');
        
        const csv = headers + rows;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_precios.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Aplicar cambios
    const applyChanges = () => {
        previewChanges.forEach(change => {
            updateProduct(change.productId, { 
                price: change.newPrice
            });

            // Registrar transacción de actualización de precio
            addTransaction({
                id: generateIdWithPrefix('t'),
                type: 'expense',
                category: 'Actualización de Precio',
                amount: 0,
                date: new Date().toISOString(),
                method: 'cash',
                description: `Precio de ${change.productName}: $${change.oldPrice} → $${change.newPrice}`,
                relatedId: change.productId
            });
        });

        showAlert({ title: 'Precios actualizados', message: `Se actualizaron ${previewChanges.length} productos exitosamente`, variant: 'success' });
        setStep(1);
        setPercentageIncrease(0);
        setCustomPrices({});
        setCsvData([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="bulk-price-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="text-h2">📊 Actualización Masiva de Precios</h2>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Steps */}
                <div className="progress-steps">
                    <div className={`step ${step >= 1 ? 'active' : ''}`}>
                        <div className="step-number">1</div>
                        <span>Configurar</span>
                    </div>
                    <div className={`step ${step >= 2 ? 'active' : ''}`}>
                        <div className="step-number">2</div>
                        <span>Revisar</span>
                    </div>
                    <div className={`step ${step >= 3 ? 'active' : ''}`}>
                        <div className="step-number">3</div>
                        <span>Aplicar</span>
                    </div>
                </div>

                <div className="modal-body">
                    {/* STEP 1: Configurar */}
                    {step === 1 && (
                        <div className="step-content">
                            <h3 className="section-title">Método de Actualización</h3>
                            
                            <div className="method-selector">
                                <button
                                    className={`method-card ${importMode === 'percentage' ? 'active' : ''}`}
                                    onClick={() => setImportMode('percentage')}
                                >
                                    <div className="method-icon">%</div>
                                    <h4>Por Porcentaje</h4>
                                    <p>Aumentar/disminuir % en toda una categoría</p>
                                </button>
                                
                                <button
                                    className={`method-card ${importMode === 'csv' ? 'active' : ''}`}
                                    onClick={() => setImportMode('csv')}
                                >
                                    <div className="method-icon">📄</div>
                                    <h4>Desde CSV/Excel</h4>
                                    <p>Importar lista de precios del proveedor</p>
                                </button>
                                
                                <button
                                    className={`method-card ${importMode === 'manual' ? 'active' : ''}`}
                                    onClick={() => setImportMode('manual')}
                                >
                                    <div className="method-icon">✏️</div>
                                    <h4>Manual</h4>
                                    <p>Editar precios uno por uno</p>
                                </button>
                            </div>

                            {/* Porcentaje / Manual Mode with Checkboxes */}
                            {(importMode === 'percentage' || importMode === 'manual') && (
                                <div className="config-section">
                                    {importMode === 'percentage' && (
                                        <div className="form-group mb-4">
                                            <label className="form-label">
                                                Porcentaje de {percentageIncrease > 0 ? 'Aumento' : 'Descuento'}
                                            </label>
                                            <div className="percentage-input">
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={percentageIncrease}
                                                    onChange={(e) => setPercentageIncrease(parseFloat(e.target.value) || 0)}
                                                    min="-100"
                                                    max="1000"
                                                    step="0.1"
                                                />
                                                <span className="percentage-symbol">%</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="selection-area">
                                        <h4 className="text-body font-bold mb-3">Seleccionar Productos ({selectedProductIds.size})</h4>
                                        <div className="filters-row flex gap-2 mb-3">
                                            <div className="search-box flex-1 relative">
                                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                                <input
                                                    type="text"
                                                    className="form-input pl-9"
                                                    placeholder="Buscar flor o artículo..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <select
                                                className="form-input w-auto min-w-[200px]"
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat} value={cat}>
                                                        {cat === 'all' ? 'Todas las categorías' : cat}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <div className="product-list-container border border-border rounded-lg overflow-hidden">
                                            <div className="list-header bg-surface-hover p-3 flex items-center justify-between border-b border-border">
                                                <label className="flex items-center gap-2 cursor-pointer font-medium text-small">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={visibleProducts.length > 0 && selectedProductIds.size === visibleProducts.length}
                                                        onChange={handleToggleAll}
                                                        className="checkbox-custom"
                                                    />
                                                    Seleccionar todos los filtrados
                                                </label>
                                                <span className="text-small text-muted">
                                                    {visibleProducts.length} resultados
                                                </span>
                                            </div>
                                            <div className="list-body max-h-[250px] overflow-y-auto p-2">
                                                {visibleProducts.length === 0 ? (
                                                    <p className="text-center text-muted py-4 text-small">No se encontraron productos.</p>
                                                ) : (
                                                    visibleProducts.map(p => (
                                                        <label key={p.id} className="list-item flex items-center justify-between p-2 hover:bg-surface-hover rounded cursor-pointer transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={selectedProductIds.has(p.id)}
                                                                    onChange={() => handleToggleProduct(p.id)}
                                                                    className="checkbox-custom"
                                                                />
                                                                <div>
                                                                    <p className="text-body font-medium leading-none">{p.name}</p>
                                                                    <span className="text-micro text-muted font-mono">{p.code}</span>
                                                                </div>
                                                            </div>
                                                            <span className="text-small font-bold text-primary">${p.price.toLocaleString()}</span>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CSV Mode */}
                            {importMode === 'csv' && (
                                <div className="config-section">
                                    <div className="csv-upload">
                                        <button 
                                            className="btn btn-secondary"
                                            onClick={downloadTemplate}
                                        >
                                            <Download size={18} />
                                            Descargar Plantilla
                                        </button>
                                        
                                        <div className="upload-area">
                                            <input
                                                type="file"
                                                accept=".csv,.xlsx,.xls"
                                                onChange={handleFileUpload}
                                                id="csv-upload"
                                                disabled={isLoading}
                                            />
                                            <label htmlFor="csv-upload" className="upload-label">
                                                {isLoading ? (
                                                    <div className="spinner-small" />
                                                ) : (
                                                    <Upload size={32} />
                                                )}
                                                <p>{isLoading ? 'Procesando archivo...' : 'Arrastrá tu archivo CSV o Excel'}</p>
                                                <p className="text-muted text-small">o hacé click para seleccionar</p>
                                            </label>
                                        </div>
                                        
                                        {csvData.length > 0 && (
                                            <div className="upload-success">
                                                <Check size={20} className="text-success" />
                                                <span>{csvData.length} filas cargadas</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}



                            <div className="step-actions">
                                <button className="btn btn-secondary" onClick={onClose}>
                                    Cancelar
                                </button>
                                <button 
                                    className="btn btn-primary"
                                    onClick={() => setStep(2)}
                                    disabled={
                                        (importMode === 'percentage' && (selectedProductIds.size === 0 || percentageIncrease === 0)) ||
                                        (importMode === 'manual' && selectedProductIds.size === 0) ||
                                        (importMode === 'csv' && csvData.length === 0)
                                    }
                                >
                                    Continuar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Revisar */}
                    {step === 2 && (
                        <div className="step-content">
                            <h3 className="section-title">
                                Vista Previa de Cambios ({previewChanges.length} productos)
                            </h3>

                            <div className="changes-preview">
                                <div className="preview-header">
                                    <span>Producto</span>
                                    <span>Precio Anterior</span>
                                    <span>Precio Nuevo</span>
                                    <span>Cambio</span>
                                </div>
                                
                                <div className="preview-list">
                                    {previewChanges.slice(0, 10).map((change, idx) => (
                                        <div key={idx} className="preview-item">
                                            <span className="product-name">{change.productName}</span>
                                            <span className="old-price">${change.oldPrice.toLocaleString()}</span>
                                            <span className="new-price">${change.newPrice.toLocaleString()}</span>
                                            <span className={`change ${change.change > 0 ? 'positive' : 'negative'}`}>
                                                {change.change > 0 ? '+' : ''}${change.change.toLocaleString()} ({change.changePercent > 0 ? '+' : ''}{change.changePercent}%)
                                            </span>
                                        </div>
                                    ))}
                                    
                                    {previewChanges.length > 10 && (
                                        <p className="text-muted text-center mt-4">
                                            ... y {previewChanges.length - 10} productos más
                                        </p>
                                    )}
                                </div>
                            </div>

                            {previewChanges.length === 0 && (
                                <div className="empty-state">
                                    <AlertCircle size={48} className="text-muted opacity-20" />
                                    <p>No hay cambios para mostrar</p>
                                </div>
                            )}

                            <div className="step-actions">
                                <button className="btn btn-secondary" onClick={() => setStep(1)}>
                                    Volver
                                </button>
                                <button 
                                    className="btn btn-success"
                                    onClick={() => setStep(3)}
                                    disabled={previewChanges.length === 0}
                                >
                                    Confirmar Cambios
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Aplicar */}
                    {step === 3 && (
                        <div className="step-content text-center">
                            <div className="confirmation-icon">
                                <Check size={64} />
                            </div>
                            
                            <h3 className="text-h3 mb-4">¿Estás seguro de aplicar estos cambios?</h3>
                            
                            <div className="summary-box">
                                <div className="summary-row">
                                    <span>Productos a actualizar:</span>
                                    <strong>{previewChanges.length}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Categoría:</span>
                                    <strong>{selectedCategory === 'all' ? 'Todas' : selectedCategory}</strong>
                                </div>
                                {importMode === 'percentage' && (
                                    <div className="summary-row">
                                        <span>Porcentaje:</span>
                                        <strong>{percentageIncrease > 0 ? '+' : ''}{percentageIncrease}%</strong>
                                    </div>
                                )}
                            </div>

                            <div className="step-actions">
                                <button className="btn btn-secondary" onClick={() => setStep(2)}>
                                    Volver
                                </button>
                                <button className="btn btn-success" onClick={applyChanges}>
                                    <Check size={18} />
                                    Sí, Aplicar Cambios
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

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Upload, Download, X, Check, Search, TrendingUp, Percent, FileText, Edit3 } from 'lucide-react';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
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
    basePrice?: number; // Cost price if margin mode
}

export const BulkPriceUpdateModal = ({ isOpen, onClose }: BulkPriceUpdateModalProps) => {
    const products = useStore(state => state.products);
    // Removed unused updateProduct for TS compliance

    const [isLoading, setIsLoading] = useState(false);
    const { alertModal, showAlert } = useModal();

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [percentageIncrease, setPercentageIncrease] = useState<number>(0);
    const [profitMargin, setProfitMargin] = useState<number>(30); // Default 30% margin
    const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
    const [previewChanges, setPreviewChanges] = useState<PriceChange[]>([]);
    const [csvData, setCsvData] = useState<any[]>([]);
    const [importMode, setImportMode] = useState<'percentage' | 'margin' | 'csv' | 'manual'>('percentage');

    // New states for selection and search
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

    // Categorías disponibles
    const categories = useMemo(() => ['all', ...Array.from(new Set(products.map(p => p.category)))], [products]);

    // Productos filtrados por categoría y búsqueda
    const visibleProducts = useMemo(() => products.filter(p => {
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.code || '').toLowerCase().includes(searchTerm.toLowerCase());
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
        } else if (importMode === 'margin') {
            products.forEach(product => {
                if (!selectedProductIds.has(product.id)) return;
                const basePrice = product.cost || 0;
                if (basePrice <= 0) return; // Skip products without cost
                const oldPrice = product.price;
                const newPrice = basePrice * (1 + profitMargin / 100);
                changes.push({
                    productId: product.id,
                    productName: product.name,
                    oldPrice,
                    newPrice: Math.round(newPrice),
                    change: Math.round(newPrice - oldPrice),
                    changePercent: Math.round(((newPrice - oldPrice) / oldPrice) * 100),
                    basePrice
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
    }, [products, percentageIncrease, profitMargin, customPrices, csvData, importMode, selectedProductIds]);

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
            const mappedData = result.data.map((item: any) => ({
                codigo: item.code,
                nombre: item.name,
                precio: item.price
            }));
            setCsvData(mappedData);
        } catch (error: any) {
            console.error('[BULK-UPDATE] Error reading file:', error);
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

    // Aplicar cambios usando el endpoint bulk
    const applyChanges = async () => {
        setIsLoading(true);
        try {
            if (previewChanges.length === 0) {
                showAlert({
                    title: 'Sin cambios',
                    message: 'No hay cambios para aplicar.',
                    variant: 'warning'
                });
                setIsLoading(false);
                return;
            }

            // Determinar el modo y valor para el backend
            let mode: 'percentage' | 'margin' | 'fixed';
            let value: number;

            if (importMode === 'percentage') {
                mode = 'percentage';
                value = percentageIncrease;
            } else if (importMode === 'margin') {
                mode = 'margin';
                value = profitMargin;
            } else {
                // Para manual y CSV, usamos fixed con el primer cambio
                mode = 'fixed';
                value = 0; // No se usa realmente para manual
            }

            // Si es manual o CSV, aplicamos individualmente porque cada precio es diferente
            if (importMode === 'manual' || importMode === 'csv') {
                let count = 0;
                for (const change of previewChanges) {
                    await api.updateProduct(change.productId, {
                        price: change.newPrice
                    } as any);
                    count++;
                }

                showAlert({
                    title: 'Precios actualizados',
                    message: `Se actualizaron ${count} productos exitosamente`,
                    variant: 'success'
                });
            } else {
                // Para percentage y margin, usamos el endpoint bulk
                const productIds = previewChanges.map(c => c.productId);

                const result = await api.bulkPricesUpdate({
                    productIds,
                    mode,
                    value,
                    roundTo: 'nearest'
                });

                // Recargar productos desde el store
                await useStore.getState().loadProducts();

                showAlert({
                    title: 'Precios actualizados',
                    message: `Se actualizaron ${result.updated} productos exitosamente`,
                    variant: 'success'
                });
            }

            setStep(1);
            setPercentageIncrease(0);
            setProfitMargin(30);
            setCustomPrices({});
            setCsvData([]);
            setSelectedProductIds(new Set());
            onClose();
        } catch (error: any) {
            console.error('[BULK-UPDATE] Error:', error);
            showAlert({
                title: 'Error al actualizar',
                message: error.message || 'Ocurrió un error al aplicar los cambios. Revisá la consola para más detalles.',
                variant: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="text-h2 flex items-center gap-2">
                        <TrendingUp size={24} className="text-primary" />
                        Actualización Masiva
                    </h2>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

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
                    {step === 1 && (
                        <div className="step-content">
                            <h3 className="section-title">Método de Actualización</h3>

                            <div className="method-selector">
                                <button
                                    className={`method-card ${importMode === 'percentage' ? 'active' : ''}`}
                                    onClick={() => setImportMode('percentage')}
                                >
                                    <div className="method-icon"><Percent size={20} /></div>
                                    <h4>Aumento %</h4>
                                    <p>Sobre el precio de venta actual</p>
                                </button>

                                <button
                                    className={`method-card ${importMode === 'margin' ? 'active' : ''}`}
                                    onClick={() => setImportMode('margin')}
                                >
                                    <div className="method-icon"><TrendingUp size={20} /></div>
                                    <h4>Margen de Ganancia</h4>
                                    <p>Margen % sobre el precio de costo</p>
                                </button>

                                <button
                                    className={`method-card ${importMode === 'csv' ? 'active' : ''}`}
                                    onClick={() => setImportMode('csv')}
                                >
                                    <div className="method-icon"><FileText size={20} /></div>
                                    <h4>Importar Excel</h4>
                                    <p>Desde lista del proveedor</p>
                                </button>

                                <button
                                    className={`method-card ${importMode === 'manual' ? 'active' : ''}`}
                                    onClick={() => setImportMode('manual')}
                                >
                                    <div className="method-icon"><Edit3 size={20} /></div>
                                    <h4>Manual</h4>
                                    <p>Editar uno por uno</p>
                                </button>
                            </div>

                            <div className="config-section card bg-surface p-4 mt-6">
                                {importMode === 'percentage' && (
                                    <div className="form-group mb-6">
                                        <label className="form-label">Porcentaje de Aumento/Descuento</label>
                                        <div className="percentage-input-wrapper">
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={percentageIncrease}
                                                onChange={(e) => setPercentageIncrease(parseFloat(e.target.value) || 0)}
                                            />
                                            <span className="percentage-symbol">%</span>
                                        </div>
                                    </div>
                                )}

                                {importMode === 'margin' && (
                                    <div className="form-group mb-6">
                                        <label className="form-label">Deseo ganar un...</label>
                                        <div className="percentage-input-wrapper">
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={profitMargin}
                                                onChange={(e) => setProfitMargin(parseFloat(e.target.value) || 0)}
                                            />
                                            <span className="percentage-symbol">%</span>
                                        </div>
                                        <p className="text-micro text-muted mt-2">
                                            * Se aplicará sobre el <strong>Precio de Costo</strong> de cada producto.
                                        </p>
                                    </div>
                                )}

                                {(importMode === 'percentage' || importMode === 'margin' || importMode === 'manual') && (
                                    <div className="selection-area">
                                        <h4 className="flex justify-between items-center mb-4">
                                            <span>Seleccionar Productos</span>
                                            <span className="badge">{selectedProductIds.size} seleccionados</span>
                                        </h4>
                                        <div className="filters-row flex gap-2 mb-4">
                                            <div className="search-box-pill flex-1">
                                                <Search size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar por nombre o código..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <select
                                                className="form-input w-auto min-w-[180px]"
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat} value={cat}>
                                                        {cat === 'all' ? 'Todas las carpetas' : cat}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="product-selection-list">
                                            <div className="list-header">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={visibleProducts.length > 0 && selectedProductIds.size === visibleProducts.length}
                                                        onChange={handleToggleAll}
                                                        id="select-all"
                                                    />
                                                    <label htmlFor="select-all">Seleccionar {visibleProducts.length} filtrados</label>
                                                </div>
                                            </div>
                                            <div className="list-body">
                                                {visibleProducts.map(p => (
                                                    <div key={p.id} className="list-row" onClick={() => handleToggleProduct(p.id)}>
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedProductIds.has(p.id)}
                                                                readOnly
                                                            />
                                                            <div>
                                                                <p className="font-bold m-0">{p.name}</p>
                                                                <span className="text-micro text-muted">{p.code} • Costo: ${p.cost?.toLocaleString() || '0'}</span>
                                                            </div>
                                                        </div>
                                                        <span className="font-bold text-primary">${p.price.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {importMode === 'csv' && (
                                    <div className="csv-upload-section">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="m-0">Importar Archivo</h4>
                                            <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
                                                <Download size={14} className="mr-1" /> Plantilla
                                            </button>
                                        </div>
                                        <div className="upload-dropzone">
                                            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
                                            <Upload size={32} className="mb-2 text-muted" />
                                            <p className="m-0">Subí tu Excel o CSV aquí</p>
                                        </div>
                                        {csvData.length > 0 && (
                                            <div className="alert alert-success mt-4">
                                                <Check size={18} /> Se cargaron {csvData.length} productos
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer mt-8">
                                <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setStep(2)}
                                    disabled={selectedProductIds.size === 0 && importMode !== 'csv'}
                                >
                                    Continuar a Revisión
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="step-content">
                            <h3 className="section-title">Revisar Cambios ({previewChanges.length})</h3>
                            <div className="preview-table-wrapper card">
                                <table className="preview-table">
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th className="text-right">Precio Actual</th>
                                            <th className="text-right">Precio Nuevo</th>
                                            <th className="text-right">Variación</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewChanges.slice(0, 100).map((change, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <p className="font-bold m-0">{change.productName}</p>
                                                    {change.basePrice && <span className="text-micro text-muted">Costo base: ${change.basePrice}</span>}
                                                </td>
                                                <td className="text-right text-muted">${change.oldPrice.toLocaleString()}</td>
                                                <td className="text-right font-bold text-primary">${change.newPrice.toLocaleString()}</td>
                                                <td className="text-right">
                                                    <span className={`badge ${change.change >= 0 ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
                                                        {change.change >= 0 ? '+' : ''}{change.changePercent}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {previewChanges.length > 100 && (
                                    <p className="text-muted text-center p-4">... y {previewChanges.length - 100} más</p>
                                )}
                            </div>

                            <div className="modal-footer mt-8">
                                <button className="btn btn-secondary" onClick={() => setStep(1)}>Volver</button>
                                <button className="btn btn-primary" onClick={() => setStep(3)}>Confirmar</button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="step-content text-center py-8">
                            <div className="confirmation-circle bg-primary-light text-primary mx-auto mb-6">
                                <TrendingUp size={48} />
                            </div>
                            <h2 className="text-h2 mb-2">¿Confirmar Actualización?</h2>
                            <p className="text-body text-muted mb-8">
                                Se actualizarán <strong>{previewChanges.length}</strong> productos de forma permanente.
                            </p>

                            <div className="summary-card bg-surface-hover p-4 rounded-xl mb-8">
                                <div className="summary-row flex justify-between mb-2">
                                    <span>Método:</span>
                                    <span className="font-bold">
                                        {importMode === 'percentage' ? 'Aumento %' :
                                            importMode === 'margin' ? 'Margen de Ganancia' :
                                                importMode === 'csv' ? 'Excel/CSV' : 'Manual'}
                                    </span>
                                </div>
                                <div className="summary-row flex justify-between">
                                    <span>Productos:</span>
                                    <span className="font-bold">{previewChanges.length}</span>
                                </div>
                            </div>

                            <div className="flex gap-4 justify-center">
                                <button className="btn btn-secondary" onClick={() => setStep(2)}>Revisar de nuevo</button>
                                <button className="btn btn-primary btn-lg" onClick={applyChanges} disabled={isLoading}>
                                    {isLoading ? 'Aplicando...' : 'Sí, Actualizar Precios'}
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

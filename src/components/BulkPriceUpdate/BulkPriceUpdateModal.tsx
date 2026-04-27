import { useState, useCallback, useEffect, useMemo } from 'react';
import {
    Upload, Download, X, Check, Search, TrendingUp, Percent,
    FileText, Edit3, DollarSign, AlertCircle, RefreshCw
} from 'lucide-react';
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
    basePrice?: number;
}

export const BulkPriceUpdateModal = ({ isOpen, onClose }: BulkPriceUpdateModalProps) => {
    const products = useStore(state => state.products);
    const [isLoading, setIsLoading] = useState(false);
    const { alertModal, showAlert } = useModal();

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [importMode, setImportMode] = useState<'percentage' | 'margin' | 'csv' | 'manual'>('percentage');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedBrand, setSelectedBrand] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [percentageIncrease, setPercentageIncrease] = useState<number>(10);
    const [profitMargin, setProfitMargin] = useState<number>(30);
    const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
    const [previewChanges, setPreviewChanges] = useState<PriceChange[]>([]);
    const [csvData, setCsvData] = useState<any[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);

    const categories = useMemo(() =>
        ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))],
        [products]
    );

    const brands = useMemo(() =>
        ['all', ...Array.from(new Set(products.map(p => p.brand_name).filter(Boolean)))],
        [products]
    );

    const visibleProducts = useMemo(() =>
        products.filter(p => {
            const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
            const matchesBrand = selectedBrand === 'all' || p.brand_name === selectedBrand;
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.code || '').toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesBrand && matchesSearch;
        }),
        [products, selectedCategory, selectedBrand, searchTerm]
    );

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
                if (basePrice <= 0) return;
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

    useEffect(() => {
        calculateChanges();
    }, [calculateChanges]);

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
            showAlert({
                title: 'Error al leer archivo',
                message: error.message || 'No se pudo procesar el archivo.',
                variant: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) {
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
                showAlert({
                    title: 'Error',
                    message: 'No se pudo procesar el archivo.',
                    variant: 'error'
                });
            } finally {
                setIsLoading(false);
            }
        }
    }, []);

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

            let mode: 'percentage' | 'margin' | 'fixed';
            let value: number;

            if (importMode === 'percentage') {
                mode = 'percentage';
                value = percentageIncrease;
            } else if (importMode === 'margin') {
                mode = 'margin';
                value = profitMargin;
            } else {
                mode = 'fixed';
                value = 0;
            }

            if (importMode === 'manual' || importMode === 'csv') {
                let count = 0;
                for (const change of previewChanges) {
                    await api.updateProduct(change.productId, { price: change.newPrice } as any);
                    count++;
                }
                showAlert({
                    title: 'Precios actualizados',
                    message: `Se actualizaron ${count} productos exitosamente`,
                    variant: 'success'
                });
            } else {
                const productIds = previewChanges.map(c => c.productId);
                const result = await api.bulkPricesUpdate({
                    productIds,
                    mode,
                    value,
                    roundTo: 'nearest'
                });
                await useStore.getState().loadProducts();
                showAlert({
                    title: 'Precios actualizados',
                    message: `Se actualizaron ${result.updated} productos`,
                    variant: 'success'
                });
            }

            setStep(1);
            setPercentageIncrease(10);
            setProfitMargin(30);
            setCustomPrices({});
            setCsvData([]);
            setSelectedProductIds(new Set());
            onClose();
        } catch (error: any) {
            showAlert({
                title: 'Error al actualizar',
                message: error.message || 'Ocurrió un error al aplicar los cambios.',
                variant: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const selectedCount = importMode === 'csv' ? csvData.length : selectedProductIds.size;

    if (!isOpen) return null;

    return (
        <div className="bulk-modal-overlay" onClick={onClose}>
            <div className="bulk-modal-container" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bulk-modal-header">
                    <div className="bulk-header-content">
                        <div className="bulk-header-icon">
                            <TrendingUp size={28} />
                        </div>
                        <div className="bulk-header-text">
                            <h2>Actualización Masiva de Precios</h2>
                            <p>Actualiza los precios de múltiples productos a la vez</p>
                        </div>
                    </div>
                    <button className="bulk-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Stepper */}
                <div className="bulk-stepper">
                    <div className={`bulk-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                        <div className="bulk-step-number">
                            {step > 1 ? <Check size={14} strokeWidth={3} /> : '1'}
                        </div>
                        <span className="bulk-step-label">Configurar</span>
                    </div>
                    <div className={`bulk-step-line ${step > 1 ? 'completed' : ''}`} />
                    <div className={`bulk-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                        <div className="bulk-step-number">
                            {step > 2 ? <Check size={14} strokeWidth={3} /> : '2'}
                        </div>
                        <span className="bulk-step-label">Revisar</span>
                    </div>
                    <div className={`bulk-step-line ${step > 2 ? 'completed' : ''}`} />
                    <div className={`bulk-step ${step >= 3 ? 'active' : ''}`}>
                        <div className="bulk-step-number">3</div>
                        <span className="bulk-step-label">Aplicar</span>
                    </div>
                </div>

                {/* Body */}
                <div className="bulk-modal-body">
                    {alertModal && <AlertModal {...alertModal} />}

                    {/* Step 1: Configure */}
                    {step === 1 && (
                        <div className="bulk-step-content">
                            {/* Method Selector */}
                            <div className="bulk-methods-grid">
                                <button
                                    className={`bulk-method-card ${importMode === 'percentage' ? 'active' : ''}`}
                                    onClick={() => setImportMode('percentage')}
                                >
                                    <div className={`bulk-method-icon ${importMode === 'percentage' ? 'active' : ''}`}>
                                        <Percent size={24} />
                                    </div>
                                    <h4>Aumento %</h4>
                                    <p>Sobre precio de venta</p>
                                </button>

                                <button
                                    className={`bulk-method-card ${importMode === 'margin' ? 'active' : ''}`}
                                    onClick={() => setImportMode('margin')}
                                >
                                    <div className={`bulk-method-icon ${importMode === 'margin' ? 'active' : ''}`}>
                                        <TrendingUp size={24} />
                                    </div>
                                    <h4>Margen Ganancia</h4>
                                    <p>Sobre precio de costo</p>
                                </button>

                                <button
                                    className={`bulk-method-card ${importMode === 'csv' ? 'active' : ''}`}
                                    onClick={() => setImportMode('csv')}
                                >
                                    <div className={`bulk-method-icon ${importMode === 'csv' ? 'active' : ''}`}>
                                        <FileText size={24} />
                                    </div>
                                    <h4>Importar Excel</h4>
                                    <p>Desde archivo CSV</p>
                                </button>

                                <button
                                    className={`bulk-method-card ${importMode === 'manual' ? 'active' : ''}`}
                                    onClick={() => setImportMode('manual')}
                                >
                                    <div className={`bulk-method-icon ${importMode === 'manual' ? 'active' : ''}`}>
                                        <Edit3 size={24} />
                                    </div>
                                    <h4>Manual</h4>
                                    <p>Uno por uno</p>
                                </button>
                            </div>

                            {/* Configuration Section */}
                            <div className="bulk-config-section">
                                {/* Percentage Mode */}
                                {importMode === 'percentage' && (
                                    <div className="bulk-config-block">
                                        <label className="bulk-config-label">
                                            Porcentaje de aumento o descuento
                                        </label>
                                        <div className="bulk-percentage-input">
                                            <input
                                                type="number"
                                                value={percentageIncrease}
                                                onChange={(e) => setPercentageIncrease(parseFloat(e.target.value) || 0)}
                                                placeholder="10"
                                            />
                                            <span className="bulk-percent-symbol">%</span>
                                        </div>
                                        <p className="bulk-config-hint">
                                            Ej: 10 aumenta 10%, -10 reduce 10%
                                        </p>
                                    </div>
                                )}

                                {/* Margin Mode */}
                                {importMode === 'margin' && (
                                    <div className="bulk-config-block">
                                        <label className="bulk-config-label">
                                            Margen de ganancia deseado
                                        </label>
                                        <div className="bulk-percentage-input">
                                            <input
                                                type="number"
                                                value={profitMargin}
                                                onChange={(e) => setProfitMargin(parseFloat(e.target.value) || 0)}
                                                placeholder="30"
                                            />
                                            <span className="bulk-percent-symbol">%</span>
                                        </div>
                                        <p className="bulk-config-hint">
                                            Se aplicará sobre el <strong>precio de costo</strong> de cada producto
                                        </p>
                                    </div>
                                )}

                                {/* Product Selection (for percentage, margin, manual) */}
                                {(importMode === 'percentage' || importMode === 'margin' || importMode === 'manual') && (
                                    <div className="bulk-products-section">
                                        <div className="bulk-products-header">
                                            <h3>Seleccionar Productos</h3>
                                            <span className="bulk-selection-count">
                                                {selectedProductIds.size} seleccionados
                                            </span>
                                        </div>

                                        {/* Filters */}
                                        <div className="bulk-filters-row">
                                            <div className="bulk-search-box">
                                                <Search size={16} className="bulk-search-icon" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar por nombre o código..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <select
                                                    className="bulk-category-select"
                                                    value={selectedCategory}
                                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                                >
                                                    {categories.map(cat => (
                                                        <option key={cat} value={cat}>
                                                            {cat === 'all' ? 'Todas las categorías' : cat}
                                                        </option>
                                                    ))}
                                                </select>
                                                <select
                                                    className="bulk-category-select"
                                                    value={selectedBrand}
                                                    onChange={(e) => setSelectedBrand(e.target.value)}
                                                >
                                                    {brands.map(brand => (
                                                        <option key={brand} value={brand}>
                                                            {brand === 'all' ? 'Todas las marcas' : brand}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Product List */}
                                        <div className="bulk-product-list">
                                            <div className="bulk-list-header">
                                                <button onClick={handleToggleAll} className="bulk-select-all-btn">
                                                    {visibleProducts.length > 0 && selectedProductIds.size === visibleProducts.length ? (
                                                        <Check size={16} strokeWidth={3} />
                                                    ) : (
                                                        <div className="bulk-checkbox" />
                                                    )}
                                                </button>
                                                <span>Seleccionar todos ({visibleProducts.length})</span>
                                            </div>
                                            <div className="bulk-list-body">
                                                {visibleProducts.map(p => (
                                                    <div
                                                        key={p.id}
                                                        className={`bulk-list-row ${selectedProductIds.has(p.id) ? 'selected' : ''}`}
                                                        onClick={() => handleToggleProduct(p.id)}
                                                    >
                                                        <div className="bulk-row-checkbox">
                                                            {selectedProductIds.has(p.id) ? (
                                                                <Check size={16} strokeWidth={3} className="bulk-checkbox-checked" />
                                                            ) : (
                                                                <div className="bulk-checkbox" />
                                                            )}
                                                        </div>
                                                        <div className="bulk-row-content">
                                                            <div className="bulk-row-main">
                                                                <span className="bulk-row-name">{p.name}</span>
                                                                <span className="bulk-row-code">{p.code}</span>
                                                            </div>
                                                            <div className="bulk-row-prices">
                                                                <span className="bulk-row-cost">Costo: ${p.cost?.toLocaleString() || '-'}</span>
                                                                <span className="bulk-row-price">${p.price.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Manual Mode: Custom Prices */}
                                        {importMode === 'manual' && selectedProductIds.size > 0 && (
                                            <div className="bulk-manual-prices">
                                                <h4 className="bulk-manual-title">
                                                    <DollarSign size={16} />
                                                    Definir precios para seleccionados
                                                </h4>
                                                <div className="bulk-manual-list">
                                                    {products
                                                        .filter(p => selectedProductIds.has(p.id))
                                                        .map(p => (
                                                            <div key={p.id} className="bulk-manual-row">
                                                                <span className="bulk-manual-name">{p.name}</span>
                                                                <div className="bulk-manual-input-wrapper">
                                                                    <DollarSign size={14} className="bulk-manual-icon" />
                                                                    <input
                                                                        type="number"
                                                                        className="bulk-manual-input"
                                                                        value={customPrices[p.id] || ''}
                                                                        onChange={(e) => setCustomPrices(prev => ({
                                                                            ...prev,
                                                                            [p.id]: parseFloat(e.target.value) || 0
                                                                        }))}
                                                                        placeholder="Nuevo precio"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* CSV Mode */}
                                {importMode === 'csv' && (
                                    <div className="bulk-csv-section">
                                        <div
                                            className={`bulk-dropzone ${isDragOver ? 'drag-over' : ''} ${csvData.length > 0 ? 'has-file' : ''}`}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                        >
                                            <input
                                                type="file"
                                                accept=".csv,.xlsx,.xls"
                                                onChange={handleFileUpload}
                                                className="bulk-file-input"
                                            />
                                            <div className="bulk-dropzone-content">
                                                {csvData.length > 0 ? (
                                                    <>
                                                        <FileText size={48} className="bulk-file-icon" />
                                                        <h3>Archivo cargado</h3>
                                                        <p className="bulk-file-count">{csvData.length} productos encontrados</p>
                                                        <p className="bulk-file-hint">Hacé clic para cambiar</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="bulk-upload-icon-wrapper">
                                                            <Upload size={40} />
                                                        </div>
                                                        <h3>Arrastrá tu archivo aquí</h3>
                                                        <p>o hacé clic para seleccionar</p>
                                                        <div className="bulk-formats">
                                                            <span className="bulk-format-badge">CSV</span>
                                                            <span className="bulk-format-badge">XLSX</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <button className="bulk-template-btn" onClick={downloadTemplate}>
                                            <Download size={16} />
                                            <span>Descargar plantilla de ejemplo</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Review */}
                    {step === 2 && (
                        <div className="bulk-step-content">
                            <div className="bulk-review-header">
                                <h3>Revisar Cambios</h3>
                                <span className="bulk-review-count">{previewChanges.length} productos</span>
                            </div>

                            <div className="bulk-preview-table-wrapper">
                                <table className="bulk-preview-table">
                                    <thead>
                                        <tr>
                                            <th>PRODUCTO</th>
                                            <th className="bulk-col-right">PRECIO ACTUAL</th>
                                            <th className="bulk-col-right">PRECIO NUEVO</th>
                                            <th className="bulk-col-right">VARIACIÓN</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewChanges.slice(0, 100).map((change, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <span className="bulk-product-name">{change.productName}</span>
                                                    {change.basePrice && (
                                                        <span className="bulk-cost-base">Costo: ${change.basePrice}</span>
                                                    )}
                                                </td>
                                                <td className="bulk-col-right bulk-old-price">${change.oldPrice.toLocaleString()}</td>
                                                <td className="bulk-col-right bulk-new-price">${change.newPrice.toLocaleString()}</td>
                                                <td className="bulk-col-right">
                                                    <span className={`bulk-change-badge ${change.change >= 0 ? 'positive' : 'negative'}`}>
                                                        {change.change >= 0 ? '+' : ''}{change.changePercent}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {previewChanges.length > 100 && (
                                    <div className="bulk-more-rows">
                                        ... y {previewChanges.length - 100} más
                                    </div>
                                )}
                                {previewChanges.length === 0 && (
                                    <div className="bulk-empty-review">
                                        <AlertCircle size={48} className="bulk-empty-icon" />
                                        <p className="bulk-empty-title">No hay cambios para mostrar</p>
                                        <p className="bulk-empty-subtitle">Verificá la configuración del paso anterior</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirm */}
                    {step === 3 && (
                        <div className="bulk-step-content">
                            <div className="bulk-confirm-content">
                                <div className="bulk-confirm-icon-wrapper">
                                    <TrendingUp size={64} />
                                </div>
                                <h2 className="bulk-confirm-title">¿Confirmar Actualización?</h2>
                                <p className="bulk-confirm-subtitle">
                                    Se actualizarán <strong>{previewChanges.length}</strong> productos de forma permanente
                                </p>

                                <div className="bulk-confirm-summary">
                                    <div className="bulk-summary-row">
                                        <span className="bulk-summary-label">Método:</span>
                                        <span className="bulk-summary-value">
                                            {importMode === 'percentage' ? 'Aumento %' :
                                                importMode === 'margin' ? 'Margen de Ganancia' :
                                                    importMode === 'csv' ? 'Excel/CSV' : 'Manual'}
                                        </span>
                                    </div>
                                    <div className="bulk-summary-row">
                                        <span className="bulk-summary-label">Productos:</span>
                                        <span className="bulk-summary-value">{previewChanges.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bulk-modal-footer">
                    {step === 1 && (
                        <>
                            <button className="bulk-btn bulk-btn-cancel" onClick={onClose}>
                                Cancelar
                            </button>
                            <button
                                className="bulk-btn bulk-btn-primary"
                                onClick={() => setStep(2)}
                                disabled={selectedCount === 0}
                            >
                                <span>Continuar a Revisión</span>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <button className="bulk-btn bulk-btn-cancel" onClick={() => setStep(1)}>
                                Volver
                            </button>
                            <button
                                className="bulk-btn bulk-btn-primary"
                                onClick={() => setStep(3)}
                                disabled={previewChanges.length === 0}
                            >
                                Confirmar
                            </button>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <button className="bulk-btn bulk-btn-cancel" onClick={() => setStep(2)}>
                                Revisar de nuevo
                            </button>
                            <button
                                className="bulk-btn bulk-btn-primary bulk-btn-confirm"
                                onClick={applyChanges}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <RefreshCw size={18} className="bulk-spin" />
                                        <span>Aplicando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} strokeWidth={3} />
                                        <span>Sí, Actualizar Precios</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

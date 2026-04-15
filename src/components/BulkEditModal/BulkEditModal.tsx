import { useState } from 'react';
import { X, Check, Tag, Barcode, DollarSign, Building2, Folder, Trash2, AlertTriangle, Edit2 } from 'lucide-react';
import { useStore, type AppState } from '../../store/useStore';
import type { Product } from '../../store/slices/types';
import './BulkEditModal.css';

interface BulkEditModalProps {
    selectedProducts: Product[];
    isOpen: boolean;
    onClose: () => void;
    onDelete?: (ids: string[]) => Promise<void>;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({ selectedProducts, isOpen, onClose, onDelete }) => {
    const categoriesData = useStore((state: AppState) => state.categoriesData);
    const brands = useStore((state: AppState) => state.brands);
    const updateProduct = useStore((state: AppState) => state.updateProduct);
    const loadProducts = useStore((state: AppState) => state.loadProducts);

    const [activeTab, setActiveTab] = useState<'edit' | 'delete'>('edit');
    const [fields, setFields] = useState({
        barcode: { enabled: false, value: '', autoGenerate: false },
        category_id: { enabled: false, value: '' },
        brand_id: { enabled: false, value: '' },
        price: { enabled: false, value: '', operation: 'set' as 'set' | 'add' | 'subtract' },
        cost: { enabled: false, value: '', operation: 'set' as 'set' | 'add' | 'subtract' },
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedCount, setProcessedCount] = useState(0);

    const updateField = (field: string, updates: any) => {
        setFields(prev => ({
            ...prev,
            [field]: { ...prev[field as keyof typeof prev], ...updates }
        }));
    };

    const handleApply = async () => {
        const enabledFields = Object.entries(fields).filter(([, v]) => v.enabled);
        if (enabledFields.length === 0) return;

        setIsProcessing(true);
        setProcessedCount(0);

        const now = Date.now().toString().slice(-8); // Use last 8 digits of timestamp as seed
        let index = 0;

        for (const product of selectedProducts) {
            const updates: any = {};

            for (const [field, value] of enabledFields) {
                if (!value.enabled) continue;

                switch (field) {
                    case 'barcode': {
                        const barcodeValue = value as { value: string; autoGenerate: boolean };
                        if (barcodeValue.autoGenerate) {
                            // Generate unique barcode: Seed + index + random
                            const uniquePart = (index++).toString().padStart(3, '0');
                            const randomPart = Math.floor(Math.random() * 10).toString();
                            updates.barcode = `${now}${uniquePart}${randomPart}`; // 12 digits
                        } else {
                            updates.barcode = barcodeValue.value;
                        }
                        break;
                    }
                    case 'category_id':
                        updates.category_id = value.value;
                        break;
                    case 'brand_id':
                        updates.brand_id = value.value;
                        break;
                    case 'price': {
                        const priceVal = parseFloat(value.value);
                        const priceOp = ('operation' in value) ? (value as any).operation : 'set';
                        if (priceOp === 'set') {
                            updates.price = priceVal;
                        } else if (priceOp === 'add') {
                            updates.price = product.price + priceVal;
                        } else {
                            updates.price = Math.max(0, product.price - priceVal);
                        }
                        break;
                    }
                    case 'cost': {
                        const costVal = parseFloat(value.value);
                        const costOp = ('operation' in value) ? (value as any).operation : 'set';
                        if (costOp === 'set') {
                            updates.cost = costVal;
                        } else if (costOp === 'add') {
                            updates.cost = (product.cost || 0) + costVal;
                        } else {
                            updates.cost = Math.max(0, (product.cost || 0) - costVal);
                        }
                        break;
                    }
                }
            }

            try {
                await updateProduct(product.id, updates);
            } catch (err) {
                console.error(`Error updating product ${product.id}:`, err);
            }
            setProcessedCount(prev => prev + 1);
        }

        await loadProducts();
        setIsProcessing(false);
        onClose();
    };

    const handleDelete = async () => {
        if (!onDelete) return;
        setIsProcessing(true);
        setProcessedCount(0);

        const batchSize = 50;
        const ids = selectedProducts.map(p => p.id);

        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            await onDelete(batch);
            setProcessedCount(Math.min(i + batchSize, ids.length));
        }

        setIsProcessing(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="bulk-modal-overlay" onClick={onClose}>
            <div className="bulk-modal-content" onClick={e => e.stopPropagation()}>
                <div className="bulk-modal-header">
                    <div className="bulk-modal-title">
                        <Tag size={22} />
                        <div>
                            <h2>Acciones Masivas</h2>
                            <p>{selectedProducts.length} productos seleccionados</p>
                        </div>
                    </div>
                    <button className="bulk-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="bulk-tabs">
                    <button
                        className={`bulk-tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
                        onClick={() => setActiveTab('edit')}
                    >
                        <Edit2 size={16} />
                        Editar campos
                    </button>
                    <button
                        className={`bulk-tab-btn ${activeTab === 'delete' ? 'active danger' : ''}`}
                        onClick={() => setActiveTab('delete')}
                    >
                        <Trash2 size={16} />
                        Eliminar
                    </button>
                </div>

                <div className="bulk-modal-body">
                    {isProcessing ? (
                        <div className="bulk-processing">
                            <div className="processing-spinner"></div>
                            <p>Procesando {processedCount} de {selectedProducts.length} productos...</p>
                        </div>
                    ) : activeTab === 'delete' ? (
                        <div className="bulk-delete-section">
                            <div className="bulk-delete-warning">
                                <AlertTriangle size={24} className="bulk-delete-warning-icon" />
                                <div>
                                    <p className="bulk-delete-warning-title">¡Atención! Estás por eliminar productos</p>
                                    <p className="bulk-delete-warning-text">
                                        Vas a eliminar <strong>{selectedProducts.length} producto{selectedProducts.length !== 1 ? 's' : ''}</strong>. Esta acción no se puede deshacer.
                                    </p>
                                </div>
                            </div>
                            <div className="bulk-delete-list">
                                <h4>Productos a eliminar:</h4>
                                <ul>
                                    {selectedProducts.slice(0, 20).map(p => (
                                        <li key={p.id}>
                                            <Trash2 size={14} className="delete-item-icon" />
                                            <span className="delete-item-name">{p.name}</span>
                                            <span className="delete-item-code">{p.code}</span>
                                        </li>
                                    ))}
                                    {selectedProducts.length > 20 && (
                                        <li className="delete-more-indicator">
                                            ... y {selectedProducts.length - 20} más
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="bulk-fields-list">
                                {/* Barcode Field */}
                                <div className={`bulk-field ${fields.barcode.enabled ? 'enabled' : ''}`}>
                                    <div className="bulk-field-header">
                                        <input
                                            type="checkbox"
                                            checked={fields.barcode.enabled}
                                            onChange={e => updateField('barcode', { enabled: e.target.checked })}
                                            id="bulk-barcode"
                                        />
                                        <label htmlFor="bulk-barcode">
                                            <Barcode size={16} />
                                            Código de Barras
                                        </label>
                                    </div>
                                    {fields.barcode.enabled && (
                                        <div className="bulk-barcode-input-group">
                                            <input
                                                type="text"
                                                className="bulk-input"
                                                placeholder={fields.barcode.autoGenerate ? "Se generará automáticamente..." : "Nuevo código de barras..."}
                                                value={fields.barcode.value}
                                                onChange={e => updateField('barcode', { value: e.target.value })}
                                                disabled={fields.barcode.autoGenerate}
                                            />
                                            <label className="bulk-auto-gen-label">
                                                <input 
                                                    type="checkbox" 
                                                    checked={fields.barcode.autoGenerate}
                                                    onChange={e => updateField('barcode', { autoGenerate: e.target.checked })}
                                                />
                                                Generar automáticamente
                                            </label>
                                        </div>
                                    )}
                                </div>

                                 {/* Category Field */}
                                <div className={`bulk-field ${fields.category_id.enabled ? 'enabled' : ''}`}>
                                    <div className="bulk-field-header">
                                        <input
                                            type="checkbox"
                                            checked={fields.category_id.enabled}
                                            onChange={e => updateField('category_id', { enabled: e.target.checked })}
                                            id="bulk-category"
                                        />
                                        <label htmlFor="bulk-category">
                                            <Folder size={16} />
                                            Categoría
                                        </label>
                                    </div>
                                    {fields.category_id.enabled && (
                                        <select
                                            className="bulk-select"
                                            value={fields.category_id.value}
                                            onChange={e => updateField('category_id', { value: e.target.value })}
                                        >
                                            <option value="">Seleccionar categoría...</option>
                                            {categoriesData?.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Brand Field */}
                                <div className={`bulk-field ${fields.brand_id.enabled ? 'enabled' : ''}`}>
                                    <div className="bulk-field-header">
                                        <input
                                            type="checkbox"
                                            checked={fields.brand_id.enabled}
                                            onChange={e => updateField('brand_id', { enabled: e.target.checked })}
                                            id="bulk-brand"
                                        />
                                        <label htmlFor="bulk-brand">
                                            <Building2 size={16} />
                                            Marca
                                        </label>
                                    </div>
                                    {fields.brand_id.enabled && (
                                        <select
                                            className="bulk-select"
                                            value={fields.brand_id.value}
                                            onChange={e => updateField('brand_id', { value: e.target.value })}
                                        >
                                            <option value="">Sin marca</option>
                                            {brands?.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Price Field */}
                                <div className={`bulk-field ${fields.price.enabled ? 'enabled' : ''}`}>
                                    <div className="bulk-field-header">
                                        <input
                                            type="checkbox"
                                            checked={fields.price.enabled}
                                            onChange={e => updateField('price', { enabled: e.target.checked })}
                                            id="bulk-price"
                                        />
                                        <label htmlFor="bulk-price">
                                            <DollarSign size={16} />
                                            Precio de Venta
                                        </label>
                                    </div>
                                    {fields.price.enabled && (
                                        <div className="bulk-price-row">
                                            <select
                                                className="bulk-select small"
                                                value={fields.price.operation}
                                                onChange={e => updateField('price', { operation: e.target.value })}
                                            >
                                                <option value="set">Establecer en</option>
                                                <option value="add">Sumar</option>
                                                <option value="subtract">Restar</option>
                                            </select>
                                            <input
                                                type="number"
                                                className="bulk-input"
                                                placeholder="0"
                                                value={fields.price.value}
                                                onChange={e => updateField('price', { value: e.target.value })}
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Cost Field */}
                                <div className={`bulk-field ${fields.cost.enabled ? 'enabled' : ''}`}>
                                    <div className="bulk-field-header">
                                        <input
                                            type="checkbox"
                                            checked={fields.cost.enabled}
                                            onChange={e => updateField('cost', { enabled: e.target.checked })}
                                            id="bulk-cost"
                                        />
                                        <label htmlFor="bulk-cost">
                                            <DollarSign size={16} />
                                            Costo
                                        </label>
                                    </div>
                                    {fields.cost.enabled && (
                                        <div className="bulk-price-row">
                                            <select
                                                className="bulk-select small"
                                                value={fields.cost.operation}
                                                onChange={e => updateField('cost', { operation: e.target.value })}
                                            >
                                                <option value="set">Establecer en</option>
                                                <option value="add">Sumar</option>
                                                <option value="subtract">Restar</option>
                                            </select>
                                            <input
                                                type="number"
                                                className="bulk-input"
                                                placeholder="0"
                                                value={fields.cost.value}
                                                onChange={e => updateField('cost', { value: e.target.value })}
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="bulk-modal-footer">
                    <button className="btn-bulk-cancel" onClick={onClose} disabled={isProcessing}>
                        Cancelar
                    </button>
                    {activeTab === 'delete' ? (
                        <button
                            className="btn-bulk-delete"
                            onClick={handleDelete}
                            disabled={isProcessing || !onDelete}
                        >
                            <Trash2 size={16} />
                            {isProcessing ? `Eliminando...` : `Eliminar ${selectedProducts.length} producto${selectedProducts.length !== 1 ? 's' : ''}`}
                        </button>
                    ) : (
                        <button
                            className="btn-bulk-apply"
                            onClick={handleApply}
                            disabled={isProcessing || !Object.values(fields).some(f => f.enabled)}
                        >
                            <Check size={16} />
                            {isProcessing ? `Procesando...` : `Aplicar a ${selectedProducts.length} producto${selectedProducts.length !== 1 ? 's' : ''}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

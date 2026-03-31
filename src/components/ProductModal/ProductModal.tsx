import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, TrendingUp } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Product } from '../../store/useStore';
import { generateIdWithPrefix, generateProductCode } from '../../utils/idGenerator';
import { validatePrice, validateQuantity, clamp } from '../../utils/format';
import './ProductModal.css';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    productToEdit?: Product | null;
    initialCategory?: string;
}

export const ProductModal: React.FC<ProductModalProps> = ({
    isOpen,
    onClose,
    productToEdit,
    initialCategory
}) => {
    const addProduct = useStore((state) => state.addProduct);
    const updateProduct = useStore((state) => state.updateProduct);
    const categories = useStore((state) => state.categories);
    const loadProducts = useStore((state) => state.loadProducts);
    const suppliers = useStore((state) => state.suppliers);
    const loadSuppliers = useStore((state) => state.loadSuppliers);

    const [formData, setFormData] = useState<Partial<Product>>({
        code: '',
        name: '',
        category: initialCategory || '',
        price: 0,
        cost: 0,
        stock: 0,
        min: 5,
        supplierId: '',
        tags: []
    });

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadSuppliers();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        if (productToEdit) {
            setFormData(productToEdit);
        } else {
            setFormData({
                code: '',
                name: '',
                category: initialCategory || (categories && categories.length > 0 ? categories[0] : (formData.category || 'General')),
                price: 0,
                cost: 0,
                stock: 0,
                min: 5,
                supplierId: '',
                tags: []
            });
        }
    }, [isOpen, productToEdit, initialCategory]);

    if (!isOpen) return null;

    // Calculate margin percentage
    const calculateMargin = () => {
        const cost = formData.cost || 0;
        const price = formData.price || 0;
        if (cost === 0 || price === 0) return 0;
        return ((price - cost) / cost) * 100;
    };

    const margin = calculateMargin();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validaciones con mensajes en lenguaje natural para Alejandra
        const errors: string[] = [];

        if (!formData.name || formData.name.trim().length < 2) {
            errors.push('El nombre debe tener al menos 2 letras (ej: "Ramo Rosas")');
        }

        if (!formData.category) {
            errors.push('Seleccioná una categoría (ej: Ramos, Flores, Macetas)');
        }

        const validatedPrice = validatePrice(formData.price || 0, 0);
        if (validatedPrice === null || formData.price === 0) {
            errors.push('El precio debe ser un número (ej: 1500 para $1500)');
        }

        const validatedCost = validatePrice(formData.cost || 0, 0);
        if (validatedCost === null) {
            errors.push('El costo debe ser un número (ej: 7500 para $7500)');
        }

        const validatedStock = validateQuantity(formData.stock || 0, 0);
        if (validatedStock === null) {
            errors.push('El stock debe ser un número entero (ej: 10 para 10 unidades)');
        }

        const validatedMin = validateQuantity(formData.min || 5, 1, 1000);
        if (validatedMin === null) {
            errors.push('La alerta de stock debe ser entre 1 y 1000 (ej: 5 para alerta cuando queden 5)');
        }

        if (errors.length > 0) {
            setError(errors.join('. '));
            return;
        }

        if (productToEdit) {
            await updateProduct(productToEdit.id, {
                ...formData,
                price: validatedPrice!,
                cost: validatedCost!,
                stock: validatedStock!,
                min: validatedMin!
            });
        } else {
            const newProduct: Product = {
                id: generateIdWithPrefix('p'),
                code: formData.code || generateProductCode(),
                name: formData.name!,
                category: formData.category!,
                price: validatedPrice!,
                cost: validatedCost!,
                stock: validatedStock!,
                min: validatedMin!,
                tags: formData.tags || []
            };
            await addProduct(newProduct);
        }

        await loadProducts(); // Recargar desde backend
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content product-modal">
                <header className="modal-header">
                    <h2 className="text-h2">{productToEdit ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={24} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="modal-body">
                    {error && (
                        <div className="alert alert-danger mb-4">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="form-group mb-4">
                        <label className="form-label">Nombre del Producto *</label>
                        <input
                            type="text"
                            className="form-input text-large"
                            placeholder="Ej: Ramo Rosas Rojas"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-2 gap-4 mb-4">
                        <div className="form-group">
                            <label className="form-label">Carpeta / Categoría *</label>
                            <select
                                className="form-input"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            >
                                {(categories || []).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Código (Opcional)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="E-123"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group mb-6">
                        <label className="form-label font-bold text-primary">Proveedor que lo suministra (Opcional)</label>
                        <select
                            className="form-input"
                            value={formData.supplierId || ''}
                            onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                        >
                            <option value="">-- Sin Proveedor Asignado --</option>
                            {(suppliers || []).map(sup => (
                                <option key={sup.id} value={sup.id}>{sup.name}</option>
                            ))}
                        </select>
                        <p className="text-micro text-muted mt-1">Esto ayuda a organizar la reposición de stock por proveedor.</p>
                    </div>

                    <div className="grid grid-2 gap-4 mb-6">
                        <div className="form-group">
                            <label className="form-label">Costo ($) *</label>
                            <input
                                type="number"
                                className="form-input text-h3"
                                value={formData.cost}
                                onChange={(e) => {
                                    const value = Math.max(0, parseFloat(e.target.value) || 0);
                                    setFormData({ ...formData, cost: value });
                                }}
                                placeholder="0"
                                min="0"
                                step="0.01"
                            />
                            <p className="text-micro text-muted mt-1">Precio que pagás al proveedor</p>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Precio de Venta ($) *</label>
                            <input
                                type="number"
                                className="form-input text-h3"
                                value={formData.price}
                                onChange={(e) => {
                                    const value = Math.max(0, parseFloat(e.target.value) || 0);
                                    setFormData({ ...formData, price: value });
                                }}
                                placeholder="0"
                                min="0"
                                step="0.01"
                            />
                            <p className="text-micro text-muted mt-1">Precio al público</p>
                        </div>
                    </div>

                    {/* Margin Display */}
                    {(formData.cost || 0) > 0 && (formData.price || 0) > 0 && (
                        <div className="margin-display mb-6 p-4 bg-surface rounded-lg border border-border">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp size={20} className={margin >= 50 ? 'text-success' : margin >= 30 ? 'text-warning' : 'text-danger'} />
                                    <div>
                                        <p className="text-small font-bold">Margen de Ganancia</p>
                                        <p className="text-micro text-muted">
                                            Ganancia: ${((formData.price || 0) - (formData.cost || 0)).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-h2 font-bold ${margin >= 50 ? 'text-success' : margin >= 30 ? 'text-warning' : 'text-danger'}`}>
                                        {margin.toFixed(1)}%
                                    </p>
                                    <p className="text-micro text-muted">
                                        {margin >= 50 ? 'Excelente' : margin >= 30 ? 'Bueno' : 'Bajo'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-2 gap-4 mb-6">
                        <div className="form-group">
                            <label className="form-label">Stock Inicial</label>
                            <input
                                type="number"
                                className="form-input text-h3"
                                value={formData.stock}
                                onChange={(e) => {
                                    const value = Math.max(0, parseInt(e.target.value) || 0);
                                    setFormData({ ...formData, stock: value });
                                }}
                                min="0"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Alerta Stock</label>
                            <input
                                type="number"
                                className="form-input text-h3"
                                value={formData.min}
                                onChange={(e) => {
                                    const value = clamp(parseInt(e.target.value) || 5, 1, 1000);
                                    setFormData({ ...formData, min: value });
                                }}
                                min="1"
                                max="1000"
                            />
                            <p className="text-micro text-muted mt-1">Recibir alerta cuando el stock sea ≤ a este valor</p>
                        </div>
                    </div>

                    <footer className="modal-footer pt-4 border-t">
                        <button type="button" className="btn btn-secondary w-full-mobile mr-2" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary w-full-mobile">
                            <Save size={18} className="mr-2" />
                            {productToEdit ? 'Guardar Cambios' : 'Crear Producto'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, TrendingUp, Plus, Check, Package, Truck, DollarSign, Edit2, Barcode } from 'lucide-react';
import { useStore, type AppState } from '../../store/useStore';
import type { Product, Category } from '../../store/slices/types';
import { generateIdWithPrefix, generateProductCode } from '../../utils/idGenerator';
import { validatePrice, validateQuantity, clamp } from '../../utils/format';
import './ProductModal.css';

import { CameraScanner } from '../CameraScanner/CameraScanner';

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
    const addProduct = useStore((state: AppState) => state.addProduct);
    const updateProduct = useStore((state: AppState) => state.updateProduct);
    const categoriesData = useStore((state: AppState) => state.categoriesData);
    const brands = useStore((state: AppState) => state.brands);
    const loadBrands = useStore((state: AppState) => state.loadBrands);
    const addBrand = useStore((state: AppState) => state.addBrand);
    const loadProducts = useStore((state: AppState) => state.loadProducts);
    const suppliers = useStore((state: AppState) => state.suppliers);
    const loadSuppliers = useStore((state: AppState) => state.loadSuppliers);

    const [formData, setFormData] = useState<any>({
        code: '',
        barcode: '',
        name: '',
        category: initialCategory || '',
        brand_id: '',
        price: 0,
        cost: 0,
        stock: 0,
        min: 5,
        supplierId: '',
        tags: []
    });

    const [isAddingBrand, setIsAddingBrand] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');

    const [error, setError] = useState<string | null>(null);
    const [isScanOpen, setIsScanOpen] = useState(false);

    const handleCameraScan = (scannedCode: string) => {
        setFormData((prev: any) => ({ ...prev, barcode: scannedCode }));
        setIsScanOpen(false);
    };

    useEffect(() => {
        if (isOpen) {
            loadSuppliers();
            loadBrands();
            if (productToEdit) {
                setFormData({
                    code: productToEdit.code || '',
                    barcode: productToEdit.barcode || '',
                    name: productToEdit.name || '',
                    category: productToEdit.category || (categoriesData && categoriesData.length > 0 ? categoriesData[0].name : 'General'),
                    brand_id: productToEdit.brand_id || '',
                    price: productToEdit.price || 0,
                    cost: productToEdit.cost || 0,
                    stock: productToEdit.stock || 0,
                    min: productToEdit.min || 5,
                    supplierId: productToEdit.supplierId || '',
                    tags: productToEdit.tags || []
                });
            } else {
                setFormData({
                    code: '',
                    barcode: '',
                    name: '',
                    category: initialCategory || (categoriesData && categoriesData.length > 0 ? categoriesData[0].name : (formData.category || 'General')),
                    brand_id: '',
                    price: 0,
                    cost: 0,
                    stock: 0,
                    min: 5,
                    supplierId: '',
                    tags: []
                });
            }
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

    const handleQuickAddBrand = async () => {
        if (!newBrandName.trim()) return;
        try {
            const brand = await addBrand(newBrandName.trim());
            if (brand) {
                setFormData((prev: any) => ({ ...prev, brand_id: brand.id }));
                setNewBrandName('');
                setIsAddingBrand(false);
            }
        } catch (error) {
            console.error('Error adding brand:', error);
        }
    };

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
                barcode: formData.barcode,
                name: formData.name!,
                category: formData.category!,
                brand_id: formData.brand_id,
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
                    <div className="modal-header-content">
                        <div className="modal-title-wrapper">
                            <div className="modal-icon">
                                {productToEdit ? <Edit2 size={24} /> : <Plus size={24} />}
                            </div>
                            <h2 className="text-h2">{productToEdit ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                        </div>
                        <p className="modal-subtitle">
                            {productToEdit ? 'Modificá los datos del producto' : 'Completá la información del nuevo producto'}
                        </p>
                    </div>
                    <button className="btn-icon modal-close" onClick={onClose}>
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

                    {/* Sección: Información Básica */}
                    <div className="form-section">
                        <div className="section-header">
                            <Package size={18} className="section-icon" />
                            <h3 className="section-title">Información Básica</h3>
                        </div>

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
                                    className="form-select"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    required
                                >
                                    {(categoriesData || []).map(cat => {
                                        // Recursive function to get full path
                                        const getPath = (c: Category, all: Category[]): string => {
                                            if (!c.parent_id) return c.name;
                                            const parent = all.find(p => p.id === c.parent_id);
                                            return parent ? `${getPath(parent, all)} > ${c.name}` : c.name;
                                        };
                                        return (
                                            <option key={cat.id} value={cat.name}>
                                                {getPath(cat, categoriesData)}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Marca</label>
                                <div className="flex gap-2">
                                    {!isAddingBrand ? (
                                        <>
                                            <select
                                                className="form-select flex-1"
                                                value={formData.brand_id}
                                                onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
                                            >
                                                <option value="">Sin Marca</option>
                                                {(brands || []).map(brand => (
                                                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setIsAddingBrand(true)}
                                                className="btn btn-secondary p-2"
                                                title="Nueva Marca"
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                className="form-input flex-1"
                                                placeholder="Nombre de marca"
                                                value={newBrandName}
                                                onChange={(e) => setNewBrandName(e.target.value)}
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={handleQuickAddBrand}
                                                className="btn btn-primary p-2"
                                            >
                                                <Check size={20} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsAddingBrand(false);
                                                    setNewBrandName('');
                                                }}
                                                className="btn btn-secondary p-2"
                                            >
                                                <X size={20} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-2 gap-4 mb-4">
                            <div className="form-group">
                                <label className="form-label">Código (Opcional)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="E-123"
                                    value={formData.code || ''}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Código de Barras</label>
                                <div className="input-with-action">
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Escaneá o escribí"
                                        value={formData.barcode || ''}
                                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="barcode-actions mb-4">
                            <button
                                type="button"
                                className="btn-action-secondary"
                                onClick={() => setFormData({ ...formData, barcode: formData.code || generateProductCode() })}
                            >
                                <Barcode size={16} />
                                Generar automático
                            </button>
                            <button
                                type="button"
                                className="btn-action-primary"
                                onClick={() => setIsScanOpen(true)}
                            >
                                <span className="material-symbols-rounded">photo_camera</span>
                                Escanear con cámara
                            </button>
                        </div>
                    </div>

                    {/* Sección: Proveedor */}
                    <div className="form-section">
                        <div className="section-header">
                            <Truck size={18} className="section-icon" />
                            <h3 className="section-title">Proveedor</h3>
                        </div>

                        <div className="form-group mb-4">
                            <label className="form-label">Proveedor que lo suministra (Opcional)</label>
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
                    </div>

                    {/* Sección: Precios */}
                    <div className="form-section">
                        <div className="section-header">
                            <DollarSign size={18} className="section-icon" />
                            <h3 className="section-title">Precios y Ganancias</h3>
                        </div>

                        <div className="grid grid-2 gap-4 mb-4">
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
                            <div className="margin-display mb-4">
                                <div className="margin-header">
                                    <div className="margin-icon-wrapper">
                                        <TrendingUp size={24} className={margin >= 50 ? 'text-success' : margin >= 30 ? 'text-warning' : 'text-danger'} />
                                    </div>
                                    <div className="margin-info">
                                        <p className="margin-label font-bold">Margen de Ganancia</p>
                                        <p className="margin-subtext">
                                            Ganancia: ${((formData.price || 0) - (formData.cost || 0)).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="margin-value">
                                        <p className={`margin-percentage ${margin >= 50 ? 'text-success' : margin >= 30 ? 'text-warning' : 'text-danger'}`}>
                                            {margin.toFixed(1)}%
                                        </p>
                                        <p className="margin-status">
                                            {margin >= 50 ? 'Excelente' : margin >= 30 ? 'Bueno' : 'Bajo'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sección: Stock */}
                    <div className="form-section">
                        <div className="section-header">
                            <Package size={18} className="section-icon" />
                            <h3 className="section-title">Stock e Inventario</h3>
                        </div>

                        <div className="grid grid-2 gap-4 mb-4">
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

                {isScanOpen && (
                    <CameraScanner
                        onScan={handleCameraScan}
                        onClose={() => setIsScanOpen(false)}
                    />
                )}
            </div>
        </div>
    );
};

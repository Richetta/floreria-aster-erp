import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Plus, Minus, Package as PackageIcon, Save, Folder } from 'lucide-react';
import { useStore } from '../../store/useStore';
// @ts-expect-error — Package/PackageItem types not exported from new store
import type { Package, PackageItem, Product } from '../../store/useStore';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../ui/Modals';
import './PackageBuilderModal.css';

interface PackageBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    packageToEdit?: Package;
}

export const PackageBuilderModal: React.FC<PackageBuilderModalProps> = ({
    isOpen,
    onClose,
    packageToEdit
}) => {
    const products = useStore((state) => state.products);
    const categories = useStore((state) => state.categories) || [];
    // @ts-expect-error — addPackage not yet in AppState slices
    const addPackage = useStore((state) => state.addPackage);
    // @ts-expect-error — updatePackage not yet in AppState slices
    const updatePackage = useStore((state) => state.updatePackage);
    // @ts-expect-error — loadPackages not yet in AppState slices
    const loadPackages = useStore((state) => state.loadPackages);

    const { alertModal, showAlert } = useModal();

    // Form State
    const [name, setName] = useState('');
    const [section, setSection] = useState('Combos');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState<number | ''>('');
    const [items, setItems] = useState<PackageItem[]>([]);

    // Inventory View State
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('General');

    // Initialize/Reset State
    useEffect(() => {
        if (isOpen) {
            if (packageToEdit) {
                setName(packageToEdit.name);
                setSection(packageToEdit.section);
                setDescription(packageToEdit.description || '');
                setPrice(packageToEdit.price);
                setItems([...(packageToEdit.items || [])]);
            } else {
                setName('');
                setSection(categories.length > 0 ? categories[0] : 'General');
                setDescription('');
                setPrice('');
                setItems([]);
            }
            setSearchTerm('');
        }
    }, [isOpen, packageToEdit, categories]);

    // Ensure activeCategory is valid
    useEffect(() => {
        if (categories && categories.length > 0 && !categories.includes(activeCategory)) {
            setActiveCategory(categories[0]);
        }
    }, [categories, activeCategory]);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        return products.filter(p => {
            const matchesCategory = p.category === activeCategory;
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [products, activeCategory, searchTerm]);

    const handleAddItem = (product: Product) => {
        setItems(prev => {
            const exists = prev.find(i => i.productId === product.id);
            if (exists) {
                return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { productId: product.id, quantity: 1 }];
        });
    };

    const handleRemoveItem = (productId: string) => {
        setItems(prev => prev.filter(i => i.productId !== productId));
    };

    const handleUpdateQuantity = (productId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            handleRemoveItem(productId);
            return;
        }
        setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: newQuantity } : i));
    };

    const calculateCost = () => {
        return items.reduce((total, item) => {
            const prod = products.find(p => p.id === item.productId);
            // Si el producto no tiene costo, asumimos el 50% de su precio de venta
            const estimatedCost = prod ? prod.price * 0.5 : 0;
            return total + (estimatedCost * item.quantity);
        }, 0);
    };

    const handleSave = async () => {
        if (!name.trim()) { showAlert({ title: 'Nombre requerido', message: 'El paquete necesita un nombre.', variant: 'warning' }); return; }
        if (items.length === 0) { showAlert({ title: 'Receta vacía', message: 'Debes agregar al menos 1 producto a la receta.', variant: 'warning' }); return; }
        if (price === '' || price < 0) { showAlert({ title: 'Precio requerido', message: 'Debes fijar un precio de venta.', variant: 'warning' }); return; }

        const basePackage = {
            name,
            description,
            price: Number(price),
            section,
            items,
            isActive: true
        };

        if (packageToEdit) {
            await updatePackage(packageToEdit.id, basePackage);
        } else {
            await addPackage({
                ...basePackage,
                id: generateIdWithPrefix('pkg')
            });
        }
        await loadPackages(); // Recargar desde backend
        onClose();
    };

    if (!isOpen) return null;

    const totalCost = calculateCost();

    return (
        <div className="builder-overlay">
            <div className="builder-container">
                <header className="builder-header">
                    <div>
                        <h2 className="text-h2 text-white">
                            {packageToEdit ? 'Editando Arreglo' : 'La Mesa de Armado'}
                        </h2>
                        <p className="text-small text-white opacity-80 mt-1">
                            Agrega productos de la lista (abajo) a la mesa (arriba)
                        </p>
                    </div>
                    <button className="btn-icon text-white hover:bg-white/10" onClick={onClose}>
                        <X size={24} />
                    </button>
                </header>

                <div className="builder-content">
                    {/* Left/Top Panel: The Recipe (La Mesa) */}
                    <div className="recipe-panel">
                        <div className="form-group mb-4">
                            <input 
                                type="text" 
                                className="form-input text-h3 builder-name-input" 
                                placeholder="Nombre del Arreglo (Ej: Ramo Primavera)..." 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="grid grid-2 gap-4 mb-6">
                            <div className="form-group">
                                <label className="form-label text-small">Clasificación</label>
                                <select 
                                    className="form-input"
                                    value={section}
                                    onChange={(e) => setSection(e.target.value)}
                                >
                                    <option value="Ramos Especiales">Ramos Especiales</option>
                                    <option value="Combos Promocionales">Combos Promocionales</option>
                                    <option value="Eventos">Eventos</option>
                                    {(categories || []).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label text-small">Descripción (Opcional)</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Breve detalle para el cliente..." 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>

                        <h3 className="text-large font-bold mb-3 flex items-center gap-2">
                            <PackageIcon className="text-primary" size={20} />
                            Ingredientes en la Mesa ({items.length})
                        </h3>

                        <div className="ingredients-list">
                            {items.length === 0 ? (
                                <div className="empty-ingredients">
                                    <p className="text-muted text-center py-6">Selecciona productos del inventario para armar este arreglo.</p>
                                </div>
                            ) : (
                                items.map(item => {
                                    const prod = products.find(p => p.id === item.productId);
                                    if (!prod) return null;
                                    return (
                                        <div key={item.productId} className="ingredient-row">
                                            <div className="ingredient-info">
                                                <h4 className="font-medium text-body">{prod.name}</h4>
                                                <p className="text-micro text-muted">Costo esti.: ${(prod.price * 0.5 * item.quantity).toLocaleString()}</p>
                                            </div>
                                            <div className="quantity-controls">
                                                <button onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}>
                                                    <Minus size={16} />
                                                </button>
                                                <span className="qty-value">{item.quantity}</span>
                                                <button onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}>
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right/Bottom Panel: Inventory View */}
                    <div className="inventory-panel">
                        <div className="inventory-header">
                            <h3 className="font-bold mb-3">Tu Inventario</h3>
                            <div className="search-pill-small">
                                <Search size={16} className="text-muted" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar flor, envoltorio..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <div className="builder-tabs mt-4">
                                {(categories || []).map(cat => (
                                    <button 
                                        key={cat}
                                        className={`builder-tab ${activeCategory === cat ? 'active' : ''}`}
                                        onClick={() => setActiveCategory(cat)}
                                    >
                                        <Folder size={14} className="mr-1" />
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="inventory-grid">
                            {filteredProducts.map(prod => (
                                <button 
                                    key={prod.id} 
                                    className="inventory-item-btn"
                                    onClick={() => handleAddItem(prod)}
                                >
                                    <span className="block font-medium text-left truncate">{prod.name}</span>
                                    <div className="flex justify-between items-center mt-2 opacity-70">
                                        <span className="text-micro">Stock: {prod.stock}</span>
                                        <span className="text-micro font-bold">+ Agregar</span>
                                    </div>
                                </button>
                            ))}
                            {filteredProducts.length === 0 && (
                                <div className="col-span-full text-center py-8 text-muted text-small">
                                    No hay productos en esta categoría.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Fixed Footer: Financials and Save */}
                <footer className="builder-footer">
                    <div className="financials">
                        <div className="cost-summary">
                            <span className="text-micro uppercase tracking-wider text-muted font-bold block">Costo estimado de los materiales</span>
                            <span className="text-xl font-bold">${totalCost.toLocaleString()}</span>
                        </div>
                        <div className="price-input-group">
                            <label className="text-micro uppercase tracking-wider text-primary font-bold block mb-1">Precio de Venta Público *</label>
                            <div className="input-with-symbol relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold">$</span>
                                <input 
                                    type="number" 
                                    className="form-input text-h3 pl-8 py-2 w-48 text-primary shadow-sm" 
                                    placeholder="15000"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="footer-actions">
                        <button className="btn btn-secondary px-6" onClick={onClose}>Cancelar</button>
                        <button className="btn btn-primary btn-lg px-8 shadow-primary" onClick={handleSave}>
                            <Save size={20} className="mr-2" />
                            {packageToEdit ? 'Actualizar Arreglo' : 'Guardar Arreglo'}
                        </button>
                    </div>
                </footer>
            </div>
            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};

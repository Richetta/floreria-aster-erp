import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Plus, Minus, Save, Folder } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Package, PackageItem, Product } from '../../store/useStore';
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
    const addPackage = useStore((state) => state.addPackage);
    const updatePackage = useStore((state) => state.updatePackage);
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
            await addPackage(basePackage);
        }
        await loadPackages(); // Recargar desde backend
        onClose();
    };

    if (!isOpen) return null;

    // Cost, markup and margin calculations in real time
    const totalCost = calculateCost();
    const markupMultiplier = totalCost > 0 ? (Number(price) || 0) / totalCost : 0;
    const profitMargin = (Number(price) || 0) > 0 ? ((Number(price) - totalCost) / Number(price)) * 100 : 0;

    // Pointer position on the slider (from 1.0x to 3.0x mapped to 0% to 100%)
    const pointerPos = Math.min(Math.max(((markupMultiplier - 1.0) / 2.0) * 100, 0), 100);

    // Creative Composition Assistant tips
    const compositionTip = (() => {
        const totalFlowers = items.reduce((sum, item) => sum + item.quantity, 0);
        if (totalFlowers === 0) return "¡Mesa de Armado despejada! Seleccioná flores del inventario para empezar tu composición.";
        
        const greenCount = items.reduce((sum, item) => {
            const prod = products.find(p => p.id === item.productId);
            if (!prod) return sum;
            const name = prod.name.toLowerCase();
            const cat = prod.category.toLowerCase();
            if (name.includes('verde') || name.includes('eucalipto') || name.includes('hoja') || name.includes('follaje') || cat.includes('verde') || cat.includes('follaje')) {
                return sum + item.quantity;
            }
            return sum;
        }, 0);
        
        const greenRatio = totalFlowers > 0 ? greenCount / totalFlowers : 0;
        
        if (greenRatio < 0.25) {
            return "💡 Consejo Creativo: Agregá un 25-30% de follaje (Eucalipto, Hojas) para darle volumen, estructura y contraste a tu Ramo.";
        }
        
        if (totalFlowers > 15) {
            return "💡 Consejo Creativo: Tenés una composición premium muy densa. Asegurá un envoltorio de kraft firme y cintas de lino de color tierra.";
        }
        
        return "💡 Balance Ideal: Tu mezcla de follaje y flores principales está en excelente armonía. ¡Se ve espectacular!";
    })();

    return (
        <div className="builder-overlay">
            <div className="builder-container">
                <header className="builder-header">
                    <div>
                        <h2 className="text-h2 text-white">
                            {packageToEdit ? 'Editando Arreglo' : 'La Mesa de Armado'}
                        </h2>
                        <p className="text-small text-white opacity-80 mt-1">
                            Agrega flores de tu inventario y mira crecer tu ramo en tiempo real
                        </p>
                    </div>
                    <button className="btn-icon text-white hover:bg-white/10" onClick={onClose}>
                        <X size={24} />
                    </button>
                </header>

                <div className="builder-content">
                    {/* Left/Top Panel: The Creative Cedar Wood Canvas (La Mesa) */}
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
                        <div className="grid grid-2 gap-4 mb-2">
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

                        {/* Cedar wood canvas workspace */}
                        <div className="worktable-canvas">
                            {/* Animated CSS Floral Bouquet Visualizer */}
                            <div className="canvas-visualizer">
                                <div className="bouquet-visualizer-container">
                                    <div className="v-stems">
                                        {items.map((item, idx) => {
                                            return Array.from({ length: Math.min(item.quantity, 4) }).map((_, bIdx) => (
                                                <div 
                                                    key={`stem-${idx}-${bIdx}`} 
                                                    className={`v-stem stem-rotate-${(idx * 3 + bIdx) % 7}`} 
                                                />
                                            ));
                                        })}
                                    </div>
                                    <div className="v-blooms">
                                        {items.map((item, idx) => {
                                            const prod = products.find(p => p.id === item.productId);
                                            const prodName = prod ? prod.name.toLowerCase() : '';
                                            let color = '#D9A09A'; // Default rose
                                            if (prodName.includes('rosa') || prodName.includes('red') || prodName.includes('rojo')) color = '#C85A53';
                                            else if (prodName.includes('amarill') || prodName.includes('gold') || prodName.includes('sol')) color = '#E9C46A';
                                            else if (prodName.includes('blan') || prodName.includes('whit') || prodName.includes('crem')) color = '#FAF6EE';
                                            else if (prodName.includes('azul') || prodName.includes('blue') || prodName.includes('violet')) color = '#5D8CAE';
                                            else if (prodName.includes('ment') || prodName.includes('verd') || prodName.includes('hoj') || prodName.includes('euca')) color = '#74A38A';
                                            
                                            const bloomCount = Math.min(item.quantity, 4);
                                            return Array.from({ length: bloomCount }).map((_, bIdx) => {
                                                const angle = (idx * 55 + bIdx * 25) % 360;
                                                const dist = 20 + (idx * 8 + bIdx * 4) % 30;
                                                const x = Math.cos((angle * Math.PI) / 180) * dist;
                                                const y = Math.sin((angle * Math.PI) / 180) * dist;
                                                const isLeaf = color === '#74A38A';
                                                return (
                                                    <div 
                                                        key={`bloom-${idx}-${bIdx}`} 
                                                        className={`v-bloom ${isLeaf ? 'v-leaf' : ''}`}
                                                        style={{
                                                            backgroundColor: color,
                                                            transform: `translate(${x}px, ${y}px) scale(${1 + (bIdx % 3) * 0.1})`,
                                                            boxShadow: `0 4px 10px ${color}55`,
                                                        }}
                                                    />
                                                );
                                            });
                                        })}
                                        {items.length === 0 && <div className="v-placeholder-bloom">🌿 LA MESA DE ARMADO 🌿</div>}
                                    </div>
                                    <div className="v-kraft-wrap"></div>
                                </div>
                            </div>

                            {/* Circular floating botanical chips laying on canvas */}
                            <div className="floating-botanical-chips">
                                {items.length === 0 ? (
                                    <p className="text-muted text-center w-full py-4 text-small font-semibold">
                                        Selecciona elementos en el panel derecho para comenzar a componer 🎨
                                    </p>
                                ) : (
                                    items.map(item => {
                                        const prod = products.find(p => p.id === item.productId);
                                        if (!prod) return null;
                                        
                                        const prodName = prod.name.toLowerCase();
                                        let color = '#D9A09A'; // Default rose
                                        if (prodName.includes('rosa') || prodName.includes('red') || prodName.includes('rojo')) color = '#C85A53';
                                        else if (prodName.includes('amarill') || prodName.includes('gold') || prodName.includes('sol')) color = '#E9C46A';
                                        else if (prodName.includes('blan') || prodName.includes('whit') || prodName.includes('crem')) color = '#FAF6EE';
                                        else if (prodName.includes('azul') || prodName.includes('blue') || prodName.includes('violet')) color = '#5D8CAE';
                                        else if (prodName.includes('ment') || prodName.includes('verd') || prodName.includes('hoj') || prodName.includes('euca')) color = '#74A38A';
                                        
                                        return (
                                            <div key={item.productId} className="botanical-chip">
                                                <span className="chip-indicator" style={{ backgroundColor: color }}></span>
                                                <div className="chip-details">
                                                    <span className="chip-name">{prod.name}</span>
                                                    <span className="chip-cost">${(prod.price * 0.5 * item.quantity).toLocaleString()}</span>
                                                </div>
                                                <div className="chip-actions">
                                                    <button className="qty-btn" onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}>
                                                        <Minus size={10} />
                                                    </button>
                                                    <span className="chip-qty">{item.quantity}</span>
                                                    <button className="qty-btn" onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}>
                                                        <Plus size={10} />
                                                    </button>
                                                    <button className="chip-delete" onClick={() => handleRemoveItem(item.productId)}>
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Dynamic Creative composition tip box */}
                        <div className="creative-tip-card">
                            {compositionTip}
                        </div>
                    </div>

                    {/* Right Panel: Inventory list */}
                    <div className="inventory-panel">
                        <div className="inventory-header">
                            <h3 className="font-bold text-h3 text-charcoal">Seleccionar Ingredientes</h3>
                            <div className="search-pill-small">
                                <Search size={16} className="text-muted" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar flor, follaje, envoltorios..." 
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
                                        <Folder size={14} className="mr-1" style={{ display: 'inline', verticalAlign: 'middle' }} />
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
                                        <span className="text-micro font-semibold text-muted">Stock: {prod.stock}</span>
                                        <span className="text-micro font-bold text-primary">+ Añadir</span>
                                    </div>
                                </button>
                            ))}
                            {filteredProducts.length === 0 && (
                                <div className="col-span-full text-center py-8 text-muted text-small">
                                    No hay elementos en esta categoría que coincidan.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Fixed Footer: Real-time price markup coach */}
                <footer className="builder-footer">
                    <div className="financials">
                        <div className="cost-summary">
                            <span className="text-micro">Costo Materiales</span>
                            <span className="text-xl font-bold">${totalCost.toLocaleString()}</span>
                        </div>

                        {/* Interactive Profitability / Markup Coach */}
                        <div className="markup-coach-container">
                            <div className="flex justify-between items-center">
                                <span className="text-micro uppercase font-bold text-muted">Multiplicador Rentabilidad</span>
                                {markupMultiplier === 0 ? (
                                    <span className="markup-status-badge markup-low">Fijar Precio</span>
                                ) : markupMultiplier < 1.5 ? (
                                    <span className="markup-status-badge markup-low">🔴 Baja ({markupMultiplier.toFixed(1)}x)</span>
                                ) : markupMultiplier <= 2.2 ? (
                                    <span className="markup-status-badge markup-good">🟡 Buena ({markupMultiplier.toFixed(1)}x)</span>
                                ) : (
                                    <span className="markup-status-badge markup-excellent">🟢 Excelente ({markupMultiplier.toFixed(1)}x)</span>
                                )}
                            </div>
                            
                            <div className="markup-coach-slider">
                                <div className="markup-coach-pointer" style={{ left: `${pointerPos}%` }} />
                            </div>

                            <div className="markup-status-label">
                                <span>1.0x Costo</span>
                                <span>{profitMargin > 0 ? `${profitMargin.toFixed(0)}% Margen Neto` : '0% Margen'}</span>
                                <span>3.0x+ Multipl.</span>
                            </div>
                        </div>

                        <div className="price-input-group">
                            <label className="text-micro block mb-1">Precio Público *</label>
                            <div className="input-with-symbol">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold">$</span>
                                <input 
                                    type="number" 
                                    className="form-input text-h3 pl-8 py-2 w-48" 
                                    placeholder="0"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="footer-actions">
                        <button className="btn btn-secondary px-6" onClick={onClose}>Cancelar</button>
                        <button className="btn btn-primary btn-lg px-8" onClick={handleSave}>
                            <Save size={20} className="mr-2" style={{ display: 'inline', verticalAlign: 'middle' }} />
                            {packageToEdit ? 'Actualizar Arreglo' : 'Guardar Arreglo'}
                        </button>
                    </div>
                </footer>
            </div>
            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};

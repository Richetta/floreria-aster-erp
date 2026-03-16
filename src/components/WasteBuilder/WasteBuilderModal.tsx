import React, { useState, useMemo } from 'react';
import { X, Search, Plus, Minus, Folder, CheckCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Product } from '../../store/useStore';
import './WasteBuilderModal.css';

interface WasteBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const WasteBuilderModal: React.FC<WasteBuilderModalProps> = ({
    isOpen,
    onClose
}) => {
    const products = useStore((state) => state.products);
    const categories = useStore((state) => state.categories) || [];
    const registerWaste = useStore((state) => state.registerWaste);
    const loadProducts = useStore((state) => state.loadProducts);

    // Form State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState<number>(1);
    const [reason, setReason] = useState('Deterioro natural');

    // UI View State
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('General');

    // Initialize/Reset
    React.useEffect(() => {
        if (isOpen) {
            setSelectedProduct(null);
            setQuantity(1);
            setReason('Deterioro natural');
            setSearchTerm('');
            setActiveCategory(categories.length > 0 ? categories[0] : 'General');
        }
    }, [isOpen, categories]);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        return products.filter(p => {
            const matchesCategory = p.category === activeCategory;
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesCategory && matchesSearch && p.stock > 0; // Solo mostrar si hay stock
        });
    }, [products, activeCategory, searchTerm]);

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setQuantity(1);
    };

    const handleSave = async () => {
        if (!selectedProduct) return alert('Debes seleccionar un producto.');
        if (quantity <= 0) return alert('La cantidad debe ser mayor a 0.');
        if (quantity > selectedProduct.stock) return alert(`No puedes dar de baja más de lo que hay en depósito (${selectedProduct.stock}).`);

        await registerWaste(selectedProduct.id, quantity, reason);
        await loadProducts(); // Recargar productos con stock actualizado
        onClose();
        // Optional: show a mini toast
    };

    if (!isOpen) return null;

    return (
        <div className="builder-overlay">
            <div className="builder-container" style={{ maxWidth: '900px', height: '80vh' }}>
                <header className="builder-header bg-danger">
                    <div>
                        <h2 className="text-h2 text-white">Reportar Producto Dañado</h2>
                        <p className="text-small text-white opacity-80 mt-1">
                            Selecciona en el inventario qué se rompió/venció y retiralo del stock.
                        </p>
                    </div>
                    <button className="btn-icon text-white hover:bg-white/10" onClick={onClose}>
                        <X size={24} />
                    </button>
                </header>

                <div className="builder-content">
                    {/* Left/Top Panel: The Form */}
                    <div className="recipe-panel">
                        <h3 className="text-large font-bold mb-4">Detalle de la Baja</h3>
                        
                        {selectedProduct ? (
                            <div className="selected-product-card bg-surface border border-danger p-4 rounded-xl mb-6 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-bold text-h3 text-danger">{selectedProduct.name}</h4>
                                        <p className="text-small text-muted">Stock actual: {selectedProduct.stock} unidades</p>
                                    </div>
                                    <button 
                                        className="text-muted hover:text-danger text-small underline"
                                        onClick={() => setSelectedProduct(null)}
                                    >
                                        Cambiar
                                    </button>
                                </div>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="form-label text-small">Cantidad a dar de baja</label>
                                        <div className="flex items-center gap-4 mt-1">
                                            <div className="quantity-controls border-danger" style={{ padding: '0.5rem' }}>
                                                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                                                    <Minus size={18} />
                                                </button>
                                                <span className="qty-value text-large mx-4">{quantity}</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setQuantity(Math.min(selectedProduct.stock, quantity + 1))}
                                                    disabled={quantity >= selectedProduct.stock}
                                                    className={quantity >= selectedProduct.stock ? 'opacity-50 cursor-not-allowed' : ''}
                                                >
                                                    <Plus size={18} />
                                                </button>
                                            </div>
                                            {quantity >= selectedProduct.stock && (
                                                <span className="text-micro text-danger font-bold uppercase">Tope de stock</span>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="form-label text-small">Motivo de la pérdida</label>
                                        <select 
                                            className="form-input border-border"
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                        >
                                            <option value="Deterioro natural">Deterioro natural (Marchitas)</option>
                                            <option value="Rotura de proveedor">Llegó roto del proveedor</option>
                                            <option value="Rotura en local">Rotura / Accidente en local</option>
                                            <option value="Vencimiento">Vencimiento de vida útil</option>
                                            <option value="Robo/Extravío">Robo o Extravío</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-ingredients border-dashed border-2 border-border/50 rounded-xl p-8 text-center bg-background flex flex-col items-center justify-center flex-1">
                                <Search size={48} className="text-muted opacity-20 mb-4" />
                                <h4 className="text-body font-bold text-muted mb-2">Ningún producto seleccionado</h4>
                                <p className="text-small text-muted">Usa el panel de la derecha para buscar el producto que sufrió la merma.</p>
                            </div>
                        )}
                        
                        <div className="mt-auto pt-6 border-t border-border">
                            <div className="bg-danger-light border border-danger-light p-4 rounded-lg mb-4 flex items-start gap-3">
                                <CheckCircle size={20} className="text-danger shrink-0 mt-0.5" />
                                <p className="text-micro text-danger font-bold">
                                    Al confirmar, estas unidades se restarán del inventario central inmediatamente y afectarán las métricas contables del mes.
                                </p>
                            </div>
                            <button 
                                className="btn btn-danger btn-lg w-full shadow-danger" 
                                disabled={!selectedProduct}
                                onClick={handleSave}
                            >
                                Confirmar Baja Permanente
                            </button>
                        </div>
                    </div>

                    {/* Right/Bottom Panel: Inventory View */}
                    <div className="inventory-panel">
                        <div className="inventory-header">
                            <h3 className="font-bold mb-3">Buscar en Depósito</h3>
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
                                    className={`inventory-item-btn ${selectedProduct?.id === prod.id ? 'border-danger ring-2 ring-danger ring-opacity-50' : ''}`}
                                    onClick={() => handleSelectProduct(prod)}
                                >
                                    <span className="block font-medium text-left truncate">{prod.name}</span>
                                    <div className="flex justify-between items-center mt-2 opacity-70">
                                        <span className="text-micro bg-surface px-2 py-0.5 rounded-full border border-border">Stock: {prod.stock}</span>
                                    </div>
                                </button>
                            ))}
                            {filteredProducts.length === 0 && (
                                <div className="col-span-full text-center py-8 text-muted text-small">
                                    No hay productos disponibles en esta categoría.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

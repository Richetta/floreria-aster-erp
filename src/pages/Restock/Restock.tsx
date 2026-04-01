import React, { useState, useEffect } from 'react';
import { PackageOpen, AlertTriangle, MessageCircle, CheckSquare, Square, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import './Restock.css';

interface RestockItem {
    id: string;
    code: string;
    name: string;
    stock: number;
    minStock: number;
    cost: number;
}

interface SupplierRestock {
    supplierId: string | null;
    supplierName: string;
    supplierPhone: string | null;
    items: RestockItem[];
}

const Restock: React.FC = () => {
    const suppliers = useStore(state => state.suppliers);
    const loadSuppliers = useStore(state => state.loadSuppliers);
    const addNotification = useStore(state => state.addNotification);

    const [loading, setLoading] = useState(true);
    const [restockData, setRestockData] = useState<SupplierRestock[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Bulk assignment state
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [targetSupplierId, setTargetSupplierId] = useState<string>('');
    const [isAssigning, setIsAssigning] = useState(false);

    const fetchRestock = async () => {
        try {
            setLoading(true);
            const data = await api.getRestockItems();
            setRestockData(data);
            setError(null);
        } catch (err: any) {
            setError('Error al obtener faltantes de stock');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRestock();
        if (suppliers.length === 0) {
            loadSuppliers();
        }
    }, []);

    const generateWhatsAppLink = (supplier: SupplierRestock) => {
        if (!supplier.supplierPhone) return '#';
        
        let message = `Hola ${supplier.supplierName}, necesito hacer el siguiente pedido de reposición:\n\n`;
        
        supplier.items.forEach(item => {
            const faltante = item.minStock > item.stock ? item.minStock - item.stock : 10;
            message += `- *${faltante}x* ${item.name} (Quedan ${item.stock})\n`;
        });
        
        message += `\nGracias!`;
        return `https://wa.me/${supplier.supplierPhone}?text=${encodeURIComponent(message)}`;
    };

    const handleToggleProduct = (productId: string) => {
        setSelectedProducts(prev => 
            prev.includes(productId) 
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    const handleToggleAllUnassigned = (unassignedItems: RestockItem[]) => {
        if (selectedProducts.length === unassignedItems.length) {
            setSelectedProducts([]); // Unselect all
        } else {
            setSelectedProducts(unassignedItems.map(item => item.id)); // Select all
        }
    };

    const handleBulkAssign = async () => {
        if (selectedProducts.length === 0) {
            addNotification('Selecciona al menos un producto', 'warning');
            return;
        }
        if (!targetSupplierId) {
            addNotification('Selecciona un proveedor de destino', 'warning');
            return;
        }

        try {
            setIsAssigning(true);
            await api.bulkAssignSupplier(selectedProducts, targetSupplierId);
            addNotification('Proveedor asignado correctamente', 'success');
            
            // Reset state and refetch
            setSelectedProducts([]);
            setTargetSupplierId('');
            await fetchRestock();
        } catch (err) {
            addNotification('Error al asignar proveedor', 'error');
            console.error(err);
        } finally {
            setIsAssigning(false);
        }
    };

    if (loading && restockData.length === 0) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const totalSuppliers = restockData.length;
    const totalItems = restockData.reduce((acc, curr) => acc + curr.items.length, 0);

    return (
        <div className="restock-page">
            <header className="page-header">
                <div>
                    <h1 className="text-h1">Reposición de Stock</h1>
                    <p className="text-body text-muted mt-2">
                        {totalItems} productos necesitan reposición ({totalSuppliers} grupos involucrados).
                    </p>
                </div>
            </header>

            {error && (
                <div className="bg-danger-light text-danger p-4 rounded-lg mb-6 flex items-center gap-2">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {!loading && restockData.length === 0 ? (
                <div className="empty-state">
                    <PackageOpen size={48} className="text-primary opacity-50 mb-4" />
                    <h2 className="text-h2">¡Todo en Orden!</h2>
                    <p className="text-body text-muted mt-2">
                        No hay productos con stock menor o igual a su stock mínimo.
                    </p>
                    <Link to="/" className="btn btn-primary mt-6">Volver al Dashboard</Link>
                </div>
            ) : (
                <div className="suppliers-grid">
                    {restockData.map((supplier) => {
                        const isUnassigned = !supplier.supplierId;

                        return (
                            <div key={supplier.supplierId || 'unassigned'} className={`supplier-restock-card ${isUnassigned ? 'unassigned' : ''}`}>
                                <div className="supplier-card-header">
                                    <div className="flex flex-col">
                                        <h3 className="text-h3 font-semibold flex items-center gap-2">
                                            {isUnassigned && <AlertTriangle size={20} className="text-warning-dark" />}
                                            {supplier.supplierName}
                                        </h3>
                                        <span className="text-small text-muted">{supplier.items.length} productos faltantes</span>
                                    </div>
                                    {!isUnassigned && (
                                        <div className="flex gap-2">
                                            <Link 
                                                to="/compras" 
                                                state={{ 
                                                    supplierId: supplier.supplierId, 
                                                    items: supplier.items.map(item => ({
                                                        productId: item.id,
                                                        productName: item.name,
                                                        quantity: item.minStock > item.stock ? item.minStock - item.stock : 10,
                                                        cost: item.cost
                                                    }))
                                                }}
                                                className="btn btn-primary btn-sm"
                                            >
                                                <PackageOpen size={16} />
                                                <span className="hidden sm:inline">Generar Compra</span>
                                            </Link>
                                            {supplier.supplierPhone && (
                                                <a 
                                                    href={generateWhatsAppLink(supplier)} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="btn btn-secondary whatsapp-btn btn-sm"
                                                >
                                                    <MessageCircle size={16} />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {isUnassigned && (
                                    <div className="bulk-assign-bar mt-4 mb-2 p-3 bg-white rounded-lg border border-gray-200 flex flex-wrap gap-3 items-center justify-between">
                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleToggleAllUnassigned(supplier.items)}>
                                            {selectedProducts.length === supplier.items.length ? (
                                                <CheckSquare size={20} className="text-primary" />
                                            ) : (
                                                <Square size={20} className="text-muted" />
                                            )}
                                            <span className="text-sm font-medium">Seleccionar todos</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 flex-1 max-w-sm">
                                            <select 
                                                className="form-input text-sm py-1.5"
                                                value={targetSupplierId}
                                                onChange={(e) => setTargetSupplierId(e.target.value)}
                                            >
                                                <option value="">Seleccionar proveedor...</option>
                                                {suppliers.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                            <button 
                                                className="btn btn-secondary btn-sm flex-shrink-0"
                                                onClick={handleBulkAssign}
                                                disabled={isAssigning || selectedProducts.length === 0 || !targetSupplierId}
                                            >
                                                <Truck size={16} />
                                                {isAssigning ? 'Asignando...' : 'Asignar'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="supplier-items-list mt-4">
                                    {supplier.items.map(item => {
                                        const isSelected = selectedProducts.includes(item.id);
                                        
                                        return (
                                            <div 
                                                key={item.id} 
                                                className={`restock-item ${isUnassigned ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
                                                onClick={() => isUnassigned && handleToggleProduct(item.id)}
                                            >
                                                {isUnassigned && (
                                                    <div className="item-checkbox mr-3">
                                                        {isSelected ? (
                                                            <CheckSquare size={18} className="text-primary" />
                                                        ) : (
                                                            <Square size={18} className="text-muted" />
                                                        )}
                                                    </div>
                                                )}
                                                <div className="item-info flex-1">
                                                    {item.code && <span className="item-code">{item.code}</span>}
                                                    <span className="item-name font-medium">{item.name}</span>
                                                </div>
                                                <div className="item-stock-info">
                                                    <div className="stock-pill critical">
                                                        Stock: {item.stock}
                                                    </div>
                                                    <div className="stock-pill minimal hidden sm:flex">
                                                        Mín: {item.minStock}
                                                    </div>
                                                    <div className="cost-info hidden md:block">
                                                        Costo: ${item.cost.toLocaleString('es-AR')}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Restock;

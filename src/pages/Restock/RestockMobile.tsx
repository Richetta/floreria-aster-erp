import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import './RestockMobile.css';

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

export const RestockMobile: React.FC = () => {
    const suppliers = useStore(state => state.suppliers);
    const loadSuppliers = useStore(state => state.loadSuppliers);
    const addNotification = useStore(state => state.addNotification);

    const [loading, setLoading] = useState(true);
    const [restockData, setRestockData] = useState<SupplierRestock[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

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
            setError('Error al obtener faltantes');
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
        let message = `Hola ${supplier.supplierName}, necesito hacer el siguiente pedido:\n\n`;
        supplier.items.forEach(item => {
            const faltante = item.minStock > item.stock ? item.minStock - item.stock : 10;
            message += `- *${faltante}x* ${item.name}\n`;
        });
        message += `\nGracias!`;
        return `https://wa.me/${supplier.supplierPhone}?text=${encodeURIComponent(message)}`;
    };

    const handleToggleProduct = (productId: string) => {
        setSelectedProducts(prev =>
            prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
        );
    };

    const handleBulkAssign = async () => {
        if (selectedProducts.length === 0) {
            addNotification('Selecciona al menos un producto', 'warning');
            return;
        }
        if (!targetSupplierId) {
            addNotification('Selecciona un proveedor', 'warning');
            return;
        }

        try {
            setIsAssigning(true);
            await api.bulkAssignSupplier(selectedProducts, targetSupplierId);
            addNotification('Proveedor asignado correctamente', 'success');
            setSelectedProducts([]);
            setTargetSupplierId('');
            await fetchRestock();
        } catch (err) {
            addNotification('Error al asignar proveedor', 'error');
        } finally {
            setIsAssigning(false);
        }
    };

    const toggleSupplier = (id: string) => {
        setExpandedSupplier(expandedSupplier === id ? null : id);
    };

    if (loading && restockData.length === 0) {
        return (
            <div className="restock-loading">
                <div className="spinner-restock"></div>
                <p>Cargando...</p>
            </div>
        );
    }

    const totalItems = restockData.reduce((acc, curr) => acc + curr.items.length, 0);

    return (
        <div className="restock-mobile-wrapper">
            <header className="restock-mobile-header">
                <div className="header-info">
                    <h2>Reposición</h2>
                    <span className="header-count">{totalItems} productos faltantes</span>
                </div>
            </header>

            {error && (
                <div className="restock-error">
                    <span className="material-symbols-rounded">error</span>
                    <span>{error}</span>
                </div>
            )}

            {!loading && restockData.length === 0 ? (
                <div className="restock-empty">
                    <span className="material-symbols-rounded">check_circle</span>
                    <h3>¡Todo en orden!</h3>
                    <p>No hay productos con stock bajo</p>
                    <Link to="/dashboard" className="btn-back-dashboard">
                        <span className="material-symbols-rounded">home</span>
                        Volver al Inicio
                    </Link>
                </div>
            ) : (
                <div className="restock-content">
                    {restockData.map((supplier) => {
                        const isUnassigned = !supplier.supplierId;
                        const supplierKey = supplier.supplierId || 'unassigned';
                        const isExpanded = expandedSupplier === supplierKey;

                        return (
                            <div key={supplierKey} className={`supplier-card-mobile ${isUnassigned ? 'unassigned' : ''}`}>
                                <div className="supplier-header" onClick={() => toggleSupplier(supplierKey)}>
                                    <div className="supplier-info">
                                        <span className="material-symbols-rounded">
                                            {isUnassigned ? 'warning' : 'local_shipping'}
                                        </span>
                                        <div>
                                            <h3>{supplier.supplierName}</h3>
                                            <span className="supplier-count">{supplier.items.length} productos</span>
                                        </div>
                                    </div>
                                    <span className={`material-symbols-rounded chevron ${isExpanded ? 'expanded' : ''}`}>
                                        expand_more
                                    </span>
                                </div>

                                {isExpanded && (
                                    <div className="supplier-items-list">
                                        {isUnassigned && selectedProducts.length > 0 && (
                                            <div className="bulk-assign-bar">
                                                <select
                                                    value={targetSupplierId}
                                                    onChange={(e) => setTargetSupplierId(e.target.value)}
                                                >
                                                    <option value="">Seleccionar proveedor...</option>
                                                    {suppliers.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    className="btn-assign"
                                                    onClick={handleBulkAssign}
                                                    disabled={isAssigning || selectedProducts.length === 0 || !targetSupplierId}
                                                >
                                                    {isAssigning ? 'Asignando...' : 'Asignar'}
                                                </button>
                                            </div>
                                        )}

                                        {supplier.items.map(item => {
                                            const isSelected = selectedProducts.includes(item.id);
                                            const faltante = item.minStock - item.stock;

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`restock-item-mobile ${isUnassigned ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => isUnassigned && handleToggleProduct(item.id)}
                                                >
                                                    {isUnassigned && (
                                                        <span className="material-symbols-rounded checkbox-icon">
                                                            {isSelected ? 'check_box' : 'check_box_outline_blank'}
                                                        </span>
                                                    )}
                                                    <div className="item-mobile-info">
                                                        {item.code && <span className="item-code-sm">{item.code}</span>}
                                                        <div className="item-name-sm">{item.name}</div>
                                                    </div>
                                                    <div className="item-stock-info">
                                                        <div className="stock-pill-critical">
                                                            {item.stock}
                                                        </div>
                                                        {faltante > 0 && (
                                                            <div className="stock-pill-missing">
                                                                -{faltante}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {!isUnassigned && (
                                            <div className="supplier-actions-bar">
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
                                                    className="btn-generate-purchase"
                                                >
                                                    <span className="material-symbols-rounded">shopping_cart</span>
                                                    Generar Compra
                                                </Link>
                                                {supplier.supplierPhone && (
                                                    <a
                                                        href={generateWhatsAppLink(supplier)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn-whatsapp-order"
                                                    >
                                                        <span className="material-symbols-rounded">chat</span>
                                                        WhatsApp
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

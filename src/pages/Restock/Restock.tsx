import React, { useState, useEffect } from 'react';
import { PackageOpen, AlertTriangle, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
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
    const [loading, setLoading] = useState(true);
    const [restockData, setRestockData] = useState<SupplierRestock[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
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

        fetchRestock();
    }, []);

    const generateWhatsAppLink = (supplier: SupplierRestock) => {
        if (!supplier.supplierPhone) return '#';
        
        let message = `Hola ${supplier.supplierName}, necesito hacer el siguiente pedido de reposición:\n\n`;
        
        supplier.items.forEach(item => {
            const faltante = item.minStock > item.stock ? item.minStock - item.stock : 10; // Default a pedir 10 si min_stock es 0
            message += `- *${faltante}x* ${item.name} (Quedan ${item.stock})\n`;
        });
        
        message += `\nGracias!`;
        return `https://wa.me/${supplier.supplierPhone}?text=${encodeURIComponent(message)}`;
    };

    if (loading) {
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
                        {totalItems} productos necesitan reposición ({totalSuppliers} proveedores involucrados).
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
                    {restockData.map((supplier) => (
                        <div key={supplier.supplierId || 'unassigned'} className="supplier-restock-card">
                            <div className="supplier-card-header">
                                <div>
                                    <h3 className="text-h3 font-semibold">{supplier.supplierName}</h3>
                                    <span className="text-small text-muted">{supplier.items.length} productos faltantes</span>
                                </div>
                                {supplier.supplierId && (
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
                                            className="btn btn-primary"
                                        >
                                            <PackageOpen size={18} />
                                            <span className="hidden sm:inline">Generar Compra</span>
                                        </Link>
                                        {supplier.supplierPhone && (
                                            <a 
                                                href={generateWhatsAppLink(supplier)} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="btn btn-secondary whatsapp-btn"
                                            >
                                                <MessageCircle size={18} />
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            <div className="supplier-items-list">
                                {supplier.items.map(item => (
                                    <div key={item.id} className="restock-item">
                                        <div className="item-info">
                                            {item.code && <span className="item-code">{item.code}</span>}
                                            <span className="item-name">{item.name}</span>
                                        </div>
                                        <div className="item-stock-info">
                                            <div className="stock-pill critical">
                                                Stock: {item.stock}
                                            </div>
                                            <div className="stock-pill minimal">
                                                Mín: {item.minStock}
                                            </div>
                                            <div className="cost-info hidden sm:block">
                                                Costo ref: ${item.cost.toLocaleString('es-AR')}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {!supplier.supplierId && (
                                <div className="unassigned-warning mt-4 p-3 bg-warning-light text-warning-dark rounded-md text-sm flex gap-2">
                                    <AlertTriangle size={16} />
                                    <span>
                                        Estos productos no tienen un proveedor asignado. Asignales uno para agilizar la reposición.
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Restock;

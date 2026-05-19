import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { ElPapelito } from './components/ElPapelito';
import './RestockMobile.css';

interface RestockItem {
    id: string;
    code: string;
    name: string;
    stock: number;
    minStock: number;
    cost: number;
    suggestedAmount: number;
    runoutDays: number;
    mermaRate: number;
    category: string;
    isCustomItem?: boolean;
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
    const products = useStore(state => state.products);
    const loadProducts = useStore(state => state.loadProducts);
    const updateProduct = useStore(state => state.updateProduct);
    const addProduct = useStore(state => state.addProduct);
    const categoriesData = useStore(state => state.categoriesData) || [];
    const loadCategories = useStore(state => state.loadCategories);
    const addNotification = useStore(state => state.addNotification);
    const { user } = useAuth();
    const businessId = user?.business_id || 'default_business';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

    // Replenishment strategy & filters
    const [strategy, setStrategy] = useState<'critical' | 'predictive' | 'mermas'>('predictive');
    const [showAllCatalogProducts, setShowAllCatalogProducts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');
    const [selectedTag, setSelectedTag] = useState('');

    // Dynamic Category Tree options with indentation
    const categoryOptions = useMemo(() => {
        const buildOptions = (parentId: string | null = null, depth = 0): { id: string; name: string; label: string }[] => {
            const list: { id: string; name: string; label: string }[] = [];
            const filtered = categoriesData.filter(c => c.parent_id === parentId || (parentId === null && !c.parent_id));
            filtered.forEach(c => {
                const indent = '\u00A0\u00A0'.repeat(depth);
                list.push({
                    id: c.id,
                    name: c.name,
                    label: `${indent}${depth > 0 ? '↳ ' : '📁 '}${c.name}`
                });
                list.push(...buildOptions(c.id, depth + 1));
            });
            return list;
        };
        return buildOptions(null, 0);
    }, [categoriesData]);

    // Unique tags extractor
    const allTags = useMemo(() => {
        const tagsSet = new Set<string>();
        products.forEach(p => {
            if (p.tags && Array.isArray(p.tags)) {
                p.tags.forEach(t => tagsSet.add(t));
            }
        });
        return Array.from(tagsSet).sort();
    }, [products]);

    // Bulk assignment
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [targetSupplierId, setTargetSupplierId] = useState<string>('');
    const [isAssigning, setIsAssigning] = useState(false);

    // Custom manually started suppliers, catalog selections, invented items, and suggested amounts
    const [manuallyStartedSuppliers, setManuallyStartedSuppliers] = useState<string[]>([]);
    const [manuallyAddedProducts, setManuallyAddedProducts] = useState<Record<string, string[]>>({});
    const [customOrderItems, setCustomOrderItems] = useState<Record<string, RestockItem[]>>({});
    const [customSuggestedAmounts, setCustomSuggestedAmounts] = useState<Record<string, number>>({});

    // Inline inputs for inventing items
    const [inventedName, setInventedName] = useState<Record<string, string>>({});
    const [inventedCost, setInventedCost] = useState<Record<string, string>>({});
    const [inventedAmount, setInventedAmount] = useState<Record<string, string>>({});

    // Catalog search query inside each supplier card
    const [catalogSearchQueries, setCatalogSearchQueries] = useState<Record<string, string>>({});

    // Supplier specific settings: lead time (days) and custom notes
    const [leadTimes, setLeadTimes] = useState<Record<string, number>>(() => {
        const stored = localStorage.getItem(`restock_lead_times_${businessId}`);
        return stored ? JSON.parse(stored) : {};
    });
    const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});

    // New product drawer state
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [newProductCode, setNewProductCode] = useState('');
    const [newProductCost, setNewProductCost] = useState('');
    const [newProductPrice, setNewProductPrice] = useState('');
    const [newProductStock, setNewProductStock] = useState('');
    const [newProductMinStock, setNewProductMinStock] = useState('');
    const [newProductCategory, setNewProductCategory] = useState('');
    const [newProductSupplierId, setNewProductSupplierId] = useState('');

    // VFS Success indicator
    const [successVFSItem, setSuccessVFSItem] = useState<{ supplierName: string; filename: string } | null>(null);

    const fetchRestock = async () => {
        try {
            setLoading(true);
            await Promise.allSettled([
                loadProducts(),
                loadSuppliers(),
                loadCategories ? loadCategories(true) : Promise.resolve()
            ]);
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
    }, []);

    // Save lead times
    const handleSetLeadTime = (supplierId: string, days: number) => {
        const updated = { ...leadTimes, [supplierId]: days };
        setLeadTimes(updated);
        localStorage.setItem(`restock_lead_times_${businessId}`, JSON.stringify(updated));
    };

    // Calculate suggested stock amount based on strategy
    const restockData = useMemo(() => {
        const grouped: Record<string, SupplierRestock> = {};

        // 1. Incorporate all manually started suppliers into group keys
        manuallyStartedSuppliers.forEach(sId => {
            if (!grouped[sId]) {
                const supplier = suppliers.find(s => s.id === sId);
                grouped[sId] = {
                    supplierId: sId === 'unassigned' ? null : sId,
                    supplierName: supplier ? supplier.name : 'Sin Proveedor Asignado',
                    supplierPhone: supplier ? supplier.phone : null,
                    items: []
                };
            }
        });

        // 2. Loop over standard products
        const filteredProducts = products.filter(p => {
            const supplierId = p.supplierId || 'unassigned';
            const isManuallyAdded = manuallyAddedProducts[supplierId]?.includes(p.id);

            const matchesSearch = !searchQuery || 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));

            // Category matching recursively
            const getCategoryWithDescendants = (catName: string): string[] => {
                const matchingCat = categoriesData.find(c => c.name === catName);
                if (!matchingCat) return [catName];
                
                const names = [matchingCat.name];
                const collectChildren = (parentId: string) => {
                    const children = categoriesData.filter(c => c.parent_id === parentId);
                    children.forEach(ch => {
                        names.push(ch.name);
                        collectChildren(ch.id);
                    });
                };
                collectChildren(matchingCat.id);
                return names;
            };

            const allowedCategories = selectedCategory ? getCategoryWithDescendants(selectedCategory) : [];
            const matchesCategory = !selectedCategory || allowedCategories.includes(p.category || '');
            const matchesSupplier = !selectedSupplierFilter || p.supplierId === selectedSupplierFilter;
            const matchesTag = !selectedTag || (p.tags && p.tags.includes(selectedTag));

            return (matchesSearch && matchesCategory && matchesSupplier && matchesTag) || isManuallyAdded;
        });

        filteredProducts.forEach(p => {
            const supplierId = p.supplierId || 'unassigned';
            const leadTime = leadTimes[supplierId] || 3;

            const dailySales = p.weeklySales ? (p.weeklySales / 7) : 0.4;
            const runoutDays = dailySales > 0 ? (p.stock / dailySales) : 999;
            const mermaRate = p.category?.toLowerCase().includes('flor') ? 0.12 : 0.05;

            const isManuallyAdded = manuallyAddedProducts[supplierId]?.includes(p.id);

            // Suggested Restocking Amount
            let suggestedAmount = 0;
            let triggerRestock = false;

            if (strategy === 'critical') {
                triggerRestock = p.stock <= p.min;
                suggestedAmount = triggerRestock ? (p.min * 2 - p.stock) : 0;
            } else if (strategy === 'predictive') {
                triggerRestock = runoutDays <= (leadTime + 5) || p.stock <= p.min;
                suggestedAmount = Math.ceil(dailySales * 15) - p.stock;
            } else {
                triggerRestock = runoutDays <= (leadTime + 5) || p.stock <= p.min;
                const baseReplenish = Math.ceil(dailySales * 15) - p.stock;
                suggestedAmount = Math.ceil(baseReplenish * (1 + mermaRate));
            }

            if (suggestedAmount < 0) suggestedAmount = 0;
            if (suggestedAmount === 0 && triggerRestock) suggestedAmount = 10;
            if (isManuallyAdded && suggestedAmount === 0) suggestedAmount = 10;

            // Apply overrides if customSuggestedAmounts exists
            if (customSuggestedAmounts[p.id] !== undefined) {
                suggestedAmount = customSuggestedAmounts[p.id];
            }

            const shouldShow = showAllCatalogProducts || (
                strategy === 'critical' 
                    ? (p.stock <= p.min || isManuallyAdded) 
                    : (p.stock <= p.min || runoutDays <= (leadTime + 7) || isManuallyAdded)
            );

            if (shouldShow) {
                if (!grouped[supplierId]) {
                    const supplier = suppliers.find(s => s.id === supplierId);
                    grouped[supplierId] = {
                        supplierId: supplierId === 'unassigned' ? null : supplierId,
                        supplierName: supplier ? supplier.name : 'Sin Proveedor Asignado',
                        supplierPhone: supplier ? supplier.phone : null,
                        items: []
                    };
                }
                
                if (!grouped[supplierId].items.some(item => item.id === p.id)) {
                    grouped[supplierId].items.push({
                        id: p.id,
                        code: p.code || 'S/C',
                        name: p.name,
                        stock: p.stock ?? 0,
                        minStock: p.min ?? 0,
                        cost: p.cost || 0,
                        suggestedAmount,
                        runoutDays,
                        mermaRate,
                        category: p.category
                    });
                }
            }
        });

        // 3. Inject custom invented items
        Object.keys(customOrderItems).forEach(sId => {
            if (!grouped[sId]) {
                const supplier = suppliers.find(s => s.id === sId);
                grouped[sId] = {
                    supplierId: sId === 'unassigned' ? null : sId,
                    supplierName: supplier ? supplier.name : 'Sin Proveedor Asignado',
                    supplierPhone: supplier ? supplier.phone : null,
                    items: []
                };
            }
            customOrderItems[sId].forEach(customItem => {
                let amount = customItem.suggestedAmount;
                if (customSuggestedAmounts[customItem.id] !== undefined) {
                    amount = customSuggestedAmounts[customItem.id];
                }

                if (!grouped[sId].items.some(item => item.id === customItem.id)) {
                    grouped[sId].items.push({
                        ...customItem,
                        suggestedAmount: amount
                    });
                }
            });
        });

        return Object.values(grouped)
            .filter(g => g.items.length > 0 || manuallyStartedSuppliers.includes(g.supplierId || 'unassigned'))
            .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
    }, [products, suppliers, strategy, showAllCatalogProducts, searchQuery, selectedCategory, selectedSupplierFilter, selectedTag, categoriesData, leadTimes, manuallyStartedSuppliers, manuallyAddedProducts, customOrderItems, customSuggestedAmounts]);

    // Handle inline update
    const handleInlineUpdate = async (productId: string, field: 'stock' | 'min' | 'cost', value: number) => {
        if (productId.startsWith('invented_')) {
            setCustomOrderItems(prev => {
                const updated = { ...prev };
                Object.keys(updated).forEach(sId => {
                    updated[sId] = updated[sId].map(item => {
                        if (item.id === productId) {
                            return { ...item, [field === 'min' ? 'minStock' : field]: value };
                        }
                        return item;
                    });
                });
                return updated;
            });
            return;
        }

        try {
            await updateProduct(productId, { [field === 'min' ? 'min' : field]: value });
        } catch (error) {
            console.error('Error updating in-line value:', error);
        }
    };

    // Adddynamic invented item
    const handleAddInventedItem = (supplierId: string) => {
        const name = inventedName[supplierId] || '';
        const cost = parseFloat(inventedCost[supplierId]) || 0;
        const amount = parseInt(inventedAmount[supplierId]) || 10;

        if (!name.trim()) {
            addNotification('El nombre es obligatorio', 'warning');
            return;
        }

        const newItem: RestockItem = {
            id: `invented_${Date.now()}`,
            code: 'INV',
            name: name,
            stock: 0,
            minStock: 0,
            cost: cost,
            suggestedAmount: amount,
            runoutDays: 0,
            mermaRate: 0,
            category: 'Flores Frescas',
            isCustomItem: true
        };

        setCustomOrderItems(prev => ({
            ...prev,
            [supplierId]: [...(prev[supplierId] || []), newItem]
        }));

        setInventedName({ ...inventedName, [supplierId]: '' });
        setInventedCost({ ...inventedCost, [supplierId]: '' });
        setInventedAmount({ ...inventedAmount, [supplierId]: '' });

        const key = supplierId || 'unassigned';
        if (!manuallyStartedSuppliers.includes(key)) {
            setManuallyStartedSuppliers(prev => [...prev, key]);
        }

        addNotification('Ítem inventado añadido', 'success');
    };

    // Remove item
    const handleRemoveItem = (supplierId: string, itemId: string) => {
        const sKey = supplierId || 'unassigned';
        if (itemId.startsWith('invented_')) {
            setCustomOrderItems(prev => ({
                ...prev,
                [sKey]: (prev[sKey] || []).filter(item => item.id !== itemId)
            }));
        } else {
            setManuallyAddedProducts(prev => ({
                ...prev,
                [sKey]: (prev[sKey] || []).filter(id => id !== itemId)
            }));
        }
        addNotification('Ítem removido', 'info');
    };

    // Fast product creation
    const handleFastCreateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProductName.trim()) {
            addNotification('El nombre es obligatorio', 'warning');
            return;
        }

        try {
            await addProduct({
                name: newProductName,
                code: newProductCode || `P-${Date.now().toString().slice(-4)}`,
                category: newProductCategory || 'Flores Frescas',
                price: parseFloat(newProductPrice) || 0,
                cost: parseFloat(newProductCost) || 0,
                stock: parseInt(newProductStock) || 0,
                min: parseInt(newProductMinStock) || 10,
                tags: [],
                supplierId: newProductSupplierId || undefined
            });

            setIsDrawerOpen(false);
            setNewProductName('');
            setNewProductCode('');
            setNewProductCost('');
            setNewProductPrice('');
            setNewProductStock('');
            setNewProductMinStock('');
            setNewProductCategory('');
            setNewProductSupplierId('');
            
            await fetchRestock();
        } catch (error) {
            console.error('Error creating product in-line:', error);
        }
    };

    // Save to Workspace
    const handleSaveToWorkspace = (supplier: SupplierRestock) => {
        const itemsKey = `explorer_custom_items_${businessId}`;
        const storedItems = localStorage.getItem(itemsKey);
        let customItemsList = [];
        if (storedItems) {
            try {
                customItemsList = JSON.parse(storedItems);
            } catch (e) {
                console.error(e);
            }
        }

        const dateStr = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
        const filename = `Pedido_${supplier.supplierName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

        const columns = [
            { key: 'code', label: 'Código', width: 120 },
            { key: 'name', label: 'Producto', width: 250 },
            { key: 'quantity', label: 'Cantidad a Pedir', width: 130, align: 'right', badge: true },
            { key: 'cost', label: 'Costo Unitario ($)', width: 130, align: 'right', format: 'currency' },
            { key: 'total', label: 'Total Estimado ($)', width: 140, align: 'right', format: 'currency' }
        ];

        const rows = supplier.items.map(item => ({
            id: item.id,
            code: item.code,
            name: item.name,
            quantity: item.suggestedAmount,
            cost: item.cost,
            total: item.suggestedAmount * item.cost
        }));

        const newFile = {
            id: `restock_order_${supplier.supplierId || 'unassigned'}_${Date.now()}`,
            name: filename,
            parentId: 'pedidos_compra_folder',
            type: 'file',
            entity: 'custom',
            description: `Orden de reposición sugerida para ${supplier.supplierName}. Notas: ${orderNotes[supplier.supplierId || ''] || 'Sin notas'}.`,
            color: '#fef3c7',
            isCustom: true,
            customData: {
                columns,
                rows
            }
        };

        customItemsList.push(newFile);
        localStorage.setItem(itemsKey, JSON.stringify(customItemsList));

        setSuccessVFSItem({
            supplierName: supplier.supplierName,
            filename
        });
        addNotification('Pedido guardado exitosamente en el Workspace virtual', 'success');

        setTimeout(() => {
            setSuccessVFSItem(null);
        }, 5000);
    };

    const generateWhatsAppLink = (supplier: SupplierRestock) => {
        if (!supplier.supplierPhone) return '#';
        const lead = leadTimes[supplier.supplierId || ''] || 3;
        const notes = orderNotes[supplier.supplierId || ''] || '';

        let message = `*FLORERÍA MI JARDÍN - ORDEN DE REPOSICIÓN*\n`;
        message += `Hola ${supplier.supplierName}, deseo coordinar la entrega de los siguientes artículos:\n\n`;

        let totalEstimado = 0;
        supplier.items.forEach(item => {
            const totalItem = item.suggestedAmount * item.cost;
            totalEstimado += totalItem;
            message += `- *${item.suggestedAmount}x* _${item.name}_ (Cod: ${item.code}) | Costo ref: $${item.cost.toLocaleString('es-AR')}\n`;
        });

        message += `\n💰 *Total Estimado*: $${totalEstimado.toLocaleString('es-AR')}\n`;
        message += `⏰ *Plazo de entrega solicitado*: ${lead} días hábiles.\n`;
        
        if (notes.trim()) {
            message += `📌 *Notas / Comentarios*: ${notes}\n`;
        }
        
        message += `\nQuedo a la espera de tu confirmación de stock y costos. ¡Muchas gracias!`;

        return `https://wa.me/${supplier.supplierPhone}?text=${encodeURIComponent(message)}`;
    };

    const handleToggleProduct = (productId: string) => {
        setSelectedProducts(prev =>
            prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
        );
    };

    const handleToggleAllUnassigned = (unassignedItems: RestockItem[]) => {
        if (selectedProducts.length === unassignedItems.length) {
            setSelectedProducts([]);
        } else {
            setSelectedProducts(unassignedItems.map(item => item.id));
        }
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
                <p>Analizando inventarios...</p>
            </div>
        );
    }

    const totalItems = restockData.reduce((acc, curr) => acc + curr.items.length, 0);

    return (
        <div className="restock-mobile-wrapper">
            <header className="restock-mobile-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#ffffff', borderBottom: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div className="header-info">
                        <h2>Reposición Inteligente</h2>
                        <span className="header-count">{totalItems} productos sugeridos</span>
                    </div>
                    <button 
                        onClick={() => setIsDrawerOpen(true)}
                        style={{ background: '#4F7A5A', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>add</span>
                        Crear
                    </button>
                </div>

                {/* Strategy Buttons */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', width: '100%' }}>
                    <button 
                        onClick={() => setStrategy('critical')}
                        style={{ flex: 1, padding: '6px 4px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', background: strategy === 'critical' ? '#ffffff' : 'transparent', color: strategy === 'critical' ? '#4F7A5A' : '#64748b' }}
                    >
                        Crítico
                    </button>
                    <button 
                        onClick={() => setStrategy('predictive')}
                        style={{ flex: 1, padding: '6px 4px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', background: strategy === 'predictive' ? '#ffffff' : 'transparent', color: strategy === 'predictive' ? '#4F7A5A' : '#64748b' }}
                    >
                        Predictivo
                    </button>
                    <button 
                        onClick={() => setStrategy('mermas')}
                        style={{ flex: 1, padding: '6px 4px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', background: strategy === 'mermas' ? '#ffffff' : 'transparent', color: strategy === 'mermas' ? '#4F7A5A' : '#64748b' }}
                    >
                        + Mermas
                    </button>
                </div>

                {/* Free Restocking Toggle Switch */}
                <button
                    type="button"
                    onClick={() => setShowAllCatalogProducts(prev => !prev)}
                    style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        borderRadius: '8px',
                        border: `1px solid ${showAllCatalogProducts ? '#4F7A5A' : '#cbd5e1'}`,
                        background: showAllCatalogProducts ? '#ecfdf5' : '#ffffff',
                        color: showAllCatalogProducts ? '#4F7A5A' : '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                >
                    <span>{showAllCatalogProducts ? '🌟 Ver Todo el Catálogo (Abastecimiento Libre)' : '⚠️ Solo Stock Crítico / IA'}</span>
                </button>

                {/* Mobile Filters */}
                <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <span className="material-symbols-rounded" style={{ position: 'absolute', left: '8px', top: '8px', fontSize: '18px', color: '#94a3b8' }}>search</span>
                        <input 
                            type="text" 
                            placeholder="Buscar..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '6px 6px 6px 28px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', background: '#f8fafc' }}
                        />
                    </div>

                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', background: 'white', maxWidth: '90px' }}
                    >
                        <option value="">Carpetas</option>
                        {categoryOptions.map(opt => (
                            <option key={opt.id} value={opt.name}>{opt.label}</option>
                        ))}
                    </select>

                    <select
                        value={selectedTag}
                        onChange={e => setSelectedTag(e.target.value)}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', background: 'white', maxWidth: '85px' }}
                    >
                        <option value="">Tags</option>
                        {allTags.map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
                        ))}
                    </select>

                    <select
                        value={selectedSupplierFilter}
                        onChange={e => setSelectedSupplierFilter(e.target.value)}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', background: 'white', maxWidth: '85px' }}
                    >
                        <option value="">Provs</option>
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </header>

            {/* Quick manual supplier order selectors */}
            <div style={{ background: '#ffffff', padding: '10px 12px', borderBottom: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>¿Iniciar pedido manual con un proveedor?</span>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {suppliers.map(s => {
                        const isStarted = manuallyStartedSuppliers.includes(s.id);
                        return (
                            <button
                                key={s.id}
                                onClick={() => {
                                    if (isStarted) {
                                        setManuallyStartedSuppliers(prev => prev.filter(id => id !== s.id));
                                    } else {
                                        setManuallyStartedSuppliers(prev => [...prev, s.id]);
                                    }
                                }}
                                style={{ 
                                    padding: '4px 8px', 
                                    background: isStarted ? '#e2e8f0' : 'white', 
                                    border: '1px solid #cbd5e1', 
                                    borderRadius: '6px', 
                                    fontSize: '0.7rem', 
                                    whiteSpace: 'nowrap',
                                    color: isStarted ? '#475569' : '#4F7A5A',
                                    fontWeight: 'bold'
                                }}
                            >
                                {isStarted ? `✓ ${s.name}` : `+ ${s.name}`}
                            </button>
                        );
                    })}
                </div>
            </div>

            {successVFSItem && (
                <div style={{ background: '#fef3c7', borderBottom: '1px solid #f59e0b', padding: '10px 12px', fontSize: '0.75rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="material-symbols-rounded" style={{ color: '#d97706', fontSize: '18px' }}>check_circle</span>
                    <span style={{ color: '#78350f' }}>
                        ¡Pedido guardado en VFS! <strong>{successVFSItem.filename}</strong> se agregó a Proveedores y Compras.
                    </span>
                </div>
            )}

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
                    <p>No hay productos con stock bajo. Usa el selector de arriba para iniciar un pedido manual.</p>
                </div>
            ) : (
                <div className="restock-content">
                    {restockData.map((supplier) => {
                        const isUnassigned = !supplier.supplierId;
                        const supplierKey = supplier.supplierId || 'unassigned';
                        const isExpanded = expandedSupplier === supplierKey;

                        const totalCostEstimado = supplier.items.reduce((sum, item) => sum + (item.suggestedAmount * item.cost), 0);

                        return (
                            <div key={supplierKey} className={`supplier-card-mobile ${isUnassigned ? 'unassigned' : ''}`}>
                                <div className="supplier-header" onClick={() => toggleSupplier(supplierKey)} style={{ background: isExpanded ? '#f8fafc' : '#ffffff' }}>
                                    <div className="supplier-info">
                                        <span className="material-symbols-rounded">
                                            {isUnassigned ? 'warning' : 'local_shipping'}
                                        </span>
                                        <div>
                                            <h3>{supplier.supplierName}</h3>
                                            <span className="supplier-count" style={{ fontSize: '0.7rem' }}>
                                                {supplier.items.length} productos | Est: <strong>${totalCostEstimado.toLocaleString('es-AR')}</strong>
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`material-symbols-rounded chevron ${isExpanded ? 'expanded' : ''}`}>
                                        expand_more
                                    </span>
                                </div>

                                {isExpanded && (
                                    <div className="supplier-items-list" style={{ background: '#f8fafc', padding: '8px' }}>
                                        {/* Notes and Lead times for Mobile */}
                                        {!isUnassigned && (
                                            <div style={{ background: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', justifySelf: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>Demora Proveedor:</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <input 
                                                            type="number"
                                                            value={leadTimes[supplierKey] || 3}
                                                            onChange={e => handleSetLeadTime(supplierKey, parseInt(e.target.value) || 3)}
                                                            style={{ width: '45px', padding: '2px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontSize: '0.75rem' }}
                                                        />
                                                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>días</span>
                                                    </div>
                                                </div>
                                                <textarea 
                                                    placeholder="Notas de pedido especiales..."
                                                    value={orderNotes[supplierKey] || ''}
                                                    onChange={e => setOrderNotes({ ...orderNotes, [supplierKey]: e.target.value })}
                                                    rows={2}
                                                    style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', width: '100%', resize: 'vertical' }}
                                                />
                                            </div>
                                        )}

                                        {/* Add Catalog Item & Invent Items inside supplier card for mobile */}
                                        <div style={{ background: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {/* Catalog sum */}
                                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b' }}>🔍 Sumar producto del catálogo:</span>
                                                <input 
                                                    type="text"
                                                    placeholder="Buscar en catálogo..."
                                                    value={catalogSearchQueries[supplierKey] || ''}
                                                    onChange={e => setCatalogSearchQueries({ ...catalogSearchQueries, [supplierKey]: e.target.value })}
                                                    style={{ padding: '4px 8px', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%' }}
                                                />
                                                {catalogSearchQueries[supplierKey] && (
                                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '120px', overflowY: 'auto' }}>
                                                        {products
                                                            .filter(p => p.name.toLowerCase().includes(catalogSearchQueries[supplierKey].toLowerCase()) && (!p.supplierId || p.supplierId === supplierKey))
                                                            .slice(0, 4)
                                                            .map(p => (
                                                                <div 
                                                                    key={p.id}
                                                                    onClick={() => {
                                                                        setManuallyAddedProducts(prev => ({
                                                                            ...prev,
                                                                            [supplierKey]: [...(prev[supplierKey] || []).filter(id => id !== p.id), p.id]
                                                                        }));
                                                                        if (supplierKey !== 'unassigned' && !manuallyStartedSuppliers.includes(supplierKey)) {
                                                                            setManuallyStartedSuppliers(prev => [...prev, supplierKey]);
                                                                        }
                                                                        setCatalogSearchQueries({ ...catalogSearchQueries, [supplierKey]: '' });
                                                                        addNotification(`Producto ${p.name} sumado`, 'success');
                                                                    }}
                                                                    style={{ padding: '6px 8px', fontSize: '0.7rem', borderBottom: '1px solid #f1f5f9' }}
                                                                >
                                                                    {p.name} (Stock: {p.stock})
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                )}
                                            </div>

                                            {/* Invent custom item */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b' }}>✨ Inventar producto temporal:</span>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <input 
                                                        type="text"
                                                        placeholder="Nombre..."
                                                        value={inventedName[supplierKey] || ''}
                                                        onChange={e => setInventedName({ ...inventedName, [supplierKey]: e.target.value })}
                                                        style={{ flex: 1, padding: '4px 6px', fontSize: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                                    />
                                                    <input 
                                                        type="number"
                                                        placeholder="Cost..."
                                                        value={inventedCost[supplierKey] || ''}
                                                        onChange={e => setInventedCost({ ...inventedCost, [supplierKey]: e.target.value })}
                                                        style={{ width: '50px', padding: '4px 6px', fontSize: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }}
                                                    />
                                                    <input 
                                                        type="number"
                                                        placeholder="Cant..."
                                                        value={inventedAmount[supplierKey] || ''}
                                                        onChange={e => setInventedAmount({ ...inventedAmount, [supplierKey]: e.target.value })}
                                                        style={{ width: '40px', padding: '4px 6px', fontSize: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }}
                                                    />
                                                    <button 
                                                        onClick={() => handleAddInventedItem(supplierKey)}
                                                        style={{ background: '#4F7A5A', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}
                                                    >
                                                        Sumar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {isUnassigned && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                                                <div 
                                                    onClick={() => handleToggleAllUnassigned(supplier.items)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', padding: '4px', color: '#475569' }}
                                                >
                                                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#4F7A5A' }}>
                                                        {selectedProducts.length === supplier.items.length ? 'check_box' : 'check_box_outline_blank'}
                                                    </span>
                                                    <span>Seleccionar todos ({supplier.items.length})</span>
                                                </div>

                                                {selectedProducts.length > 0 && (
                                                    <div className="bulk-assign-bar" style={{ margin: 0 }}>
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
                                            </div>
                                        )}

                                        {/* Products grid */}
                                        {supplier.items.map(item => {
                                            const isSelected = selectedProducts.includes(item.id);
                                            const isInvented = item.id.startsWith('invented_');
                                            const runoutLabel = isInvented ? 'Inventado' : (item.runoutDays <= 5 ? 'Sin stock' : `${item.runoutDays.toFixed(0)}d`);

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`restock-item-mobile ${isUnassigned ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => isUnassigned && handleToggleProduct(item.id)}
                                                    style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                            {isUnassigned && (
                                                                <span className="material-symbols-rounded checkbox-icon">
                                                                    {isSelected ? 'check_box' : 'check_box_outline_blank'}
                                                                </span>
                                                            )}
                                                            <div className="item-mobile-info">
                                                                {item.code && <span className="item-code-sm">{item.code}</span>}
                                                                <div className="item-name-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    {item.name}
                                                                    <span 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRemoveItem(supplierKey, item.id);
                                                                        }}
                                                                        className="material-symbols-rounded" 
                                                                        style={{ fontSize: '15px', color: '#ef4444', cursor: 'pointer' }}
                                                                    >
                                                                        delete
                                                                    </span>
                                                                </div>
                                                                <span style={{ fontSize: '0.65rem', color: isInvented ? '#8b5cf6' : (item.runoutDays <= 5 ? '#ef4444' : '#d97706'), fontWeight: 'bold' }}>
                                                                    Autonomía: {runoutLabel}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Suggested Replenishment Pill editable input */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Cant:</span>
                                                            <input 
                                                                type="number"
                                                                min="0"
                                                                value={item.suggestedAmount}
                                                                onChange={e => {
                                                                    const val = parseInt(e.target.value) || 0;
                                                                    setCustomSuggestedAmounts(prev => ({ ...prev, [item.id]: val }));
                                                                }}
                                                                style={{ width: '45px', padding: '2px', border: '1px solid #4F7A5A', borderRadius: '4px', fontSize: '0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#4F7A5A', background: '#ecfdf5' }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* In-line parameter editing */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <label style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Stock</label>
                                                            <input 
                                                                type="number"
                                                                defaultValue={item.stock}
                                                                disabled={isInvented}
                                                                onBlur={e => handleInlineUpdate(item.id, 'stock', parseFloat(e.target.value) || 0)}
                                                                style={{ padding: '2px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', textAlign: 'center' }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <label style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Mínimo</label>
                                                            <input 
                                                                type="number"
                                                                defaultValue={item.minStock}
                                                                disabled={isInvented}
                                                                onBlur={e => handleInlineUpdate(item.id, 'min', parseFloat(e.target.value) || 0)}
                                                                style={{ padding: '2px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', textAlign: 'center' }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <label style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Costo ($)</label>
                                                            <input 
                                                                type="number"
                                                                defaultValue={item.cost}
                                                                onBlur={e => handleInlineUpdate(item.id, 'cost', parseFloat(e.target.value) || 0)}
                                                                style={{ padding: '2px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', textAlign: 'center' }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {!isUnassigned && (
                                            <div className="supplier-actions-bar" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '6px', padding: '6px' }}>
                                                {/* Save to Workspace */}
                                                <button
                                                    onClick={() => handleSaveToWorkspace(supplier)}
                                                    style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 4px', fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                                >
                                                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>folder_open</span>
                                                    Workspace
                                                </button>

                                                <Link
                                                    to="/compras"
                                                    state={{
                                                        supplierId: supplier.supplierId,
                                                        items: supplier.items.map(item => ({
                                                            productId: item.id,
                                                            productName: item.name,
                                                            quantity: item.suggestedAmount,
                                                            cost: item.cost
                                                        }))
                                                    }}
                                                    className="btn-generate-purchase"
                                                    style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderRadius: '8px' }}
                                                >
                                                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>shopping_cart</span>
                                                    Pedir
                                                </Link>

                                                {supplier.supplierPhone && (
                                                    <a
                                                        href={generateWhatsAppLink(supplier)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn-whatsapp-order"
                                                        style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderRadius: '8px' }}
                                                    >
                                                        <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>chat</span>
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

            {/* Quick Product Creation Drawer Modal */}
            {isDrawerOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh', background: 'rgba(255,255,255,0.98)', zIndex: 9999, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderBottom: '1px solid #cbd5e1', background: '#4F7A5A', color: 'white' }}>
                        <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 'bold' }}>+ Registrar Producto</h2>
                        <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1rem' }}>
                            Cerrar
                        </button>
                    </div>

                    <form onSubmit={handleFastCreateProduct} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Nombre *</label>
                            <input 
                                type="text"
                                placeholder="Ej: Rosas Importadas Rojas"
                                required
                                value={newProductName}
                                onChange={e => setNewProductName(e.target.value)}
                                style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Código de barras</label>
                            <input 
                                type="text"
                                placeholder="Ej: 7791234567"
                                value={newProductCode}
                                onChange={e => setNewProductCode(e.target.value)}
                                style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Costo ($)</label>
                                <input 
                                    type="number"
                                    placeholder="450"
                                    value={newProductCost}
                                    onChange={e => setNewProductCost(e.target.value)}
                                    style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Venta ($)</label>
                                <input 
                                    type="number"
                                    placeholder="1200"
                                    value={newProductPrice}
                                    onChange={e => setNewProductPrice(e.target.value)}
                                    style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Stock Inicial</label>
                                <input 
                                    type="number"
                                    placeholder="15"
                                    value={newProductStock}
                                    onChange={e => setNewProductStock(e.target.value)}
                                    style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Mínimo</label>
                                <input 
                                    type="number"
                                    placeholder="10"
                                    value={newProductMinStock}
                                    onChange={e => setNewProductMinStock(e.target.value)}
                                    style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Carpeta / Categoría</label>
                            <select
                                value={newProductCategory}
                                onChange={e => setNewProductCategory(e.target.value)}
                                style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: 'white' }}
                            >
                                <option value="">Seleccionar carpeta...</option>
                                {categoriesData.map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Proveedor</label>
                            <select
                                value={newProductSupplierId}
                                onChange={e => setNewProductSupplierId(e.target.value)}
                                style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: 'white' }}
                            >
                                <option value="">Seleccionar proveedor...</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <button 
                            type="submit" 
                            style={{ background: '#4F7A5A', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
                        >
                            ✓ Registrar Catálogo
                        </button>
                    </form>
                </div>
            )}

            {/* Float Sticky Note / Papelito */}
            <ElPapelito />
        </div>
    );
};

import { useState, useMemo, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Package as PackageIcon,
    Layers
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Package } from '../../store/useStore';
import { PackageBuilderModal } from '../../components/PackageBuilder/PackageBuilderModal';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal } from '../../components/ui/Modals';
import './PackagesDesktop.css';

export const PackagesDesktop = () => {
    const packages = useStore((state) => state.packages);
    const products = useStore((state) => state.products);
    const deletePackage = useStore((state) => state.deletePackage);
    const loadPackages = useStore((state) => state.loadPackages);
    const loadProducts = useStore((state) => state.loadProducts);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Load data from backend on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([loadPackages(), loadProducts()]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [activeSection, setActiveSection] = useState<string | null>(null);

    // Modal State
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [packageToEdit, setPackageToEdit] = useState<Package | null>(null);

    const { confirmModal, showConfirm } = useModal();

    // Filter Logic
    const filteredPackages = useMemo(() => {
        return (packages || []).filter(pkg => {
            const matchesSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesSection = activeSection ? pkg.section === activeSection : true;
            return matchesSearch && matchesSection;
        });
    }, [packages, searchTerm, activeSection]);

    // Derived Sections
    const sections: string[] = Array.from(new Set((packages || []).map((p: any) => p.section)));

    // Helper: calcular el costo base real sumando el costo de los ingredientes
    const calculateCost = (pkg: Package) => {
        return pkg.items.reduce((total, item) => {
            const product = products.find(p => p.id === item.productId);
            // Asumimos un 50% de margen histórico si no hay costo explícito aún
            const estimatedCost = product ? product.price * 0.5 : 0;
            return total + (estimatedCost * item.quantity);
        }, 0);
    };

    const handleCreateNew = () => {
        setPackageToEdit(null);
        setIsBuilderOpen(true);
    };

    const handleEdit = (pkg: Package) => {
        setPackageToEdit(pkg);
        setIsBuilderOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        const confirmed = await showConfirm({
            title: '¿Eliminar arreglo?',
            message: `Se eliminará el arreglo "${name}". Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            variant: 'danger'
        });
        if (confirmed) {
            deletePackage(id);
        }
    };

    return (
        <div className="packages-page">
            {/* Loading State */}
            {isLoading && (
                <div className="loading-overlay" style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(255,255,255,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="spinner" style={{
                            width: 50,
                            height: 50,
                            border: '4px solid #e5e7eb',
                            borderTopColor: '#4F7A5A',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1rem'
                        }}></div>
                        <p style={{ color: '#6B6B6B', fontWeight: 500 }}>Cargando paquetes...</p>
                    </div>
                </div>
            )}

            <header className="page-header mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-h1">Arreglos y Promociones</h1>
                    <p className="text-body mt-2 text-muted">Diseña cajas, ramos y combos uniendo varios productos.</p>
                </div>
                <button className="btn btn-primary btn-lg shadow-primary" onClick={handleCreateNew}>
                    <Plus size={20} />
                    <span>Nuevo Arreglo</span>
                </button>
            </header>

            <div className="inventory-controls mb-8">
                <div className="search-pill">
                    <Search className="text-muted" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre del arreglo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="tag-filters-container mt-4">
                    <button
                        className={`filter-chip ${activeSection === null ? 'active' : ''}`}
                        onClick={() => setActiveSection(null)}
                    >
                        Todos
                    </button>
                    {sections.map(sec => (
                        <button
                            key={sec}
                            className={`filter-chip category-filter ${activeSection === sec ? 'active' : ''}`}
                            onClick={() => setActiveSection(sec)}
                        >
                            <Layers size={14} className="mr-1" />
                            {sec}
                        </button>
                    ))}
                </div>
            </div>

            <div className="packages-grid">
                {filteredPackages.map((pkg: any) => {
                    const estimatedCost = calculateCost(pkg);
                    const markup = estimatedCost > 0 ? pkg.price / estimatedCost : 0;
                    
                    return (
                        <div key={pkg.id as string} className="card package-card modern-card">
                            {/* Visual CSS Floral Avatar */}
                            <div className="floral-avatar-wrapper">
                                <div className="floral-bouquet-mini">
                                    <div className="stem-layer">
                                        <div className="stem stem-1"></div>
                                        <div className="stem stem-2"></div>
                                        <div className="stem stem-3"></div>
                                    </div>
                                    <div className="bloom-layer">
                                        {pkg.items.slice(0, 5).map((item: any, idx: number) => {
                                            const prod = products.find(p => p.id === item.productId);
                                            const prodName = prod ? prod.name.toLowerCase() : 'flor';
                                            let color = '#D9A09A'; // Default rose
                                            if (prodName.includes('rosa') || prodName.includes('red') || prodName.includes('rojo')) color = '#C85A53';
                                            else if (prodName.includes('amarill') || prodName.includes('gold') || prodName.includes('sol')) color = '#E9C46A';
                                            else if (prodName.includes('blan') || prodName.includes('whit') || prodName.includes('crem')) color = '#FAF6EE';
                                            else if (prodName.includes('azul') || prodName.includes('blue') || prodName.includes('violet')) color = '#5D8CAE';
                                            else if (prodName.includes('ment') || prodName.includes('verd') || prodName.includes('hoj') || prodName.includes('euca')) color = '#74A38A';
                                            
                                            const bloomCount = Math.min(item.quantity, 3);
                                            return Array.from({ length: bloomCount }).map((_, bIdx) => {
                                                const angle = (idx * 60 + bIdx * 30) % 360;
                                                const dist = 12 + (idx * 4) % 12;
                                                const x = Math.cos((angle * Math.PI) / 180) * dist;
                                                const y = Math.sin((angle * Math.PI) / 180) * dist;
                                                return (
                                                    <div 
                                                        key={`${idx}-${bIdx}`} 
                                                        className="mini-bloom" 
                                                        style={{
                                                            backgroundColor: color,
                                                            transform: `translate(${x}px, ${y}px)`,
                                                            boxShadow: `0 2px 6px ${color}44`,
                                                            border: '1px solid rgba(0,0,0,0.05)'
                                                        }}
                                                    />
                                                );
                                            });
                                        })}
                                        <div className="mini-bloom center-bloom" style={{ backgroundColor: '#E9C46A' }}></div>
                                    </div>
                                    <div className="kraft-bow">🎀</div>
                                </div>
                            </div>

                            <div className="package-card-header">
                                <div>
                                    <span className="category-badge mb-2 inline-block">
                                        {pkg.section}
                                    </span>
                                    <h3 className="text-h3 font-bold">{pkg.name}</h3>
                                </div>
                                <div className="action-buttons flex gap-2">
                                    <button className="btn-icon text-muted hover-primary" onClick={() => handleEdit(pkg)}>
                                        <Edit2 size={18} />
                                    </button>
                                    <button className="btn-icon text-muted hover-danger" onClick={() => handleDelete(pkg.id, pkg.name)}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            {pkg.description && (
                                <p className="text-small text-muted mt-2 mb-4 line-clamp-2">{pkg.description}</p>
                            )}

                            {/* Markup Coach Coach Tag */}
                            <div>
                                {markup < 1.5 ? (
                                    <span className="markup-coach-tag markup-low">
                                        🔴 Rentabilidad Baja ({markup.toFixed(1)}x)
                                    </span>
                                ) : markup <= 2.2 ? (
                                    <span className="markup-coach-tag markup-good">
                                        🟡 Rentabilidad Buena ({markup.toFixed(1)}x)
                                    </span>
                                ) : (
                                    <span className="markup-coach-tag markup-excellent">
                                        🟢 Excelente Rentabilidad ({markup.toFixed(1)}x)
                                    </span>
                                )}
                            </div>

                            <div className="package-recipe mt-4 pt-4 border-t border-dashed">
                                <h4 className="text-small font-bold mb-2 flex items-center gap-1 text-primary">
                                    <PackageIcon size={14} /> Receta ({pkg.items.length} items):
                                </h4>
                                <div className="recipe-items">
                                    {pkg.items.slice(0, 3).map((item: any, idx: number) => {
                                        const prod = products.find(p => p.id === item.productId);
                                        return (
                                            <div key={idx} className="recipe-item flex justify-between items-center py-1">
                                                <span className="text-small font-medium">
                                                    <span className="text-primary mr-1">{item.quantity}x</span>
                                                    {prod ? prod.name : 'Producto Eliminado'}
                                                </span>
                                                {prod && <span className="text-micro text-muted">${(prod.price * item.quantity).toLocaleString()}</span>}
                                            </div>
                                        );
                                    })}
                                    {pkg.items.length > 3 && (
                                        <div className="text-micro text-muted mt-2 px-2 py-1 bg-surface-hover rounded-md text-center">
                                            + {pkg.items.length - 3} items más
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="package-card-footer mt-6 pt-4 border-t flex justify-between items-end">
                                <div className="cost-box">
                                    <span className="text-micro text-muted uppercase tracking-wider font-bold">Costo Materiales</span>
                                    <p className="font-bold text-muted">${estimatedCost.toLocaleString()}</p>
                                </div>
                                <div className="price-box text-right">
                                    <span className="text-micro text-primary uppercase tracking-wider font-bold">Precio Público</span>
                                    <p className="text-h2 text-primary font-bold">${pkg.price.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredPackages.length === 0 && (
                <div className="empty-state card">
                    <PackageIcon size={48} className="text-muted mb-4 opacity-20" />
                    <h3 className="text-h2 mb-2">No hay arreglos armados</h3>
                    <p className="text-body text-muted mb-6">Crea tu primer combo mezclando productos de tu inventario.</p>
                    <button className="btn btn-primary btn-lg" onClick={handleCreateNew}>
                        <Plus size={20} className="mr-2" />
                        Comenzar a Armar
                    </button>
                </div>
            )}

            <PackageBuilderModal
                isOpen={isBuilderOpen}
                onClose={() => setIsBuilderOpen(false)}
                packageToEdit={packageToEdit || undefined}
            />

            {confirmModal && <ConfirmModal {...confirmModal} />}
        </div>
    );
};

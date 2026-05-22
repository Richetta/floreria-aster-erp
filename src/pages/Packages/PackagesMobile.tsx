import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { PackageBuilderModal } from '../../components/PackageBuilder/PackageBuilderModal';
import { useModal } from '../../hooks/useModal';
import './PackagesMobile.css';
import type { Package } from '../../store/useStore';

export const PackagesMobile = () => {
    const packages = useStore((state) => state.packages);
    const products = useStore((state) => state.products);
    const deletePackage = useStore((state) => state.deletePackage);
    const loadPackages = useStore((state) => state.loadPackages);
    const loadProducts = useStore((state) => state.loadProducts);

    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [packageToEdit, setPackageToEdit] = useState<Package | null>(null);

    const { showConfirm } = useModal();

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([loadPackages(), loadProducts()]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const filteredPackages = useMemo(() => {
        return (packages || []).filter(pkg => {
            const matchesSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesSection = activeSection ? pkg.section === activeSection : true;
            return matchesSearch && matchesSection;
        });
    }, [packages, searchTerm, activeSection]);

    const sections: string[] = Array.from(new Set((packages || []).map((p: any) => p.section)));

    const calculateCost = (pkg: Package) => {
        return pkg.items.reduce((total, item) => {
            const product = products.find(p => p.id === item.productId);
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

    if (isLoading) {
        return (
            <div className="packages-loading">
                <div className="spinner-packages"></div>
                <p>Cargando paquetes...</p>
            </div>
        );
    }

    return (
        <div className="packages-mobile-wrapper">
            <header className="packages-mobile-header">
                <h2>Arreglos</h2>
                <button className="icon-btn-primary" onClick={handleCreateNew}>
                    <span className="material-symbols-rounded">add</span>
                </button>
            </header>

            {/* Search */}
            <div className="packages-search-box">
                <span className="material-symbols-rounded">search</span>
                <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Section Filters */}
            {sections.length > 0 && (
                <div className="packages-section-scroll">
                    <button
                        className={`section-chip ${activeSection === null ? 'active' : ''}`}
                        onClick={() => setActiveSection(null)}
                    >
                        Todos
                    </button>
                    {sections.map(sec => (
                        <button
                            key={sec}
                            className={`section-chip ${activeSection === sec ? 'active' : ''}`}
                            onClick={() => setActiveSection(sec)}
                        >
                            {sec}
                        </button>
                    ))}
                </div>
            )}

            {/* Packages Grid */}
            <div className="packages-mobile-content">
                {filteredPackages.length === 0 ? (
                    <div className="empty-packages">
                        <span className="material-symbols-rounded">bouquet</span>
                        <h3>No hay arreglos</h3>
                        <p>Crea tu primer combo</p>
                        <button className="btn-create-first" onClick={handleCreateNew}>
                            <span className="material-symbols-rounded">add</span>
                            Crear Arreglo
                        </button>
                    </div>
                ) : (
                    <div className="packages-cards-grid">
                        {filteredPackages.map((pkg: any) => {
                            const estimatedCost = calculateCost(pkg);
                            const markup = estimatedCost > 0 ? pkg.price / estimatedCost : 0;

                            return (
                                <div key={pkg.id} className="package-card-mobile">
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
                                                        const dist = 10 + (idx * 3) % 10;
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

                                    <div className="package-card-top">
                                        <div className="package-info">
                                            <span className="package-section-badge">{pkg.section}</span>
                                            <h3 className="package-name">{pkg.name}</h3>
                                        </div>
                                        <div className="package-actions">
                                            <button className="icon-btn-sm" onClick={() => handleEdit(pkg)}>
                                                <span className="material-symbols-rounded">edit</span>
                                            </button>
                                            <button className="icon-btn-sm danger" onClick={() => handleDelete(pkg.id, pkg.name)}>
                                                <span className="material-symbols-rounded">delete</span>
                                            </button>
                                        </div>
                                    </div>

                                    {pkg.description && (
                                        <p className="package-description">{pkg.description}</p>
                                    )}

                                    {/* Markup Coach Coach Tag */}
                                    <div style={{ margin: '0.25rem 0' }}>
                                        {markup < 1.5 ? (
                                            <span className="markup-coach-tag markup-low">
                                                🔴 Baja ({markup.toFixed(1)}x)
                                            </span>
                                        ) : markup <= 2.2 ? (
                                            <span className="markup-coach-tag markup-good">
                                                🟡 Buena ({markup.toFixed(1)}x)
                                            </span>
                                        ) : (
                                            <span className="markup-coach-tag markup-excellent">
                                                🟢 Exc. ({markup.toFixed(1)}x)
                                            </span>
                                        )}
                                    </div>

                                    <div className="package-recipe-mini">
                                        <div className="recipe-mini-header">
                                            <span className="material-symbols-rounded">inventory_2</span>
                                            <span>{pkg.items.length} items</span>
                                        </div>
                                        <div className="recipe-mini-list">
                                            {pkg.items.slice(0, 2).map((item: any) => {
                                                const prod = products.find(p => p.id === item.productId);
                                                return (
                                                    <div key={item.productId} className="recipe-mini-item">
                                                        <span>{item.quantity}x {prod?.name || 'Producto'}</span>
                                                    </div>
                                                );
                                            })}
                                            {pkg.items.length > 2 && (
                                                <div className="recipe-more">+{pkg.items.length - 2} más</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="package-card-bottom">
                                        <div className="package-cost">
                                            <span className="cost-label">Costo</span>
                                            <span className="cost-value">${estimatedCost.toLocaleString()}</span>
                                        </div>
                                        <div className="package-price">
                                            <span className="price-label">Precio</span>
                                            <span className="price-value">${pkg.price.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <PackageBuilderModal
                isOpen={isBuilderOpen}
                onClose={() => setIsBuilderOpen(false)}
                packageToEdit={packageToEdit || undefined}
            />
        </div>
    );
};

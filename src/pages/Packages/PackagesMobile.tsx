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
                        {filteredPackages.map((pkg: any) => (
                            <div key={pkg.id} className="package-card-mobile">
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
                                        <span className="cost-value">${calculateCost(pkg).toLocaleString()}</span>
                                    </div>
                                    <div className="package-price">
                                        <span className="price-label">Precio</span>
                                        <span className="price-value">${pkg.price.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
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

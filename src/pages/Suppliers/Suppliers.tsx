import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Phone,
    User,
    MapPin,
    Calendar,
    FileUp,
    X,
    AlertCircle,
    Upload,
    Sparkles,
    Download,
    Building2,
    Truck,
    Briefcase,
    Tag,
    Edit2
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { SupplierLocal } from '../../store/useStore';
import { ocrService } from '../../services/OCRService';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { api } from '../../services/api';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../../components/ui/Modals';
import './Suppliers.css';

export const Suppliers = () => {
    const suppliers = useStore(state => state.suppliers);
    const products = useStore(state => state.products);
    const updateProduct = useStore(state => state.updateProduct);
    const addSupplier = useStore(state => state.addSupplier);
    const updateSupplier = useStore(state => state.updateSupplier);
    const loadSuppliers = useStore(state => state.loadSuppliers);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Load data from backend on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                await loadSuppliers();
            } catch (err) {
                console.error("Error loading suppliers:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMagicModalOpen, setIsMagicModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<SupplierLocal | null>(null);

    // Magic Modal Logic
    const [isMagicProcessing, setIsMagicProcessing] = useState(false);
    const [detectedChanges, setDetectedChanges] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const { alertModal, showAlert } = useModal();

    const handleMagicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsMagicProcessing(true);
        setError(null);

        try {
            const result = await ocrService.extractText(file);
            const lines = result.lines;
            const newDetectedChanges: any[] = [];

            products.forEach(p => {
                const escapedName = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`${escapedName}.*?(\\d[\\d.,]*)`, 'i');

                for (const line of lines) {
                    const match = line.match(regex);
                    if (match) {
                        const detectedPrice = parseFloat(match[1].replace('.', '').replace(',', '.'));
                        if (detectedPrice > 0 && Math.abs(detectedPrice - p.price) > 1) {
                            newDetectedChanges.push({
                                id: p.id,
                                name: p.name,
                                oldPrice: p.price,
                                newPrice: detectedPrice,
                                confidence: Math.round(result.confidence)
                            });
                            break;
                        }
                    }
                }
            });

            if (newDetectedChanges.length === 0) {
                setError('No se detectaron cambios de precios significativos.');
            } else {
                setDetectedChanges(newDetectedChanges);
            }
        } catch (err: any) {
            console.error('OCR Error:', err);
            setError('Error al procesar la imagen.');
        } finally {
            setIsMagicProcessing(false);
        }
    };

    const applyMagicChanges = async () => {
        for (const change of detectedChanges) {
            await updateProduct(change.id, { price: change.newPrice });
        }
        showAlert({ title: 'Éxito', message: '¡Precios actualizados con éxito!', variant: 'success' });
        setIsMagicModalOpen(false);
        setDetectedChanges([]);
    };

    const categories = ['all', ...Array.from(new Set(suppliers.map(s => s.category)))];

    const filteredSuppliers = suppliers.filter(s => {
        const matchesSearch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.contactName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get('name') as string,
            contactName: formData.get('contactName') as string,
            phone: formData.get('phone') as string,
            category: formData.get('category') as string,
            address: formData.get('address') as string,
            nextVisitDate: formData.get('nextVisitDate') as string,
        };

        if (editingSupplier) {
            await updateSupplier(editingSupplier.id, data);
        } else {
            await addSupplier({
                id: generateIdWithPrefix('sup'),
                ...data,
                lastVisit: '-'
            } as any);
        }
        await loadSuppliers();
        setIsModalOpen(false);
        setEditingSupplier(null);
    };

    const handleExport = async () => {
        try {
            const csvData = suppliers.map(s => ({
                Nombre: s.name,
                Contacto: s.contactName,
                Teléfono: s.phone,
                Categoría: s.category,
                Dirección: s.address || '',
                Próxima_Visita: s.nextVisitDate || ''
            }));
            await api.downloadCSV('proveedores.csv', csvData);
        } catch (error) {
            showAlert({ title: 'Error', message: 'Error al exportar proveedores', variant: 'error' });
        }
    };

    if (isLoading) {
        return (
            <div className="loading-state text-center py-12">
                <div className="spinner" style={{
                    width: 50,
                    height: 50,
                    border: '4px solid var(--color-border)',
                    borderTopColor: 'var(--color-primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                }}></div>
                <p className="text-body text-muted">Cargando proveedores...</p>
            </div>
        );
    }

    return (
        <div className="suppliers-page">
            <header className="page-header mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-page-title">Agenda de Proveedores</h1>
                    <p className="text-body-muted mt-2">Control de abastecimiento y listas de precios.</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        size="md"
                        icon={<Download size={20} />}
                        onClick={handleExport}
                    >
                        <span className="hidden-mobile">Exportar</span>
                    </Button>
                    <Button
                        variant="secondary"
                        size="md"
                        icon={<FileUp size={20} />}
                        onClick={() => setIsMagicModalOpen(true)}
                    >
                        <span className="hidden-mobile">Subir Lista</span>
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        icon={<Plus size={20} />}
                        onClick={() => setIsModalOpen(true)}
                    >
                        Nuevo Proveedor
                    </Button>
                </div>
            </header>

            {/* Controls */}
            <Card padding="md" className="mb-6">
                <div className="flex gap-4 flex-wrap">
                    <div className="search-bar flex-1 min-w-[300px]">
                        <Search className="search-icon text-muted" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar proveedor o contacto..."
                            className="form-input search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="filter-chips flex gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`chip ${selectedCategory === cat ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                {cat === 'all' ? 'Todos' : cat}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Grid */}
            <div className="supplier-grid">
                {filteredSuppliers.map(sup => (
                    <Card key={sup.id} padding="md" border hover className="supplier-card">
                        <div className="supplier-header flex justify-between items-start mb-4">
                            <span className="category-tag text-label">{sup.category}</span>
                        </div>

                        <h3 className="text-card-title mb-1">{sup.name}</h3>
                        <p className="text-small-muted flex items-center gap-2 mb-4">
                            <User size={14} /> {sup.contactName}
                        </p>

                        <div className="supplier-info space-y-3 mb-6">
                            <div className="info-row flex items-center gap-3 text-body">
                                <Phone size={16} className="text-primary" />
                                <span>{sup.phone}</span>
                            </div>
                            {sup.address && (
                                <div className="info-row flex items-center gap-3 text-small-muted">
                                    <MapPin size={16} />
                                    <span className="truncate">{sup.address}</span>
                                </div>
                            )}
                            {sup.nextVisitDate && (
                                <div className="info-row flex items-center gap-3 text-small-muted">
                                    <Calendar size={16} />
                                    <span>Próxima visita: {sup.nextVisitDate}</span>
                                </div>
                            )}
                        </div>

                        <div className="card-actions flex gap-2 pt-4 border-t">
                            <Button
                                variant="secondary"
                                size="sm"
                                fullWidth
                                onClick={() => {
                                    setEditingSupplier(sup);
                                    setIsModalOpen(true);
                                }}
                            >
                                Editar
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                fullWidth
                            >
                                Ver Compras
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {filteredSuppliers.length === 0 && (
                <Card padding="lg" className="text-center">
                    <div className="empty-state py-8">
                        <Search size={48} className="mx-auto mb-4 opacity-20" />
                        <h3 className="text-section-title text-muted mb-2">No se encontraron proveedores</h3>
                        <p className="text-body-muted">Agregá proveedores en la sección de Configuración</p>
                    </div>
                </Card>
            )}

            {/* Supplier Modal - Redesigned for Premium Experience */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="supplier-modal-content animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                        <div className="supplier-modal-header">
                            <div className="header-icon-container">
                                {editingSupplier ? <Edit2 size={28} /> : <Building2 size={28} />}
                            </div>
                            <div className="header-text">
                                <h2 className="text-h2 text-white">
                                    {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                                </h2>
                                <p className="text-small text-white opacity-80">
                                    {editingSupplier ? `Actualizando datos de ${editingSupplier.name}` : 'Registrá un nuevo socio comercial'}
                                </p>
                            </div>
                            <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="supplier-modal-form">
                            <div className="form-grid">
                                {/* Section 1: Business Info */}
                                <div className="form-section">
                                    <div className="section-title">
                                        <Briefcase size={18} className="text-primary" />
                                        <h3>Datos de Empresa</h3>
                                    </div>
                                    
                                    <div className="form-group mb-4">
                                        <label className="form-label-premium">
                                            <Building2 size={14} /> Nombre de Fantasía
                                        </label>
                                        <input name="name" className="form-input-premium" defaultValue={editingSupplier?.name} required placeholder="Ej: Vivero El Rosal" />
                                    </div>

                                    <div className="form-group mb-4">
                                        <label className="form-label-premium">
                                            <Tag size={14} /> Rubro / Categoría
                                        </label>
                                        <input name="category" className="form-input-premium" defaultValue={editingSupplier?.category} required placeholder="Ej: Flores de Corte, Insumos..." />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label-premium">
                                            <MapPin size={14} /> Dirección
                                        </label>
                                        <input name="address" className="form-input-premium" defaultValue={editingSupplier?.address} placeholder="Ej: Sarmiento 123, CABA" />
                                    </div>
                                </div>

                                {/* Section 2: Contact & Logistics */}
                                <div className="form-section">
                                    <div className="section-title">
                                        <Truck size={18} className="text-primary" />
                                        <h3>Contacto y Logística</h3>
                                    </div>

                                    <div className="form-group mb-4">
                                        <label className="form-label-premium">
                                            <User size={14} /> Nombre de Contacto
                                        </label>
                                        <input name="contactName" className="form-input-premium" defaultValue={editingSupplier?.contactName} required placeholder="Ej: Ricardo" />
                                    </div>

                                    <div className="form-group mb-4">
                                        <label className="form-label-premium">
                                            <Phone size={14} /> Teléfono
                                        </label>
                                        <input name="phone" className="form-input-premium" defaultValue={editingSupplier?.phone} required placeholder="Ej: 11-4433-2211" />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label-premium">
                                            <Calendar size={14} /> Próxima Visita
                                        </label>
                                        <input name="nextVisitDate" type="date" className="form-input-premium" defaultValue={editingSupplier?.nextVisitDate} />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions-premium mt-8">
                                <button 
                                    type="button" 
                                    className="btn-premium-secondary" 
                                    onClick={() => { setIsModalOpen(false); setEditingSupplier(null); }}
                                >
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-premium-primary">
                                    {editingSupplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Magic OCR Modal */}
            {isMagicModalOpen && (
                <div className="modal-overlay" onClick={() => setIsMagicModalOpen(false)}>
                    <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="modal-header flex justify-between items-center mb-6">
                            <h2 className="text-section-title flex items-center gap-2">
                                <Sparkles size={24} className="text-primary" />
                                Carga Mágica de Precios
                            </h2>
                            <button className="btn-icon" onClick={() => setIsMagicModalOpen(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        {!detectedChanges.length ? (
                            <div className="text-center py-8">
                                <div className="upload-area mb-6" onClick={() => document.getElementById('magic-file-input')?.click()}>
                                    <input
                                        id="magic-file-input"
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={handleMagicUpload}
                                        style={{ display: 'none' }}
                                    />
                                    {isMagicProcessing ? (
                                        <div className="text-center">
                                            <div className="spinner" style={{
                                                width: 50,
                                                height: 50,
                                                border: '4px solid var(--color-border)',
                                                borderTopColor: 'var(--color-primary)',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite',
                                                margin: '0 auto 1rem'
                                            }}></div>
                                            <p className="text-body-muted">Procesando imagen...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload size={48} className="text-muted mb-4" />
                                            <h3 className="text-card-title mb-2">Subí la lista de precios</h3>
                                            <p className="text-body-muted mb-4">
                                                Podés subir una foto o PDF de la lista de tu proveedor
                                            </p>
                                            <Button variant="primary" size="lg" icon={<Upload size={20} />}>
                                                Seleccionar Archivo
                                            </Button>
                                        </>
                                    )}
                                </div>
                                {error && (
                                    <div className="alert alert-danger flex items-center gap-2 p-4 bg-danger-light border border-danger rounded-lg">
                                        <AlertCircle size={20} />
                                        <span className="text-small">{error}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-card-title mb-4">
                                    Cambios Detectados ({detectedChanges.length})
                                </h3>
                                <div className="changes-list max-h-96 overflow-y-auto mb-6">
                                    {detectedChanges.map((change, idx) => (
                                        <div key={idx} className="change-row flex justify-between items-center p-3 border-b last:border-0">
                                            <div>
                                                <p className="font-bold text-body">{change.name}</p>
                                                <p className="text-small-muted">
                                                    ${change.oldPrice.toLocaleString()} → ${change.newPrice.toLocaleString()}
                                                </p>
                                            </div>
                                            <span className="badge badge-success">
                                                +{((change.newPrice - change.oldPrice) / change.oldPrice * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="secondary" fullWidth onClick={() => { setIsMagicModalOpen(false); setDetectedChanges([]); }}>
                                        Cancelar
                                    </Button>
                                    <Button variant="primary" fullWidth onClick={applyMagicChanges}>
                                        Aplicar Cambios
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};

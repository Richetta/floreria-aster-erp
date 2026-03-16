import { useState, useMemo, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    MessageCircle,
    CalendarDays,
    Wallet,
    Users
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CustomerModal } from '../../components/CustomerModal/CustomerModal';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import './Customers.css';

export const Customers = () => {
    const customers = useStore((state) => state.customers);
    const updateCustomer = useStore((state) => state.updateCustomer);
    const addTransaction = useStore((state) => state.addTransaction);
    const loadCustomers = useStore((state) => state.loadCustomers);


    // Load customers from backend on mount
    useEffect(() => {
        const loadData = async () => {
            await loadCustomers();
        };
        loadData();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterDebt, setFilterDebt] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [customerToEdit, setCustomerToEdit] = useState<any>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentData, setPaymentData] = useState({ customerId: '', amount: '' });

    // Advanced search logic
    const filteredCustomers = useMemo(() => {
        return customers.filter(c => {
            const matchesSearch =
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone.includes(searchTerm);

            const matchesDebt = filterDebt ? c.debtBalance > 0 : true;

            return matchesSearch && matchesDebt;
        });
    }, [customers, searchTerm, filterDebt]);

    // Format helper Date YYYY-MM-DD
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(date);
    };

    const handleEdit = (customer: any) => {
        setCustomerToEdit(customer);
        setIsModalOpen(true);
    };

    const handleNewCustomer = () => {
        setCustomerToEdit(null);
        setIsModalOpen(true);
    };

    const handleDelete = (customer: any) => {
        if (confirm(`¿Estás seguro de eliminar a ${customer.name}?`)) {
            // Implement delete when backend is ready
            alert('Función a implementar con backend');
        }
    };

    const handleCollectDebt = (customer: any) => {
        setPaymentData({ customerId: customer.id, amount: customer.debtBalance.toString() });
        setShowPaymentModal(true);
    };

    const processPayment = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(paymentData.amount);
        if (!amount || amount <= 0) return;

        const customer = customers.find(c => c.id === paymentData.customerId);
        if (!customer) return;

        // Update customer debt
        updateCustomer(customer.id, { 
            debtBalance: Math.max(0, customer.debtBalance - amount)
        });

        // Register transaction
        addTransaction({
            id: generateIdWithPrefix('t'),
            type: 'income',
            category: 'Cobro Deuda',
            amount: amount,
            date: new Date().toISOString(),
            method: 'cash',
            description: `Pago de deuda - ${customer.name}`,
            relatedId: customer.id
        });

        alert(`Se cobraron $${amount.toLocaleString()} exitosamente`);
        setShowPaymentModal(false);
        setPaymentData({ customerId: '', amount: '' });
    };

    return (
        <div className="customers-page">
            <header className="page-header mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-h1">Clientes (CRM)</h1>
                    <p className="text-body mt-2">Gestiona clientes, cobra deudas y recuerda fechas importantes.</p>
                </div>
                <button className="btn btn-primary" onClick={handleNewCustomer}>
                    <Plus size={20} />
                    <span className="hidden-mobile">Nuevo Cliente</span>
                </button>
            </header>

            <div className="inventory-controls mb-6 flex-row gap-4">
                <div className="search-bar flex-1">
                    <Search className="search-icon text-muted" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o teléfono..."
                        className="form-input search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    className={`btn filter-chip ${filterDebt ? 'active bg-danger text-white border-danger' : 'border-danger text-danger hover-danger'}`}
                    onClick={() => setFilterDebt(!filterDebt)}
                >
                    <Wallet size={18} className="mr-2" />
                    Con Deuda
                </button>
            </div>

            <div className="customers-grid">
                {filteredCustomers.map(customer => (
                    <div key={customer.id} className="card customer-card relative overflow-hidden">
                        {/* Red border accent for debt */}
                        {customer.debtBalance > 0 && <div className="debt-indicator-bar top"></div>}

                        <div className="customer-card-header mb-4">
                            <div className="avatar-large">{customer.name.charAt(0).toUpperCase()}</div>
                            <div className="customer-info-header">
                                <h3 className="text-h3">{customer.name}</h3>
                                <p className="text-small text-muted font-mono">{customer.phone}</p>
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    className="btn-icon text-muted hover-primary"
                                    onClick={() => handleEdit(customer)}
                                >
                                    <Edit2 size={18} />
                                </button>
                                <button 
                                    className="btn-icon text-muted hover-danger"
                                    onClick={() => handleDelete(customer)}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        {customer.notes && (
                            <p className="text-small text-muted italic mb-4 bg-surface p-2 rounded-md border border-border">"{customer.notes}"</p>
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-auto">
                            {/* Important Dates Module */}
                            <div className="info-block">
                                <span className="text-small text-muted flex items-center gap-1 mb-1">
                                    <CalendarDays size={14} /> Fechas
                                </span>
                                {customer.importantDateName ? (
                                    <div>
                                        <p className="font-medium text-small">{customer.importantDateName}</p>
                                        <p className="text-primary text-small font-bold">{formatDate(customer.importantDate)}</p>
                                    </div>
                                ) : (
                                    <p className="text-small text-muted opacity-50">Sin agendar</p>
                                )}
                            </div>

                            {/* Financial Module */}
                            <div className="info-block text-right border-l pl-4">
                                <span className="text-small text-muted flex items-center justify-end gap-1 mb-1">
                                    Estado <Wallet size={14} />
                                </span>
                                {customer.debtBalance > 0 ? (
                                    <div>
                                        <p className="text-danger font-bold text-h3">${customer.debtBalance.toLocaleString()}</p>
                                        <button 
                                            className="text-small text-primary underline mt-1"
                                            onClick={() => handleCollectDebt(customer)}
                                        >
                                            Cobrar deuda
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-success font-medium">Al día</p>
                                )}
                            </div>
                        </div>

                        {/* WhatsApp Quick Action */}
                        <div className="mt-4 pt-4 border-t flex justify-end">
                            <a
                                href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                className="btn btn-secondary w-full justify-center text-success border-success hover:bg-success hover:text-white transition-colors"
                            >
                                <MessageCircle size={18} className="mr-2" />
                                Enviar WhatsApp
                            </a>
                        </div>
                    </div>
                ))}
            </div>

            {filteredCustomers.length === 0 && (
                <div className="card text-center py-12">
                    <Users size={48} className="text-muted mx-auto mb-4 opacity-50" />
                    <h3 className="text-h3 mb-2">No se encontraron clientes</h3>
                    <p className="text-body text-muted">Ajusta tu búsqueda o agrega un nuevo contacto.</p>
                </div>
            )}

            {/* Customer Modal */}
            <CustomerModal 
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setCustomerToEdit(null);
                }}
                customerToEdit={customerToEdit}
            />

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="modal-content-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-h3 mb-4">Cobrar Deuda</h3>
                        <form onSubmit={processPayment}>
                            <div className="form-group mb-4">
                                <label className="form-label">Monto a cobrar</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={paymentData.amount}
                                    onChange={e => setPaymentData({...paymentData, amount: e.target.value})}
                                    min="1"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary flex-1"
                                    onClick={() => setShowPaymentModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn btn-success flex-1"
                                >
                                    Cobrar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

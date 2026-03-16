import { useState, useEffect } from 'react';
import { X, Check, User, Phone, Mail, MapPin, Calendar, ShoppingCart, DollarSign } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Customer } from '../../store/useStore';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { isValidEmail } from '../../utils/format';
import '../../pages/Customers/Customers.css';

interface CustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerToEdit?: Customer | null;
}

export const CustomerModal = ({ isOpen, onClose, customerToEdit }: CustomerModalProps) => {
    const addCustomer = useStore(state => state.addCustomer);
    const updateCustomer = useStore(state => state.updateCustomer);
    const loadCustomers = useStore(state => state.loadCustomers);
    const orders = useStore(state => state.orders);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address_street: '',
        address_number: '',
        address_floor: '',
        address_city: '',
        debtBalance: 0,
        birthday: '',
        anniversary: '',
        importantDateName: '',
        importantDate: '',
        notes: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (customerToEdit) {
            setFormData({
                name: customerToEdit.name,
                phone: customerToEdit.phone,
                email: customerToEdit.email || '',
                address_street: customerToEdit.address_street || '',
                address_number: customerToEdit.address_number || '',
                address_floor: customerToEdit.address_floor || '',
                address_city: customerToEdit.address_city || '',
                debtBalance: customerToEdit.debtBalance,
                birthday: customerToEdit.birthday || '',
                anniversary: customerToEdit.anniversary || '',
                importantDateName: customerToEdit.importantDateName || '',
                importantDate: customerToEdit.importantDate || '',
                notes: customerToEdit.notes || ''
            });
        } else {
            setFormData({
                name: '',
                phone: '',
                email: '',
                address_street: '',
                address_number: '',
                address_floor: '',
                address_city: '',
                debtBalance: 0,
                birthday: '',
                anniversary: '',
                importantDateName: '',
                importantDate: '',
                notes: ''
            });
        }
        setErrors({});
    }, [customerToEdit, isOpen]);

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name || formData.name.trim().length < 2) {
            newErrors.name = 'El nombre debe tener al menos 2 letras (ej: "María Gómez")';
        }

        if (!formData.phone || formData.phone.replace(/[^\d]/g, '').length < 10) {
            newErrors.phone = 'El teléfono debe tener 10 dígitos (ej: 1123456789)';
        }

        if (formData.email && !isValidEmail(formData.email)) {
            newErrors.email = 'El email no es válido (ej: maria@email.com)';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        if (customerToEdit) {
            await updateCustomer(customerToEdit.id, formData);
        } else {
            await addCustomer({
                id: generateIdWithPrefix('c'),
                ...formData
            });
        }
        await loadCustomers(); // Recargar desde backend
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="customer-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="text-h2">
                        {customerToEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
                    </h2>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-section">
                        <h3 className="section-title">Datos Personales</h3>

                        <div className="form-row">
                            <div className="form-group full-width">
                                <label className="form-label">
                                    <User size={16} /> Nombre Completo *
                                </label>
                                <input
                                    type="text"
                                    className={`form-input ${errors.name ? 'error' : ''}`}
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej: María Gómez"
                                />
                                {errors.name && <span className="error-text">{errors.name}</span>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">
                                    <Phone size={16} /> Teléfono *
                                </label>
                                <input
                                    type="tel"
                                    className={`form-input ${errors.phone ? 'error' : ''}`}
                                    value={formData.phone}
                                    onChange={(e) => {
                                        // Solo permitir números y guiones
                                        const value = e.target.value.replace(/[^\d-]/g, '');
                                        setFormData({ ...formData, phone: value });
                                    }}
                                    placeholder="11-2345-6789"
                                />
                                {errors.phone && <span className="error-text">{errors.phone}</span>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    <Mail size={16} /> Email
                                </label>
                                <input
                                    type="email"
                                    className={`form-input ${errors.email ? 'error' : ''}`}
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="maria@email.com"
                                />
                                {errors.email && <span className="error-text">{errors.email}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">Dirección</h3>

                        <div className="form-row">
                            <div className="form-group flex-2">
                                <label className="form-label">
                                    <MapPin size={16} /> Calle
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.address_street}
                                    onChange={e => setFormData({ ...formData, address_street: e.target.value })}
                                    placeholder="Av. Siempre Viva"
                                />
                            </div>
                            <div className="form-group" style={{ width: '80px' }}>
                                <label className="form-label">Número</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.address_number}
                                    onChange={e => setFormData({ ...formData, address_number: e.target.value })}
                                    placeholder="1234"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group" style={{ width: '100px' }}>
                                <label className="form-label">Piso/Depto</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.address_floor}
                                    onChange={e => setFormData({ ...formData, address_floor: e.target.value })}
                                    placeholder="5°A"
                                />
                            </div>
                            <div className="form-group flex-1">
                                <label className="form-label">Localidad</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.address_city}
                                    onChange={e => setFormData({ ...formData, address_city: e.target.value })}
                                    placeholder="Buenos Aires"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">Fechas Importantes</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">
                                    <Calendar size={16} /> Cumpleaños
                                </label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={formData.birthday}
                                    onChange={e => setFormData({ ...formData, birthday: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Aniversario</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={formData.anniversary}
                                    onChange={e => setFormData({ ...formData, anniversary: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Nombre de Fecha Especial</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.importantDateName}
                                    onChange={e => setFormData({ ...formData, importantDateName: e.target.value })}
                                    placeholder="Ej: Día de la Madre"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fecha Especial</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={formData.importantDate}
                                    onChange={e => setFormData({ ...formData, importantDate: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Historial de Compras */}
                    {customerToEdit && (
                        <div className="form-section">
                            <h3 className="section-title">
                                <ShoppingCart size={18} />
                                Historial de Compras
                            </h3>

                            {(() => {
                                const customerOrders = orders.filter(o =>
                                    o.customerId === customerToEdit.id ||
                                    o.customerName === customerToEdit.name
                                );
                                const totalSpent = customerOrders.reduce((sum, o) => sum + o.total, 0);

                                return customerOrders.length === 0 ? (
                                    <p className="text-muted text-center py-4">
                                        Este cliente aún no realizó compras
                                    </p>
                                ) : (
                                    <>
                                        <div className="purchase-summary mb-4">
                                            <div className="summary-stat">
                                                <DollarSign size={20} />
                                                <div>
                                                    <span className="stat-value">${totalSpent.toLocaleString()}</span>
                                                    <span className="stat-label">Total Gastado</span>
                                                </div>
                                            </div>
                                            <div className="summary-stat">
                                                <ShoppingCart size={20} />
                                                <div>
                                                    <span className="stat-value">{customerOrders.length}</span>
                                                    <span className="stat-label">Pedidos</span>
                                                </div>
                                            </div>
                                            {customerOrders.length > 0 && (
                                                <div className="summary-stat">
                                                    <Calendar size={20} />
                                                    <div>
                                                        <span className="stat-value">
                                                            {new Date(customerOrders[customerOrders.length - 1].date).toLocaleDateString()}
                                                        </span>
                                                        <span className="stat-label">Última Compra</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="purchase-history-list">
                                            <h4 className="history-title">Pedidos Realizados</h4>
                                            {customerOrders.slice(0, 10).map((order) => (
                                                <div key={order.id} className="purchase-history-item">
                                                    <div className="purchase-date">
                                                        <Calendar size={14} />
                                                        <span>{new Date(order.date).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="purchase-info">
                                                        <span className="purchase-status">{order.status}</span>
                                                        <span className="purchase-total">${order.total.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {customerOrders.length > 10 && (
                                                <p className="text-muted text-center text-small mt-2">
                                                    ... y {customerOrders.length - 10} pedidos más
                                                </p>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    <div className="form-section">
                        <h3 className="section-title">Notas</h3>
                        <textarea
                            className="form-input notes-input"
                            rows={3}
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Preferencias, comentarios, etc..."
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary">
                            <Check size={18} />
                            {customerToEdit ? 'Actualizar' : 'Crear Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

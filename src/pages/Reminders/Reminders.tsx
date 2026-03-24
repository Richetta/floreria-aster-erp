import { useState, useEffect } from 'react';
import {
    Calendar,
    DollarSign,
    Bell,
    Send,
    MessageCircle,
    Mail,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../../components/ui/Modals';
import './Reminders.css';

type ReminderType = 'birthday' | 'anniversary' | 'important_date' | 'debt';

export const Reminders = () => {
    const [activeTab, setActiveTab] = useState<'birthdays' | 'debts' | 'history'>('birthdays');
    const [birthdayReminders, setBirthdayReminders] = useState<any[]>([]);
    const [debtReminders, setDebtReminders] = useState<any[]>([]);
    const [reminderHistory, setReminderHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [daysAhead] = useState(30);
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
    const [customMessage, setCustomMessage] = useState('');

    const { alertModal, showAlert } = useModal();

    // Load data
    useEffect(() => {
        if (activeTab === 'birthdays') {
            loadBirthdayReminders();
        } else if (activeTab === 'debts') {
            loadDebtReminders();
        } else if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab]);

    const loadBirthdayReminders = async () => {
        setIsLoading(true);
        try {
            const data = await api.getBirthdayReminders(daysAhead);
            setBirthdayReminders(data.reminders);
        } catch (error) {
            console.error('Error loading birthday reminders:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadDebtReminders = async () => {
        setIsLoading(true);
        try {
            const data = await api.getDebtReminders();
            setDebtReminders(data.reminders);
        } catch (error) {
            console.error('Error loading debt reminders:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const data = await api.getReminderHistory(100);
            setReminderHistory(data);
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendWhatsApp = async (phone: string, message: string, type: ReminderType) => {
        try {
            const result = await api.sendWhatsAppReminder(phone, message, type);
            // Open WhatsApp in new tab
            window.open(result.whatsapp_url, '_blank');
            showAlert({ title: 'WhatsApp', message: 'WhatsApp abierto. Enviá el mensaje para confirmar.', variant: 'success' });
        } catch (error: any) {
            showAlert({ title: 'Error', message: 'Error: ' + error.message, variant: 'error' });
        }
    };

    const handleSendBulkWhatsApp = async () => {
        if (selectedCustomers.length === 0) {
            showAlert({ title: 'Selección requerida', message: 'Seleccioná al menos un cliente', variant: 'warning' });
            return;
        }

        const template = customMessage || 'Hola {{name}}! Te escribimos de Florería Aster para saludarte en tu día especial. 🌸';
        
        try {
            const result = await api.sendBulkReminders(selectedCustomers, template, 'whatsapp');
            showAlert({ title: 'Enviados', message: `Enviados ${result.sent} recordatorios. Fallidos: ${result.failed}`, variant: 'success' });
            setSelectedCustomers([]);
            setCustomMessage('');
        } catch (error: any) {
            showAlert({ title: 'Error', message: 'Error: ' + error.message, variant: 'error' });
        }
    };

    const toggleCustomerSelection = (customerId: string) => {
        setSelectedCustomers(prev => 
            prev.includes(customerId) 
                ? prev.filter(id => id !== customerId)
                : [...prev, customerId]
        );
    };

    const getUrgencyBadge = (urgency: string) => {
        const badges = {
            high: { class: 'badge-danger', text: 'Urgente' },
            medium: { class: 'badge-warning', text: 'Medio' },
            low: { class: 'badge-success', text: 'Normal' }
        };
        const badge = badges[urgency as keyof typeof badges];
        return <span className={`badge ${badge.class}`}>{badge.text}</span>;
    };

    const getMessageTemplate = (type: ReminderType, customerName: string, extra?: any) => {
        const templates = {
            birthday: `🎂 ¡Feliz Cumpleaños ${customerName}!

De parte de todo el equipo de Florería Aster te deseamos un día maravilloso.

🌸 ¿Querés celebrar con un ramo especial? Tenés un 10% de descuento esta semana.

¡Te esperamos!`,
            anniversary: `💍 ¡Feliz Aniversario ${customerName}!

En Florería Aster recordamos tu día especial.

🌹 Celebrá el amor con nuestras arreglos exclusivos.

¡Gracias por confiar en nosotros!`,
            debt: `Hola ${customerName},

Te recordamos que tenés un saldo pendiente de $${extra?.debt_amount || 0} en Florería Aster.

💳 Podés abonar en nuestro local o por transferencia.

¡Gracias!`,
            important_date: `📅 ¡Hola ${customerName}!

Recordamos que hoy es ${extra?.event_name || 'tu día especial'}.

🌸 En Florería Aster tenemos algo especial para vos.

¡Te esperamos!`
        };
        return templates[type] || templates.birthday;
    };

    return (
        <div className="reminders-page">
            <header className="page-header mb-6">
                <div>
                    <h1 className="text-h1">Recordatorios Automáticos</h1>
                    <p className="text-body mt-2">Gestioná cumpleaños, aniversarios y cobro de deudas</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="reminders-tabs mb-6">
                <button
                    className={`reminder-tab ${activeTab === 'birthdays' ? 'active' : ''}`}
                    onClick={() => setActiveTab('birthdays')}
                >
                    <Calendar size={18} />
                    Cumpleaños
                    {birthdayReminders.filter(r => r.is_today).length > 0 && (
                        <span className="tab-badge">{birthdayReminders.filter(r => r.is_today).length}</span>
                    )}
                </button>
                <button
                    className={`reminder-tab ${activeTab === 'debts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('debts')}
                >
                    <DollarSign size={18} />
                    Deudas
                    {debtReminders.length > 0 && (
                        <span className="tab-badge danger">{debtReminders.length}</span>
                    )}
                </button>
                <button
                    className={`reminder-tab ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    <Bell size={18} />
                    Historial
                </button>
            </div>

            {isLoading ? (
                <div className="loading-state text-center py-12">
                    <div className="spinner" style={{
                        width: 50,
                        height: 50,
                        border: '4px solid #e5e7eb',
                        borderTopColor: '#9b51e0',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 1rem'
                    }}></div>
                    <p className="text-muted">Cargando recordatorios...</p>
                </div>
            ) : (
                <>
                    {/* BIRTHDAYS TAB */}
                    {activeTab === 'birthdays' && (
                        <div className="reminders-content">
                            {/* Summary Cards */}
                            <div className="metrics-grid mb-6">
                                <div className="metric-card">
                                    <div className="metric-icon bg-primary-light">
                                        <Calendar size={24} className="text-primary" />
                                    </div>
                                    <div className="metric-data">
                                        <span className="text-small text-muted">Próximos {daysAhead} días</span>
                                        <h2 className="text-h2">{birthdayReminders.length}</h2>
                                    </div>
                                </div>
                                <div className="metric-card">
                                    <div className="metric-icon bg-success-light">
                                        <CheckCircle2 size={24} className="text-success" />
                                    </div>
                                    <div className="metric-data">
                                        <span className="text-small text-muted">Son Hoy</span>
                                        <h2 className="text-h2 text-success">{birthdayReminders.filter(r => r.is_today).length}</h2>
                                    </div>
                                </div>
                                <div className="metric-card">
                                    <div className="metric-icon bg-warning-light">
                                        <AlertCircle size={24} className="text-warning" />
                                    </div>
                                    <div className="metric-data">
                                        <span className="text-small text-muted">Esta Semana</span>
                                        <h2 className="text-h2 text-warning">{birthdayReminders.filter(r => r.is_soon).length}</h2>
                                    </div>
                                </div>
                            </div>

                            {/* Bulk Actions */}
                            {birthdayReminders.length > 1 && (
                                <div className="card mb-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Send size={20} className="text-primary" />
                                        <h3 className="text-h3">Enviar Recordatorios Masivos</h3>
                                    </div>
                                    <div className="flex gap-4 items-center flex-wrap">
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Mensaje (usá {"{{name}}"} para el nombre):</label>
                                            <textarea
                                                className="form-input"
                                                rows={2}
                                                value={customMessage}
                                                onChange={(e) => setCustomMessage(e.target.value)}
                                                placeholder="Dejá vacío para usar el mensaje por defecto"
                                            />
                                        </div>
                                        <button 
                                            className="btn btn-primary"
                                            onClick={handleSendBulkWhatsApp}
                                            disabled={selectedCustomers.length === 0}
                                        >
                                            <MessageCircle size={18} />
                                            Enviar a {selectedCustomers.length} seleccionados
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Reminders List */}
                            <div className="reminders-list">
                                {birthdayReminders.length === 0 ? (
                                    <div className="empty-state text-center py-12">
                                        <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                        <h3 className="text-h3 text-muted mb-2">Sin recordatorios</h3>
                                        <p className="text-body text-muted">No hay cumpleaños o aniversarios próximos.</p>
                                    </div>
                                ) : (
                                    birthdayReminders.map((reminder, index) => (
                                        <div key={index} className={`reminder-card ${reminder.is_today ? 'today' : ''}`}>
                                            <div className="reminder-header">
                                                <input
                                                    type="checkbox"
                                                    className="reminder-checkbox"
                                                    checked={selectedCustomers.includes(reminder.customer_id)}
                                                    onChange={() => toggleCustomerSelection(reminder.customer_id)}
                                                />
                                                <div className="reminder-icon">
                                                    {reminder.type === 'birthday' ? '🎂' : reminder.type === 'anniversary' ? '💍' : '📅'}
                                                </div>
                                                <div className="reminder-info">
                                                    <h4 className="reminder-title">{reminder.message}</h4>
                                                    <p className="reminder-date">
                                                        {reminder.is_today ? '¡Es hoy!' : 
                                                         reminder.is_soon ? `En ${reminder.days_until} días` :
                                                         `El ${new Date(reminder.date).toLocaleDateString('es-AR')}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="reminder-actions">
                                                <button
                                                    className="btn btn-success btn-sm"
                                                    onClick={() => handleSendWhatsApp(
                                                        reminder.phone,
                                                        getMessageTemplate(reminder.type as ReminderType, reminder.customer_name),
                                                        reminder.type as ReminderType
                                                    )}
                                                >
                                                    <MessageCircle size={16} />
                                                    Enviar WhatsApp
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* DEBTS TAB */}
                    {activeTab === 'debts' && (
                        <div className="reminders-content">
                            {/* Summary */}
                            <div className="card mb-6 bg-danger-light border border-danger">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <DollarSign size={32} className="text-danger" />
                                        <div>
                                            <p className="text-small text-muted">Total por Cobrar</p>
                                            <h2 className="text-h2 text-danger">
                                                ${debtReminders.reduce((sum, r) => sum + r.debt_amount, 0).toLocaleString()}
                                            </h2>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-small text-muted">{debtReminders.length} clientes</p>
                                        <p className="text-micro">
                                            Urgentes: {debtReminders.filter(r => r.urgency === 'high').length}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Debts List */}
                            <div className="reminders-list">
                                {debtReminders.length === 0 ? (
                                    <div className="empty-state text-center py-12">
                                        <CheckCircle2 size={48} className="mx-auto mb-4 text-success opacity-20" />
                                        <h3 className="text-h3 text-success mb-2">¡Excelente!</h3>
                                        <p className="text-body text-muted">No hay clientes con deuda pendiente.</p>
                                    </div>
                                ) : (
                                    debtReminders.map((reminder, index) => (
                                        <div key={index} className="reminder-card debt">
                                            <div className="reminder-header">
                                                <div className="reminder-icon">💰</div>
                                                <div className="reminder-info">
                                                    <h4 className="reminder-title">{reminder.customer_name}</h4>
                                                    <p className="reminder-date">
                                                        {reminder.total_orders} pedidos • Último: {reminder.last_order_date ? new Date(reminder.last_order_date).toLocaleDateString('es-AR') : 'N/A'}
                                                    </p>
                                                </div>
                                                <div className="reminder-amount">
                                                    <span className="text-h3 text-danger">${reminder.debt_amount.toLocaleString()}</span>
                                                    {getUrgencyBadge(reminder.urgency)}
                                                </div>
                                            </div>
                                            <div className="reminder-actions">
                                                <button
                                                    className="btn btn-success btn-sm"
                                                    onClick={() => handleSendWhatsApp(
                                                        reminder.phone,
                                                        getMessageTemplate('debt', reminder.customer_name, { debt_amount: reminder.debt_amount }),
                                                        'debt'
                                                    )}
                                                >
                                                    <MessageCircle size={16} />
                                                    Recordar por WhatsApp
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && (
                        <div className="reminders-content">
                            <div className="card">
                                <h3 className="text-h3 mb-4">Historial de Recordatorios Enviados</h3>
                                {reminderHistory.length === 0 ? (
                                    <div className="empty-state text-center py-12">
                                        <Bell size={48} className="mx-auto mb-4 opacity-20" />
                                        <h3 className="text-h3 text-muted mb-2">Sin historial</h3>
                                        <p className="text-body text-muted">No se enviaron recordatorios aún.</p>
                                    </div>
                                ) : (
                                    <div className="table-container">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Fecha</th>
                                                    <th>Cliente</th>
                                                    <th>Método</th>
                                                    <th>Mensaje</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reminderHistory.map(log => (
                                                    <tr key={log.id}>
                                                        <td className="text-micro">
                                                            {new Date(log.created_at).toLocaleDateString('es-AR', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </td>
                                                        <td>{log.customer_name}</td>
                                                        <td>
                                                            <span className={`badge ${
                                                                log.method === 'WhatsApp' ? 'badge-success' : 'badge-primary'
                                                            }`}>
                                                                {log.method === 'WhatsApp' ? <MessageCircle size={12} /> : <Mail size={12} />}
                                                                <span className="ml-1">{log.method}</span>
                                                            </span>
                                                        </td>
                                                        <td className="text-muted text-small">{log.message}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};

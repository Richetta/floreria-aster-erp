import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import './RemindersMobile.css';

type ReminderType = 'birthday' | 'anniversary' | 'important_date' | 'debt';

export const RemindersMobile = () => {
    const [activeTab, setActiveTab] = useState<'birthdays' | 'debts' | 'history'>('birthdays');
    const [birthdayReminders, setBirthdayReminders] = useState<any[]>([]);
    const [debtReminders, setDebtReminders] = useState<any[]>([]);
    const [reminderHistory, setReminderHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'birthdays') loadBirthdays();
        else if (activeTab === 'debts') loadDebts();
        else if (activeTab === 'history') loadHistory();
    }, [activeTab]);

    const loadBirthdays = async () => {
        setIsLoading(true);
        try {
            const data = await api.getBirthdayReminders(30);
            setBirthdayReminders(data.reminders || []);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const loadDebts = async () => {
        setIsLoading(true);
        try {
            const data = await api.getDebtReminders();
            setDebtReminders(data.reminders || []);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const data = await api.getReminderHistory(50);
            setReminderHistory(data || []);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const handleWhatsApp = async (phone: string, message: string, type: ReminderType) => {
        try {
            const result = await api.sendWhatsAppReminder(phone, message, type);
            window.open(result.whatsapp_url, '_blank');
        } catch (e) { console.error(e); }
    };

    const getTemplate = (type: ReminderType, name: string, extra?: any) => {
        if (type === 'debt') return `Hola ${name}, te recordamos un saldo pendiente de $${extra?.debt || 0} en Florería mi jard�n.`;
        if (type === 'birthday') return `¡Feliz Cumpleaños ${name}! 🎂 Te deseamos un gran día desde Florería mi jard�n. 🌸`;
        return `Hola ${name}, ¡feliz día especial! 🌸`;
    };

    return (
        <div className="reminders-mobile-wrapper">
            <header className="mobile-reminders-header">
                <h2>Recordatorios</h2>
                <div className="reminders-tabs">
                    <button className={activeTab === 'birthdays' ? 'active' : ''} onClick={() => setActiveTab('birthdays')}>
                        <span className="material-symbols-rounded">cake</span>
                        Eventos
                    </button>
                    <button className={activeTab === 'debts' ? 'active' : ''} onClick={() => setActiveTab('debts')}>
                        <span className="material-symbols-rounded">payments</span>
                        Deudas
                    </button>
                    <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
                        <span className="material-symbols-rounded">history</span>
                        Enviados
                    </button>
                </div>
            </header>

            <div className="reminders-feed">
                {isLoading ? (
                    <div className="loading-reminders">Cargando...</div>
                ) : (
                    activeTab === 'birthdays' ? (
                        birthdayReminders.length === 0 ? <p className="empty-rem">Sin eventos próximos</p> :
                        birthdayReminders.map((r, i) => (
                            <div key={i} className="rem-m-card event">
                                <div className="rem-m-icon">🎂</div>
                                <div className="rem-m-info">
                                    <h3>{r.customer_name}</h3>
                                    <p>{r.is_today ? '¡Es HOY!' : `En ${r.days_until} días`}</p>
                                </div>
                                <button className="rem-wa-btn" onClick={() => handleWhatsApp(r.phone, getTemplate(r.type, r.customer_name), r.type)}>
                                    <span className="material-symbols-rounded">chat</span>
                                </button>
                            </div>
                        ))
                    ) : activeTab === 'debts' ? (
                        debtReminders.length === 0 ? <p className="empty-rem">Sin deudas pendientes</p> :
                        debtReminders.map((r, i) => (
                            <div key={i} className="rem-m-card debt">
                                <div className="rem-m-icon">💰</div>
                                <div className="rem-m-info">
                                    <h3>{r.customer_name}</h3>
                                    <p>Debe: <strong>${r.debt_amount.toLocaleString()}</strong></p>
                                </div>
                                <button className="rem-wa-btn urgent" onClick={() => handleWhatsApp(r.phone, getTemplate('debt', r.customer_name, { debt: r.debt_amount }), 'debt')}>
                                    <span className="material-symbols-rounded">chat</span>
                                </button>
                            </div>
                        ))
                    ) : (
                        reminderHistory.map((h, i) => (
                            <div key={i} className="rem-m-card history">
                                <div className="rem-m-info">
                                    <h3>{h.customer_name}</h3>
                                    <p>{new Date(h.created_at).toLocaleDateString()} - {h.method}</p>
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    );
};

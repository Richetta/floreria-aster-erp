import { useState, useEffect } from 'react';
import { StickyNote, X, Plus, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '../../../store/useAuth';

export const ElPapelito = () => {
    const user = useAuth(state => state.user);
    const businessId = user?.business_id || 'default_business';
    const storageKey = `papelito_items_${businessId}`;

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [items, setItems] = useState<{id: string, text: string, checked: boolean}[]>([]);
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            try {
                setItems(JSON.parse(stored));
            } catch (e) {
                console.error(e);
            }
        }
    }, [storageKey]);

    const saveItems = (newItems: any[]) => {
        setItems(newItems);
        localStorage.setItem(storageKey, JSON.stringify(newItems));
    };

    const handleAdd = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!inputValue.trim()) return;
        
        const newItems = [...items, { id: Date.now().toString(), text: inputValue.trim(), checked: false }];
        saveItems(newItems);
        setInputValue('');
    };

    const handleToggleCheck = (id: string) => {
        const newItems = items.map(i => i.id === id ? { ...i, checked: !i.checked } : i);
        saveItems(newItems);
    };

    const handleDelete = (id: string) => {
        const newItems = items.filter(i => i.id !== id);
        saveItems(newItems);
    };

    const handleClearAll = () => {
        if (window.confirm('¿Limpiar todo el papelito?')) {
            saveItems([]);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#fef08a', // Yellow sticky color
                    border: '2px solid #facc15',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 900,
                    transition: 'transform 0.2s',
                }}
                className="hover:scale-110"
                title="Abrir El Papelito"
            >
                <div style={{ position: 'relative' }}>
                    <StickyNote size={28} color="#ca8a04" />
                    {items.filter(i => !i.checked).length > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            background: '#ef4444',
                            color: 'white',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                            {items.filter(i => !i.checked).length}
                        </span>
                    )}
                </div>
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: isMinimized ? '24px' : '24px',
            right: '24px',
            width: '320px',
            height: isMinimized ? 'auto' : '400px',
            background: '#fef9c3', // Light yellow sticky
            border: '1px solid #fef08a',
            borderRadius: '0 0 16px 16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 900,
            overflow: 'hidden',
            fontFamily: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif' // Give it a handwritten vibe
        }}>
            {/* Tape effect on top */}
            <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', width: '100px', height: '25px', background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(0,0,0,0.05)', backdropFilter: 'blur(2px)', transformOrigin: 'center', rotate: '-2deg', zIndex: 10 }}></div>

            {/* Header */}
            <div style={{
                background: '#fde047',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid #facc15',
                zIndex: 1
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <StickyNote size={18} color="#854d0e" />
                    <span style={{ fontWeight: 'bold', color: '#854d0e', fontSize: '1rem' }}>El Papelito</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setIsMinimized(!isMinimized)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#854d0e' }}>
                        {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                    </button>
                    <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#854d0e' }}>
                        <X size={18} />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Items List */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {items.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#a16207', opacity: 0.6, marginTop: '2rem', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                Anotá acá lo que te falte o te acuerdes...
                            </div>
                        ) : (
                            items.map(item => (
                                <div key={item.id} className="group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={item.checked} 
                                        onChange={() => handleToggleCheck(item.id)}
                                        style={{ width: '18px', height: '18px', accentColor: '#ca8a04', cursor: 'pointer' }}
                                    />
                                    <span style={{ flex: 1, fontSize: '1rem', color: item.checked ? '#a16207' : '#422006', textDecoration: item.checked ? 'line-through' : 'none', wordBreak: 'break-word', transition: 'all 0.2s' }}>
                                        {item.text}
                                    </span>
                                    <button 
                                        onClick={() => handleDelete(item.id)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', opacity: 0.5 }}
                                        className="hover:opacity-100"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Input Area */}
                    <div style={{ padding: '12px', background: 'rgba(253, 224, 71, 0.3)', borderTop: '1px solid #fef08a' }}>
                        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                placeholder="Escribí y tocá enter..."
                                style={{ flex: 1, padding: '8px 12px', border: '1px solid #facc15', borderRadius: '8px', background: 'white', fontSize: '0.9rem', outline: 'none', color: '#422006' }}
                                autoFocus
                            />
                            <button
                                type="submit"
                                style={{ background: '#ca8a04', color: 'white', border: 'none', borderRadius: '8px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                                <Plus size={20} />
                            </button>
                        </form>
                        {items.length > 0 && (
                            <div style={{ textAlign: 'center', marginTop: '8px' }}>
                                <button onClick={handleClearAll} style={{ background: 'none', border: 'none', color: '#a16207', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>
                                    Borrar todo el papelito
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

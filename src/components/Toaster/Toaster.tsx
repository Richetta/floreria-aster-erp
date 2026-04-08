import { useStore } from '../../store/useStore';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import './Toaster.css';

export const Toaster = () => {
    const notifications = useStore(state => state.notifications);
    const removeNotification = useStore(state => state.removeNotification);

    if (notifications.length === 0) return null;

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="toast-icon text-success" size={20} />;
            case 'error': return <AlertCircle className="toast-icon text-danger" size={20} />;
            case 'warning': return <AlertTriangle className="toast-icon text-warning" size={20} />;
            case 'info': return <Info className="toast-icon text-info" size={20} />;
            default: return null;
        }
    };

    return (
        <div className="toaster-container">
            {notifications.map(notification => (
                <div key={notification.id} className={`toast-item ${notification.type}`}>
                    <div className="toast-content">
                        {getIcon(notification.type)}
                        <span className="toast-message">{notification.message}</span>
                    </div>
                    <button 
                        className="toast-close"
                        onClick={() => removeNotification(notification.id)}
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
};

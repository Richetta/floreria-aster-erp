import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import './Modals.css';

// ============================================
// CONFIRM MODAL — Replaces native confirm()
// ============================================

export interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
    onCancel: () => void;
}

const variantConfig = {
    danger: { icon: AlertCircle, color: 'var(--color-danger)', btnClass: 'btn-danger' },
    warning: { icon: AlertTriangle, color: 'var(--color-warning)', btnClass: 'btn-warning' },
    info: { icon: Info, color: 'var(--color-primary)', btnClass: 'btn-primary' },
    success: { icon: CheckCircle, color: 'var(--color-success)', btnClass: 'btn-success' },
};

export const ConfirmModal = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'warning',
    onConfirm,
    onCancel,
}: ConfirmModalProps) => {
    if (!isOpen) return null;

    const config = variantConfig[variant];
    const Icon = config.icon;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
                <div className="modal-confirm-icon" style={{ color: config.color }}>
                    <Icon size={48} />
                </div>
                <h2 className="modal-confirm-title">{title}</h2>
                <p className="modal-confirm-message">{message}</p>
                <div className="modal-confirm-actions">
                    <button className="btn btn-secondary" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button className={`btn ${config.btnClass}`} onClick={onConfirm}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ALERT MODAL — Replaces native alert()
// ============================================

export interface AlertModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'success' | 'warning' | 'error' | 'info';
    onClose: () => void;
}

const alertVariantConfig = {
    success: { icon: CheckCircle, color: 'var(--color-success)' },
    warning: { icon: AlertTriangle, color: 'var(--color-warning)' },
    error: { icon: AlertCircle, color: 'var(--color-danger)' },
    info: { icon: Info, color: 'var(--color-primary)' },
};

export const AlertModal = ({
    isOpen,
    title,
    message,
    variant = 'info',
    onClose,
}: AlertModalProps) => {
    if (!isOpen) return null;

    const cfg = alertVariantConfig[variant];
    const Icon = cfg.icon;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>
                    <X size={20} />
                </button>
                <div className="modal-confirm-icon" style={{ color: cfg.color }}>
                    <Icon size={48} />
                </div>
                <h2 className="modal-confirm-title">{title}</h2>
                <p className="modal-confirm-message">{message}</p>
                <div className="modal-confirm-actions">
                    <button className="btn btn-primary" onClick={onClose}>
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};

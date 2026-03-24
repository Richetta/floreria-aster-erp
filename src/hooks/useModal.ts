import { useState, useCallback } from 'react';

// ============================================
// useModal Hook — Promise-based modal API
// ============================================

interface AlertOptions {
    title: string;
    message: string;
    variant?: 'success' | 'warning' | 'error' | 'info';
}

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
}

interface ModalState {
    alertModal: (AlertOptions & { isOpen: boolean; onClose: () => void }) | null;
    confirmModal: (ConfirmOptions & { isOpen: boolean; onConfirm: () => void; onCancel: () => void }) | null;
}

export function useModal() {
    const [state, setState] = useState<ModalState>({
        alertModal: null,
        confirmModal: null,
    });

    const showAlert = useCallback((opts: AlertOptions): Promise<void> => {
        return new Promise((resolve) => {
            setState(prev => ({
                ...prev,
                alertModal: {
                    ...opts,
                    isOpen: true,
                    onClose: () => {
                        setState(prev => ({ ...prev, alertModal: null }));
                        resolve();
                    },
                },
            }));
        });
    }, []);

    const showConfirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setState(prev => ({
                ...prev,
                confirmModal: {
                    ...opts,
                    isOpen: true,
                    onConfirm: () => {
                        setState(prev => ({ ...prev, confirmModal: null }));
                        resolve(true);
                    },
                    onCancel: () => {
                        setState(prev => ({ ...prev, confirmModal: null }));
                        resolve(false);
                    },
                },
            }));
        });
    }, []);

    return {
        alertModal: state.alertModal,
        confirmModal: state.confirmModal,
        showAlert,
        showConfirm,
    };
}

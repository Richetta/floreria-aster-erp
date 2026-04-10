import { useState, useMemo, useEffect } from 'react';
import {
    Plus, Search, Clock, Truck, X, FileText, Banknote, UserCircle,
    MapPin, CalendarDays, LayoutGrid, Copy, Package, Clock9, Check,
    MessageSquare, CreditCard, DollarSign, ArrowRight, ChevronLeft,
    ChevronRight, Trash2, Calendar, Filter, Eye, Archive, AlertCircle
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Order } from '../../store/useStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import './Orders.css';

export const OrdersDesktop = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const orders = useStore((state) => state.orders);
    const updateOrderStatus = useStore((state) => state.updateOrderStatus);
    const loadOrders = useStore((state) => state.loadOrders);
    const loadCustomers = useStore((state) => state.loadCustomers);
    const deleteOrder = useStore((state) => state.deleteOrder);
    const updateOrder = useStore((state) => state.updateOrder);
    const addNotification = useStore((state) => state.addNotification);

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([loadOrders(), loadCustomers()]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [timeFilter, setTimeFilter] = useState<'hoy' | 'esta-semana' | 'este-mes' | 'todos' | 'mes-especifico'>('esta-semana');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showPaymentPanel, setShowPaymentPanel] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Order>>({});
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'kanban' | 'calendar'>('kanban');
    const [showFilters, setShowFilters] = useState(false);
    const [statusFilters, setStatusFilters] = useState<string[]>([]);
    const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'pickup' | 'delivery'>('all');

    useEffect(() => {
        if (isLoading) return;
        const state = location.state as { orderId?: string } | null;
        if (state?.orderId && orders.length > 0) {
            const order = orders.find(o => o.id === state.orderId);
            if (order) {
                setSelectedOrder(order);
                window.history.replaceState({}, document.title);
            }
        }
    }, [isLoading, orders, location.state]);

    const columns: { id: Order['status'], label: string, icon: any, color: string, bg: string }[] = useMemo(() => [
        { id: 'pending', label: 'Pendiente', icon: Clock, color: '#EF4444', bg: '#FEF2F2' },
        { id: 'assembling', label: 'En Armado', icon: FileText, color: '#A855F7', bg: '#FAF5FF' },
        { id: 'ready', label: 'Listo', icon: Check, color: '#3B82F6', bg: '#EFF6FF' },
        { id: 'out_for_delivery', label: 'En Camino', icon: Truck, color: '#F59E0B', bg: '#FFFBEB' },
        { id: 'delivered', label: 'Entregado', icon: Check, color: '#10B981', bg: '#ECFDF5' },
        { id: 'cancelled', label: 'Cancelado', icon: X, color: '#6B7280', bg: '#F9FAFB' },
        { id: 'archived', label: 'Archivado', icon: Archive, color: '#6B7280', bg: '#F9FAFB' }
    ], []);

    const toggleStatusFilter = (status: string) => {
        setStatusFilters(prev =>
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        );
    };

    const filteredOrders = useMemo(() => {
        let base = (orders || []).filter(o =>
            o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.id.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Status filters
        if (statusFilters.length > 0) {
            base = base.filter(o => statusFilters.includes(o.status));
        }

        // Delivery method filter
        if (deliveryFilter !== 'all') {
            base = base.filter(o => o.deliveryMethod === deliveryFilter);
        }

        // Time filters
        if (timeFilter !== 'todos') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            base = base.filter(o => {
                const oDate = new Date(o.date);
                const oDateClear = new Date(o.date);
                oDateClear.setHours(0, 0, 0, 0);

                if (timeFilter === 'hoy') {
                    return oDateClear.getTime() === today.getTime();
                }
                if (timeFilter === 'esta-semana') {
                    const first = today.getDate() - today.getDay();
                    const last = first + 6;
                    const firstDay = new Date(today.setDate(first));
                    const lastDay = new Date(today.setDate(last));
                    firstDay.setHours(0, 0, 0, 0);
                    lastDay.setHours(23, 59, 59, 999);
                    return oDate >= firstDay && oDate <= lastDay;
                }
                if (timeFilter === 'este-mes') {
                    return oDate.getMonth() === new Date().getMonth() && oDate.getFullYear() === new Date().getFullYear();
                }
                if (timeFilter === 'mes-especifico') {
                    return oDate.getMonth() === selectedMonth && oDate.getFullYear() === new Date().getFullYear();
                }
                return true;
            });
        }

        if (!showArchived) {
            base = base.filter(o => o.status !== 'cancelled' && o.status !== 'archived');
        }

        return base;
    }, [orders, searchTerm, timeFilter, selectedMonth, showArchived, statusFilters, deliveryFilter]);

    const handleDragStart = (e: React.DragEvent, orderId: string) => {
        setDraggedOrderId(orderId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, newStatus: Order['status']) => {
        e.preventDefault();
        if (draggedOrderId) {
            updateOrderStatus(draggedOrderId, newStatus);
            if (selectedOrder && selectedOrder.id === draggedOrderId) {
                setSelectedOrder({ ...selectedOrder, status: newStatus });
            }
        }
        setDraggedOrderId(null);
    };

    const timeSlotLabel = (slot?: string) => {
        if (slot === 'morning') return 'Mañana';
        if (slot === 'afternoon') return 'Tarde';
        if (slot === 'evening') return 'Noche';
        return 'Todo el día';
    };

    const formatDeliveryDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
        } catch {
            return dateStr;
        }
    };

// ... (continuará con el render del componente)
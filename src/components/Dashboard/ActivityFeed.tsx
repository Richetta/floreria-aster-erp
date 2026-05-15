import { useState, useEffect } from 'react';
import { ApiClient } from '../../services/api';
import { Clock, User, ArrowRight, Package, ShoppingCart, UserPlus, DollarSign } from 'lucide-react';

const api = new ApiClient();

export const ActivityFeed = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const data = await api.getActivity();
        setActivities(data);
      } catch (error) {
        console.error('Error loading activity:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadActivity();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'ORDER_CREATED': return <Package className="text-primary" size={16} />;
      case 'SALE_CREATED': return <ShoppingCart className="text-success" size={16} />;
      case 'ORDER_UPDATED': return <ArrowRight className="text-warning" size={16} />;
      case 'USER_INVITED': return <UserPlus className="text-info" size={16} />;
      case 'PAYMENT_REGISTERED': return <DollarSign className="text-success" size={16} />;
      default: return <Clock className="text-muted" size={16} />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;

    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    return date.toLocaleDateString();
  };

  if (isLoading) return <div className="p-4 text-center text-muted italic">Cargando actividad...</div>;

  return (
    <div className="activity-feed">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={18} className="text-primary" />
        <h3 className="text-h3">Actividad del Equipo</h3>
      </div>
      
      <div className="activity-list space-y-4">
        {activities.length === 0 ? (
          <p className="text-center text-muted py-4">No hay actividad reciente.</p>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="activity-item flex gap-3 p-2 hover:bg-surface-hover rounded-lg transition-colors">
              <div className="activity-icon-box shrink-0 mt-1">
                {getIcon(act.action_type)}
              </div>
              <div className="activity-content flex-1">
                <p className="text-small">
                  <strong>{act.user_name || 'Alguien'}</strong> {act.description}
                </p>
                <span className="text-micro text-muted flex items-center gap-1 mt-1">
                   {formatTime(act.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { Send, MessageSquare, Trash2, Clock, User } from 'lucide-react';
import { ApiClient } from '../../services/api';
import type { InternalComment } from '../../types';
import { useAuth } from '../../store/useAuth';
import './Comments.css';

const api = new ApiClient();

interface CommentSectionProps {
  entityType: 'order' | 'customer' | 'product';
  entityId: string;
  title?: string;
}

export const CommentSection = ({ entityType, entityId, title = 'Notas Internas' }: CommentSectionProps) => {
  const [comments, setComments] = useState<InternalComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const loadComments = async () => {
    try {
      setIsLoading(true);
      const data = await api.getComments(entityType, entityId);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) {
      loadComments();
    }
  }, [entityId, entityType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setIsSubmitting(true);
      await api.createComment({
        entity_type: entityType,
        entity_id: entityId,
        content: newComment.trim()
      });
      setNewComment('');
      loadComments();
      alert('Comentario enviado');
    } catch (error: any) {
      alert(error.message || 'Error al enviar comentario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    try {
      await api.deleteComment(id);
      setComments(comments.filter(c => c.id !== id));
      alert('Comentario eliminado');
    } catch (error) {
      alert('Error al eliminar comentario');
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="comment-section">
      <div className="comment-section-header">
        <MessageSquare size={18} />
        <h3>{title}</h3>
      </div>

      <div className="comment-list custom-scrollbar">
        {isLoading ? (
          <div className="comment-loading">Cargando notas...</div>
        ) : comments.length === 0 ? (
          <div className="comment-empty">No hay notas internas aún.</div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className={`comment-item ${comment.user_id === user?.id ? 'is-me' : ''}`}>
              <div className="comment-avatar">
                {comment.user_name?.charAt(0).toUpperCase() || <User size={14} />}
              </div>
              <div className="comment-bubble">
                <div className="comment-meta">
                  <span className="comment-author">{comment.user_name}</span>
                  <span className="comment-date"><Clock size={10} /> {formatTime(comment.created_at)}</span>
                </div>
                <div className="comment-content">{comment.content}</div>
                {(comment.user_id === user?.id || user?.role === 'owner') && (
                  <button className="comment-delete" onClick={() => handleDelete(comment.id)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form className="comment-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Escribir una nota interna..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={isSubmitting}
        />
        <button type="submit" disabled={isSubmitting || !newComment.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

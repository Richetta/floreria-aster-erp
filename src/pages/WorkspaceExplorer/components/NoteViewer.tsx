import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Sparkles, AlignLeft, Check } from 'lucide-react';
import type { VFSItem } from '../useWorkspaceExplorer';

interface NoteViewerProps {
  file: VFSItem;
  onClose: () => void;
  onSaveChanges: (content: string) => Promise<void> | void;
}

export const NoteViewer: React.FC<NoteViewerProps> = ({
  file,
  onClose,
  onSaveChanges,
}) => {
  const [content, setContent] = useState<string>('');
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showSavedSuccess, setShowSavedSuccess] = useState<boolean>(false);

  // Sync content with file data on load
  useEffect(() => {
    if (file && file.customData) {
      setContent(file.customData.content || '');
      setHasChanges(false);
      setShowSavedSuccess(false);
    }
  }, [file]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setHasChanges(true);
    if (showSavedSuccess) setShowSavedSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveChanges(content);
      setHasChanges(false);
      setShowSavedSuccess(true);
      setTimeout(() => {
        setShowSavedSuccess(false);
      }, 3000);
    } catch (e) {
      console.error('Failed to save note changes:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate text statistics
  const characterCount = content.length;
  const wordCount = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
  const lineCount = content.split('\n').length;

  return (
    <div className="note-viewer-container fade-in">
      {/* Header Panel */}
      <div className="note-header">
        <div className="note-title-area">
          <div className="note-icon-lead">
            <FileText size={22} className="text-amber-500 animate-pulse-subtle" />
          </div>
          <div>
            <div className="note-filename-row">
              <h3 className="note-filename">{file.name}</h3>
              <span className="note-badge">
                <Sparkles size={10} className="glow-icon" /> Documento de Texto
              </span>
            </div>
            <p className="note-description">Modo de redacción libre y notas rápidas del negocio.</p>
          </div>
        </div>

        <div className="note-actions">
          {hasChanges && (
            <span className="unsaved-indicator">Cambios sin guardar</span>
          )}
          
          <button
            onClick={handleSave}
            className={`note-btn btn-save ${showSavedSuccess ? 'btn-saved-active' : ''}`}
            disabled={isSaving}
            title="Guardar los cambios en el archivo"
          >
            {showSavedSuccess ? <Check size={16} /> : <Save size={16} />}
            <span className="btn-text">{isSaving ? 'Guardando...' : showSavedSuccess ? '¡Guardado!' : 'Guardar'}</span>
          </button>

          <button
            onClick={onClose}
            className="note-btn btn-close-note"
            title="Cerrar nota y regresar a carpetas"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Notepad Notepad Sheet Editor */}
      <div className="notepad-sheet-wrapper">
        <div className="notepad-sheet">
          <div className="notepad-ring-holes">
            <span className="ring-hole"></span>
            <span className="ring-hole"></span>
            <span className="ring-hole"></span>
            <span className="ring-hole"></span>
            <span className="ring-hole"></span>
            <span className="ring-hole"></span>
            <span className="ring-hole"></span>
            <span className="ring-hole"></span>
          </div>
          <div className="notepad-paper-content">
            <textarea
              className="notepad-textarea"
              value={content}
              onChange={handleTextChange}
              placeholder="Comienza a escribir tus notas, apuntes o lista de tareas aquí..."
              spellCheck="false"
              autoFocus
            />
          </div>
        </div>
      </div>

      {/* Footer statistics bar */}
      <div className="note-footer">
        <div className="footer-stat">
          <AlignLeft size={14} className="text-gray-400" />
          <span>Palabras: <strong>{wordCount}</strong></span>
          <span className="separator">|</span>
          <span>Caracteres: <strong>{characterCount}</strong></span>
          <span className="separator">|</span>
          <span>Líneas: <strong>{lineCount}</strong></span>
        </div>
        <div className="footer-status-tag border-amber-200 bg-amber-50 text-amber-700">
          Editable • Auto-guardado local disponible
        </div>
      </div>
    </div>
  );
};
export default NoteViewer;

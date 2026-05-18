import React from 'react';
import { Folder, FileSpreadsheet, ChevronRight, HelpCircle } from 'lucide-react';
import type { VFSItem } from '../useWorkspaceExplorer';

interface VFSBrowserProps {
  items: VFSItem[];
  onFolderClick: (folderId: string) => void;
  onFileClick: (fileId: string) => void;
}

export const VFSBrowser: React.FC<VFSBrowserProps> = ({
  items,
  onFolderClick,
  onFileClick,
}) => {
  if (items.length === 0) {
    return (
      <div className="vfs-empty-state">
        <HelpCircle size={48} className="text-gray-400" />
        <p className="empty-text">No se encontraron carpetas ni archivos aquí.</p>
        <p className="empty-subtext">Intenta cambiar la búsqueda o volver a la raíz.</p>
      </div>
    );
  }

  const folders = items.filter(item => item.type === 'folder');
  const files = items.filter(item => item.type === 'file');

  return (
    <div className="vfs-browser">
      {/* Virtual Folders Grid */}
      {folders.length > 0 && (
        <div className="vfs-section">
          <h3 className="section-title">Carpetas de Negocio</h3>
          <div className="vfs-grid folders-grid">
            {folders.map(folder => (
              <div
                key={folder.id}
                className="vfs-card folder-card"
                style={{ '--folder-bg': folder.color || '#f1f5f9' } as React.CSSProperties}
                onClick={() => onFolderClick(folder.id)}
                onDoubleClick={() => onFolderClick(folder.id)}
                title={`Abrir carpeta ${folder.name}`}
              >
                <div className="folder-icon-wrapper">
                  <Folder className="folder-icon" size={32} />
                </div>
                <div className="folder-info">
                  <h4 className="item-name">{folder.name}</h4>
                  {folder.description && (
                    <p className="item-desc">{folder.description}</p>
                  )}
                </div>
                <ChevronRight className="arrow-icon" size={16} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Virtual Files Grid */}
      {files.length > 0 && (
        <div className="vfs-section">
          <h3 className="section-title">Archivos de Planillas (.xlsx)</h3>
          <div className="vfs-grid files-grid">
            {files.map(file => (
              <div
                key={file.id}
                className="vfs-card file-card"
                onClick={() => onFileClick(file.id)}
                onDoubleClick={() => onFileClick(file.id)}
                title={`Abrir planilla ${file.name}`}
              >
                <div className="file-icon-wrapper">
                  <FileSpreadsheet className="file-icon" size={28} />
                </div>
                <div className="file-info">
                  <h4 className="item-name">{file.name}</h4>
                  {file.description && (
                    <p className="item-desc">{file.description}</p>
                  )}
                </div>
                <span className="file-badge">Planilla</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

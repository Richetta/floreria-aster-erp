import React from 'react';
import { useWorkspaceExplorer } from './useWorkspaceExplorer';
import { VFSBrowser } from './components/VFSBrowser';
import { SpreadsheetViewer } from './components/SpreadsheetViewer';
import { NoteViewer } from './components/NoteViewer';
import { DocxViewer } from './components/DocxViewer';
import { Search, ArrowLeft, Sparkles, FolderOpen, History, X, AlertTriangle, AlertCircle, ShieldAlert, Loader } from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import { useStore } from '../../store/useStore';
import { api } from '../../services/api';
import './WorkspaceExplorer.css';

export const WorkspaceExplorer: React.FC = () => {
  const {
    currentFolderId,
    activeFileId,
    searchQuery,
    setSearchQuery,
    navigateToFolder,
    openFile,
    closeFile,
    breadcrumbs,
    currentItems,
    allItems,
    goBack,
    activeFile,
    spreadsheetColumns,
    spreadsheetRows,
    totalCount,
    filteredCount,
    isLoading,
    createFolder,
    createExcelFile,
    createNoteFile,
    saveNoteChanges,
    saveDocxChanges,
    moveItem,
    renameItem,
    archiveItem,
    deleteItem,
    saveSpreadsheetChanges,
  } = useWorkspaceExplorer();

  const [showHistory, setShowHistory] = React.useState(false);
  const [auditLogs, setAuditLogs] = React.useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);
  const [rollbackTarget, setRollbackTarget] = React.useState<any | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = React.useState(false);
  const [rollbackError, setRollbackError] = React.useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = React.useState(false);
  
  const { user } = useAuth();
  const store = useStore();
  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner';

  const fetchAuditLogs = async () => {
    setIsHistoryLoading(true);
    try {
      const logs = await api.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  React.useEffect(() => {
    if (showHistory) {
      fetchAuditLogs();
    }
  }, [showHistory]);

  const handleRollback = async (log: any) => {
    setRollbackTarget(log);
    setRollbackError(null);
    setShowRollbackConfirm(true);
  };

  const confirmRollback = async () => {
    if (!rollbackTarget) return;
    setIsRollingBack(true);
    setRollbackError(null);
    try {
      await api.rollbackAuditLog(rollbackTarget.id);
      setShowRollbackConfirm(false);
      setRollbackTarget(null);
      await fetchAuditLogs();
      
      // Reload relevant stores to sync visual workspace tables
      if (activeFile) {
        if (activeFile.entity === 'products') {
          await store.loadProducts();
          await store.loadCategories(true);
        } else if (activeFile.entity === 'categories') {
          await store.loadCategories(true);
        } else if (activeFile.entity === 'customers') {
          await store.loadCustomers();
        } else if (activeFile.entity === 'suppliers') {
          await store.loadSuppliers();
        } else if (activeFile.entity === 'orders') {
          await store.loadOrders();
        }
      } else {
        await store.loadProducts();
        await store.loadCategories(true);
        await store.loadCustomers();
        await store.loadSuppliers();
      }
    } catch (err: any) {
      console.error('Rollback error:', err);
      setRollbackError(err.message || 'Error al intentar revertir el cambio.');
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div className="workspace-explorer-container fade-in">
      {/* Premium Banner / Header */}
      <header className="workspace-header">
        <div className="workspace-title-section">
          <div className="workspace-icon-bg animate-pulse-subtle">
            <FolderOpen className="workspace-main-icon" size={24} />
          </div>
          <div>
            <div className="workspace-badge-row">
              <h1 className="workspace-title">Explorador de Negocios</h1>
              <span className="workspace-beta-badge">
                <Sparkles size={10} className="glow-icon" /> BETA
              </span>
            </div>
            <p className="workspace-subtitle">
              Navegá los datos reales de tu florería de forma simple y familiar, como si fueran carpetas y planillas de tu PC.
            </p>
          </div>
        </div>

        {/* Global Directory Search (Only visible when no file is open) */}
        {!activeFileId && (
          <div className="workspace-search-bar">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Buscar carpetas y planillas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="workspace-search-input"
            />
            {searchQuery && (
              <button 
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                &times;
              </button>
            )}
          </div>
        )}
      </header>

      {/* Navigation Toolbar (Breadcrumbs & Back button) */}
      <div className="workspace-toolbar">
        <div className="breadcrumbs-wrapper">
          {currentFolderId !== 'root' || activeFileId ? (
            <button 
              onClick={goBack} 
              className="btn-back-dir"
              title="Volver atrás"
            >
              <ArrowLeft size={16} />
              <span>Atrás</span>
            </button>
          ) : null}

          <nav className="breadcrumbs" aria-label="Navegación del explorador">
            {breadcrumbs.map((bc, index) => {
              const isLast = index === breadcrumbs.length - 1 && !activeFileId;
              return (
                <React.Fragment key={bc.id}>
                  {index > 0 && <span className="breadcrumb-separator">/</span>}
                  <button
                    onClick={() => navigateToFolder(bc.id)}
                    className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                    disabled={isLast}
                  >
                    {index === 0 ? '📁 ' : ''}
                    {bc.name}
                  </button>
                </React.Fragment>
              );
            })}

            {activeFile && (
              <>
                <span className="breadcrumb-separator">/</span>
                <span className="breadcrumb-item active filename-crumb">
                  📄 {activeFile.name}
                </span>
              </>
            )}
          </nav>
        </div>

        <div className="toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!activeFileId && searchQuery && (
            <div className="search-stats">
              Encontrados: <strong>{currentItems.length}</strong> elementos
            </div>
          )}

          <button 
            onClick={() => setShowHistory(true)}
            className="btn-history-trigger"
            title="Ver Historial de Cambios"
            style={{
              background: 'none',
              border: '1px solid var(--explorer-border)',
              color: 'var(--explorer-text-secondary)',
              padding: '0.35rem 0.6rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'white',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
          >
            <History size={15} />
            <span>Historial</span>
          </button>
        </div>
      </div>

      {/* Dynamic Content Area */}
      <main className="workspace-main-content">
        {activeFile ? (
          activeFile.name.toLowerCase().endsWith('.docx') ? (
            <DocxViewer
              file={activeFile}
              onClose={closeFile}
              onSaveChanges={async (updatedData) => {
                await saveDocxChanges(activeFile.id, updatedData);
              }}
            />
          ) : activeFile.name.toLowerCase().endsWith('.txt') ? (
            <NoteViewer
              file={activeFile}
              onClose={closeFile}
              onSaveChanges={async (content) => {
                await saveNoteChanges(activeFile.id, content);
              }}
            />
          ) : (
            <SpreadsheetViewer
              file={activeFile}
              columns={spreadsheetColumns}
              rows={spreadsheetRows}
              onClose={closeFile}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              totalCount={totalCount}
              filteredCount={filteredCount}
              isLoading={isLoading}
              onSaveChanges={saveSpreadsheetChanges}
            />
          )
        ) : (
          <VFSBrowser
            items={currentItems}
            allItems={allItems}
            currentFolderId={currentFolderId}
            onFolderClick={navigateToFolder}
            onFileClick={openFile}
            onCreateFolder={createFolder}
            onCreateExcelFile={createExcelFile}
            onCreateNoteFile={createNoteFile}
            onMoveItem={moveItem}
            onRenameItem={renameItem}
            onArchiveItem={archiveItem}
            onDeleteItem={deleteItem}
          />
        )}
      </main>
      {/* Glassmorphic Sidebar Drawer for Audit Logs */}
      {showHistory && (
        <div className="history-drawer-overlay" onClick={() => setShowHistory(false)}>
          <div className="history-drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title-area">
                <History className="drawer-header-icon" size={20} />
                <h3>Historial de Cambios</h3>
              </div>
              <button className="drawer-close-btn" onClick={() => setShowHistory(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body">
              <p className="drawer-subtitle">
                Últimos 20 cambios realizados en los productos, categorías, clientes y proveedores.
              </p>

              {isHistoryLoading ? (
                <div className="drawer-loading">
                  <div className="spinner"></div>
                  <span>Cargando historial...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="drawer-empty">
                  <span>No hay cambios registrados en este local.</span>
                </div>
              ) : (
                <div className="audit-logs-list">
                  {auditLogs.map((log) => {
                    const dateStr = new Date(log.created_at).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    // Translate action types
                    const actionLabels: Record<string, string> = {
                      create_product: 'Producto creado',
                      update_product: 'Producto modificado',
                      delete_product: 'Producto eliminado',
                      create_category: 'Categoría creada',
                      update_category: 'Categoría modificada',
                      delete_category: 'Categoría eliminada',
                      create_customer: 'Cliente creado',
                      update_customer: 'Cliente modificado',
                      delete_customer: 'Cliente eliminado',
                      create_supplier: 'Proveedor creado',
                      update_supplier: 'Proveedor modificado',
                      delete_supplier: 'Proveedor eliminado'
                    };

                    const actionLabel = actionLabels[log.action] || log.action;
                    const entityName = log.details?.name || `ID: ${log.entity_id.substring(0, 8)}...`;
                    
                    // Render description of fields updated
                    const changesDesc = [];
                    if (log.action.startsWith('update_') && log.details?.new_values) {
                      for (const [key, val] of Object.entries(log.details.new_values)) {
                        const oldVal = log.details.old_values?.[key];
                        changesDesc.push(`${key}: "${oldVal ?? ''}" → "${val}"`);
                      }
                    }

                    return (
                      <div key={log.id} className="audit-log-card">
                        <div className="log-header">
                          <span className={`log-badge badge-${log.action.split('_')[0]}`}>
                            {actionLabel}
                          </span>
                          <span className="log-time">{dateStr}</span>
                        </div>
                        <div className="log-entity">
                          <strong>{entityName}</strong>
                        </div>
                        {changesDesc.length > 0 && (
                          <div className="log-changes">
                            {changesDesc.map((desc, idx) => (
                              <div key={idx} className="change-item">{desc}</div>
                            ))}
                          </div>
                        )}
                        <div className="log-meta">
                          <span>Por: {log.user_name || log.user_email || 'Sistema'}</span>
                        </div>
                        <div className="log-actions">
                          {isAdminOrOwner ? (
                            <button
                              onClick={() => handleRollback(log)}
                              className="btn-rollback-action"
                              title="Revertir este cambio y restaurar valores anteriores"
                            >
                              Revertir
                            </button>
                          ) : (
                            <span className="rollback-unauthorized" title="Se requiere rol de Administrador o Dueño">
                              Solo lectura
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warning Confirmation Modal for Rollbacks */}
      {showRollbackConfirm && rollbackTarget && (
        <div className="rollback-modal-overlay" onClick={() => setShowRollbackConfirm(false)}>
          <div className="rollback-modal-content" onClick={e => e.stopPropagation()}>
            <div className="rollback-modal-header text-danger">
              <ShieldAlert size={28} />
              <h2>¿Confirmar Reversión de Cambio?</h2>
            </div>
            <div className="rollback-modal-body">
              <p className="warning-text">
                Estás a punto de modificar directamente la base de datos de producción restaurando un estado anterior.
              </p>
              
              <div className="rollback-details-box">
                <div className="details-row">
                  <span>Acción original:</span>
                  <strong>
                    {rollbackTarget.action.startsWith('create_') ? 'Creación de' :
                     rollbackTarget.action.startsWith('update_') ? 'Modificación de' : 'Eliminación de'}{' '}
                    {rollbackTarget.entity_type === 'products' ? 'Producto' :
                     rollbackTarget.entity_type === 'categories' ? 'Categoría' :
                     rollbackTarget.entity_type === 'customers' ? 'Cliente' : 'Proveedor'}
                  </strong>
                </div>
                <div className="details-row">
                  <span>Elemento:</span>
                  <strong>{rollbackTarget.details?.name || rollbackTarget.entity_id}</strong>
                </div>
                <div className="details-row">
                  <span>Realizado por:</span>
                  <strong>{rollbackTarget.user_name || rollbackTarget.user_email}</strong>
                </div>
                <div className="details-row">
                  <span>Fecha:</span>
                  <strong>{new Date(rollbackTarget.created_at).toLocaleString()}</strong>
                </div>
              </div>

              <div className="warning-callout">
                <AlertTriangle size={16} />
                <span>
                  {rollbackTarget.action.startsWith('create_') && 
                    'Esta acción dará de baja (marcará como inactivo/eliminado) este elemento.'}
                  {rollbackTarget.action.startsWith('update_') && 
                    'Esta acción sobreescribirá los valores actuales con los valores anteriores.'}
                  {rollbackTarget.action.startsWith('delete_') && 
                    'Esta acción restaurará el elemento eliminado y lo volverá a activar.'}
                </span>
              </div>

              {rollbackError && (
                <div className="rollback-error-message">
                  <AlertCircle size={16} />
                  <span>{rollbackError}</span>
                </div>
              )}
            </div>
            <div className="rollback-modal-actions">
              <button 
                className="btn-rollback-cancel" 
                onClick={() => setShowRollbackConfirm(false)}
                disabled={isRollingBack}
              >
                Cancelar
              </button>
              <button 
                className="btn-rollback-confirm" 
                onClick={confirmRollback}
                disabled={isRollingBack}
              >
                {isRollingBack ? (
                  <>
                    <Loader size={16} className="spinner" />
                    <span>Revirtiendo...</span>
                  </>
                ) : (
                  <span>Sí, Revertir Cambio</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default WorkspaceExplorer;

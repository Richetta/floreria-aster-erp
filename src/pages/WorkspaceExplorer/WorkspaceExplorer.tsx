import React from 'react';
import { createPortal } from 'react-dom';
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

const translateField = (key: string): string => {
  const translations: Record<string, string> = {
    name: 'Nombre',
    code: 'Código',
    barcode: 'Código de Barras',
    description: 'Descripción',
    cost: 'Costo',
    price: 'Precio',
    stock_quantity: 'Stock',
    min_stock: 'Stock Mínimo',
    category: 'Categoría',
    category_name: 'Categoría',
    phone: 'Teléfono',
    email: 'Correo',
    address: 'Dirección',
    notes: 'Notas',
    debtBalance: 'Saldo',
    debt_balance: 'Saldo',
    contactName: 'Nombre de Contacto',
    contact_name: 'Contacto',
    nextVisitDate: 'Próxima Visita',
    next_visit_date: 'Visita'
  };
  return translations[key] || key;
};

const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined || value === '') return 'vacío';
  
  if ((key === 'price' || key === 'cost' || key === 'debt_balance' || key === 'debtBalance') && typeof value === 'number') {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  }
  
  if (key === 'next_visit_date' || key === 'nextVisitDate') {
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('es-AR');
    } catch (_) {}
  }
  
  return String(value);
};

const getActionLabel = (action: string) => {
  const actionLabels: Record<string, string> = {
    create_product: 'Producto Creado',
    update_product: 'Producto Modificado',
    delete_product: 'Producto Eliminado',
    create_category: 'Categoría Creada',
    update_category: 'Categoría Modificada',
    delete_category: 'Categoría Eliminada',
    create_customer: 'Cliente Creado',
    update_customer: 'Cliente Modificado',
    delete_customer: 'Cliente Eliminado',
    create_supplier: 'Proveedor Creado',
    update_supplier: 'Proveedor Modificado',
    delete_supplier: 'Proveedor Eliminado'
  };
  return actionLabels[action] || action;
};

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

  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const groupedLogs = React.useMemo(() => {
    if (auditLogs.length === 0) return [];
    
    const groups: any[] = [];
    let currentGroup: any = null;
    
    const sortedLogs = [...auditLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    for (const log of sortedLogs) {
      const logTime = new Date(log.created_at).getTime();
      
      if (!currentGroup) {
        currentGroup = {
          id: log.id,
          user_id: log.user_id,
          user_name: log.user_name,
          user_email: log.user_email,
          created_at: log.created_at,
          logs: [log]
        };
      } else {
        const groupTime = new Date(currentGroup.created_at).getTime();
        const timeDiff = Math.abs(groupTime - logTime);
        const sameUser = currentGroup.user_id === log.user_id;
        
        // Group if same user and within 8 seconds
        if (sameUser && timeDiff <= 8000) {
          currentGroup.logs.push(log);
        } else {
          groups.push(currentGroup);
          currentGroup = {
            id: log.id,
            user_id: log.user_id,
            user_name: log.user_name,
            user_email: log.user_email,
            created_at: log.created_at,
            logs: [log]
          };
        }
      }
    }
    
    if (currentGroup) {
      groups.push(currentGroup);
    }
    
    return groups;
  }, [auditLogs]);

  const renderLogDetails = (log: any) => {
    const action = log.action;
    const details = log.details;
    
    if (action.startsWith('update_') && details?.new_values) {
      const entries = Object.entries(details.new_values).filter(([key]) => {
        return key !== 'id' && key !== 'business_id' && key !== 'created_at' && key !== 'updated_at' && key !== 'deleted_at';
      });

      if (entries.length === 0) return null;

      return (
        <div className="log-changes-diff-list">
          {entries.map(([key, newVal]) => {
            const oldVal = details.old_values?.[key];
            const friendlyKey = translateField(key);
            const friendlyOld = formatValue(key, oldVal);
            const friendlyNew = formatValue(key, newVal);
            
            return (
              <div key={key} className="diff-item-row">
                <span className="diff-field-name">{friendlyKey}:</span>
                <div className="diff-values-flow">
                  <span className="diff-old-val">{friendlyOld}</span>
                  <span className="diff-arrow">➔</span>
                  <span className="diff-new-val">{friendlyNew}</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    
    if (action.startsWith('create_') && details?.new_values) {
      const entries = Object.entries(details.new_values).filter(([key, val]) => {
        return key !== 'id' && key !== 'business_id' && key !== 'created_at' && key !== 'updated_at' && key !== 'deleted_at' && val !== null && val !== undefined && val !== '';
      });

      if (entries.length === 0) return null;

      return (
        <div className="log-changes-create-list">
          <span className="create-label-text">Valores iniciales:</span>
          <div className="create-values-grid">
            {entries.map(([key, val]) => (
              <div key={key} className="create-item-pill">
                <span className="create-item-key">{translateField(key)}:</span>
                <span className="create-item-val">{formatValue(key, val)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    if (action.startsWith('delete_')) {
      return (
        <div className="log-changes-delete">
          <span className="delete-info-text">Se eliminó de las planillas activas.</span>
        </div>
      );
    }
    
    return null;
  };

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
      {showHistory && createPortal(
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
              ) : groupedLogs.length === 0 ? (
                <div className="drawer-empty">
                  <span>No hay cambios registrados en este local.</span>
                </div>
              ) : (
                <div className="audit-logs-list">
                  {groupedLogs.map((group) => {
                    const isExpanded = expandedGroups[group.id] || false;
                    const dateStr = new Date(group.created_at).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    const isBatch = group.logs.length > 1;
                    const counts = isBatch ? group.logs.reduce((acc: any, log: any) => {
                      const act = log.action.split('_')[0]; // 'create' | 'update' | 'delete'
                      acc[act] = (acc[act] || 0) + 1;
                      return acc;
                    }, { create: 0, update: 0, delete: 0 }) : null;

                    return (
                      <div key={group.id} className={`audit-group-card ${isBatch ? 'batch-card' : ''} ${isExpanded ? 'is-expanded' : ''}`}>
                        <div className="group-header" onClick={() => isBatch && toggleGroup(group.id)}>
                          <div className="group-meta-info">
                            <span className="log-time">{dateStr}</span>
                            <span className="log-author">por {group.user_name || 'Sistema'}</span>
                          </div>
                          
                          <div className="group-title-row">
                            <span className={`group-badge ${isBatch ? 'badge-batch' : `badge-${group.logs[0].action.split('_')[0]}`}`}>
                              {isBatch ? `Lote de Cambios (${group.logs.length})` : getActionLabel(group.logs[0].action)}
                            </span>
                            
                            {isBatch && (
                              <span className="expand-indicator">
                                {isExpanded ? '▲ Colapsar' : '▼ Expandir'}
                              </span>
                            )}
                          </div>
                          
                          {!isBatch && (
                            <div className="single-log-entity">
                              <strong>{group.logs[0].details?.name || `ID: ${group.logs[0].entity_id.substring(0, 8)}...`}</strong>
                            </div>
                          )}
                        </div>

                        {/* If it's a batch, list elements inside. If expanded, show details. */}
                        {isBatch && counts && (
                          <div className="batch-elements-summary">
                            {!isExpanded ? (
                              <div className="batch-summary-preview" onClick={() => toggleGroup(group.id)}>
                                <div className="batch-summary-counts">
                                  {counts.create > 0 && <span className="batch-count-badge badge-create">🟢 {counts.create} creados</span>}
                                  {counts.update > 0 && <span className="batch-count-badge badge-update">🔵 {counts.update} modificados</span>}
                                  {counts.delete > 0 && <span className="batch-count-badge badge-delete">🔴 {counts.delete} eliminados</span>}
                                </div>
                                <div className="batch-click-to-expand">
                                  Ver detalle de los {group.logs.length} cambios
                                </div>
                              </div>
                            ) : (
                              <div className="batch-elements-list">
                                {group.logs.map((log: any) => (
                                  <div key={log.id} className="batch-element-item animate-fade-in-down">
                                    <div className="element-item-header">
                                      <span className={`element-badge badge-${log.action.split('_')[0]}`}>
                                        {getActionLabel(log.action)}
                                      </span>
                                      <strong>{log.details?.name || `ID: ${log.entity_id.substring(0, 8)}...`}</strong>
                                    </div>
                                    
                                    {renderLogDetails(log)}
                                    
                                    {isAdminOrOwner && (
                                      <div className="element-rollback-action">
                                        <button
                                          onClick={() => handleRollback(log)}
                                          className="btn-rollback-action-mini"
                                          title="Revertir este cambio del lote"
                                        >
                                          Revertir
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* If it's single, render its details directly */}
                        {!isBatch && (
                          <div className="single-log-details-area">
                            {renderLogDetails(group.logs[0])}
                            
                            {isAdminOrOwner && (
                              <div className="single-rollback-footer">
                                <button
                                  onClick={() => handleRollback(group.logs[0])}
                                  className="btn-rollback-action-premium"
                                  title="Revertir este cambio"
                                >
                                  Revertir Cambio
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Warning Confirmation Modal for Rollbacks */}
      {showRollbackConfirm && rollbackTarget && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
};
export default WorkspaceExplorer;

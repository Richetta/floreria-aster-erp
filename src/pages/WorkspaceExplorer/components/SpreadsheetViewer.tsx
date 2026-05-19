import React, { useState, useEffect } from 'react';
import { X, Download, Search, AlertCircle, Loader, AlertTriangle, ShieldAlert, Sparkles, Check, Plus } from 'lucide-react';
import type { VFSItem, Column } from '../useWorkspaceExplorer';
import * as XLSX from 'xlsx';

interface SpreadsheetViewerProps {
  file: VFSItem;
  columns: Column[];
  rows: any[];
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  onSaveChanges: (fileId: string, updatedRows: any[], changes: Array<{ id: string; key: string; oldValue: any; newValue: any }>) => Promise<void>;
}

interface CellChange {
  id: string; // rowId
  rowName: string; // friendly row descriptor
  key: string; // column key
  label: string; // column label
  oldValue: any;
  newValue: any;
}

export const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({
  file,
  columns,
  rows,
  onClose,
  searchQuery,
  setSearchQuery,
  totalCount,
  filteredCount,
  isLoading,
  onSaveChanges,
}) => {
  // Local rows copy to hold edits in real time
  const [localRows, setLocalRows] = useState<any[]>([]);

  // Track edits in state
  const [editingCell, setEditingCell] = useState<{ rowId: string | number; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  // Accumulated pending changes list
  const [pendingChanges, setPendingChanges] = useState<CellChange[]>([]);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with prop rows on file load/change
  useEffect(() => {
    setLocalRows(rows);
    setPendingChanges([]);
    setEditingCell(null);
  }, [rows, file.id]);

  // Format cell helper
  const formatCellValue = (value: any, column: Column) => {
    if (value === null || value === undefined) return '-';

    if (column.format === 'currency' && typeof value === 'number') {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
      }).format(value);
    }

    if (column.format === 'date' && typeof value === 'string') {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }).format(date);
        }
      } catch (e) {
        return value;
      }
    }

    return String(value);
  };

  // Badge class helper
  const getBadgeClass = (value: any, column: Column) => {
    if (!column.badge) return '';
    const str = String(value).toLowerCase();

    // Stock statuses
    if (column.key === 'stock_quantity') {
      const num = Number(value);
      if (num <= 0) return 'badge-danger';
      if (num <= 5) return 'badge-warning';
      return 'badge-success';
    }

    // Order statuses
    if (str.includes('pendiente') || str.includes('armando')) return 'badge-warning';
    if (str.includes('entregado') || str.includes('activo') || str.includes('retiro')) return 'badge-success';
    if (str.includes('cancelado') || str.includes('inactivo')) return 'badge-danger';
    if (str.includes('camino') || str.includes('listo')) return 'badge-info';

    // Balance checks
    if (column.key === 'debt_balance') {
      const num = Number(value);
      if (num > 0) return 'badge-danger';
      return 'badge-muted';
    }

    return 'badge-muted';
  };

  // Legitimate Excel Download action (.xlsx)
  const handleExportExcel = () => {
    if (localRows.length === 0) return;
    
    // Build raw rows map matching column labels
    const exportData = localRows.map(row => {
      const item: Record<string, any> = {};
      columns.forEach(col => {
        item[col.label] = row[col.key];
      });
      return item;
    });

    const safeFilename = file.name.replace(/\.[^/.]+$/, "") + `_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hoja 1');
    XLSX.writeFile(workbook, safeFilename);
  };

  // Add new row helper
  const handleAddRow = () => {
    const newId = `new_${Date.now()}`;
    const emptyRow: any = { id: newId };
    
    columns.forEach(col => {
      emptyRow[col.key] = '';
    });
    
    if (file.entity === 'products') {
      emptyRow.name = 'Nuevo Producto';
      emptyRow.stock_quantity = 0;
      emptyRow.cost = 0;
      emptyRow.price = 0;
    }
    
    setLocalRows(prev => [...prev, emptyRow]);
    
    // Register creation as a pending change so the save banner appears
    setPendingChanges(prev => [
      ...prev,
      {
        id: newId,
        rowName: 'Nueva Fila Creada',
        key: 'name',
        label: 'Nombre',
        oldValue: '',
        newValue: emptyRow.name || 'Nuevo Elemento'
      }
    ]);
  };

  // Inline Cell Editing Trigger
  const handleCellDoubleClick = (row: any, idx: number, col: Column, value: any) => {
    // Only allow editing editable keys (no virtual headers / relations not editable)
    if (col.key === 'category_name' || col.key === 'parent_name' || col.key === 'orderNumber' || col.key === 'deliveryMethod') {
      return; // static visual fields
    }

    setEditingCell({ rowId: row.id || idx, colKey: col.key });
    setEditValue(value === null || value === undefined ? '' : String(value));
  };

  // Save temporary cell change
  const handleSaveCell = (rowId: string | number, colKey: string, oldValue: any, row: any, col: Column) => {
    setEditingCell(null);
    let parsedValue: any = editValue.trim();

    // Try parsing numbers if columns require it
    if (colKey === 'stock_quantity' || colKey === 'cost' || colKey === 'price' || colKey === 'debtBalance') {
      const num = Number(parsedValue);
      if (!isNaN(num)) {
        parsedValue = num;
      }
    }

    if (String(parsedValue) === String(oldValue)) {
      return; // no real change
    }

    // Update local visual rows
    const updated = localRows.map(r => {
      const rId = r.id || localRows.indexOf(r);
      if (rId === rowId) {
        return { ...r, [colKey]: parsedValue };
      }
      return r;
    });
    setLocalRows(updated);

    // Friendly row name for the security summary dialog
    const rowName = row.name || row.customerName || `Fila #${localRows.indexOf(row) + 1}`;

    // Record the change
    setPendingChanges(prev => {
      const filtered = prev.filter(c => !(c.id === String(rowId) && c.key === colKey));
      return [...filtered, {
        id: String(rowId),
        rowName,
        key: colKey,
        label: col.label,
        oldValue,
        newValue: parsedValue
      }];
    });
  };

  // Persist edits to stores
  const executeSaveToProduction = async () => {
    setIsSaving(true);
    try {
      await onSaveChanges(file.id, localRows, pendingChanges);
      setPendingChanges([]);
      setShowSecurityModal(false);
    } catch (e) {
      console.error('Failed to commit modifications:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setLocalRows(rows);
    setPendingChanges([]);
    setEditingCell(null);
  };

  // Helper to detect modified cell visually
  const isCellModified = (rowId: string | number, colKey: string) => {
    return pendingChanges.some(c => c.id === String(rowId) && c.key === colKey);
  };

  return (
    <div className="spreadsheet-viewer fade-in">
      {/* Header Panel */}
      <div className="sheet-header">
        <div className="sheet-title-area">
          <span className="file-icon-lead">📄</span>
          <div>
            <div className="sheet-filename-row">
              <h3 className="sheet-filename">{file.name}</h3>
              {file.isCustom ? (
                <span className="custom-badge"><Sparkles size={10} /> Planilla Personal</span>
              ) : (
                <span className="system-badge">Espejo ERP</span>
              )}
            </div>
            <p className="sheet-description">{file.description || 'Vista de hoja de cálculo virtual.'}</p>
          </div>
        </div>

        <div className="sheet-actions">
          {/* Internal search */}
          <div className="sheet-search-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Buscar en esta hoja..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sheet-search-input"
            />
            {searchQuery && (
              <button 
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                title="Limpiar búsqueda"
              >
                &times;
              </button>
            )}
          </div>

          <button
            onClick={handleAddRow}
            className="sheet-btn btn-add-row"
            title="Agregar una nueva fila al final de la planilla"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', color: '#10b981', border: '1px solid #10b981', fontWeight: 'bold' }}
          >
            <Plus size={16} />
            <span className="btn-text">Agregar Fila</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="sheet-btn btn-export"
            disabled={localRows.length === 0}
            title="Exportar registros a planilla de Excel (.xlsx)"
          >
            <Download size={16} />
            <span className="btn-text">Descargar Excel (.xlsx)</span>
          </button>

          <button
            onClick={onClose}
            className="sheet-btn btn-close-sheet"
            title="Cerrar planilla y volver a carpetas"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Spreadsheet Grid Table */}
      <div className="sheet-grid-container">
        {isLoading ? (
          <div className="sheet-loading-overlay">
            <Loader className="spinner" size={32} />
            <p>Cargando registros del negocio...</p>
          </div>
        ) : localRows.length === 0 ? (
          <div className="sheet-empty-overlay">
            <AlertCircle size={40} className="text-gray-400" />
            <h4>Sin datos disponibles</h4>
            <p>
              {searchQuery
                ? 'Ningún registro coincide con tu búsqueda actual en esta planilla.'
                : 'No se encontraron registros activos para esta categoría en el negocio.'}
            </p>
          </div>
        ) : (
          <table className="sheet-table">
            <thead>
              <tr>
                <th className="row-index-hdr">#</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width ? `${col.width}px` : 'auto' }}
                    className={`align-${col.align || 'left'}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {localRows.map((row, idx) => {
                const rowId = row.id || idx;
                return (
                  <tr key={rowId}>
                    <td className="row-index-cell">{idx + 1}</td>
                    {columns.map((col) => {
                      const cellVal = row[col.key];
                      const isBadge = col.badge;
                      const formatted = formatCellValue(cellVal, col);
                      const badgeClass = getBadgeClass(cellVal, col);
                      const isEdited = isCellModified(rowId, col.key);

                      // Render input box if cell is in edit mode
                      if (editingCell && editingCell.rowId === rowId && editingCell.colKey === col.key) {
                        return (
                          <td key={col.key} className="cell-editing">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSaveCell(rowId, col.key, cellVal, row, col)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCell(rowId, col.key, cellVal, row, col);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              className="cell-edit-input"
                              autoFocus
                            />
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.key}
                          className={`align-${col.align || 'left'} cell-interactive ${isEdited ? 'cell-edited-highlight' : ''}`}
                          onDoubleClick={() => handleCellDoubleClick(row, idx, col, cellVal)}
                          title="Haz doble clic para editar el valor de la celda"
                        >
                          {isBadge ? (
                            <span className={`sheet-badge ${badgeClass}`}>
                              {formatted}
                            </span>
                          ) : (
                            formatted
                          )}
                          {isEdited && <span className="cell-edited-corner-dot" title="Valor modificado temporalmente"></span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Floating changes panel bar */}
      {pendingChanges.length > 0 && (
        <div className="sheet-floating-changes-bar fade-in">
          <div className="changes-bar-info">
            <span className="info-sparkle"><Sparkles size={16} /></span>
            <p>
              Tienes <strong>{pendingChanges.length}</strong> cambios realizados en esta hoja sin confirmar en producción.
            </p>
          </div>
          <div className="changes-bar-actions">
            <button 
              onClick={() => setShowSecurityModal(true)} 
              className="changes-btn btn-save-all"
            >
              <Check size={14} /> Guardar Cambios
            </button>
            <button 
              onClick={handleDiscardChanges} 
              className="changes-btn btn-discard"
            >
              Descartar Todo
            </button>
          </div>
        </div>
      )}

      {/* Footer / Status bar */}
      <div className="sheet-footer">
        <div className="footer-stat">
          <span>Total filas: <strong>{totalCount}</strong></span>
          {searchQuery && (
            <span className="separator">|</span>
          )}
          {searchQuery && (
            <span>Coinciden con búsqueda: <strong>{filteredCount}</strong></span>
          )}
        </div>
        <div className="footer-status-tag active-edit-mode">
          <span className="dot animate-pulse"></span>
          Modo Edición Habilitado (Doble Clic para Editar)
        </div>
      </div>

      {/* Changes Audit Security Modal */}
      {showSecurityModal && (
        <div className="explorer-security-overlay">
          <div className="explorer-security-modal animate-scale-up">
            <div className="modal-security-header">
              <div className="shield-icon-bg">
                <ShieldAlert className="shield-icon text-emerald-500" size={24} />
              </div>
              <div>
                <h4 className="security-title">Confirmación de Escritura de Datos</h4>
                <p className="security-subtitle">Resumen de auditoría de los cambios a impactar</p>
              </div>
            </div>

            <div className="security-content">
              <p className="security-notice">
                Estás a punto de persistir de forma definitiva los siguientes cambios en la base de datos de producción de tu negocio:
              </p>

              {/* Scrollable Audit changes list table */}
              <div className="security-changes-table-container">
                <table className="security-changes-table">
                  <thead>
                    <tr>
                      <th>Fila / Elemento</th>
                      <th>Columna</th>
                      <th>Valor Anterior</th>
                      <th>Nuevo Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingChanges.map((change, idx) => (
                      <tr key={idx}>
                        <td><strong>{change.rowName}</strong></td>
                        <td><span className="col-badge">{change.label}</span></td>
                        <td className="old-val">{String(change.oldValue) || '-'}</td>
                        <td className="new-val">➔ {String(change.newValue) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="security-alert-box">
                <AlertTriangle className="alert-box-icon" size={18} />
                <p>
                  <strong>ATENCIÓN:</strong> Esta acción reescribirá en tiempo real los registros reales del ERP. Los precios, stocks, teléfonos y datos serán visibles instantáneamente para los vendedores y clientes.
                </p>
              </div>
            </div>

            <div className="security-footer flex justify-end gap-2">
              <button 
                onClick={executeSaveToProduction} 
                disabled={isSaving}
                className="security-btn btn-accept"
              >
                {isSaving ? 'Aplicando...' : 'Confirmar e Impactar Base de Datos'}
              </button>
              <button 
                onClick={() => setShowSecurityModal(false)} 
                disabled={isSaving}
                className="security-btn btn-decline"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SpreadsheetViewer;

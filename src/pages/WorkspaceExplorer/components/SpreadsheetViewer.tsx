import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Search, AlertCircle, Loader, AlertTriangle, ShieldAlert, Sparkles, Check, Plus, Eye, Edit3 } from 'lucide-react';
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
  totalCount,
  isLoading,
  onSaveChanges,
}) => {
  // Local rows copy to hold edits in real time
  const [localRows, setLocalRows] = useState<any[]>([]);

  // Local Search & Sort States
  const [localSearchQuery, setLocalSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('default');

  // Edit Mode Switch
  const [isEditMode, setIsEditMode] = useState<boolean>(true);

  // Track edits in state
  const [editingCell, setEditingCell] = useState<{ rowId: string | number; colKey: string } | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
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
    setLocalSearchQuery('');
    setSortBy('default');
  }, [file.id]);

  // Sync with parent rows only if there are no pending changes (prevents cell data loss on parent updates)
  useEffect(() => {
    if (pendingChanges.length === 0) {
      setLocalRows(rows);
    }
  }, [rows]);

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
    if (!isEditMode) return;

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
      
      if (file.id.startsWith('category_file_')) {
        emptyRow.category_name = file.name.replace('.xlsx', '');
      }
    }

    // Smart barcode auto-increment logic (absolute max)
    const codeCol = columns.find(c => c.key === 'code' || c.key === 'barcode');
    if (codeCol) {
      let maxPrefix = 'PROD-';
      let maxNum = 0;
      let maxLen = 4;
      let foundCode = false;

      localRows.forEach(r => {
        const val = r[codeCol.key];
        if (val && typeof val === 'string') {
          foundCode = true;
          const match = val.trim().match(/^(.*?)(\d+)$/);
          if (match) {
            maxPrefix = match[1];
            const num = parseInt(match[2], 10);
            if (num > maxNum) {
              maxNum = num;
              maxLen = match[2].length;
            }
          } else {
            const numVal = parseInt(val, 10);
            if (!isNaN(numVal) && numVal > maxNum) {
              maxNum = numVal;
              maxPrefix = '';
              maxLen = val.trim().length;
            }
          }
        }
      });

      if (foundCode) {
        emptyRow[codeCol.key] = `${maxPrefix}${String(maxNum + 1).padStart(maxLen, '0')}`;
      } else {
        emptyRow[codeCol.key] = 'PROD-0001';
      }
    }
    
    setLocalRows(prev => [...prev, emptyRow]);
    
    // Register creation as a pending change so the save banner appears
    setPendingChanges(prev => [
      ...prev,
      {
        id: newId,
        rowName: emptyRow.name || 'Nuevo Elemento',
        key: 'name',
        label: 'Nombre',
        oldValue: '',
        newValue: emptyRow.name || 'Nuevo Elemento'
      }
    ]);

    setEditingCell({ rowId: newId, colKey: columns[0].key });
    setEditValue(String(emptyRow[columns[0].key] || ''));

    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
      }
    }, 50);
  };

  // Inline Cell Editing Trigger
  const handleCellDoubleClick = (row: any, idx: number, col: Column, value: any) => {
    if (!isEditMode) return;

    // Only allow editing editable keys (no virtual headers / relations not editable)
    if (col.key === 'parent_name' || col.key === 'orderNumber' || col.key === 'deliveryMethod') {
      return; // static visual fields
    }

    setEditingCell({ rowId: row.id || idx, colKey: col.key });
    setEditValue(value === null || value === undefined ? '' : String(value));
  };

  // Delete new row helper
  const handleDeleteNewRow = (rowId: string | number) => {
    setLocalRows(prev => prev.filter(r => r.id !== rowId));
    setPendingChanges(prev => prev.filter(c => c.id !== rowId));
  };

  // Save temporary cell change
  const handleSaveCell = (rowId: string | number, colKey: string, oldValue: any, row: any, col: Column) => {
    setEditingCell(null);
    let parsedValue: any = editValue.trim();

    // Try parsing numbers if columns require it
    if (colKey === 'stock_quantity' || colKey === 'cost' || colKey === 'price' || colKey === 'debtBalance' || colKey === 'debt_balance') {
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

  // Computed displayed rows applying search & sort locally on the source of truth copy
  const displayedRows = useMemo(() => {
    let result = [...localRows];

    // 1. Search Query Local Filtering
    if (localSearchQuery) {
      const lowerQuery = localSearchQuery.toLowerCase();
      result = result.filter((row) => {
        if (String(row.id).startsWith('new_')) return true; // Exempt new rows from search filtering
        return Object.values(row).some((val) => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(lowerQuery);
        });
      });
    }

    // 2. Sorting Local Logic
    if (sortBy !== 'default') {
      const [field, direction] = sortBy.split('_');
      const isAsc = direction === 'asc';

      let key = '';
      if (field === 'name') {
        key = columns.find(c => c.key === 'name' || c.key === 'customerName' || c.key === 'supplierName')?.key || 'name';
      } else if (field === 'price') {
        key = columns.find(c => c.key === 'price' || c.key === 'cost')?.key || 'price';
      } else if (field === 'stock') {
        key = columns.find(c => c.key === 'stock_quantity' || c.key === 'stock' || c.key === 'debt_balance' || c.key === 'debtBalance')?.key || 'stock_quantity';
      } else if (field === 'code') {
        key = columns.find(c => c.key === 'code' || c.key === 'barcode' || c.key === 'id' || c.key === 'orderNumber')?.key || 'code';
      }

      if (key) {
        result.sort((a, b) => {
          // Exempt new rows from sorting, always push them to the bottom
          const aIsNew = String(a.id).startsWith('new_');
          const bIsNew = String(b.id).startsWith('new_');
          if (aIsNew && !bIsNew) return 1;
          if (!aIsNew && bIsNew) return -1;
          if (aIsNew && bIsNew) return 0;

          const valA = a[key];
          const valB = b[key];

          if (valA === undefined || valA === null || valA === '') return 1;
          if (valB === undefined || valB === null || valB === '') return -1;

          // Numeric sort
          if (typeof valA === 'number' && typeof valB === 'number') {
            return isAsc ? valA - valB : valB - valA;
          }

          const numA = Number(valA);
          const numB = Number(valB);
          if (!isNaN(numA) && !isNaN(numB)) {
            return isAsc ? numA - numB : numB - numA;
          }

          // String sort
          return isAsc 
            ? String(valA).localeCompare(String(valB), 'es', { numeric: true })
            : String(valB).localeCompare(String(valA), 'es', { numeric: true });
        });
      }
    }

    return result;
  }, [localRows, localSearchQuery, sortBy, columns]);

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
          {/* Internal search (local) */}
          <div className="sheet-search-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Buscar en esta hoja..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="sheet-search-input"
            />
            {localSearchQuery && (
              <button 
                className="clear-search-btn"
                onClick={() => setLocalSearchQuery('')}
                title="Limpiar búsqueda"
              >
                &times;
              </button>
            )}
          </div>

          {/* Local Sorting Dropdown */}
          <div className="sheet-sort-wrapper">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sheet-sort-select"
              title="Ordenar registros localmente"
            >
              <option value="default">📋 Ordenar por...</option>
              <option value="name_asc">Nombre (A-Z)</option>
              <option value="name_desc">Nombre (Z-A)</option>
              {columns.some(c => c.key === 'code' || c.key === 'barcode') && (
                <>
                  <option value="code_asc">Código (Ascendente)</option>
                  <option value="code_desc">Código (Descendente)</option>
                </>
              )}
              {columns.some(c => c.key === 'price' || c.key === 'cost') && (
                <>
                  <option value="price_asc">Precio / Costo (Menor a Mayor)</option>
                  <option value="price_desc">Precio / Costo (Mayor a Menor)</option>
                </>
              )}
              {columns.some(c => c.key === 'stock_quantity' || c.key === 'stock' || c.key === 'debt_balance' || c.key === 'debtBalance') && (
                <>
                  <option value="stock_asc">Stock / Balance (Menor a Mayor)</option>
                  <option value="stock_desc">Stock / Balance (Mayor a Menor)</option>
                </>
              )}
            </select>
          </div>

          <button
            onClick={handleAddRow}
            disabled={!isEditMode}
            className={`sheet-btn btn-add-row ${!isEditMode ? 'btn-disabled' : ''}`}
            title={isEditMode ? "Agregar una nueva fila al final de la planilla" : "Activa el modo edición para agregar filas"}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: isEditMode ? '#ecfdf5' : '#f3f4f6', 
              color: isEditMode ? '#10b981' : '#9ca3af', 
              border: isEditMode ? '1px solid #10b981' : '1px solid #d1d5db', 
              fontWeight: 'bold',
              cursor: isEditMode ? 'pointer' : 'not-allowed'
            }}
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
      <div className="sheet-grid-container" ref={tableContainerRef}>
        {isLoading ? (
          <div className="sheet-loading-overlay">
            <Loader className="spinner" size={32} />
            <p>Cargando registros del negocio...</p>
          </div>
        ) : displayedRows.length === 0 ? (
          <div className="sheet-empty-overlay">
            <AlertCircle size={40} className="text-gray-400" />
            <h4>Sin datos disponibles</h4>
            <p>
              {localSearchQuery
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
              {displayedRows.map((row, idx) => {
                const rowId = row.id || idx;
                return (
                  <tr key={rowId}>
                    <td className="row-index-cell">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        {idx + 1}
                        {isEditMode && String(rowId).startsWith('new_') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteNewRow(rowId); }}
                            style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px', fontWeight: 'bold' }}
                            title="Descartar esta fila nueva"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    </td>
                    {columns.map((col) => {
                      const cellVal = row[col.key];
                      const isBadge = col.badge;
                      const formatted = formatCellValue(cellVal, col);
                      const badgeClass = getBadgeClass(cellVal, col);
                      const isEdited = isCellModified(rowId, col.key);

                      // Render input box if cell is in edit mode
                      if (isEditMode && editingCell && editingCell.rowId === rowId && editingCell.colKey === col.key) {
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
                          className={`align-${col.align || 'left'} ${isEditMode ? 'cell-interactive' : 'cell-readonly'} ${isEdited ? 'cell-edited-highlight' : ''}`}
                          onDoubleClick={() => isEditMode && handleCellDoubleClick(row, idx, col, cellVal)}
                          title={isEditMode ? "Haz doble clic para editar el valor de la celda" : "Modo Lectura (Activa el Modo Edición en el pie de página para cambiar)"}
                          style={{ cursor: isEditMode ? 'pointer' : 'default' }}
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

      {/* Footer / Status bar with Edit Mode switch toggle */}
      <div className="sheet-footer">
        <div className="footer-stat">
          <span>Total filas: <strong>{totalCount}</strong></span>
          {localSearchQuery && (
            <span className="separator">|</span>
          )}
          {localSearchQuery && (
            <span>Coinciden con búsqueda: <strong>{displayedRows.length}</strong></span>
          )}
        </div>

        {/* Beautiful Edit/Read toggle switch */}
        <div className="footer-edit-toggle-wrapper">
          <div className="toggle-badge-icon">
            {isEditMode ? (
              <Edit3 size={12} className="text-emerald-500" />
            ) : (
              <Eye size={12} className="text-slate-400" />
            )}
          </div>
          <span className="toggle-label">{isEditMode ? 'Modo Edición' : 'Modo Lectura'}</span>
          <button
            onClick={() => {
              if (editingCell) setEditingCell(null);
              setIsEditMode(!isEditMode);
            }}
            className={`toggle-switch-btn ${isEditMode ? 'active' : ''}`}
            title="Alternar entre Modo Edición y Modo Lectura"
            type="button"
          >
            <span className="toggle-slider"></span>
          </button>
        </div>
      </div>

      {/* Changes Audit Security Modal */}
      {showSecurityModal && createPortal(
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
                      <th style={{ width: '200px' }}>Acción y Elemento</th>
                      <th>Detalle de los Cambios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const groups: Record<string, { isNew: boolean, rowName: string, changes: CellChange[] }> = {};
                      pendingChanges.forEach(c => {
                        if (!groups[c.id]) {
                          groups[c.id] = { isNew: String(c.id).startsWith('new_'), rowName: c.rowName, changes: [] };
                        }
                        if (c.rowName !== 'Nueva Fila Creada' && c.rowName !== 'Nuevo Producto' && c.rowName !== 'Nuevo Elemento') {
                          groups[c.id].rowName = c.rowName;
                        }
                        // Skip duplicate "name" dummy events for new rows
                        if (groups[c.id].isNew && c.key === 'name' && c.oldValue === '') {
                          // Allow the last name edit to overwrite, but don't clutter
                          const existingNameIdx = groups[c.id].changes.findIndex(ch => ch.key === 'name');
                          if (existingNameIdx >= 0) groups[c.id].changes[existingNameIdx] = c;
                          else groups[c.id].changes.push(c);
                        } else {
                          groups[c.id].changes.push(c);
                        }
                      });

                      return Object.entries(groups).map(([id, group]) => {
                        if (group.isNew) {
                          const nameChange = group.changes.find(c => c.key === 'name');
                          const finalName = nameChange ? nameChange.newValue : group.rowName;
                          
                          // Look up the actual row in localRows to get its category_name even if not explicitly modified
                          const row = localRows.find(r => String(r.id) === String(id));
                          const categoryDetail = row?.category_name ? `Categoría: ${row.category_name}` : '';
                          const detailsList: string[] = [];
                          if (categoryDetail) detailsList.push(categoryDetail);

                          group.changes
                              .filter(c => c.newValue !== '' && c.newValue !== null && c.key !== 'name' && c.key !== 'category_name')
                              .forEach(c => detailsList.push(`${c.label}: ${c.newValue}`));

                          const details = detailsList.join(' • ');

                          return (
                            <tr key={id}>
                              <td>
                                <div style={{ color: '#059669', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  ✨ Nuevo Elemento
                                </div>
                                <div style={{ fontSize: '0.9em', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
                                  {finalName}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontSize: '0.85em', color: '#64748b', lineHeight: '1.4' }}>
                                  {details || 'Registro creado sin valores extra'}
                                </div>
                              </td>
                            </tr>
                          );
                        } else {
                          const updates = group.changes.map(c => (
                            <span key={c.key} style={{ display: 'inline-block', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85em', border: '1px solid #e2e8f0' }}>
                              <strong style={{ color: '#475569', marginRight: '6px' }}>{c.label}:</strong>
                              <s style={{ color: '#ef4444', marginRight: '6px' }}>{String(c.oldValue) || '-'}</s>
                              <span style={{ color: '#059669', fontWeight: 'bold' }}>➔ {String(c.newValue) || '-'}</span>
                            </span>
                          ));

                          return (
                            <tr key={id}>
                              <td>
                                <div style={{ color: '#3b82f6', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  📝 Edición
                                </div>
                                <div style={{ fontSize: '0.9em', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
                                  {group.rowName}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {updates}
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      });
                    })()}
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
        </div>,
        document.body
      )}
    </div>
  );
};
export default SpreadsheetViewer;

import React from 'react';
import { X, Download, Search, AlertCircle, Loader } from 'lucide-react';
import type { VFSItem, Column } from '../useWorkspaceExplorer';
import { api } from '../../../services/api';

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
}) => {
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

  // CSV Export action
  const handleExportCSV = async () => {
    if (rows.length === 0) return;
    
    // Build raw rows map matching column labels
    const exportData = rows.map(row => {
      const item: Record<string, any> = {};
      columns.forEach(col => {
        item[col.label] = row[col.key];
      });
      return item;
    });

    const safeFilename = file.name.replace(/\.[^/.]+$/, "") + `_${new Date().toISOString().slice(0, 10)}.csv`;
    await api.downloadCSV(safeFilename, exportData);
  };

  return (
    <div className="spreadsheet-viewer fade-in">
      {/* Header Panel */}
      <div className="sheet-header">
        <div className="sheet-title-area">
          <span className="file-icon-lead">📄</span>
          <div>
            <h3 className="sheet-filename">{file.name}</h3>
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
            onClick={handleExportCSV}
            className="sheet-btn btn-export"
            disabled={rows.length === 0}
            title="Exportar registros a archivo CSV"
          >
            <Download size={16} />
            <span className="btn-text">Descargar CSV</span>
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
        ) : rows.length === 0 ? (
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
              {rows.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="row-index-cell">{idx + 1}</td>
                  {columns.map((col) => {
                    const cellVal = row[col.key];
                    const isBadge = col.badge;
                    const formatted = formatCellValue(cellVal, col);
                    const badgeClass = getBadgeClass(cellVal, col);

                    return (
                      <td
                        key={col.key}
                        className={`align-${col.align || 'left'}`}
                      >
                        {isBadge ? (
                          <span className={`sheet-badge ${badgeClass}`}>
                            {formatted}
                          </span>
                        ) : (
                          formatted
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
        <div className="footer-status-tag">
          <span className="dot"></span>
          Modo Lectura MVP (Sin Edición)
        </div>
      </div>
    </div>
  );
};

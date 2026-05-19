import React, { useState } from 'react';
import { 
  Folder, 
  FileSpreadsheet, 
  ChevronRight, 
  HelpCircle, 
  FolderPlus, 
  FilePlus,  
  Download, 
  AlertTriangle, 
  Check, 
  X,
  Sparkles,
  Trash2
} from 'lucide-react';
import type { VFSItem } from '../useWorkspaceExplorer';
import { useStore } from '../../../store/useStore';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

interface VFSBrowserProps {
  items: VFSItem[];
  allItems: VFSItem[];
  currentFolderId: string;
  onFolderClick: (folderId: string) => void;
  onFileClick: (fileId: string) => void;
  onCreateFolder: (name: string) => void;
  onCreateExcelFile: (name: string, templateType: 'empty' | 'products' | 'customers' | 'orders') => void;
  onMoveItem: (itemId: string, targetId: string) => void;
  onDeleteItem: (itemId: string) => void;
}

export const VFSBrowser: React.FC<VFSBrowserProps> = ({
  items,
  allItems,
  currentFolderId,
  onFolderClick,
  onFileClick,
  onCreateFolder,
  onCreateExcelFile,
  onMoveItem,
  onDeleteItem,
}) => {
  const store = useStore();

  // Create modes
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [showFileForm, setShowFileForm] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'empty' | 'products' | 'customers' | 'orders'>('empty');

  // Drag and Drop state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ itemId: string; targetId: string } | null>(null);

  // ZIP exporting state
  const [isZipping, setIsZipping] = useState(false);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.setData('text/plain', itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    if (draggedItemId && draggedItemId !== folderId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;
    
    if (itemId && itemId !== folderId) {
      // Find item parent first to check if they are already there
      const item = allItems.find(i => i.id === itemId);
      if (item && item.parentId !== folderId) {
        setPendingMove({ itemId, targetId: folderId });
      }
    }
    setDraggedItemId(null);
  };

  // Move confirmation execution
  const confirmMoveItem = () => {
    if (pendingMove) {
      onMoveItem(pendingMove.itemId, pendingMove.targetId);
      setPendingMove(null);
    }
  };

  // Creation form handlers
  const handleFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowFolderForm(false);
    }
  };

  const handleFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFileName.trim()) {
      onCreateExcelFile(newFileName.trim(), selectedTemplate);
      setNewFileName('');
      setSelectedTemplate('empty');
      setShowFileForm(false);
    }
  };

  // Recursive ZIP downloader
  const handleDownloadZIP = async () => {
    if (items.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();

      // Helper helper to generate excel array buffer for a given virtual spreadsheet file
      const generateExcelBuffer = (fileItem: VFSItem): ArrayBuffer => {
        let columns: any[] = [];
        let rows: any[] = [];

        if (fileItem.entity === 'custom') {
          columns = fileItem.customData?.columns || [];
          rows = fileItem.customData?.rows || [];
        } else if (fileItem.entity === 'products') {
          columns = [
            { key: 'code', label: 'Código' },
            { key: 'name', label: 'Nombre del Producto' },
            { key: 'category_name', label: 'Categoría' },
            { key: 'stock_quantity', label: 'Stock Actual' },
            { key: 'cost', label: 'Costo ($)' },
            { key: 'price', label: 'Precio Venta ($)' }
          ];
          const isCat = fileItem.id.startsWith('category_file_');
          const catId = isCat ? fileItem.id.replace('category_file_', '') : null;
          
          let productsList = store.products;
          if (catId) {
            const allCatIds = [catId];
            const findChildren = (parentId: string) => {
              store.categoriesData
                .filter(c => c.parent_id === parentId)
                .forEach(ch => {
                  allCatIds.push(ch.id);
                  findChildren(ch.id);
                });
            };
            findChildren(catId);
            productsList = store.products.filter(p => p.category_id && allCatIds.includes(p.category_id));
          }

          rows = productsList.map(p => ({
            code: p.code || 'S/C',
            name: p.name,
            category_name: p.category || 'Sin Categoría',
            stock_quantity: p.stock ?? 0,
            cost: p.cost ?? 0,
            price: p.price ?? 0
          }));
        } else if (fileItem.entity === 'categories') {
          columns = [
            { key: 'name', label: 'Categoría' },
            { key: 'parent_name', label: 'Categoría Padre' }
          ];
          rows = store.categoriesData.map(c => {
            const parent = store.categoriesData.find(pc => pc.id === c.parent_id);
            return {
              name: c.name,
              parent_name: parent ? parent.name : 'Raíz'
            };
          });
        } else if (fileItem.entity === 'orders') {
          columns = [
            { key: 'orderNumber', label: 'Pedido #' },
            { key: 'customerName', label: 'Cliente' },
            { key: 'date', label: 'Fecha Entrega' },
            { key: 'deliveryMethod', label: 'Método' },
            { key: 'total', label: 'Total ($)' },
            { key: 'advancePayment', label: 'Seña ($)' },
            { key: 'status', label: 'Estado Pago/Entrega' }
          ];
          rows = store.orders.map(o => ({
            orderNumber: o.orderNumber ? `#${o.orderNumber}` : 'S/N',
            customerName: o.customerName,
            date: o.date,
            deliveryMethod: o.deliveryMethod === 'delivery' ? 'Envío' : 'Retiro',
            total: o.total,
            advancePayment: o.advancePayment || 0,
            status: o.status
          }));
        } else if (fileItem.entity === 'customers') {
          columns = [
            { key: 'name', label: 'Nombre Completo' },
            { key: 'phone', label: 'Teléfono' },
            { key: 'email', label: 'Correo Electrónico' },
            { key: 'address', label: 'Dirección Principal' },
            { key: 'debtBalance', label: 'Saldo Cta. Corriente ($)' }
          ];
          rows = store.customers.map(c => {
            const fullAddress = [c.address_street, c.address_number, c.address_floor, c.address_city]
              .filter(Boolean)
              .join(' ');
            return {
              name: c.name,
              phone: c.phone || 'Sin Teléfono',
              email: c.email || 'Sin Email',
              address: fullAddress || 'Sin Dirección',
              debtBalance: c.debtBalance || 0
            };
          });
        } else if (fileItem.entity === 'suppliers') {
          columns = [
            { key: 'name', label: 'Proveedor' },
            { key: 'contactName', label: 'Contacto' },
            { key: 'phone', label: 'Teléfono' },
            { key: 'address', label: 'Dirección' },
            { key: 'category', label: 'Rubro' }
          ];
          rows = store.suppliers.map(s => ({
            name: s.name,
            contactName: s.contactName || '-',
            phone: s.phone || 'Sin Teléfono',
            address: s.address || '-',
            category: s.category || '-'
          }));
        }

        const exportData = rows.map(row => {
          const item: Record<string, any> = {};
          columns.forEach(col => {
            item[col.label] = row[col.key];
          });
          return item;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Hoja 1');
        return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      };

      // Recursive folder compression
      const zipFolderRecursive = (folderId: string, currentZipFolder: JSZip) => {
        const folderItems = allItems.filter(i => i.parentId === folderId);
        
        folderItems.forEach(item => {
          if (item.type === 'folder') {
            const newZipFolder = currentZipFolder.folder(item.name);
            if (newZipFolder) {
              zipFolderRecursive(item.id, newZipFolder);
            }
          } else {
            const excelBuf = generateExcelBuffer(item);
            currentZipFolder.file(item.name, excelBuf);
          }
        });
      };

      // Run zipping starting from the current directory
      zipFolderRecursive(currentFolderId, zip);

      // Generate blob and trigger browser download
      const blob = await zip.generateAsync({ type: 'blob' });
      const currentFolderObj = allItems.find(i => i.id === currentFolderId);
      const folderName = currentFolderObj ? currentFolderObj.name : 'MiNegocio';
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${folderName}_explorer_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error('Error generating compressed ZIP package:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const folders = items.filter(item => item.type === 'folder');
  const files = items.filter(item => item.type === 'file');

  // Find info about dragging / dropping for description labels
  const movedItemObj = pendingMove ? allItems.find(i => i.id === pendingMove.itemId) : null;
  const targetFolderObj = pendingMove ? allItems.find(i => i.id === pendingMove.targetId) : null;

  return (
    <div className="vfs-browser">
      {/* Notion-style Creator Toolbar */}
      <div className="vfs-creation-toolbar">
        <div className="toolbar-left">
          <button 
            className="toolbar-btn btn-new-folder"
            onClick={() => { setShowFolderForm(true); setShowFileForm(false); }}
            title="Crear nueva carpeta en este directorio"
          >
            <FolderPlus size={16} />
            <span>Nueva Carpeta</span>
          </button>
          
          <button 
            className="toolbar-btn btn-new-file"
            onClick={() => { setShowFileForm(true); setShowFolderForm(false); }}
            title="Crear nueva planilla de Excel en este directorio"
          >
            <FilePlus size={16} />
            <span>Nuevo Excel (.xlsx)</span>
          </button>
        </div>

        {items.length > 0 && (
          <button 
            className={`toolbar-btn btn-download-zip ${isZipping ? 'animate-pulse' : ''}`}
            onClick={handleDownloadZIP}
            disabled={isZipping}
            title="Descargar este directorio completo como archivo comprimido ZIP"
          >
            <Download size={16} />
            <span>{isZipping ? 'Zipeando...' : 'Descargar Carpeta (.zip)'}</span>
          </button>
        )}
      </div>

      {/* Forms Overlay / Inline */}
      {showFolderForm && (
        <form onSubmit={handleFolderSubmit} className="vfs-creation-form fade-in">
          <div className="form-title-row">
            <span className="form-icon">📁</span>
            <h4>Nueva Carpeta</h4>
          </div>
          <input 
            type="text" 
            placeholder="Escribe el nombre de la carpeta..." 
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="form-input"
            autoFocus
            required
          />
          <div className="form-actions-row">
            <button type="submit" className="form-btn btn-confirm">
              <Check size={14} /> Crear
            </button>
            <button type="button" onClick={() => setShowFolderForm(false)} className="form-btn btn-cancel">
              <X size={14} /> Cancelar
            </button>
          </div>
        </form>
      )}

      {showFileForm && (
        <form onSubmit={handleFileSubmit} className="vfs-creation-form file-creation-form fade-in">
          <div className="form-title-row">
            <span className="form-icon">📊</span>
            <h4>Nueva Planilla de Excel (.xlsx)</h4>
          </div>
          
          <div className="form-fields-grid">
            <div className="field-group">
              <label>Nombre del Archivo</label>
              <input 
                type="text" 
                placeholder="Ejemplo: Ventas_Rosas" 
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="form-input"
                autoFocus
                required
              />
            </div>

            <div className="field-group">
              <label>Plantilla Inicial</label>
              <select 
                value={selectedTemplate} 
                onChange={(e) => setSelectedTemplate(e.target.value as any)}
                className="form-select"
              >
                <option value="empty">Vacía (Personalizada)</option>
                <option value="products">Espejo: Productos del ERP</option>
                <option value="customers">Espejo: Clientes del ERP</option>
                <option value="orders">Espejo: Pedidos del ERP</option>
              </select>
            </div>
          </div>

          <div className="form-actions-row">
            <button type="submit" className="form-btn btn-confirm">
              <Check size={14} /> Crear Planilla
            </button>
            <button type="button" onClick={() => setShowFileForm(false)} className="form-btn btn-cancel">
              <X size={14} /> Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Virtual Folders Grid */}
      {folders.length > 0 && (
        <div className="vfs-section">
          <h3 className="section-title">Carpetas de Negocio</h3>
          <div className="vfs-grid folders-grid">
            {folders.map(folder => (
              <div
                key={folder.id}
                className={`vfs-card folder-card ${dragOverFolderId === folder.id ? 'drag-over-active' : ''}`}
                style={{ '--folder-bg': folder.color || '#f1f5f9' } as React.CSSProperties}
                onClick={() => onFolderClick(folder.id)}
                onDoubleClick={() => onFolderClick(folder.id)}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder.id)}
                title={`Abrir carpeta ${folder.name} (Arrastra archivos aquí para moverlos)`}
              >
                <div className="folder-icon-wrapper">
                  <Folder className="folder-icon" size={32} />
                </div>
                <div className="folder-info" style={{ flex: 1 }}>
                  <div className="folder-name-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h4 className="item-name">{folder.name}</h4>
                      {folder.isCustom && (
                        <span className="custom-badge"><Sparkles size={8} /> Creada</span>
                      )}
                    </div>
                    {folder.isCustom && (
                      <button
                        className="vfs-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`¿Estás seguro de que deseas eliminar la carpeta "${folder.name}" y todos sus archivos contenidos?`)) {
                            onDeleteItem(folder.id);
                          }
                        }}
                        title="Eliminar carpeta"
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'transform 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
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
                draggable={true}
                onDragStart={(e) => handleDragStart(e, file.id)}
                title={`Abrir planilla ${file.name} (Arrastrala a una carpeta para moverla)`}
              >
                <div className="file-icon-wrapper">
                  <FileSpreadsheet className="file-icon" size={28} />
                </div>
                <div className="file-info" style={{ flex: 1 }}>
                  <div className="file-name-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h4 className="item-name">{file.name}</h4>
                      {file.isCustom && (
                        <span className="custom-badge"><Sparkles size={8} /> Personal</span>
                      )}
                    </div>
                    {file.isCustom && (
                      <button
                        className="vfs-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`¿Estás seguro de que deseas eliminar el archivo "${file.name}"?`)) {
                            onDeleteItem(file.id);
                          }
                        }}
                        title="Eliminar archivo"
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'transform 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
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

      {items.length === 0 && !showFolderForm && !showFileForm && (
        <div className="vfs-empty-state">
          <HelpCircle size={48} className="text-gray-400 animate-bounce-subtle" />
          <p className="empty-text">No se encontraron carpetas ni archivos aquí.</p>
          <p className="empty-subtext">¡Crea tu primera carpeta o Excel con los botones superiores!</p>
        </div>
      )}

      {/* Drag & Drop Security Authorization Modal Overlay */}
      {pendingMove && (
        <div className="explorer-security-overlay">
          <div className="explorer-security-modal alert-modal animate-scale-up">
            <div className="modal-security-header">
              <div className="shield-icon-bg warning">
                <AlertTriangle className="shield-icon" size={24} />
              </div>
              <div>
                <h4 className="security-title">Advertencia de Seguridad</h4>
                <p className="security-subtitle">Solicitud de movimiento de archivos y organización</p>
              </div>
            </div>
            
            <div className="security-content">
              <p className="security-notice">
                Estás a punto de reubicar y cambiar el directorio padre de un elemento del ERP:
              </p>
              
              <div className="security-change-panel move-panel">
                <div className="move-source">
                  <span className="type-icon">{movedItemObj?.type === 'folder' ? '📁' : '📊'}</span>
                  <strong>{movedItemObj?.name}</strong>
                </div>
                <span className="move-arrow">➔ Mover hacia ➔</span>
                <div className="move-dest">
                  <span className="type-icon">📁</span>
                  <strong>{targetFolderObj?.name}</strong>
                </div>
              </div>
              
              <p className="security-terms">
                Esta acción reestructurará de forma permanente el árbol del directorio actual. Podrás revertir este movimiento en cualquier momento arrastrando el archivo de regreso.
              </p>
            </div>

            <div className="security-footer flex justify-end gap-2">
              <button 
                onClick={confirmMoveItem} 
                className="security-btn btn-accept"
              >
                Autorizar Movimiento
              </button>
              <button 
                onClick={() => setPendingMove(null)} 
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

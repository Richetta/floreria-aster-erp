import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Folder, 
  FileSpreadsheet, 
  FileText,
  ChevronRight, 
  HelpCircle, 
  FolderPlus, 
  FilePlus,  
  Download, 
  AlertTriangle, 
  Check, 
  X,
  Sparkles,
  Trash2,
  Edit2,
  Archive
} from 'lucide-react';
import type { VFSItem } from '../useWorkspaceExplorer';
import { useStore } from '../../../store/useStore';
import { flattenCategories } from '../../../store/slices/mappers';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

interface VFSBrowserProps {
  items: VFSItem[];
  allItems: VFSItem[];
  currentFolderId: string;
  onFolderClick: (folderId: string) => void;
  onFileClick: (fileId: string) => void;
  onCreateFolder: (name: string, options?: { asCategory?: boolean; parentCategoryId?: string | null }) => void;
  onCreateExcelFile: (name: string, templateType: 'empty' | 'products' | 'customers' | 'orders') => void;
  onCreateNoteFile: (name: string) => void;
  onMoveItem: (itemId: string, targetId: string) => void;
  onRenameItem?: (itemId: string, newName: string) => void;
  onArchiveItem?: (itemId: string) => void;
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
  onCreateNoteFile,
  onMoveItem,
  onRenameItem,
  onArchiveItem,
  onDeleteItem,
}) => {
  const store = useStore();

  // Create modes
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderAsCategory, setFolderAsCategory] = useState(true);
  
  const [showFileForm, setShowFileForm] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'empty' | 'products' | 'customers' | 'orders'>('empty');

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');

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
      const parentCategoryId = currentFolderId.startsWith('category_dir_') 
        ? currentFolderId.replace('category_dir_', '') 
        : null;

      onCreateFolder(newFolderName.trim(), {
        asCategory: folderAsCategory,
        parentCategoryId: folderAsCategory ? parentCategoryId : null
      });
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

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNoteName.trim()) {
      onCreateNoteFile(newNoteName.trim());
      setNewNoteName('');
      setShowNoteForm(false);
    }
  };

  // Recursive category breadcrumbs path finder
  const parentCategoryId = currentFolderId.startsWith('category_dir_') 
    ? currentFolderId.replace('category_dir_', '') 
    : null;

  const getCategoryPath = (catId: string | null): string[] => {
    if (!catId) return [];
    const path: string[] = [];
    let currId = catId;
    const flatCategories = flattenCategories(store.categoriesData);
    while (currId) {
      const cat = flatCategories.find(c => c.id === currId);
      if (cat) {
        path.unshift(cat.name);
        currId = cat.parent_id || '';
      } else {
        break;
      }
    }
    return path;
  };

  // Recursive ZIP downloader
  const handleDownloadZIP = async () => {
    if (items.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();

      // Helper to generate content buffer
      const generateFileContent = (fileItem: VFSItem): any => {
        // Handle text notes
        if (fileItem.name.toLowerCase().endsWith('.txt')) {
          return fileItem.customData?.content || 'Escribe tu nota aquí...';
        }

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
          const flatCategories = flattenCategories(store.categoriesData);
          rows = flatCategories.map(c => {
            const parent = flatCategories.find(pc => pc.id === c.parent_id);
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
      const zipFolderRecursive = (fldId: string, currentZipFolder: JSZip) => {
        const folderItems = allItems.filter(i => i.parentId === fldId);
        
        folderItems.forEach(item => {
          if (item.type === 'folder') {
            const newZipFolder = currentZipFolder.folder(item.name);
            if (newZipFolder) {
              zipFolderRecursive(item.id, newZipFolder);
            }
          } else {
            const contentBuf = generateFileContent(item);
            currentZipFolder.file(item.name, contentBuf);
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
        <div className="toolbar-left" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className="toolbar-btn btn-new-folder"
            onClick={() => { setShowFolderForm(true); setShowFileForm(false); setShowNoteForm(false); }}
            title="Crear nueva carpeta en este directorio"
          >
            <FolderPlus size={16} />
            <span>Nueva Carpeta</span>
          </button>
          
          <button 
            className="toolbar-btn btn-new-file"
            onClick={() => { setShowFileForm(true); setShowFolderForm(false); setShowNoteForm(false); }}
            title="Crear nueva planilla de Excel en este directorio"
          >
            <FilePlus size={16} />
            <span>Nuevo Excel (.xlsx)</span>
          </button>

          <button 
            className="toolbar-btn btn-new-note"
            onClick={() => { setShowNoteForm(true); setShowFolderForm(false); setShowFileForm(false); }}
            title="Crear nueva nota o documento de texto en este directorio"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}
          >
            <FileText size={16} />
            <span>Nueva Nota (.txt)</span>
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

      {/* Creation forms rendered as elegant popups overlays */}
      {showFolderForm && createPortal(
        <div className="explorer-security-overlay">
          <div className="explorer-security-modal animate-scale-up" style={{ maxWidth: '500px' }}>
            <div className="modal-security-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div className="shield-icon-bg" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
                <FolderPlus size={24} />
              </div>
              <div>
                <h4 className="security-title" style={{ fontSize: '1.1rem' }}>Crear Nueva Carpeta / Categoría</h4>
                <p className="security-subtitle">Elige cómo vincular tu nueva carpeta en el sistema</p>
              </div>
            </div>

            <form onSubmit={handleFolderSubmit} className="security-content" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Nombre de la Carpeta</label>
                <input 
                  type="text" 
                  placeholder="Ejemplo: Rosas Importadas" 
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
                  autoFocus
                  required
                />
              </div>

              <div className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Tipo de Carpeta</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setFolderAsCategory(true)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: folderAsCategory ? '2px solid #10b981' : '1px solid #cbd5e1',
                      backgroundColor: folderAsCategory ? '#f0fdf4' : 'white',
                      color: folderAsCategory ? '#15803d' : '#475569',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>🏷️ Categoría de Productos</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.8, textAlign: 'center' }}>Vincular a base de datos de productos del ERP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFolderAsCategory(false)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: !folderAsCategory ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                      backgroundColor: !folderAsCategory ? '#eff6ff' : 'white',
                      color: !folderAsCategory ? '#1d4ed8' : '#475569',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>📁 Gestión Local</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.8, textAlign: 'center' }}>Solo organizar planillas y notas de texto</span>
                  </button>
                </div>
              </div>

              {/* Show the breadcrumbs directory cascade direction if creating a Category */}
              {folderAsCategory && (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Flujo de dirección raíz (Árbol de Categoría)
                  </span>
                  <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', lineHeight: '1.4' }}>
                    <span style={{ color: '#059669', fontWeight: 500 }}>Mi Negocio</span>
                    <span>/</span>
                    <span>Explorar por Categoría</span>
                    {getCategoryPath(parentCategoryId).map((catName) => (
                      <React.Fragment key={catName}>
                        <span>/</span>
                        <span>{catName}</span>
                      </React.Fragment>
                    ))}
                    <span>/</span>
                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>{newFolderName.trim() || '[Nueva Categoría]'}</span>
                  </div>
                </div>
              )}

              <div className="security-footer" style={{ marginTop: '8px', display: 'flex', justifyContent: 'end', gap: '8px' }}>
                <button type="submit" className="security-btn btn-accept" style={{ backgroundColor: folderAsCategory ? '#10b981' : '#3b82f6' }}>
                  Crear Carpeta
                </button>
                <button type="button" onClick={() => setShowFolderForm(false)} className="security-btn btn-decline">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
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

      {showNoteForm && createPortal(
        <div className="explorer-security-overlay">
          <div className="explorer-security-modal animate-scale-up" style={{ maxWidth: '400px' }}>
            <div className="modal-security-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div className="shield-icon-bg" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
                <FileText size={24} />
              </div>
              <div>
                <h4 className="security-title" style={{ fontSize: '1.1rem' }}>Nueva Nota / Doc (.txt)</h4>
                <p className="security-subtitle">Crea un documento de anotaciones rápidas</p>
              </div>
            </div>

            <form onSubmit={handleNoteSubmit} className="security-content" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Nombre del Documento</label>
                <input 
                  type="text" 
                  placeholder="Ejemplo: Notas_Reparto" 
                  value={newNoteName}
                  onChange={(e) => setNewNoteName(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
                  autoFocus
                  required
                />
              </div>

              <div className="security-footer" style={{ marginTop: '8px', display: 'flex', justifyContent: 'end', gap: '8px' }}>
                <button type="submit" className="security-btn btn-accept" style={{ backgroundColor: '#d97706' }}>
                  Crear Nota
                </button>
                <button type="button" onClick={() => setShowNoteForm(false)} className="security-btn btn-decline">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
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
                <div className="folder-icon-wrapper" style={{ flexShrink: 0 }}>
                  <Folder className="folder-icon" size={32} />
                </div>
                
                {/* Center Column (Flex-grow) */}
                <div className="folder-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="folder-name-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <h4 className="item-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={folder.name}>
                      {folder.name}
                    </h4>
                    {folder.isCustom && (
                      <span className="custom-badge" style={{ flexShrink: 0 }}><Sparkles size={8} /> Creada</span>
                    )}
                  </div>
                  {folder.description && (
                    <p className="item-desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {folder.description}
                    </p>
                  )}
                </div>

                {/* Right Column (Flex-shrink: 0, Aligned right) */}
                <div className="card-right-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {onArchiveItem && folder.id !== 'archivo_folder' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchiveItem(folder.id);
                        }}
                        title="Archivar"
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', transition: 'transform 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <Archive size={14} />
                      </button>
                    )}
                    {folder.isCustom && onRenameItem && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newName = prompt(`Renombrar carpeta "${folder.name}" a:`, folder.name);
                          if (newName && newName.trim() !== '') {
                            onRenameItem(folder.id, newName.trim());
                          }
                        }}
                        title="Renombrar carpeta"
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', transition: 'transform 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
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
                  <ChevronRight className="arrow-icon" size={14} style={{ opacity: 0.6 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Virtual Files Grid */}
      {files.length > 0 && (
        <div className="vfs-section">
          <h3 className="section-title">Archivos de Planillas y Notas</h3>
          <div className="vfs-grid files-grid">
            {files.map(file => {
              const isNote = file.name.toLowerCase().endsWith('.txt') || file.id.startsWith('custom_note_');
              return (
                <div
                  key={file.id}
                  className={`vfs-card file-card ${isNote ? 'note-card-border' : ''}`}
                  onClick={() => onFileClick(file.id)}
                  onDoubleClick={() => onFileClick(file.id)}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, file.id)}
                  title={`Abrir archivo ${file.name} (Arrastralo a una carpeta para moverlo)`}
                >
                  <div className={`file-icon-wrapper ${isNote ? 'note-icon-wrapper' : ''}`} style={{ flexShrink: 0 }}>
                    {isNote ? (
                      <FileText className="file-icon text-amber-600" size={28} />
                    ) : (
                      <FileSpreadsheet className="file-icon" size={28} />
                    )}
                  </div>
                  
                  {/* Center Column (Flex-grow) */}
                  <div className="file-info" style={{ flex: 1, minWidth: 0 }}>
                    <div className="file-name-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <h4 className="item-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={file.name}>
                        {file.name}
                      </h4>
                      {file.isCustom && (
                        <span className="custom-badge" style={{ flexShrink: 0 }}>
                          <Sparkles size={8} /> {isNote ? 'Nota' : 'Personal'}
                        </span>
                      )}
                    </div>
                    {file.description && (
                      <p className="item-desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.description}
                      </p>
                    )}
                  </div>

                  {/* Right Column (Flex-shrink: 0, Aligned right) */}
                  <div className="card-right-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {onArchiveItem && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onArchiveItem(file.id);
                          }}
                          title="Archivar"
                          style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', transition: 'transform 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <Archive size={14} />
                        </button>
                      )}
                      {file.isCustom && onRenameItem && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newName = prompt(`Renombrar archivo "${file.name}" a:`, file.name);
                            if (newName && newName.trim() !== '') {
                              onRenameItem(file.id, newName.trim());
                            }
                          }}
                          title="Renombrar archivo"
                          style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', transition: 'transform 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
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
                    <span className={`file-badge-inline ${isNote ? 'note-badge-inline' : 'spreadsheet-badge-inline'}`} style={{ fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      {isNote ? 'Nota' : 'Planilla'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {items.length === 0 && !showFolderForm && !showFileForm && !showNoteForm && (
        <div className="vfs-empty-state">
          <HelpCircle size={48} className="text-gray-400 animate-bounce-subtle" />
          <p className="empty-text">No se encontraron carpetas ni archivos aquí.</p>
          <p className="empty-subtext">¡Crea tu primera carpeta, Excel o Nota con los botones superiores!</p>
        </div>
      )}

      {/* Drag & Drop Security Authorization Modal Overlay */}
      {pendingMove && createPortal(
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
                  <span className="type-icon">{movedItemObj?.type === 'folder' ? '📁' : movedItemObj?.name.toLowerCase().endsWith('.txt') ? '📝' : '📊'}</span>
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
        </div>,
        document.body
      )}
    </div>
  );
};
export default VFSBrowser;

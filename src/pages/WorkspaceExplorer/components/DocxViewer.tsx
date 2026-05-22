import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Save, FileText, Sparkles, Printer,
  MessageCircle, Truck, Check, Layers
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import type { VFSItem } from '../useWorkspaceExplorer';
import './DocxViewer.css'; // We'll add styles to style this beautifully

interface ExtendedVFSItem extends Omit<VFSItem, 'customData'> {
  customData?: {
    columns?: any[];
    rows?: any[];
    content?: string;
    printOptions?: any;
    status?: 'draft' | 'emitted' | 'received';
    notes?: string;
    stockCommitted?: boolean;
    shopInfo?: any;
    date?: string;
    hour?: string;
    supplierName?: string;
    leadTime?: string;
  };
}

interface DocxViewerProps {
  file: ExtendedVFSItem;
  onClose: () => void;
  onSaveChanges: (updatedData: any) => Promise<void> | void;
}

export const DocxViewer: React.FC<DocxViewerProps> = ({
  file,
  onClose,
  onSaveChanges,
}) => {
  const products = useStore(s => s.products);
  const updateProduct = useStore(s => s.updateProduct);
  const addNotification = useStore(s => s.addNotification);

  // Local state for interactive print options
  const [printOptions, setPrintOptions] = useState({
    showCode: true,
    showPrice: true,
    showSubtotal: true,
    showTotal: true,
    showEmisor: true,
    showProveedor: true,
    showNotes: true,
    showHandwritten: true
  });

  // Local state for status & notes
  const [status, setStatus] = useState<'draft' | 'emitted' | 'received'>('emitted');
  const [notes, setNotes] = useState('');
  const [stockCommitted, setStockCommitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state on load
  useEffect(() => {
    if (file && file.customData) {
      const data = file.customData;
      setPrintOptions(data.printOptions || {
        showCode: true,
        showPrice: true,
        showSubtotal: true,
        showTotal: true,
        showEmisor: true,
        showProveedor: true,
        showNotes: true,
        showHandwritten: true
      });
      setStatus(data.status || 'emitted');
      setNotes(data.notes || '');
      setStockCommitted(!!data.stockCommitted);
      setSaveSuccess(false);
    }
  }, [file]);

  const rows = useMemo(() => file.customData?.rows || [], [file]);
  const shopInfo = useMemo(() => file.customData?.shopInfo || {}, [file]);
  const dateStr = useMemo(() => file.customData?.date || '', [file]);
  const hourStr = useMemo(() => file.customData?.hour || '', [file]);
  const supplierName = useMemo(() => file.customData?.supplierName || 'Sin Proveedor', [file]);

  // Group items by category for rendering
  const groupedItems = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    rows.forEach((item: any) => {
      // Find category
      const matchedProd = products.find(p => p.id === item.id);
      const cat = matchedProd?.category || 'Sin Categoría';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    return grouped;
  }, [rows, products]);

  const grandTotal = useMemo(() => {
    return rows.reduce((sum: number, item: any) => sum + (item.quantity * item.cost), 0);
  }, [rows]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveChanges({
        printOptions,
        status,
        notes,
        stockCommitted
      });
      setSaveSuccess(true);
      addNotification('Cambios guardados con éxito en la orden', 'success');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      addNotification('Error al guardar los cambios', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Commit stock to Supabase/Zustand inventory
  const handleCommitStock = async () => {
    if (stockCommitted) return;
    try {
      setIsSaving(true);
      for (const item of rows) {
        const matchingProd = products.find(p => p.id === item.id);
        if (matchingProd) {
          const currentStock = matchingProd.stock ?? 0;
          await updateProduct(item.id, {
            stock: currentStock + item.quantity
          });
        }
      }
      setStockCommitted(true);
      await onSaveChanges({
        printOptions,
        status: 'received',
        notes,
        stockCommitted: true
      });
      addNotification('Existencias de la orden ingresadas con éxito en el stock', 'success');
    } catch (err) {
      addNotification('Error al cargar existencias en inventario', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Send WhatsApp Structured Text
  const handleSendWhatsApp = () => {
    let msg = `*SOLICITUD DE REPOSICIÓN: ${supplierName.toUpperCase()}*`;
    msg += `\n*Fecha:* ${dateStr || new Date().toLocaleDateString('es-AR')}`;
    msg += `\n*Estado:* ${status === 'received' ? 'Recibido / Entregado' : status === 'emitted' ? 'Emitido' : 'Borrador'}`;
    
    if (printOptions.showEmisor && shopInfo.name) {
      msg += `\n\n*EMISOR:* ${shopInfo.name}`;
      if (shopInfo.phone) msg += `\n📞 *Contacto:* ${shopInfo.phone}`;
      if (shopInfo.address) msg += `\n📍 *Dirección:* ${shopInfo.address}`;
    }

    msg += `\n\n*ÍTEMS SOLICITADOS:*`;
    rows.forEach((i: any) => {
      let line = `\n• [${i.quantity} un.] ${i.name}`;
      if (printOptions.showCode && i.code) line += ` (Cód: ${i.code})`;
      if (printOptions.showPrice) line += ` - Costo: $${i.cost.toLocaleString('es-AR')}`;
      if (printOptions.showSubtotal) line += ` - Subtotal: $${(i.quantity * i.cost).toLocaleString('es-AR')}`;
      msg += line;
    });

    if (printOptions.showTotal && grandTotal > 0) {
      msg += `\n\n💰 *Total Estimado:* $${grandTotal.toLocaleString('es-AR')}`;
    }
    if (printOptions.showNotes && notes) {
      msg += `\n\n📝 *Notas:* ${notes}`;
    }
    msg += `\n\n¡Muchas gracias!`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="docx-viewer-container fade-in">
      {/* Upper premium controller panel */}
      <div className="docx-viewer-header no-print">
        <div className="docx-viewer-title-area">
          <div className="docx-viewer-icon-badge">
            <FileText size={22} className="text-emerald-500 animate-pulse-subtle" />
          </div>
          <div>
            <div className="docx-viewer-filename-row">
              <h3 className="docx-viewer-filename">{file.name}</h3>
              <span className="docx-viewer-type-badge">
                <Sparkles size={10} className="glow-icon" /> Microsoft Word (.docx)
              </span>
            </div>
            <p className="docx-viewer-description">
              Orden Oficial de Pedido VFS • Sincronización en Tiempo Real
            </p>
          </div>
        </div>

        <div className="docx-viewer-actions">
          {/* Status Badge & Select */}
          <div className="docx-status-picker">
            <label>Estado del Pedido:</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className={`docx-status-select docx-status-select--${status}`}
            >
              <option value="draft">📁 Borrador / En Creación</option>
              <option value="emitted">🔵 Emitido / Enviado</option>
              <option value="received">🟢 Obtenido / Recibido</option>
            </select>
          </div>

          <button
            onClick={handleSave}
            className={`docx-btn btn-save ${saveSuccess ? 'btn-saved-active' : ''}`}
            disabled={isSaving}
          >
            <Save size={16} />
            <span>{isSaving ? 'Guardando...' : saveSuccess ? '¡Guardado!' : 'Guardar'}</span>
          </button>

          <button onClick={handleSendWhatsApp} className="docx-btn btn-whatsapp" title="Enviar pedido por WhatsApp">
            <MessageCircle size={16} />
            <span>WhatsApp</span>
          </button>

          <button onClick={handlePrint} className="docx-btn btn-print" title="Imprimir hoja A4">
            <Printer size={16} />
            <span>Imprimir</span>
          </button>

          <button onClick={onClose} className="docx-btn btn-close-docx" title="Cerrar visor">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main dashboard content (Toggles & Paper Viewport) */}
      <div className="docx-viewer-content">
        
        {/* Toggles Sidebar */}
        <div className="docx-sidebar-panel no-print">
          <div className="docx-sidebar-card">
            <h4>⚙️ Personalización A4</h4>
            <p className="text-xs text-muted mb-4">
              Activá o desactivá los componentes visuales de la hoja de pedido en tiempo real.
            </p>
            <div className="docx-toggles-list">
              <label className={`docx-toggle-item ${printOptions.showEmisor ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={printOptions.showEmisor}
                  onChange={() => setPrintOptions(p => ({ ...p, showEmisor: !p.showEmisor }))}
                />
                <span>Datos del Emisor</span>
              </label>
              <label className={`docx-toggle-item ${printOptions.showProveedor ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={printOptions.showProveedor}
                  onChange={() => setPrintOptions(p => ({ ...p, showProveedor: !p.showProveedor }))}
                />
                <span>Datos del Proveedor</span>
              </label>
              <label className={`docx-toggle-item ${printOptions.showCode ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={printOptions.showCode}
                  onChange={() => setPrintOptions(p => ({ ...p, showCode: !p.showCode }))}
                />
                <span>Código de Producto</span>
              </label>
              <label className={`docx-toggle-item ${printOptions.showPrice ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={printOptions.showPrice}
                  onChange={() => setPrintOptions(p => ({ ...p, showPrice: !p.showPrice }))}
                />
                <span>Costo Unitario</span>
              </label>
              <label className={`docx-toggle-item ${printOptions.showSubtotal ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={printOptions.showSubtotal}
                  onChange={() => setPrintOptions(p => ({ ...p, showSubtotal: !p.showSubtotal }))}
                />
                <span>Subtotales por Fila</span>
              </label>
              <label className={`docx-toggle-item ${printOptions.showTotal ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={printOptions.showTotal}
                  onChange={() => setPrintOptions(p => ({ ...p, showTotal: !p.showTotal }))}
                />
                <span>Total Estimado</span>
              </label>
              <label className={`docx-toggle-item ${printOptions.showNotes ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={printOptions.showNotes}
                  onChange={() => setPrintOptions(p => ({ ...p, showNotes: !p.showNotes }))}
                />
                <span>Observaciones / Notas</span>
              </label>
              <label className={`docx-toggle-item ${printOptions.showHandwritten ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={printOptions.showHandwritten}
                  onChange={() => setPrintOptions(p => ({ ...p, showHandwritten: !p.showHandwritten }))}
                />
                <span>Ajustes a Mano (Líneas)</span>
              </label>
            </div>
          </div>

          {/* Workflow Status Actions Box */}
          {status === 'received' && (
            <div className="docx-sidebar-card docx-sidebar-card--inventory mt-4">
              <div className="flex items-center gap-2 mb-2 text-emerald-600">
                <Truck size={18} />
                <h4 className="m-0 text-emerald-800">Recibo e Inventario</h4>
              </div>
              {stockCommitted ? (
                <div className="docx-committed-success">
                  <Check size={14} />
                  <span>Existencias ingresadas con éxito en el stock del negocio.</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-600 mb-4">
                    Esta orden fue marcada como <strong>"Recibida"</strong>. Hacé clic abajo para sumar los productos recibidos directamente a tu inventario real de Supabase.
                  </p>
                  <button
                    onClick={handleCommitStock}
                    disabled={isSaving}
                    className="rd-btn rd-btn--success w-full justify-center"
                  >
                    <Layers size={14} />
                    <span>Cargar Stock en Inventario</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Paper Canvas Preview Area */}
        <div className="docx-paper-wrapper">
          <div id="rd-paper-to-print" className="rd-paper-sheet docx-sheet-a4">
            
            {/* Header / Brand */}
            <div className="rd-paper-header">
              <div className="rd-paper-header__logo">
                {printOptions.showEmisor && shopInfo.name ? shopInfo.name.toUpperCase() : 'MI JARDÍN'}
              </div>
              <div className="rd-paper-header__subtitle">Orden de Compra y Reposición</div>
              <div className="rd-paper-header__line"></div>
            </div>

            {/* Meta Grid */}
            <div className="rd-paper-meta-grid">
              {printOptions.showEmisor ? (
                <div className="rd-paper-meta-section">
                  <p><strong>EMISOR:</strong> {shopInfo.name || 'Mi Jardín'}</p>
                  {shopInfo.phone && <p><strong>Teléfono:</strong> {shopInfo.phone}</p>}
                  {shopInfo.address && <p><strong>Dirección:</strong> {shopInfo.address}</p>}
                  {shopInfo.instagram && <p><strong>Instagram:</strong> @{shopInfo.instagram.replace(/^@/, '')}</p>}
                </div>
              ) : (
                <div className="rd-paper-meta-section">
                  <p className="text-slate-400 italic">Datos de emisor ocultados</p>
                </div>
              )}
              
              <div className="rd-paper-meta-section rd-paper-meta-section--right">
                <p><strong>Fecha:</strong> {dateStr || new Date().toLocaleDateString('es-AR')}</p>
                {hourStr && <p><strong>Hora:</strong> {hourStr}</p>}
                <p>
                  <strong>Estado:</strong>{' '}
                  <span className={`rd-paper-status-badge rd-paper-status-badge--${status}`}>
                    {status === 'draft' ? 'Borrador / En Creación' : status === 'emitted' ? 'Emitido / Enviado' : 'Obtenido / Recibido'}
                  </span>
                </p>
              </div>
            </div>

            {/* Provider Section */}
            {printOptions.showProveedor && (
              <div className="docx-paper-provider-block">
                <Truck size={14} className="text-emerald-700" />
                <span><strong>PROVEEDOR:</strong> {supplierName.toUpperCase()}</span>
              </div>
            )}

            {/* Document Content List */}
            <div className="rd-paper-content-list mt-4">
              {Object.keys(groupedItems).length === 0 ? (
                <div className="rd-paper-empty-items">No hay productos en este documento.</div>
              ) : (
                Object.entries(groupedItems).map(([category, items]) => (
                  <div key={category} className="rd-paper-category-group">
                    <h3 className="rd-paper-category-title">{category.toUpperCase()}</h3>
                    <table className="rd-paper-items-table">
                      <thead>
                        <tr>
                          {printOptions.showCode && <th style={{ width: '15%' }}>Código</th>}
                          <th style={{ width: printOptions.showCode ? '45%' : '60%' }}>Producto</th>
                          <th style={{ width: '15%' }} className="rd-txt-right">Cant.</th>
                          {printOptions.showPrice && <th style={{ width: '12%' }} className="rd-txt-right">Costo U.</th>}
                          {printOptions.showSubtotal && <th style={{ width: '13%' }} className="rd-txt-right">Subtotal</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item: any) => (
                          <tr key={item.id}>
                            {printOptions.showCode && <td>{item.code}</td>}
                            <td>
                              {item.isCustom && <span className="rd-libre-badge-vfs mr-1">LIBRE</span>}
                              {item.name}
                            </td>
                            <td className="rd-txt-right"><strong>{item.quantity}</strong></td>
                            {printOptions.showPrice && (
                              <td className="rd-txt-right">${item.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            )}
                            {printOptions.showSubtotal && (
                              <td className="rd-txt-right">${(item.quantity * item.cost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>

            {/* Grand Total */}
            {printOptions.showTotal && grandTotal > 0 && (
              <div className="rd-paper-totals-box">
                Total Estimado: <strong>${grandTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
              </div>
            )}

            {/* Observations */}
            {printOptions.showNotes && (
              <div className="rd-paper-note-block mt-4">
                <h4>📝 Observaciones del Pedido:</h4>
                <textarea
                  className="docx-canvas-notes-textarea no-print"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Escribe comentarios u observaciones aquí..."
                />
                <p className="print-only text-sm text-slate-700 whitespace-pre-wrap">{notes || 'Sin observaciones'}</p>
              </div>
            )}

            {/* Dotted lines for handwritten notes */}
            {printOptions.showHandwritten && (
              <div className="rd-paper-handwritten mt-6">
                <h4>✍️ Ajustes y Notas a Mano (Espacio de Trabajo):</h4>
                <div className="rd-paper-handwritten-dotted"></div>
                <div className="rd-paper-handwritten-dotted"></div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

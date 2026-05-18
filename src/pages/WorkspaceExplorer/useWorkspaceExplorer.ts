import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';

export interface Column {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: 'currency' | 'date';
  badge?: boolean;
}

export interface VFSItem {
  id: string;
  name: string;
  parentId: string | null;
  type: 'folder' | 'file';
  entity?: 'products' | 'categories' | 'orders' | 'customers' | 'suppliers';
  description?: string;
  color?: string; // modern pastel color for the card or icon
}

// Define the static virtual structure
const VFS_ITEMS: VFSItem[] = [
  // --- Folders in Root ---
  {
    id: 'inventario',
    name: 'Inventario y Catálogo',
    parentId: 'root',
    type: 'folder',
    description: 'Administración de stock, precios y categorías',
    color: '#ecfdf5', // light emerald
  },
  {
    id: 'ventas_finanzas',
    name: 'Ventas y Finanzas',
    parentId: 'root',
    type: 'folder',
    description: 'Registro de pedidos, ventas e ingresos del negocio',
    color: '#eff6ff', // light blue
  },
  {
    id: 'clientes_folder',
    name: 'Clientes y Relaciones',
    parentId: 'root',
    type: 'folder',
    description: 'Directorio y agenda de contactos de clientes',
    color: '#faf5ff', // light purple
  },
  {
    id: 'proveedores_folder',
    name: 'Proveedores y Compras',
    parentId: 'root',
    type: 'folder',
    description: 'Control de proveedores y órdenes de compras',
    color: '#fff7ed', // light orange
  },

  // --- Files in Inventario ---
  {
    id: 'productos_xlsx',
    name: 'Productos.xlsx',
    parentId: 'inventario',
    type: 'file',
    entity: 'products',
    description: 'Listado completo de stock, códigos de barra, costos y precios',
  },
  {
    id: 'categorias_xlsx',
    name: 'Categorías de Productos.xlsx',
    parentId: 'inventario',
    type: 'file',
    entity: 'categories',
    description: 'Árbol de categorías y agrupamiento del catálogo',
  },

  // --- Files in Ventas y Finanzas ---
  {
    id: 'pedidos_xlsx',
    name: 'Pedidos y Envíos.xlsx',
    parentId: 'ventas_finanzas',
    type: 'file',
    entity: 'orders',
    description: 'Pedidos pendientes, entregas asignadas y estados',
  },

  // --- Files in Clientes ---
  {
    id: 'clientes_xlsx',
    name: 'Base de Clientes.xlsx',
    parentId: 'clientes_folder',
    type: 'file',
    entity: 'customers',
    description: 'Directorio con teléfonos, emails y balances de cuenta corriente',
  },

  // --- Files in Proveedores ---
  {
    id: 'proveedores_xlsx',
    name: 'Directorio de Proveedores.xlsx',
    parentId: 'proveedores_folder',
    type: 'file',
    entity: 'suppliers',
    description: 'Proveedores registrados y compras realizadas',
  },
];

export const useWorkspaceExplorer = () => {
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Access existing Zustand stores
  const store = useStore();

  // Reset active file when folder changes
  const navigateToFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    setActiveFileId(null);
    setSearchQuery('');
  };

  const openFile = (fileId: string) => {
    setActiveFileId(fileId);
    setSearchQuery('');
  };

  const closeFile = () => {
    setActiveFileId(null);
    setSearchQuery('');
  };

  // Get path list for breadcrumbs
  const breadcrumbs = useMemo(() => {
    const list: { id: string; name: string }[] = [{ id: 'root', name: 'Mi Negocio' }];
    if (currentFolderId === 'root') return list;

    const folder = VFS_ITEMS.find((item) => item.id === currentFolderId && item.type === 'folder');
    if (folder) {
      list.push({ id: folder.id, name: folder.name });
    }
    return list;
  }, [currentFolderId]);

  // List folder contents
  const currentItems = useMemo(() => {
    return VFS_ITEMS.filter((item) => item.parentId === currentFolderId);
  }, [currentFolderId]);

  // Go to parent directory
  const goBack = () => {
    if (activeFileId) {
      closeFile();
      return;
    }
    if (currentFolderId === 'root') return;
    const folder = VFS_ITEMS.find((item) => item.id === currentFolderId && item.type === 'folder');
    if (folder && folder.parentId) {
      navigateToFolder(folder.parentId);
    } else {
      navigateToFolder('root');
    }
  };

  // Active file details
  const activeFile = useMemo(() => {
    if (!activeFileId) return null;
    return VFS_ITEMS.find((item) => item.id === activeFileId && item.type === 'file') || null;
  }, [activeFileId]);

  // Load backend data trigger if store is empty
  const triggerLoadData = async (entity: string) => {
    try {
      if (entity === 'products' && store.products.length === 0) {
        await store.loadProducts();
      }
      if (entity === 'products' && store.categoriesData.length === 0) {
        await store.loadCategories(true);
      }
      if (entity === 'categories' && store.categoriesData.length === 0) {
        await store.loadCategories(true);
      }
      if (entity === 'orders' && store.orders.length === 0) {
        await store.loadOrders();
      }
      if (entity === 'customers' && store.customers.length === 0) {
        await store.loadCustomers();
      }
      if (entity === 'suppliers' && store.suppliers.length === 0) {
        await store.loadSuppliers();
      }
    } catch (e) {
      console.error(`Failed to load data for entity ${entity}:`, e);
    }
  };

  // Map active file data to a plain row list for visual spreadsheet representation
  const spreadsheetData = useMemo<{ columns: Column[]; rows: any[] }>(() => {
    if (!activeFile) return { columns: [], rows: [] };
    const entity = activeFile.entity;
    if (!entity) return { columns: [], rows: [] };

    // Trigger lazy loading
    triggerLoadData(entity);

    switch (entity) {
      case 'products':
        return {
          columns: [
            { key: 'code', label: 'Código', width: 120 },
            { key: 'name', label: 'Nombre del Producto', width: 250 },
            { key: 'category_name', label: 'Categoría', width: 150 },
            { key: 'stock_quantity', label: 'Stock Actual', width: 110, align: 'right', badge: true },
            { key: 'cost', label: 'Costo ($)', width: 110, align: 'right', format: 'currency' },
            { key: 'price', label: 'Precio Venta ($)', width: 120, align: 'right', format: 'currency' },
            { key: 'is_active', label: 'Estado', width: 100, align: 'center', badge: true }
          ],
          rows: store.products.map(p => ({
            id: p.id,
            code: p.code || 'S/C',
            name: p.name,
            category_name: p.category || 'Sin Categoría',
            stock_quantity: p.stock ?? 0,
            cost: p.cost ?? 0,
            price: p.price ?? 0,
            is_active: 'Activo'
          }))
        };

      case 'categories':
        return {
          columns: [
            { key: 'name', label: 'Categoría', width: 250 },
            { key: 'parent_name', label: 'Categoría Padre', width: 200 },
            { key: 'is_active', label: 'Estado', width: 120, align: 'center', badge: true }
          ],
          rows: store.categoriesData.map(c => {
            const parent = store.categoriesData.find(pc => pc.id === c.parent_id);
            return {
              id: c.id,
              name: c.name,
              parent_name: parent ? parent.name : 'Raíz',
              is_active: 'Activo'
            };
          })
        };

      case 'orders':
        return {
          columns: [
            { key: 'orderNumber', label: 'Pedido #', width: 100, align: 'center' },
            { key: 'customerName', label: 'Cliente', width: 220 },
            { key: 'date', label: 'Fecha Entrega', width: 130, format: 'date' },
            { key: 'deliveryMethod', label: 'Método', width: 120, badge: true },
            { key: 'total', label: 'Total ($)', width: 120, align: 'right', format: 'currency' },
            { key: 'advancePayment', label: 'Seña ($)', width: 110, align: 'right', format: 'currency' },
            { key: 'status', label: 'Estado Pago/Entrega', width: 150, align: 'center', badge: true }
          ],
          rows: store.orders.map(o => {
            const statusLabels: Record<string, string> = {
              pending: 'Pendiente',
              assembling: 'Armando',
              ready: 'Listo para retirar',
              out_for_delivery: 'En camino',
              delivered: 'Entregado',
              cancelled: 'Cancelado',
              archived: 'Archivado'
            };
            return {
              id: o.id,
              orderNumber: o.orderNumber ? `#${o.orderNumber}` : 'S/N',
              customerName: o.customerName,
              date: o.date,
              deliveryMethod: o.deliveryMethod === 'delivery' ? 'Envío a Domicilio' : 'Retiro Local',
              total: o.total,
              advancePayment: o.advancePayment || 0,
              status: statusLabels[o.status] || o.status
            };
          })
        };

      case 'customers':
        return {
          columns: [
            { key: 'name', label: 'Nombre Completo', width: 250 },
            { key: 'phone', label: 'Teléfono', width: 150 },
            { key: 'email', label: 'Correo Electrónico', width: 220 },
            { key: 'address', label: 'Dirección Principal', width: 250 },
            { key: 'debtBalance', label: 'Saldo Cta. Corriente ($)', width: 160, align: 'right', format: 'currency', badge: true }
          ],
          rows: store.customers.map(c => {
            const fullAddress = [c.address_street, c.address_number, c.address_floor, c.address_city]
              .filter(Boolean)
              .join(' ');
            return {
              id: c.id,
              name: c.name,
              phone: c.phone || 'Sin Teléfono',
              email: c.email || 'Sin Email',
              address: fullAddress || 'Sin Dirección',
              debtBalance: c.debtBalance || 0
            };
          })
        };

      case 'suppliers':
        return {
          columns: [
            { key: 'name', label: 'Proveedor', width: 220 },
            { key: 'contactName', label: 'Contacto', width: 180 },
            { key: 'phone', label: 'Teléfono', width: 140 },
            { key: 'address', label: 'Dirección', width: 250 },
            { key: 'category', label: 'Rubro/Categoría', width: 150 }
          ],
          rows: store.suppliers.map(s => ({
            id: s.id,
            name: s.name,
            contactName: s.contactName || '-',
            phone: s.phone || 'Sin Teléfono',
            address: s.address || '-',
            category: s.category || '-'
          }))
        };

      default:
        return { columns: [], rows: [] };
    }
  }, [activeFile, store.products, store.categoriesData, store.orders, store.customers, store.suppliers]);

  // Global search filtering of files/folders + internal search for spreadsheet active view
  const filteredItems = useMemo(() => {
    if (!searchQuery) return currentItems;
    const lowerQuery = searchQuery.toLowerCase();
    
    // In root/folder view, search filters matching items recursively or matching currently listed items
    return currentItems.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerQuery) ||
        (item.description && item.description.toLowerCase().includes(lowerQuery))
    );
  }, [currentItems, searchQuery]);

  const filteredSpreadsheetRows = useMemo(() => {
    const { rows } = spreadsheetData;
    if (!searchQuery) return rows;
    const lowerQuery = searchQuery.toLowerCase();

    return rows.filter((row: any) => {
      return Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(lowerQuery);
      });
    });
  }, [spreadsheetData, searchQuery]);

  return {
    currentFolderId,
    activeFileId,
    searchQuery,
    setSearchQuery,
    navigateToFolder,
    openFile,
    closeFile,
    breadcrumbs,
    currentItems: filteredItems,
    goBack,
    activeFile,
    spreadsheetColumns: spreadsheetData.columns,
    spreadsheetRows: filteredSpreadsheetRows,
    totalCount: spreadsheetData.rows.length,
    filteredCount: filteredSpreadsheetRows.length,
    isLoading: store.isLoading,
  };
};

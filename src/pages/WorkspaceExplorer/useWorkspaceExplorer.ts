import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';

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
  entity?: 'products' | 'categories' | 'orders' | 'customers' | 'suppliers' | 'custom';
  description?: string;
  color?: string; // modern pastel color for the card or icon
  isCustom?: boolean;
  customData?: {
    columns: Column[];
    rows: any[];
  };
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

// Helper to get descendant category IDs recursively
const getDescendantCategoryIds = (catId: string, categories: any[]): string[] => {
  const ids = [catId];
  const findChildren = (parentId: string) => {
    const children = categories.filter(c => c.parent_id === parentId);
    const cat = categories.find(c => c.id === parentId);
    const nestedChildren = cat?.children || [];
    const allChildren = [...children, ...nestedChildren];

    allChildren.forEach(ch => {
      if (!ids.includes(ch.id)) {
        ids.push(ch.id);
        findChildren(ch.id);
      }
    });
  };
  findChildren(catId);
  return ids;
};

export const useWorkspaceExplorer = () => {
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const store = useStore();
  const { user } = useAuth();
  const businessId = user?.business_id || 'default_business';

  // State for user created items (folders and files)
  const [customItems, setCustomItems] = useState<VFSItem[]>([]);

  // State for custom Drag & Drop location overrides of items
  const [itemParents, setItemParents] = useState<Record<string, string>>({});

  // Load user data on startup/auth change
  useEffect(() => {
    if (businessId) {
      const itemsKey = `explorer_custom_items_${businessId}`;
      const parentsKey = `explorer_item_parents_${businessId}`;
      
      const customItemsData = localStorage.getItem(itemsKey);
      if (customItemsData) {
        try {
          setCustomItems(JSON.parse(customItemsData));
        } catch (e) {
          console.error('Failed to parse custom items:', e);
        }
      } else {
        setCustomItems([]);
      }

      const parentsData = localStorage.getItem(parentsKey);
      if (parentsData) {
        try {
          setItemParents(JSON.parse(parentsData));
        } catch (e) {
          console.error('Failed to parse item parents:', e);
        }
      } else {
        setItemParents({});
      }
    }
  }, [businessId]);

  const persistCustomItems = (newItems: VFSItem[]) => {
    setCustomItems(newItems);
    if (businessId) {
      localStorage.setItem(`explorer_custom_items_${businessId}`, JSON.stringify(newItems));
    }
  };

  const persistItemParent = (itemId: string, newParentId: string) => {
    setItemParents(prev => {
      const next = { ...prev, [itemId]: newParentId };
      if (businessId) {
        localStorage.setItem(`explorer_item_parents_${businessId}`, JSON.stringify(next));
      }
      return next;
    });
  };

  // Helper to create a folder
  const createFolder = (name: string) => {
    const newFolder: VFSItem = {
      id: `custom_folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim() || 'Nueva Carpeta',
      parentId: currentFolderId,
      type: 'folder',
      description: 'Carpeta creada por el usuario',
      color: '#f8fafc',
      isCustom: true
    };
    persistCustomItems([...customItems, newFolder]);
  };

  // Helper to create an Excel file
  const createExcelFile = (name: string, templateType: 'empty' | 'products' | 'customers' | 'orders' = 'empty') => {
    let fileName = name.trim();
    if (!fileName.toLowerCase().endsWith('.xlsx')) {
      fileName += '.xlsx';
    }

    let columns: Column[] = [];
    let rows: any[] = [];

    if (templateType === 'empty') {
      columns = [
        { key: 'col1', label: 'Columna 1', width: 150 },
        { key: 'col2', label: 'Columna 2', width: 150 },
        { key: 'col3', label: 'Columna 3', width: 150 }
      ];
      rows = [
        { id: '1', col1: 'Valor A', col2: 'Valor B', col3: 'Valor C' },
        { id: '2', col1: '', col2: '', col3: '' }
      ];
    } else if (templateType === 'products') {
      columns = [
        { key: 'code', label: 'Código', width: 120 },
        { key: 'name', label: 'Nombre del Producto', width: 250 },
        { key: 'stock_quantity', label: 'Stock Actual', width: 110, align: 'right', badge: true },
        { key: 'cost', label: 'Costo ($)', width: 110, align: 'right', format: 'currency' },
        { key: 'price', label: 'Precio Venta ($)', width: 120, align: 'right', format: 'currency' }
      ];
      rows = store.products.map(p => ({
        id: p.id,
        code: p.code || 'S/C',
        name: p.name,
        stock_quantity: p.stock ?? 0,
        cost: p.cost ?? 0,
        price: p.price ?? 0
      }));
    } else if (templateType === 'customers') {
      columns = [
        { key: 'name', label: 'Nombre Completo', width: 250 },
        { key: 'phone', label: 'Teléfono', width: 150 },
        { key: 'email', label: 'Correo Electrónico', width: 220 }
      ];
      rows = store.customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone || 'Sin Teléfono',
        email: c.email || 'Sin Email'
      }));
    } else if (templateType === 'orders') {
      columns = [
        { key: 'orderNumber', label: 'Pedido #', width: 100, align: 'center' },
        { key: 'customerName', label: 'Cliente', width: 220 },
        { key: 'total', label: 'Total ($)', width: 120, align: 'right', format: 'currency' }
      ];
      rows = store.orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber ? `#${o.orderNumber}` : 'S/N',
        customerName: o.customerName,
        total: o.total
      }));
    }

    const newFile: VFSItem = {
      id: `custom_file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: fileName,
      parentId: currentFolderId,
      type: 'file',
      entity: 'custom',
      description: `Planilla personalizada (${templateType === 'empty' ? 'Vacía' : 'Plantilla ' + templateType})`,
      isCustom: true,
      customData: { columns, rows }
    };

    persistCustomItems([...customItems, newFile]);
  };

  // Helper to drag and drop move an item
  const moveItem = (itemId: string, newParentId: string) => {
    persistItemParent(itemId, newParentId);
  };

  // Dynamically compute the combined VFS structure including dynamic category folders, files and user custom elements
  const allVFSItems = useMemo<VFSItem[]>(() => {
    // Merge base items with custom items
    const rawItems = [...VFS_ITEMS, ...customItems];
    
    // Apply path/parent overrides from drag and drop
    const items = rawItems.map(item => {
      const overridenParentId = itemParents[item.id];
      return {
        ...item,
        parentId: overridenParentId !== undefined ? overridenParentId : item.parentId
      };
    });

    // Lazy load categories if they are empty
    if (store.categoriesData.length === 0 && !store.isLoading) {
      store.loadCategories(true);
    }

    // 1. Add "Explorar por Categoría" virtual folder under 'inventario' if not moved
    const catFolderParent = itemParents['categorias_folder'] !== undefined ? itemParents['categorias_folder'] : 'inventario';
    if (catFolderParent !== null) {
      items.push({
        id: 'categorias_folder',
        name: 'Explorar por Categoría',
        parentId: catFolderParent,
        type: 'folder',
        description: 'Navegá tu catálogo agrupado por sus carpetas de categorías',
        color: '#f0fdf4', // pastel light green
      });
    }

    // 2. Normalize categories into a tree structure
    const categoriesData = store.categoriesData || [];
    const isAlreadyNested = categoriesData.some(c => c.children && c.children.length > 0);
    
    const catTree = isAlreadyNested 
      ? categoriesData 
      : (() => {
          const buildTree = (parentId: string | null = null): any[] => {
            return categoriesData
              .filter(c => c.parent_id === parentId || (parentId === null && !c.parent_id))
              .map(c => ({
                ...c,
                children: buildTree(c.id)
              }));
          };
          return buildTree(null);
        })();

    // 3. Recursive function to collect all categories and subcategories from the tree
    const collectCategories = (cats: any[], parentFolderId: string) => {
      cats.forEach(c => {
        const folderId = `category_dir_${c.id}`;
        const folderParent = itemParents[folderId] !== undefined ? itemParents[folderId] : parentFolderId;
        const fileId = `category_file_${c.id}`;
        const fileParent = itemParents[fileId] !== undefined ? itemParents[fileId] : folderId;

        // Add category folder if parent exists
        if (folderParent !== null) {
          items.push({
            id: folderId,
            name: c.name,
            parentId: folderParent,
            type: 'folder',
            description: `Productos en categoría ${c.name}`,
            color: '#f0fdf4',
          });
        }

        // Add category products spreadsheet inside its category folder
        if (fileParent !== null) {
          items.push({
            id: fileId,
            name: `${c.name}.xlsx`,
            parentId: fileParent,
            type: 'file',
            entity: 'products',
            description: `Planilla con los productos de la categoría ${c.name}`,
          });
        }

        // Recursively add children as subfolders
        if (c.children && c.children.length > 0) {
          collectCategories(c.children, folderId);
        }
      });
    };

    if (catTree && catTree.length > 0) {
      collectCategories(catTree, 'categorias_folder');
    }

    return items;
  }, [store.categoriesData, store.isLoading, customItems, itemParents]);

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

  // Get path list for breadcrumbs recursively
  const breadcrumbs = useMemo(() => {
    const list: { id: string; name: string }[] = [{ id: 'root', name: 'Mi Negocio' }];
    if (currentFolderId === 'root') return list;

    const path: { id: string; name: string }[] = [];
    let currentId = currentFolderId;

    while (currentId && currentId !== 'root') {
      const folder = allVFSItems.find((item) => item.id === currentId && item.type === 'folder');
      if (folder) {
        path.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parentId || 'root';
      } else {
        break;
      }
    }
    return [...list, ...path];
  }, [currentFolderId, allVFSItems]);

  // List folder contents
  const currentItems = useMemo(() => {
    return allVFSItems.filter((item) => item.parentId === currentFolderId);
  }, [currentFolderId, allVFSItems]);

  // Go to parent directory
  const goBack = () => {
    if (activeFileId) {
      closeFile();
      return;
    }
    if (currentFolderId === 'root') return;
    const folder = allVFSItems.find((item) => item.id === currentFolderId && item.type === 'folder');
    if (folder && folder.parentId) {
      navigateToFolder(folder.parentId);
    } else {
      navigateToFolder('root');
    }
  };

  // Active file details
  const activeFile = useMemo(() => {
    if (!activeFileId) return null;
    return allVFSItems.find((item) => item.id === activeFileId && item.type === 'file') || null;
  }, [activeFileId, allVFSItems]);

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

    if (entity === 'custom') {
      return {
        columns: activeFile.customData?.columns || [],
        rows: activeFile.customData?.rows || []
      };
    }

    // Trigger lazy loading
    triggerLoadData(entity);

    switch (entity) {
      case 'products': {
        const isCategoryFile = activeFile.id.startsWith('category_file_');
        const categoryId = isCategoryFile ? activeFile.id.replace('category_file_', '') : null;
        
        const categoryIds = categoryId 
          ? getDescendantCategoryIds(categoryId, store.categoriesData)
          : [];

        const productsList = categoryId 
          ? store.products.filter(p => p.category_id && categoryIds.includes(p.category_id))
          : store.products;

        return {
          columns: [
            { key: 'code', label: 'Código', width: 120 },
            { key: 'name', label: 'Nombre del Producto', width: 250 },
            { key: 'category_name', label: 'Categoría', width: 150 },
            { key: 'stock_quantity', label: 'Stock Actual', width: 110, align: 'right', badge: true },
            { key: 'cost', label: 'Costo ($)', width: 110, align: 'right', format: 'currency' },
            { key: 'price', label: 'Precio Venta ($)', width: 120, align: 'right', format: 'currency' }
          ],
          rows: productsList.map(p => ({
            id: p.id,
            code: p.code || 'S/C',
            name: p.name,
            category_name: p.category || 'Sin Categoría',
            stock_quantity: p.stock ?? 0,
            cost: p.cost ?? 0,
            price: p.price ?? 0
          }))
        };
      }

      case 'categories':
        return {
          columns: [
            { key: 'name', label: 'Categoría', width: 250 },
            { key: 'parent_name', label: 'Categoría Padre', width: 200 }
          ],
          rows: store.categoriesData.map(c => {
            const parent = store.categoriesData.find(pc => pc.id === c.parent_id);
            return {
              id: c.id,
              name: c.name,
              parent_name: parent ? parent.name : 'Raíz'
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
  }, [activeFile, store.products, store.categoriesData, store.orders, store.customers, store.suppliers, customItems]);

  // Global search filtering of files/folders + internal search for spreadsheet active view
  const filteredItems = useMemo(() => {
    if (!searchQuery) return currentItems;
    const lowerQuery = searchQuery.toLowerCase();
    
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

  // Handle saving cell modifications made in SpreadsheetViewer back to Zustand stores or custom local list
  const saveSpreadsheetChanges = async (fileId: string, updatedRows: any[], changes: Array<{ id: string; key: string; oldValue: any; newValue: any }>) => {
    const isCustom = customItems.some(i => i.id === fileId);
    
    if (isCustom) {
      const updated = customItems.map(item => {
        if (item.id === fileId) {
          return {
            ...item,
            customData: {
              columns: item.customData?.columns || [],
              rows: updatedRows
            }
          };
        }
        return item;
      });
      persistCustomItems(updated);
    } else {
      const file = allVFSItems.find(i => i.id === fileId);
      const entity = file?.entity;
      if (!entity) return;

      // Persist changes one by one into the live database stores
      for (const change of changes) {
        const { id, key, newValue } = change;
        
        if (entity === 'products') {
          const mappedUpdates: any = {};
          if (key === 'name') mappedUpdates.name = String(newValue);
          if (key === 'code') mappedUpdates.code = String(newValue);
          if (key === 'stock_quantity') mappedUpdates.stock = Number(newValue);
          if (key === 'cost') mappedUpdates.cost = Number(newValue);
          if (key === 'price') mappedUpdates.price = Number(newValue);
          
          await store.updateProduct(id, mappedUpdates);
        } else if (entity === 'customers') {
          const mappedUpdates: any = {};
          if (key === 'name') mappedUpdates.name = String(newValue);
          if (key === 'phone') mappedUpdates.phone = String(newValue);
          if (key === 'email') mappedUpdates.email = String(newValue);
          if (key === 'debtBalance') mappedUpdates.debtBalance = Number(newValue);
          
          await store.updateCustomer(id, mappedUpdates);
        } else if (entity === 'suppliers') {
          const mappedUpdates: any = {};
          if (key === 'name') mappedUpdates.name = String(newValue);
          if (key === 'contactName') mappedUpdates.contactName = String(newValue);
          if (key === 'phone') mappedUpdates.phone = String(newValue);
          if (key === 'address') mappedUpdates.address = String(newValue);
          if (key === 'category') mappedUpdates.category = String(newValue);
          
          await store.updateSupplier(id, mappedUpdates);
        } else if (entity === 'orders') {
          if (key === 'status') {
            const statusMap: Record<string, string> = {
              'Pendiente': 'pending',
              'Armando': 'assembling',
              'Listo para retirar': 'ready',
              'En camino': 'out_for_delivery',
              'Entregado': 'delivered',
              'Cancelado': 'cancelled',
              'Archivado': 'archived'
            };
            const apiStatus = statusMap[newValue] || newValue;
            await store.updateOrderStatus(id, apiStatus as any);
          }
        }
      }

      // Re-trigger loading of store to refresh the table representation
      await triggerLoadData(entity);
    }
  };

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
    allItems: allVFSItems,
    goBack,
    activeFile,
    spreadsheetColumns: spreadsheetData.columns,
    spreadsheetRows: filteredSpreadsheetRows,
    totalCount: spreadsheetData.rows.length,
    filteredCount: filteredSpreadsheetRows.length,
    isLoading: store.isLoading,
    createFolder,
    createExcelFile,
    moveItem,
    saveSpreadsheetChanges,
  };
};

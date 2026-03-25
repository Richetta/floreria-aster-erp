import React from 'react';
import './PrintableCatalog.css';

interface Product {
  id: string;
  code: string;
  name: string;
  category?: string;
  price: number;
  stock: number;
}

interface PrintableCatalogProps {
  products: Product[];
  categoryName: string;
}

export const PrintableCatalog = React.forwardRef<HTMLDivElement, PrintableCatalogProps>(({ products, categoryName }, ref) => {
  const today = new Date().toLocaleDateString();

  return (
    <div ref={ref} className="printable-catalog">
      <div className="print-header">
        <div className="brand">
          <h1>Florería Aster</h1>
          <p>Catálogo de Productos</p>
        </div>
        <div className="info">
          <p><strong>Categoría:</strong> {categoryName}</p>
          <p><strong>Fecha:</strong> {today}</p>
        </div>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Producto</th>
            <th className="text-right">Precio</th>
            <th className="text-center">Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td className="font-mono">{p.code}</td>
              <td className="font-bold">{p.name}</td>
              <td className="text-right">${p.price.toLocaleString()}</td>
              <td className="text-center">{p.stock}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="print-footer">
        <p>Florería Aster ERP - Documento generado automáticamente</p>
      </div>
    </div>
  );
});

PrintableCatalog.displayName = 'PrintableCatalog';

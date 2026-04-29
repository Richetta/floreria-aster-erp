import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
    X, Upload, FileText, Check, AlertCircle,
    ChevronRight, FileSpreadsheet,
    Database, RefreshCw, PlusCircle, Sparkles,
    Search, Percent, DollarSign, CheckSquare, Square
} from 'lucide-react';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './CsvImportModal.css';
import { TreeSelect } from '../TreeSelect/TreeSelect';

interface CsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (result: any) => void;
}

interface ParsedRow {
    _id: string;
    selected: boolean;
    code: string;
    name: string;
    cost: number;
    margin: number;
    price: number;
    stock: number;
    category: string;
    subcategory: string;
    brand: string;
    [key: string]: any; // Allow indexing
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const parseDataIntoRows = (rawData: any[]): ParsedRow[] => {
    return rawData.map((row, idx) => {
        const getVal = (keys: string[]) => {
            if (!row) return '';
            for (const k of keys) {
                const foundKey = Object.keys(row).find(rk => {
                    const rkLow = rk.toLowerCase().trim();
                    const kLow = k.toLowerCase().trim();
                    return rkLow === kLow || rkLow.includes(kLow);
                });
                if (foundKey) return row[foundKey];
            }
            return '';
        };

        const code = getVal(['código', 'codigo', 'code', 'sku', 'ref']) || '';
        const name = getVal(['nombre', 'name', 'producto', 'artículo', 'articulo', 'desc']) || `Producto Sin Nombre (${idx + 1})`;
        const costRaw = getVal(['costo', 'cost', 'precio de costo', 'precio costo', 'compra', '($$)']);
        const priceRaw = getVal(['precio', 'price', 'precio de venta', 'venta', '($)']);
        const stockRaw = getVal(['stock', 'cantidad', 'qty', 'quantity', '(+)']);
        const category = getVal(['categoría', 'categoria', 'category', 'rubro', 'carpeta', 'grupo']);
        const subcategory = getVal(['subcategoría', 'subcategoria', 'subcategory', 'subcarpeta', 'sub-carpeta']);
        const brand = getVal(['marca', 'brand']);

        const cost = parseFloat(String(costRaw).replace(/[^0-9.-]+/g, "")) || 0;
        let price = parseFloat(String(priceRaw).replace(/[^0-9.-]+/g, "")) || 0;

        if (typeof priceRaw === 'string') {
            if (priceRaw.includes('$$')) {
                price = parseFloat(priceRaw.replace(/[^\d.]/g, '')) || price;
            } else if (priceRaw.includes('%')) {
                const percent = parseFloat(priceRaw.replace(/[^\d.-]/g, '')) || 0;
                price = cost * (1 + percent / 100);
            }
        }

        let margin = 0;
        if (cost > 0 && price > 0) {
            margin = Math.round(((price - cost) / cost) * 100);
        }

        return {
            _id: generateId(),
            selected: true,
            code: String(code),
            name: String(name),
            cost,
            margin,
            price: Math.round(price),
            stock: parseInt(String(stockRaw)) || 0,
            category: String(category),
            subcategory: String(subcategory),
            brand: String(brand)
        };
    });
};

const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const categories = useStore(state => state.categories) || [];
    const categoriesData = useStore(state => state.categoriesData) || [];
    const brands = useStore(state => state.brands) || [];

    const [step, setStep] = useState(1);
    const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [pasteText, setPasteText] = useState('');
    const [importResult, setImportResult] = useState<{ updated: number, created: number } | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
    const [bulkMargin, setBulkMargin] = useState<string>('');
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkBrand, setBulkBrand] = useState('');
    const [bulkCodePrefix, setBulkCodePrefix] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const [textMode, setTextMode] = useState<'free' | 'grid'>('free'); // 'free' for raw text, 'grid' for excel-like
    const [gridRows, setGridRows] = useState<any[]>(Array(10).fill({
        _id: '',
        'Código': '',
        'Nombre': '',
        'Precio ($)': '',
        'Costo ($$)': '',
        'Stock (+)': '',
        'Categoria': '',
        'Marca': ''
    }).map(() => ({ 
        _id: generateId(),
        'Código': '',
        'Nombre': '',
        'Precio ($)': '',
        'Costo ($$)': '',
        'Stock (+)': '',
        'Categoria': '',
        'Marca': '' 
    })));

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.pdf') || droppedFile.name.endsWith('.doc') || droppedFile.name.endsWith('.docx'))) {
            setFile(droppedFile);
            setError(null);
        }
    }, []);

    const handlePreview = async () => {
        setIsLoading(true);
        setError(null);

        try {
            let rawData: any[] = [];
            if (activeTab === 'file' && file) {
                const parseResponse = await api.parseFile(file);
                rawData = parseResponse.data;
            } else if (activeTab === 'text') {
                if (textMode === 'free') {
                    if (!pasteText.trim()) throw new Error('Pegá algún contenido antes de procesar.');
                    const parseResponse = await api.request<any>('/import-data/parse-text', {
                        method: 'POST',
                        body: JSON.stringify({ text: pasteText })
                    });
                    rawData = parseResponse.data;
                } else {
                    // Grid Mode: Filter empty rows (must have at least name or code)
                    rawData = gridRows.filter(r => r['Nombre'].trim() || r['Código'].trim());
                    if (rawData.length === 0) throw new Error('Completá al menos una fila en la planilla.');
                }
            }

            if (!rawData || rawData.length === 0) throw new Error('No se encontraron datos interpretables.');

            setPreviewData(parseDataIntoRows(rawData));
            setStep(2);
        } catch (err: any) {
            setError(err.message || 'Error al procesar la información');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const finalDataToImport = previewData.filter(r => r.selected).map(r => ({
                code: r.code,
                name: r.name,
                price: r.price,
                cost: r.cost,
                stock: r.stock,
                category_name: r.category,
                subcategory_name: r.subcategory || undefined,
                brand_name: r.brand,
                margin_percent: r.margin
            }));

            if (finalDataToImport.length === 0) {
                throw new Error("No has seleccionado ninguna fila para importar.");
            }

            const importResponse = await api.request<any>('/import-data/bulk-import', {
                method: 'POST',
                body: JSON.stringify({
                    data: finalDataToImport,
                    update_prices: true,
                    update_stock: true
                })
            });

            setImportResult({
                updated: importResponse.updated || 0,
                created: importResponse.created || 0
            });
            setStep(3);
        } catch (err: any) {
            setError(err.message || 'Error durante la importación');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadExcelTemplate = () => {
        const header = [['Código', 'Nombre', 'Precio ($)', 'Costo ($$)', 'Stock (+)', 'Categoría', 'Subcategoría', 'Marca']];
        const data = [
            ['PROD001', 'Rosas Rojas Premium', '1500', '800', '25', 'Flores', 'Rosas', 'Vivero Central'],
            ['PROD002', 'Maceta Cerámica G', '3200', '1800', '12', 'Macetas', 'Barro', 'Artesanías'],
            ['PROD003', 'Tierra Fértil 5kg', '850', '400', '50', 'Insumos', '', 'EcoTierra']
        ];
        
        const instructions = [
            [],
            ['INSTRUCCIONES:'],
            ['1. El Código es fundamental para actualizar productos existentes sin duplicarlos.'],
            ['2. El Precio y el Costo deben ser números (usá punto para decimales si es necesario).'],
            ['3. La Categoría y Subcategoría que escribas se crearán automáticamente si no existen.'],
            ['4. Si la Subcategoría está vacía, el producto se asociará únicamente a la Categoría madre.'],
            ['5. Mantené los nombres de las columnas exactamente como aparecen en la primera fila.']
        ];
        
        const worksheetData = [...header, ...data, ...instructions];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        
        worksheet['!cols'] = [
            { wch: 15 },
            { wch: 30 },
            { wch: 12 },
            { wch: 12 },
            { wch: 10 },
            { wch: 25 },
            { wch: 20 },
        ];
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla de Productos');
        XLSX.writeFile(workbook, 'plantilla_productos_mijardin.xlsx');
    };

    const handleDownloadTemplate = () => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(79, 122, 90); // primary color
        doc.text('MI JARDÍN ERP', 14, 22);
        
        doc.setFontSize(16);
        doc.setTextColor(33, 37, 41);
        doc.text('Plantilla de Importación de Productos', 14, 32);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Esta plantilla contiene el formato correcto para la carga masiva de inventario.', 14, 40);
        doc.text('Asegurate de mantener el orden de las columnas para una importación exitosa.', 14, 45);
        
        // Table Data
        const headers = [['Código', 'Nombre del Producto', 'Precio ($)', 'Costo ($)', 'Stock', 'Categoría', 'Marca']];
        const data = [
            ['PROD001', 'Rosa Roja Premium', '1500', '800', '25', 'Flores', 'Vivero Central'],
            ['PROD002', 'Maceta Cerámica G', '3200', '1800', '12', 'Macetas', 'Artesanías'],
            ['PROD003', 'Tierra Fértil 5kg', '850', '400', '50', 'Insumos', 'EcoTierra'],
            ['PROD004', 'Orquídea Blanca', '4500', '2500', '8', 'Flores', 'Vivero Central'],
            ['PROD005', 'Fertilizante Líquido', '1200', '650', '20', 'Insumos', 'BioGreen'],
        ];
        
        autoTable(doc, {
            head: headers,
            body: data,
            startY: 55,
            theme: 'grid',
            headStyles: { 
                fillColor: [79, 122, 90], 
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: { 
                fontSize: 9,
                textColor: [50, 50, 50]
            },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 50 },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'center' },
            },
            alternateRowStyles: { fillColor: [248, 249, 250] },
            margin: { top: 20 },
        });
        
        // Footer / Instructions
        const finalY = (doc as any).lastAutoTable.finalY || 120;
        
        doc.setDrawColor(230, 230, 230);
        doc.line(14, finalY + 10, 196, finalY + 10);
        
        doc.setFontSize(12);
        doc.setTextColor(33, 37, 41);
        doc.setFont('helvetica', 'bold');
        doc.text('Instrucciones para la importación:', 14, finalY + 20);
        
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.setFont('helvetica', 'normal');
        const instructions = [
            '1. Mantené los nombres de las columnas exactamente como aparecen arriba.',
            '2. El Código es fundamental para actualizar productos existentes sin duplicarlos.',
            '3. El Precio y el Costo deben ser números (usá punto para decimales si es necesario).',
            '4. La Categoría ayuda al sistema a organizar tus productos en carpetas automáticamente.',
            '5. Una vez completado, podés subir este archivo PDF o un Excel/CSV con esta misma estructura.'
        ];
        
        instructions.forEach((line, i) => {
            doc.text(line, 14, finalY + 30 + (i * 7));
        });
        
        // Footer brand
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Generado automáticamente por Mi Jardín ERP - ' + new Date().toLocaleDateString(), 14, 285);
        
        doc.save('plantilla_productos_mijardin.pdf');
    };

    const handleClose = () => {
        if (importResult && onSuccess) {
            onSuccess(importResult);
        }
        onClose();
        if (importResult) window.location.reload();
    };

    const filteredPreview = useMemo(() => {
        if (!searchTerm) return previewData;
        const low = searchTerm.toLowerCase();
        return previewData.filter(r =>
            r.name.toLowerCase().includes(low) ||
            r.code.toLowerCase().includes(low) ||
            r.category.toLowerCase().includes(low) ||
            r.brand.toLowerCase().includes(low)
        );
    }, [previewData, searchTerm]);

    const toggleAll = () => {
        const allSelected = filteredPreview.every(r => r.selected);
        const filteredIds = new Set(filteredPreview.map(r => r._id));
        setPreviewData(prev => prev.map((r: ParsedRow) => filteredIds.has(r._id) ? { ...r, selected: !allSelected } : r));
    };

    const toggleRow = (id: string) => {
        setPreviewData(prev => prev.map(r => r._id === id ? { ...r, selected: !r.selected } : r));
    };

    const updateRow = (id: string, field: keyof ParsedRow, value: any) => {
        setPreviewData(prev => prev.map((r: ParsedRow) => {
            if (r._id !== id) return r;
            const updated = { ...r, [field]: value };

            if (field === 'cost' || field === 'margin') {
                updated.price = Math.round(updated.cost * (1 + updated.margin / 100));
            } else if (field === 'price') {
                if (updated.cost > 0) {
                    updated.margin = Math.round(((updated.price - updated.cost) / updated.cost) * 100);
                }
            }
            return updated;
        }));
    };

    const applyBulkMargin = () => {
        if (bulkMargin === '') return;
        const m = Number(bulkMargin);
        setPreviewData(prev => prev.map((r: ParsedRow) => {
            if (!r.selected) return r;
            return {
                ...r,
                margin: m,
                price: Math.round(r.cost * (1 + m / 100))
            };
        }));
    };

    const applyBulkCategory = () => {
        if (!bulkCategory) return;
        setPreviewData(prev => prev.map((r: ParsedRow) => r.selected ? { ...r, category: bulkCategory } : r));
    };

    const applyBulkBrand = () => {
        if (!bulkBrand) return;
        setPreviewData(prev => prev.map((r: ParsedRow) => r.selected ? { ...r, brand: bulkBrand } : r));
    };

    const applyBulkCodePrefix = () => {
        if (!bulkCodePrefix) return;
        setPreviewData(prev => {
            let count = 1;
            return prev.map(r => {
                if (!r.selected) return r;
                const formattedCount = String(count).padStart(2, '0');
                const newCode = `${bulkCodePrefix}${formattedCount}`;
                count++;
                return { ...r, code: newCode };
            });
        });
        setBulkCodePrefix('');
    };

    const categoryOptions = Array.from(new Set([...categories.map((c: any) => c?.name || c), ...previewData.map(r => r.category).filter(Boolean)]));
    const brandOptions = Array.from(new Set([...brands.map((b: any) => b?.name || b), ...previewData.map(r => r.brand).filter(Boolean)]));

    const selectedCount = previewData.filter(r => r.selected).length;

    return (
        <div className="csv-modal-overlay" onClick={handleClose}>
            <div className="csv-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="csv-modal-header">
                    <div className="csv-header-content">
                        <div className="csv-header-icon">
                            <Database size={28} />
                        </div>
                        <div className="csv-header-text">
                            <h2>Importar Productos</h2>
                            <p>Carga masiva de productos desde archivo CSV o Excel</p>
                        </div>
                    </div>
                    <button className="csv-close-btn" onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Stepper */}
                <div className="csv-stepper">
                    <div className={`csv-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                        <div className="csv-step-number">
                            {step > 1 ? <Check size={14} strokeWidth={3} /> : '1'}
                        </div>
                        <span className="csv-step-label">Configurar</span>
                    </div>
                    <div className={`csv-step-line ${step > 1 ? 'completed' : ''}`} />
                    <div className={`csv-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                        <div className="csv-step-number">
                            {step > 2 ? <Check size={14} strokeWidth={3} /> : '2'}
                        </div>
                        <span className="csv-step-label">Vista Previa</span>
                    </div>
                    <div className={`csv-step-line ${step > 2 ? 'completed' : ''}`} />
                    <div className={`csv-step ${step >= 3 ? 'active' : ''}`}>
                        <div className="csv-step-number">3</div>
                        <span className="csv-step-label">Finalizar</span>
                    </div>
                </div>

                {/* Content */}
                <div className="csv-modal-body">
                    {error && (
                        <div className="csv-error-alert">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                            <button className="csv-error-close" onClick={() => setError(null)}>
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {/* Step 1: Upload */}
                    {step === 1 && (
                        <div className="csv-upload-step">
                            <div className="csv-tabs">
                                <button
                                    className={`csv-tab ${activeTab === 'file' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('file')}
                                >
                                    <FileSpreadsheet size={18} />
                                    <span>Archivo Excel/CSV</span>
                                </button>
                                <button
                                    className={`csv-tab ${activeTab === 'text' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('text')}
                                >
                                    <FileText size={18} />
                                    <span>Pegar Texto</span>
                                </button>
                            </div>

                            {activeTab === 'file' ? (
                                <div
                                    className={`csv-dropzone ${isDragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        onChange={handleFileChange}
                                        accept=".csv,.xlsx,.xls,.pdf,.doc,.docx"
                                        className="csv-file-input"
                                    />
                                    <div className="csv-dropzone-content">
                                        {file ? (
                                            <>
                                                <FileSpreadsheet size={56} className="csv-file-icon" />
                                                <h3 className="csv-file-name">{file.name}</h3>
                                                <p className="csv-file-size">{(file.size / 1024).toFixed(2)} KB</p>
                                                <p className="csv-file-hint">Hacé clic para cambiar</p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="csv-upload-icon-wrapper">
                                                    <Upload size={48} />
                                                </div>
                                                <h3 className="csv-dropzone-title">Arrastrá tu archivo aquí</h3>
                                                <p className="csv-dropzone-subtitle">o hacé clic para seleccionar</p>
                                                <div className="csv-formats">
                                                    <span className="csv-format-badge">Excel</span>
                                                    <span className="csv-format-badge">CSV</span>
                                                    <span className="csv-format-badge">PDF</span>
                                                    <span className="csv-format-badge">Word</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="csv-paste-section">
                                    <div className="csv-text-mode-selector">
                                        <button 
                                            className={`text-mode-btn ${textMode === 'free' ? 'active' : ''}`}
                                            onClick={() => setTextMode('free')}
                                        >
                                            <Sparkles size={14} />
                                            <span>Texto Libre / Pegado Inteligente</span>
                                        </button>
                                        <button 
                                            className={`text-mode-btn ${textMode === 'grid' ? 'active' : ''}`}
                                            onClick={() => setTextMode('grid')}
                                        >
                                            <FileSpreadsheet size={14} />
                                            <span>Planilla Tipo Excel</span>
                                        </button>
                                    </div>

                                    {textMode === 'free' ? (
                                        <>
                                            <textarea
                                                className="csv-paste-textarea"
                                                placeholder={`Pegá aquí el contenido de tu lista...\n\nEjemplo:\nCódigo,Nombre,Precio,Costo,Stock,Categoría,Marca\nPROD001,Rosas Rojas,1500,800,50,Plantas,Mi Jardín`}
                                                value={pasteText}
                                                onChange={(e) => setPasteText(e.target.value)}
                                            />
                                            <div className="csv-paste-helper">
                                                <div className="csv-helper-icon">
                                                    <Sparkles size={16} />
                                                </div>
                                                <div className="csv-helper-text">
                                                    <p className="csv-helper-title">Funcionalidad inteligente de precios:</p>
                                                    <ul>
                                                        <li><code>+10%</code> → Subir un porcentaje</li>
                                                        <li><code>+$10</code> o <code>$10</code> → Sumar dinero fijo</li>
                                                        <li><code>$$2000</code> → Imponer precio fijo exacto</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="csv-grid-template">
                                            <div className="csv-grid-wrapper">
                                                <table className="csv-edit-grid">
                                                    <thead>
                                                        <tr>
                                                            <th>Código</th>
                                                            <th>Nombre</th>
                                                            <th>Precio ($)</th>
                                                            <th>Costo ($$)</th>
                                                            <th>Stock (+)</th>
                                                            <th>Categoría</th>
                                                            <th>Marca</th>
                                                            <th style={{ width: '40px' }}></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {gridRows.map((row, idx) => (
                                                            <tr key={row._id}>
                                                                <td><input value={row['Código']} onChange={e => {
                                                                    const newRows = [...gridRows];
                                                                    newRows[idx]['Código'] = e.target.value;
                                                                    setGridRows(newRows);
                                                                }} placeholder="Ej: P001" /></td>
                                                                <td><input value={row['Nombre']} onChange={e => {
                                                                    const newRows = [...gridRows];
                                                                    newRows[idx]['Nombre'] = e.target.value;
                                                                    setGridRows(newRows);
                                                                }} placeholder="Nombre del producto" /></td>
                                                                <td><input type="text" value={row['Precio ($)']} onChange={e => {
                                                                    const newRows = [...gridRows];
                                                                    newRows[idx]['Precio ($)'] = e.target.value;
                                                                    setGridRows(newRows);
                                                                }} placeholder="0" /></td>
                                                                <td><input type="text" value={row['Costo ($$)']} onChange={e => {
                                                                    const newRows = [...gridRows];
                                                                    newRows[idx]['Costo ($$)'] = e.target.value;
                                                                    setGridRows(newRows);
                                                                }} placeholder="0" /></td>
                                                                <td><input type="text" value={row['Stock (+)']} onChange={e => {
                                                                    const newRows = [...gridRows];
                                                                    newRows[idx]['Stock (+)'] = e.target.value;
                                                                    setGridRows(newRows);
                                                                }} placeholder="0" /></td>
                                                                <td><input value={row['Categoria']} onChange={e => {
                                                                    const newRows = [...gridRows];
                                                                    newRows[idx]['Categoria'] = e.target.value;
                                                                    setGridRows(newRows);
                                                                }} placeholder="Carpeta" /></td>
                                                                <td><input value={row['Marca']} onChange={e => {
                                                                    const newRows = [...gridRows];
                                                                    newRows[idx]['Marca'] = e.target.value;
                                                                    setGridRows(newRows);
                                                                }} placeholder="Marca" /></td>
                                                                <td>
                                                                    <button className="grid-row-delete" onClick={() => {
                                                                        setGridRows(gridRows.filter((_, i) => i !== idx));
                                                                    }}><X size={14} /></button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="csv-grid-actions">
                                                <button className="csv-grid-add-row" onClick={() => setGridRows([...gridRows, {
                                                    _id: generateId(),
                                                    'Código': '',
                                                    'Nombre': '',
                                                    'Precio ($)': '',
                                                    'Costo ($$)': '',
                                                    'Stock (+)': '',
                                                    'Categoria': '',
                                                    'Marca': ''
                                                }])}>
                                                    <PlusCircle size={14} />
                                                    <span>Añadir fila</span>
                                                </button>
                                                <button className="csv-grid-clear" onClick={() => {
                                                    if (confirm('¿Vaciar toda la planilla?')) {
                                                        setGridRows(Array(10).fill({
                                                            _id: '',
                                                            'Código': '',
                                                            'Nombre': '',
                                                            'Precio ($)': '',
                                                            'Costo ($$)': '',
                                                            'Stock (+)': '',
                                                            'Categoria': '',
                                                            'Marca': ''
                                                        }).map(r => ({ ...r, _id: generateId() })));
                                                    }
                                                }}>
                                                    Vaciar planilla
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="csv-template-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}>
                                <button className="csv-template-btn" onClick={handleDownloadExcelTemplate} style={{ backgroundColor: '#e6f4ea', color: '#137333', borderColor: '#ceead6' }}>
                                    <FileSpreadsheet size={16} />
                                    <span>Descargar Plantilla Excel Usable</span>
                                </button>
                                <button className="csv-template-btn" onClick={handleDownloadTemplate}>
                                    <FileText size={16} />
                                    <span>Descargar PDF de Ejemplo</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {step === 2 && (
                        <div className="csv-preview-step">
                            {/* Toolbar */}
                            <div className="csv-preview-toolbar">
                                <div className="csv-toolbar-left">
                                    <div className="csv-search-box">
                                        <Search size={16} className="csv-search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Buscar productos..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <span className="csv-selected-count">
                                        {selectedCount} seleccionados
                                    </span>
                                </div>
                                <div className="csv-toolbar-right">
                                    <button
                                        className="csv-deselect-btn"
                                        onClick={() => setPreviewData(prev => prev.map(r => ({ ...r, selected: false })))}
                                    >
                                        <Square size={14} />
                                        Deseleccionar todo
                                    </button>
                                </div>
                            </div>

                            {/* Bulk Actions */}
                            <div className="csv-bulk-actions-bar">
                                <Sparkles size={16} className="csv-bulk-icon" />
                                <span className="csv-bulk-label">Acciones masivas:</span>

                                <div className="csv-bulk-group">
                                    <TreeSelect
                                        categories={categoriesData}
                                        value={bulkCategory}
                                        onChange={(cat) => setBulkCategory(cat ? cat.name : '')}
                                        placeholder="Categoría..."
                                        className="csv-bulk-select-tree"
                                    />
                                    <button
                                        className="csv-bulk-apply-btn"
                                        onClick={applyBulkCategory}
                                        disabled={!bulkCategory}
                                    >
                                        Aplicar
                                    </button>
                                </div>

                                <div className="csv-bulk-group">
                                    <select
                                        className="csv-bulk-select"
                                        value={bulkBrand}
                                        onChange={e => setBulkBrand(e.target.value)}
                                    >
                                        <option value="">Marca...</option>
                                        {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                    <button
                                        className="csv-bulk-apply-btn"
                                        onClick={applyBulkBrand}
                                        disabled={!bulkBrand}
                                    >
                                        Aplicar
                                    </button>
                                </div>

                                <div className="csv-bulk-group">
                                    <input
                                        type="text"
                                        className="csv-bulk-margin-input"
                                        style={{ width: '120px' }}
                                        placeholder="Prefijo Código..."
                                        value={bulkCodePrefix}
                                        onChange={e => setBulkCodePrefix(e.target.value)}
                                    />
                                    <button
                                        className="csv-bulk-apply-btn"
                                        onClick={applyBulkCodePrefix}
                                        disabled={!bulkCodePrefix}
                                    >
                                        Generar
                                    </button>
                                </div>

                                <div className="csv-bulk-divider" />

                                <div className="csv-bulk-group csv-margin-bulk-group">
                                    <Percent size={14} className="csv-bulk-percent-icon" />
                                    <input
                                        type="number"
                                        className="csv-bulk-margin-input"
                                        placeholder="Margen %"
                                        value={bulkMargin}
                                        onChange={e => setBulkMargin(e.target.value)}
                                    />
                                    <button
                                        className="csv-bulk-apply-btn"
                                        onClick={applyBulkMargin}
                                        disabled={bulkMargin === ''}
                                    >
                                        Aplicar
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="csv-table-wrapper">
                                <table className="csv-table">
                                    <thead>
                                        <tr>
                                            <th className="csv-col csv-select-col">
                                                <button onClick={toggleAll} className="csv-select-all-btn">
                                                    {filteredPreview.length > 0 && filteredPreview.every(r => r.selected) ? (
                                                        <CheckSquare size={18} className="csv-checkbox checked" />
                                                    ) : (
                                                        <Square size={18} className="csv-checkbox" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="csv-col csv-code-col">CÓDIGO</th>
                                            <th className="csv-col csv-name-col">NOMBRE</th>
                                            <th className="csv-col csv-category-col">CATEGORÍA</th>
                                            <th className="csv-col csv-subcategory-col">SUB CARPETA</th>
                                            <th className="csv-col csv-brand-col">MARCA</th>
                                            <th className="csv-col csv-stock-col">STOCK</th>
                                            <th className="csv-col csv-cost-col">COSTO ($)</th>
                                            <th className="csv-col csv-margin-col">MARGEN (%)</th>
                                            <th className="csv-col csv-price-col">P. VENTA ($)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPreview.map((row) => (
                                            <tr key={row._id} className={`csv-row ${!row.selected ? 'csv-row-unselected' : ''}`}>
                                                <td className="csv-cell csv-select-cell">
                                                    <button onClick={() => toggleRow(row._id)} className="csv-row-select-btn">
                                                        {row.selected ? (
                                                            <CheckSquare size={16} className="csv-checkbox checked" />
                                                        ) : (
                                                            <Square size={16} className="csv-checkbox" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="csv-cell csv-code-cell">
                                                    <input
                                                        className="csv-cell-input"
                                                        value={row.code}
                                                        onChange={e => updateRow(row._id, 'code', e.target.value)}
                                                    />
                                                </td>
                                                <td className="csv-cell csv-name-cell">
                                                    <input
                                                        className="csv-cell-input csv-name-input"
                                                        value={row.name}
                                                        onChange={e => updateRow(row._id, 'name', e.target.value)}
                                                    />
                                                </td>
                                                <td className="csv-cell csv-category-cell">
                                                    <input
                                                        className="csv-cell-input"
                                                        value={row.category}
                                                        placeholder="Carpeta"
                                                        onChange={e => updateRow(row._id, 'category', e.target.value)}
                                                        list="csv-categories-list"
                                                    />
                                                </td>
                                                <td className="csv-cell csv-subcategory-cell">
                                                    <input
                                                        className="csv-cell-input"
                                                        value={row.subcategory || ''}
                                                        placeholder="Sub carpeta"
                                                        onChange={e => updateRow(row._id, 'subcategory', e.target.value)}
                                                    />
                                                </td>
                                                <td className="csv-cell csv-brand-cell">
                                                    <input
                                                        className="csv-cell-input"
                                                        value={row.brand}
                                                        placeholder="Sin marca"
                                                        onChange={e => updateRow(row._id, 'brand', e.target.value)}
                                                        list="csv-brands-list"
                                                    />
                                                </td>
                                                <td className="csv-cell csv-stock-cell">
                                                    <input
                                                        type="number"
                                                        className="csv-cell-input csv-stock-input"
                                                        value={row.stock}
                                                        onChange={e => updateRow(row._id, 'stock', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="csv-cell csv-cost-cell">
                                                    <div className="csv-input-icon-wrapper">
                                                        <DollarSign size={12} />
                                                        <input
                                                            type="number"
                                                            className="csv-cell-input csv-cost-input"
                                                            value={row.cost}
                                                            onChange={e => updateRow(row._id, 'cost', Number(e.target.value))}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="csv-cell csv-margin-cell">
                                                    <div className="csv-input-icon-wrapper csv-margin-wrapper">
                                                        <input
                                                            type="number"
                                                            className="csv-cell-input csv-margin-input"
                                                            value={row.margin}
                                                            onChange={e => updateRow(row._id, 'margin', Number(e.target.value))}
                                                        />
                                                        <Percent size={12} />
                                                    </div>
                                                </td>
                                                <td className="csv-cell csv-price-cell">
                                                    <div className="csv-input-icon-wrapper csv-price-wrapper">
                                                        <DollarSign size={12} />
                                                        <input
                                                            type="number"
                                                            className="csv-cell-input csv-price-input"
                                                            value={row.price}
                                                            onChange={e => updateRow(row._id, 'price', Number(e.target.value))}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredPreview.length === 0 && (
                                    <div className="csv-empty-state">
                                        <Search size={48} className="csv-empty-icon" />
                                        <p className="csv-empty-title">No se encontraron productos</p>
                                        <p className="csv-empty-subtitle">Intentá con otro término de búsqueda</p>
                                    </div>
                                )}
                            </div>

                            <datalist id="csv-categories-list">
                                {categoryOptions.map(c => <option key={c} value={c} />)}
                            </datalist>
                            <datalist id="csv-brands-list">
                                {brandOptions.map(b => <option key={b} value={b} />)}
                            </datalist>
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === 3 && importResult && (
                        <div className="csv-success-step">
                            <div className="csv-success-content">
                                <div className="csv-success-icon-wrapper">
                                    <Check size={64} strokeWidth={3} />
                                </div>
                                <h2 className="csv-success-title">¡Importación Exitosa!</h2>
                                <p className="csv-success-subtitle">
                                    Se procesaron {importResult.created + importResult.updated} productos correctamente
                                </p>

                                <div className="csv-success-cards">
                                    <div className="csv-success-card csv-created-card">
                                        <div className="csv-card-icon">
                                            <PlusCircle size={32} />
                                        </div>
                                        <div className="csv-card-value">{importResult.created}</div>
                                        <div className="csv-card-label">Nuevos creados</div>
                                    </div>
                                    <div className="csv-success-card csv-updated-card">
                                        <div className="csv-card-icon">
                                            <RefreshCw size={32} />
                                        </div>
                                        <div className="csv-card-value">{importResult.updated}</div>
                                        <div className="csv-card-label">Actualizados</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="csv-modal-footer">
                    {step === 1 && (
                        <>
                            <button className="csv-btn csv-btn-cancel" onClick={onClose}>
                                Cancelar
                            </button>
                            <button
                                className="csv-btn csv-btn-primary"
                                onClick={handlePreview}
                                disabled={isLoading || (activeTab === 'file' ? !file : (textMode === 'free' ? !pasteText.trim() : gridRows.every(r => !r['Nombre'] && !r['Código'])))}
                            >
                                {isLoading ? (
                                    <RefreshCw size={18} className="csv-btn-icon csv-spin" />
                                ) : (
                                    <>
                                        <span>Procesar Vista Previa</span>
                                        <ChevronRight size={18} />
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <button className="csv-btn csv-btn-cancel" onClick={() => setStep(1)}>
                                Atrás
                            </button>
                            <button
                                className="csv-btn csv-btn-primary"
                                onClick={handleImport}
                                disabled={isLoading || selectedCount === 0}
                            >
                                {isLoading ? (
                                    <RefreshCw size={18} className="csv-btn-icon csv-spin" />
                                ) : (
                                    <>
                                        <span>Confirmar e Importar</span>
                                        <span className="csv-count-badge">({selectedCount})</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {step === 3 && (
                        <button className="csv-btn csv-btn-primary" onClick={handleClose}>
                            Finalizar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CsvImportModal;

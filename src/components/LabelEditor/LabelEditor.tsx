import React, { useState, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { Settings, Save, RefreshCw, Eye, EyeOff, Maximize2 } from 'lucide-react';
import { getSavedLabelLayout, saveLabelLayout, defaultLabelLayout } from './LabelLayoutConfig';
import type { LabelLayoutConfig, ElementLayout } from './LabelLayoutConfig';
import { BarcodeGenerator } from '../BarcodeGenerator/BarcodeGenerator';
import './LabelEditor.css';

interface LabelEditorProps {
    product: {
        name: string;
        code: string;
        price: number;
    };
    labelWidth?: number;   // mm, can be overridden
    labelHeight?: number;  // mm, can be overridden
    onSave?: (layout: LabelLayoutConfig) => void;
    onCancel?: () => void;
}

// Scale factor: how many px per mm in the editor canvas
const SCALE = 4; // 4px per mm

export const LabelEditor: React.FC<LabelEditorProps> = ({ product, labelWidth, labelHeight, onSave, onCancel }) => {
    const [layout, setLayout] = useState<LabelLayoutConfig>(() => {
        const saved = getSavedLabelLayout();
        return {
            ...saved,
            width: labelWidth ?? saved.width,
            height: labelHeight ?? saved.height,
        };
    });

    const canvasWidthPx = layout.width * SCALE;
    const canvasHeightPx = layout.height * SCALE;

    // Convert % to px for Rnd (editor coordinates)
    const pctToPx = useCallback((pct: number, dimension: number) => (pct / 100) * dimension, []);
    // Convert px back to %
    const pxToPct = useCallback((px: number, dimension: number) => Math.max(0, Math.min(100, (px / dimension) * 100)), []);

    const handleDragStop = (key: keyof LabelLayoutConfig, d: { x: number; y: number }) => {
        if (key === 'width' || key === 'height') return;
        setLayout(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] as ElementLayout),
                x: pxToPct(d.x, canvasWidthPx),
                y: pxToPct(d.y, canvasHeightPx),
            }
        }));
    };

    const handleResizeStop = (key: keyof LabelLayoutConfig, ref: HTMLElement, position: { x: number; y: number }) => {
        if (key === 'width' || key === 'height') return;
        setLayout(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] as ElementLayout),
                w: pxToPct(parseInt(ref.style.width, 10), canvasWidthPx),
                h: pxToPct(parseInt(ref.style.height, 10), canvasHeightPx),
                x: pxToPct(position.x, canvasWidthPx),
                y: pxToPct(position.y, canvasHeightPx),
            }
        }));
    };

    const toggleVisibility = (key: keyof LabelLayoutConfig) => {
        if (key === 'width' || key === 'height') return;
        setLayout(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] as ElementLayout),
                visible: !(prev[key] as ElementLayout).visible
            }
        }));
    };

    const changeFontSize = (key: 'name' | 'code' | 'price', delta: number) => {
        setLayout(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] as ElementLayout),
                fontSize: Math.max(4, Math.min(20, ((prev[key] as ElementLayout).fontSize || 7) + delta))
            }
        }));
    };

    const changeLabelSize = (field: 'width' | 'height', value: number) => {
        setLayout(prev => ({ ...prev, [field]: Math.max(10, value) }));
    };

    const handleSave = () => {
        saveLabelLayout(layout);
        if (onSave) onSave(layout);
    };

    const handleReset = () => {
        setLayout(defaultLabelLayout);
    };

    const ELEMENT_LABELS: Record<string, string> = {
        name: 'Nombre',
        barcode: 'Código de Barras',
        code: 'Texto Código',
        price: 'Precio',
    };

    const elements: Array<{ key: 'name' | 'barcode' | 'code' | 'price'; el: ElementLayout }> = [
        { key: 'name', el: layout.name },
        { key: 'barcode', el: layout.barcode },
        { key: 'code', el: layout.code },
        { key: 'price', el: layout.price },
    ];

    return (
        <div className="label-editor-container">
            <div className="label-editor-toolbar">
                <div className="toolbar-title">
                    <Settings size={18} />
                    <span>Diseñador de Etiquetas</span>
                </div>
                <div className="toolbar-actions">
                    <button onClick={handleReset} className="btn-secondary" title="Restaurar por defecto">
                        <RefreshCw size={15} /> Restaurar
                    </button>
                    <button onClick={handleSave} className="btn-primary">
                        <Save size={15} /> Guardar Diseño
                    </button>
                </div>
            </div>

            <div className="label-editor-main">
                {/* Left sidebar: controls */}
                <div className="label-editor-sidebar">
                    {/* Label size */}
                    <div className="sidebar-section">
                        <h5 className="sidebar-section-title">
                            <Maximize2 size={13} /> Tamaño Etiqueta
                        </h5>
                        <div className="size-inputs">
                            <label>
                                <span>Ancho (mm)</span>
                                <input
                                    type="number"
                                    min={10}
                                    max={200}
                                    value={layout.width}
                                    onChange={e => changeLabelSize('width', +e.target.value)}
                                />
                            </label>
                            <label>
                                <span>Alto (mm)</span>
                                <input
                                    type="number"
                                    min={5}
                                    max={200}
                                    value={layout.height}
                                    onChange={e => changeLabelSize('height', +e.target.value)}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Elements */}
                    <div className="sidebar-section">
                        <h5 className="sidebar-section-title">Elementos</h5>
                        {elements.map(({ key, el }) => (
                            <div key={key} className={`element-row ${!el.visible ? 'hidden-el' : ''}`}>
                                <span className="el-label">{ELEMENT_LABELS[key]}</span>
                                <div className="el-controls">
                                    {key !== 'barcode' && (
                                        <div className="font-stepper">
                                            <button onClick={() => changeFontSize(key as any, -0.5)}>−</button>
                                            <span>{el.fontSize || 7}pt</span>
                                            <button onClick={() => changeFontSize(key as any, 0.5)}>+</button>
                                        </div>
                                    )}
                                    <button
                                        className={`vis-btn ${el.visible ? 'active' : ''}`}
                                        onClick={() => toggleVisibility(key)}
                                        title={el.visible ? 'Ocultar' : 'Mostrar'}
                                    >
                                        {el.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="sidebar-hint">
                        Arrastrá y redimensioná los elementos en el lienzo. El diseño se aplica en todas tus impresiones.
                    </p>
                </div>

                {/* Canvas */}
                <div className="label-editor-canvas-wrapper">
                    <div className="canvas-zoom-label">
                        Vista real: {layout.width}×{layout.height}mm (zoom ×{SCALE})
                    </div>
                    <div
                        className="label-editor-canvas"
                        style={{ width: canvasWidthPx, height: canvasHeightPx }}
                    >
                        {elements.map(({ key, el }) => el.visible && (
                            <Rnd
                                key={key}
                                size={{
                                    width: pctToPx(el.w, canvasWidthPx),
                                    height: pctToPx(el.h, canvasHeightPx)
                                }}
                                position={{
                                    x: pctToPx(el.x, canvasWidthPx),
                                    y: pctToPx(el.y, canvasHeightPx)
                                }}
                                onDragStop={(_e, d) => handleDragStop(key, d)}
                                onResizeStop={(_e, _dir, ref, _delta, position) => handleResizeStop(key, ref, position)}
                                bounds="parent"
                                minWidth={10}
                                minHeight={8}
                                className={`rnd-element rnd-${key}`}
                            >
                                {key === 'name' && (
                                    <div className="rnd-inner" style={{ fontSize: `${el.fontSize || 7}pt`, fontWeight: el.fontWeight || 700 }}>
                                        {product.name}
                                    </div>
                                )}
                                {key === 'barcode' && (
                                    <div className="rnd-inner rnd-barcode">
                                        <BarcodeGenerator value={product.code} displayValue={false} height={pctToPx(el.h, canvasHeightPx) * 0.75} width={1} margin={0} />
                                    </div>
                                )}
                                {key === 'code' && (
                                    <div className="rnd-inner rnd-code" style={{ fontSize: `${el.fontSize || 6}pt`, fontWeight: el.fontWeight || 500 }}>
                                        {product.code}
                                    </div>
                                )}
                                {key === 'price' && (
                                    <div className="rnd-inner" style={{ fontSize: `${el.fontSize || 7}pt`, fontWeight: el.fontWeight || 800 }}>
                                        ${product.price.toLocaleString()}
                                    </div>
                                )}
                                <div className="rnd-label">{ELEMENT_LABELS[key]}</div>
                            </Rnd>
                        ))}
                    </div>
                </div>
            </div>

            {onCancel && (
                <div className="label-editor-footer">
                    <button onClick={onCancel} className="btn-ghost">Cancelar</button>
                    <button onClick={handleSave} className="btn-primary">
                        <Save size={15} /> Guardar y Cerrar
                    </button>
                </div>
            )}
        </div>
    );
};

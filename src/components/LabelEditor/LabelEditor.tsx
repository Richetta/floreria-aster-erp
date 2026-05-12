import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Settings, Save, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { LabelLayoutConfig, ElementLayout, getSavedLabelLayout, saveLabelLayout, defaultLabelLayout } from './LabelLayoutConfig';
import { BarcodeGenerator } from '../BarcodeGenerator/BarcodeGenerator';
import './LabelEditor.css';

interface LabelEditorProps {
    product: {
        name: string;
        code: string;
        price: number;
    };
    onSave?: () => void;
    onCancel?: () => void;
}

export const LabelEditor: React.FC<LabelEditorProps> = ({ product, onSave, onCancel }) => {
    const [layout, setLayout] = useState<LabelLayoutConfig>(getSavedLabelLayout());

    const handleDragStop = (key: keyof LabelLayoutConfig, d: any) => {
        if (key === 'width' || key === 'height') return;
        setLayout(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] as ElementLayout),
                x: d.x,
                y: d.y
            }
        }));
    };

    const handleResizeStop = (key: keyof LabelLayoutConfig, ref: any, position: any) => {
        if (key === 'width' || key === 'height') return;
        setLayout(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] as ElementLayout),
                w: parseInt(ref.style.width, 10),
                h: parseInt(ref.style.height, 10),
                x: position.x,
                y: position.y
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

    const handleSave = () => {
        saveLabelLayout(layout);
        if (onSave) onSave();
    };

    const handleReset = () => {
        setLayout(defaultLabelLayout);
    };

    // The editor operates in a virtual canvas. Let's assume the canvas is e.g. 50mm x 25mm scaled up to look good on screen.
    // 50mm = ~189px, so we scale it up. Let's use a standard 200px width.
    const canvasWidth = 189; // 50mm * 3.78
    const canvasHeight = 94.5; // 25mm * 3.78

    // Wait, let's just make the container relative and scale it with CSS transform for viewing.
    return (
        <div className="label-editor-container">
            <div className="label-editor-toolbar">
                <div className="toolbar-title">
                    <Settings size={18} />
                    <span>Diseñador de Etiquetas</span>
                </div>
                <div className="toolbar-actions">
                    <button onClick={handleReset} className="btn-secondary" title="Restaurar por defecto">
                        <RefreshCw size={16} /> Restaurar
                    </button>
                    <button onClick={handleSave} className="btn-primary">
                        <Save size={16} /> Guardar Diseño
                    </button>
                </div>
            </div>

            <div className="label-editor-main">
                <div className="label-editor-sidebar">
                    <h4>Elementos</h4>
                    <div className="element-toggle">
                        <span>Nombre</span>
                        <button onClick={() => toggleVisibility('name')} className={layout.name.visible ? 'active' : ''}>
                            {layout.name.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                    </div>
                    <div className="element-toggle">
                        <span>Código de Barras</span>
                        <button onClick={() => toggleVisibility('barcode')} className={layout.barcode.visible ? 'active' : ''}>
                            {layout.barcode.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                    </div>
                    <div className="element-toggle">
                        <span>Texto Código</span>
                        <button onClick={() => toggleVisibility('code')} className={layout.code.visible ? 'active' : ''}>
                            {layout.code.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                    </div>
                    <div className="element-toggle">
                        <span>Precio</span>
                        <button onClick={() => toggleVisibility('price')} className={layout.price.visible ? 'active' : ''}>
                            {layout.price.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                    </div>
                    <p className="sidebar-hint">Arrastra y redimensiona los elementos en el lienzo. Los cambios se guardarán para todas tus impresiones.</p>
                </div>

                <div className="label-editor-canvas-wrapper">
                    <div className="label-editor-canvas" style={{ width: canvasWidth, height: canvasHeight, transform: 'scale(1.5)', transformOrigin: 'top left' }}>
                        {/* NAME */}
                        {layout.name.visible && (
                            <Rnd
                                size={{ width: layout.name.w, height: layout.name.h }}
                                position={{ x: layout.name.x, y: layout.name.y }}
                                onDragStop={(e, d) => handleDragStop('name', d)}
                                onResizeStop={(e, dir, ref, delta, position) => handleResizeStop('name', ref, position)}
                                bounds="parent"
                                className="rnd-element"
                            >
                                <div style={{ fontSize: layout.name.fontSize, fontWeight: layout.name.fontWeight, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflow: 'hidden' }}>
                                    {product.name}
                                </div>
                            </Rnd>
                        )}

                        {/* BARCODE */}
                        {layout.barcode.visible && (
                            <Rnd
                                size={{ width: layout.barcode.w, height: layout.barcode.h }}
                                position={{ x: layout.barcode.x, y: layout.barcode.y }}
                                onDragStop={(e, d) => handleDragStop('barcode', d)}
                                onResizeStop={(e, dir, ref, delta, position) => handleResizeStop('barcode', ref, position)}
                                bounds="parent"
                                className="rnd-element"
                            >
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <BarcodeGenerator value={product.code} displayValue={false} height={layout.barcode.h * 0.8} />
                                </div>
                            </Rnd>
                        )}

                        {/* CODE TEXT */}
                        {layout.code.visible && (
                            <Rnd
                                size={{ width: layout.code.w, height: layout.code.h }}
                                position={{ x: layout.code.x, y: layout.code.y }}
                                onDragStop={(e, d) => handleDragStop('code', d)}
                                onResizeStop={(e, dir, ref, delta, position) => handleResizeStop('code', ref, position)}
                                bounds="parent"
                                className="rnd-element"
                            >
                                <div style={{ fontSize: layout.code.fontSize, fontWeight: layout.code.fontWeight, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
                                    {product.code}
                                </div>
                            </Rnd>
                        )}

                        {/* PRICE */}
                        {layout.price.visible && (
                            <Rnd
                                size={{ width: layout.price.w, height: layout.price.h }}
                                position={{ x: layout.price.x, y: layout.price.y }}
                                onDragStop={(e, d) => handleDragStop('price', d)}
                                onResizeStop={(e, dir, ref, delta, position) => handleResizeStop('price', ref, position)}
                                bounds="parent"
                                className="rnd-element"
                            >
                                <div style={{ fontSize: layout.price.fontSize, fontWeight: layout.price.fontWeight, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    ${product.price.toLocaleString()}
                                </div>
                            </Rnd>
                        )}
                    </div>
                </div>
            </div>
            {onCancel && (
                <button onClick={onCancel} className="btn-cancel-float">Cerrar Editor</button>
            )}
        </div>
    );
};

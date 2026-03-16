import { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { Upload, FileText, X, Check, AlertCircle, Loader, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import './OCRImportModal.css';

interface OCRImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (products: any[]) => void;
}

export const OCRImportModal: React.FC<OCRImportModalProps> = ({
    isOpen,
    onClose,
    onImport
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [extractedData, setExtractedData] = useState<any[]>([]);
    const [step, setStep] = useState<'upload' | 'processing' | 'review' | 'result'>('upload');
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file type
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            setError('Por favor seleccioná una imagen (JPG, PNG) o PDF');
            return;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError('El archivo no debe superar los 10MB');
            return;
        }

        setError(null);
        setSelectedFile(file);
        
        // Create preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewUrl(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleProcessOCR = async () => {
        if (!selectedFile) return;

        setStep('processing');
        setProgress(0);
        setError(null);

        try {
            // Process with Tesseract
            const result = await Tesseract.recognize(
                selectedFile,
                'spa', // Spanish language
                {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            setProgress(Math.round(m.progress * 100));
                        }
                    }
                }
            );

            // Parse the extracted text
            const products = parseExtractedText(result.data.text);
            
            setExtractedData(products);
            setStep('review');
        } catch (err: any) {
            console.error('OCR Error:', err);
            setError('Error al procesar la imagen. Intentá con otra imagen más clara.');
            setStep('upload');
        } finally {
            // Done
        }
    };

    const parseExtractedText = (text: string): any[] => {
        const lines = text.split('\n').filter(line => line.trim());
        const products: any[] = [];

        // Try to detect patterns like:
        // - CODE - NAME - PRICE
        // - NAME $PRICE
        // - CODE NAME PRICE
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines or headers
            if (trimmedLine.length < 5) continue;
            if (trimmedLine.toLowerCase().includes('codigo') || 
                trimmedLine.toLowerCase().includes('producto') ||
                trimmedLine.toLowerCase().includes('precio') ||
                trimmedLine.toLowerCase().includes('descripción')) {
                continue;
            }

            // Try to extract price (look for $ or numbers with 2 decimals)
            const priceMatch = trimmedLine.match(/\$?\s?(\d+[.,]\d{2})/);
            if (!priceMatch) continue;

            const price = parseFloat(priceMatch[1].replace(',', '.'));
            if (isNaN(price) || price < 0) continue;

            // Try to extract code (look for patterns like P-001, COD123, etc.)
            const codeMatch = trimmedLine.match(/([A-Z]{1,3}[-.]?\d{2,5})/i);
            const code = codeMatch ? codeMatch[1].toUpperCase() : `AUTO-${Date.now()}`;

            // Extract name (everything else)
            let name = trimmedLine
                .replace(priceMatch[0], '')
                .replace(codeMatch ? codeMatch[0] : '', '')
                .replace(/[-|]/g, ' ')
                .trim();

            // Clean up name
            name = name.replace(/\s+/g, ' ').trim();
            
            if (name.length < 2) continue;

            products.push({
                code,
                name,
                price,
                stock: 0,
                min: 5
            });
        }

        return products;
    };

    const handleImport = () => {
        if (extractedData.length === 0) return;
        onImport(extractedData);
        handleClose();
    };

    const handleClose = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setExtractedData([]);
        setStep('upload');
        setError(null);
        setProgress(0);
        onClose();
    };

    return (
        <div className="ocr-import-overlay">
            <div className="ocr-import-modal">
                <div className="ocr-import-header">
                    <h2 className="text-h2 flex items-center gap-2">
                        <FileText size={24} className="text-primary" />
                        Digitalizar Lista de Precios (OCR)
                    </h2>
                    <button className="btn-icon" onClick={handleClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="ocr-import-body">
                    {/* STEP 1: UPLOAD */}
                    {step === 'upload' && (
                        <div className="ocr-step">
                            <div 
                                className="ocr-upload-area"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />
                                <Upload size={48} className="text-muted mb-4" />
                                <h3 className="text-h3 mb-2">Subí la imagen de la lista de precios</h3>
                                <p className="text-body text-muted mb-4">
                                    Podés subir una foto o PDF de la lista de tu proveedor
                                </p>
                                {previewUrl && (
                                    <div className="ocr-preview">
                                        <img src={previewUrl} alt="Preview" />
                                    </div>
                                )}
                                <button className="btn btn-secondary">Seleccionar Archivo</button>
                            </div>

                            {error && (
                                <div className="ocr-error">
                                    <AlertCircle size={20} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="ocr-info mt-6">
                                <h4 className="text-h4 mb-3 flex items-center gap-2">
                                    <ImageIcon size={18} />
                                    Consejos para mejores resultados
                                </h4>
                                <ul className="ocr-tips">
                                    <li>✅ Usá imágenes bien iluminadas</li>
                                    <li>✅ Que el texto sea legible</li>
                                    <li>✅ Evitá imágenes borrosas</li>
                                    <li>✅ Formato recomendado: JPG o PNG</li>
                                </ul>
                            </div>

                            {selectedFile && (
                                <div className="ocr-actions">
                                    <button className="btn btn-secondary" onClick={handleClose}>
                                        Cancelar
                                    </button>
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={handleProcessOCR}
                                    >
                                        <FileText size={18} />
                                        Procesar con OCR
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: PROCESSING */}
                    {step === 'processing' && (
                        <div className="ocr-step ocr-processing">
                            <div className="ocr-progress-container">
                                <Loader size={64} className="ocr-spinner" />
                                <h3 className="text-h3 mb-4">Procesando imagen...</h3>
                                <div className="ocr-progress-bar">
                                    <div 
                                        className="ocr-progress-fill" 
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-muted">{progress}% completado</p>
                                <p className="text-small text-muted mt-2">
                                    Extrayendo texto de la imagen...
                                </p>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: REVIEW */}
                    {step === 'review' && (
                        <div className="ocr-step">
                            <div className="ocr-review-header">
                                <h3 className="text-h3">Productos Extraídos</h3>
                                <span className="badge badge-primary">
                                    {extractedData.length} productos
                                </span>
                            </div>

                            {extractedData.length === 0 ? (
                                <div className="ocr-no-results">
                                    <AlertCircle size={48} className="text-muted mb-4 opacity-20" />
                                    <h4 className="text-h4 mb-2">No se detectaron productos</h4>
                                    <p className="text-muted">
                                        Intentá con otra imagen más clara o verificá que el texto sea legible.
                                    </p>
                                </div>
                            ) : (
                                <div className="ocr-products-table">
                                    <table className="ocr-table">
                                        <thead>
                                            <tr>
                                                <th>Código</th>
                                                <th>Nombre</th>
                                                <th className="text-right">Precio</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {extractedData.map((product, index) => (
                                                <tr key={index}>
                                                    <td className="font-mono text-small">{product.code}</td>
                                                    <td>{product.name}</td>
                                                    <td className="text-right font-bold">
                                                        ${product.price.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="ocr-actions">
                                <button className="btn btn-secondary" onClick={handleClose}>
                                    Cancelar
                                </button>
                                <button 
                                    className="btn btn-success" 
                                    onClick={handleImport}
                                    disabled={extractedData.length === 0}
                                >
                                    <Check size={18} />
                                    Importar {extractedData.length} Productos
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: RESULT */}
                    {step === 'result' && (
                        <div className="ocr-step ocr-result">
                            <div className="ocr-result-icon">
                                <CheckCircle2 size={64} className="text-success" />
                            </div>
                            <h3 className="text-h2 mb-4">¡Importación Completada!</h3>
                            <p className="text-body mb-6">
                                Los productos fueron importados exitosamente.
                            </p>
                            <button className="btn btn-primary" onClick={handleClose}>
                                Cerrar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

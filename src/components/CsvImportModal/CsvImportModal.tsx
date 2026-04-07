import React, { useState } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Loader2, Download } from 'lucide-react';
import api from '../../services/api';
import './CsvImportModal.css';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ updated: number, created: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const hasValidExtension = validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));

      if (!hasValidExtension) {
        setError('Por favor selecciona un archivo CSV o Excel (.xlsx, .xls, .csv)');
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/import-data/parse-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al procesar el archivo' }));
        throw new Error(errorData.message || 'Error al procesar el archivo');
      }

      const parsedData = await response.json();

      const importResponse = await api.request<any>('/import-data/bulk-import', {
        method: 'POST',
        body: JSON.stringify({
          data: parsedData,
          update_prices: true,
          update_stock: false
        })
      });

      setImportResult({
        updated: importResponse.updated || 0,
        created: importResponse.created || 0
      });
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Error desconocido durante la importación');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = 'Código,Nombre,Precio,Costo,Stock,Categoría\nPROD001,Producto Ejemplo,1000,500,10,Flores';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_productos.csv';
    link.click();
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="csv-import-overlay" onClick={handleClose}>
      <div className="csv-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="csv-import-header">
          <div className="header-content">
            <div className="header-icon">
              <Upload size={24} />
            </div>
            <h2>Importar Productos</h2>
            <p className="header-subtitle">Excel o CSV</p>
          </div>
          <button onClick={handleClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <div className="csv-import-body">
          {!importResult ? (
            <div className="import-content">
              <div className="instructions-section">
                <h3>¿Cómo importar?</h3>
                <div className="steps-list">
                  <div className="step-item">
                    <div className="step-number">1</div>
                    <div className="step-text">
                      <strong>Descarga la plantilla</strong> o prepara tu archivo con las columnas: Código, Nombre, Precio, Costo, Stock
                    </div>
                  </div>
                  <div className="step-item">
                    <div className="step-number">2</div>
                    <div className="step-text">
                      <strong>Selecciona tu archivo</strong> CSV o Excel (.xlsx, .xls)
                    </div>
                  </div>
                  <div className="step-item">
                    <div className="step-number">3</div>
                    <div className="step-text">
                      <strong>Haz clic en Importar</strong> y espera a que se procesen los datos
                    </div>
                  </div>
                </div>

                <button onClick={handleDownloadTemplate} className="template-download-btn">
                  <Download size={18} />
                  <span>Descargar plantilla CSV</span>
                </button>
              </div>

              <div className={`upload-area ${file ? 'has-file' : ''}`}>
                <input
                  type="file"
                  id="csv-file"
                  accept=".csv, .xlsx, .xls"
                  className="file-input"
                  onChange={handleFileChange}
                />
                <label htmlFor="csv-file" className="upload-label">
                  {file ? (
                    <div className="file-selected">
                      <div className="file-icon">
                        <FileText size={32} />
                      </div>
                      <div className="file-info">
                        <p className="file-name">{file.name}</p>
                        <p className="file-size">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                      <Check size={24} className="file-check" />
                    </div>
                  ) : (
                    <>
                      <div className="upload-icon">
                        <Upload size={48} />
                      </div>
                      <p className="upload-title">Arrastra tu archivo aquí</p>
                      <p className="upload-subtitle">o haz clic para seleccionar</p>
                      <p className="upload-formats">Formatos: .csv, .xlsx, .xls</p>
                    </>
                  )}
                </label>
              </div>

              {error && (
                <div className="error-message">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <div className="import-actions">
                <button onClick={handleClose} className="btn-cancel" disabled={isImporting}>
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  className="btn-import"
                  disabled={!file || isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 size={18} className="spinner-icon" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Empezar Importación
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="success-screen">
              <div className="success-icon">
                <Check size={48} />
              </div>
              <h3>¡Importación Exitosa!</h3>
              <p className="success-subtitle">Tu archivo ha sido procesado correctamente</p>

              <div className="results-summary">
                <div className="result-card">
                  <p className="result-number">{importResult.updated}</p>
                  <p className="result-label">Productos Actualizados</p>
                </div>
                <div className="result-card">
                  <p className="result-number">{importResult.created}</p>
                  <p className="result-label">Productos Creados</p>
                </div>
              </div>

              <button onClick={handleClose} className="btn-finish">
                Finalizar y Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CsvImportModal;
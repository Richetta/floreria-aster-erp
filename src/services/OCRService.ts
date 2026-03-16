/**
 * OCR Service for Florería Aster
 * Uses Tesseract.js via CDN for text extraction from images (boletas/receipts)
 */

export interface OCRResult {
    text: string;
    confidence: number;
    lines: string[];
}

class OCRService {
    // @ts-ignore - Worker es crea dinàmicament
    private _worker: any = null;
    private isInitialized = false;

    /**
     * Initialize Tesseract worker
     * Loads from CDN to avoid bundle size issues and local install problems
     */
    async init() {
        if (this.isInitialized) return;

        try {
            // Dynamically load Tesseract from CDN if not already in global scope
            if (!(window as any).Tesseract) {
                await this.loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
            }

            const Tesseract = (window as any).Tesseract;
            this._worker = await Tesseract.createWorker('spa'); // Spanish
            this.isInitialized = true;
            console.log('OCR Service initialized');
        } catch (error) {
            console.error('Failed to initialize OCR Service:', error);
            throw new Error('No se pudo inicializar el servicio de reconocimiento de texto.');
        }
    }

    private loadScript(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject();
            document.head.appendChild(script);
        });
    }

    /**
     * Extract text from an image (File or URL)
     */
    async extractText(image: File | string): Promise<OCRResult> {
        if (!this.isInitialized) {
            await this.init();
        }

        const Tesseract = (window as any).Tesseract;
        
        try {
            const { data } = await Tesseract.recognize(image, 'spa');
            
            return {
                text: data.text,
                confidence: data.confidence,
                lines: data.lines.map((l: any) => l.text.trim()).filter((l: string) => l.length > 0)
            };
        } catch (error) {
            console.error('OCR Extraction failed:', error);
            throw new Error('Error al procesar la imagen.');
        }
    }

    /**
     * Try to parse common receipt data from extracted text
     */
    parseReceipt(text: string) {
        // Simple regex patterns for Spanish receipts
        const totalRegex = /(TOTAL|IMPORTE|SUMA|PAGAR|FINAL)\s*[:$]*\s*([\d.,]+)/i;
        const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
        
        const totalMatch = text.match(totalRegex);
        const dateMatch = text.match(dateRegex);

        return {
            total: totalMatch ? parseFloat(totalMatch[2].replace('.', '').replace(',', '.')) : null,
            date: dateMatch ? `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}` : null,
            raw: text
        };
    }
}

export const ocrService = new OCRService();

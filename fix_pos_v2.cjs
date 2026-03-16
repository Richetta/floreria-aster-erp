const fs = require('fs');
const path = require('path');

const posFile = path.resolve('src/pages/POS/POS.tsx');
let content = fs.readFileSync(posFile, 'utf8');

// Use a more flexible regex for replacement
// Find the delivery date section and insert the toggle before it
const searchPattern = /<div className="form-group mb-0">\s*<label[^>]*><Calendar[^>]*\/> Fecha Entrega<\/label>\s*<input[^>]*type="date"[^>]*\/>\s*<\/div>/;

const replacement = `                            <div className="form-group mb-4">
                                <label className="form-label text-micro text-muted flex items-center gap-1 uppercase tracking-wider mb-2">
                                    Tipo de Entrega
                                </label>
                                <div className="flex bg-surface p-1 rounded-xl border border-border">
                                    <button 
                                        className={\`flex-1 py-2 px-1 rounded-lg text-micro font-bold transition-all flex items-center justify-center gap-1 \${deliveryMethod === 'pickup' ? 'bg-primary text-white shadow-md' : 'text-muted hover:bg-surface-hover'}\`}
                                        onClick={() => setDeliveryMethod('pickup')}
                                    >
                                        🛍️ Local
                                    </button>
                                    <button 
                                        className={\`flex-1 py-2 px-1 rounded-lg text-micro font-bold transition-all flex items-center justify-center gap-1 \${deliveryMethod === 'delivery' ? 'bg-primary text-white shadow-md' : 'text-muted hover:bg-surface-hover'}\`}
                                        onClick={() => setDeliveryMethod('delivery')}
                                    >
                                        🛵 Envío
                                    </button>
                                </div>
                            </div>

                            <div className="form-group mb-0">
                                <label className="form-label text-micro text-muted flex items-center gap-1 uppercase tracking-wider mb-1"><Calendar size={12}/> Fecha Entrega</label>
                                <input
                                    type="date"
                                    className="form-input text-small py-2 border-primary-light"
                                    value={deliveryDate}
                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]} // No past dates
                                />
                            </div>`;

if (searchPattern.test(content)) {
    content = content.replace(searchPattern, replacement);
    fs.writeFileSync(posFile, content);
    console.log('Successfully updated POS.tsx with Delivery Method toggle.');
} else {
    console.error('Could not find target content in POS.tsx');
    process.exit(1);
}

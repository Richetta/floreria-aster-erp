const fs = require('fs');
const path = require('path');

const posFile = path.resolve('src/pages/POS/POS.tsx');
let lines = fs.readFileSync(posFile, 'utf8').split('\n');

// Find the index of the "Fecha Entrega" section
let index = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Fecha Entrega') && lines[i].includes('<label')) {
        // We want to insert BEFORE the parent div of this label
        // Usually it's the div on the line above
        if (i > 0 && lines[i-1].includes('form-group')) {
            index = i - 1;
        } else {
            index = i;
        }
        break;
    }
}

if (index !== -1) {
    const toggleHtml = `                            <div className="form-group mb-4">
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
`;
    lines.splice(index, 0, toggleHtml);
    fs.writeFileSync(posFile, lines.join('\n'));
    console.log('Successfully injected Delivery Method toggle into POS.tsx');
} else {
    console.error('Could not find injection point in POS.tsx');
    process.exit(1);
}

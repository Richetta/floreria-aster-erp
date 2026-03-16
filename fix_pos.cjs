const fs = require('fs');
const path = require('path');

const posFile = path.resolve('src/pages/POS/POS.tsx');
let content = fs.readFileSync(posFile, 'utf8');

// The multi_replace failed earlier. Let's do it right.
// Find:
// const [orderNotes, setOrderNotes] = useState<string>('');
// Replace with:
// const [orderNotes, setOrderNotes] = useState<string>('');
// const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
content = content.replace(
    /const \[orderNotes, setOrderNotes\] = useState<string>\(''\);/,
    "const [orderNotes, setOrderNotes] = useState<string>('');\n    const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');"
);

// Find:
// <div className="form-group mb-4">
// <label className="text-small font-bold text-muted mb-1 block">Fecha y Hora de Entrega \*<\/label>
// Replace with the layout including delivery toggle
const formGroupRegex = /<div className="form-group mb-4">\s*<label className="text-small font-bold text-muted mb-1 block">Fecha y Hora de Entrega \*/;

const newFormGroup = `<div className="form-group mb-4">
                                        <label className="text-small font-bold text-muted mb-1 block">Tipo de Entrega *</label>
                                        <div className="flex bg-surface p-1 rounded-xl border border-border">
                                            <button 
                                                className={\`flex-1 py-3 px-2 rounded-lg text-small font-bold transition-all flex items-center justify-center gap-2 \${deliveryMethod === 'pickup' ? 'bg-primary text-white shadow-md' : 'text-muted hover:bg-surface-hover'}\`}
                                                onClick={() => setDeliveryMethod('pickup')}
                                            >
                                                🛍️ Retira por Local
                                            </button>
                                            <button 
                                                className={\`flex-1 py-3 px-2 rounded-lg text-small font-bold transition-all flex items-center justify-center gap-2 \${deliveryMethod === 'delivery' ? 'bg-primary text-white shadow-md' : 'text-muted hover:bg-surface-hover'}\`}
                                                onClick={() => setDeliveryMethod('delivery')}
                                            >
                                                🛵 Envío a Domicilio
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-group mb-4">
                                        <label className="text-small font-bold text-muted mb-1 block">Fecha y Hora de Entrega *`;

content = content.replace(formGroupRegex, newFormGroup);

fs.writeFileSync(posFile, content);
console.log('Fixed POS.tsx deliveryMethod.');

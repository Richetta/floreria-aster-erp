const fs = require('fs');

const file = './src/pages/StorefrontCustomizer/StorefrontCustomizer.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Imports
content = content.replace(
    /import \{\s*Globe, Save, Undo, Sparkles, Instagram, Facebook,\s*Search, Plus, Store, Image,\s*Info, ExternalLink, Copy, Check,\s*Settings, ShoppingBag, Star, Trash2, Edit3,\s*Eye, EyeOff, Shield, CreditCard, Percent, ChevronUp, ChevronDown,\s*X, ArrowRight, Palette, Camera\s*\} from 'lucide-react';/,
    `import { 
    Globe, Save, Undo, Sparkles, Instagram, Facebook,
    Search, Plus, Store, Image,
    Info, ExternalLink, Copy, Check,
    Settings, ShoppingBag, Star, Trash2, Edit3,
    Eye, EyeOff, Shield, CreditCard, Percent, ChevronUp, ChevronDown,
    X, ArrowRight, Palette, Camera, UploadCloud, Type, AlignCenter, AlignLeft, AlignRight, Tag
} from 'lucide-react';
import { CloudinaryUploadWidget } from '../../components/CloudinaryUploadWidget/CloudinaryUploadWidget';`
);

// 2. Add properties to initial state
content = content.replace(
    /seasonal_theme: 'none' as 'none' \| 'mother_day' \| 'valentines' \| 'spring' \| 'christmas',/,
    `seasonal_theme: 'none' as 'none' | 'mother_day' | 'valentines' | 'spring' | 'christmas',
        font_family: 'Inter',
        banner_alignment: 'center' as 'left' | 'center' | 'right',
        marquee_text: '',
        web_categories: [] as string[],`
);

// 3. Load logic
content = content.replace(
    /seasonal_theme: sf\.seasonal_theme \|\| 'none',/,
    `seasonal_theme: sf.seasonal_theme || 'none',
                    font_family: sf.font_family || 'Inter',
                    banner_alignment: sf.banner_alignment || 'center',
                    marquee_text: sf.marquee_text || '',
                    web_categories: sf.web_categories || [],`
);

// 4. Logo UI update
content = content.replace(
    /<label className="sc-label">Logo de la Tienda \(URL\)<\/label>\s*<input type="url" className="sc-input" value=\{form\.logo_url\}([\s\S]*?)<\/div>/,
    `<label className="sc-label">Logo de la Tienda (URL)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input type="url" className="sc-input" style={{ flex: 1 }} value={form.logo_url} onChange={e => setField('logo_url', e.target.value)} placeholder="https://..." />
                                            <CloudinaryUploadWidget onSuccess={(url) => setField('logo_url', url)} options={{ cropping: true, croppingAspectRatio: 1 }}>
                                                {(open) => (
                                                    <button type="button" className="sc-btn-secondary" onClick={open}><UploadCloud size={15} /></button>
                                                )}
                                            </CloudinaryUploadWidget>
                                        </div>
                                        {form.logo_url && (
                                            <div className="sc-img-preview">
                                                <img src={form.logo_url} alt="Logo preview" onError={e => (e.currentTarget.style.display = 'none')} />
                                            </div>
                                        )}
                                    </div>`
);

// 5. Profile Image UI update
content = content.replace(
    /<label className="sc-label">Foto de Perfil de la Tienda \(URL\)<\/label>\s*<input type="url" className="sc-input" value=\{form\.profile_image_url\}([\s\S]*?)<\/div>/,
    `<label className="sc-label">Foto de Perfil de la Tienda (URL)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input type="url" className="sc-input" style={{ flex: 1 }} value={form.profile_image_url} onChange={e => setField('profile_image_url', e.target.value)} placeholder="https://..." />
                                            <CloudinaryUploadWidget onSuccess={(url) => setField('profile_image_url', url)} options={{ cropping: true, croppingAspectRatio: 1 }}>
                                                {(open) => (
                                                    <button type="button" className="sc-btn-secondary" onClick={open}><UploadCloud size={15} /></button>
                                                )}
                                            </CloudinaryUploadWidget>
                                        </div>
                                        {form.profile_image_url && (
                                            <div className="sc-img-preview sc-img-preview-round">
                                                <img src={form.profile_image_url} alt="Perfil preview" onError={e => (e.currentTarget.style.display = 'none')} />
                                            </div>
                                        )}
                                    </div>`
);

// 6. Add Typography and Banner alignment to Diseño tab
const typographyHtml = `
                            {/* Typography Section */}
                            <div className="sc-card">
                                <div className="sc-card-header"><Type size={18} /><h2>Tipografía Global</h2></div>
                                <div className="sc-presets-grid">
                                    {['Inter', 'Outfit', 'Playfair Display', 'Caveat', 'Lora', 'Roboto'].map(font => (
                                        <button
                                            key={font}
                                            className={\`sc-preset-btn \${form.font_family === font ? 'active' : ''}\`}
                                            onClick={() => setField('font_family', font)}
                                            style={{ fontFamily: font, fontWeight: 600, fontSize: '1rem' }}
                                        >
                                            <span>{font}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Banner Layout */}
                            <div className="sc-card">
                                <div className="sc-card-header"><AlignCenter size={18} /><h2>Estilo de Banner</h2></div>
                                <div className="sc-form-row">
                                    <div className="sc-form-group">
                                        <label className="sc-label">Alineación de Texto</label>
                                        <div className="sc-btn-group">
                                            {[
                                                { val: 'left', icon: AlignLeft, label: 'Izq' },
                                                { val: 'center', icon: AlignCenter, label: 'Centro' },
                                                { val: 'right', icon: AlignRight, label: 'Der' },
                                            ].map(opt => (
                                                <button
                                                    key={opt.val}
                                                    className={\`sc-btn-option \${form.banner_alignment === opt.val ? 'active' : ''}\`}
                                                    onClick={() => setField('banner_alignment', opt.val as any)}
                                                >
                                                    <opt.icon size={15} style={{ marginRight: 4 }} /> {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="sc-form-group">
                                        <label className="sc-label">Cinta Infinita en movimiento (Marquee)</label>
                                        <input type="text" className="sc-input" value={form.marquee_text} onChange={e => setField('marquee_text', e.target.value)} placeholder="Ej: ✨ ENVÍOS GRATIS A TODO CABA ✨" />
                                    </div>
                                </div>
                            </div>
`;

content = content.replace(
    /\{activeTab === 'diseno' && \(\s*<div className="sc-tab-content">\s*<div className="sc-form-grid">/,
    `{activeTab === 'diseno' && (
                    <div className="sc-tab-content">
                        <div className="sc-form-grid">
                            ${typographyHtml}`
);


// 7. Update add slide form image
content = content.replace(
    /<input type="url" className="sc-input" value=\{slideForm\.image_url\} onChange=\{e => setSlideForm\(p => \(\{ \.\.\.p, image_url: e\.target\.value \}\)\)\} placeholder="https:\/\/imgur\.com\/imagen\.jpg" \/>/,
    `<div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input type="url" className="sc-input" style={{ flex: 1 }} value={slideForm.image_url} onChange={e => setSlideForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
                                                <CloudinaryUploadWidget onSuccess={(url) => setSlideForm(p => ({ ...p, image_url: url }))} options={{ cropping: true, croppingAspectRatio: 2.5 }}>
                                                    {(open) => (
                                                        <button type="button" className="sc-btn-secondary" onClick={open}><UploadCloud size={15} /></button>
                                                    )}
                                                </CloudinaryUploadWidget>
                                            </div>`
);

// 8. Update post modal image
content = content.replace(
    /<input type="url" className="sc-input" value=\{postForm\.image_url\} onChange=\{e => setPostForm\(p => \(\{ \.\.\.p, image_url: e\.target\.value \}\)\)\} placeholder="https:\/\/imgur\.com\/\.\.\." \/>/,
    `<div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input type="url" className="sc-input" style={{ flex: 1 }} value={postForm.image_url} onChange={e => setPostForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
                                    <CloudinaryUploadWidget onSuccess={(url) => setPostForm(p => ({ ...p, image_url: url }))} options={{ cropping: true, croppingAspectRatio: 1 }}>
                                        {(open) => (
                                            <button type="button" className="sc-btn-secondary" onClick={open}><UploadCloud size={15} /></button>
                                        )}
                                    </CloudinaryUploadWidget>
                                </div>`
);


// 9. Replace Category options to include custom Web Categories mapping
const webCategoriesHtml = `
                            {/* Web Categories Management */}
                            <div className="sc-card sc-card-wide" style={{ marginTop: '1.5rem' }}>
                                <div className="sc-card-header"><Tag size={18} /><h2>Categorías de la Web</h2></div>
                                <p className="sc-card-desc">Crea secciones exclusivas para organizar tu tienda online (ej: Ramos, Cajas, Combos).</p>
                                <div className="sc-form-row">
                                    <div className="sc-form-group" style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input 
                                                type="text" 
                                                className="sc-input" 
                                                placeholder="Nueva categoría web..." 
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                        const v = e.currentTarget.value.trim();
                                                        if (!form.web_categories.includes(v)) {
                                                            setField('web_categories', [...form.web_categories, v]);
                                                        }
                                                        e.currentTarget.value = '';
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="sc-filter-chips" style={{ marginTop: '0.5rem' }}>
                                    {form.web_categories.map(wc => (
                                        <div key={wc} className="sc-chip" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingRight: '0.25rem' }}>
                                            {wc}
                                            <button className="sc-icon-btn" style={{ padding: 2, margin: 0, width: 20, height: 20 }} onClick={() => setField('web_categories', form.web_categories.filter(c => c !== wc))}>
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {form.web_categories.length === 0 && <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Aún no hay categorías personalizadas.</span>}
                                </div>
                            </div>
`;

content = content.replace(
    /\{allCatalogItems\.length === 0 \? \(/,
    `\${webCategoriesHtml}
                            <div className="sc-catalog-list" style={{ marginTop: '1.5rem' }}>
                                {allCatalogItems.length === 0 ? (`
);

// Allow stock items to select web category
// Find the toggle
content = content.replace(
    /<div className="sc-catalog-badge-input">\s*<input\s*type="text"\s*placeholder='Etiqueta \(ej: "15% OFF"\)'\s*value=\{form\.promotions\[item\.id\]\?\.badge \|\| ''\}\s*onChange=\{e => setForm\(prev => \(\{\s*\.\.\.prev,\s*promotions: \{ \.\.\.prev\.promotions, \[item\.id\]: \{ \.\.\.prev\.promotions\[item\.id\], badge: e\.target\.value \} \}\s*\}\)\)\}\s*\/>\s*<\/div>/g,
    `<div className="sc-catalog-badge-input" style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input
                                                type="text"
                                                placeholder='Etiqueta (ej: "15% OFF")'
                                                value={form.promotions[item.id]?.badge || ''}
                                                onChange={e => setForm(prev => ({
                                                    ...prev,
                                                    promotions: { ...prev.promotions, [item.id]: { ...prev.promotions[item.id], badge: e.target.value } }
                                                }))}
                                            />
                                            <select 
                                                className="sc-input" 
                                                style={{ minWidth: 120, height: 38 }}
                                                value={(form.promotions[item.id] as any)?.web_category || ''}
                                                onChange={e => setForm(prev => ({
                                                    ...prev,
                                                    promotions: { ...prev.promotions, [item.id]: { ...prev.promotions[item.id], web_category: e.target.value } }
                                                }))}
                                            >
                                                <option value="">Sin Categoría Web</option>
                                                {form.web_categories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>`
);

// Update post modal category selector to use web_categories if available
content = content.replace(
    /<select className="sc-input" value=\{postForm\.category_tag\} onChange=\{e => setPostForm\(p => \(\{ \.\.\.p, category_tag: e\.target\.value \}\)\)\}>\s*\{CATEGORY_TAGS\.map\(t => <option key=\{t\}>\{t\}<\/option>\)\}\s*<\/select>/,
    `<select className="sc-input" value={postForm.category_tag} onChange={e => setPostForm(p => ({ ...p, category_tag: e.target.value }))}>
                                        {form.web_categories.length > 0 ? (
                                            <>
                                                {CATEGORY_TAGS.map(t => <option key={t}>{t}</option>)}
                                                <optgroup label="Mis Categorías Web">
                                                    {form.web_categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                </optgroup>
                                            </>
                                        ) : (
                                            CATEGORY_TAGS.map(t => <option key={t}>{t}</option>)
                                        )}
                                    </select>`
);

fs.writeFileSync(file, content);
console.log('Patch applied to StorefrontCustomizer.tsx');

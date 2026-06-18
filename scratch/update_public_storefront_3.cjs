const fs = require('fs');

const file = './src/pages/PublicStorefront/PublicStorefront.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Categories logic replacement
const categoriesRegex = /\{\/\* Category pills \*\/\}([\s\S]*?)<\/div>/;
const newCategories = `{/* Category pills */}
                    <div className="category-scroll-wrapper">
                        <button
                            className={\`category-pill \${selectedCategory === null ? 'active' : ''}\`}
                            onClick={() => setSelectedCategory(null)}
                        >
                            Todos
                        </button>
                        {storeConfig?.settings?.web_categories?.map((cat: string) => (
                            <button
                                key={cat}
                                className={\`category-pill \${selectedCategory === cat ? 'active' : ''}\`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                        {(!storeConfig?.settings?.web_categories || storeConfig.settings.web_categories.length === 0) && (
                            <>
                                {combos.some(c => c.storefront_published) && (
                                    <button
                                        className={\`category-pill \${selectedCategory === 'combos' ? 'active' : ''}\`}
                                        onClick={() => setSelectedCategory('combos')}
                                    >
                                        Combos Especiales
                                    </button>
                                )}
                                {categories.filter(cat => products.some(p => p.category_id === cat.id && p.storefront_published)).map(cat => (
                                    <button
                                        key={cat.id}
                                        className={\`category-pill \${selectedCategory === cat.id ? 'active' : ''}\`}
                                        onClick={() => setSelectedCategory(cat.id)}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>`;

content = content.replace(categoriesRegex, newCategories);

// 2. Rearrange Header and Hero Slider
// Instead of complex regex, I will just apply inline styles or CSS class adjustments.
// The user complained about the "solid color" where the banner should go.
// Currently store-header has `background: linear-gradient(...)` and Hero Slider is below it.
// Let's remove the background from store-header IF there is a hero slider.
const headerRegex = /<header className="store-header" style={{([\s\S]*?)}}>/;
content = content.replace(headerRegex, `<header className={\`store-header \${storeConfig.settings?.hero_slides?.length > 0 ? 'has-hero' : ''}\`}>`);

// 3. Add explicit 'Ver detalle' button to Product Card
// Find: <Plus size={16} /><span>Agregar</span></button></div></div></div>
const productCardActionsRegex = /<div className="p-price-action" onClick=\{e => e\.stopPropagation\(\)\}>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;

content = content.replace(productCardActionsRegex, (match, inner) => {
    return `<div className="p-price-action">
                                                <span className="p-price">{formatCurrency(product.price)}</span>
                                                <div className="p-action-buttons">
                                                    <button 
                                                        className="btn btn-secondary btn-view-detail"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedDetailItem(product); }}
                                                    >
                                                        <Eye size={16} /> Ver más
                                                    </button>
                                                    <button 
                                                        className={\`btn btn-primary add-to-cart-btn \${outOfStock ? 'disabled' : ''}\`}
                                                        onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                                                        disabled={outOfStock}
                                                    >
                                                        <Plus size={16} /> Agregar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>`;
});


// 4. Emojis removal: remove from marquee if any, but marquee is user-defined. The emojis in categories are removed above.
// 5. Add Eye icon to lucide-react imports if not there.
if (!content.includes(', Eye, ')) {
    content = content.replace('X, Check,', 'X, Check, Eye,');
}

fs.writeFileSync(file, content);
console.log('PublicStorefront.tsx updated');

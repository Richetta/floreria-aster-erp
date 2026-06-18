const fs = require('fs');

const file = './src/pages/PublicStorefront/PublicStorefront.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Dynamic Font Loader and CSS Variables
content = content.replace(
    /const link = document\.createElement\('link'\);\s*link\.href = 'https:\/\/fonts\.googleapis\.com\/css2\?family=Outfit:wght@300;400;500;600;700;800&display=swap';/,
    `const fontFam = storeConfig?.settings?.font_family || 'Inter';
        const formattedFont = fontFam.replace(/ /g, '+');
        const link = document.createElement('link');
        link.href = \`https://fonts.googleapis.com/css2?family=\${formattedFont}:wght@300;400;500;600;700;800&display=swap\`;`
);

content = content.replace(
    /document\.documentElement\.style\.setProperty\('--storefront-primary-hover', adjustColorBrightness\(color, -15\)\);/,
    `document.documentElement.style.setProperty('--storefront-primary-hover', adjustColorBrightness(color, -15));
            document.documentElement.style.setProperty('--storefront-font', storeConfig?.settings?.font_family || 'Inter');`
);

// 2. Marquee and Header logic
// Let's add marquee right above the hero section or header
content = content.replace(
    /<div className="storefront-container">/,
    `<div className="storefront-container" style={{ fontFamily: 'var(--storefront-font)' }}>
            {storeConfig?.settings?.marquee_text && (
                <div className="storefront-marquee">
                    <div className="marquee-content">
                        <span>{storeConfig.settings.marquee_text}</span>
                        <span>{storeConfig.settings.marquee_text}</span>
                        <span>{storeConfig.settings.marquee_text}</span>
                        <span>{storeConfig.settings.marquee_text}</span>
                    </div>
                </div>
            )}`
);

// 3. Banner Alignment
content = content.replace(
    /<div className="hero-slide-content">/,
    `<div className="hero-slide-content" style={{ textAlign: storeConfig?.settings?.banner_alignment || 'center' }}>`
);

// 4. Web Categories Tabs
// Find the category-pill rendering logic
content = content.replace(
    /<div className="categories-scroll">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*\{!selectedCategory && storeConfig\?\.settings\?\.storefront_posts/,
    `<div className="categories-scroll">
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
                                                🎁 Combos Especiales
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
                            </div>
                        </div>
                    </div>

                    {!selectedCategory && storeConfig?.settings?.storefront_posts`
);

// 5. Update matchesCategory logic to respect web_categories
content = content.replace(
    /const matchesCategory = !selectedCategory \|\| item\.category_id === selectedCategory;/,
    `let matchesCategory = !selectedCategory || item.category_id === selectedCategory;
        if (storeConfig?.settings?.web_categories?.length > 0 && selectedCategory) {
            const promotions = storeConfig?.settings?.promotions || {};
            const promo = promotions[item.id] || {};
            matchesCategory = promo.web_category === selectedCategory;
        }`
);

fs.writeFileSync(file, content);
console.log('Patch applied to PublicStorefront.tsx');

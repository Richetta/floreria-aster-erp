import { useState } from 'react';
import type { Category } from '../../store/slices/types';
import './CategoryTreeMobile.css';

interface CategoryTreeMobileProps {
    categoriesData: Category[];
    activeCategory: string; // 'Todos' or category ID
    onSelect: (id: string) => void;
}

interface TreeNodeProps {
    cat: Category;
    allCats: Category[];
    activeCategory: string;
    onSelect: (id: string) => void;
    depth: number;
}

const getCatIcon = (name: string): string => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('flor')) return 'local_florist';
    if (lower.includes('planta')) return 'potted_plant';
    if (lower.includes('regalo') || lower.includes('regal')) return 'card_giftcard';
    if (lower.includes('insumo') || lower.includes('maceta')) return 'inventory_2';
    if (lower.includes('acceso')) return 'category';
    if (lower.includes('fertil') || lower.includes('tierra')) return 'compost';
    return 'folder';
};

const TreeNode = ({ cat, allCats, activeCategory, onSelect, depth }: TreeNodeProps) => {
    // If the data is already hierarchical, use cat.children. 
    // Otherwise, find children in the flat list.
    const effectiveChildren = (cat.children && cat.children.length > 0)
        ? cat.children
        : allCats.filter(c => c.parent_id === cat.id);

    const hasChildren = effectiveChildren.length > 0;

    // Helper to check if any descendant is selected
    const isDescendantSelected = (category: Category): boolean => {
        if (!category) return false;
        
        // Check immediate children from either property or flat list
        const kids = (category.children && category.children.length > 0)
            ? category.children
            : allCats.filter(c => c.parent_id === category.id);
            
        return kids.some(k => k.id === activeCategory || isDescendantSelected(k));
    };

    const isActive = activeCategory === cat.id;
    const hasActiveDescendant = isDescendantSelected(cat);

    // Auto-open if a child is selected, else use local toggle
    const [manualOpen, setManualOpen] = useState(false);
    const isOpen = manualOpen || hasActiveDescendant;

    return (
        <div className={`cat-tree-node`}>
            <div
                className={`cat-tree-row ${isActive ? 'active' : ''} ${hasActiveDescendant && !isActive ? 'parent-active' : ''}`}
                style={{ paddingLeft: `${1 + depth * 0.75}rem` }}
                onClick={() => {
                    onSelect(cat.id);
                    if (hasChildren) setManualOpen(!isOpen);
                }}
            >
                {/* Connector lines for depth */}
                {depth > 0 && <span className="cat-tree-connector" />}

                {/* Icon */}
                <span className="cat-tree-icon material-symbols-rounded">
                    {depth === 0 ? getCatIcon(cat.name) : 'subdirectory_arrow_right'}
                </span>

                {/* Label */}
                <span className="cat-tree-label">{cat.name}</span>

                {/* Expand/collapse arrow */}
                {hasChildren && (
                    <span
                        className={`cat-tree-arrow material-symbols-rounded ${isOpen ? 'open' : ''}`}
                        onClick={e => { e.stopPropagation(); setManualOpen(!isOpen); }}
                    >
                        chevron_right
                    </span>
                )}
            </div>

            {/* Children */}
            {hasChildren && isOpen && (
                <div className="cat-tree-children">
                    {effectiveChildren.map(child => (
                        <TreeNode
                            key={child.id}
                            cat={child}
                            allCats={allCats}
                            activeCategory={activeCategory}
                            onSelect={onSelect}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const CategoryTreeMobile = ({ categoriesData, activeCategory, onSelect }: CategoryTreeMobileProps) => {
    // If we have a hierarchy, categoriesData might already be filtered to top level 
    // or it's a flat list. We need to handle both.
    const topLevel = categoriesData.filter(c => !c.parent_id);

    return (
        <div className="cat-tree-wrapper">
            {/* "Todos" row */}
            <div
                className={`cat-tree-row ${activeCategory === 'Todos' ? 'active' : ''}`}
                style={{ paddingLeft: '1rem' }}
                onClick={() => onSelect('Todos')}
            >
                <span className="cat-tree-icon material-symbols-rounded">apps</span>
                <span className="cat-tree-label">Todos los productos</span>
            </div>

            {topLevel.map(cat => (
                <TreeNode
                    key={cat.id}
                    cat={cat}
                    allCats={categoriesData}
                    activeCategory={activeCategory}
                    onSelect={onSelect}
                    depth={0}
                />
            ))}
        </div>
    );
};


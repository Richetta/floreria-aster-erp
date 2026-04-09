import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, Plus, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { Category } from '../../store/slices/types';
import './CategoryTree.css';

interface CategoryTreeProps {
    categories: Category[];
    activeCategory: string;
    onSelect: (categoryName: string) => void;
    onAddSub: (parentId: string) => void;
    onRename: (category: Category) => void;
    onDelete: (category: Category) => void;
}

const CategoryItem: React.FC<{
    category: Category;
    level: number;
    activeCategory: string;
    onSelect: (name: string) => void;
    onAddSub: (id: string) => void;
    onRename: (cat: Category) => void;
    onDelete: (cat: Category) => void;
    onMoveUp?: (cat: Category) => void;
    onMoveDown?: (cat: Category) => void;
    isFirst?: boolean;
    isLast?: boolean;
}> = ({ category, level, activeCategory, onSelect, onAddSub, onRename, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = category.children && category.children.length > 0;
    const isActive = activeCategory === category.name;

    return (
        <div className="category-tree-item-container">
            <div 
                className={`category-tree-item ${isActive ? 'active' : ''}`}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={() => onSelect(category.name)}
            >
                <div className="flex items-center gap-2 flex-1 overflow-hidden">
                    {hasChildren ? (
                        <button 
                            className="expand-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                        >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    ) : (
                        <span className="expand-placeholder" />
                    )}
                    <Folder size={16} className={isActive ? 'text-primary' : 'text-muted'} />
                    <span className="category-name text-truncate">{category.name}</span>
                </div>

                <div className="category-actions">
                    {onMoveUp && !isFirst && (
                        <button className="action-btn" onClick={(e) => { e.stopPropagation(); onMoveUp(category); }} title="Subir">
                            <ArrowUp size={14} />
                        </button>
                    )}
                    {onMoveDown && !isLast && (
                        <button className="action-btn" onClick={(e) => { e.stopPropagation(); onMoveDown(category); }} title="Bajar">
                            <ArrowDown size={14} />
                        </button>
                    )}
                    <button 
                        className="action-btn" 
                        onClick={(e) => { e.stopPropagation(); onAddSub(category.id); }}
                        title="Nueva Sub-carpeta"
                    >
                        <Plus size={14} />
                    </button>
                    <button 
                        className="action-btn" 
                        onClick={(e) => { e.stopPropagation(); onRename(category); }}
                        title="Renombrar"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button 
                        className="action-btn hover-danger" 
                        onClick={(e) => { e.stopPropagation(); onDelete(category); }}
                        title="Eliminar"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {hasChildren && isExpanded && (
                <div className="category-children">
                    {category.children!.map((child, idx) => (
                        <CategoryItem 
                            key={child.id}
                            category={child}
                            level={level + 1}
                            activeCategory={activeCategory}
                            onSelect={onSelect}
                            onAddSub={onAddSub}
                            onRename={onRename}
                            onDelete={onDelete}
                            onMoveUp={onMoveUp}
                            onMoveDown={onMoveDown}
                            isFirst={idx === 0}
                            isLast={idx === category.children!.length - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const CategoryTree: React.FC<CategoryTreeProps> = ({ 
    categories, 
    activeCategory, 
    onSelect,
    onAddSub,
    onRename,
    onDelete
}) => {
    const [orderMap, setOrderMap] = useState<Record<string, number>>(() => {
        try {
            return JSON.parse(localStorage.getItem('category_order') || '{}');
        } catch {
            return {};
        }
    });

    const saveOrderMap = (newMap: Record<string, number>) => {
        setOrderMap(newMap);
        localStorage.setItem('category_order', JSON.stringify(newMap));
    };

    const handleMove = (cat: Category, direction: 'up' | 'down') => {
        const parentId = cat.parent_id || null;
        
        // Find siblings depending on whether it's root or nested
        let siblings: Category[] = [];
        if (!parentId) {
            siblings = [...categories];
        } else {
            // Find parent recursively
            const findParent = (list: Category[]): Category | null => {
                for (const c of list) {
                    if (c.id === parentId) return c;
                    if (c.children) {
                        const found = findParent(c.children);
                        if (found) return found;
                    }
                }
                return null;
            };
            const parent = findParent(categories);
            if (parent && parent.children) {
                siblings = [...parent.children];
            }
        }
        
        siblings.sort((a, b) => (orderMap[a.id] ?? 0) - (orderMap[b.id] ?? 0));
        
        const idx = siblings.findIndex(s => s.id === cat.id);
        if (idx === -1) return;
        
        // Setup default order if empty
        const newMap = { ...orderMap };
        let changed = false;
        
        siblings.forEach((s, i) => {
            if (newMap[s.id] === undefined) {
                newMap[s.id] = i * 10;
                changed = true;
            }
        });
        
        if (direction === 'up' && idx > 0) {
            const target = siblings[idx - 1];
            const temp = newMap[cat.id];
            newMap[cat.id] = newMap[target.id];
            newMap[target.id] = temp;
            saveOrderMap(newMap);
        } else if (direction === 'down' && idx < siblings.length - 1) {
            const target = siblings[idx + 1];
            const temp = newMap[cat.id];
            newMap[cat.id] = newMap[target.id];
            newMap[target.id] = temp;
            saveOrderMap(newMap);
        } else if (changed) {
            saveOrderMap(newMap);
        }
    };

    // Sort categories
    const sortedCategories = [...categories].sort((a, b) => (orderMap[a.id] ?? 0) - (orderMap[b.id] ?? 0));
    
    // Process children sorting recursively
    const sortChildrenRecursively = (cats: Category[]): Category[] => {
        return cats.map(c => {
            if (c.children && c.children.length > 0) {
                return {
                    ...c,
                    children: sortChildrenRecursively([...c.children]).sort((a, b) => (orderMap[a.id] ?? 0) - (orderMap[b.id] ?? 0))
                };
            }
            return c;
        });
    };
    
    const finalCategories = sortChildrenRecursively(sortedCategories);
    return (
        <div className="category-tree-root">
            <div 
                className={`category-tree-item root-item ${activeCategory === 'Todos' ? 'active' : ''}`}
                onClick={() => onSelect('Todos')}
            >
                <div className="flex items-center gap-2">
                    <Folder size={18} />
                    <span className="font-bold">Todas las carpetas</span>
                </div>
            </div>

            <div className="category-tree-list">
                {finalCategories.map((cat, idx) => (
                    <CategoryItem 
                        key={cat.id}
                        category={cat}
                        level={0}
                        activeCategory={activeCategory}
                        onSelect={onSelect}
                        onAddSub={onAddSub}
                        onRename={onRename}
                        onDelete={onDelete}
                        onMoveUp={(c) => handleMove(c, 'up')}
                        onMoveDown={(c) => handleMove(c, 'down')}
                        isFirst={idx === 0}
                        isLast={idx === finalCategories.length - 1}
                    />
                ))}
            </div>
        </div>
    );
};

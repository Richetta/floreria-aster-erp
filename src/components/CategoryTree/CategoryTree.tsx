import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, Plus, Edit2, Trash2 } from 'lucide-react';
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
}> = ({ category, level, activeCategory, onSelect, onAddSub, onRename, onDelete }) => {
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
                    {category.children!.map(child => (
                        <CategoryItem 
                            key={child.id}
                            category={child}
                            level={level + 1}
                            activeCategory={activeCategory}
                            onSelect={onSelect}
                            onAddSub={onAddSub}
                            onRename={onRename}
                            onDelete={onDelete}
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
                {categories.map(cat => (
                    <CategoryItem 
                        key={cat.id}
                        category={cat}
                        level={0}
                        activeCategory={activeCategory}
                        onSelect={onSelect}
                        onAddSub={onAddSub}
                        onRename={onRename}
                        onDelete={onDelete}
                    />
                ))}
            </div>
        </div>
    );
};

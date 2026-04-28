import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder } from 'lucide-react';
import type { Category } from '../../store/slices/types';
import './TreeSelect.css';

interface TreeSelectProps {
    categories: Category[];
    value?: string;
    onChange: (category: Category | null) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    allowClear?: boolean;
    clearLabel?: string;
    usePortal?: boolean;
}

interface TreeNodeProps {
    category: Category;
    level: number;
    selectedValue?: string;
    onSelect: (category: Category) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ category, level, selectedValue, onSelect }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = category.children && category.children.length > 0;
    const isSelected = selectedValue === category.id || selectedValue === category.name;

    return (
        <div className="tree-node-container">
            <div 
                className={`tree-node-item ${isSelected ? 'selected' : ''}`}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
                {hasChildren ? (
                    <button 
                        type="button"
                        className="tree-node-toggle"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                    >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                ) : (
                    <span className="tree-node-placeholder" />
                )}
                
                <div 
                    className="tree-node-content"
                    onClick={() => onSelect(category)}
                >
                    <Folder size={14} className={isSelected ? 'text-primary' : 'text-muted'} />
                    <span className="tree-node-name">{category.name}</span>
                </div>
            </div>

            {hasChildren && isExpanded && (
                <div className="tree-node-children">
                    {category.children!.map(child => (
                        <TreeNode 
                            key={child.id}
                            category={child}
                            level={level + 1}
                            selectedValue={selectedValue}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const TreeSelect: React.FC<TreeSelectProps> = ({
    categories,
    value,
    onChange,
    placeholder = 'Seleccionar carpeta...',
    disabled = false,
    className = '',
    allowClear = false,
    clearLabel = 'Todas',
    usePortal = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Find selected category name
    const findCategory = (list: Category[]): Category | null => {
        for (const c of list) {
            if (c.id === value || c.name === value) return c;
            if (c.children) {
                const found = findCategory(c.children);
                if (found) return found;
            }
        }
        return null;
    };

    const selectedCategory = value ? findCategory(categories) : null;
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen && usePortal && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: `${rect.bottom + 4}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                zIndex: 10000
            });
        } else {
            setDropdownStyle({});
        }
    }, [isOpen, usePortal]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleScroll = () => {
            if (isOpen && usePortal) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true); // capture phase
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen, usePortal]);

    const handleSelect = (category: Category) => {
        onChange(category);
        setIsOpen(false);
    };

    return (
        <div className={`tree-select-container ${className}`} ref={dropdownRef}>
            <button
                type="button"
                ref={triggerRef}
                className={`tree-select-trigger ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <div className="tree-select-value">
                    <Folder size={16} className="text-muted" />
                    <span>{selectedCategory ? selectedCategory.name : placeholder}</span>
                </div>
                <ChevronDown size={16} className={`tree-select-arrow ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="tree-select-dropdown" style={dropdownStyle}>
                    {categories.length === 0 ? (
                        <div className="tree-select-empty">No hay carpetas disponibles</div>
                    ) : (
                        <div className="tree-select-list">
                            {allowClear && (
                                <div 
                                    className={`tree-node-item ${!value ? 'selected' : ''}`}
                                    style={{ paddingLeft: '8px' }}
                                    onClick={() => {
                                        onChange(null);
                                        setIsOpen(false);
                                    }}
                                >
                                    <span className="tree-node-placeholder" />
                                    <div className="tree-node-content">
                                        <Folder size={14} className={!value ? 'text-primary' : 'text-muted'} />
                                        <span className="tree-node-name">{clearLabel}</span>
                                    </div>
                                </div>
                            )}
                            {categories.map(cat => (
                                <TreeNode 
                                    key={cat.id}
                                    category={cat}
                                    level={0}
                                    selectedValue={value}
                                    onSelect={handleSelect}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

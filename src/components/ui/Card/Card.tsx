import React from 'react';
import './Card.css';

export interface CardProps {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  shadow?: boolean;
  hover?: boolean;
  className?: string;
  onClick?: () => void;
  as?: 'div' | 'article' | 'section';
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  border = true,
  shadow = false,
  hover = false,
  className = '',
  onClick,
  as = 'div'
}) => {
  const Component = as;
  
  return (
    <Component
      className={`
        card 
        card-${padding} 
        ${border ? 'card-bordered' : ''} 
        ${shadow ? 'card-shadow' : ''}
        ${hover ? 'card-hover' : ''}
        ${onClick ? 'card-clickable' : ''}
        ${className}
      `.trim()}
      onClick={onClick}
    >
      {children}
    </Component>
  );
};

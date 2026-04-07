import React from 'react';

/**
 * Liquid Glass Panel Component
 * Implements the translucent, frosted glass aesthetic from the design document
 */
const GlassPanel = ({ 
  children, 
  className = '', 
  variant = 'default',
  hover = false,
  ...props 
}) => {
  const variants = {
    default: 'glass-panel',
    large: 'glass-panel-lg',
    nav: 'glass-nav',
    resonance: 'card-resonance',
  };

  const baseClass = variants[variant] || variants.default;
  const hoverClass = hover ? 'hover:shadow-glass-lg hover:scale-[1.01]' : '';

  return (
    <div 
      className={`${baseClass} ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassPanel;

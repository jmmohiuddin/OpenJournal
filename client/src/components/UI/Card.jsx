import React from 'react';
import GlassPanel from './GlassPanel';

/**
 * Card Component with Liquid Glass Aesthetic
 */
const Card = ({ 
  children, 
  title,
  subtitle,
  variant = 'default',
  hover = true,
  className = '',
  ...props 
}) => {
  return (
    <GlassPanel 
      variant={variant} 
      hover={hover}
      className={`card-glass ${className}`}
      {...props}
    >
      {title && (
        <div className="mb-4">
          <h3 className="text-xl font-semibold font-system text-gray-800">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-gray-600 font-system mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </GlassPanel>
  );
};

export default Card;

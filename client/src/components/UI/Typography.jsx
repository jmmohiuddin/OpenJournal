import React from 'react';

/**
 * Typography Components
 * Distinguishes between user content (serif) and system text (sans-serif)
 */

export const UserText = ({ children, className = '', ...props }) => (
  <div className={`text-user-content ${className}`} {...props}>
    {children}
  </div>
);

export const SystemText = ({ children, className = '', ...props }) => (
  <div className={`text-system ${className}`} {...props}>
    {children}
  </div>
);

export const Heading1 = ({ children, user = false, className = '', ...props }) => (
  <h1 
    className={`text-4xl font-bold mb-4 ${user ? 'font-journal' : 'font-system'} ${className}`}
    {...props}
  >
    {children}
  </h1>
);

export const Heading2 = ({ children, user = false, className = '', ...props }) => (
  <h2 
    className={`text-3xl font-semibold mb-3 ${user ? 'font-journal' : 'font-system'} ${className}`}
    {...props}
  >
    {children}
  </h2>
);

export const Heading3 = ({ children, user = false, className = '', ...props }) => (
  <h3 
    className={`text-2xl font-semibold mb-3 ${user ? 'font-journal' : 'font-system'} ${className}`}
    {...props}
  >
    {children}
  </h3>
);

export const Heading4 = ({ children, user = false, className = '', ...props }) => (
  <h4 
    className={`text-xl font-semibold mb-2 ${user ? 'font-journal' : 'font-system'} ${className}`}
    {...props}
  >
    {children}
  </h4>
);

export const Body = ({ children, user = false, className = '', ...props }) => (
  <p 
    className={`text-base leading-relaxed ${user ? 'font-journal' : 'font-system'} ${className}`}
    {...props}
  >
    {children}
  </p>
);

export const Caption = ({ children, className = '', ...props }) => (
  <p 
    className={`text-sm text-gray-600 font-system ${className}`}
    {...props}
  >
    {children}
  </p>
);

export const AIPrompt = ({ children, className = '', ...props }) => (
  <div className={`ai-prompt ${className}`} {...props}>
    {children}
  </div>
);

export const SuccessIndicator = ({ children, className = '', ...props }) => (
  <div className={`success-indicator ${className}`} {...props}>
    {children}
  </div>
);

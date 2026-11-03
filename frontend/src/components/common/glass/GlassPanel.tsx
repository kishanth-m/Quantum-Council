import React from 'react';

export type GlassVariant = 'primary' | 'secondary' | 'subtle' | 'floating' | 'elevated' | 'glow' | 'interactive';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  children: React.ReactNode;
  className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  variant = 'primary',
  children,
  className = '',
  ...props
}) => {
  const variantStyles: Record<GlassVariant, string> = {
    primary: 'liquid-glass-primary',
    secondary: 'liquid-glass-secondary',
    subtle: 'liquid-glass-subtle',
    floating: 'liquid-glass-floating',
    elevated: 'liquid-glass-elevated',
    glow: 'liquid-glass-elevated',
    interactive: 'liquid-glass-interactive',
  };

  return (
    <div
      className={`rounded-2xl ${variantStyles[variant] || 'liquid-glass-primary'} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

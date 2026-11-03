import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  variant?: 'primary' | 'secondary' | 'interactive' | 'elevated';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hoverEffect = true,
  variant = 'secondary',
  ...props
}) => {
  const baseClass = {
    primary: 'liquid-glass-primary',
    secondary: 'liquid-glass-secondary',
    interactive: 'liquid-glass-interactive',
    elevated: 'liquid-glass-elevated',
  }[variant];

  return (
    <div
      className={`rounded-2xl p-5 ${baseClass} ${
        hoverEffect
          ? 'hover:border-cyan-400/35 hover:-translate-y-1 hover:shadow-[0_16px_36px_-8px_rgba(0,0,0,0.65),0_0_24px_rgba(var(--theme-glow-rgb),0.18)] transition-all duration-300'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

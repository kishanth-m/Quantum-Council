import React from 'react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'cyan';
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs font-medium',
    md: 'px-4 py-2 text-sm font-medium',
    lg: 'px-6 py-2.5 text-base font-semibold',
  }[size];

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-tealAccent to-electricCyan text-obsidian font-semibold shadow-[0_0_20px_rgba(var(--accent-primary-rgb),0.35)] border border-cyan-300/40 hover:brightness-110 hover:shadow-[0_0_28px_rgba(var(--accent-secondary-rgb),0.45)]',
    cyan:
      'bg-electricCyan/90 hover:bg-electricCyan text-obsidian font-semibold shadow-[0_0_20px_rgba(69,217,245,0.35)] border border-cyan-200/50',
    secondary:
      'glass-interactive text-offWhite hover:text-white border border-white/10 hover:border-cyan-400/30 shadow-sm',
    danger:
      'bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 font-medium border border-rose-600/40 hover:border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.15)]',
    ghost:
      'bg-transparent hover:bg-white/5 text-gray-400 hover:text-offWhite border border-transparent hover:border-white/10',
  }[variant];

  return (
    <button
      disabled={disabled}
      className={`rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

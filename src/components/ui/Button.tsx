import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}: ButtonProps) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2';

  const variants = {
    primary: 'bg-brand-primary text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-sm disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-600 dark:disabled:text-slate-400',
    secondary: 'bg-brand-secondary text-slate-950 hover:bg-amber-500 shadow-sm font-semibold disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-600 dark:disabled:text-slate-400',
    outline: 'border-2 border-slate-300 dark:border-slate-600 bg-transparent text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400',
    ghost: 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:text-slate-400 dark:disabled:text-slate-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-8 py-3 text-lg',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

import * as React from 'react';
import {Slot} from '@radix-ui/react-slot';
import {cva, type VariantProps} from 'class-variance-authority';
import {cn} from '../../lib/utils';

// shadcn/ui pattern. min-h-11 keeps every control at the 44 px touch target the current interface promises.
const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brand-dark text-white hover:bg-ink',
        outline: 'border border-line bg-white text-ink hover:bg-brand-soft',
        ghost: 'text-ink hover:bg-brand-soft',
      },
      size: {default: '', sm: 'px-3'},
    },
    defaultVariants: {variant: 'default', size: 'default'},
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({className, variant, size, asChild = false, type, ...props}, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} type={asChild ? undefined : (type ?? 'button')} className={cn(buttonVariants({variant, size}), className)} {...props} />;
});
Button.displayName = 'Button';

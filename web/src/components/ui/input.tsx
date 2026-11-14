import * as React from 'react';
import {cn} from '../../lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({className, type = 'text', ...props}, ref) => (
  <input ref={ref} type={type} className={cn('min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-muted', className)} {...props} />
));
Input.displayName = 'Input';

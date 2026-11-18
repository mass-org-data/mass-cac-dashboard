import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {cn} from '../../lib/utils';
import {useI18n} from '../../i18n/I18n';

// shadcn/ui dialog: focus is trapped and restored, Escape closes, content is announced as a dialog.
export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {overlayClassName?: string};

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({className, overlayClassName, children, ...props}, ref) => {
  const {t} = useI18n();
  return (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={cn('fixed inset-0 z-40 bg-ink/50', overlayClassName)} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg bg-white p-5 shadow-xl', className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close aria-label={t('common.close')} className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-md hover:bg-brand-soft"><X aria-hidden="true" className="size-5" /></DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = 'DialogContent';

export const DialogTitle = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(({className, ...props}, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('pr-10 text-xl font-bold text-ink', className)} {...props} />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(({className, ...props}, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted', className)} {...props} />
));
DialogDescription.displayName = 'DialogDescription';

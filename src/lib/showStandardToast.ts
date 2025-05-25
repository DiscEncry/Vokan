// Utility for standardized toast/error handling
import { ToastProps } from '@/hooks/use-toast';

export function showStandardToast(toast: (props: ToastProps) => void, type: 'success' | 'error' | 'info', message: string, description?: string) {
  if (type === 'success') {
    toast({ title: message, description, className: 'bg-green-500 text-white' });
  } else if (type === 'error') {
    toast({ title: message, description, variant: 'destructive' });
  } else {
    toast({ title: message, description });
  }
}

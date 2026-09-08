import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const variantConfig = {
    danger: { icon: AlertTriangle, iconColor: 'text-red-600', btnClass: 'btn-danger' },
    warning: { icon: AlertTriangle, iconColor: 'text-amber-600', btnClass: 'btn-warning' },
    info: { icon: AlertTriangle, iconColor: 'text-blue-600', btnClass: 'btn-primary' },
  };
  const cfg = variantConfig[variant];
  const Icon = cfg.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative card p-6 max-w-md w-full shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex gap-3 mb-4">
          <Icon className={`w-6 h-6 ${cfg.iconColor} flex-shrink-0 mt-0.5`} />
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="btn-secondary">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={cfg.btnClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

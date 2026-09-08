import { useState } from 'react';
import { HelpCircle, Info, Lightbulb } from 'lucide-react';

export function HelpTooltip({ text, size = 'sm' }: { text: string; size?: 'xs' | 'sm' | 'md' }) {
  const [show, setShow] = useState(false);
  const dim = size === 'xs' ? 'w-3 h-3' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className="text-slate-400 hover:text-blue-600 transition-colors"
        aria-label="Ayuda"
      >
        <HelpCircle className={dim} />
      </button>
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-slate-900 text-white text-xs leading-relaxed p-3 shadow-xl pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
}

export function InfoNote({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'warning' | 'tip' }) {
  const config = {
    info: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-800', icon: Info, iconColor: 'text-blue-600' },
    warning: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', icon: Info, iconColor: 'text-amber-600' },
    tip: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', icon: Lightbulb, iconColor: 'text-emerald-600' },
  };
  const c = config[variant];
  const Icon = c.icon;
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} px-4 py-3 flex gap-2.5`}>
      <Icon className={`w-4 h-4 ${c.iconColor} flex-shrink-0 mt-0.5`} />
      <p className={`text-xs ${c.text} leading-relaxed`}>{children}</p>
    </div>
  );
}

export function PageHeader({ title, subtitle, helpText, children }: {
  title: string;
  subtitle: string;
  helpText?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {helpText && <HelpTooltip text={helpText} />}
        </div>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

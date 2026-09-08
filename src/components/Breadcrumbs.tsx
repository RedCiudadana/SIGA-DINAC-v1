import { ChevronRight, Home } from 'lucide-react';
import type { ViewKey } from '@/components/AppShell';

interface BreadcrumbItem {
  label: string;
  view?: ViewKey;
  params?: Record<string, string>;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-xs text-slate-500 mb-3 flex-wrap" aria-label="Migas de pan">
      <button
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-1 hover:text-blue-700 transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Inicio</span>
      </button>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3 text-slate-300" />
          {item.view ? (
            <button
              onClick={() => onNavigate(item.view!, item.params)}
              className="hover:text-blue-700 transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-slate-700 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}

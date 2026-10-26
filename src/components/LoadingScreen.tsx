const LOGO_URL = '/dinac-logo.png';

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <div className="flex flex-col items-center">
        {/* Logo container with pulse ring */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-2xl bg-blue-900/20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="relative w-16 h-16 rounded-2xl bg-white shadow-lg border border-slate-200 flex items-center justify-center overflow-hidden">
            <img
              src={LOGO_URL}
              alt="DINAC"
              className="max-w-full max-h-full object-contain p-1.5"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                img.parentElement!.innerHTML = '<span class="text-blue-900 font-bold text-sm">DINAC</span>';
              }}
            />
          </div>
        </div>

        {/* App name */}
        <h1 className="text-lg font-bold text-slate-800 tracking-tight mb-1">SIGA-DINAC</h1>
        <p className="text-xs text-slate-500 mb-5">Sistema de Identificación y Gestión de Alertas</p>

        {/* Spinner */}
        <div className="w-8 h-8 border-[3px] border-blue-900/20 border-t-blue-900 rounded-full animate-spin" />

        <p className="text-xs text-slate-400 mt-4">Cargando sistema...</p>
      </div>
    </div>
  );
}

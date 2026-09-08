import { BookOpen, AlertTriangle, Settings, Shield, Database, FileText } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export function DocsView() {
  return (
    <div className="space-y-5 max-w-4xl">
      <Breadcrumbs items={[{ label: 'Documentación' }]} onNavigate={() => {}} />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Documentación metodológica</h1>
        <p className="text-sm text-slate-500 mt-1">Guía técnica de los indicadores y reglas de análisis del sistema.</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-xs text-amber-800 leading-relaxed">
          Las alertas son señales preventivas generadas mediante reglas de análisis. No constituyen por sí mismas evidencia de irregularidad, responsabilidad administrativa, fraude o corrupción. Requieren revisión técnica y documental.
        </p>
      </div>

      <div className="card p-6 space-y-6">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">Propósito del sistema</h2>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            El SIGA-DINAC es un sistema interno de uso exclusivo para el personal autorizado de la Dirección Nacional de Compras Públicas. Su propósito es cargar, analizar y revisar datos de contratación pública mediante indicadores de riesgo o banderas rojas. Las alertas son señales preventivas que requieren revisión técnica y documental; no constituyen prueba de corrupción, fraude o responsabilidad administrativa.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-semibold text-slate-900">Cinco indicadores de riesgo</h2>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800">1. Único oferente</h3>
              <p className="text-sm text-slate-600 mt-1">
                Se activa cuando un procedimiento competitivo tiene un solo oferente válido. Se excluyen modalidades que no requieren competencia. El umbral por defecto es 1 oferente en modalidades competitivas (LP, LC, LI, EB).
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800">2. Concentración de adjudicaciones</h3>
              <p className="text-sm text-slate-600 mt-1">
                Calcula por institución, proveedor y periodo el porcentaje del número de contratos y del monto adjudicado. Se activa al superar los umbrales configurados (30% de contratos o 40% de monto, mínimo 3 contratos).
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800">3. Uso recurrente de modalidades no competitivas</h3>
              <p className="text-sm text-slate-600 mt-1">
                Calcula la proporción de contrataciones y monto adjudicado mediante modalidades no competitivas o excepcionales. Se activa al superar los porcentajes configurados (20% por número o por monto).
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800">4. Posible fraccionamiento o proximidad al umbral</h3>
              <p className="text-sm text-slate-600 mt-1">
                Identifica grupos de procesos con misma institución o unidad, fechas cercanas, objetos o categorías similares, mismo proveedor, montos próximos al umbral y suma acumulada superior al umbral. El resultado se presenta como "posible patrón que requiere revisión". Nunca afirma automáticamente que se produjo fraccionamiento.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800">5. Plazos atípicamente cortos</h3>
              <p className="text-sm text-slate-600 mt-1">
                Calcula los días entre publicación y recepción de ofertas, entre recepción y adjudicación, y la duración total del proceso. Compara con los parámetros definidos para cada modalidad (7, 3 y 10 días por defecto).
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-5 h-5 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">Priorización</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="badge bg-blue-100 text-blue-800 border-blue-200">Baja</span>
              <span className="text-sm text-slate-600">Una bandera activada</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge bg-amber-100 text-amber-800 border-amber-200">Media</span>
              <span className="text-sm text-slate-600">Dos banderas activadas</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge bg-red-100 text-red-800 border-red-200">Alta</span>
              <span className="text-sm text-slate-600">Tres o más banderas activadas</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">La prioridad representa la necesidad relativa de revisión, no una probabilidad de corrupción.</p>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">Seguridad y privacidad</h2>
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2"><span className="text-blue-600 mt-0.5">•</span>Sistema privado de uso interno. No existe registro público ni acceso anónimo.</li>
            <li className="flex items-start gap-2"><span className="text-blue-600 mt-0.5">•</span>Las acciones quedan registradas en la bitácora institucional.</li>
            <li className="flex items-start gap-2"><span className="text-blue-600 mt-0.5">•</span>Los permisos se validan en el backend, no solo en la interfaz.</li>
            <li className="flex items-start gap-2"><span className="text-blue-600 mt-0.5">•</span>Las alertas no se eliminan físicamente; se usa eliminación lógica.</li>
            <li className="flex items-start gap-2"><span className="text-blue-600 mt-0.5">•</span>Los archivos se almacenan en contenedores privados.</li>
          </ul>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">Flujo de revisión</h2>
          </div>
          <p className="text-sm text-slate-700 mb-2">Estados de una alerta:</p>
          <div className="flex flex-wrap gap-2">
            {['Nueva', 'Asignada', 'En revisión', 'Requiere información', 'Remitida', 'Descartada', 'Cerrada'].map((s, i) => (
              <span key={s} className="badge bg-slate-100 text-slate-700 border-slate-200">
                {i + 1}. {s}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Toda alerta descartada o cerrada requiere justificación, usuario responsable, fecha y comentario final.
          </p>
        </section>
      </div>
    </div>
  );
}

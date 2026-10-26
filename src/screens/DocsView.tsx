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
            <h2 className="text-base font-semibold text-slate-900">Nueve banderas rojas priorizadas</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            BR-02 y BR-05 corresponden a indicadores ya existentes (R018 y R063). Las banderas marcadas como "pendiente de datos" están definidas pero requieren campos adicionales en la plantilla de carga para su cálculo automático.
          </p>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">BR-01 · Manipulación de umbrales de contratación</h3>
                <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Calculable</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Se activa cuando el monto adjudicado supera el umbral de referencia institucional (240 salarios mínimos mensuales) para la modalidad utilizada, especialmente en licitación pública y licitación corta. Indica que el proceso fue tramitado bajo una modalidad que no corresponde al monto real.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">BR-02 · Único oferente</h3>
                <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Calculable</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Se activa cuando un procedimiento competitivo tiene un solo oferente válido. Se excluyen modalidades que no requieren competencia. El umbral por defecto es 1 oferente en modalidades competitivas (LP, LC, LI, EB). Corresponde al indicador R018 ya existente.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">BR-03 · Similitudes comerciales entre oferentes</h3>
                <span className="badge bg-amber-50 text-amber-700 border-amber-200 text-xs">Pendiente de datos</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Detecta oferentes que comparten teléfono, correo, dirección o representantes legales, lo que puede indicar acuerdos colusorios o empresas fachada. Requiere datos individuales de todos los oferentes participantes; la plantilla actual solo contiene datos del proveedor adjudicado.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">BR-04 · Período de decisión extremadamente corto</h3>
                <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Calculable</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Se activa cuando el intervalo entre la recepción de ofertas y la adjudicación es igual o inferior a 3 días en modalidades competitivas (LP, LC). Un período tan breve sugiere que la evaluación fue superficial o que la decisión estaba predeterminada.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">BR-05 · Contrato o documento contractual no publicado</h3>
                <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Calculable</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Se activa cuando existe adjudicación pero el contrato o documento contractual no ha sido publicado, transcurrido el período de gracia configurado. La falta de publicación impide la transparencia y el control social. Corresponde al indicador R063 ya existente.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">BR-06 · El contrato tiene modificaciones</h3>
                <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Calculable</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Se activa cuando un contrato tiene modificaciones monetarias, especialmente aquellas que superan el 30% del monto adjudicado, que se marcan como prioridad alta. Las modificaciones sustanciales pueden indicar subestimación inicial o cambios que alteran la naturaleza del contrato.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">BR-07 · Modificaciones reiteradas de la convocatoria</h3>
                <span className="badge bg-amber-50 text-amber-700 border-amber-200 text-xs">Pendiente de datos</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Detecta convocatorias con múltiples enmiendas que modifican fechas, requisitos o especificaciones técnicas. Las modificaciones reiteradas pueden favorecer a un oferente específico o desalentar la competencia. Requiere datos de enmiendas no disponibles en la plantilla actual.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">BR-08 · Cambios de último momento en las fechas</h3>
                <span className="badge bg-amber-50 text-amber-700 border-amber-200 text-xs">Pendiente de datos</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Se activa cuando las fechas clave (recepción de ofertas, apertura, adjudicación) se modifican con menos de 48 horas de antelación a su vencimiento original. Los cambios tardíos pueden impedir la participación de oferentes no favorecidos. Requiere historial de cambios de fechas.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">BR-09 · Tiempo inusualmente corto entre apertura y firma</h3>
                <span className="badge bg-amber-50 text-amber-700 border-amber-200 text-xs">Pendiente de datos</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Se activa cuando el intervalo entre la apertura de ofertas y la firma del contrato es inferior a 5 días. Un período tan corto puede indicar que la decisión estaba tomada de antemano o que se omitieron controles previos a la firma. Requiere fecha de firma del contrato.
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Indicadores institucionales complementarios</h3>
              <p className="text-sm text-slate-600 mt-1">
                Adicionalmente, el sistema mantiene dos indicadores de nivel institucional: <strong>concentración de adjudicaciones</strong> (R040) y <strong>uso recurrente de modalidades no competitivas</strong> (R013), que evalúan patrones agregados por institución y periodo.
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

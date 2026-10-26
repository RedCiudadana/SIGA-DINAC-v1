import { useState } from 'react';
import {
  GraduationCap, BookOpen, AlertTriangle, Settings, Shield, Database,
  FileText, Upload, ChevronRight, ChevronDown, Lightbulb, Info,
  CheckCircle2, ArrowRight, Layers, Eye, Clock, GitBranch, Users,
  Scale, Building2, CalendarClock, FileEdit, Hourglass,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Breadcrumbs } from '@/components/Breadcrumbs';

type SectionKey = 'platform' | 'concepts' | 'priority';

interface TutorialStep {
  title: string;
  description: string;
}

interface RedFlagConcept {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  shortName: string;
  what: string;
  why: string;
  example: string;
  threshold: string;
}

interface PriorityFlag {
  name: string;
  priority: 'alta' | 'media';
  reason: string;
  combinedWith: string;
}

export function TutorialsView() {
  const { hasPermission } = useAuth();
  const [section, setSection] = useState<SectionKey>('platform');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [openFlag, setOpenFlag] = useState<number | null>(0);
  const [openPriority, setOpenPriority] = useState<number | null>(0);

  const canUpload = hasPermission('upload_data');
  const canConfig = hasPermission('configure_indicators');

  const platformSteps: TutorialStep[] = [
    {
      title: 'Iniciar sesión',
      description: 'Ingrese con su usuario y contraseña. El sistema verifica sus permisos y muestra solo las funciones que tiene autorizadas. Su sesión se cierra automáticamente tras un periodo de inactividad por seguridad.',
    },
    {
      title: 'Cargar datos de contratación',
      description: 'En "Carga de datos" suba un archivo Excel o CSV con los procesos de contratación. El sistema valida los campos obligatorios (institución, proveedor, modalidad, montos, fechas) y le muestra un resumen antes de procesar.',
    },
    {
      title: 'Procesamiento automático',
      description: 'Una vez confirmada la carga, el sistema aplica automáticamente las reglas de análisis o banderas rojas configuradas. Cada proceso se evalúa contra todos los indicadores activos y se generan alertas cuando se cumplen las condiciones.',
    },
    {
      title: 'Revisar alertas',
      description: 'En "Alertas de riesgo" encontrará todas las alertas generadas, ordenadas por prioridad. Puede filtrar por institución, fecha o tipo de bandera. Al hacer clic en una alerta ve el detalle completo: qué banderas se activaron, los datos del proceso y la justificación técnica.',
    },
    {
      title: 'Gestionar el ciclo de revisión',
      description: 'Cada alerta sigue un flujo de estados: Nueva, Asignada, En revisión, Requiere información, Remitida, Descartada o Cerrada. Todo cambio de estado queda registrado con usuario, fecha y comentario, garantizando trazabilidad completa.',
    },
    {
      title: 'Generar reportes',
      description: 'En "Reportes" puede exportar resúmenes de alertas por periodo, institución o tipo de bandera. Los reportes sirven para sustentar análisis técnicos y comunicar hallazgos a las unidades responsables.',
    },
    {
      title: 'Consultar historial de cargas',
      description: 'En "Historial de cargas" ve todos los archivos procesados, su estado (exitoso, con errores, procesando), la cantidad de registros y el usuario que los subió. Esto permite auditar qué datos ingresaron al sistema y cuándo.',
    },
  ];

  const redFlagConcepts: RedFlagConcept[] = [
    {
      icon: Users,
      name: 'Único oferente',
      shortName: 'Único oferente',
      what: 'Se activa cuando un procedimiento competitivo recibe una sola oferta válida. Las modalidades competitivas son licitación pública, licitación corta, compra directa competitiva e invitación a cotizar.',
      why: 'La falta de competencia es uno de los señales más comunes de riesgo en contratación. Cuando solo hay un oferente, no hay presión competitiva sobre precios o calidad, lo que puede indicar acuerdos previos, barreras de entrada artificiales o diseño del proceso a medida.',
      example: 'Una licitación pública para equipo médico recibe solo una oferta. Aunque el monto sea razonable, la ausencia de competencia requiere revisión: ¿Fue publicada adecuadamente? ¿Hubo suficiente tiempo? ¿Los requisitos eran excesivamente restrictivos?',
      threshold: '1 oferente en modalidades competitivas (LP, LC, CD, IC)',
    },
    {
      icon: Layers,
      name: 'Concentración de adjudicaciones',
      shortName: 'Concentración',
      what: 'Calcula qué porcentaje de los contratos y del monto total adjudicado corresponde a un solo proveedor, por institución y periodo. Se activa cuando se superan los umbrales configurados.',
      why: 'Cuando un proveedor concentra una proporción elevada de los contratos de una institución, puede indicar dependencia excesiva, favoritismo o ausencia de competencia real. También puede reflejar relaciones de exclusividad que merecen revisión.',
      example: 'En una institución, el proveedor "Empresa XYZ" recibió 15 de 40 contratos del año (37.5%) y el 55% del monto total. Ambos valores superan los umbrales, generando una alerta que requiere revisión técnica.',
      threshold: '30% de contratos o 40% de monto, mínimo 3 contratos',
    },
    {
      icon: Settings,
      name: 'Uso recurrente de modalidades no competitivas',
      shortName: 'Modalidades no competitivas',
      what: 'Calcula la proporción de contrataciones realizadas mediante modalidades que no requieren competencia (compra directa, contratación por excepción, urgencia). Se activa cuando el uso supera los porcentajes configurados.',
      why: 'Las modalidades no competitivas son legítimas para casos específicos, pero su uso frecuente puede indicar elusión de procesos competitivos. Un patrón sostenido sugiere que la institución prefiere evitar competencia, lo que aumenta el riesgo de precios inflados o favoritismo.',
      example: 'Una institución realizó 8 de 20 contrataciones (40%) por compra directa durante el trimestre. Aunque cada compra individual puede justificarse, el patrón general supera el umbral del 20% y requiere revisión documental.',
      threshold: '20% por número de contratos o por monto adjudicado',
    },
    {
      icon: GitBranch,
      name: 'Posible fraccionamiento o proximidad al umbral',
      shortName: 'Fraccionamiento',
      what: 'Identifica grupos de procesos con características similares (misma institución, fechas cercanas, objetos similares, mismo proveedor) cuyos montos individuales están cerca del umbral de competencia pero cuya suma lo supera. El resultado se presenta como "posible patrón que requiere revisión".',
      why: 'El fraccionamiento es dividir una contratación grande en varias pequeñas para evitar el umbral que exigiría competencia. Es una de las prácticas más difíciles de detectar individualmente, por lo que el sistema busca patrones en conjunto.',
      example: 'En dos meses se adjudican 5 contratos de "material de oficina" a un mismo proveedor, cada uno por $9,500 (umbral: $10,000). La suma es $47,500. Individualmente cada contrato es válido, pero el patrón sugiere posible fraccionamiento que requiere revisión.',
      threshold: 'Suma acumulada superior al umbral, montos individuales próximos al umbral',
    },
    {
      icon: Clock,
      name: 'Plazos atípicamente cortos',
      shortName: 'Plazos cortos',
      what: 'Compara los tiempos del proceso (días entre publicación y recepción de ofertas, entre recepción y adjudicación, duración total) con los parámetros definidos para cada modalidad. Se activa cuando los plazos son inferiores a los mínimos esperados.',
      why: 'Plazos demasiado cortos limitan la participación de oferentes, impiden preparación adecuada de propuestas y pueden ser deliberadamente reducidos para favorecer a un proveedor específico. La celeridad inusual es una señal clásica de riesgo.',
      example: 'Una licitación pública publica el pliego el lunes y fija recepción de ofertas para el jueves (3 días). El parámetro para LP es 7 días mínimos. El plazo reducido puede haber impedido que otros oferentes participen.',
      threshold: '7 días (publicación a ofertas), 3 días (ofertas a adjudicación), 10 días (total)',
    },
    {
      icon: Scale,
      name: 'Manipulación de umbrales de contratación',
      shortName: 'Manipulación de umbrales',
      what: 'Se activa cuando el monto adjudicado supera el umbral de referencia institucional (240 salarios mínimos mensuales) para la modalidad utilizada, especialmente en licitación pública y licitación corta. Indica que el proceso fue tramitado bajo una modalidad que no corresponde al monto real.',
      why: 'Elegir una modalidad con umbrales más bajos que el monto real puede ser una forma de eludir los controles y la competencia que exige una modalidad superior. La manipulación de umbrales es una de las prácticas más comunes para evadir transparencia.',
      example: 'Un proceso de licitación corta adjudica un contrato por el equivalente a 350 salarios mínimos. El umbral de referencia para licitación corta es 240 salarios mínimos. El monto supera el umbral, sugiriendo que debería haberse tramitado como licitación pública.',
      threshold: '240 salarios mínimos mensuales (umbral de referencia)',
    },
    {
      icon: Building2,
      name: 'Similitudes comerciales entre oferentes',
      shortName: 'Similitudes entre oferentes',
      what: 'Detecta oferentes que comparten teléfono, correo, dirección o representantes legales, lo que puede indicar acuerdos colusorios o empresas fachada. Actualmente pendiente de datos: requiere información individual de todos los oferentes participantes.',
      why: 'Cuando varios oferentes aparentemente independientes resultan tener los mismos datos de contacto o dirección, la competencia entre ellos puede ser ficticia. Esto es una señal clásica de colusión o de empresas creadas solo para aparentar pluralidad.',
      example: 'En una licitación participan tres empresas, pero dos comparten el mismo número de teléfono y la misma dirección fiscal. Aunque presentaron ofertas independientes, la similitud sugiere que podrían pertenecer al mismo grupo económico.',
      threshold: 'Coincidencia en teléfono, correo o dirección entre oferentes (pendiente de datos)',
    },
    {
      icon: Hourglass,
      name: 'Período de decisión extremadamente corto',
      shortName: 'Decisión corta',
      what: 'Se activa cuando el intervalo entre la recepción de ofertas y la adjudicación es igual o inferior a 3 días en modalidades competitivas (LP, LC). Un período tan breve sugiere que la evaluación fue superficial o que la decisión estaba predeterminada.',
      why: 'La evaluación técnica y económica de ofertas requiere tiempo razonable para revisar documentación, verificar compliance y comparar propuestas. Un plazo extremadamente corto indica que la decisión pudo tomarse sin análisis real, favoreciendo a un oferente preseleccionado.',
      example: 'Una licitación pública recibe ofertas el lunes y adjudica el miércoles (2 días después). Con 5 oferentes y un monto significativo, dos días no son suficientes para una evaluación adecuada. La celeridad sugiere decisión predeterminada.',
      threshold: '3 días o menos entre recepción de ofertas y adjudicación (LP, LC)',
    },
    {
      icon: FileEdit,
      name: 'El contrato tiene modificaciones',
      shortName: 'Modificaciones contractuales',
      what: 'Se activa cuando un contrato tiene modificaciones monetarias, especialmente aquellas que superan el 30% del monto adjudicado, que se marcan como prioridad alta. Las modificaciones sustanciales pueden indicar subestimación inicial o cambios que alteran la naturaleza del contrato.',
      why: 'Las modificaciones contractuales son legítimas cuando responden a necesidades reales, pero cuando son frecuentes o de gran magnitud pueden indicar que el contrato fue adjudicado con un monto artificialmente bajo para ganar la licitación, para luego incrementarlo mediante modificaciones.',
      example: 'Un contrato adjudicado por $100,000 recibe una modificación de $45,000 (45% del monto original). La modificación supera el umbral del 30% y se marca como prioridad alta. Puede indicar que el monto inicial fue subestimado para ganar la licitación.',
      threshold: 'Cualquier modificación monetaria; prioridad alta si supera el 30% del adjudicado',
    },
    {
      icon: GitBranch,
      name: 'Modificaciones reiteradas de la convocatoria',
      shortName: 'Enmiendas reiteradas',
      what: 'Detecta convocatorias con múltiples enmiendas que modifican fechas, requisitos o especificaciones técnicas. Las modificaciones reiteradas pueden favorecer a un oferente específico o desalentar la competencia. Actualmente pendiente de datos.',
      why: 'Cuando una convocatoria se modifica repetidamente, especialmente cerca de la fecha límite, los oferentes pueden confundirse o desistir. Las enmiendas también pueden ajustar requisitos para encajar con un oferente preseleccionado, excluyendo al resto.',
      example: 'Una licitación pública recibe 4 enmiendas en los últimos 10 días antes del vencimiento. Dos modifican especificaciones técnicas, una cambia la fecha límite y otra ajusta los requisitos de experiencia. Las enmiendas reiteradas podrían estar dirigidas a encajar con un oferente específico.',
      threshold: 'Múltiples enmiendas a la convocatoria (pendiente de datos)',
    },
    {
      icon: CalendarClock,
      name: 'Cambios de último momento en las fechas',
      shortName: 'Cambios tardíos',
      what: 'Se activa cuando las fechas clave (recepción de ofertas, apertura, adjudicación) se modifican con menos de 48 horas de antelación a su vencimiento original. Los cambios tardíos pueden impedir la participación de oferentes no favorecidos. Actualmente pendiente de datos.',
      why: 'Cambiar fechas críticas con poca antelación puede impedir que oferentes legítimos participen o ajusten sus propuestas. Si el cambio favorece a un oferente específico que ya tenía preparada su oferta, puede indicar coordinación previa y manipulación del calendario.',
      example: 'La fecha de recepción de ofertas se adelanta 2 días, anunciándose solo 24 horas antes del nuevo vencimiento. Oferentes que estaban preparando propuestas para la fecha original no tienen tiempo de ajustar sus ofertas, benefiting a quienes ya las tenían listas.',
      threshold: 'Cambio de fecha con menos de 48 horas de antelación (pendiente de datos)',
    },
    {
      icon: Hourglass,
      name: 'Tiempo inusualmente corto entre apertura y firma',
      shortName: 'Apertura a firma corta',
      what: 'Se activa cuando el intervalo entre la apertura de ofertas y la firma del contrato es inferior a 5 días. Un período tan corto puede indicar que la decisión estaba tomada de antemano o que se omitieron controles previos a la firma. Actualmente pendiente de datos.',
      why: 'Entre la apertura de ofertas y la firma del contrato deberían mediar verificaciones, aprobaciones y posibles recursos. Un plazo extremadamente corto sugiere que estos pasos se omitieron o que la decisión estaba predeterminada, especialmente si no hubo tiempo para revisar la adjudicación.',
      example: 'Un proceso se adjudica el lunes y el contrato se firma el miércoles (2 días después). Con un monto significativo, dos días no son suficientes para completar las verificaciones administrativas habituales ni para recibir posibles impugnaciones.',
      threshold: 'Menos de 5 días entre apertura de ofertas y firma del contrato (pendiente de datos)',
    },
  ];

  const priorityFlags: PriorityFlag[] = [
    {
      name: 'Fraccionamiento + Único oferente',
      priority: 'alta',
      reason: 'La combinación de posibles patrones de fraccionamiento con procesos de único oferente es la señal más fuerte. Sugiere que los procesos fueron divididos para evitar competencia y que, incluso en los procesos resultantes, no hubo participación múltiple.',
      combinedWith: 'Esta combinación frecuentemente aparece en esquemas donde un proveedor es preseleccionado y el proceso se fragmenta para mantener cada contratación bajo el umbral competitivo.',
    },
    {
      name: 'Concentración + Modalidades no competitivas',
      priority: 'alta',
      reason: 'Cuando un proveedor concentra adjudicaciones y además la institución usa mayoritariamente modalidades no competitivas, el riesgo es elevado. La falta de competencia se reproduce en multiples frentes: pocas empresas, poca competencia.',
      combinedWith: 'Revisar si los contratos no competitivos al mismo proveedor tienen justificaciones similares o plantillas repetidas, lo que podría indicar automatización de un esquema.',
    },
    {
      name: 'Plazos cortos + Único oferente',
      priority: 'alta',
      reason: 'Plazos reducidos que resultan en un solo oferente sugieren que el tiempo fue deliberadamente insuficiente para que otros participaran. Es una de las combinaciones más concluyentes para priorizar revisión documental.',
      combinedWith: 'Examinar si la publicación se hizo en canales de baja visibilidad o en fechas inhábiles, lo que reduciría aún más la participación.',
    },
    {
      name: 'Concentración + Fraccionamiento',
      priority: 'media',
      reason: 'Un proveedor que concentra contratos y cuyos procesos muestran patrón de fraccionamiento requiere revisión, aunque individualmente cada bandera podría tener explicación legítima. La combinación refuerza la necesidad de análisis documental.',
      combinedWith: 'Comparar los objetos contractuales: si son similares pero con descripciones ligeramente diferentes, puede ser un intento de dispersar la apariencia de un solo contrato grande.',
    },
    {
      name: 'Modalidades no competitivas + Plazos cortos',
      priority: 'media',
      reason: 'El uso frecuente de modalidades sin competencia combinado con plazos atípicamente cortos en los pocos procesos competitivos sugiere una cultura institucional de elusión de competencia que merece atención.',
      combinedWith: 'Revisar si las justificaciones de excepción son genéricas o se repiten entre procesos, lo que podría indicar uso rutinario en lugar de excepcional.',
    },
    {
      name: 'Manipulación de umbrales + Único oferente',
      priority: 'alta',
      reason: 'Cuando un proceso se tramita bajo una modalidad con umbrales inferiores al monto real y además recibe una sola oferta, la señal es muy fuerte. Sugiere que la modalidad fue elegida para evadir competencia y que el resultado (único oferente) era el objetivo desde el inicio.',
      combinedWith: 'Verificar si el monto adjudicado supera el umbral de referencia (240 salarios mínimos) para la modalidad utilizada. Si además el plazo fue corto, se acumulan tres banderas que refuerzan la sospecha de manipulación deliberada.',
    },
    {
      name: 'Modificaciones contractuales + Manipulación de umbrales',
      priority: 'alta',
      reason: 'Un contrato adjudicado bajo una modalidad con umbrales manipulados que luego recibe modificaciones sustanciales (mayores al 30%) puede indicar que el monto inicial fue artificialmente bajo para encajar en la modalidad y luego se incrementó mediante modificaciones, eludiendo los controles de la modalidad superior.',
      combinedWith: 'Comparar el monto adjudicado original con el monto final tras modificaciones. Si el monto final supera el umbral de la modalidad superior, la manipulación de umbrales seguida de modificaciones puede haber sido una estrategia deliberada.',
    },
    {
      name: 'Período de decisión corto + Único oferente',
      priority: 'alta',
      reason: 'Cuando un proceso competitivo recibe una sola oferta y además la adjudicación se produce en 3 días o menos, la combinación es especialmente significativa. La falta de competencia y la celeridad extrema sugieren que el proceso fue diseñado para favorecer a un oferente específico.',
      combinedWith: 'Examinar si el plazo de recepción de ofertas también fue corto (bandera R003). Si tres banderas de plazo y competencia coinciden, el proceso debe ser revisado con prioridad máxima.',
    },
  ];

  const faqs = [
    {
      q: '¿Qué es una bandera roja?',
      a: 'Una bandera roja es una regla de análisis que evalúa automáticamente los datos de contratación y genera una alerta cuando se cumplen ciertas condiciones. No es una acusación ni una prueba de irregularidad; es una señal preventiva que indica que un proceso requiere revisión técnica y documental.',
    },
    {
      q: '¿Las alertas significan que hubo corrupción?',
      a: 'No. Las alertas son señales preventivas. Muchas tienen explicaciones legítimas: una emergencia real puede justificar una compra directa, un proceso especializado puede tener pocos oferentes. El valor del sistema está en identificar dónde conviene dirigir el esfuerzo de revisión, no en presumir culpabilidad.',
    },
    {
      q: '¿Cómo se calcula la prioridad de una alerta?',
      a: 'La prioridad se asigna según cuántas banderas rojas se activan en un mismo proceso: una bandera es prioridad baja, dos son media, tres o más son alta. La prioridad representa la necesidad relativa de revisión, no una probabilidad de corrupción.',
    },
    {
      q: '¿Quién puede ver y gestionar las alertas?',
      a: 'Solo personal autorizado con los permisos correspondientes. El sistema valida los permisos tanto en la interfaz como en el backend. Las acciones sobre alertas (asignar, cambiar estado, descartar) quedan registradas en la bitácora institucional.',
    },
    {
      q: '¿Qué pasa cuando se descarta o cierra una alerta?',
      a: 'Se requiere justificación: usuario responsable, fecha y comentario final. La alerta no se elimina físicamente; se usa eliminación lógica para conservar la trazabilidad. Todo queda en la bitácora.',
    },
    {
      q: '¿Puedo ajustar los umbrales de las banderas rojas?',
      a: canConfig
        ? 'Sí. En el Panel de configuración, sección Indicadores, puede ajustar los umbrales de cada bandera roja. Cada cambio crea una nueva versión del indicador y queda registrado en el historial.'
        : 'Solo los administradores con permiso de configuración pueden ajustar los umbrales. Si necesita proponer un cambio, comuníquese con el administrador del sistema.',
    },
    {
      q: '¿Qué datos necesita el sistema para funcionar?',
      a: 'Los archivos de carga deben incluir como mínimo: institución, unidad organizativa, número de proceso, modalidad de contratación, proveedor adjudicado, monto adjudicado, fechas (publicación, recepción, adjudicación) y objeto del contrato. La calidad del análisis depende directamente de la calidad de los datos cargados.',
    },
  ];

  const sections: { key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
    { key: 'platform', label: 'Cómo funciona la plataforma', icon: GraduationCap, desc: 'Recorrido paso a paso por las funciones principales' },
    { key: 'concepts', label: 'Conceptos clave de banderas rojas', icon: AlertTriangle, desc: 'Qué son, cómo se calculan y qué significan' },
    { key: 'priority', label: 'Banderas rojas priorizadas', icon: Shield, desc: 'Combinaciones de mayor riesgo que requieren atención' },
  ];

  return (
    <div className="space-y-5 max-w-4xl">
      <Breadcrumbs items={[{ label: 'Tutoriales' }]} onNavigate={() => {}} />
      <div className="flex items-center gap-2">
        <GraduationCap className="w-6 h-6 text-blue-700" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tutoriales</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Aprenda a usar la plataforma y comprenda los conceptos clave del análisis de riesgo en contratación pública.
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
        <div className="flex gap-2.5">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Las alertas generadas por este sistema son señales preventivas. No constituyen por sí mismas evidencia de irregularidad, responsabilidad administrativa, fraude o corrupción. Requieren revisión técnica y documental.
          </p>
        </div>
      </div>

      {/* Section selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {sections.map((s) => {
          const Icon = s.icon;
          const isActive = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`card p-4 text-left transition-all ${
                isActive ? 'ring-2 ring-blue-900 bg-blue-50/50' : 'hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-900' : 'text-slate-500'}`} />
                <h3 className={`text-sm font-semibold ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                  {s.label}
                </h3>
              </div>
              <p className="text-xs text-slate-500">{s.desc}</p>
            </button>
          );
        })}
      </div>

      {/* ===== Section: Platform ===== */}
      {section === 'platform' && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-blue-700" />
              <h2 className="text-base font-semibold text-slate-900">Recorrido por la plataforma</h2>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              SIGA-DINAC es el Sistema de Identificación y Gestión de Alertas. Su propósito es cargar datos de contratación pública, analizarlos automáticamente mediante banderas rojas y generar alertas para revisión técnica. A continuación, el flujo completo de uso:
            </p>

            <div className="space-y-3">
              {platformSteps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      i === 0 ? 'bg-blue-900 text-white' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {i + 1}
                    </div>
                    {i < platformSteps.length - 1 && (
                      <div className="w-px h-full bg-slate-200 mt-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick access cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FeatureCard
              icon={Upload}
              title="Carga de datos"
              description="Suba archivos Excel o CSV con procesos de contratación para su análisis."
              visible={canUpload}
            />
            <FeatureCard
              icon={AlertTriangle}
              title="Alertas de riesgo"
              description="Revise y gestione las alertas generadas por las banderas rojas."
              visible={hasPermission('view_alerts')}
            />
            <FeatureCard
              icon={FileText}
              title="Reportes"
              description="Exporte resúmenes de alertas por periodo, institución o tipo de bandera."
              visible={hasPermission('view_reports')}
            />
            <FeatureCard
              icon={Settings}
              title="Configuración de indicadores"
              description="Ajuste umbrales y parámetros de las banderas rojas."
              visible={canConfig}
            />
          </div>

          {/* Tips */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-900">Consejos para un mejor uso</h3>
            </div>
            <ul className="space-y-2.5 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Verifique que los datos cargados sean completos y estén en el formato correcto. La calidad del análisis depende de la calidad de los datos.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Priorice las alertas de prioridad alta (3 o más banderas) para optimizar el tiempo de revisión.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Documente siempre el motivo de descarte o cierre de una alerta. La trazabilidad es esencial.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Revise el historial de cargas para confirmar que todos los archivos se procesaron correctamente.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ===== Section: Concepts ===== */}
      {section === 'concepts' && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-semibold text-slate-900">¿Qué son las banderas rojas?</h2>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              Las banderas rojas son reglas de análisis que evalúan automáticamente los datos de contratación pública. Cada regla busca un patrón específico que, según la experiencia internacional y la doctrina de contratación pública, está asociado a riesgo. Cuando los datos cumplen las condiciones de la regla, el sistema genera una alerta.
            </p>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">
              El sistema cuenta con nueve banderas rojas priorizadas. Cada una tiene su propia metodología, fórmula y umbrales configurables. Algunas están plenamente calculables con los datos actuales; otras están definidas pero requieren campos adicionales en la plantilla de carga para su cálculo automático. A continuación se explica cada una en detalle:
            </p>
          </div>

          {/* Red flag accordion */}
          <div className="space-y-2">
            {redFlagConcepts.map((flag, i) => {
              const Icon = flag.icon;
              const isOpen = openFlag === i;
              return (
                <div key={i} className="card overflow-hidden">
                  <button
                    onClick={() => setOpenFlag(isOpen ? null : i)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900">{i + 1}. {flag.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{flag.what}</p>
                    </div>
                    {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Qué detecta</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{flag.what}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Por qué es relevante</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{flag.why}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ejemplo</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{flag.example}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">Umbral por defecto:</span>
                        <span className="badge bg-blue-50 text-blue-700 border-blue-200 text-xs">{flag.threshold}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Priority explanation */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-5 h-5 text-blue-700" />
              <h3 className="text-sm font-semibold text-slate-900">Cómo se asigna la prioridad</h3>
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
            <p className="text-xs text-slate-500 mt-3">
              La prioridad representa la necesidad relativa de revisión, no una probabilidad de corrupción. Un proceso con tres banderas no es tres veces más corrupto; simplemente acumula más señales que merecen atención.
            </p>
          </div>

          {/* FAQ */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Preguntas frecuentes</h3>
            <div className="space-y-2">
              {faqs.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={i} className="rounded-lg border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-slate-800">{faq.q}</span>
                      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3">
                        <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== Section: Priority ===== */}
      {section === 'priority' && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-blue-700" />
              <h2 className="text-base font-semibold text-slate-900">Combinaciones de banderas que requieren atención prioritaria</h2>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              Cuando varias banderas rojas se activan en el mismo proceso o en procesos relacionados, la señal de riesgo se refuerza. No todas las combinaciones tienen el mismo peso: algunas son especialmente significativas porque los patrones se confirman mutuamente. A continuación, las combinaciones que el equipo de revisión debería priorizar:
            </p>
          </div>

          {/* Priority flags */}
          <div className="space-y-2">
            {priorityFlags.map((flag, i) => {
              const isOpen = openPriority === i;
              const isHigh = flag.priority === 'alta';
              return (
                <div key={i} className="card overflow-hidden">
                  <button
                    onClick={() => setOpenPriority(isOpen ? null : i)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isHigh ? 'bg-red-100' : 'bg-amber-100'
                    }`}>
                      <AlertTriangle className={`w-5 h-5 ${isHigh ? 'text-red-700' : 'text-amber-700'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{flag.name}</h3>
                        <span className={`badge flex-shrink-0 text-xs ${
                          isHigh ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          Prioridad {flag.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{flag.reason}</p>
                    </div>
                    {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Por qué priorizar</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{flag.reason}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Qué buscar en la revisión</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{flag.combinedWith}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary table */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-blue-700" />
              <h3 className="text-sm font-semibold text-slate-900">Resumen de priorización</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Combinación</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridad</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nivel de atención</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityFlags.map((flag, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 px-3 text-slate-700">{flag.name}</td>
                      <td className="py-2.5 px-3">
                        <span className={`badge text-xs ${
                          flag.priority === 'alta'
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          {flag.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs">
                        {flag.priority === 'alta' ? 'Revisar primero' : 'Revisar después de las altas'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Esta priorización es una guía orientativa. El juicio técnico del equipo de revisión debe considerar también el contexto institucional, el monto involucrado y la recurrencia de los patrones.
            </p>
          </div>

          {/* Related reading */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
            <div className="flex items-start gap-2.5">
              <ArrowRight className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed">
                Para la explicación técnica completa de cada bandera roja, consulte la <strong>Documentación metodológica</strong> disponible en la sección de ayuda.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureCard({
  icon: Icon, title, description, visible,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-5 h-5 text-blue-700" />
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

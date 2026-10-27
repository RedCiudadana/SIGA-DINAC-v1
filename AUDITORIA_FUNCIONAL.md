# Informe de Auditoría Funcional y de Integridad de Datos

## A. Resumen ejecutivo

Se realizó una auditoría funcional del sistema SIGA-DINAC cubriendo tres áreas: (1) validación de los cálculos de indicadores y reglas de banderas rojas, (2) verificación de que las gráficas y métricas del tablero se calculan desde datos reales, y (3) búsqueda de datos simulados, hardcoded o mock en el código frontend.

### Hallazgos encontrados y corregidos

1. **Cobertura de R018 sobrecontaba procesos (corregido)** — La métrica de cobertura del indicador R018 (oferta única) sumaba `withValidBids + procs.filter(number_of_bidders !== null).length`, lo que duplicaba el conteo de procesos que tenían ambos campos. Se reemplazó por una unión correcta: procesos que tengan al menos uno de los dos campos (`number_of_valid_bids` o `number_of_bidders`).

2. **Cobertura de R040 usaba métrica equivocada (corregido)** — La cobertura de R040 (concentración comprador-proveedor) reportaba `withInstCode` (procesos con código de institución) en lugar de `withSupplierId` (procesos con código de proveedor). R040 requiere identificación de proveedor para agrupar, por lo que la métrica correcta es la disponibilidad de `supplier_id_code`.

3. **R106 generaba alertas para TODA modificación contractual (corregido)** — El indicador R106 (modificaciones contractuales) creaba una alerta para cualquier proceso con `amendment_amount > 0`, independientemente del porcentaje. Esto incluía modificaciones de $1 sobre contratos de $100,000 (0.001%), generando ruido innecesario. Se añadió un filtro `if (pctModificacion < umbralPct) continue;` para que solo se generen alertas cuando la modificación supera el umbral configurado (por defecto 30%).

4. **Generación de process_id no determinística (corregido)** — Cuando un archivo cargado no incluía `process_id`, el sistema generaba uno con `Math.random()`: `PRC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`. Esto producía identificadores diferentes cada vez que se cargaba el mismo archivo, creando procesos duplicados y rompiendo la idempotencia. Se reemplazó por un identificador determinístico basado en el ID de la carga y el índice de la fila: `PRC-${uploadData.id.slice(0, 8)}-${rowIndex + 1}`.

### Aspectos verificados sin hallazgos

**Tablero principal (DashboardView):** Las 6 tarjetas KPI y los 5 gráficos se calculan exclusivamente desde consultas a la base de datos (`procurement_processes`, `alerts`). No se encontraron datos hardcoded ni métricas simuladas. Los filtros globales recalculan correctamente todos los gráficos. Las constantes (`METHOD_LABELS`, `INDICATOR_ELIGIBLE_METHODS`, `STATUS_BAR_COLORS`) son mapas de configuración visual, no datos fabricados.

**IndicadoresView:** La gestión de indicadores (crear, editar, activar/desactivar, versionar parámetros, restaurar versiones) opera completamente contra la base de datos. No hay valores simulados.

**Reglas de banderas rojas (process-rules):** Los 7 indicadores (R018, R003, R063, R013, R040, R101, R104, R106) leen sus parámetros desde `indicator_parameters` en la base de datos. Los umbrales no están hardcoded en el código. Cada alerta registra el cálculo, el umbral aplicado y los datos utilizados para explicabilidad.

**Otros screens:** AlertsView, AlertDetailView, ProcessDetailView, ReportsView, CatalogsView, UsersView, RolesView, AuditView, SecurityView, PublicBoardsView, ProfileView, SystemResetView — todos consultan la base de datos. No se encontraron arreglos de datos mock ni valores simulados.

### Observaciones no críticas

1. **Bandera `is_demo` en datos de demostración** — La base de datos contiene registros con `is_demo = true` (datos seed de demostración). Las pantallas muestran una insignia "Demo" para estos registros pero no los filtran. Si en producción los datos demostrativos deben ocultarse, se recomienda añadir un filtro `is_demo = false` en las consultas de DashboardView, AlertsView y ReportsView.

2. **R101 y R104 dependen de parámetros que pueden no estar configurados** — R101 (manipulación de umbrales) requiere `salario_minimo_mensual` configurado; si es 0, el indicador no se evalúa. R104 (período de decisión corto) tiene umbral demostrativo de 3 días. Ambos incluyen notas de calidad (`quality_note`) indicando que son cálculos parciales.

3. **Agregación de montos sin conversión de moneda** — R040 suma `awarded_amount` sin normalizar moneda. Si los datos incluyen procesos en diferentes monedas, la concentración por monto puede ser distorsionada. El campo `currency` existe en el schema pero no se usa en el cálculo.

## B. Verificación

- **Build de producción**: compila sin errores (`vite build` exitoso).
- **Edge Function process-rules**: desplegada con las correcciones de cobertura R018, R040 y filtro de R106.
- **TypeScript**: compila sin errores de tipos.

## C. Archivos modificados

| Archivo | Cambio |
|---|---|
| `supabase/functions/process-rules/index.ts` | Corregida cobertura R018 (unión en lugar de suma); corregida cobertura R040 (con supplier_id en lugar de institution_code); R106 solo dispara cuando supera el umbral configurado |
| `src/screens/UploadView.tsx` | Reemplazado `Math.random()` por identificador determinístico basado en upload_id + índice de fila |

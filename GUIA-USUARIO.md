# Guía de usuario de SIGA-DINAC

## Sistema de Identificación y Gestión de Alertas

Esta guía explica, paso a paso y en lenguaje sencillo, todas las funcionalidades del sistema SIGA-DINAC. Está pensada para funcionarios públicos que utilizan la herramienta en su trabajo diario, sin necesidad de conocimientos técnicos.

---

## Tabla de contenidos

1. [Primeros pasos](#primeros-pasos)
2. [Tablero principal](#tablero-principal)
3. [Carga de datos](#carga-de-datos)
4. [Historial de cargas](#historial-de-cargas)
5. [Alertas de riesgo](#alertas-de-riesgo)
6. [Detalle de una alerta](#detalle-de-una-alerta)
7. [Detalle de un proceso](#detalle-de-un-proceso)
8. [Reportes](#reportes)
9. [Tableros públicos](#tableros-públicos)
10. [Panel de configuración](#panel-de-configuración)
11. [Documentación y tutoriales](#documentación-y-tutoriales)
12. [Mi perfil](#mi-perfil)
13. [Preguntas frecuentes](#preguntas-frecuentes)

---

## Primeros pasos

### Cómo iniciar sesión

1. Abra el sistema en su navegador. Verá la pantalla de acceso.
2. Escriba su **correo institucional** y su **contraseña**.
3. Haga clic en **Ingresar**.

Si está usando el sistema de demostración, puede hacer clic en el botón **Autocompletar** para llenar automáticamente las credenciales de prueba.

### Si olvidó su contraseña

1. En la pantalla de acceso, haga clic en **¿Olvidó su contraseña?**.
2. Escriba su correo institucional.
3. El sistema enviará un enlace de recuperación a su correo.
4. Siga las instrucciones del correo para crear una nueva contraseña.

### Bloqueo por intentos fallidos

Si ingresa una contraseña incorrecta varias veces seguidas, su cuenta se bloqueará temporalmente por seguridad. Verá un contador regresivo en la pantalla. Espere a que termine el tiempo para intentar nuevamente o contacte al administrador del sistema.

### Cierre de sesión por inactividad

Si deja de usar el sistema por un tiempo prolongado, aparecerá un aviso amarillo indicando que su sesión se cerrará pronto. Realice cualquier acción (hacer clic, escribir) para mantenerla activa. Si no responde, la sesión se cerrará automáticamente y deberá iniciar sesión nuevamente.

---

## Tablero principal

El tablero principal es la primera pantalla que ve al ingresar. Es una vista general con las métricas más importantes del análisis de contratación.

### Qué ve en esta pantalla

- **Saludo personalizado** con su nombre y el total de procesos analizados.
- **Guía de uso** colapsable que explica cómo funciona el sistema en 6 pasos.
- **Filtros globales** en la parte superior: Periodo, Modalidad e Institución.
- **6 tarjetas con métricas clave**:
  - Procesos analizados
  - Monto analizado
  - Procesos con alertas
  - Porcentaje con alertas
  - Alertas de alta prioridad pendientes
  - Alertas revisadas
- **5 gráficos interactivos**:
  - Evolución mensual de procesos y alertas
  - Frecuencia por indicador (bandera roja)
  - Instituciones con mayor incidencia
  - Alertas por modalidad de contratación
  - Estado de revisión de las alertas
- **Lista de alertas recientes** (las últimas 8).
- **Tabla de procesos de contratación** con buscador y filtros.
- **Footer institucional** con los logos de cooperación al final de la página.

### Qué puede hacer

- **Aplicar filtros**: seleccione periodo, modalidad o institución para ver solo los datos relevantes. Haga clic en **Limpiar** para quitar todos los filtros.
- **Ordenar la tabla**: haga clic en el encabezado de una columna (Código, Institución, Montos) para ordenar ascendente o descendente.
- **Ver una alerta**: haga clic en una alerta de la lista de alertas recientes para abrir su detalle.
- **Ver un proceso**: haga clic en cualquier fila de la tabla de procesos para ver su detalle completo.
- **Exportar datos**: si tiene permiso, haga clic en **Exportar** para descargar los datos del tablero en CSV.
- **Expandir la guía**: haga clic en **¿Cómo funciona esta herramienta?** para ver una explicación paso a paso del sistema.

---

## Carga de datos

La carga de datos le permite subir archivos con procesos de contratación para que el sistema los analice automáticamente. Es un asistente de 7 pasos que lo guía en todo el proceso.

### Paso 1. Datos de la carga

Antes de subir el archivo, proporcione información sobre la carga:

1. Escriba un **Nombre** descriptivo (por ejemplo, "Carga segundo trimestre 2026").
2. Seleccione el **Periodo** (por ejemplo, "2026-Q2").
3. Escriba la **Fuente** de los datos (por ejemplo, "Sistema de información de contrataciones").
4. Indique la **Institución o conjunto** al que corresponden los datos.
5. Escriba una **Descripción** opcional.
6. Seleccione el **Nivel de confidencialidad**: Uso interno, Confidencial o Restringido.
7. Haga clic en **Siguiente**.

### Paso 2. Descargar plantilla

Si no tiene un archivo preparado, puede descargar una plantilla:

- **Plantilla V2 con ejemplo**: incluye datos de ejemplo para guiarlo.
- **Plantilla V2 vacía**: lista para llenar con sus datos.
- **Plantilla V1 vacía**: versión anterior del formato.

Al lado verá un panel que describe los 30 campos del formato, indicando cuáles son obligatorios y cuáles opcionales. Pase el cursor sobre cada campo para ver más detalles.

### Paso 3. Cargar archivo

1. Arrastre su archivo a la zona punteada, o haga clic para seleccionarlo desde su computadora.
2. El sistema acepta archivos **CSV, Excel (.xlsx, .xls) y JSON**.
3. Verá el nombre y tamaño del archivo seleccionado.
4. Haga clic en **Siguiente**.

### Paso 4. Validar

El sistema revisa automáticamente su archivo y muestra:

- **Conteos**: total de registros, válidos, con advertencias y con errores.
- **Tabla de problemas**: si hay errores (campos faltantes, formatos incorrectos, fechas inválidas), se listan aquí con el número de fila y la columna afectada.
- **Evaluabilidad de las 5 banderas rojas**: indica si cada bandera se puede evaluar con los datos proporcionados (Disponible, Parcial o No evaluable).

Si hay muchos errores, revise su archivo con la plantilla y vuelva a intentarlo.

### Paso 5. Previsualizar

Verá una tabla con los datos tal como se cargarán. Puede:

- Revisar las primeras filas para confirmar que los datos se ven correctos.
- Activar **Ver todas las columnas** si quiere inspeccionar campos adicionales.
- Ver el porcentaje de completitud de los datos.

### Paso 6. Confirmar

Verá un resumen de la carga con todos los detalles. Lea el aviso que indica que se ejecutarán las reglas de análisis automáticamente. Cuando esté listo, haga clic en **Confirmar y procesar**.

### Paso 7. Resultados

El sistema procesa los datos y muestra:

- **Métricas**: registros cargados, alertas generadas, procesos evaluables y no evaluables, indicadores ejecutados y tiempo de procesamiento.
- **Alertas por indicador**: cuántas alertas generó cada bandera roja.
- **Cobertura de datos**: qué tan completos están los campos.
- **Bitácora**: registro de la operación.

Desde aquí puede:
- Hacer clic en **Ver alertas** para ir a la lista de alertas.
- Hacer clic en **Historial de cargas** para ver todas las cargas.
- Hacer clic en **Cargar otro archivo** para repetir el proceso.

---

## Historial de cargas

En esta pantalla ve el registro de todas las cargas de datos realizadas.

### Qué ve

Una tabla con las siguientes columnas:
- **Nombre** de la carga.
- **Periodo** al que corresponde.
- **Archivo** cargado.
- **Registros**: cantidad de registros válidos.
- **Alertas**: alertas generadas.
- **Estado**: Pendiente, Validando, Procesando, Completada, Fallida o Cancelada.
- **Fecha** de la carga.

### Qué puede hacer

- Consultar el historial para verificar qué cargas se han realizado.
- Identificar cargas con errores o fallidas.

---

## Alertas de riesgo

Esta pantalla muestra todas las alertas generadas por el sistema a partir del análisis de banderas rojas.

### Qué ve

- **4 tarjetas con conteos**: Total de alertas, Prioridad alta, Prioridad media y Prioridad baja.
- **Filtros**: buscador de texto (título, código o descripción), Estado, Prioridad e Indicador.
- **Tarjetas de alerta**: cada alerta muestra su código, badges de prioridad y estado, el título, el indicador que la activó y el proceso asociado.

### Qué puede hacer

- **Buscar**: escriba en el buscador para encontrar alertas por título, código o descripción.
- **Filtrar**: seleccione estado, prioridad o indicador para ver solo las alertas relevantes. Haga clic en **Limpiar** para quitar los filtros.
- **Expandir una alerta**: haga clic en una tarjeta para ver:
  - La descripción del análisis.
  - El cálculo realizado y los datos utilizados.
  - El umbral aplicado.
  - La metodología del indicador (fórmula y exclusiones).
  - El contexto del proceso (institución, proveedor, modalidad, monto).
- **Ver detalle completo**: haga clic en este botón para abrir la vista de detalle de la alerta.

> **Nota importante**: Las alertas son señales preventivas. No constituyen evidencia de irregularidad por sí solas. Requieren revisión técnica y documental.

---

## Detalle de una alerta

Esta pantalla muestra toda la información de una alerta individual.

### Qué ve

- **Código** y **título** de la alerta, con badges de prioridad y estado.
- **Aviso preventivo** permanente.
- **Sección "¿Por qué se generó esta alerta?"**: explica el indicador, el resultado observado, la regla aplicada, la confianza del dato y la fecha de cálculo.
- **3 pestañas**: Detalle, Comentarios e Historial.

### Pestaña Detalle

Muestra:
- Descripción de la alerta.
- Cálculo realizado y datos utilizados.
- Información del indicador, umbral, fecha y lote.
- Prioridad, estado y nivel de la alerta.

Si tiene permiso para gestionar alertas:
- Puede editar y **Guardar conclusión**.
- Puede **Cambiar estado** de la alerta (Nueva, Asignada, En revisión, Requiere información, Remitida, Descartada o Cerrada). Para descartar o cerrar, debe escribir una justificación obligatoria.

### Pestaña Comentarios

- **Escribir un comentario**: escriba su comentario en el campo de texto y haga clic en **Publicar comentario**. Los comentarios son internos y visibles solo para usuarios del sistema.
- **Ver comentarios**: vea la lista de comentarios con el autor y la fecha de cada uno.

### Pestaña Historial

Muestra la cronología de cambios de estado de la alerta: desde qué estado, a qué estado, la razón del cambio, el usuario que lo realizó y la fecha.

### Volver

Haga clic en **Volver** para regresar a la lista de alertas.

---

## Detalle de un proceso

Esta pantalla muestra la información completa de un proceso de contratación individual.

### Qué ve

- **Código** del proceso y badge con el número de alertas.
- **Descripción**, institución y modalidad del proceso.
- **Datos generales**: 14 campos incluyendo código, institución, unidad, objeto, modalidad, estado del contrato, fechas (publicación, cierre, adjudicación, contrato), montos (estimado y adjudicado), proveedor y número de oferentes.
- **Resumen de riesgo**: total de alertas, desglose por prioridad (alta, media, baja) y no evaluables.
- **Alertas detectadas**: tarjetas con cada alerta, su código, severidad, confianza, estado de revisión y regla aplicada.

### Qué puede hacer

- Hacer clic en cualquier alerta para abrir su detalle completo.
- Hacer clic en **Volver** para regresar al tablero principal.

---

## Reportes

Esta pantalla le permite generar y descargar reportes del sistema.

### Qué ve

- **Badge "Uso interno"** que recuerda que los reportes son para uso interno.
- **Filtros colapsables**: Bandera roja, Estado, Prioridad, Desde y Hasta.
- **5 tarjetas de reporte**:
  1. **Resumen ejecutivo**: métricas agregadas con KPIs.
  2. **Alertas por indicador**: agrupadas por bandera roja con desglose.
  3. **Alertas por institución**: distribución por institución compradora.
  4. **Detalle completo de alertas**: listado tabular completo.
  5. **Resumen de procesos**: consolidado de procesos de contratación.
- **Panel de previsualización**: muestra el contenido del reporte antes de descargarlo.
- **Historial de descargas recientes**.

### Qué puede hacer

1. **Aplicar filtros** (opcional): seleccione bandera, estado, prioridad o rango de fechas.
2. **Previsualizar**: haga clic en un reporte para ver su contenido en el panel de previsualización.
3. **Descargar PDF**: disponible para todos los reportes. Haga clic en **Descargar PDF**.
4. **Descargar Excel**: disponible para "Detalle completo de alertas" y "Alertas por indicador". Haga clic en **Descargar Excel**.
5. **Cerrar previsualización**: haga clic en la X del panel para cerrarlo.

> Todas las descargas quedan registradas en la bitácora de auditoría.

---

## Tableros públicos

El módulo de Tableros Públicos permite crear, revisar, publicar y compartir estadísticas institucionales agregadas en un formato accesible para cualquier ciudadano, sin necesidad de iniciar sesión.

### Quién puede usarlo

- **Preparar tableros**: usuarios con permiso para gestionar tableros públicos (Administradores y Fiscalización).
- **Aprobar y publicar**: usuarios con permiso de aprobación (Administradores).
- La preparación y la aprobación están separadas: quien prepara no publica directamente.

### Cómo crear un tablero público

1. Vaya a **Publicación → Tableros públicos** en el menú lateral.
2. Haga clic en **+ Nuevo tablero público**.
3. Se abrirá un asistente de 5 pasos:

#### Paso 1. Información general

Complete los siguientes campos:
- **Nombre del tablero**: título principal (por ejemplo, "Estadísticas generales de compras públicas").
- **Descripción pública**: texto que aparecerá en el tablero.
- **Unidad responsable**: área institucional responsable.
- **Periodo de referencia**: rango temporal de los datos.
- **Fuente autorizada**: origen de los datos.
- **Fecha de corte**: fecha límite de los datos.
- **Nota metodológica**: aclaración sobre cómo se calcularon los datos.

#### Paso 2. Contenido autorizado

Seleccione con casillas qué componentes estadísticos incluir:
- Número total de procesos incluidos.
- Número de instituciones representadas.
- Periodo cubierto.
- Porcentaje de registros completos.
- Gráfico de procesos registrados por mes.
- Distribución general por estado (solo si se autoriza).

> No se permiten filtros públicos por proveedor, institución, contrato, identificador de proceso o monto en esta versión.

#### Paso 3. Diseño y vista previa

Vea una maqueta de cómo se mostrará el tablero al público, en versión escritorio y móvil. Esta vista muestra la estructura sin inventar cifras: los valores reales se calculan al crear el snapshot.

#### Paso 4. Revisión

Confirme los datos del tablero antes de guardarlo. Verá un resumen con el título, periodo, fuente, fecha de corte, componentes seleccionados y la protección de datos aplicada.

#### Paso 5. Guardar borrador

Haga clic en **Crear borrador**. El sistema:
- Crea el tablero en estado **Borrador**.
- Calcula automáticamente los agregados estadísticos permitidos en el servidor.
- Genera una versión preliminar del snapshot.

### Flujo de aprobación

Los tableros pasan por los siguientes estados:

| Estado | Significado |
|---|---|
| **Borrador** | En preparación, editable |
| **Pendiente de aprobación** | Enviado a revisión por un aprobador |
| **Aprobado** | Revisado y autorizado para publicación |
| **Publicado** | Accesible públicamente con enlace e iframe |
| **Suspendido** | Retirado de publicación pública |
| **Archivado** | Sin vigencia, conservado para historial |

#### Solicitar aprobación

1. En la tabla de tableros, encuentre el tablero en estado **Borrador**.
2. Haga clic en **Solicitar**.
3. El tablero cambia a **Pendiente de aprobación**.

#### Aprobar o rechazar

Si tiene permiso de aprobación:
1. Encuentre el tablero en estado **Pendiente de aprobación**.
2. Haga clic en **Aprobar** para autorizar la publicación, o **Rechazar** para devolverlo a borrador.

#### Publicar

1. Una vez aprobado, haga clic en **Publicar**.
2. El sistema crea una copia pública independiente del snapshot aprobado.
3. Se genera automáticamente un **enlace público** y un **código iframe**.

### Compartir un tablero publicado

1. Haga clic en **Compartir** en el tablero publicado.
2. Se abre un cuadro con dos pestañas:

**A. Enlace público**
- Muestra la URL completa del tablero (por ejemplo, `https://dominio/publico/tableros/abc123`).
- Haga clic en **Copiar** para copiar el enlace al portapapeles.
- Haga clic en **Abrir tablero** para verlo en una nueva pestaña.

**B. Código Embed**
- Muestra un código iframe listo para pegar en sitios web externos.
- Haga clic en **Copiar código** para copiarlo al portapapeles.
- El código se ve así:

```html
<iframe
  src="https://dominio/publico/tableros/abc123/embed"
  title="Estadísticas generales de compras públicas"
  width="100%"
  height="650"
  loading="lazy"
  style="border:0;border-radius:12px;"
></iframe>
```

### Suspender un tablero

Si necesita retirar un tablero de publicación:
1. Haga clic en **Suspender** en el tablero publicado.
2. El tablero cambia a estado **Suspendido**.
3. El enlace público deja de mostrar el contenido.
4. El historial se conserva.

### Consultar el historial

1. Haga clic en **Historial** en cualquier tablero.
2. Se abre un cuadro con todas las versiones creadas, su número, fecha, componentes seleccionados, estado y observaciones de revisión.

### Qué ve el público

Cuando una persona abre el enlace público (sin iniciar sesión), ve:

- **Encabezado institucional** con el logo de DINAC.
- **Título y descripción** del tablero.
- **Tarjetas de indicadores**: procesos incluidos, instituciones representadas, periodo de cobertura y completitud de registros.
- **Gráfico de evolución mensual** con barras.
- **Distribución por estado** de los procesos.
- **Información metodológica**: fuente, fecha de publicación, fecha de corte, cobertura y nota aclaratoria.
- **Footer** institucional.

> El tablero público no muestra banderas rojas, alertas, proveedores individuales, datos de contratos específicos ni ningún dato interno.

---

## Panel de configuración

El panel de configuración reúne todas las opciones de administración del sistema. Está organizado en 7 secciones a las que se accede mediante pestañas.

### Indicadores

Permite gestionar las 5 banderas rojas del sistema.

**Qué puede hacer:**
- **Ver indicadores**: lista con código, nombre, estado (activo/inactivo), versión y número de parámetros.
- **Crear indicador**: haga clic en **Nuevo indicador** y complete el formulario (código, nombre, descripción, metodología, fórmula, campos requeridos y exclusiones).
- **Editar**: modifique los datos del indicador.
- **Activar/Desactivar**: active o desactive un indicador sin eliminarlo.
- **Configurar parámetros**: en la pestaña Parámetros, ajuste los umbrales (por ejemplo, porcentaje mínimo, número de contratos, días mínimos). Haga clic en **Guardar versión** para crear una nueva versión con los cambios.
- **Ver versiones**: consulte el historial de versiones y **Restaurar** una versión anterior si es necesario.
- **Ver historial**: registro de todas las modificaciones con el usuario y la fecha.

### Catálogos

Gestiona instituciones y proveedores.

**Qué puede hacer:**
- **Instituciones**: vea la lista con código, nombre y estado. Haga clic en **Agregar** para registrar una nueva institución.
- **Proveedores**: vea la lista con código, nombre e identificación legal. Haga clic en **Agregar** para registrar un nuevo proveedor.

### Usuarios

Gestiona las cuentas de usuario del sistema.

**Qué puede hacer:**
- **Buscar y filtrar** por rol y estado.
- **Exportar** el listado en CSV.
- **Crear usuario**: haga clic en **Crear usuario** y complete nombre, correo, contraseña temporal, cargo, unidad y rol.
- **Editar usuario**: modifique nombre, cargo, unidad y rol (el correo no se puede cambiar).
- **Suspender/Reactivar**: active o desactive el acceso de un usuario con diálogo de confirmación.

### Roles y permisos

Muestra la matriz de permisos por rol.

**Qué puede hacer:**
- Ver las tarjetas de cada rol con el número de permisos asignados.
- Hacer clic en las casillas de la matriz para **otorgar o revocar** permisos a cada rol.
- Expandir o colapsar los módulos (dashboard, data, alerts, reports, config, admin, docs, profile, publications).

### Seguridad

Configura las políticas de seguridad del sistema.

**Qué puede hacer:**
- **Sesiones**: ajustar duración máxima de sesión y tiempo de inactividad.
- **Contraseñas y MFA**: configurar longitud mínima, requerir mayúsculas/minúsculas/números/especiales, y activar MFA obligatoria.
- **Bloqueos**: ajustar intentos fallidos permitidos y duración del bloqueo.
- **Retención**: configurar días de retención de archivos y bitácora.
- **Archivos**: definir tipos de archivo permitidos y tamaño máximo.
- **Permisos**: activar/desactivar exportaciones, descargas y visibilidad por unidad.
- **Mensaje institucional**: editar el mensaje de acceso restringido.
- Haga clic en **Guardar cambios** al finalizar.

### Bitácora

Registro inmutable de todas las acciones del sistema.

**Qué puede hacer:**
- **Buscar** por texto.
- **Filtrar** por acción, módulo, resultado y rango de fechas.
- **Exportar** el listado en CSV.
- Consultar hasta 500 registros recientes (solo lectura).

### Reseteo de datos

Permite eliminar todos los datos de procesos, alertas y cargas para iniciar un análisis desde cero. Conserva usuarios, roles, permisos y catálogos.

**Cómo usarlo:**
1. Lea el aviso de acción irreversible.
2. Revise los conteos de registros que se eliminarán y los que se conservarán.
3. Seleccione el **alcance**: Completo, Solo alertas o Solo procesos.
4. Marque la casilla confirmando que entiende la operación.
5. Escriba la palabra **REINICIAR** en el campo de confirmación.
6. Haga clic en **Resetear base de datos**.

> Esta operación no se puede deshacer. Solo está disponible para usuarios con permiso de reseteo.

---

## Documentación y tutoriales

### Documentación

Sección de solo lectura con información metodológica sobre el sistema:

- **Propósito** del sistema y su enfoque preventivo.
- **Los 5 indicadores de riesgo** con descripción detallada de cada uno.
- **Priorización** de alertas (baja, media, alta).
- **Seguridad y privacidad** de los datos.
- **Flujo de revisión** con los 7 estados por los que puede pasar una alerta.

### Tutoriales

Sección interactiva con 3 áreas:

1. **Cómo funciona la plataforma**: recorrido de 7 pasos numerados con tarjetas de acceso rápido según sus permisos y consejos de uso.
2. **Conceptos clave de banderas rojas**: acordeón con las 5 banderas, explicando qué detecta cada una, por qué es relevante, un ejemplo y el umbral aplicado. Incluye explicación de prioridad y preguntas frecuentes.
3. **Banderas rojas priorizadas**: acordeón con 5 combinaciones priorizadas y una tabla resumen.

---

## Mi perfil

En esta pantalla gestiona su propia información y seguridad.

### Qué ve

- **Información personal**: avatar con su inicial, nombre, correo y rol.
- **Formulario editable**: nombre, cargo y unidad organizativa.
- **Seguridad de la cuenta**: estado de MFA, último cambio de contraseña, último acceso y fecha de expiración del acceso.

### Qué puede hacer

- **Editar datos**: modifique su nombre, cargo o unidad y haga clic en **Guardar cambios**.
- **Cambiar contraseña**: escriba su contraseña actual, la nueva y confírmela. La contraseña debe tener al menos 12 caracteres. Si tiene una contraseña temporal forzada, verá un aviso.
- **Verificar seguridad**: revise la fecha de su último acceso y si su cuenta tiene MFA activada.

---

## Preguntas frecuentes

### ¿Qué es una bandera roja?

Una bandera roja es un indicador preventivo que señala un posible riesgo en un proceso de contratación. No significa que se haya cometido una irregularidad, sino que el proceso merece revisión técnica. Las 5 banderas rojas del sistema son: oferta única, plazo corto, contrato no publicado, uso no competitivo y concentración comprador-proveedor.

### ¿Las alertas son evidencia de fraude?

No. Las alertas son señales preventivas generadas mediante reglas de análisis automático. Su activación no constituye evidencia de irregularidad, responsabilidad administrativa, fraude o corrupción. Requieren revisión técnica y documental por parte del personal competente.

### ¿Qué formatos de archivo puedo cargar?

Puede cargar archivos CSV (separados por comas o punto y coma), Excel (.xlsx o .xls) y JSON. El sistema detecta automáticamente el formato y valida las columnas.

### ¿Qué pasa después de cargar datos?

El sistema guarda los datos en la base de datos y ejecuta automáticamente las 5 reglas de análisis. Cada proceso es evaluado según los indicadores activos y los umbrales configurados. Las alertas generadas aparecen inmediatamente en la pantalla de Alertas de riesgo.

### ¿Puedo cambiar los umbrales de las banderas rojas?

Sí, si tiene permiso de configuración. Vaya a **Configuración → Indicadores**, seleccione el indicador, vaya a la pestaña **Parámetros**, ajuste los valores y haga clic en **Guardar versión**. Cada cambio crea una nueva versión del indicador y queda registrado en el historial.

### ¿Quién puede ver los tableros públicos?

Cualquier persona con el enlace público puede ver un tablero publicado, sin necesidad de iniciar sesión. El tablero muestra únicamente estadísticas agregadas aprobadas institucionalmente, nunca datos individuales ni alertas.

### ¿Puedo incrustar un tablero en otro sitio web?

Sí. Cada tablero publicado genera un código iframe que puede copiar y pegar en cualquier sitio web autorizado por DINAC. Haga clic en **Compartir → Código Embed** y luego en **Copiar código**.

### ¿Qué pasa si suspendo un tablero?

Al suspender un tablero, el enlace público deja de mostrar el contenido y el tablero cambia a estado **Suspendido**. El historial se conserva y puede volver a publicarlo más tarde creando una nueva versión.

### ¿Una nueva carga de datos cambia automáticamente el tablero público?

No. Los tableros públicos consultan versiones aprobadas independientes (snapshots). Una nueva carga de datos internos no modifica el tablero público. Para actualizar el tablero, debe crear una nueva versión, enviarla a aprobación y publicarla.

### ¿Qué datos NO se muestran en el tablero público?

El tablero público no muestra: banderas rojas, alertas individuales, puntajes de riesgo, instituciones investigadas, proveedores individuales, datos de contratos específicos, documentos internos, resultados de investigaciones, ni reglas, parámetros o umbrales reservados.

### ¿Qué hago si mi cuenta se bloquea?

Si ingresó una contraseña incorrecta varias veces, su cuenta se bloquea temporalmente. Espere el tiempo indicado en la pantalla e intente nuevamente. Si el problema persiste, contacte al administrador del sistema.

### ¿Dónde se registran mis acciones?

Todas las acciones que realiza en el sistema (inicio de sesión, cargas, cambios de estado, descargas, publicaciones, etc.) quedan registradas en la bitácora de auditoría. El administrador puede consultar esta bitácora en **Configuración → Bitácora**.

### ¿Puedo cambiar mi contraseña?

Sí. Vaya a **Mi perfil** (haga clic en su avatar en la esquina superior derecha y seleccione **Mi perfil**), vaya a la sección de seguridad de la cuenta y use el formulario de cambio de contraseña. Necesita su contraseña actual.

---

## Sobre esta guía

Esta guía cubre todas las funcionalidades visibles del sistema SIGA-DINAC versión actual. Para información técnica sobre instalación, migraciones y despliegue, consulte el archivo **README.md** del proyecto.

Si tiene dudas sobre el uso del sistema que no están cubiertas en esta guía, consulte la sección de **Tutoriales** dentro del sistema o contacte al administrador.

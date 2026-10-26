# SIGA-DINAC

## Sistema de Identificación y Gestión de Alertas

Plataforma de transparencia para la **Dirección Nacional de Compras Públicas (DINAC)**, desarrollada por **Red Ciudadana**. El sistema analiza automáticamente procesos de contratación pública mediante banderas rojas (red flags) para detectar riesgos e irregularidades potenciales, y permite publicar estadísticas agregadas en tableros públicos accesibles sin inicio de sesión.

---

## Tabla de contenidos

1. [Qué hace el sistema](#qué-hace-el-sistema)
2. [Novedades de esta versión](#novedades-de-esta-versión)
3. [Tecnologías utilizadas](#tecnologías-utilizadas)
4. [Requisitos previos](#requisitos-previos)
5. [Instalación paso a paso](#instalación-paso-a-paso)
6. [Estructura del proyecto](#estructura-del-proyecto)
7. [Base de datos y migraciones](#base-de-datos-y-migraciones)
8. [Funciones de servidor (Edge Functions)](#funciones-de-servidor-edge-functions)
9. [Pantallas y funcionalidades](#pantallas-y-funcionalidades)
10. [Módulo de Tableros Públicos](#módulo-de-tableros-públicos)
11. [Roles y permisos](#roles-y-permisos)
12. [Banderas rojas (indicadores)](#banderas-rojas-indicadores)
13. [Carga de datos](#carga-de-datos)
14. [Reportes](#reportes)
15. [Seguridad](#seguridad)
16. [Credenciales de demostración](#credenciales-de-demostración)
17. [Scripts disponibles](#scripts-disponibles)
18. [Despliegue](#despliegue)

---

## Qué hace el sistema

SIGA-DINAC es una aplicación web institucional que permite a la DINAC:

- **Cargar datos** de procesos de contratación pública desde archivos CSV, Excel (.xlsx, .xls) o JSON.
- **Detectar automáticamente** riesgos mediante 5 banderas rojas (oferta única, plazo corto, contrato no publicado, métodos no competitivos, concentración comprador-proveedor).
- **Gestionar alertas** generadas por el sistema: asignarlas, revisarlas, comentarlas, adjuntar documentos y cambiar su estado.
- **Generar reportes** en PDF y Excel con filtros por bandera, estado, prioridad y fechas.
- **Auditar** todas las acciones del sistema en una bitácora inmutable.
- **Publicar tableros estadísticos públicos** con información agregada aprobada institucionalmente, accesibles sin inicio de sesión y embebibles mediante código iframe.

Las banderas rojas son **indicadores preventivos**. Su activación no constituye por sí sola evidencia de irregularidad, fraude o corrupción. Requieren revisión técnica y documental.

---

## Novedades de esta versión

### Módulo de Tableros Públicos
- Nueva sección **Publicación → Tableros públicos** en el menú lateral.
- Asistente de 5 pasos para crear tableros estadísticos con componentes autorizados.
- Flujo institucional de aprobación: borrador → pendiente de aprobación → aprobado → publicado → suspendido.
- Generación automática de **enlace público** y **código iframe embebible** (estilo YouTube).
- Rutas públicas sin autenticación: `/publico/tableros/:publicId` y `/publico/tableros/:publicId/embed`.
- Arquitectura basada en **snapshots independientes**: el sitio público consulta únicamente versiones aprobadas, nunca los datos privados.
- Separación estricta entre datos internos y estadísticas autorizadas para publicación.

### Footer institucional
- Se agregó un **footer institucional** con los logos de cooperación al final de todas las páginas internas del sistema.

### Endurecimiento de seguridad
- **Revocación de permisos del rol anónimo**: se eliminaron todos los permisos de `anon` sobre las tablas internas, conservando únicamente `SELECT` sobre `public_board_publications` (única tabla con acceso público legítimo vía RLS).
- **Protección de columnas privilegiadas en `user_profiles`**: un trigger de base de datos bloquea server-side cualquier intento de cambiar `role_id`, `status`, `is_active`, `failed_attempts`, `locked_until`, `mfa_enabled`, `access_expires_at` o `force_password_change` por usuarios no administradores. Un usuario puede limpiar `force_password_change` tras cambiar su contraseña, pero no activarlo ni tocar las demás columnas.
- **Políticas RLS reforzadas**: las políticas de escritura sobre `alerts`, `procurement_method_catalog` y `contract_status_catalog` ahora requieren el permiso específico (`manage_alerts`, `manage_catalogs`) o rol de administrador, en lugar de permitir escritura a cualquier usuario activo.
- **Funciones SECURITY DEFINER protegidas**: se revocó `EXECUTE` de `PUBLIC` y `anon` sobre las funciones helper (`can_perform`, `is_admin`, `has_permission`, etc.), restringiendo su uso a usuarios autenticados.
- **Edge Functions con verificación de JWT**: las tres funciones (`create-user`, `process-rules`, `reset-database`) ahora requieren un JWT válido (`verify_jwt = true`) y derivan la identidad del usuario desde el token verificado por el servidor, ignorando cualquier dato de identidad enviado en el cuerpo de la petición. La función `create-user` además verifica server-side que el solicitante tenga el permiso `manage_users`.

### Migraciones de base de datos
- `20261026000000_public_boards.sql` — Tablas `public_boards`, `public_board_versions`, `public_board_publications` con RLS y funciones RPC de servidor.
- `20261026000001_public_boards_create_rpc.sql` — Función `create_public_board` para creación autorizada de tableros.
- `20261026000002_priority_red_flags_catalog.sql` — Catálogo de banderas rojas priorizadas.
- `20261026210000_security_hardening_rls_and_grants.sql` — Revocación de permisos de `anon`, trigger de protección de columnas privilegiadas, políticas RLS reforzadas y restricción de funciones SECURITY DEFINER.
- `20261026211000_refine_profile_guard_allow_password_flag_clear.sql` — Refinamiento del trigger para permitir limpiar `force_password_change` tras cambio de contraseña.

---

## Tecnologías utilizadas

| Tecnología | Uso |
|---|---|
| **React 18** + **TypeScript** | Framework frontend |
| **Vite 5** | Bundler y servidor de desarrollo |
| **Tailwind CSS 3** | Estilos y diseño |
| **Supabase** | Base de datos (PostgreSQL), autenticación y funciones de servidor |
| **lucide-react** | Iconografía |
| **jsPDF** + **jspdf-autotable** | Generación de reportes PDF |
| **xlsx (SheetJS)** | Parseo de Excel y exportación de reportes Excel |

---

## Requisitos previos

Antes de instalar el proyecto, necesita tener instalado:

- **Node.js** versión 18 o superior — descárguelo de [https://nodejs.org](https://nodejs.org)
- **npm** (se instala automáticamente con Node.js)
- Un proyecto de **Supabase** provisionado (base de datos PostgreSQL en la nube)

Para verificar que Node.js está instalado:

```bash
node --version
npm --version
```

Ambos comandos deben mostrar un número de versión.

---

## Instalación paso a paso

### 1. Clonar o descargar el proyecto

Si tiene acceso al repositorio:

```bash
git clone <url-del-repositorio>
cd proyecto
```

Si descargó un archivo ZIP, extráigalo y abra una terminal en la carpeta del proyecto.

### 2. Instalar las dependencias

Desde la raíz del proyecto, ejecute:

```bash
npm install
```

Esto descarga e instala todas las librerías necesarias (React, Supabase, Tailwind, jsPDF, etc.).

### 3. Configurar las variables de entorno

El proyecto incluye un archivo `.env` con las credenciales de Supabase ya configuradas. Si necesita usar un proyecto de Supabase diferente, edite el archivo `.env` con los siguientes valores:

```env
SUPABASE_URL=https://su-proyecto.supabase.co
SUPABASE_ANON_KEY=su-clave-anon
SUPABASE_SERVICE_ROLE_KEY=su-clave-service-role
```

Estos valores se encuentran en el panel de Supabase: **Project Settings > API**.

### 4. Aplicar las migraciones de base de datos

Las migraciones crean todas las tablas, roles, permisos y datos de demostración. Se aplican automáticamente al provisionar el proyecto. Si necesita aplicarlas manualmente, use las herramientas de Supabase del entorno.

### 5. Iniciar el servidor de desarrollo

```bash
npm run dev
```

El servidor se iniciará en `http://localhost:5173`. Abra esa dirección en su navegador.

### 6. Compilar para producción

```bash
npm run build
```

Los archivos compilados se generan en la carpeta `dist/`.

---

## Estructura del proyecto

```
proyecto/
├── src/
│   ├── components/               # Componentes reutilizables
│   │   ├── AppNav.tsx            # Menú de navegación lateral
│   │   ├── AppShell.tsx          # Estructura principal (header + sidebar + contenido + footer)
│   │   ├── Breadcrumbs.tsx       # Migas de pan
│   │   ├── ConfirmDialog.tsx     # Diálogo de confirmación
│   │   ├── HelpUI.tsx            # Tooltips y notas de ayuda
│   │   ├── InstitutionalFooter.tsx # Footer institucional con logos de cooperación
│   │   ├── LoadingScreen.tsx     # Pantalla de carga
│   │   └── SessionTimeout.tsx    # Cierre de sesión por inactividad
│   ├── context/
│   │   └── AuthContext.tsx       # Autenticación, sesión, permisos
│   ├── lib/
│   │   └── supabase.ts           # Cliente de Supabase
│   ├── screens/                  # Pantallas del sistema
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardView.tsx
│   │   ├── AlertsView.tsx
│   │   ├── AlertDetailView.tsx
│   │   ├── ProcessDetailView.tsx
│   │   ├── UploadView.tsx
│   │   ├── UploadsView.tsx
│   │   ├── ReportsView.tsx
│   │   ├── IndicatorsView.tsx
│   │   ├── CatalogsView.tsx
│   │   ├── UsersView.tsx
│   │   ├── RolesView.tsx
│   │   ├── SecurityView.tsx
│   │   ├── AuditView.tsx
│   │   ├── SystemResetView.tsx
│   │   ├── DocsView.tsx
│   │   ├── TutorialsView.tsx
│   │   ├── ProfileView.tsx
│   │   ├── ConfigPanel.tsx
│   │   └── PublicBoardsView.tsx  # Módulo de tableros públicos
│   ├── types/
│   │   └── index.ts              # Tipos de TypeScript y constantes
│   ├── App.tsx                   # Componente raíz (routing público + interno)
│   ├── main.tsx                  # Punto de entrada
│   └── index.css                 # Estilos globales (Tailwind)
├── supabase/
│   ├── config.toml               # Configuración de Edge Functions
│   ├── migrations/               # Migraciones de base de datos
│   └── functions/                # Edge Functions
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── README.md
├── GUIA-USUARIO.md               # Guía de usuario del sistema
└── .env
```

---

## Base de datos y migraciones

El sistema usa PostgreSQL (a través de Supabase) con **Row Level Security (RLS)** habilitado en todas las tablas. Las migraciones se aplican en orden:

| # | Archivo | Qué crea |
|---|---|---|
| 01 | `01_core_auth_rbac.sql` | Roles, permisos, perfiles de usuario, sesiones, configuración de seguridad, bitácora de auditoría |
| 02 | `02_procurement_indicators.sql` | Instituciones, unidades organizativas, proveedores, procesos de contratación, definiciones de indicadores, alertas, comentarios, documentos |
| 03 | `03_seed_roles_permissions_indicators.sql` | Roles (admin, fiscalización), permisos, definiciones de las 5 banderas rojas |
| 04 | `04_seed_demo_data.sql` | Datos de demostración: instituciones, proveedores, procesos |
| 05 | `05_generate_demo_alerts.sql` | Alertas de demostración generadas a partir de los datos |
| 06 | `06_simplify_roles_to_two.sql` | Simplificación a dos roles: Administrador General y Fiscalización |
| 07 | `07_red_flags_v2.sql` | Actualización de banderas rojas a versión 2 |
| 08 | `08_super_admin_and_reset.sql` | Rol de Super Administrador y funcionalidad de reseteo de base de datos |
| 09 | `20261026000000_public_boards.sql` | Tablas de tableros públicos, versiones, publicaciones, RLS y funciones RPC de servidor |
| 10 | `20261026000001_public_boards_create_rpc.sql` | Función `create_public_board` para creación autorizada de tableros |
| 11 | `20261026000002_priority_red_flags_catalog.sql` | Catálogo de banderas rojas priorizadas |
| 12 | `20261026210000_security_hardening_rls_and_grants.sql` | Endurecimiento de seguridad: revocación de permisos de `anon`, trigger de columnas privilegiadas, políticas RLS reforzadas |
| 13 | `20261026211000_refine_profile_guard_allow_password_flag_clear.sql` | Refinamiento del trigger de perfil para permitir limpiar `force_password_change` |

### Tablas principales

- **user_profiles** — Perfiles de usuario con estado, rol y configuración de acceso
- **roles / permissions / role_permissions** — Control de acceso basado en roles (RBAC)
- **audit_logs** — Bitácora inmutable de todas las acciones del sistema
- **institutions / organizational_units** — Instituciones compradoras y sus unidades
- **suppliers** — Proveedores registrados
- **procurement_processes** — Procesos de contratación pública
- **data_uploads** — Registro de cargas de datos
- **indicator_definitions / indicator_parameters** — Definición y configuración de banderas rojas
- **alerts** — Alertas generadas por el análisis automático
- **alert_comments / alert_documents / alert_status_history** — Gestión de alertas
- **security_settings** — Configuración global de seguridad
- **public_boards** — Configuración de tableros públicos (privada)
- **public_board_versions** — Versiones de tableros con snapshots estadísticos (privada)
- **public_board_publications** — Copias públicas independientes de versiones aprobadas (acceso anónimo limitado)

---

## Funciones de servidor (Edge Functions)

El sistema incluye 3 Edge Functions que se ejecutan en el servidor de Supabase (Deno runtime):

| Función | Qué hace |
|---|---|
| **create-user** | Crea un nuevo usuario en Supabase Auth y registra su perfil. Requiere JWT válido; verifica server-side que el solicitante tenga el permiso `manage_users` |
| **process-rules** | Ejecuta las reglas de análisis sobre los procesos cargados y genera las alertas. Requiere JWT válido; deriva la identidad del usuario desde el token |
| **reset-database** | Elimina todos los procesos, alertas y cargas (conserva usuarios, roles, permisos y bitácora). Requiere JWT válido; verifica server-side el rol y permisos del solicitante |

> Las tres funciones tienen `verify_jwt = true` y no aceptan datos de identidad del cuerpo de la petición. La identidad se obtiene siempre del JWT verificado por el servidor.

### Funciones RPC de base de datos (Tableros públicos)

Adicionalmente, el módulo de Tableros Públicos utiliza funciones PostgreSQL `SECURITY DEFINER` que se ejecutan en el servidor con verificación de permisos:

| Función | Qué hace |
|---|---|
| **create_public_board** | Crea la configuración privada inicial de un tablero (solo usuarios con permiso `manage_public_boards`) |
| **prepare_public_board_version** | Calcula los agregados estadísticos permitidos y crea una versión en borrador |
| **submit_public_board_for_approval** | Envía un tablero a revisión institucional |
| **review_public_board_version** | Aprueba o devuelve una versión a borrador con observaciones |
| **publish_public_board** | Crea una copia pública independiente de la versión aprobada y genera el enlace público |
| **suspend_public_board** | Retira la publicación pública sin borrar el historial |

---

## Pantallas y funcionalidades

### Tablero principal (Dashboard)
Vista general con métricas clave: total de procesos, alertas por bandera, distribución por prioridad y estado, montos adjudicados, y gráficos interactivos. Incluye filtros globales (periodo, modalidad, institución), una guía colapsable de uso y una tabla de procesos con ordenamiento.

### Carga de datos
Asistente de 7 pasos que permite cargar archivos **CSV, Excel (.xlsx, .xls) y JSON**. El sistema detecta automáticamente la versión de plantilla, valida columnas, muestra previsualización, procesa los datos y genera alertas automáticamente.

### Historial de cargas
Registro de todas las cargas realizadas con estado, cantidad de registros válidos/rechazados, alertas generadas y fecha.

### Alertas de riesgo
Listado de todas las alertas con filtros por bandera, estado, prioridad y búsqueda de texto. Cada alerta se puede expandir para ver el detalle del análisis o abrir el detalle completo.

### Detalle de alerta
Vista individual con explicabilidad del cálculo, pestañas de detalle, comentarios internos e historial de cambios de estado. Permite editar conclusiones, cambiar estado y publicar comentarios.

### Detalle de proceso
Información completa de un proceso de contratación con sus datos generales, resumen de riesgo y las alertas detectadas.

### Reportes
Generación de reportes internos en **PDF y Excel**. Incluye 5 tipos de reporte con previsualización, filtros y registro de descargas en bitácora.

### Configuración
Panel de administración con 7 secciones: Indicadores, Catálogos, Usuarios, Roles y permisos, Seguridad, Bitácora y Reseteo de datos.

### Documentación y Tutoriales
Secciones de ayuda con documentación metodológica sobre las banderas rojas y tutoriales interactivos de uso del sistema.

### Perfil
Información del usuario, cambio de contraseña y edición de datos personales.

---

## Módulo de Tableros Públicos

El módulo de Tableros Públicos permite a usuarios autorizados de DINAC crear, revisar, publicar y compartir estadísticas institucionales agregadas en un formato accesible sin inicio de sesión.

### Arquitectura de seguridad

El requisito técnico más importante de este módulo es la **separación estricta entre datos internos y estadísticas públicas**:

1. El administrador selecciona la plantilla y fuente autorizadas.
2. El **servidor** calcula únicamente los agregados permitidos.
3. Se generan verificaciones de calidad y confidencialidad.
4. Un usuario autorizado revisa y aprueba el contenido exacto.
5. El sistema crea una **versión pública independiente** (snapshot).
6. El sitio público consulta **únicamente** esa versión aprobada.
7. Una nueva carga interna no modifica automáticamente el tablero público.
8. Cada actualización requiere nueva versión y aprobación.

Las rutas públicas no utilizan credenciales administrativas ni exponen acceso a tablas privadas. El acceso anónimo está limitado por RLS a las publicaciones con estado `published`.

### Componentes autorizados para publicación

- Número total de procesos incluidos en el conjunto de datos.
- Número de instituciones representadas.
- Periodo cubierto.
- Porcentaje de registros completos.
- Gráfico de procesos registrados por mes.
- Distribución general por estado del proceso (solo cuando se autorice).

**No se publican:** banderas rojas, alertas individuales, puntajes de riesgo, instituciones investigadas, proveedores individuales, datos de contratos específicos, documentos internos, resultados de investigaciones, ni reglas, parámetros o umbrales reservados.

### Rutas públicas

| Ruta | Descripción |
|---|---|
| `/publico/tableros/:publicId` | Vista pública completa del tablero |
| `/publico/tableros/:publicId/embed` | Vista para incrustar en sitios externos (sin menú ni encabezado) |

### Flujo de aprobación institucional

```
Borrador → Pendiente de aprobación → Aprobado → Publicado → Suspendido
                ↑                         ↓
                └── Rechazado (vuelve a borrador) ──┘
```

- Los usuarios con permiso `manage_public_boards` pueden crear y preparar contenido, pero no publicarlo directamente.
- Un usuario con permiso `approve_public_boards` debe revisar y aprobar antes de la publicación.
- Cada acción registra usuario, fecha, versión y observaciones en la bitácora.

### Código iframe embebible

Cada publicación aprobada genera automáticamente un código iframe similar al de YouTube:

```html
<iframe
  src="https://DOMINIO/publico/tableros/ID/embed"
  title="Estadísticas generales de compras públicas"
  width="100%"
  height="650"
  loading="lazy"
  style="border:0;border-radius:12px;"
></iframe>
```

---

## Roles y permisos

El sistema utiliza control de acceso basado en roles (RBAC) con los siguientes roles:

| Rol | Código | Acceso |
|---|---|---|
| **Super Administrador** | `super_admin` | Acceso completo a todas las funcionalidades, incluyendo reseteo de base de datos |
| **Administrador General** | `admin_general` | Administración del sistema, usuarios, configuración, reportes y tableros públicos |
| **Fiscalización** | `fiscalization` | Acceso limitado: tablero, alertas, reportes y preparación de tableros públicos |

Permisos clave del módulo de Tableros Públicos:

- `manage_public_boards` — Crear y preparar versiones de estadísticas para publicación
- `approve_public_boards` — Revisar, aprobar, publicar y suspender tableros públicos

---

## Banderas rojas (indicadores)

El sistema analiza los procesos de contratación mediante 5 banderas rojas:

| Código | Nombre | Nivel | Qué detecta |
|---|---|---|---|
| **R018** | Oferta única | Proceso | Procesos donde solo se recibió una oferta |
| **R003** | Plazo corto | Proceso | Plazos reducidos para presentar ofertas |
| **R063** | Contrato no publicado | Proceso | Contratos o documentos contractuales no publicados |
| **R013** | Uso no competitivo | Institución | Alto uso de métodos de contratación no competitivos |
| **R040** | Concentración comprador-proveedor | Comprador-Proveedor | Alta concentración entre un comprador y un proveedor |

Cada bandera tiene **parámetros configurables** (umbrales) que determinan cuándo se activa una alerta. Los parámetros se pueden ajustar desde la pantalla de Indicadores en la configuración.

---

## Carga de datos

### Formatos aceptados

- **CSV** — Archivos de texto separados por comas o punto y coma
- **Excel** — Archivos .xlsx o .xls
- **JSON** — Arreglo de objetos donde cada objeto es una fila

### Columnas requeridas

El sistema detecta automáticamente la versión de plantilla (V1/V2). Las columnas principales incluyen:

- `process_id` — Identificador del proceso
- `institution_code` — Código de la institución compradora
- `procurement_method` — Método de contratación (LP, LC, CD, CE, etc.)
- `publication_date` — Fecha de publicación
- `bid_deadline` — Fecha límite para ofertas
- `award_date` — Fecha de adjudicación
- `awarded_amount` — Monto adjudicado
- `supplier_name` — Nombre del proveedor
- `number_of_bidders` — Número de oferentes

### Proceso de carga

1. Seleccione el archivo desde la pantalla de Carga de datos
2. El sistema detecta el formato y valida las columnas
3. Se muestra una previsualización con los datos parseados
4. Al confirmar, los datos se guardan en la base de datos
5. El sistema ejecuta automáticamente las reglas de análisis
6. Se generan las alertas correspondientes

---

## Reportes

### Formatos de descarga

- **PDF** — Disponible para los 5 tipos de reporte. Incluye encabezado con metadatos, tablas formateadas y pie de página con nota legal.
- **Excel** — Disponible para "Detalle completo de alertas" y "Alertas por indicador". Incluye hoja de información con metadatos y hojas de datos con columnas legibles.

### Filtros disponibles

Todos los reportes se pueden filtrar por:
- Bandera roja específica
- Estado de la alerta
- Prioridad (alta, media, baja)
- Rango de fechas (desde/hasta)

### Registro de descargas

Cada descarga de reporte queda registrada en la bitácora de auditoría con usuario, fecha, tipo de reporte, formato y filtros aplicados.

---

## Seguridad

El sistema implementa múltiples capas de seguridad:

- **Autenticación** — Inicio de sesión con correo y contraseña a través de Supabase Auth
- **Row Level Security** — Todas las tablas tienen RLS habilitado; los usuarios solo acceden a los datos permitidos por su rol y permisos
- **Permisos mínimos para rol anónimo** — El rol `anon` solo tiene acceso de lectura sobre `public_board_publications`; el resto de tablas internas no otorgan ningún permiso a usuarios no autenticados
- **Protección de columnas privilegiadas** — Un trigger de base de datos bloquea cambios no autorizados a `role_id`, `status`, `is_active`, `failed_attempts`, `locked_until`, `mfa_enabled`, `access_expires_at` y `force_password_change` en `user_profiles`, evitando auto-escalación de privilegios
- **Políticas RLS por permiso** — La escritura sobre `alerts` y catálogos requiere el permiso específico (`manage_alerts`, `manage_catalogs`) o rol de administrador
- **Funciones SECURITY DEFINER restringidas** — Las funciones helper solo son ejecutables por usuarios autenticados, no por el rol anónimo
- **Edge Functions con verificación de JWT** — Las tres funciones de servidor requieren un JWT válido y derivan la identidad del usuario desde el token, no desde datos del cliente
- **Cierre por inactividad** — Sesión se cierra automáticamente tras un periodo configurable
- **Bloqueo por intentos fallidos** — Cuenta bloqueada temporalmente tras múltiples intentos fallidos
- **Políticas de contraseña** — Longitud mínima, mayúsculas, minúsculas, números y caracteres especiales configurables
- **Bitácora de auditoría** — Todas las acciones quedan registradas (usuario, fecha, IP, módulo, acción)
- **Clasificación de uso interno** — Todos los reportes incluyen la marca "Uso interno"
- **Separación de datos públicos** — Los tableros públicos consultan snapshots aprobados, nunca las tablas privadas
- **Funciones SECURITY DEFINER** — Las operaciones privilegiadas (crear tableros, aprobar, publicar) se ejecutan en el servidor con verificación de permisos

---

## Credenciales de demostración

El sistema incluye datos de demostración con un usuario administrador:

| Campo | Valor |
|---|---|
| **Correo** | `admin@dinac-demo.gob.sv` |
| **Contraseña** | `SIA-DINAC-2024!` |

En la pantalla de inicio de sesión hay un botón para autocompletar estas credenciales.

---

## Scripts disponibles

Ejecute estos comandos desde la raíz del proyecto:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo en `http://localhost:5173` |
| `npm run build` | Compila el proyecto para producción en la carpeta `dist/` |
| `npm run typecheck` | Verifica que el código TypeScript no tenga errores de tipos |
| `npm run lint` | Ejecuta el linter (ESLint) para revisar la calidad del código |
| `npm run preview` | Sirve la versión compilada localmente para previsualizar |

---

## Despliegue

El proyecto está configurado para desplegarse en **Bolt** o cualquier servicio de hosting estático (Netlify, Vercel, Cloudflare Pages, etc.).

### Pasos para desplegar

1. Compile el proyecto:
   ```bash
   npm run build
   ```

2. Los archivos compilados se encuentran en `dist/`.

3. Suba el contenido de `dist/` a su proveedor de hosting.

4. Asegúrese de que las variables de entorno de Supabase estén configuradas en el entorno de despliegue.

### Notas

- El archivo `dist/_redirects` redirige todas las rutas a `index.html` para que la aplicación de una sola página (SPA) funcione correctamente, incluyendo las rutas públicas `/publico/tableros/:publicId` y `/publico/tableros/:publicId/embed`.
- Las Edge Functions se despliegan en Supabase y no requieren un servidor aparte.
- Las credenciales de Supabase se incluyen en el bundle del frontend (es seguro: la clave anon es pública y RLS protege los datos).

### Configuración de iframe para tableros públicos

Para permitir que los tableros públicos se incrusten en sitios externos autorizados por DINAC, configure las cabeceras de seguridad del hosting para permitir `frame-ancestors` desde los dominios autorizados. Por ejemplo, en Netlify (`netlify.toml`):

```toml
[[headers]]
  for = "/publico/tableros/*/embed"
  [headers.values]
    X-Frame-Options = "ALLOWALL"
    Content-Security-Policy = "frame-ancestors 'self' https://*.gob.sv https://dinac.gob.sv"
```

Si la infraestructura no permite configurar estas políticas automáticamente, documente los dominios autorizados en la configuración del servidor web.

---

## Organización

**Red Ciudadana** — Organización de la sociedad civil dedicada a la transparencia y participación ciudadana.

**DINAC** — Dirección Nacional de Compras Públicas.

---

## Aviso legal

Las banderas rojas generadas por este sistema son **indicadores preventivos** que permiten priorizar procesos para análisis y revisión. Su activación no constituye por sí sola evidencia de irregularidad, responsabilidad administrativa, fraude o corrupción. Requieren revisión técnica y documental por parte del personal competente.

Los tableros públicos contienen exclusivamente **estadísticas agregadas** aprobadas institucionalmente. No representan todas las compras nacionales salvo que la cobertura se encuentre acreditada.

Este sistema es de **uso interno**. Todas las acciones realizadas quedan registradas en la bitácora de auditoría.

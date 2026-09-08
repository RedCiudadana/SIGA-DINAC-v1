# SIGA-DINAC

## Sistema de Identificación y Gestión de Alertas

Plataforma de transparencia para la **Dirección Nacional de Compras Públicas (DINAC)**, desarrollada por **Red Ciudadana**. El sistema analiza automáticamente procesos de contratación pública mediante banderas rojas (red flags) para detectar riesgos e irregularidades potenciales.

---

## Tabla de contenidos

1. [Qué hace el sistema](#qué-hace-el-sistema)
2. [Tecnologías utilizadas](#tecnologías-utilizadas)
3. [Requisitos previos](#requisitos-previos)
4. [Instalación paso a paso](#instalación-paso-a-paso)
5. [Estructura del proyecto](#estructura-del-proyecto)
6. [Base de datos y migraciones](#base-de-datos-y-migraciones)
7. [Funciones de servidor (Edge Functions)](#funciones-de-servidor-edge-functions)
8. [Pantallas y funcionalidades](#pantallas-y-funcionalidades)
9. [Roles y permisos](#roles-y-permisos)
10. [Banderas rojas (indicadores)](#banderas-rojas-indicadores)
11. [Carga de datos](#carga-de-datos)
12. [Reportes](#reportes)
13. [Seguridad](#seguridad)
14. [Credenciales de demostración](#credenciales-de-demostración)
15. [Scripts disponibles](#scripts-disponibles)
16. [Despliegue](#despliegue)

---

## Qué hace el sistema

SIGA-DINAC es una aplicación web interna que permite a la DINAC:

- **Cargar datos** de procesos de contratación pública desde archivos CSV, Excel (.xlsx, .xls) o JSON.
- **Detectar automáticamente** riesgos mediante 5 banderas rojas (oferta única, plazo corto, contrato no publicado, métodos no competitivos, concentración comprador-proveedor).
- **Gestionar alertas** generadas por el sistema: asignarlas, revisarlas, comentarlas, adjuntar documentos y cambiar su estado.
- **Generar reportes** en PDF y Excel con filtros por bandera, estado, prioridad y fechas.
- **Auditar** todas las acciones del sistema en una bitácora inmutable.

Las banderas rojas son **indicadores preventivos**. Su activación no constituye por sí sola evidencia de irregularidad, fraude o corrupción. Requieren revisión técnica y documental.

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
│   ├── components/          # Componentes reutilizables
│   │   ├── AppNav.tsx       # Menú de navegación lateral
│   │   ├── AppShell.tsx     # Estructura principal (header + sidebar + contenido)
│   │   ├── HelpUI.tsx       # Tooltips y notas de ayuda
│   │   └── SessionTimeout.tsx # Cierre de sesión por inactividad
│   ├── context/
│   │   └── AuthContext.tsx  # Autenticación, sesión, permisos
│   ├── lib/
│   │   └── supabase.ts      # Cliente de Supabase
│   ├── screens/             # Pantallas del sistema
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardView.tsx
│   │   ├── AlertsView.tsx
│   │   ├── AlertDetailView.tsx
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
│   │   └── ConfigPanel.tsx
│   ├── types/
│   │   └── index.ts         # Tipos de TypeScript y constantes
│   ├── App.tsx              # Componente raíz
│   ├── main.tsx             # Punto de entrada
│   └── index.css            # Estilos globales (Tailwind)
├── supabase/
│   ├── config.toml          # Configuración de Edge Functions
│   ├── migrations/          # Migraciones de base de datos
│   └── functions/           # Edge Functions
├── package.json
├── vite.config.ts
├── tailwind.config.js
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

---

## Funciones de servidor (Edge Functions)

El sistema incluye 3 Edge Functions que se ejecutan en el servidor de Supabase (Deno runtime):

| Función | Qué hace |
|---|---|
| **create-user** | Crea un nuevo usuario en Supabase Auth y registra su perfil en la base de datos |
| **process-rules** | Ejecuta las reglas de análisis sobre los procesos cargados y genera las alertas correspondientes |
| **reset-database** | Elimina todos los procesos, alertas y cargas (conserva usuarios, roles, permisos y bitácora) |

Estas funciones tienen `verify_jwt = false` en `supabase/config.toml` para permitir su invocación.

---

## Pantallas y funcionalidades

### Tablero principal (Dashboard)
Vista general con métricas clave: total de procesos, alertas por bandera, distribución por prioridad y estado, montos adjudicados, y gráficos interactivos.

### Carga de datos
Permite cargar archivos **CSV, Excel (.xlsx, .xls) y JSON** con procesos de contratación. El sistema:
- Detecta automáticamente la versión de plantilla (V1/V2)
- Valida columnas obligatorias, tipos de datos y fechas
- Muestra una previsualización antes de confirmar
- Procesa los datos y genera alertas automáticamente

### Historial de cargas
Registro de todas las cargas realizadas con estado, cantidad de registros válidos/rechazados, alertas generadas y fecha.

### Alertas de riesgo
Listado de todas las alertas con filtros por bandera, estado, prioridad y fecha. Cada alerta se puede abrir para ver el detalle completo.

### Detalle de alerta
Vista individual de cada alerta con:
- Información del proceso asociado
- Detalle del cálculo y umbral aplicado
- Línea de tiempo de cambios de estado
- Comentarios internos
- Documentos adjuntos
- Asignación y cambio de estado

### Reportes
Generación de reportes internos en **PDF y Excel**. Incluye 5 tipos de reporte:
1. **Resumen ejecutivo** — métricas agregadas con KPIs
2. **Alertas por indicador** — agrupadas por bandera roja con desglose
3. **Alertas por institución** — distribución por institución compradora
4. **Detalle completo de alertas** — listado tabular completo
5. **Resumen de procesos** — consolidado de procesos de contratación

Cada reporte se puede **previsualizar** antes de descargar y aplicar **filtros** por bandera, estado, prioridad y rango de fechas. Los reportes en PDF incluyen el logo de Red Ciudadana, y todas las descargas quedan registradas en la bitácora.

### Configuración
Panel de administración con 7 secciones:
- **Indicadores** — Configuración de banderas rojas y sus umbrales
- **Catálogos** — Instituciones, proveedores, métodos de contratación
- **Usuarios** — Creación y gestión de cuentas de usuario
- **Roles y permisos** — Matriz de permisos por rol
- **Seguridad** — Políticas de contraseñas, sesiones, bloqueos
- **Bitácora** — Auditoría completa del sistema
- **Reseteo de datos** — Reinicio de la base de datos (conserva usuarios y configuración)

### Documentación y Tutoriales
Secciones de ayuda con documentación metodológica sobre las banderas rojas y tutoriales de uso del sistema.

### Perfil
Información del usuario, cambio de contraseña y datos personales.

---

## Roles y permisos

El sistema utiliza control de acceso basado en roles (RBAC) con los siguientes roles:

| Rol | Código | Acceso |
|---|---|---|
| **Super Administrador** | `super_admin` | Acceso completo a todas las funcionalidades |
| **Administrador General** | `admin_general` | Administración del sistema, usuarios, configuración, reportes |
| **Fiscalización** | `fiscalization` | Acceso limitado: tablero, alertas y reportes |

Los permisos se asignan por rol y controlan el acceso a cada pantalla y acción. Algunos permisos clave:

- `view_dashboard` — Ver el tablero principal
- `upload_data` — Cargar datos
- `view_alerts` — Ver alertas
- `export_reports` — Descargar reportes
- `manage_users` — Gestionar usuarios
- `configure_indicators` — Configurar banderas rojas
- `configure_security` — Configurar políticas de seguridad
- `view_audit_log` — Ver la bitácora
- `reset_database` — Resetear la base de datos

---

## Banderas rojas (indicadores)

El sistema analiza los procesos de contratación mediante 5 banderas roja:

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

El sistema detecta automáticamente la versión de plantilla. Las columnas principales incluyen:

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

- **PDF** — Disponible para los 5 tipos de reporte. Incluye logo de Red Ciudadana, encabezado con metadatos, tablas formateadas y pie de página con nota legal.
- **Excel** — Disponible para "Detalle completo de alertas" y "Alertas por indicador". Incluye hoja de información con metadatos y hojas de datos con columnas legibles.

### Filtros disponibles

Todos los reportes se pueden filtrar por:
- Bandera roja específica
- Estado de la alerta
- Prioridad (alta, media, baja)
- Rango de fechas (desde/hasta)

### Registro de descargas

Cada descarga de reporte queda registrada en la bitácora de auditoría con:
- Usuario que realizó la descarga
- Fecha y hora
- Tipo de reporte y formato
- Identificador único del reporte
- Filtros aplicados

---

## Seguridad

El sistema implementa múltiples capas de seguridad:

- **Autenticación** — Inicio de sesión con correo y contraseña a través de Supabase Auth
- **Row Level Security** — Todas las tablas tienen RLS habilitado; los usuarios solo acceden a los datos permitidos
- **Cierre por inactividad** — Sesión se cierra automáticamente tras un periodo configurable
- **Bloqueo por intentos fallidos** — Cuenta bloqueada temporalmente tras múltiples intentos fallidos
- **Políticas de contraseña** — Longitud mínima, mayúsculas, minúsculas, números y caracteres especiales configurables
- **Bitácora de auditoría** — Todas las acciones quedan registradas (usuario, fecha, IP, módulo, acción)
- **Clasificación de uso interno** — Todos los reportes incluyen la marca "Uso interno"

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

- El archivo `dist/_redirects` redirige todas las rutas a `index.html` para que la aplicación de una sola página (SPA) funcione correctamente.
- Las Edge Functions se despliegan en Supabase y no requieren un servidor aparte.
- Las credenciales de Supabase se incluyen en el bundle del frontend (es seguro: la clave anon es pública y RLS protege los datos).

---

## Organización

**Red Ciudadana** — Organización de la sociedad civil dedicada a la transparencia y participación ciudadana.

**DINAC** — Dirección Nacional de Compras Públicas.

---

## Aviso legal

Las banderas rojas generadas por este sistema son **indicadores preventivos** que permiten priorizar procesos para análisis y revisión. Su activación no constituye por sí sola evidencia de irregularidad, responsabilidad administrativa, fraude o corrupción. Requieren revisión técnica y documental por parte del personal competente.

Este sistema es de **uso interno**. Todas las acciones realizadas quedan registradas en la bitácora de auditoría.

# Informe de Auditoría de Seguridad

## A. Resumen ejecutivo

Se realizó una auditoría de seguridad integral sobre la plataforma SIA-DINAC, revisando el control de acceso a la base de datos (RLS, políticas, permisos por rol), las funciones de edge functions, la gestión de sesiones y la superficie de ataque del frontend.

### Hallazgos críticos encontrados y corregidos

1. **Sobre-concesión de permisos al rol anónimo (CRÍTICO)** — Todas las tablas públicas concedían CRUD completo (incluyendo `TRUNCATE`, `REFERENCES`, `TRIGGER`) al rol `anon`, a pesar de ser una aplicación con pantalla de inicio de sesión y sin políticas para `anon`. Se revocaron todos los permisos de `anon` excepto `SELECT` sobre `public_board_publications` (única tabla con política anónima legítima).

2. **Auto-escalada de privilegios en `user_profiles` (CRÍTICO)** — Cualquier usuario autenticado podía cambiar su propio `role_id`, `status`, `is_active`, `failed_attempts`, `locked_until`, `mfa_enabled`, `access_expires_at` y `force_password_change` mediante un UPDATE directo. Se implementó un trigger de base de datos (`guard_user_profile_privileged_cols`) que bloquea server-side cualquier cambio a columnas privilegiadas salvo que el usuario sea administrador. Un usuario puede limpiar `force_password_change=false` tras cambiar su contraseña, pero no activarlo ni tocar las demás columnas privilegiadas.

3. **Política de UPDATE en `alerts` demasiado débil (ALTO)** — La política permitía a cualquier usuario activo editar el estado y conclusión de cualquier alerta. Se reemplazó por `can_perform('manage_alerts') OR is_admin()`.

4. **Catálogos abiertos a todos los usuarios (ALTO)** — `procurement_method_catalog` y `contract_status_catalog` usaban `USING (true)` / `WITH CHECK (true)`, permitiendo a cualquier usuario autenticado insertar, modificar o eliminar catálogos. Se reemplazaron las políticas por `can_perform('manage_catalogs') OR is_admin()` para escritura, manteniendo SELECT para cuentas activas.

5. **Funciones SECURITY DEFINER ejecutables por anónimos (MEDIO)** — Las funciones helper (`can_perform`, `has_permission`, `is_admin`, `is_auditor`, `is_account_active`, `current_user_role_code`, `create_first_admin`) eran ejecutables por el rol `anon`, filtrando información de roles y permisos a usuarios no autenticados. Se revocó EXECUTE de `PUBLIC` y `anon`, y se re-grantó solo a `authenticated` las que el frontend necesita.

6. **Edge functions con `verify_jwt = false` y confianza en datos del cliente (CRÍTICO)** — Las tres edge functions (`create-user`, `reset-database`, `process-rules`) aceptaban cualquier llamada sin verificar el JWT, y confiaban en el `user_id` / `role_id` / `requester_id` enviado en el cuerpo por el cliente. Un atacante podía:
   - Llamar a `reset-database` con el `user_id` de un administrador real y eludir la verificación de permisos.
   - Llamar a `create-user` y crear usuarios con cualquier rol sin estar autenticado.
   - Llamar a `process-rules` y disparar procesamiento de reglas.

   Se activó `verify_jwt = true` en las tres funciones y se añadió verificación server-side del JWT (vía `/auth/v1/user`) para obtener la identidad real del usuario. Los campos `user_id`, `requester_id`, `user_email`, `user_role` del cuerpo ahora se ignoran. La función `create-user` además verifica server-side que el solicitante tenga el permiso `manage_users` antes de crear un usuario.

7. **Frontend enviaba la anon key como token de autorización (corregido)** — `UsersView` usaba `fetch` manual con `Authorization: Bearer <ANON_KEY>` para llamar a `create-user`. Tras activar `verify_jwt`, esto fallaría. Se migró a `supabase.functions.invoke`, que envía automáticamente el JWT de sesión del usuario autenticado.

### Mejoras implementadas

| Archivo / Componente | Cambio |
|---|---|
| Migración SQL `20261026210000` | Revoca permisos de `anon` en todas las tablas excepto `public_board_publications`; crea trigger `guard_user_profile_privileged_cols`; reemplaza políticas de catálogos y `alerts`; revoca EXECUTE de funciones SECURITY DEFINER a `anon`/`PUBLIC`. |
| Migración SQL `20261026211000` | Refina el trigger para permitir limpiar `force_password_change=false` tras cambio de contraseña. |
| `supabase/config.toml` | `verify_jwt = true` en las tres edge functions. |
| `supabase/functions/process-rules/index.ts` | Verifica identidad desde JWT; ignora `user_id` del cuerpo. |
| `supabase/functions/create-user/index.ts` | Verifica identidad desde JWT; ignora `requester_id`/`requester_email`; verifica permiso `manage_users` server-side. |
| `supabase/functions/reset-database/index.ts` | Verifica identidad desde JWT; ignora `user_id`/`user_email`/`user_role` del cuerpo. |
| `src/screens/UsersView.tsx` | Migra `fetch` manual a `supabase.functions.invoke`; elimina campos de identidad del cuerpo. |
| `src/screens/SystemResetView.tsx` | Elimina campos de identidad del cuerpo de la invocación. |
| `src/screens/UploadView.tsx` | Elimina `user_id` del cuerpo de la invocación a `process-rules`. |

## B. Verificación

- **Build de producción**: compila sin errores (`vite build` exitoso).
- **Edge functions**: las tres funciones desplegadas con `verify_jwt = true`.
- **Permisos de `anon`**: verificado que `anon` solo tiene `SELECT` sobre `public_board_publications`.
- **Políticas de `alerts`**: UPDATE ahora requiere `manage_alerts` o admin.
- **Políticas de catálogos**: escritura requiere `manage_catalogs` o admin; SELECT para cuentas activas.
- **Trigger de `user_profiles`**: bloquea cambios no autorizados a columnas privilegiadas.

## C. Aspectos pendientes / recomendaciones futuras

1. **Auditoría de indicadores y banderas rojas (no seguridad)** — El alcance completo del prompt solicitaba además validación de cálculos de indicadores, banderas rojas, gráficas y datos simulados. Esa revisión funcional queda pendiente; este informe cubre únicamente la capa de seguridad y control de acceso, que era la más crítica.

2. **Rate limiting en edge functions** — Considerar limitar la frecuencia de llamadas a `reset-database` y `create-user` para mitigar abuso.

3. **Rotación de la contraseña demo visible en `LoginScreen`** — El archivo `LoginScreen.tsx` contiene credenciales demo hardcodeadas (`admin@dinac-demo.gob.sv` / `SIA-DINAC-2024!`) en el código fuente. En producción deberían eliminarse o cargarse solo en entornos de demo.

4. **MFA real** — El campo `mfa_enabled` existe en `user_profiles` pero no hay integración con Supabase Auth MFA. Es informativo, no funcional.

5. **Logs de auditoría con IP real** — Los `audit_logs` registran `ip_address` pero el frontend no puede obtener la IP del cliente de forma fiable; considerar capturar la IP en las edge functions desde los headers de la petición.

6. **Pruebas automatizadas** — No existen pruebas unitarias ni de integración en el proyecto. Se recomienda añadir al menos pruebas para las reglas de banderas rojas (cálculos) y para las políticas RLS críticas.

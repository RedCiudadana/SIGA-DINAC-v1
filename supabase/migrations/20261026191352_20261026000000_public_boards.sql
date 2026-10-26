/*
# Tableros públicos y snapshots estadísticos aprobados

1. Objetivo
- Crea el módulo institucional para preparar, revisar, publicar y suspender tableros estadísticos públicos.
- Separa la administración privada de los datos que pueden consultar visitantes sin iniciar sesión.

2. Nuevas tablas
- `public_boards`: configuración privada del tablero, responsable, estado y trazabilidad.
- `public_board_versions`: versiones privadas con la selección de componentes y el snapshot calculado por el servidor.
- `public_board_publications`: copia pública independiente de una versión aprobada; contiene únicamente metadatos y agregados autorizados.

3. Seguridad y acceso
- Todas las tablas nuevas tienen RLS habilitado.
- Las tablas de administración sólo son accesibles a usuarios autenticados con los permisos correspondientes.
- La tabla pública sólo permite a `anon` y `authenticated` leer publicaciones con estado `published`.
- No se concede escritura directa al navegador sobre las tablas de administración ni sobre la tabla pública.
- Las funciones RPC SECURITY DEFINER validan permisos, estados y componentes permitidos antes de modificar datos.

4. Flujo institucional
- `prepare_public_board_version` calcula exclusivamente agregados de procesos activos y crea una versión en borrador.
- `submit_public_board_for_approval` cambia el tablero a pendiente de aprobación.
- `review_public_board_version` aprueba o devuelve la versión a borrador con observaciones.
- `publish_public_board` crea una copia pública independiente de la versión aprobada.
- `suspend_public_board` retira la publicación pública sin borrar el historial.

5. Componentes autorizados
- `total_processes`, `institutions`, `coverage_period`, `completeness`, `monthly_trend` y `status_distribution`.
- No se publican proveedores, procesos individuales, montos, alertas, banderas rojas, documentos, reglas ni parámetros reservados.
*/

CREATE TABLE IF NOT EXISTS public.public_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  responsible_unit text NOT NULL DEFAULT '',
  reference_period text NOT NULL DEFAULT '',
  data_source text NOT NULL DEFAULT '',
  cutoff_date date,
  methodology_note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'published', 'suspended', 'archived')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  published_at timestamptz,
  suspended_at timestamptz,
  rejection_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.public_board_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.public_boards(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'published', 'suspended')),
  selected_components jsonb NOT NULL DEFAULT '[]'::jsonb,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, version)
);

CREATE TABLE IF NOT EXISTS public.public_board_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  board_id uuid NOT NULL REFERENCES public.public_boards(id),
  version_id uuid NOT NULL REFERENCES public.public_board_versions(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  responsible_unit text NOT NULL DEFAULT '',
  source_label text NOT NULL DEFAULT '',
  reference_period text NOT NULL DEFAULT '',
  cutoff_date date,
  methodology_note text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'suspended')),
  published_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz
);

CREATE INDEX IF NOT EXISTS public_boards_status_idx ON public.public_boards(status);
CREATE INDEX IF NOT EXISTS public_board_versions_board_idx ON public.public_board_versions(board_id, version DESC);
CREATE INDEX IF NOT EXISTS public_board_publications_public_id_idx ON public.public_board_publications(public_id);
CREATE INDEX IF NOT EXISTS public_board_publications_status_idx ON public.public_board_publications(status);

ALTER TABLE public.public_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_board_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_board_publications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.public_boards FROM anon, authenticated;
REVOKE ALL ON public.public_board_versions FROM anon, authenticated;
REVOKE ALL ON public.public_board_publications FROM anon, authenticated;
GRANT SELECT ON public.public_boards TO authenticated;
GRANT SELECT ON public.public_board_versions TO authenticated;
GRANT SELECT ON public.public_board_publications TO anon, authenticated;

DROP POLICY IF EXISTS "manage_public_boards_read" ON public.public_boards;
CREATE POLICY "manage_public_boards_read" ON public.public_boards
  FOR SELECT TO authenticated
  USING (can_perform('manage_public_boards') OR can_perform('approve_public_boards'));

DROP POLICY IF EXISTS "manage_public_board_versions_read" ON public.public_board_versions;
CREATE POLICY "manage_public_board_versions_read" ON public.public_board_versions
  FOR SELECT TO authenticated
  USING (can_perform('manage_public_boards') OR can_perform('approve_public_boards'));

DROP POLICY IF EXISTS "published_publications_read" ON public.public_board_publications;
CREATE POLICY "published_publications_read" ON public.public_board_publications
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    OR (auth.uid() IS NOT NULL AND (can_perform('manage_public_boards') OR can_perform('approve_public_boards')))
  );

INSERT INTO public.permissions (code, name, description, module)
VALUES
  ('manage_public_boards', 'Preparar tableros públicos', 'Crear y preparar versiones de estadísticas para publicación.', 'publications'),
  ('approve_public_boards', 'Aprobar tableros públicos', 'Revisar, aprobar, publicar y suspender tableros públicos.', 'publications')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, module = EXCLUDED.module;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code IN ('admin_general', 'super_admin')
  AND p.code IN ('manage_public_boards', 'approve_public_boards')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code = 'fiscalization'
  AND p.code = 'manage_public_boards'
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.prepare_public_board_version(
  p_board_id uuid,
  p_selected_components jsonb,
  p_visible_title text,
  p_public_description text,
  p_methodology_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version_id uuid;
  v_version integer;
  v_selected jsonb := COALESCE(p_selected_components, '[]'::jsonb);
  v_process_count bigint;
  v_institution_count bigint;
  v_min_date date;
  v_max_date date;
  v_complete_pct numeric;
  v_monthly jsonb;
  v_statuses jsonb;
  v_snapshot jsonb;
BEGIN
  IF NOT can_perform('manage_public_boards') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public_boards WHERE id = p_board_id AND status IN ('draft', 'suspended')) THEN
    RAISE EXCEPTION 'Board is not editable';
  END IF;

  IF jsonb_typeof(v_selected) <> 'array' OR EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_selected) component
    WHERE component NOT IN ('total_processes', 'institutions', 'coverage_period', 'completeness', 'monthly_trend', 'status_distribution')
  ) THEN
    RAISE EXCEPTION 'Invalid public component';
  END IF;

  SELECT count(*), count(DISTINCT institution_name), min(COALESCE(publication_date::date, created_at::date)), max(COALESCE(publication_date::date, created_at::date))
  INTO v_process_count, v_institution_count, v_min_date, v_max_date
  FROM procurement_processes
  WHERE is_active = true;

  SELECT COALESCE(round(100.0 * sum(
    (CASE WHEN process_id IS NOT NULL AND process_id <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN institution_name IS NOT NULL AND institution_name <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN procurement_method IS NOT NULL AND procurement_method <> '' THEN 1 ELSE 0 END) +
    (CASE WHEN publication_date IS NOT NULL THEN 1 ELSE 0 END)
  ) / NULLIF(count(*) * 4, 0), 1), 0)
  INTO v_complete_pct
  FROM procurement_processes
  WHERE is_active = true;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('month', month_label, 'count', total) ORDER BY month_label), '[]'::jsonb)
  INTO v_monthly
  FROM (
    SELECT to_char(date_trunc('month', COALESCE(publication_date::timestamptz, created_at)), 'YYYY-MM') AS month_label, count(*) AS total
    FROM procurement_processes
    WHERE is_active = true
    GROUP BY 1
  ) monthly;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('status', status_label, 'count', total) ORDER BY status_label), '[]'::jsonb)
  INTO v_statuses
  FROM (
    SELECT COALESCE(NULLIF(contract_status, ''), 'Sin estado') AS status_label, count(*) AS total
    FROM procurement_processes
    WHERE is_active = true
    GROUP BY 1
  ) statuses;

  v_snapshot := jsonb_build_object(
    'total_processes', CASE WHEN v_selected ? 'total_processes' THEN to_jsonb(v_process_count) ELSE 'null'::jsonb END,
    'institutions', CASE WHEN v_selected ? 'institutions' THEN to_jsonb(v_institution_count) ELSE 'null'::jsonb END,
    'coverage_period', CASE WHEN v_selected ? 'coverage_period' THEN jsonb_build_object('from', v_min_date, 'to', v_max_date) ELSE 'null'::jsonb END,
    'completeness', CASE WHEN v_selected ? 'completeness' THEN to_jsonb(v_complete_pct) ELSE 'null'::jsonb END,
    'monthly_trend', CASE WHEN v_selected ? 'monthly_trend' THEN v_monthly ELSE '[]'::jsonb END,
    'status_distribution', CASE WHEN v_selected ? 'status_distribution' THEN v_statuses ELSE '[]'::jsonb END
  );

  SELECT COALESCE(max(version), 0) + 1 INTO v_version FROM public_board_versions WHERE board_id = p_board_id;

  INSERT INTO public_board_versions (board_id, version, status, selected_components, content, snapshot)
  VALUES (
    p_board_id,
    v_version,
    'draft',
    v_selected,
    jsonb_build_object('title', COALESCE(NULLIF(trim(p_visible_title), ''), 'Estadísticas generales de compras públicas'), 'description', COALESCE(p_public_description, ''), 'methodology_note', COALESCE(p_methodology_note, '')),
    v_snapshot
  )
  RETURNING id INTO v_version_id;

  UPDATE public_boards
  SET updated_at = now(), rejection_note = NULL
  WHERE id = p_board_id;

  RETURN v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_board_for_approval(p_board_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_perform('manage_public_boards') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public_board_versions WHERE board_id = p_board_id AND status = 'draft') THEN RAISE EXCEPTION 'No draft version'; END IF;
  UPDATE public_board_versions SET status = 'pending_approval' WHERE board_id = p_board_id AND status = 'draft';
  UPDATE public_boards SET status = 'pending_approval', updated_at = now() WHERE id = p_board_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_public_board_version(p_version_id uuid, p_decision text, p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_board_id uuid;
BEGIN
  IF NOT can_perform('approve_public_boards') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT board_id INTO v_board_id FROM public_board_versions WHERE id = p_version_id AND status = 'pending_approval';
  IF v_board_id IS NULL THEN RAISE EXCEPTION 'Version is not pending approval'; END IF;
  UPDATE public_board_versions
  SET status = p_decision, approved_by = CASE WHEN p_decision = 'approved' THEN auth.uid() ELSE NULL END, approved_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END, review_note = COALESCE(p_note, '')
  WHERE id = p_version_id;
  UPDATE public_boards
  SET status = CASE WHEN p_decision = 'approved' THEN 'approved' ELSE 'draft' END, approved_by = CASE WHEN p_decision = 'approved' THEN auth.uid() ELSE NULL END, approved_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END, rejection_note = CASE WHEN p_decision = 'rejected' THEN COALESCE(p_note, '') ELSE NULL END, updated_at = now()
  WHERE id = v_board_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_public_board(p_version_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board public_boards%ROWTYPE;
  v_version public_board_versions%ROWTYPE;
  v_public_id text;
BEGIN
  IF NOT can_perform('approve_public_boards') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_version FROM public_board_versions WHERE id = p_version_id AND status = 'approved';
  IF v_version.id IS NULL THEN RAISE EXCEPTION 'Version is not approved'; END IF;
  SELECT * INTO v_board FROM public_boards WHERE id = v_version.board_id;
  v_public_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

  UPDATE public_board_publications SET status = 'suspended', suspended_at = now() WHERE board_id = v_board.id AND status = 'published';
  INSERT INTO public_board_publications (public_id, board_id, version_id, title, description, responsible_unit, source_label, reference_period, cutoff_date, methodology_note, snapshot)
  VALUES (v_public_id, v_board.id, v_version.id, v_version.content->>'title', v_version.content->>'description', v_board.responsible_unit, v_board.data_source, v_board.reference_period, v_board.cutoff_date, v_version.content->>'methodology_note', v_version.snapshot);
  UPDATE public_board_versions SET status = 'published' WHERE id = v_version.id;
  UPDATE public_boards SET status = 'published', published_at = now(), updated_at = now() WHERE id = v_board.id;
  RETURN v_public_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.suspend_public_board(p_board_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_perform('approve_public_boards') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public_board_publications SET status = 'suspended', suspended_at = now() WHERE board_id = p_board_id AND status = 'published';
  UPDATE public_boards SET status = 'suspended', suspended_at = now(), updated_at = now() WHERE id = p_board_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_public_board_version(uuid, jsonb, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_public_board_for_approval(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_public_board_version(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.publish_public_board(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.suspend_public_board(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_public_board_version(uuid, jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_board_for_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_public_board_version(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_public_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_public_board(uuid) TO authenticated;

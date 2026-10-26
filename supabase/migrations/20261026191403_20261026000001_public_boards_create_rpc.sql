/*
# Crear tableros públicos mediante una operación autorizada

1. Cambio
- Añade una función RPC para crear la configuración privada inicial de un tablero.

2. Seguridad
- Sólo usuarios autenticados con `manage_public_boards` pueden crear tableros.
- El creador se obtiene de `auth.uid()` y no se acepta desde el navegador.
- La función usa un `search_path` fijo y no se expone a `anon`.
*/

CREATE OR REPLACE FUNCTION public.create_public_board(
  p_title text,
  p_description text,
  p_responsible_unit text,
  p_reference_period text,
  p_data_source text,
  p_cutoff_date date,
  p_methodology_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_board_id uuid;
BEGIN
  IF NOT can_perform('manage_public_boards') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NULLIF(trim(COALESCE(p_title, '')), '') IS NULL THEN RAISE EXCEPTION 'Title is required'; END IF;

  INSERT INTO public_boards (title, description, responsible_unit, reference_period, data_source, cutoff_date, methodology_note)
  VALUES (trim(p_title), COALESCE(p_description, ''), COALESCE(p_responsible_unit, ''), COALESCE(p_reference_period, ''), COALESCE(p_data_source, ''), p_cutoff_date, COALESCE(p_methodology_note, ''))
  RETURNING id INTO v_board_id;
  RETURN v_board_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_public_board(text, text, text, text, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_public_board(text, text, text, text, text, date, text) TO authenticated;

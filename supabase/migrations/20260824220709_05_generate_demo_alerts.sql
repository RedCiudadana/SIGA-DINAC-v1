/*
# SIA-DINAC: Generar alertas para datos de demostración
*/
DO $$
DECLARE
  demo_upload_id uuid;
  ind1_id uuid; ind2_id uuid; ind3_id uuid; ind4_id uuid; ind5_id uuid;
  admin_user_id uuid;
  alert_counter integer := 0;
  alert_code_val text;
  alert_id_var uuid;
  inst_count integer;
  inst_total numeric(18,2);
  count_pct numeric; amount_pct numeric;
  nc_count_pct numeric; nc_amount_pct numeric;
  span_days integer;
  violations text; violation_count integer;
  alert_priority text; proc_priority text;
  alert_cnt integer;
  rec record; proc_rec record;
BEGIN
  SELECT id INTO demo_upload_id FROM data_uploads WHERE is_demo = true LIMIT 1;
  SELECT id INTO ind1_id FROM indicator_definitions WHERE code = 'single_bidder';
  SELECT id INTO ind2_id FROM indicator_definitions WHERE code = 'award_concentration';
  SELECT id INTO ind3_id FROM indicator_definitions WHERE code = 'non_competitive_methods';
  SELECT id INTO ind4_id FROM indicator_definitions WHERE code = 'contract_splitting';
  SELECT id INTO ind5_id FROM indicator_definitions WHERE code = 'short_timelines';
  SELECT user_id INTO admin_user_id FROM user_profiles WHERE role_id = (SELECT id FROM roles WHERE code = 'admin_general') LIMIT 1;
  IF demo_upload_id IS NULL THEN RETURN; END IF;

  DELETE FROM alert_processes WHERE alert_id IN (SELECT id FROM alerts WHERE is_demo = true);
  DELETE FROM alerts WHERE is_demo = true;

  -- Ind1: Único oferente
  FOR rec IN SELECT * FROM procurement_processes
    WHERE upload_id = demo_upload_id AND is_active = true AND number_of_bidders = 1
      AND UPPER(procurement_method) IN ('LP','LC','LI','EB')
  LOOP
    alert_counter := alert_counter + 1;
    alert_code_val := 'ALT-2024-' || lpad(alert_counter::text, 5, '0');
    INSERT INTO alerts (alert_code, indicator_id, indicator_code, upload_id, title, description, calculation_detail, threshold_applied, data_used, priority, status, is_demo, created_by)
    VALUES (alert_code_val, ind1_id, 'single_bidder', demo_upload_id,
      'Único oferente en proceso ' || rec.process_id,
      'El proceso ' || rec.process_id || ' bajo modalidad competitiva ' || rec.procurement_method || ' registró ' || rec.number_of_bidders || ' oferente(s). Se requiere revisión técnica.',
      'Modalidad: ' || rec.procurement_method || ', Oferentes: ' || rec.number_of_bidders,
      'Número de oferentes ≤ 1 en modalidades competitivas (LP, LC, LI, EB)',
      jsonb_build_object('process_id', rec.process_id, 'procurement_method', rec.procurement_method, 'number_of_bidders', rec.number_of_bidders, 'awarded_amount', rec.awarded_amount),
      'low', 'new', true, admin_user_id)
    RETURNING id INTO alert_id_var;
    INSERT INTO alert_processes (alert_id, process_id) VALUES (alert_id_var, rec.id);
  END LOOP;

  -- Ind2: Concentración
  FOR rec IN SELECT institution_name, supplier_name, supplier_id_code,
      COUNT(*) as cnt, SUM(awarded_amount) as total_amt
    FROM procurement_processes WHERE upload_id = demo_upload_id AND is_active = true
    GROUP BY institution_name, supplier_name, supplier_id_code HAVING COUNT(*) >= 3
  LOOP
    SELECT COUNT(*), COALESCE(SUM(awarded_amount),0) INTO inst_count, inst_total
    FROM procurement_processes WHERE upload_id = demo_upload_id AND institution_name = rec.institution_name;
    count_pct := (rec.cnt::numeric / inst_count) * 100;
    amount_pct := (rec.total_amt / NULLIF(inst_total, 0)) * 100;
    IF count_pct >= 30 OR amount_pct >= 40 THEN
      alert_counter := alert_counter + 1;
      alert_code_val := 'ALT-2024-' || lpad(alert_counter::text, 5, '0');
      alert_priority := CASE WHEN count_pct >= 30 AND amount_pct >= 40 THEN 'high' ELSE 'medium' END;
      INSERT INTO alerts (alert_code, indicator_id, indicator_code, upload_id, title, description, calculation_detail, threshold_applied, data_used, priority, status, is_demo, created_by)
      VALUES (alert_code_val, ind2_id, 'award_concentration', demo_upload_id,
        'Concentración de adjudicaciones: ' || rec.supplier_name || ' en ' || rec.institution_name,
        'El proveedor ' || rec.supplier_name || ' concentra el ' || round(count_pct,1) || '% de los contratos y el ' || round(amount_pct,1) || '% del monto en ' || rec.institution_name || '. Se requiere revisión técnica.',
        'Contratos: ' || rec.cnt || ' de ' || inst_count || ' (' || round(count_pct,1) || '%), Monto: $' || round(rec.total_amt,2),
        '≥ 30% de contratos o ≥ 40% de monto (mín. 3 contratos)',
        jsonb_build_object('institution', rec.institution_name, 'supplier', rec.supplier_name, 'contract_count', rec.cnt, 'total_amount', rec.total_amt, 'count_pct', round(count_pct,1), 'amount_pct', round(amount_pct,1)),
        alert_priority, 'new', true, admin_user_id)
      RETURNING id INTO alert_id_var;
      FOR proc_rec IN SELECT id FROM procurement_processes
        WHERE upload_id = demo_upload_id AND supplier_id_code = rec.supplier_id_code AND institution_name = rec.institution_name
      LOOP
        INSERT INTO alert_processes (alert_id, process_id) VALUES (alert_id_var, proc_rec.id);
      END LOOP;
    END IF;
  END LOOP;

  -- Ind3: Modalidades no competitivas
  FOR rec IN SELECT institution_name,
      COUNT(*) FILTER (WHERE UPPER(procurement_method) IN ('CD','CP','CE','CON')) as non_comp_count,
      COUNT(*) as total_count,
      SUM(awarded_amount) FILTER (WHERE UPPER(procurement_method) IN ('CD','CP','CE','CON')) as non_comp_amt,
      SUM(awarded_amount) as total_amt
    FROM procurement_processes WHERE upload_id = demo_upload_id AND is_active = true
    GROUP BY institution_name
  LOOP
    IF rec.non_comp_count > 0 THEN
      nc_count_pct := (rec.non_comp_count::numeric / rec.total_count) * 100;
      nc_amount_pct := CASE WHEN rec.total_amt > 0 THEN (rec.non_comp_amt / rec.total_amt) * 100 ELSE 0 END;
      IF nc_count_pct >= 20 OR nc_amount_pct >= 20 THEN
        alert_counter := alert_counter + 1;
        alert_code_val := 'ALT-2024-' || lpad(alert_counter::text, 5, '0');
        alert_priority := CASE WHEN nc_count_pct >= 20 AND nc_amount_pct >= 20 THEN 'high' ELSE 'medium' END;
        INSERT INTO alerts (alert_code, indicator_id, indicator_code, upload_id, title, description, calculation_detail, threshold_applied, data_used, priority, status, is_demo, created_by)
        VALUES (alert_code_val, ind3_id, 'non_competitive_methods', demo_upload_id,
          'Uso recurrente de modalidades no competitivas en ' || rec.institution_name,
          'El ' || round(nc_count_pct,1) || '% de los procesos y el ' || round(nc_amount_pct,1) || '% del monto en ' || rec.institution_name || ' se adjudicó mediante modalidades no competitivas. Se requiere revisión técnica.',
          'Procesos no competitivos: ' || rec.non_comp_count || ' de ' || rec.total_count || ' (' || round(nc_count_pct,1) || '%)',
          '≥ 20% de procesos o ≥ 20% de monto en modalidades no competitivas (CD, CP, CE, CON)',
          jsonb_build_object('institution', rec.institution_name, 'non_competitive_count', rec.non_comp_count, 'total_count', rec.total_count, 'count_pct', round(nc_count_pct,1), 'amount_pct', round(nc_amount_pct,1)),
          alert_priority, 'new', true, admin_user_id)
        RETURNING id INTO alert_id_var;
        FOR proc_rec IN SELECT id FROM procurement_processes
          WHERE upload_id = demo_upload_id AND institution_name = rec.institution_name
            AND UPPER(procurement_method) IN ('CD','CP','CE','CON')
        LOOP
          INSERT INTO alert_processes (alert_id, process_id) VALUES (alert_id_var, proc_rec.id);
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  -- Ind4: Posible fraccionamiento
  FOR rec IN SELECT institution_name, supplier_id_code, procurement_category, supplier_name,
      COUNT(*) as cnt, SUM(awarded_amount) as total_amt,
      MIN(award_date) as first_date, MAX(award_date) as last_date
    FROM procurement_processes WHERE upload_id = demo_upload_id AND is_active = true AND award_date IS NOT NULL
    GROUP BY institution_name, supplier_id_code, procurement_category, supplier_name HAVING COUNT(*) >= 3
  LOOP
    span_days := rec.last_date - rec.first_date;
    IF span_days <= 60 AND rec.total_amt > 100000 THEN
      alert_counter := alert_counter + 1;
      alert_code_val := 'ALT-2024-' || lpad(alert_counter::text, 5, '0');
      INSERT INTO alerts (alert_code, indicator_id, indicator_code, upload_id, title, description, calculation_detail, threshold_applied, data_used, priority, status, is_demo, created_by)
      VALUES (alert_code_val, ind4_id, 'contract_splitting', demo_upload_id,
        'Posible patrón de contrataciones que requiere revisión en ' || rec.institution_name,
        'Se identificó un grupo de ' || rec.cnt || ' procesos en ' || rec.institution_name || ' con el proveedor ' || rec.supplier_name || ', categoría ' || rec.procurement_category || ', fechas dentro de ' || span_days || ' días. La suma acumulada ($' || round(rec.total_amt,2) || ') supera el umbral. Esta alerta requiere revisión técnica y documental.',
        'Procesos: ' || rec.cnt || ', Suma: $' || round(rec.total_amt,2) || ', Umbral: $100000, Ventana: ' || span_days || ' días',
        'Suma > $100000, ventana ≤ 60 días, mínimo 3 procesos, proximidad 85%',
        jsonb_build_object('institution', rec.institution_name, 'supplier', rec.supplier_name, 'category', rec.procurement_category, 'process_count', rec.cnt, 'total_amount', rec.total_amt, 'span_days', span_days),
        'high', 'new', true, admin_user_id)
      RETURNING id INTO alert_id_var;
      FOR proc_rec IN SELECT id FROM procurement_processes
        WHERE upload_id = demo_upload_id AND institution_name = rec.institution_name
          AND supplier_id_code = rec.supplier_id_code AND procurement_category = rec.procurement_category
      LOOP
        INSERT INTO alert_processes (alert_id, process_id) VALUES (alert_id_var, proc_rec.id);
      END LOOP;
    END IF;
  END LOOP;

  -- Ind5: Plazos cortos
  FOR rec IN SELECT *,
      (bid_deadline - publication_date) as pub_to_bid,
      (award_date - bid_deadline) as bid_to_award,
      (award_date - publication_date) as total_days
    FROM procurement_processes WHERE upload_id = demo_upload_id AND is_active = true
      AND publication_date IS NOT NULL AND bid_deadline IS NOT NULL AND award_date IS NOT NULL
  LOOP
    violations := '';
    IF rec.pub_to_bid < 7 THEN violations := 'Publicación a recepción: ' || rec.pub_to_bid || ' días (mínimo 7)'; END IF;
    IF rec.bid_to_award < 3 THEN violations := CASE WHEN violations != '' THEN violations || '; ' ELSE '' END || 'Recepción a adjudicación: ' || rec.bid_to_award || ' días (mínimo 3)'; END IF;
    IF rec.total_days < 10 THEN violations := CASE WHEN violations != '' THEN violations || '; ' ELSE '' END || 'Duración total: ' || rec.total_days || ' días (mínimo 10)'; END IF;
    IF violations != '' THEN
      alert_counter := alert_counter + 1;
      alert_code_val := 'ALT-2024-' || lpad(alert_counter::text, 5, '0');
      violation_count := (length(violations) - length(replace(violations, ';', ''))) + 1;
      alert_priority := CASE WHEN violation_count >= 2 THEN 'medium' ELSE 'low' END;
      INSERT INTO alerts (alert_code, indicator_id, indicator_code, upload_id, title, description, calculation_detail, threshold_applied, data_used, priority, status, is_demo, created_by)
      VALUES (alert_code_val, ind5_id, 'short_timelines', demo_upload_id,
        'Plazos atípicamente cortos en proceso ' || rec.process_id,
        'El proceso ' || rec.process_id || ' presenta plazos inferiores a los parámetros: ' || violations || '. Se requiere revisión técnica.',
        'Pub→Bid: ' || rec.pub_to_bid || 'd, Bid→Award: ' || rec.bid_to_award || 'd, Total: ' || rec.total_days || 'd',
        'Pub→Bid ≥ 7d, Bid→Award ≥ 3d, Total ≥ 10d',
        jsonb_build_object('process_id', rec.process_id, 'pub_to_bid_days', rec.pub_to_bid, 'bid_to_award_days', rec.bid_to_award, 'total_days', rec.total_days, 'violations', violations),
        alert_priority, 'new', true, admin_user_id)
      RETURNING id INTO alert_id_var;
      INSERT INTO alert_processes (alert_id, process_id) VALUES (alert_id_var, rec.id);
    END IF;
  END LOOP;

  -- Actualizar procesos
  FOR proc_rec IN SELECT id FROM procurement_processes WHERE upload_id = demo_upload_id LOOP
    SELECT COUNT(DISTINCT a.indicator_code) INTO alert_cnt
    FROM alert_processes ap JOIN alerts a ON a.id = ap.alert_id
    WHERE ap.process_id = proc_rec.id AND a.is_deleted = false;
    proc_priority := CASE WHEN alert_cnt >= 3 THEN 'high' WHEN alert_cnt = 2 THEN 'medium' WHEN alert_cnt = 1 THEN 'low' ELSE NULL END;
    UPDATE procurement_processes SET alert_count = alert_cnt, priority = proc_priority WHERE id = proc_rec.id;
  END LOOP;

  UPDATE data_uploads SET alerts_generated = (SELECT COUNT(*) FROM alerts WHERE upload_id = demo_upload_id AND is_demo = true),
    status = 'completed', processing_progress = 100 WHERE id = demo_upload_id;
END $$;

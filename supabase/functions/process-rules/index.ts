import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcRecord {
  id: string;
  process_id: string;
  institution_code: string | null;
  institution_name: string | null;
  purchasing_unit: string | null;
  procurement_method: string | null;
  procurement_category: string | null;
  procurement_description: string | null;
  publication_date: string | null;
  bid_deadline: string | null;
  award_date: string | null;
  supplier_name: string | null;
  supplier_id_code: string | null;
  number_of_bidders: number | null;
  number_of_valid_bids: number | null;
  estimated_amount: number | null;
  awarded_amount: number | null;
  currency: string;
  contract_status: string | null;
  contract_document_published: boolean | null;
  contract_document_type: string | null;
  contract_document_url: string | null;
  contract_document_publication_date: string | null;
  amendment_amount: number | null;
  is_demo: boolean;
  confidentiality_level: string;
}

interface MethodCatalogEntry {
  code: string;
  name: string;
  classification: string;
  is_competitive: boolean;
  minimum_bid_period_days: number;
  count_for_r013: boolean;
  minimum_valid_bids_reference: number;
}

interface StatusCatalogEntry {
  source_value: string;
  normalized_value: string;
  evaluate_r063: boolean;
}

function daysBetween(d1: string | null, d2: string | null): number | null {
  if (!d1 || !d2) return null;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  const diff = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getParam(params: { param_key: string; param_value: string }[], key: string, defaultVal: string): string {
  const p = params.find((p) => p.param_key === key);
  return p ? p.param_value : defaultVal;
}

function getParamNumber(params: { param_key: string; param_value: string }[], key: string, defaultVal: number): number {
  const p = params.find((p) => p.param_key === key);
  return p ? parseFloat(p.param_value) : defaultVal;
}

function getParamBool(params: { param_key: string; param_value: string }[], key: string, defaultVal: boolean): boolean {
  const p = params.find((p) => p.param_key === key);
  if (!p) return defaultVal;
  const v = p.param_value.toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'sí' || v === 'si';
}

async function getUserFromJwt(req: Request): Promise<{ id: string; email: string | null } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const url = `${supabaseUrl}/auth/v1/user`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
    },
  });
  if (!resp.ok) return null;
  const user = await resp.json();
  if (!user?.id) return null;
  return { id: user.id as string, email: user.email ?? null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authUser = await getUserFromJwt(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "No autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { upload_id } = await req.json();
    const user_id = authUser.id;

    if (!upload_id) {
      return new Response(
        JSON.stringify({ error: "upload_id es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get upload
    const { data: upload, error: uploadError } = await supabase
      .from("data_uploads").select("*").eq("id", upload_id).single();

    if (uploadError || !upload) {
      return new Response(
        JSON.stringify({ error: "Carga no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("data_uploads")
      .update({ status: "processing", processing_progress: 10, processed_by: user_id })
      .eq("id", upload_id);

    // 2. Get processes for this upload
    const { data: processes, error: procError } = await supabase
      .from("procurement_processes")
      .select("*")
      .eq("upload_id", upload_id)
      .eq("is_active", true);

    if (procError || !processes) {
      await supabase.from("data_uploads").update({ status: "failed", processing_progress: 0 }).eq("id", upload_id);
      return new Response(
        JSON.stringify({ error: "Error al obtener procesos" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (processes.length === 0) {
      await supabase.from("data_uploads").update({
        status: "completed", processing_progress: 100, alerts_generated: 0,
        processed_at: new Date().toISOString(), processed_by: user_id,
      }).eq("id", upload_id);
      return new Response(
        JSON.stringify({ success: true, alerts_generated: 0, flag_counts: {}, total_processes: 0, coverage: {} }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get indicator definitions and parameters
    const { data: indicators } = await supabase
      .from("indicator_definitions").select("*").eq("is_active", true);

    if (!indicators || indicators.length === 0) {
      await supabase.from("data_uploads").update({ status: "failed", processing_progress: 0 }).eq("id", upload_id);
      return new Response(
        JSON.stringify({ error: "No hay indicadores activos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const indicatorIds = indicators.map((i) => i.id);
    const { data: allParams } = await supabase
      .from("indicator_parameters")
      .select("indicator_id, param_key, param_value")
      .in("indicator_id", indicatorIds)
      .eq("is_active", true);

    const indParams: Record<string, { param_key: string; param_value: string }[]> = {};
    for (const ind of indicators) {
      indParams[ind.code] = (allParams || []).filter((p) => p.indicator_id === ind.id);
    }

    // 4. Get catalogs
    const { data: methodCatalogData } = await supabase
      .from("procurement_method_catalog").select("*").eq("is_active", true);
    const methodCatalog: Record<string, MethodCatalogEntry> = {};
    for (const m of (methodCatalogData || [])) {
      methodCatalog[m.code.toUpperCase()] = m as MethodCatalogEntry;
    }

    const { data: statusCatalogData } = await supabase
      .from("contract_status_catalog").select("*").eq("is_active", true);
    const statusCatalog: Record<string, StatusCatalogEntry> = {};
    for (const s of (statusCatalogData || [])) {
      statusCatalog[s.source_value.toLowerCase().trim()] = s as StatusCatalogEntry;
    }

    await supabase.from("data_uploads").update({ processing_progress: 30 }).eq("id", upload_id);

    const procs = processes as ProcRecord[];
    const alertsToInsert: {
      alert_code: string; indicator_id: string; indicator_code: string; upload_id: string;
      title: string; description: string; calculation_detail: string; threshold_applied: string;
      data_used: Record<string, unknown>; priority: string; status: string; is_demo: boolean;
      created_by: string; alert_level: string; quality_note: string | null;
    }[] = [];
    const alertProcessLinks: { alert: typeof alertsToInsert[0]; processIds: string[] }[] = [];

    // ============================================================
    // R018 — Oferta única (process level)
    // ============================================================
    const indR018 = indicators.find((i) => i.code === "R018");
    if (indR018) {
      const useValidBids = getParamBool(indParams["R018"] || [], "use_valid_bids", true);

      for (const proc of procs) {
        const method = methodCatalog[(proc.procurement_method || "").toUpperCase()];
        if (!method || !method.is_competitive) continue;

        const validBids = proc.number_of_valid_bids;
        const bidders = proc.number_of_bidders;
        let triggered = false;
        let qualityNote: string | null = null;
        let bidsValue: number | null = null;
        let bidsLabel = "";

        if (useValidBids && validBids !== null && validBids !== undefined) {
          bidsValue = validBids;
          bidsLabel = "ofertas válidas";
          triggered = validBids === 1;
        } else if (bidders !== null && bidders !== undefined) {
          bidsValue = bidders;
          bidsLabel = "participantes (estimación)";
          triggered = bidders === 1;
          qualityNote = "Cálculo basado en número de participantes. Se recomienda usar number_of_valid_bids para mayor precisión.";
        } else {
          continue; // Not evaluable
        }

        if (triggered) {
          const alert = {
            alert_code: "",
            indicator_id: indR018.id,
            indicator_code: "R018",
            upload_id,
            title: `R018 — Oferta única en proceso ${proc.process_id}`,
            description: `Se recibió una única oferta válida en el proceso ${proc.process_id} bajo modalidad competitiva (${method.name}). Se requiere revisión técnica para verificar las causas de la baja participación.`,
            calculation_detail: `Ofertas participantes: ${bidders ?? "N/D"}, Ofertas válidas: ${validBids ?? "N/D"}, Método: ${proc.procurement_method} (${method.name}), Modalidad competitiva: Sí`,
            threshold_applied: `number_of_valid_bids = 1 en método competitivo (${proc.procurement_method})`,
            data_used: {
              process_id: proc.process_id,
              procurement_method: proc.procurement_method,
              number_of_bidders: bidders,
              number_of_valid_bids: validBids,
              bids_label: bidsLabel,
              awarded_amount: proc.awarded_amount,
            },
            priority: "medium",
            status: "new",
            is_demo: upload.is_demo,
            created_by: user_id,
            alert_level: "process",
            quality_note: qualityNote,
          };
          alertsToInsert.push(alert);
          alertProcessLinks.push({ alert, processIds: [proc.id] });
        }
      }
    }

    // ============================================================
    // R003 — Plazo corto para presentar ofertas (process level)
    // ============================================================
    const indR003 = indicators.find((i) => i.code === "R003");
    if (indR003) {
      for (const proc of procs) {
        if (!proc.publication_date || !proc.bid_deadline) continue;

        const method = methodCatalog[(proc.procurement_method || "").toUpperCase()];
        if (!method) continue;

        const minDays = method.minimum_bid_period_days;
        if (minDays <= 0) continue; // Method doesn't have a minimum

        const observedDays = daysBetween(proc.publication_date, proc.bid_deadline);
        if (observedDays === null) continue;

        if (observedDays < minDays) {
          const diff = observedDays - minDays;
          const alert = {
            alert_code: "",
            indicator_id: indR003.id,
            indicator_code: "R003",
            upload_id,
            title: `R003 — Plazo corto en proceso ${proc.process_id}`,
            description: `El plazo disponible para presentar ofertas fue de ${observedDays} días, inferior al parámetro configurado de ${minDays} días para la modalidad ${method.name}. Se requiere revisión técnica.`,
            calculation_detail: `Plazo observado: ${observedDays} días, Referencia configurada: ${minDays} días, Diferencia: ${diff} días, Método: ${proc.procurement_method} (${method.name})`,
            threshold_applied: `bid_deadline - publication_date < ${minDays} días (método ${proc.procurement_method})`,
            data_used: {
              process_id: proc.process_id,
              procurement_method: proc.procurement_method,
              publication_date: proc.publication_date,
              bid_deadline: proc.bid_deadline,
              observed_days: observedDays,
              reference_days: minDays,
              difference: diff,
            },
            priority: "medium",
            status: "new",
            is_demo: upload.is_demo,
            created_by: user_id,
            alert_level: "process",
            quality_note: null,
          };
          alertsToInsert.push(alert);
          alertProcessLinks.push({ alert, processIds: [proc.id] });
        }
      }
    }

    // ============================================================
    // R063 — Contrato o documento contractual no publicado (process level)
    // ============================================================
    const indR063 = indicators.find((i) => i.code === "R063");
    if (indR063) {
      const graceDays = getParamNumber(indParams["R063"] || [], "grace_period_days", 5);
      const now = new Date();

      for (const proc of procs) {
        if (!proc.award_date) continue;

        // Check if contract status makes R063 evaluable
        const statusKey = (proc.contract_status || "").toLowerCase().trim();
        const statusEntry = statusCatalog[statusKey];
        if (!statusEntry || !statusEntry.evaluate_r063) continue;

        // Check grace period
        const daysSinceAward = daysBetween(proc.award_date, now.toISOString());
        if (daysSinceAward === null || daysSinceAward < graceDays) continue;

        // Evaluate
        if (proc.contract_document_published === false || proc.contract_document_published === null) {
          const isNotEvaluable = proc.contract_document_published === null;
          if (isNotEvaluable) continue; // Not evaluable, skip

          const alert = {
            alert_code: "",
            indicator_id: indR063.id,
            indicator_code: "R063",
            upload_id,
            title: `R063 — Documento contractual no publicado en proceso ${proc.process_id}`,
            description: `No se registró documento contractual publicado para el proceso ${proc.process_id}. La adjudicación tiene ${daysSinceAward} días y el estado "${proc.contract_status}" requiere documentación contractual.`,
            calculation_detail: `Fecha de adjudicación: ${proc.award_date}, Días transcurridos: ${daysSinceAward}, Período de gracia configurado: ${graceDays} días, Estado contractual: ${proc.contract_status} (normalizado: ${statusEntry.normalized_value}), Documento publicado: No`,
            threshold_applied: `award_date + ${graceDays} días < hoy AND contract_document_published = false AND estado evaluable`,
            data_used: {
              process_id: proc.process_id,
              award_date: proc.award_date,
              days_since_award: daysSinceAward,
              grace_period_days: graceDays,
              contract_status: proc.contract_status,
              normalized_status: statusEntry.normalized_value,
              contract_document_published: false,
              contract_document_type: proc.contract_document_type,
              contract_document_url: proc.contract_document_url,
            },
            priority: "medium",
            status: "new",
            is_demo: upload.is_demo,
            created_by: user_id,
            alert_level: "process",
            quality_note: null,
          };
          alertsToInsert.push(alert);
          alertProcessLinks.push({ alert, processIds: [proc.id] });
        }
      }
    }

    // ============================================================
    // R013 — Alto uso de métodos no competitivos (institution level)
    // ============================================================
    const indR013 = indicators.find((i) => i.code === "R013");
    if (indR013) {
      const thresholdPct = getParamNumber(indParams["R013"] || [], "threshold_pct", 35);
      const minProcesses = getParamNumber(indParams["R013"] || [], "min_processes", 10);

      // Group by institution_code (fallback to institution_name)
      const instGroups: Record<string, { name: string; code: string; procs: ProcRecord[] }> = {};
      for (const proc of procs) {
        const code = proc.institution_code || proc.institution_name || "UNKNOWN";
        const name = proc.institution_name || code;
        if (!instGroups[code]) instGroups[code] = { name, code, procs: [] };
        instGroups[code].procs.push(proc);
      }

      for (const [instCode, group] of Object.entries(instGroups)) {
        // Filter to eligible processes (methods that count for R013)
        const eligible = group.procs.filter((p) => {
          const method = methodCatalog[(p.procurement_method || "").toUpperCase()];
          return method && method.count_for_r013;
        });

        if (eligible.length < minProcesses) continue;

        const nonCompetitive = eligible.filter((p) => {
          const method = methodCatalog[(p.procurement_method || "").toUpperCase()];
          return method && !method.is_competitive;
        });

        const pct = (nonCompetitive.length / eligible.length) * 100;

        if (pct >= thresholdPct) {
          const methodsUsed = [...new Set(nonCompetitive.map((p) => p.procurement_method))];
          const alert = {
            alert_code: "",
            indicator_id: indR013.id,
            indicator_code: "R013",
            upload_id,
            title: `R013 — Alto uso de métodos no competitivos en ${group.name}`,
            description: `La institución ${group.name} presenta ${pct.toFixed(1)}% de procesos no competitivos (${nonCompetitive.length} de ${eligible.length} procesos elegibles). Se requiere revisión técnica para evaluar las causas.`,
            calculation_detail: `Institución: ${group.name} (${instCode}), Procesos elegibles: ${eligible.length}, No competitivos: ${nonCompetitive.length}, Participación: ${pct.toFixed(1)}%, Referencia: ${thresholdPct}%`,
            threshold_applied: `procesos_no_competitivos / procesos_elegibles >= ${thresholdPct}% (mín. ${minProcesses} procesos)`,
            data_used: {
              institution_code: instCode,
              institution_name: group.name,
              eligible_count: eligible.length,
              non_competitive_count: nonCompetitive.length,
              pct: pct.toFixed(1),
              threshold_pct: thresholdPct,
              methods_used: methodsUsed,
              process_ids: nonCompetitive.map((p) => p.process_id),
            },
            priority: pct >= thresholdPct * 1.5 ? "high" : "medium",
            status: "new",
            is_demo: upload.is_demo,
            created_by: user_id,
            alert_level: "institution",
            quality_note: null,
          };
          alertsToInsert.push(alert);
          alertProcessLinks.push({ alert, processIds: nonCompetitive.map((p) => p.id) });
        }
      }
    }

    // ============================================================
    // R040 — Alta concentración comprador–proveedor (buyer-supplier level)
    // ============================================================
    const indR040 = indicators.find((i) => i.code === "R040");
    if (indR040) {
      const shareCountThreshold = getParamNumber(indParams["R040"] || [], "share_count_threshold", 45);
      const shareAmountThreshold = getParamNumber(indParams["R040"] || [], "share_amount_threshold", 55);
      const minAwards = getParamNumber(indParams["R040"] || [], "min_awards", 10);

      // Group by institution_code + supplier_id_code
      const groups: Record<string, { instCode: string; instName: string; supCode: string; supName: string; procs: ProcRecord[] }> = {};
      for (const proc of procs) {
        const instCode = proc.institution_code || proc.institution_name || "UNKNOWN";
        const supCode = proc.supplier_id_code || proc.supplier_name || "UNKNOWN";
        const key = `${instCode}|||${supCode}`;
        if (!groups[key]) groups[key] = {
          instCode, instName: proc.institution_name || instCode,
          supCode, supName: proc.supplier_name || supCode, procs: [],
        };
        groups[key].procs.push(proc);
      }

      // Institution totals
      const instTotals: Record<string, { count: number; amount: number }> = {};
      for (const proc of procs) {
        const code = proc.institution_code || proc.institution_name || "UNKNOWN";
        if (!instTotals[code]) instTotals[code] = { count: 0, amount: 0 };
        instTotals[code].count++;
        instTotals[code].amount += proc.awarded_amount || 0;
      }

      for (const [key, group] of Object.entries(groups)) {
        if (group.procs.length < minAwards) continue;

        const instTotal = instTotals[group.instCode];
        if (!instTotal) continue;

        const countPct = (group.procs.length / instTotal.count) * 100;
        const supplierAmount = group.procs.reduce((s, p) => s + (p.awarded_amount || 0), 0);
        const amountPct = instTotal.amount > 0 ? (supplierAmount / instTotal.amount) * 100 : 0;

        if (countPct >= shareCountThreshold || amountPct >= shareAmountThreshold) {
          const alert = {
            alert_code: "",
            indicator_id: indR040.id,
            indicator_code: "R040",
            upload_id,
            title: `R040 — Concentración comprador–proveedor: ${group.supName} en ${group.instName}`,
            description: `El proveedor ${group.supName} concentra el ${countPct.toFixed(1)}% de las adjudicaciones (${group.procs.length} de ${instTotal.count}) y el ${amountPct.toFixed(1)}% del monto ($${supplierAmount.toFixed(2)} de $${instTotal.amount.toFixed(2)}) en la institución ${group.instName}. Se requiere revisión técnica.`,
            calculation_detail: `Institución: ${group.instName} (${group.instCode}), Proveedor: ${group.supName} (${group.supCode}), Adjudicaciones: ${group.procs.length} de ${instTotal.count} (${countPct.toFixed(1)}%), Monto: $${supplierAmount.toFixed(2)} (${amountPct.toFixed(1)}%)`,
            threshold_applied: `Participación por cantidad >= ${shareCountThreshold}% o por monto >= ${shareAmountThreshold}% (mín. ${minAwards} adjudicaciones)`,
            data_used: {
              institution_code: group.instCode,
              institution_name: group.instName,
              supplier_code: group.supCode,
              supplier_name: group.supName,
              award_count: group.procs.length,
              total_institution_awards: instTotal.count,
              count_pct: countPct.toFixed(1),
              supplier_amount: supplierAmount,
              total_institution_amount: instTotal.amount,
              amount_pct: amountPct.toFixed(1),
              process_ids: group.procs.map((p) => p.process_id),
            },
            priority: countPct >= shareCountThreshold && amountPct >= shareAmountThreshold ? "high" : "medium",
            status: "new",
            is_demo: upload.is_demo,
            created_by: user_id,
            alert_level: "buyer_supplier",
            quality_note: null,
          };
          alertsToInsert.push(alert);
          alertProcessLinks.push({ alert, processIds: group.procs.map((p) => p.id) });
        }
      }
    }

    // ============================================================
    // R101 — Manipulación de umbrales de contratación (process level)
    // ============================================================
    const indR101 = indicators.find((i) => i.code === "R101");
    if (indR101) {
      const salarioMinimo = getParamNumber(indParams["R101"] || [], "salario_minimo_mensual", 0);
      const umbralSalarios = getParamNumber(indParams["R101"] || [], "umbral_referencia_salarios", 240);
      const competitivas = getParam(indParams["R101"] || [], "modalidades_competitivas", "LP,LC").split(",").map((m) => m.trim().toUpperCase());

      for (const proc of procs) {
        if (!proc.awarded_amount || proc.awarded_amount <= 0) continue;
        const method = (proc.procurement_method || "").toUpperCase();
        if (!competitivas.includes(method)) continue;

        const umbralMonetario = salarioMinimo > 0 ? salarioMinimo * umbralSalarios : 0;
        let triggered = false;
        let thresholdDesc = "";

        if (umbralMonetario > 0 && proc.awarded_amount > umbralMonetario) {
          triggered = true;
          thresholdDesc = `awarded_amount (${proc.awarded_amount}) > umbral ${umbralSalarios} salarios mínimos (${umbralMonetario})`;
        }

        if (triggered) {
          const alert = {
            alert_code: "",
            indicator_id: indR101.id,
            indicator_code: "R101",
            upload_id,
            title: `R101 — Posible manipulación de umbrales en proceso ${proc.process_id}`,
            description: `El monto adjudicado (${proc.awarded_amount}) excede el umbral de referencia de ${umbralSalarios} salarios mínimos (${umbralMonetario}) para la modalidad ${method}. Se requiere revisión técnica para verificar si la modalidad utilizada corresponde al monto.`,
            calculation_detail: `Monto adjudicado: ${proc.awarded_amount}, Umbral de referencia: ${umbralSalarios} salarios mínimos = ${umbralMonetario}, Modalidad: ${method}, Salario mínimo configurado: ${salarioMinimo}`,
            threshold_applied: thresholdDesc,
            data_used: {
              process_id: proc.process_id,
              procurement_method: method,
              awarded_amount: proc.awarded_amount,
              estimated_amount: proc.estimated_amount,
              umbral_salarios: umbralSalarios,
              salario_minimo: salarioMinimo,
              umbral_monetario: umbralMonetario,
            },
            priority: "medium",
            status: "new",
            is_demo: upload.is_demo,
            created_by: user_id,
            alert_level: "process",
            quality_note: "Cálculo parcial: requiere validación del umbral institucional configurado.",
          };
          alertsToInsert.push(alert);
          alertProcessLinks.push({ alert, processIds: [proc.id] });
        }
      }
    }

    // ============================================================
    // R104 — Período de decisión extremadamente corto (process level)
    // ============================================================
    const indR104 = indicators.find((i) => i.code === "R104");
    if (indR104) {
      const maxDias = getParamNumber(indParams["R104"] || [], "max_dias_decision", 3);
      const competitivas = getParam(indParams["R104"] || [], "modalidades_competitivas", "LP,LC").split(",").map((m) => m.trim().toUpperCase());

      for (const proc of procs) {
        if (!proc.bid_deadline || !proc.award_date) continue;
        const method = (proc.procurement_method || "").toUpperCase();
        if (!competitivas.includes(method)) continue;

        const diasDecision = daysBetween(proc.bid_deadline, proc.award_date);
        if (diasDecision === null) continue;

        if (diasDecision <= maxDias) {
          const alert = {
            alert_code: "",
            indicator_id: indR104.id,
            indicator_code: "R104",
            upload_id,
            title: `R104 — Período de decisión extremadamente corto en proceso ${proc.process_id}`,
            description: `El intervalo entre la recepción de ofertas y la adjudicación fue de ${diasDecision} días, inferior o igual al umbral demostrativo de ${maxDias} días para la modalidad ${method}. Se requiere revisión técnica.`,
            calculation_detail: `Días de decisión: ${diasDecision}, Umbral: ${maxDias} días, Modalidad: ${method}, Recepción: ${proc.bid_deadline}, Adjudicación: ${proc.award_date}`,
            threshold_applied: `award_date - bid_deadline <= ${maxDias} días (modalidad ${method})`,
            data_used: {
              process_id: proc.process_id,
              procurement_method: method,
              bid_deadline: proc.bid_deadline,
              award_date: proc.award_date,
              dias_decision: diasDecision,
              max_dias: maxDias,
            },
            priority: "medium",
            status: "new",
            is_demo: upload.is_demo,
            created_by: user_id,
            alert_level: "process",
            quality_note: "Cálculo aproximado: no se dispone de las fechas exactas de evaluación de ofertas.",
          };
          alertsToInsert.push(alert);
          alertProcessLinks.push({ alert, processIds: [proc.id] });
        }
      }
    }

    // ============================================================
    // R106 — El contrato tiene modificaciones (process level)
    // ============================================================
    const indR106 = indicators.find((i) => i.code === "R106");
    if (indR106) {
      const umbralPct = getParamNumber(indParams["R106"] || [], "umbral_modificacion_pct", 30);

      for (const proc of procs) {
        if (!proc.amendment_amount || proc.amendment_amount <= 0) continue;
        if (!proc.awarded_amount || proc.awarded_amount <= 0) continue;

        const pctModificacion = (proc.amendment_amount / proc.awarded_amount) * 100;
        const superaUmbral = pctModificacion >= umbralPct;

        const alert = {
          alert_code: "",
          indicator_id: indR106.id,
          indicator_code: "R106",
          upload_id,
          title: `R106 — ${superaUmbral ? "Modificación significativa" : "Modificación contractual"} en proceso ${proc.process_id}`,
          description: `El contrato del proceso ${proc.process_id} registra una modificación monetaria de ${proc.amendment_amount} (${pctModificacion.toFixed(1)}% del monto adjudicado). ${superaUmbral ? "Supera el umbral demostrativo del " + umbralPct + "%." : "No supera el umbral de revisión prioritaria."} Se requiere revisión técnica.`,
          calculation_detail: `Monto adjudicado: ${proc.awarded_amount}, Monto modificación: ${proc.amendment_amount}, Porcentaje: ${pctModificacion.toFixed(1)}%, Umbral: ${umbralPct}%`,
          threshold_applied: `amendment_amount > 0 AND (amendment_amount / awarded_amount) * 100 >= ${umbralPct}%`,
          data_used: {
            process_id: proc.process_id,
            awarded_amount: proc.awarded_amount,
            amendment_amount: proc.amendment_amount,
            pct_modificacion: pctModificacion.toFixed(1),
            umbral_pct: umbralPct,
            supera_umbral: superaUmbral,
          },
          priority: superaUmbral ? "high" : "low",
          status: "new",
          is_demo: upload.is_demo,
          created_by: user_id,
          alert_level: "process",
          quality_note: "Cálculo parcial: la plantilla actual no permite conocer modificaciones de plazo o alcance.",
        };
        alertsToInsert.push(alert);
        alertProcessLinks.push({ alert, processIds: [proc.id] });
      }
    }

    await supabase.from("data_uploads").update({ processing_progress: 60 }).eq("id", upload_id);

    // ============================================================
    // Generate alert codes and insert in batches
    // ============================================================
    const currentYear = new Date().getFullYear();
    const { count: existingCount } = await supabase
      .from("alerts").select("id", { count: "exact", head: true })
      .like("alert_code", `ALT-${currentYear}-%`);

    let alertSeq = (existingCount || 0) + 1;
    for (const a of alertsToInsert) {
      a.alert_code = `ALT-${currentYear}-${String(alertSeq).padStart(5, "0")}`;
      alertSeq++;
    }

    let savedAlerts = 0;
    const alertCodeToId: Record<string, string> = {};

    for (let i = 0; i < alertsToInsert.length; i += 100) {
      const batch = alertsToInsert.slice(i, i + 100);
      const { data: inserted, error: batchError } = await supabase
        .from("alerts").insert(batch).select("id, alert_code");

      if (batchError) {
        console.error("Error inserting alert batch:", batchError);
        continue;
      }
      if (inserted) {
        for (const a of inserted) {
          alertCodeToId[a.alert_code] = a.id;
          savedAlerts++;
        }
      }
    }

    // Save alert-process links
    const linkInserts: { alert_id: string; process_id: string }[] = [];
    for (const link of alertProcessLinks) {
      const alertId = alertCodeToId[link.alert.alert_code];
      if (!alertId) continue;
      for (const pid of link.processIds) {
        linkInserts.push({ alert_id: alertId, process_id: pid });
      }
    }

    for (let i = 0; i < linkInserts.length; i += 100) {
      const batch = linkInserts.slice(i, i + 100);
      await supabase.from("alert_processes").insert(batch);
    }

    // ============================================================
    // Update alert_count and priority on processes
    // ============================================================
    const processAlertCount: Record<string, number> = {};
    for (const link of alertProcessLinks) {
      const alertId = alertCodeToId[link.alert.alert_code];
      if (!alertId) continue;
      for (const pid of link.processIds) {
        processAlertCount[pid] = (processAlertCount[pid] || 0) + 1;
      }
    }

    const processesWithAlertsSet = new Set(Object.keys(processAlertCount));
    const processesWithoutAlerts = procs.filter((p) => !processesWithAlertsSet.has(p.id));
    if (processesWithoutAlerts.length > 0) {
      await supabase.from("procurement_processes")
        .update({ alert_count: 0, priority: null })
        .in("id", processesWithoutAlerts.map((p) => p.id));
    }

    for (const [procId, count] of Object.entries(processAlertCount)) {
      let priority = "low";
      if (count >= 3) priority = "high";
      else if (count === 2) priority = "medium";
      await supabase.from("procurement_processes")
        .update({ alert_count: count, priority })
        .eq("id", procId);
    }

    // ============================================================
    // Compute flag counts and coverage
    // ============================================================
    const flagCounts: Record<string, number> = { R018: 0, R003: 0, R063: 0, R013: 0, R040: 0, R101: 0, R104: 0, R106: 0 };
    for (const a of alertsToInsert) {
      if (flagCounts[a.indicator_code] !== undefined) flagCounts[a.indicator_code]++;
    }

    // Coverage metrics
    const totalProcs = procs.length;
    const withInstCode = procs.filter((p) => p.institution_code).length;
    const withSupplierId = procs.filter((p) => p.supplier_id_code).length;
    const withValidBids = procs.filter((p) => p.number_of_valid_bids !== null).length;
    const withDocPublished = procs.filter((p) => p.contract_document_published !== null).length;
    const withPubAndBid = procs.filter((p) => p.publication_date && p.bid_deadline).length;

    const coverage = {
      total: totalProcs,
      with_institution_code: withInstCode,
      with_supplier_id: withSupplierId,
      with_valid_bids: withValidBids,
      with_doc_published_info: withDocPublished,
      with_pub_and_bid_dates: withPubAndBid,
      r018_coverage: totalProcs > 0 ? ((withValidBids + procs.filter((p) => p.number_of_bidders !== null).length) / totalProcs * 100) : 0,
      r003_coverage: totalProcs > 0 ? (withPubAndBid / totalProcs * 100) : 0,
      r063_coverage: totalProcs > 0 ? (withDocPublished / totalProcs * 100) : 0,
      r013_coverage: totalProcs > 0 ? (withInstCode / totalProcs * 100) : 0,
      r040_coverage: totalProcs > 0 ? (withInstCode / totalProcs * 100) : 0,
    };

    // ============================================================
    // Update upload record
    // ============================================================
    await supabase.from("data_uploads").update({
      status: "completed",
      processing_progress: 100,
      total_records: totalProcs,
      valid_records: totalProcs,
      alerts_generated: savedAlerts,
      processed_at: new Date().toISOString(),
      processed_by: user_id,
    }).eq("id", upload_id);

    await supabase.from("audit_logs").insert({
      action_type: "indicator_processing",
      module: "rules_engine",
      affected_record: upload_id,
      description: `Procesamiento completado. ${savedAlerts} alertas: R018=${flagCounts.R018}, R003=${flagCounts.R003}, R063=${flagCounts.R063}, R013=${flagCounts.R013}, R040=${flagCounts.R040}, R101=${flagCounts.R101 || 0}, R104=${flagCounts.R104 || 0}, R106=${flagCounts.R106 || 0}`,
      result: "success",
      metadata: { upload_id, flag_counts: flagCounts, coverage, total_processes: totalProcs },
    });

    return new Response(
      JSON.stringify({
        success: true,
        alerts_generated: savedAlerts,
        flag_counts: flagCounts,
        total_processes: totalProcs,
        processes_with_alerts: processesWithAlertsSet.size,
        coverage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

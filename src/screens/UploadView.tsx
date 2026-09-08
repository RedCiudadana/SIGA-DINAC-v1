import { useState, useEffect } from 'react';
import {
  Upload, Download, CheckCircle, AlertCircle,
  XCircle, ArrowRight, ArrowLeft, Loader, FileSpreadsheet,
  Info, Eye, EyeOff, FileJson, FileSpreadsheet as FileExcel,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { ViewKey } from '@/components/AppShell';
import { HelpTooltip, InfoNote } from '@/components/HelpUI';
import { INDICATOR_LABELS, INDICATOR_SHORT } from '@/types';

interface UploadData {
  name: string;
  period: string;
  source: string;
  institution_scope: string;
  description: string;
  confidentiality_level: string;
}

interface ValidationIssue {
  row: number;
  column: string;
  type: 'error' | 'warning' | 'missing' | 'duplicate';
  message: string;
}

interface CatalogEntry {
  id: string;
  name: string;
  code: string;
}

// V1 required columns (16)
const V1_REQUIRED = [
  'process_id', 'institution', 'purchasing_unit', 'procurement_method',
  'procurement_category', 'procurement_description', 'publication_date',
  'bid_deadline', 'award_date', 'supplier_id', 'supplier_name',
  'number_of_bidders', 'estimated_amount', 'awarded_amount', 'currency',
  'contract_status',
];

// V2 adds 3 new required columns (19 total)
const V2_NEW_REQUIRED = ['institution_id', 'number_of_valid_bids', 'contract_document_published'];

// V1 optional columns (8)
const V1_OPTIONAL = [
  'item_code', 'item_description', 'contract_start_date', 'contract_end_date',
  'amendment_amount', 'final_executed_amount', 'data_source', 'source_url',
];

// V2 adds 3 new optional columns (11 total)
const V2_NEW_OPTIONAL = [
  'contract_document_type', 'contract_document_url', 'contract_document_publication_date',
];

const ALL_V1 = [...V1_REQUIRED, ...V1_OPTIONAL];
const ALL_V2 = [...V1_REQUIRED, ...V2_NEW_REQUIRED, ...V1_OPTIONAL, ...V2_NEW_OPTIONAL];

// Field descriptions for tooltips
const FIELD_DESCRIPTIONS: Record<string, string> = {
  process_id: 'Identificador único del proceso de contratación.',
  institution_id: 'Código único de la institución compradora. Permite consolidar correctamente procesos de una misma institución. Ejemplo: INST-001',
  institution: 'Nombre de la institución compradora.',
  purchasing_unit: 'Unidad o departamento responsable de la contratación.',
  procurement_method: 'Código del método de contratación (LP, LC, CD, CE, etc.). Se mapea contra el catálogo de métodos.',
  procurement_category: 'Categoría de la contratación (Bienes, Servicios, Obras, etc.).',
  procurement_description: 'Descripción del objeto de la contratación.',
  publication_date: 'Fecha de publicación de la convocatoria. Formato AAAA-MM-DD.',
  bid_deadline: 'Fecha límite para presentar ofertas. Formato AAAA-MM-DD.',
  award_date: 'Fecha de adjudicación. Formato AAAA-MM-DD.',
  supplier_id: 'Código o identificador del proveedor adjudicado.',
  supplier_name: 'Nombre del proveedor adjudicado.',
  number_of_bidders: 'Cantidad total de oferentes o participantes registrados en el proceso.',
  number_of_valid_bids: 'Cantidad de ofertas consideradas válidas para evaluación. Este campo se utiliza principalmente para la bandera R018.',
  estimated_amount: 'Monto estimado de la contratación.',
  awarded_amount: 'Monto adjudicado final.',
  currency: 'Moneda del monto (USD, EUR, etc.).',
  contract_status: 'Estado del contrato o proceso (adjudicado, contratado, vigente, etc.). Se normaliza contra el catálogo de estados.',
  contract_document_published: 'Indica si el contrato o documento contractual se encuentra publicado. Valores aceptados: true/false, 1/0, sí/no.',
  item_code: 'Código del item o bien contratado.',
  item_description: 'Descripción del item o bien contratado.',
  contract_start_date: 'Fecha de inicio del contrato. Formato AAAA-MM-DD.',
  contract_end_date: 'Fecha de finalización del contrato. Formato AAAA-MM-DD.',
  amendment_amount: 'Monto de modificaciones o enmiendas al contrato.',
  final_executed_amount: 'Monto final ejecutado del contrato.',
  data_source: 'Fuente de los datos.',
  source_url: 'URL de la fuente original de los datos.',
  contract_document_type: 'Tipo de documento contractual. Ejemplos: Contrato, Orden de compra, Resolución, Otro.',
  contract_document_url: 'Enlace al documento contractual, cuando exista.',
  contract_document_publication_date: 'Fecha en que el documento contractual fue publicado. Formato AAAA-MM-DD.',
};

const EXAMPLE_ROWS: Record<string, string>[] = [
  {
    process_id: 'PRC-2026-0001', institution_id: 'INST-001', institution: 'Ministerio Ficticio A',
    purchasing_unit: 'Unidad de Adquisiciones', procurement_method: 'LP', procurement_category: 'Bienes',
    procurement_description: 'Adquisición de equipo de cómputo (FICTICIO)',
    publication_date: '2026-05-01', bid_deadline: '2026-05-04', award_date: '2026-05-10',
    supplier_id: 'SUP-001', supplier_name: 'Empresa Ficticia Alfa S.A. (DEMO)',
    number_of_bidders: '3', number_of_valid_bids: '1',
    estimated_amount: '45000.00', awarded_amount: '43800.00', currency: 'USD', contract_status: 'adjudicado',
    contract_document_published: 'false',
    item_code: '', item_description: '',
    contract_start_date: '2026-06-01', contract_end_date: '2026-12-31',
    amendment_amount: '', final_executed_amount: '',
    data_source: 'Portal ficticio DINAC', source_url: '',
    contract_document_type: '', contract_document_url: '', contract_document_publication_date: '',
  },
  {
    process_id: 'PRC-2026-0002', institution_id: 'INST-002', institution: 'Institución Autónoma Ficticia B',
    purchasing_unit: 'Unidad de Logística', procurement_method: 'CD', procurement_category: 'Servicios',
    procurement_description: 'Servicios de mantenimiento técnico (SIMULADO)',
    publication_date: '2026-02-01', bid_deadline: '2026-02-01', award_date: '2026-02-03',
    supplier_id: 'SUP-006', supplier_name: 'Tecnología Ficticia Zeta S.A. (DEMO)',
    number_of_bidders: '1', number_of_valid_bids: '1',
    estimated_amount: '12000.00', awarded_amount: '12000.00', currency: 'USD', contract_status: 'contratado',
    contract_document_published: 'false',
    item_code: '', item_description: '',
    contract_start_date: '2026-02-05', contract_end_date: '2026-08-05',
    amendment_amount: '', final_executed_amount: '',
    data_source: 'Portal ficticio DINAC', source_url: '',
    contract_document_type: 'Orden de compra', contract_document_url: '', contract_document_publication_date: '',
  },
  {
    process_id: 'PRC-2026-0003', institution_id: 'INST-001', institution: 'Ministerio Ficticio A',
    purchasing_unit: 'Unidad de Compras', procurement_method: 'LC', procurement_category: 'Obras',
    procurement_description: 'Reparación de infraestructura municipal (FICTICIO)',
    publication_date: '2026-01-15', bid_deadline: '2026-02-05', award_date: '2026-02-10',
    supplier_id: 'SUP-007', supplier_name: 'Construcciones Ficticias Eta (DEMO)',
    number_of_bidders: '4', number_of_valid_bids: '3',
    estimated_amount: '78000.00', awarded_amount: '76500.00', currency: 'USD', contract_status: 'vigente',
    contract_document_published: 'true',
    item_code: '', item_description: '',
    contract_start_date: '2026-02-15', contract_end_date: '2026-06-15',
    amendment_amount: '', final_executed_amount: '',
    data_source: 'Portal ficticio DINAC', source_url: '',
    contract_document_type: 'Contrato', contract_document_url: 'https://ejemplo-ficticio.gov/contrato-003',
    contract_document_publication_date: '2026-02-12',
  },
  {
    process_id: 'PRC-2026-0004', institution_id: 'INST-001', institution: 'Ministerio Ficticio A',
    purchasing_unit: 'Unidad de Adquisiciones', procurement_method: 'CD', procurement_category: 'Bienes',
    procurement_description: 'Compra directa de insumos de oficina (SIMULADO)',
    publication_date: '2026-03-01', bid_deadline: '2026-03-01', award_date: '2026-03-02',
    supplier_id: 'SUP-001', supplier_name: 'Empresa Ficticia Alfa S.A. (DEMO)',
    number_of_bidders: '1', number_of_valid_bids: '1',
    estimated_amount: '15000.00', awarded_amount: '15000.00', currency: 'USD', contract_status: 'adjudicado',
    contract_document_published: 'false',
    item_code: '', item_description: '',
    contract_start_date: '2026-03-05', contract_end_date: '2026-09-05',
    amendment_amount: '', final_executed_amount: '',
    data_source: 'Portal ficticio DINAC', source_url: '',
    contract_document_type: '', contract_document_url: '', contract_document_publication_date: '',
  },
  {
    process_id: 'PRC-2026-0005', institution_id: 'INST-003', institution: 'Municipalidad Ficticia C',
    purchasing_unit: 'Unidad de Obras', procurement_method: 'LP', procurement_category: 'Obras',
    procurement_description: 'Construcción de puente vehicular (FICTICIO)',
    publication_date: '2026-04-01', bid_deadline: '2026-04-20', award_date: '2026-04-28',
    supplier_id: 'SUP-012', supplier_name: 'Obras Ficticias Beta (DEMO)',
    number_of_bidders: '5', number_of_valid_bids: '4',
    estimated_amount: '250000.00', awarded_amount: '242000.00', currency: 'USD', contract_status: 'en ejecucion',
    contract_document_published: 'true',
    item_code: '', item_description: '',
    contract_start_date: '2026-05-01', contract_end_date: '2027-05-01',
    amendment_amount: '', final_executed_amount: '',
    data_source: 'Portal ficticio DINAC', source_url: '',
    contract_document_type: 'Contrato', contract_document_url: 'https://ejemplo-ficticio.gov/contrato-005',
    contract_document_publication_date: '2026-04-30',
  },
];

const STEPS = ['Datos y plantilla', 'Cargar y validar', 'Previsualizar y confirmar', 'Resultados'];

const TRUE_VALUES = new Set(['true', '1', 'sí', 'si', 'yes', 'verdadero', 'y']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'falso', 'n']);

function parseBool(val: string): boolean | null {
  const v = val.toLowerCase().trim();
  if (TRUE_VALUES.has(v)) return true;
  if (FALSE_VALUES.has(v)) return false;
  return null;
}

function normalizeDate(val: string): string | null {
  const v = val.trim();
  if (!v) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // DD/MM/YYYY or DD-MM-YYYY
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    return `${m[3]}-${month}-${day}`;
  }
  return null;
}

function parseExcelToRows(data: ArrayBuffer): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[firstSheet];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (json.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(json[0]).map((h) => h.toLowerCase().trim());
  const rows = json.map((row) => {
    const normalized: Record<string, string> = {};
    Object.entries(row).forEach(([key, val]) => {
      normalized[key.toLowerCase().trim()] = String(val ?? '').trim();
    });
    return normalized;
  });
  return { headers, rows };
}

function parseJSONToRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const parsed = JSON.parse(text);
  const arr: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];
  if (arr.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(arr[0]).map((h) => h.toLowerCase().trim());
  const rows = arr.map((row) => {
    const normalized: Record<string, string> = {};
    Object.entries(row).forEach(([key, val]) => {
      normalized[key.toLowerCase().trim()] = String(val ?? '').trim();
    });
    return normalized;
  });
  return { headers, rows };
}

function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const firstLine = clean.split('\n').find((l) => l.trim()) || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const records: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { current.push(field.trim()); field = ''; }
      else if (ch === '\n') { current.push(field.trim()); records.push(current); current = []; field = ''; }
      else if (ch !== '\r') field += ch;
    }
  }
  if (field || current.length > 0) { current.push(field.trim()); records.push(current); }

  const nonEmpty = records.filter((r) => r.some((v) => v !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.toLowerCase().trim().replace(/^\ufeff/, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < nonEmpty.length; i++) {
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = nonEmpty[i][idx] || ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function detectTemplateVersion(headers: string[]): 'v1' | 'v2' {
  const hasV2Col = V2_NEW_REQUIRED.some((c) => headers.includes(c));
  return hasV2Col ? 'v2' : 'v1';
}

function computeFlagEvaluability(headers: string[], rows: Record<string, string>[]): Record<string, { available: boolean; partial: boolean; reason?: string }> {
  const hasV2 = detectTemplateVersion(headers) === 'v2';
  const result: Record<string, { available: boolean; partial: boolean; reason?: string }> = {};

  // R003: needs publication_date + bid_deadline (both in V1)
  result.R003 = { available: true, partial: false };

  // R018: prefers number_of_valid_bids, falls back to number_of_bidders
  if (headers.includes('number_of_valid_bids')) {
    result.R018 = { available: true, partial: false };
  } else if (headers.includes('number_of_bidders')) {
    result.R018 = { available: true, partial: true, reason: 'Usa number_of_bidders como estimación. Se recomienda number_of_valid_bids para mayor precisión.' };
  } else {
    result.R018 = { available: false, partial: false, reason: 'No se encontró number_of_valid_bids ni number_of_bidders' };
  }

  // R013: needs institution_id (V2) or institution (V1 fallback)
  if (headers.includes('institution_id') || headers.includes('institution')) {
    result.R013 = { available: true, partial: !headers.includes('institution_id'), reason: !headers.includes('institution_id') ? 'Usa nombre de institución como identificador. Se recomienda institution_id para mayor precisión.' : undefined };
  } else {
    result.R013 = { available: false, partial: false, reason: 'No se encontró institution_id ni institution' };
  }

  // R040: needs institution_id + supplier_id
  if (headers.includes('supplier_id')) {
    result.R040 = { available: true, partial: !headers.includes('institution_id'), reason: !headers.includes('institution_id') ? 'Usa nombre de institución. Se recomienda institution_id para agrupación precisa.' : undefined };
  } else {
    result.R040 = { available: false, partial: false, reason: 'No se encontró supplier_id' };
  }

  // R063: needs contract_document_published (V2)
  if (headers.includes('contract_document_published')) {
    result.R063 = { available: true, partial: false };
  } else {
    result.R063 = { available: false, partial: false, reason: 'No se encontró contract_document_published. Esta bandera no es evaluable con plantilla V1.' };
  }

  return result;
}

export function UploadView({ onNavigate }: { onNavigate: (view: ViewKey) => void }) {
  const { profile, logAction, securitySettings } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<UploadData>({
    name: '', period: '', source: '', institution_scope: '', description: '', confidentiality_level: 'internal',
  });
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [templateVersion, setTemplateVersion] = useState<'v1' | 'v2'>('v2');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validRows, setValidRows] = useState(0);
  const [warningRows, setWarningRows] = useState(0);
  const [rejectedRows, setRejectedRows] = useState(0);
  const [flagEvaluability, setFlagEvaluability] = useState<Record<string, { available: boolean; partial: boolean; reason?: string }>>({});
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ alerts: number; processes: number; flagCounts: Record<string, number>; coverage: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllColumns, setShowAllColumns] = useState(false);

  const [institutions, setInstitutions] = useState<CatalogEntry[]>([]);
  const [suppliers, setSuppliers] = useState<CatalogEntry[]>([]);

  useEffect(() => {
    supabase.from('institutions').select('id, name, code').eq('is_active', true).then(({ data }) => {
      if (data) setInstitutions(data as CatalogEntry[]);
    });
    supabase.from('suppliers').select('id, name, code').eq('is_active', true).then(({ data }) => {
      if (data) setSuppliers(data as CatalogEntry[]);
    });
  }, []);

  const buildCSV = (version: 'v1' | 'v2', withExamples: boolean): string => {
    const cols = version === 'v2' ? ALL_V2 : ALL_V1;
    const header = cols.join(',');
    if (!withExamples) return header + '\n';
    const rows = EXAMPLE_ROWS.map((row) =>
      cols.map((col) => {
        const val = row[col] || '';
        if (val.includes(',') || val.includes('"')) return `"${val.replace(/"/g, '""')}"`;
        return val;
      }).join(',')
    );
    return [header, ...rows].join('\n');
  };

  const downloadTemplate = (version: 'v1' | 'v2', withExamples: boolean) => {
    const csv = buildCSV(version, withExamples);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_sia_dinac_${version}${withExamples ? '_con_ejemplo' : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logAction('template_downloaded', 'data', `Descarga plantilla ${version} ${withExamples ? 'con ejemplo' : 'vacía'}`);
  };

  const handleFileChange = async (f: File) => {
    setFile(f);
    setError(null);

    const allowedTypes = (securitySettings?.allowed_file_types || 'csv,xlsx,xls,json').split(',');
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedTypes.includes(ext)) {
      setError(`Tipo de archivo no permitido. Formatos autorizados: ${allowedTypes.join(', ')}.`);
      return;
    }
    const maxSize = (securitySettings?.max_file_size_mb || 25) * 1024 * 1024;
    if (f.size > maxSize) {
      setError(`El archivo excede el tamaño máximo de ${securitySettings?.max_file_size_mb || 25} MB.`);
      return;
    }
    if (ext === 'csv') {
      const text = await f.text();
      validateAndParseFromRows(parseCSVText(text));
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await f.arrayBuffer();
      validateAndParseFromRows(parseExcelToRows(buffer));
    } else if (ext === 'json') {
      const text = await f.text();
      try {
        validateAndParseFromRows(parseJSONToRows(text));
      } catch {
        setError('El archivo JSON no es válido. Verifique que sea un arreglo de objetos con las columnas requeridas.');
      }
    } else {
      setError(`Formato no soportado: .${ext}. Use CSV, Excel (.xlsx, .xls) o JSON.`);
    }
  };

  const validateAndParseFromRows = (parsed: { headers: string[]; rows: Record<string, string>[] }) => {
    const { headers, rows } = parsed;

    if (headers.length === 0 || rows.length === 0) {
      setError('El archivo debe contener al menos una fila de encabezados y una de datos.');
      return;
    }

    const version = detectTemplateVersion(headers);
    setTemplateVersion(version);

    // Check required columns
    const requiredCols = version === 'v2' ? [...V1_REQUIRED, ...V2_NEW_REQUIRED] : V1_REQUIRED;
    const missingCols = requiredCols.filter((c) => !headers.includes(c));
    if (missingCols.length > 0) {
      setError(`Faltan columnas obligatorias: ${missingCols.join(', ')}. Descargue la plantilla ${version.toUpperCase()} para ver el formato correcto.`);
      return;
    }

    const validationIssues: ValidationIssue[] = [];
    const seenProcessIds = new Set<string>();

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;

      requiredCols.forEach((col) => {
        if (!row[col] && col !== 'currency' && col !== 'contract_status') {
          validationIssues.push({ row: rowNum, column: col, type: 'missing', message: `Campo obligatorio vacío: ${col}` });
        }
      });

      const pid = row.process_id?.trim();
      if (pid) {
        if (seenProcessIds.has(pid)) {
          validationIssues.push({ row: rowNum, column: 'process_id', type: 'duplicate', message: `process_id duplicado: ${pid}` });
        } else { seenProcessIds.add(pid); }
      }

      if (row.awarded_amount && isNaN(parseFloat(row.awarded_amount))) {
        validationIssues.push({ row: rowNum, column: 'awarded_amount', type: 'error', message: `Monto no numérico: ${row.awarded_amount}` });
      }
      if (row.estimated_amount && isNaN(parseFloat(row.estimated_amount))) {
        validationIssues.push({ row: rowNum, column: 'estimated_amount', type: 'error', message: `Monto no numérico: ${row.estimated_amount}` });
      }
      if (row.number_of_bidders && isNaN(parseInt(row.number_of_bidders))) {
        validationIssues.push({ row: rowNum, column: 'number_of_bidders', type: 'warning', message: `Número de oferentes no válido: ${row.number_of_bidders}` });
      }
      if (row.number_of_valid_bids && isNaN(parseInt(row.number_of_valid_bids))) {
        validationIssues.push({ row: rowNum, column: 'number_of_valid_bids', type: 'warning', message: `Número de ofertas válidas no válido: ${row.number_of_valid_bids}` });
      }

      // V2 boolean validation
      if (version === 'v2' && row.contract_document_published) {
        const boolVal = parseBool(row.contract_document_published);
        if (boolVal === null) {
          validationIssues.push({ row: rowNum, column: 'contract_document_published', type: 'warning', message: `Valor booleano no reconocido: ${row.contract_document_published}. Use true/false, 1/0, sí/no.` });
        }
      }

      // V2: number_of_valid_bids <= number_of_bidders
      if (row.number_of_valid_bids && row.number_of_bidders) {
        const vb = parseInt(row.number_of_valid_bids);
        const nb = parseInt(row.number_of_bidders);
        if (!isNaN(vb) && !isNaN(nb) && vb > nb) {
          validationIssues.push({ row: rowNum, column: 'number_of_valid_bids', type: 'warning', message: `Ofertas válidas (${vb}) mayor que oferentes (${nb})` });
        }
      }

      // Date validation
      ['publication_date', 'bid_deadline', 'award_date'].forEach((col) => {
        if (row[col]) {
          const normalized = normalizeDate(row[col]);
          if (!normalized) {
            validationIssues.push({ row: rowNum, column: col, type: 'warning', message: `Formato de fecha inválido (use AAAA-MM-DD): ${row[col]}` });
          } else {
            row[col] = normalized; // Auto-normalize
          }
        }
      });

      // Date logic
      const pub = row.publication_date, bid = row.bid_deadline, award = row.award_date;
      if (pub && bid && pub > bid) {
        validationIssues.push({ row: rowNum, column: 'bid_deadline', type: 'warning', message: 'La fecha de recepción es anterior a la de publicación' });
      }
      if (bid && award && bid > award) {
        validationIssues.push({ row: rowNum, column: 'award_date', type: 'warning', message: 'La fecha de adjudicación es anterior a la de recepción' });
      }

      // Amount >= 0
      if (row.awarded_amount) {
        const amt = parseFloat(row.awarded_amount);
        if (!isNaN(amt) && amt < 0) validationIssues.push({ row: rowNum, column: 'awarded_amount', type: 'error', message: 'Monto adjudicado negativo' });
      }
    });

    const errorRowNums = new Set(validationIssues.filter((i) => i.type === 'error' || i.type === 'duplicate').map((i) => i.row));
    const warningRowNums = new Set(validationIssues.filter((i) => i.type === 'warning' || i.type === 'missing').map((i) => i.row));
    const validCount = rows.filter((_, i) => !errorRowNums.has(i + 2) && !warningRowNums.has(i + 2)).length;
    const warningCount = rows.filter((_, i) => warningRowNums.has(i + 2) && !errorRowNums.has(i + 2)).length;

    setParsedRows(rows);
    setParsedHeaders(headers);
    setIssues(validationIssues);
    setValidRows(validCount);
    setWarningRows(warningCount);
    setRejectedRows(errorRowNums.size);
    setFlagEvaluability(computeFlagEvaluability(headers, rows));
  };

  const handleConfirmAndProcess = async () => {
    setProcessing(true);
    setError(null);

    try {
      const { data: uploadData, error: uploadError } = await supabase
        .from('data_uploads')
        .insert({
          name: formData.name, period: formData.period, source: formData.source,
          institution_scope: formData.institution_scope, description: formData.description,
          confidentiality_level: formData.confidentiality_level,
          file_name: file?.name || 'manual', file_size: file?.size || 0,
          file_type: file?.name.split('.').pop() || 'csv',
          status: 'validating', total_records: parsedRows.length,
          valid_records: validRows, warning_records: warningRows, rejected_records: rejectedRows,
          created_by: profile?.user_id,
        }).select('id').single();

      if (uploadError || !uploadData) {
        setError('Error al registrar la carga: ' + (uploadError?.message || 'desconocido'));
        setProcessing(false); return;
      }

      logAction('data_uploaded', 'data', `Carga iniciada: ${formData.name}`, uploadData.id);

      // Persist validation issues
      if (issues.length > 0) {
        const dqInserts = issues.slice(0, 200).map((issue) => ({
          upload_id: uploadData.id, row_number: issue.row, column_name: issue.column,
          issue_type: issue.type === 'missing' ? 'missing_field' : issue.type === 'duplicate' ? 'duplicate' : issue.type,
          message: issue.message, value: null, is_active: true,
        }));
        await supabase.from('data_quality_issues').insert(dqInserts);
      }

      // Build lookup maps
      const instMap = new Map<string, string>();
      institutions.forEach((i) => instMap.set(i.code.toLowerCase().trim(), i.id));
      const supMap = new Map<string, string>();
      suppliers.forEach((s) => supMap.set(s.code.toLowerCase().trim(), s.id));

      const processInserts = parsedRows.map((row) => {
        const instCode = row.institution_id?.trim() || null;
        const instId = instCode ? instMap.get(instCode.toLowerCase()) || null : null;
        const supCode = row.supplier_id?.trim() || null;
        const supId = supCode ? supMap.get(supCode.toLowerCase()) || null : null;
        const docPub = row.contract_document_published ? parseBool(row.contract_document_published) : null;
        const normDate = (col: string) => row[col] ? normalizeDate(row[col]) : null;

        return {
          process_id: row.process_id || `PRC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          upload_id: uploadData.id,
          institution_id: instId,
          institution_code: instCode,
          institution_name: row.institution?.trim() || null,
          purchasing_unit: row.purchasing_unit || null,
          procurement_method: row.procurement_method || null,
          procurement_category: row.procurement_category || null,
          procurement_description: row.procurement_description || null,
          publication_date: normDate('publication_date'),
          bid_deadline: normDate('bid_deadline'),
          award_date: normDate('award_date'),
          supplier_name: row.supplier_name || null,
          supplier_id_code: supCode,
          supplier_id: supId,
          number_of_bidders: row.number_of_bidders ? parseInt(row.number_of_bidders) : null,
          number_of_valid_bids: row.number_of_valid_bids ? parseInt(row.number_of_valid_bids) : null,
          estimated_amount: row.estimated_amount ? parseFloat(row.estimated_amount) : null,
          awarded_amount: row.awarded_amount ? parseFloat(row.awarded_amount) : null,
          currency: row.currency || 'USD',
          contract_status: row.contract_status || null,
          contract_document_published: docPub,
          contract_document_type: row.contract_document_type || null,
          contract_document_url: row.contract_document_url || null,
          contract_document_publication_date: normDate('contract_document_publication_date'),
          item_code: row.item_code || null,
          item_description: row.item_description || null,
          contract_start_date: normDate('contract_start_date'),
          contract_end_date: normDate('contract_end_date'),
          amendment_amount: row.amendment_amount ? parseFloat(row.amendment_amount) : null,
          final_executed_amount: row.final_executed_amount ? parseFloat(row.final_executed_amount) : null,
          data_source: row.data_source || null,
          source_url: row.source_url || null,
          confidentiality_level: formData.confidentiality_level,
          is_active: true,
          created_by: profile?.user_id,
        };
      });

      let insertedCount = 0;
      for (let i = 0; i < processInserts.length; i += 100) {
        const batch = processInserts.slice(i, i + 100);
        const { error: batchErr } = await supabase.from('procurement_processes').insert(batch);
        if (!batchErr) insertedCount += batch.length;
        else console.error('Batch insert error:', batchErr);
      }

      if (insertedCount === 0) {
        setError('Error al guardar los procesos. Verifique el formato de los datos.');
        setProcessing(false); return;
      }

      const { data: ruleResult, error: ruleError } = await supabase.functions.invoke('process-rules', {
        body: { upload_id: uploadData.id, user_id: profile?.user_id },
      });

      if (ruleError) {
        setError('Los datos se cargaron pero hubo un error al procesar las banderas.');
      } else {
        setResults({
          alerts: ruleResult?.alerts_generated || 0,
          processes: ruleResult?.total_processes || parsedRows.length,
          flagCounts: ruleResult?.flag_counts || {},
          coverage: ruleResult?.coverage || {},
        });
        logAction('indicator_processing', 'data', `Procesamiento: ${ruleResult?.alerts_generated || 0} alertas`, uploadData.id);
      }
      setStep(4);
    } catch (err) {
      setError('Error inesperado: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
    setProcessing(false);
  };

  const resetWizard = () => {
    setStep(1); setFile(null); setParsedRows([]); setParsedHeaders([]); setIssues([]);
    setValidRows(0); setWarningRows(0); setRejectedRows(0); setResults(null); setError(null);
    setFlagEvaluability({});
    setFormData({ name: '', period: '', source: '', institution_scope: '', description: '', confidentiality_level: 'internal' });
  };

  const previewColumns = showAllColumns ? parsedHeaders : ['process_id', 'institution_id', 'institution', 'procurement_method', 'supplier_name', 'number_of_valid_bids', 'awarded_amount', 'contract_status', 'contract_document_published'];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Carga de datos</h1>
        <p className="text-sm text-slate-500 mt-1">Asistente para cargar y procesar datos de contratación pública de DINAC.</p>
        <p className="text-xs text-slate-400 mt-1">Complete los metadatos, descargue la plantilla V2 (o use V1 compatible), cargue su CSV y confirme el procesamiento.</p>
      </div>

      {/* Steps */}
      <div className="card p-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-shrink-0">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                step === i + 1 ? 'bg-blue-900 text-white' : step > i + 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}>
                <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px]">
                  {step > i + 1 ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </span>{s}
              </div>
              {i < STEPS.length - 1 && <div className="w-2 h-px bg-slate-300" />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex gap-2"><AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-red-800">{error}</p></div>
        </div>
      )}

      {/* ============ Step 1 ============ */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="card p-6 lg:col-span-3 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Datos de la carga</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre de la carga *</label>
                <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="Ej: Contrataciones 2026-Q1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Periodo *</label>
                <input value={formData.period} onChange={(e) => setFormData({ ...formData, period: e.target.value })} className="input-field" placeholder="2026-Q1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Fuente</label>
                <input value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} className="input-field" placeholder="Ej: Portal de compras DINAC" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Institución o conjunto</label>
                <input value={formData.institution_scope} onChange={(e) => setFormData({ ...formData, institution_scope: e.target.value })} className="input-field" placeholder="Ej: Todas las instituciones" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field resize-y" rows={2} placeholder="Breve descripción de los datos cargados" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nivel de confidencialidad</label>
                <select value={formData.confidentiality_level} onChange={(e) => setFormData({ ...formData, confidentiality_level: e.target.value })} className="input-field">
                  <option value="internal">Uso interno</option>
                  <option value="confidential">Confidencial</option>
                  <option value="restricted">Restringido</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card p-6 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-700" />
              <h2 className="text-lg font-semibold text-slate-900">Plantilla de carga</h2>
              <HelpTooltip text="La plantilla V2 incluye 30 columnas (19 obligatorias, 11 opcionales) para el análisis completo de las cinco banderas. La V1 (24 columnas) sigue siendo compatible pero no permite evaluar R063." />
            </div>

            {/* V2 templates */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Plantilla V2 (recomendada) — 30 columnas</p>
              <button onClick={() => downloadTemplate('v2', true)} className="btn-primary w-full justify-start">
                <Download className="w-4 h-4 flex-shrink-0" />
                <div className="text-left"><span>V2 con ejemplo (5 filas ficticias)</span>
                <span className="block text-[10px] font-normal text-blue-200">Incluye casos R018, R003 y R063</span></div>
              </button>
              <button onClick={() => downloadTemplate('v2', false)} className="btn-secondary w-full justify-start">
                <Download className="w-4 h-4 flex-shrink-0" />
                <div className="text-left"><span>V2 vacía</span>
                <span className="block text-[10px] font-normal text-slate-400">Solo encabezados, 30 columnas</span></div>
              </button>
            </div>

            {/* V1 templates */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500">Plantilla V1 (compatible) — 24 columnas</p>
              <button onClick={() => downloadTemplate('v1', false)} className="btn-secondary w-full justify-start text-xs">
                <Download className="w-3.5 h-3.5 flex-shrink-0" />
                <span>V1 vacía (sin R063)</span>
              </button>
            </div>

            <InfoNote variant="info">
              V2 agrega: institution_id, number_of_valid_bids, contract_document_published, contract_document_type, contract_document_url, contract_document_publication_date. Los archivos V1 siguen funcionando; las banderas calculables dependen de los campos disponibles.
            </InfoNote>
          </div>

          {/* Field descriptions */}
          <div className="card p-6 lg:col-span-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Campos de la plantilla</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Campos obligatorios V2 (19)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[...V1_REQUIRED, ...V2_NEW_REQUIRED].map((c) => (
                    <div key={c} className="relative group">
                      <span className={`text-xs font-mono px-2 py-1 rounded border block ${V2_NEW_REQUIRED.includes(c) ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {c}{V2_NEW_REQUIRED.includes(c) && ' ★'}
                      </span>
                      {FIELD_DESCRIPTIONS[c] && (
                        <div className="absolute z-20 left-0 top-full mt-1 hidden group-hover:block w-64 p-2 rounded-lg bg-slate-900 text-white text-[11px] leading-relaxed shadow-lg">
                          {FIELD_DESCRIPTIONS[c]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-blue-600 mt-1">★ Nuevos en V2</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Campos opcionales V2 (11)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[...V1_OPTIONAL, ...V2_NEW_OPTIONAL].map((c) => (
                    <div key={c} className="relative group">
                      <span className={`text-xs font-mono px-2 py-1 rounded border block ${V2_NEW_OPTIONAL.includes(c) ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                        {c}{V2_NEW_OPTIONAL.includes(c) && ' ★'}
                      </span>
                      {FIELD_DESCRIPTIONS[c] && (
                        <div className="absolute z-20 left-0 top-full mt-1 hidden group-hover:block w-64 p-2 rounded-lg bg-slate-900 text-white text-[11px] leading-relaxed shadow-lg">
                          {FIELD_DESCRIPTIONS[c]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-end">
            <button onClick={() => setStep(2)} disabled={!formData.name || !formData.period} className="btn-primary">
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============ Step 2 ============ */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="card p-6 max-w-2xl space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Cargar archivo</h2>
              <HelpTooltip text="Se aceptan archivos CSV separados por comas o punto y coma, con o sin BOM. El sistema detecta automáticamente la versión de la plantilla y valida estructura, tipos, fechas y lógica." />
            </div>
              <p className="text-sm text-slate-600">
                Formatos: CSV, Excel (.xlsx, .xls) y JSON. Máximo: {securitySettings?.max_file_size_mb || 25} MB.
              </p>
            <div
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFileChange(e.dataTransfer.files[0]); }}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600">{file ? file.name : 'Haga clic o arrastre un archivo aquí'}</p>
              <p className="text-xs text-slate-400 mt-1">CSV, Excel o JSON</p>
              <input id="file-input" type="file" accept=".csv,.xlsx,.xls,.json" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])} />
            </div>
          </div>

          {file && parsedRows.length > 0 && (
            <>
              {/* Template version detected */}
              <div className={`card p-4 ${templateVersion === 'v1' ? 'border-amber-300' : 'border-green-300'}`}>
                <div className="flex items-center gap-2">
                  <Info className={`w-4 h-4 ${templateVersion === 'v1' ? 'text-amber-600' : 'text-green-600'}`} />
                  <span className="text-sm font-semibold text-slate-900">
                    {templateVersion === 'v2' ? 'Plantilla V2 detectada (30 columnas)' : 'Plantilla V1 detectada (formato anterior — 24 columnas)'}
                  </span>
                </div>
                {templateVersion === 'v1' && (
                  <p className="text-xs text-amber-700 mt-2">
                    R003: disponible · R013: disponible · R040: disponible · R018: disponible parcialmente · R063: no disponible. Se recomienda utilizar la plantilla V2 para el análisis completo.
                  </p>
                )}
              </div>

              {/* Validation results */}
              <div className="card p-6 space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Resultado de la validación</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center"><p className="text-2xl font-bold text-slate-700">{parsedRows.length}</p><p className="text-xs text-slate-500">Total de filas</p></div>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" /><p className="text-2xl font-bold text-green-700">{validRows}</p><p className="text-xs text-green-600">Válidos</p></div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center"><AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" /><p className="text-2xl font-bold text-amber-700">{warningRows}</p><p className="text-xs text-amber-600">Advertencias</p></div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center"><XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" /><p className="text-2xl font-bold text-red-700">{rejectedRows}</p><p className="text-xs text-red-600">Rechazados</p></div>
                </div>

                {/* Flag evaluability */}
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Banderas que podrán calcularse</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {Object.entries(flagEvaluability).map(([code, info]) => (
                      <div key={code} className={`rounded-lg border p-3 ${info.available ? (info.partial ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50') : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {info.available ? (info.partial ? <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> : <CheckCircle className="w-3.5 h-3.5 text-green-600" />) : <XCircle className="w-3.5 h-3.5 text-red-600" />}
                          <span className="text-xs font-semibold text-slate-800">{INDICATOR_SHORT[code] || code}</span>
                        </div>
                        <p className="text-[10px] text-slate-500">{info.available ? (info.partial ? 'Parcial' : 'Disponible') : 'No evaluable'}</p>
                        {info.reason && <p className="text-[10px] text-slate-400 mt-1 leading-tight">{info.reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {issues.length > 0 && (
                  <div className="max-h-64 overflow-y-auto scrollbar-thin border border-slate-200 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr><th className="table-header">Fila</th><th className="table-header">Columna</th><th className="table-header">Tipo</th><th className="table-header">Mensaje</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {issues.slice(0, 50).map((issue, i) => (
                          <tr key={i}>
                            <td className="table-cell text-xs">{issue.row}</td>
                            <td className="table-cell text-xs font-mono">{issue.column}</td>
                            <td className="table-cell">
                              <span className={`badge ${issue.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : issue.type === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' : issue.type === 'missing' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                                {issue.type === 'error' ? 'Error' : issue.type === 'warning' ? 'Advertencia' : issue.type === 'missing' ? 'Faltante' : 'Duplicado'}
                              </span>
                            </td>
                            <td className="table-cell text-xs">{issue.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {issues.length > 50 && <p className="text-xs text-slate-400">Mostrando 50 de {issues.length} problemas.</p>}
              </div>
            </>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary"><ArrowLeft className="w-4 h-4" /> Atrás</button>
            <button onClick={() => setStep(3)} disabled={!file || !parsedRows.length} className="btn-primary">Continuar <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* ============ Step 3 ============ */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Previsualización de datos</h2>
                <HelpTooltip text="Revise que los datos se interpretaron correctamente. Solo los registros válidos se procesarán." />
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-700">Válidos: <strong>{validRows}</strong></span>
                <span className="text-amber-700">Advertencias: <strong>{warningRows}</strong></span>
                <span className="text-red-700">Rechazados: <strong>{rejectedRows}</strong></span>
                <span className="text-slate-600">Completitud: <strong>{parsedRows.length > 0 ? ((validRows / parsedRows.length) * 100).toFixed(0) : 0}%</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setShowAllColumns(!showAllColumns)} className="text-xs text-blue-700 hover:text-blue-800 flex items-center gap-1">
                {showAllColumns ? <><EyeOff className="w-3.5 h-3.5" /> Ocultar columnas extra</> : <><Eye className="w-3.5 h-3.5" /> Ver todas las columnas</>}
              </button>
              <span className="text-[10px] text-slate-400">({showAllColumns ? parsedHeaders.length : previewColumns.length} de {parsedHeaders.length})</span>
            </div>

            <div className="max-h-96 overflow-auto scrollbar-thin border border-slate-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {previewColumns.map((c) => <th key={c} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{c}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {previewColumns.map((c) => <td key={c} className="px-3 py-2 text-slate-700 whitespace-nowrap">{row[c] || '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 20 && <p className="text-xs text-slate-400">Mostrando 20 de {parsedRows.length} registros.</p>}
          </div>

          <div className="card p-6 max-w-2xl space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Confirmar carga</h2>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5">
              <p className="text-sm"><strong>Nombre:</strong> {formData.name}</p>
              <p className="text-sm"><strong>Periodo:</strong> {formData.period}</p>
              <p className="text-sm"><strong>Plantilla:</strong> {templateVersion.toUpperCase()} ({templateVersion === 'v2' ? '30 columnas' : '24 columnas'})</p>
              <p className="text-sm"><strong>Registros:</strong> {parsedRows.length} ({validRows} válidos, {warningRows} con advertencias, {rejectedRows} rechazados)</p>
              <p className="text-sm"><strong>Confidencialidad:</strong> {formData.confidentiality_level}</p>
            </div>
            <InfoNote variant="warning">
              Al confirmar, los datos se procesarán y se ejecutarán las cinco banderas rojas. Los registros heredan el nivel de confidencialidad de la carga. Esta acción queda registrada en la bitácora.
            </InfoNote>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn-secondary"><ArrowLeft className="w-4 h-4" /> Atrás</button>
            <button onClick={handleConfirmAndProcess} disabled={processing} className="btn-primary">
              {processing ? <><Loader className="w-4 h-4 animate-spin" /> Procesando...</> : <>Confirmar y procesar <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}

      {/* ============ Step 4: Results ============ */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="card p-8 max-w-2xl mx-auto text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Carga procesada correctamente</h2>
            {results && (
              <>
                <p className="text-sm text-slate-600">{results.processes} procesos analizados</p>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 max-w-2xl mx-auto">
                  {Object.entries(results.flagCounts).map(([code, count]) => (
                    <div key={code} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-2xl font-bold text-slate-900">{count}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{INDICATOR_SHORT[code] || code}</p>
                      <p className="text-[9px] text-slate-400">{code}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Coverage / data quality */}
            {results?.coverage && Object.keys(results.coverage).length > 0 && (
              <div className="text-left rounded-lg border border-slate-200 p-4 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Calidad y cobertura de datos</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <CoverageItem label="Con institution_id" value={results.coverage.with_institution_code} total={results.coverage.total} />
                  <CoverageItem label="Con supplier_id" value={results.coverage.with_supplier_id} total={results.coverage.total} />
                  <CoverageItem label="Con ofertas válidas" value={results.coverage.with_valid_bids} total={results.coverage.total} />
                  <CoverageItem label="Con info. de contrato" value={results.coverage.with_doc_published_info} total={results.coverage.total} />
                  <CoverageItem label="Con fechas pub/recep" value={results.coverage.with_pub_and_bid_dates} total={results.coverage.total} />
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                  <CoverageBar label="Cobertura R018" pct={results.coverage.r018_coverage || 0} />
                  <CoverageBar label="Cobertura R003" pct={results.coverage.r003_coverage || 0} />
                  <CoverageBar label="Cobertura R063" pct={results.coverage.r063_coverage || 0} />
                  <CoverageBar label="Cobertura R013" pct={results.coverage.r013_coverage || 0} />
                  <CoverageBar label="Cobertura R040" pct={results.coverage.r040_coverage || 0} />
                </div>
              </div>
            )}
          </div>

          <InfoNote variant="warning">
            Las banderas rojas son indicadores preventivos que permiten priorizar procesos para análisis y revisión. Su activación no constituye por sí sola evidencia de irregularidad, fraude o corrupción.
          </InfoNote>

          <div className="flex justify-center gap-3">
            <button onClick={() => onNavigate('alerts')} className="btn-primary">Ver alertas <ArrowRight className="w-4 h-4" /></button>
            <button onClick={() => onNavigate('uploads')} className="btn-secondary">Historial de cargas</button>
            <button onClick={resetWizard} className="btn-secondary">Cargar otro archivo</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CoverageItem({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-700">{value}/{total} <span className="text-slate-400">({pct.toFixed(1)}%)</span></span>
    </div>
  );
}

function CoverageBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-slate-600 w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Download, AlertTriangle, BarChart3, FileBarChart,
  Building2, FileSpreadsheet, Loader, CheckCircle, Filter,
  Calendar, ShieldCheck, FileDown, TrendingUp, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { HelpTooltip, InfoNote } from '@/components/HelpUI';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  INDICATOR_LABELS, INDICATOR_SHORT, ALERT_STATUS_LABELS,
  PRIORITY_LABELS, type Alert, type ProcurementProcess,
} from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const LOGO_URL = 'https://dinac.gob.sv/wp-content/uploads/2026/01/LOGO-DINAC2.png';

type ReportId = 'executive-summary' | 'alerts-by-indicator' | 'alerts-by-institution' | 'alerts-detail' | 'processes-summary';

interface ReportDef {
  id: ReportId;
  title: string;
  description: string;
  icon: typeof BarChart3;
  permission: string;
  color: string;
}

interface ReportFilters {
  indicatorCode: string;
  status: string;
  priority: string;
  dateFrom: string;
  dateTo: string;
}

interface ReportHistoryEntry {
  id: string;
  report_type: string;
  file_name: string;
  generated_by: string;
  created_at: string;
}

const REPORTS: ReportDef[] = [
  {
    id: 'executive-summary',
    title: 'Resumen ejecutivo',
    description: 'Métricas agregadas: total de alertas, procesos, distribución por bandera, prioridad y estado.',
    icon: BarChart3,
    permission: 'export_reports',
    color: 'blue',
  },
  {
    id: 'alerts-by-indicator',
    title: 'Alertas por indicador',
    description: 'Detalle de alertas agrupadas por cada bandera roja con totales y desglose de estados.',
    icon: AlertTriangle,
    permission: 'export_reports',
    color: 'amber',
  },
  {
    id: 'alerts-by-institution',
    title: 'Alertas por institución',
    description: 'Distribución de alertas por institución compradora con montos y prioridades.',
    icon: Building2,
    permission: 'export_reports',
    color: 'cyan',
  },
  {
    id: 'alerts-detail',
    title: 'Detalle completo de alertas',
    description: 'Listado tabular de todas las alertas con proceso, bandera, estado, prioridad y descripción.',
    icon: FileBarChart,
    permission: 'export_reports',
    color: 'rose',
  },
  {
    id: 'processes-summary',
    title: 'Resumen de procesos',
    description: 'Consolidado de procesos de contratación con montos, métodos y alertas asociadas.',
    icon: FileSpreadsheet,
    permission: 'export_reports',
    color: 'emerald',
  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; btn: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', btn: 'hover:bg-blue-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', btn: 'hover:bg-amber-600' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', btn: 'hover:bg-cyan-600' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', btn: 'hover:bg-rose-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', btn: 'hover:bg-emerald-600' },
};

async function fetchLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function ReportsView() {
  const { hasPermission, logAction, profile } = useAuth();
  const [generating, setGenerating] = useState<ReportId | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({
    indicatorCode: '', status: '', priority: '', dateFrom: '', dateTo: '',
  });
  const [history, setHistory] = useState<ReportHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [previewData, setPreviewData] = useState<ReportId | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('id, action_type, module, description, created_at, user_email')
      .eq('action_type', 'report_downloaded')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) {
      setHistory(data.map((d: Record<string, unknown>) => ({
        id: d.id as string,
        report_type: (d.description as string) || '',
        file_name: '',
        generated_by: (d.user_email as string) || '',
        created_at: d.created_at as string,
      })));
    }
    setLoadingHistory(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const buildAlertQuery = () => {
    let q = supabase.from('alerts').select('*').eq('is_deleted', false);
    if (filters.indicatorCode) q = q.eq('indicator_code', filters.indicatorCode);
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.priority) q = q.eq('priority', filters.priority);
    if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom);
    if (filters.dateTo) q = q.lte('created_at', filters.dateTo + 'T23:59:59');
    return q.order('created_at', { ascending: false }).limit(500);
  };

  const handlePreview = async (reportId: ReportId) => {
    setPreviewData(reportId);
    setPreviewLoading(true);
    setPreviewRows([]);

    try {
      if (reportId === 'alerts-detail') {
        const { data, error } = await buildAlertQuery();
        if (error) throw error;
        const alertList = (data || []) as Alert[];
        setPreviewRows(alertList.map((a) => ({
          'Código': a.alert_code || '',
          'Bandera': INDICATOR_SHORT[a.indicator_code] || a.indicator_code || '',
          'Título': a.title || '',
          'Estado': ALERT_STATUS_LABELS[a.status] || a.status,
          'Prioridad': PRIORITY_LABELS[a.priority] || a.priority,
          'Fecha': new Date(a.created_at).toLocaleDateString('es-SV'),
        })));

      } else if (reportId === 'alerts-by-indicator') {
        const { data, error } = await buildAlertQuery();
        if (error) throw error;
        const alertList = (data || []) as Alert[];
        const byIndicator: Record<string, Alert[]> = {};
        alertList.forEach((a) => {
          const code = a.indicator_code || 'unknown';
          if (!byIndicator[code]) byIndicator[code] = [];
          byIndicator[code].push(a);
        });
        setPreviewRows(Object.entries(byIndicator).map(([code, items]) => ({
          'Bandera': INDICATOR_LABELS[code] || code,
          'Total': items.length,
          'Nuevas': items.filter((a) => a.status === 'new').length,
          'En revisión': items.filter((a) => a.status === 'in_review').length,
          'Cerradas': items.filter((a) => a.status === 'closed').length,
          'Alta prioridad': items.filter((a) => a.priority === 'high').length,
        })));

      } else if (reportId === 'alerts-by-institution') {
        const { data, error } = await buildAlertQuery();
        if (error) throw error;
        const alertList = (data || []) as Alert[];
        const byInst: Record<string, Alert[]> = {};
        alertList.forEach((a) => {
          const inst = (a.data_used as Record<string, unknown>)?.institution as string || 'Sin institución';
          if (!byInst[inst]) byInst[inst] = [];
          byInst[inst].push(a);
        });
        setPreviewRows(Object.entries(byInst)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([inst, items]) => ({
            'Institución': inst,
            'Total': items.length,
            'Alta': items.filter((a) => a.priority === 'high').length,
            'Media': items.filter((a) => a.priority === 'medium').length,
            'Baja': items.filter((a) => a.priority === 'low').length,
            'Nuevas': items.filter((a) => a.status === 'new').length,
          })));

      } else if (reportId === 'processes-summary') {
        const { data, error } = await supabase
          .from('procurement_processes')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        const procs = (data || []) as ProcurementProcess[];
        setPreviewRows(procs.map((p) => ({
          'ID Proceso': p.process_id || '',
          'Institución': p.institution_name || '',
          'Método': p.procurement_method || '',
          'Monto USD': (p.awarded_amount || 0).toLocaleString('en-US'),
          'Oferentes': p.number_of_bidders ?? '',
          'Estado': p.contract_status || '',
          'Alertas': p.alert_count ?? 0,
        })));

      } else {
        // executive-summary
        const { data: alerts, error: alertErr } = await buildAlertQuery();
        if (alertErr) throw alertErr;
        const alertList = (alerts || []) as Alert[];
        const { count: processCount, error: procErr } = await supabase
          .from('procurement_processes')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);
        if (procErr) throw procErr;
        setPreviewRows([{
          totalAlerts: alertList.length,
          totalProcesses: processCount || 0,
          highPriority: alertList.filter((a) => a.priority === 'high').length,
          newAlerts: alertList.filter((a) => a.status === 'new').length,
          closedAlerts: alertList.filter((a) => a.status === 'closed').length,
        }]);
      }
    } catch (err) {
      console.error('Preview error:', err);
      setPreviewRows([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (reportId: ReportId) => {
    setGenerating(reportId);
    try {
      const timestamp = new Date().toLocaleString('es-SV');
      const userName = profile?.full_name || 'Usuario';
      const userEmail = profile?.email || '';
      const reportDef = REPORTS.find((r) => r.id === reportId)!;
      const reportId_short = `RPT-${Date.now().toString().slice(-8)}`;
      const dateStr = new Date().toISOString().split('T')[0];

      const logoBase64 = await fetchLogoBase64();

      const { data: alerts } = await buildAlertQuery();
      const alertList = (alerts || []) as Alert[];

      const { data: processes } = await supabase
        .from('procurement_processes')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(200);
      const processList = (processes || []) as ProcurementProcess[];

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;

      // ─── Header ───
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageWidth, 28, 'F');

      if (logoBase64) {
        try {
          pdf.addImage(logoBase64, 'PNG', margin, 4, 18, 18);
        } catch { /* skip if image fails */ }
      }

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('SIGA-DINAC', margin + 22, 12);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Sistema de Identificación y Gestión de Alertas', margin + 22, 17);
        pdf.text('Dirección Nacional de Compras Públicas', margin + 22, 21);

      pdf.setFontSize(7);
        pdf.text('DINAC', pageWidth - margin, 10, { align: 'right' });
        pdf.text('Reporte interno', pageWidth - margin, 14, { align: 'right' });
        pdf.text(`Clasificación: Uso interno`, pageWidth - margin, 18, { align: 'right' });

      // ─── Meta box ───
      let y = 34;
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, y, pageWidth - margin * 2, 24, 2, 2, 'FD');

      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(reportDef.title, margin + 4, y + 6);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`ID: ${reportId_short}`, margin + 4, y + 11);
      pdf.text(`Generado por: ${userName} (${userEmail})`, margin + 4, y + 15);
      pdf.text(`Fecha: ${timestamp}`, margin + 4, y + 19);

      const filterParts: string[] = [];
      if (filters.indicatorCode) filterParts.push(`Bandera: ${INDICATOR_SHORT[filters.indicatorCode] || filters.indicatorCode}`);
      if (filters.status) filterParts.push(`Estado: ${ALERT_STATUS_LABELS[filters.status] || filters.status}`);
      if (filters.priority) filterParts.push(`Prioridad: ${PRIORITY_LABELS[filters.priority] || filters.priority}`);
      if (filters.dateFrom) filterParts.push(`Desde: ${filters.dateFrom}`);
      if (filters.dateTo) filterParts.push(`Hasta: ${filters.dateTo}`);
      const filterText = filterParts.length > 0 ? filterParts.join('  |  ') : 'Sin filtros (todos los registros)';
      pdf.text(`Filtros: ${filterText}`, margin + 4, y + 23);

      y += 30;

      // ─── Content per report type ───
      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - 25) {
          pdf.addPage();
          y = margin;
        }
      };

      const addSectionTitle = (title: string) => {
        ensureSpace(12);
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, margin, y);
        y += 6;
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.3);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 4;
      };

      if (reportId === 'executive-summary') {
        const totalAlerts = alertList.length;
        const totalProcesses = processList.length;
        const highP = alertList.filter((a) => a.priority === 'high').length;
        const medP = alertList.filter((a) => a.priority === 'medium').length;
        const lowP = alertList.filter((a) => a.priority === 'low').length;
        const newA = alertList.filter((a) => a.status === 'new').length;
        const closed = alertList.filter((a) => a.status === 'closed').length;
        const inReview = alertList.filter((a) => a.status === 'in_review').length;
        const totalAwarded = processList.reduce((s, p) => s + (p.awarded_amount || 0), 0);

        // KPI cards row
        const kpis = [
          { label: 'Alertas', value: totalAlerts, color: [239, 68, 68] },
          { label: 'Procesos', value: totalProcesses, color: [59, 130, 246] },
          { label: 'Prioridad alta', value: highP, color: [234, 88, 12] },
          { label: 'Nuevas', value: newA, color: [168, 85, 247] },
        ];
        const cardW = (pageWidth - margin * 2 - 6) / 4;
        kpis.forEach((kpi, i) => {
          const x = margin + i * (cardW + 2);
          pdf.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          pdf.roundedRect(x, y, cardW, 16, 2, 2, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text(String(kpi.value), x + 3, y + 8);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'normal');
          pdf.text(kpi.label, x + 3, y + 13);
        });
        y += 22;

        addSectionTitle('Distribución por bandera roja');
        const byIndicator: Record<string, number> = {};
        alertList.forEach((a) => {
          const code = a.indicator_code || 'unknown';
          byIndicator[code] = (byIndicator[code] || 0) + 1;
        });
        autoTable(pdf, {
          startY: y,
          head: [['Bandera', 'Cantidad', '% del total']],
          body: Object.entries(byIndicator).map(([code, count]) => [
            INDICATOR_LABELS[code] || code,
            String(count),
            totalAlerts > 0 ? `${((count / totalAlerts) * 100).toFixed(1)}%` : '0%',
          ]),
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });
        y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

        addSectionTitle('Distribución por prioridad');
        autoTable(pdf, {
          startY: y,
          head: [['Prioridad', 'Cantidad', '% del total']],
          body: [
            ['Alta', String(highP), totalAlerts > 0 ? `${((highP / totalAlerts) * 100).toFixed(1)}%` : '0%'],
            ['Media', String(medP), totalAlerts > 0 ? `${((medP / totalAlerts) * 100).toFixed(1)}%` : '0%'],
            ['Baja', String(lowP), totalAlerts > 0 ? `${((lowP / totalAlerts) * 100).toFixed(1)}%` : '0%'],
          ],
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });
        y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

        addSectionTitle('Distribución por estado');
        autoTable(pdf, {
          startY: y,
          head: [['Estado', 'Cantidad']],
          body: [
            ['Nuevas', String(newA)],
            ['En revisión', String(inReview)],
            ['Cerradas', String(closed)],
          ],
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });
        y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

        addSectionTitle('Monto total adjudicado');
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(30, 41, 59);
        pdf.text(`USD ${totalAwarded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin, y + 4);
        y += 10;

      } else if (reportId === 'alerts-by-indicator') {
        const byIndicator: Record<string, Alert[]> = {};
        alertList.forEach((a) => {
          const code = a.indicator_code || 'unknown';
          if (!byIndicator[code]) byIndicator[code] = [];
          byIndicator[code].push(a);
        });

        addSectionTitle('Alertas agrupadas por bandera roja');
        autoTable(pdf, {
          startY: y,
          head: [['Bandera', 'Total', 'Nuevas', 'En revisión', 'Cerradas', 'Alta prioridad']],
          body: Object.entries(byIndicator).map(([code, items]) => [
            INDICATOR_LABELS[code] || code,
            String(items.length),
            String(items.filter((a) => a.status === 'new').length),
            String(items.filter((a) => a.status === 'in_review').length),
            String(items.filter((a) => a.status === 'closed').length),
            String(items.filter((a) => a.priority === 'high').length),
          ]),
          theme: 'grid',
          headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          margin: { left: margin, right: margin },
        });
        y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

        // Per-indicator detail
        for (const [code, items] of Object.entries(byIndicator)) {
          ensureSpace(20);
          addSectionTitle(`${INDICATOR_LABELS[code] || code} — ${items.length} alertas`);
          autoTable(pdf, {
            startY: y,
            head: [['Código', 'Título', 'Estado', 'Prioridad', 'Fecha']],
            body: items.slice(0, 15).map((a) => [
              a.alert_code || '',
              (a.title || '').slice(0, 50),
              ALERT_STATUS_LABELS[a.status] || a.status,
              PRIORITY_LABELS[a.priority] || a.priority,
              new Date(a.created_at).toLocaleDateString('es-SV'),
            ]),
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235], fontSize: 7 },
            bodyStyles: { fontSize: 7 },
            margin: { left: margin, right: margin },
          });
          y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
          if (items.length > 15) {
            ensureSpace(5);
            pdf.setFontSize(7);
            pdf.setTextColor(100, 116, 139);
            pdf.text(`... y ${items.length - 15} alertas más.`, margin, y);
            y += 4;
          }
        }

      } else if (reportId === 'alerts-by-institution') {
        const byInst: Record<string, Alert[]> = {};
        alertList.forEach((a) => {
          const inst = (a.data_used as Record<string, unknown>)?.institution as string || 'Sin institución';
          if (!byInst[inst]) byInst[inst] = [];
          byInst[inst].push(a);
        });

        addSectionTitle('Alertas agrupadas por institución');
        autoTable(pdf, {
          startY: y,
          head: [['Institución', 'Total', 'Alta', 'Media', 'Baja', 'Nuevas']],
          body: Object.entries(byInst)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([inst, items]) => [
              inst.slice(0, 45),
              String(items.length),
              String(items.filter((a) => a.priority === 'high').length),
              String(items.filter((a) => a.priority === 'medium').length),
              String(items.filter((a) => a.priority === 'low').length),
              String(items.filter((a) => a.status === 'new').length),
            ]),
          theme: 'grid',
          headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          margin: { left: margin, right: margin },
        });
        y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

      } else if (reportId === 'alerts-detail') {
        addSectionTitle(`Detalle completo de alertas (${alertList.length} registros)`);
        autoTable(pdf, {
          startY: y,
          head: [['Código', 'Bandera', 'Título', 'Estado', 'Prioridad', 'Fecha']],
          body: alertList.slice(0, 100).map((a) => [
            a.alert_code || '',
            INDICATOR_SHORT[a.indicator_code] || a.indicator_code || '',
            (a.title || '').slice(0, 45),
            ALERT_STATUS_LABELS[a.status] || a.status,
            PRIORITY_LABELS[a.priority] || a.priority,
            new Date(a.created_at).toLocaleDateString('es-SV'),
          ]),
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235], fontSize: 7 },
          bodyStyles: { fontSize: 6 },
          margin: { left: margin, right: margin },
        });
        y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
        if (alertList.length > 100) {
          ensureSpace(5);
          pdf.setFontSize(7);
          pdf.setTextColor(100, 116, 139);
          pdf.text(`... y ${alertList.length - 100} alertas más no incluidas en este reporte.`, margin, y);
          y += 4;
        }

      } else if (reportId === 'processes-summary') {
        addSectionTitle(`Resumen de procesos (${processList.length} registros)`);
        autoTable(pdf, {
          startY: y,
          head: [['ID Proceso', 'Institución', 'Método', 'Monto USD', 'Oferentes', 'Estado', 'Alertas']],
          body: processList.slice(0, 80).map((p) => [
            p.process_id || '',
            (p.institution_name || '').slice(0, 30),
            p.procurement_method || '',
            (p.awarded_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
            String(p.number_of_bidders ?? ''),
            p.contract_status || '',
            String(p.alert_count ?? 0),
          ]),
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235], fontSize: 7 },
          bodyStyles: { fontSize: 6 },
          margin: { left: margin, right: margin },
        });
        y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
      }

      // ─── Footer on every page ───
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.3);
        pdf.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);

        pdf.setFontSize(6);
        pdf.setTextColor(148, 163, 184);
        pdf.setFont('helvetica', 'normal');
        pdf.text(
          'Las banderas rojas son indicadores preventivos que permiten priorizar procesos para análisis y revisión. ' +
          'Su activación no constituye por sí sola evidencia de irregularidad, fraude o corrupción.',
          margin, pageHeight - 12,
          { maxWidth: pageWidth - margin * 2 },
        );
        pdf.text(`SIGA-DINAC · DINAC · Reporte ${reportId_short}`, margin, pageHeight - 8);
        pdf.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      }

      const fileName = `reporte_${reportId}_${dateStr}.pdf`;
      pdf.save(fileName);

      await logAction('report_downloaded', 'reports', `${reportDef.title} (PDF)`, reportId_short);
      await loadHistory();
    } catch (err) {
      console.error('PDF generation error:', err);
    }
    setGenerating(null);
  };

  const handleDownloadExcel = async (reportId: ReportId) => {
    setGenerating(reportId);
    try {
      const userName = profile?.full_name || 'Usuario';
      const reportDef = REPORTS.find((r) => r.id === reportId)!;
      const reportIdShort = `RPT-${Date.now().toString().slice(-8)}`;
      const dateStr = new Date().toISOString().split('T')[0];

      const { data: alerts } = await buildAlertQuery();
      const alertList = (alerts || []) as Alert[];

      const wb = XLSX.utils.book_new();

      // Metadata sheet
      const metaRows = [
        ['SIGA-DINAC — Reporte interno'],
        ['DINAC'],
        ['Clasificación: Uso interno'],
        ["Reporte:", reportDef.title],
        ["ID:", reportIdShort],
        ["Generado por:", userName],
        ["Fecha:", new Date().toLocaleString('es-SV')],
      ];
      const filterParts: string[] = [];
      if (filters.indicatorCode) filterParts.push(`Bandera: ${INDICATOR_SHORT[filters.indicatorCode] || filters.indicatorCode}`);
      if (filters.status) filterParts.push(`Estado: ${ALERT_STATUS_LABELS[filters.status] || filters.status}`);
      if (filters.priority) filterParts.push(`Prioridad: ${PRIORITY_LABELS[filters.priority] || filters.priority}`);
      if (filters.dateFrom) filterParts.push(`Desde: ${filters.dateFrom}`);
      if (filters.dateTo) filterParts.push(`Hasta: ${filters.dateTo}`);
      metaRows.push(["Filtros:", filterParts.join(' | ') || 'Sin filtros']);
      metaRows.push([]);
      metaRows.push(['Las banderas rojas son indicadores preventivos. No constituyen evidencia de irregularidad, fraude o corrupción.']);
      const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
      wsMeta['!cols'] = [{ wch: 20 }, { wch: 70 }];
      XLSX.utils.book_append_sheet(wb, wsMeta, 'Información');

      if (reportId === 'alerts-detail') {
        const rows = alertList.map((a) => ({
          'Código': a.alert_code || '',
          'Bandera': INDICATOR_LABELS[a.indicator_code] || a.indicator_code || '',
          'Título': a.title || '',
          'Descripción': a.description || '',
          'Detalle cálculo': a.calculation_detail || '',
          'Umbral aplicado': a.threshold_applied || '',
          'Estado': ALERT_STATUS_LABELS[a.status] || a.status,
          'Prioridad': PRIORITY_LABELS[a.priority] || a.priority,
          'Asignado a': a.assigned_to || '',
          'Conclusión': a.conclusion || '',
          'Nivel alerta': a.alert_level || '',
          'Nota calidad': a.quality_note || '',
          'Fecha creación': new Date(a.created_at).toLocaleString('es-SV'),
          'Fecha actualización': new Date(a.updated_at).toLocaleString('es-SV'),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
          { wch: 20 }, { wch: 30 }, { wch: 45 }, { wch: 50 }, { wch: 50 },
          { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 40 },
          { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Alertas');

      } else if (reportId === 'alerts-by-indicator') {
        // Summary sheet
        const byIndicator: Record<string, Alert[]> = {};
        alertList.forEach((a) => {
          const code = a.indicator_code || 'unknown';
          if (!byIndicator[code]) byIndicator[code] = [];
          byIndicator[code].push(a);
        });
        const summaryRows = Object.entries(byIndicator).map(([code, items]) => ({
          'Bandera': INDICATOR_LABELS[code] || code,
          'Código': code,
          'Total': items.length,
          'Nuevas': items.filter((a) => a.status === 'new').length,
          'En revisión': items.filter((a) => a.status === 'in_review').length,
          'Cerradas': items.filter((a) => a.status === 'closed').length,
          'Alta prioridad': items.filter((a) => a.priority === 'high').length,
          'Media prioridad': items.filter((a) => a.priority === 'medium').length,
          'Baja prioridad': items.filter((a) => a.priority === 'low').length,
        }));
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        wsSummary['!cols'] = [
          { wch: 35 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
          { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen por bandera');

        // One sheet per indicator with full detail
        for (const [code, items] of Object.entries(byIndicator)) {
          const sheetName = (code || 'unknown').slice(0, 31);
          const detailRows = items.map((a) => ({
            'Código': a.alert_code || '',
            'Título': a.title || '',
            'Descripción': a.description || '',
            'Estado': ALERT_STATUS_LABELS[a.status] || a.status,
            'Prioridad': PRIORITY_LABELS[a.priority] || a.priority,
            'Detalle cálculo': a.calculation_detail || '',
            'Umbral': a.threshold_applied || '',
            'Fecha': new Date(a.created_at).toLocaleString('es-SV'),
          }));
          const wsDetail = XLSX.utils.json_to_sheet(detailRows);
          wsDetail['!cols'] = [
            { wch: 20 }, { wch: 45 }, { wch: 50 }, { wch: 15 }, { wch: 12 },
            { wch: 50 }, { wch: 20 }, { wch: 20 },
          ];
          XLSX.utils.book_append_sheet(wb, wsDetail, sheetName);
        }
      }

      const fileName = `reporte_${reportId}_${dateStr}.xlsx`;
      XLSX.writeFile(wb, fileName);

      await logAction('report_downloaded', 'reports', `${reportDef.title} (Excel)`, reportIdShort);
      await loadHistory();
    } catch (err) {
      console.error('Excel generation error:', err);
    }
    setGenerating(null);
  };

  const hasActiveFilters = filters.indicatorCode || filters.status || filters.priority || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Reportes' }]} onNavigate={() => {}} />
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
            <HelpTooltip text="Los reportes consolidan las alertas y métricas del sistema en documentos PDF descargables. Cada descarga queda registrada en la bitácora con usuario, fecha y hora." />
          </div>
          <p className="text-sm text-slate-500 mt-1">Generación de reportes internos en PDF. Todas las descargas quedan registradas.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <span className="text-xs font-medium text-blue-800">Uso interno</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <Filter className="w-4 h-4" />
            Filtros de reporte
            {hasActiveFilters ? (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                {[filters.indicatorCode, filters.status, filters.priority, filters.dateFrom, filters.dateTo].filter(Boolean).length}
              </span>
            ) : null}
          </button>
          {hasActiveFilters && (
            <button
              onClick={() => setFilters({ indicatorCode: '', status: '', priority: '', dateFrom: '', dateTo: '' })}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bandera roja</label>
              <select
                value={filters.indicatorCode}
                onChange={(e) => setFilters({ ...filters, indicatorCode: e.target.value })}
                className="input-field text-sm py-1.5"
              >
                <option value="">Todas</option>
                <option value="R018">R018 — Oferta única</option>
                <option value="R003">R003 — Plazo corto</option>
                <option value="R063">R063 — Contrato no publicado</option>
                <option value="R013">R013 — Uso no competitivo</option>
                <option value="R040">R040 — Concentración C-P</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="input-field text-sm py-1.5"
              >
                <option value="">Todos</option>
                {Object.entries(ALERT_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prioridad</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="input-field text-sm py-1.5"
              >
                <option value="">Todas</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="input-field text-sm py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="input-field text-sm py-1.5"
              />
            </div>
          </div>
        )}
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.filter((r) => !r.permission || hasPermission(r.permission)).map((report) => {
          const Icon = report.icon;
          const colors = COLOR_MAP[report.color] || COLOR_MAP.blue;
          const isGenerating = generating === report.id;
          const isPreviewing = previewData === report.id;
          return (
            <div
              key={report.id}
              className={`card p-5 flex flex-col gap-3 transition-all hover:shadow-lg ${isPreviewing ? 'ring-2 ring-blue-400' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 leading-snug">{report.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{report.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-auto pt-2">
                <button
                  onClick={() => handlePreview(report.id)}
                  disabled={isGenerating}
                  className="flex-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> Previsualizar
                </button>
                <button
                  onClick={() => handleDownload(report.id)}
                  disabled={isGenerating}
                  className={`flex-1 text-xs font-medium text-white bg-blue-600 ${colors.btn} rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60`}
                >
                  {isGenerating ? (
                    <><Loader className="w-3.5 h-3.5 animate-spin" /> Generando...</>
                  ) : (
                    <><FileDown className="w-3.5 h-3.5" /> PDF</>
                  )}
                </button>
                {(report.id === 'alerts-detail' || report.id === 'alerts-by-indicator') && (
                  <button
                    onClick={() => handleDownloadExcel(report.id)}
                    disabled={isGenerating}
                    className="flex-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <><Loader className="w-3.5 h-3.5 animate-spin" /> Generando...</>
                    ) : (
                      <><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview panel */}
      {previewData && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-700" />
              <h2 className="text-lg font-semibold text-slate-900">
                Previsualización: {REPORTS.find((r) => r.id === previewData)?.title}
              </h2>
            </div>
            <button
              onClick={() => setPreviewData(null)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cerrar
            </button>
          </div>

          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 text-slate-300 animate-spin" />
              <span className="text-sm text-slate-500 ml-2">Cargando datos...</span>
            </div>
          ) : previewData === 'executive-summary' && previewRows.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Total alertas', value: (previewRows[0] as Record<string, number>).totalAlerts, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
                { label: 'Total procesos', value: (previewRows[0] as Record<string, number>).totalProcesses, icon: FileSpreadsheet, color: 'text-blue-600 bg-blue-50' },
                { label: 'Prioridad alta', value: (previewRows[0] as Record<string, number>).highPriority, icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
                { label: 'Nuevas', value: (previewRows[0] as Record<string, number>).newAlerts, icon: AlertTriangle, color: 'text-purple-600 bg-purple-50' },
                { label: 'Cerradas', value: (previewRows[0] as Record<string, number>).closedAlerts, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-lg border border-slate-200 p-4 text-center">
                    <div className={`w-8 h-8 mx-auto rounded-lg ${stat.color} flex items-center justify-center mb-2`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          ) : previewRows.length > 0 ? (
            <div className="max-h-80 overflow-auto scrollbar-thin border border-slate-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {Object.keys(previewRows[0]).slice(0, 6).map((key) => (
                      <th key={key} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.slice(0, 15).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {Object.keys(previewRows[0]).slice(0, 6).map((key) => (
                        <td key={key} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                          {String(row[key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length > 15 && (
                <p className="text-xs text-slate-400 p-2 text-center">
                  Mostrando 15 de {previewRows.length} registros.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">No hay datos para mostrar con los filtros actuales.</p>
          )}

          {previewRows.length > 0 && (
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => handleDownload(previewData)}
                disabled={generating === previewData}
                className="btn-primary text-sm"
              >
                {generating === previewData ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Generando PDF...</>
                ) : (
                  <><FileDown className="w-4 h-4" /> Descargar PDF</>
                )}
              </button>
              {(previewData === 'alerts-detail' || previewData === 'alerts-by-indicator') && (
                <button
                  onClick={() => handleDownloadExcel(previewData)}
                  disabled={generating === previewData}
                  className="text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-4 py-2 transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  {generating === previewData ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Generando Excel...</>
                  ) : (
                    <><FileSpreadsheet className="w-4 h-4" /> Descargar Excel</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Download history */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Descargas recientes</h2>
          <HelpTooltip text="Cada descarga de reporte queda registrada en la bitácora de auditoría con el usuario, la fecha y el tipo de reporte." />
        </div>
        {loadingHistory ? (
          <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
            <Loader className="w-4 h-4 animate-spin" /> Cargando historial...
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400 py-3">No hay descargas registradas.</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate">{entry.report_type}</p>
                  <p className="text-[11px] text-slate-400">{entry.generated_by}</p>
                </div>
                <p className="text-xs text-slate-500 whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString('es-SV')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <InfoNote variant="info">
        Todos los reportes PDF y Excel incluyen: usuario que realizó la descarga, fecha y hora,
        clasificación «Uso interno», identificador único y filtros aplicados. Los PDF además incluyen el logo de DINAC.
        Las banderas rojas son indicadores preventivos y no constituyen evidencia de irregularidad.
      </InfoNote>
    </div>
  );
}

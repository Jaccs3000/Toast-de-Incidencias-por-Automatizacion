import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-chromium';
import { formatReportDuration } from '../../shared/reports/timeReport.js';
import { compactPersonName } from '../../shared/people/compactPersonName.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function displayDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function reportIcon(name) {
  const paths = {
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    stopwatch: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/>',
    project: '<path d="M4 7h16v13H4z"/><path d="M9 7V4h6v3M4 12h16M10 12v2h4v-2"/>',
  };
  return `<svg class="report-icon report-icon-${name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] ?? ''}</svg>`;
}

function statusClass(value) {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
  if (/en progreso|trabajando|en curso|desarrollo/.test(normalized)) return 'status-progress';
  if (/espera|pendiente|pausad|bloquead/.test(normalized)) return 'status-waiting';
  if (/cerrad|aceptad|resuelt|finalizad|completad|terminad/.test(normalized)) return 'status-closed';
  if (/produccion|productiv/.test(normalized)) return 'status-production';
  if (/cancelad|rechazad|fallid|error/.test(normalized)) return 'status-danger';
  if (/cread|nuev|abiert|por hacer|solicitad/.test(normalized)) return 'status-new';
  return 'status-other';
}

function safeImageUrl(value) {
  const source = String(value ?? '').trim();
  return /^(https?:\/\/|data:image\/)/i.test(source) ? source : '';
}

function jiraIssueIcon(issue) {
  const imageUrl = safeImageUrl(issue?.projectIconUrl) || safeImageUrl(issue?.issueTypeIconUrl);
  const image = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" />` : '';
  return `<span class="jira-issue-icon">${reportIcon('project')}${image}</span>`;
}

function correctionRows(corrections) {
  return corrections.map((correction) => `
    <div class="correction-row">
      <span class="correction-key">${jiraIssueIcon(correction)}<b>${escapeHtml(correction.correctionKey)}</b></span>
      <span>${escapeHtml(correction.summary)}</span>
      <span class="correction-status ${statusClass(correction.status)}"><span class="status-marker" aria-hidden="true"></span>${escapeHtml(correction.status)}</span>
    </div>`).join('');
}

function reportPage(issue, report, corrections) {
  const rows = correctionRows(corrections);
  return `<section class="page">
    <header class="report-header">
      <div><span class="eyebrow">Jira Notifications</span><div class="issue-heading">${jiraIssueIcon(issue)}<h1 class="issue-key">${escapeHtml(issue.issueKey)}</h1><span class="status ${statusClass(issue.status)}"><span class="status-marker" aria-hidden="true"></span>${escapeHtml(issue.status)}</span></div><p class="issue-summary">${escapeHtml(issue.summary)}</p></div>
    </header>
    <div class="meta-grid">
      <div><div class="meta-label"><span class="meta-icon">${reportIcon('project')}</span><label>Tipo de incidencia</label></div><strong>${escapeHtml(issue.issueType)}</strong></div>
      <div><div class="meta-label"><span class="meta-icon">${reportIcon('user')}</span><label>Responsable</label></div><strong>${escapeHtml(compactPersonName(issue.assignee))}</strong></div>
      <div><div class="meta-label"><span class="meta-icon">${reportIcon('user')}</span><label>Informador</label></div><strong>${escapeHtml(compactPersonName(issue.reporter))}</strong></div>
      <div><div class="meta-label"><span class="meta-icon">${reportIcon('calendar')}</span><label>Fecha de creacion</label></div><strong>${escapeHtml(displayDate(issue.created))}</strong></div>
      <div><div class="meta-label"><span class="meta-icon">${reportIcon('user')}</span><label>Tester</label></div><strong>${escapeHtml(compactPersonName(issue.tester))}</strong></div>
      <div><div class="meta-label"><span class="meta-icon">${reportIcon('project')}</span><label>Estado General</label></div><span class="status ${statusClass(issue.estadoGeneral)}"><span class="status-marker" aria-hidden="true"></span>${escapeHtml(issue.estadoGeneral)}</span></div>
    </div>
    <div class="dates"><div><div class="meta-label"><span class="meta-icon">${reportIcon('calendar')}</span><label>F. Asignacion</label></div><strong>${escapeHtml(displayDate(issue.assignedAt))}</strong></div><div><div class="meta-label"><span class="meta-icon">${reportIcon('calendar')}</span><label>F. Inicio</label></div><strong>${escapeHtml(displayDate(issue.startedAt))}</strong></div><div><div class="meta-label"><span class="meta-icon">${reportIcon('calendar')}</span><label>F. Cierre</label></div><strong>${escapeHtml(displayDate(issue.closedAt))}</strong></div></div>
    <div class="time-panel"><div class="time-metric"><div class="time-metric-label"><span class="time-metric-icon">${reportIcon('target')}</span><label>Planeado</label></div><strong>${escapeHtml(formatReportDuration(issue.plannedSeconds))}</strong></div><div class="time-metric"><div class="time-metric-label"><span class="time-metric-icon">${reportIcon('calendar')}</span><label>Tiempo reportado en Sprint</label></div><strong>${escapeHtml(formatReportDuration(issue.rangeSeconds))}</strong></div><div class="time-metric"><div class="time-metric-label"><span class="time-metric-icon">${reportIcon('stopwatch')}</span><label>Tiempo Total</label></div><strong>${escapeHtml(formatReportDuration(issue.totalSeconds))}</strong></div></div>
    <div class="corrections"><div class="section-title">Problemas presentados</div>${rows || '<p class="empty">No hay correcciones asociadas.</p>'}</div>
    <footer>Rango consultado: ${escapeHtml(report.fromDate)} a ${escapeHtml(report.toDate)} - Usuario: ${escapeHtml(compactPersonName(report.userDisplayName))}</footer>
  </section>`;
}

function correctionContinuationPage(issue, report, corrections, pageNumber) {
  const rows = correctionRows(corrections);
  return `<section class="page correction-continuation-page">
    <header class="report-header continuation-header">
      <div><span class="eyebrow">Problemas presentados</span><div class="issue-heading">${jiraIssueIcon(issue)}<h1 class="issue-key">${escapeHtml(issue.issueKey)}</h1><span class="status status-other">Correcciones ${escapeHtml(pageNumber)}</span></div><p class="issue-summary">${escapeHtml(issue.summary)}</p></div>
    </header>
    <div class="corrections corrections-only"><div class="section-title">Correcciones asociadas</div>${rows || '<p class="empty">No hay correcciones asociadas.</p>'}</div>
    <footer>Rango consultado: ${escapeHtml(report.fromDate)} a ${escapeHtml(report.toDate)} - Usuario: ${escapeHtml(compactPersonName(report.userDisplayName))}</footer>
  </section>`;
}

function buildReportPages(report) {
  const pages = [];
  for (const issue of report.issues.filter((item) => item.selected)) {
    const corrections = issue.corrections ?? [];
    pages.push(reportPage(issue, report, corrections.slice(0, 6)));
    for (let index = 6; index < corrections.length; index += 10) {
      pages.push(correctionContinuationPage(
        issue,
        report,
        corrections.slice(index, index + 10),
        `${Math.floor((index - 6) / 10) + 2}`,
      ));
    }
  }
  return pages;
}

export function buildTimeReportHtml(report) {
  const pages = buildReportPages(report);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: Letter landscape; margin: 0; } * { box-sizing: border-box; } body { margin: 0; background: #070d20; color: #edf1ff; font-family: "Segoe UI", Arial, sans-serif; } .page { position: relative; width: 279.4mm; min-height: 215.9mm; padding: 14mm 16mm 13mm; page-break-after: always; background: radial-gradient(circle at top right, rgba(83,105,218,.22), transparent 40%), #091128; } .page:last-child { page-break-after: auto; } .report-header { display: flex; justify-content: space-between; gap: 20px; align-items: start; padding-bottom: 12px; border-bottom: 1px solid rgba(145,160,255,.35); } .continuation-header { margin-bottom: 14px; } .eyebrow { color: #9eafff; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; } .issue-key { margin: 6px 0 4px; font-size: 18px; line-height: 1.15; font-weight: 600; } .report-header p.issue-summary { margin: 0; color: #edf1ff; font-size: 19px; line-height: 1.25; font-weight: 600; } .status { display:inline-flex; align-items:center; gap:6px; padding: 6px 12px; border:1px solid color-mix(in srgb, var(--status-color), transparent 45%); border-radius:99px; color:var(--status-color); background:color-mix(in srgb, var(--status-color), transparent 88%); font-size:11px; font-weight:600; } .status-progress, .correction-status.status-progress { --status-color:#71e6a4; } .status-waiting, .correction-status.status-waiting { --status-color:#f3c15b; } .status-closed, .correction-status.status-closed { --status-color:#ff7c87; } .status-production, .correction-status.status-production { --status-color:#5bdbe0; } .status-danger, .correction-status.status-danger { --status-color:#ff7c87; } .status-new, .correction-status.status-new { --status-color:#b9a5ff; } .status-other, .correction-status.status-other { --status-color:#9eafff; } .status-marker { display:inline-block; width:6px; height:6px; flex:0 0 6px; border-radius:50%; background:var(--status-color); box-shadow:0 0 0 2px color-mix(in srgb, var(--status-color), transparent 82%); } label { display:block; color:#93a2d0; font-size:10px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:5px; } strong { font-size:13px; font-weight:500; } .meta-label { display:flex; align-items:center; gap:6px; } .report-icon { width:14px; height:14px; flex:0 0 14px; fill:none; stroke:#9eafff; stroke-linecap:round; stroke-linejoin:round; stroke-width:1.8; } .meta-grid, .dates { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; padding:14px 0; border-bottom:1px solid rgba(145,160,255,.2); } .dates { grid-template-columns:repeat(3,1fr); } .time-panel { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; margin:16px 0; padding:14px 16px; border:1px solid rgba(145,160,255,.35); border-radius:14px; background:rgba(20,31,67,.65); } .time-panel > div { min-width:72px; } .corrections { margin-top:12px; padding:14px 16px; border:1px solid rgba(145,160,255,.3); border-radius:14px; } .corrections-only { margin-top:0; } .section-title { margin-bottom:10px; color:#c9d3ff; font-size:15px; font-weight:700; } .correction-row { display:grid; grid-template-columns:92px 1fr 100px; gap:10px; align-items:center; padding:8px 0; border-top:1px solid rgba(145,160,255,.15); font-size:11px; } .correction-row > b { color:#d8def3; font-weight:600; } .correction-row > span:not(.correction-status) { color:#d8def3; } .correction-status { display:inline-flex; width:max-content; max-width:100%; align-items:center; gap:5px; padding:3px 7px; border:1px solid color-mix(in srgb, var(--status-color), transparent 45%); border-radius:99px; color:var(--status-color); background:color-mix(in srgb, var(--status-color), transparent 90%); font-size:10px; line-height:1.2; white-space:normal; } .empty { color:#99a6ce; font-size:11px; } footer { position:absolute; bottom:8mm; color:#7786b6; font-size:9px; }
      .issue-heading { display:flex; align-items:center; flex-wrap:wrap; gap:12px; } .issue-heading .issue-key { margin:6px 0 4px; } .report-header p.issue-summary { max-width: 920px; } .status { flex:0 0 auto; } .meta-label { display:flex; align-items:center; gap:8px; margin-bottom:5px; } .meta-label label { margin:0; line-height:1.1; } .meta-icon, .time-metric-icon, .project-icon { display:grid; place-items:center; border:1px solid rgba(126,153,255,.42); background:rgba(45,77,160,.28); } .meta-icon { width:24px; height:24px; border-radius:7px; } .report-icon { width:15px; height:15px; flex:0 0 15px; fill:none; stroke:#a9bbff; stroke-linecap:round; stroke-linejoin:round; stroke-width:1.8; } .time-metric-label { display:flex; align-items:center; gap:8px; margin-bottom:7px; } .time-metric-label label { margin:0; line-height:1.1; } .time-metric-icon { width:26px; height:26px; border-color:rgba(104,171,255,.5); border-radius:8px; background:rgba(32,91,179,.25); } .time-metric-icon .report-icon { width:16px; height:16px; } .correction-row { grid-template-columns:124px 1fr 110px; } .correction-key { display:flex; min-width:0; align-items:center; gap:7px; } .correction-key b { overflow-wrap:anywhere; color:#d8def3; font-weight:600; } .project-icon { width:22px; height:22px; flex:0 0 22px; border-color:rgba(126,153,255,.42); border-radius:6px; background:rgba(45,77,160,.24); } .project-icon .report-icon { width:13px; height:13px; }
      /* Final visual hierarchy for the PDF. These overrides keep the source layout compact. */
      .page { position:relative; display:flex; flex-direction:column; width:279.4mm; min-height:215.9mm; padding:12.5mm 15mm 10mm; }
      .report-header { flex:0 0 auto; padding-bottom:11px; }
      .continuation-header { margin-bottom:13px; }
      .eyebrow { font-size:10px; letter-spacing:.16em; }
      .issue-heading { min-height:34px; align-items:center; gap:9px; }
      .issue-heading .issue-key { margin:0; font-size:16px; line-height:1.15; font-weight:650; }
      .report-header p.issue-summary { margin-top:5px; max-width:950px; font-size:20px; line-height:1.23; font-weight:600; }
      .jira-issue-icon { position:relative; display:grid; width:22px; height:22px; flex:0 0 22px; place-items:center; overflow:hidden; border:1px solid rgba(126,153,255,.48); border-radius:6px; background:rgba(45,77,160,.28); }
      .jira-issue-icon > .report-icon { width:14px; height:14px; stroke:#a9bbff; }
      .jira-issue-icon img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; background:#1d2b59; }
      .status, .correction-status { display:inline-flex; align-items:center; gap:5px; padding:3px 7px; border:1px solid color-mix(in srgb, var(--status-color), transparent 45%); border-radius:99px; font-size:10px; line-height:1.2; font-weight:600; }
      .status-marker { width:6px; height:6px; flex:0 0 6px; }
      .meta-grid, .dates { gap:14px; padding:12px 0; }
      .meta-grid > div, .dates > div { min-width:0; }
      .meta-label { min-height:28px; align-items:center; gap:7px; margin-bottom:5px; }
      .meta-label label, .time-metric-label label { margin:0; color:#a9b6e2; font-size:9.5px; line-height:1.1; }
      .meta-grid strong, .dates strong { display:block; overflow-wrap:anywhere; font-size:13.5px; line-height:1.3; font-weight:550; }
      .meta-icon, .time-metric-icon { display:grid; place-items:center; border:1px solid rgba(126,153,255,.52); background:rgba(45,77,160,.3); }
      .meta-icon { width:27px; height:27px; flex:0 0 27px; border-radius:8px; }
      .meta-icon .report-icon { width:16px; height:16px; }
      .time-panel { gap:16px; margin:14px 0 12px; padding:12px 14px; border-radius:13px; }
      .time-metric-label { min-height:30px; align-items:center; gap:8px; margin-bottom:6px; }
      .time-metric-icon { width:30px; height:30px; flex:0 0 30px; border-radius:9px; }
      .time-metric-icon .report-icon { width:18px; height:18px; }
      .time-metric strong { font-size:15px; line-height:1.2; font-weight:650; }
      .corrections { margin-top:0; padding:12px 15px; border-radius:13px; }
      .section-title { margin-bottom:7px; font-size:15px; line-height:1.2; }
      .correction-row { grid-template-columns:145px minmax(0, 1fr) 105px; gap:12px; min-height:37px; align-items:center; padding:6px 0; font-size:11.5px; line-height:1.3; }
      .correction-key { display:flex; min-width:0; align-items:center; gap:8px; }
      .correction-key .jira-issue-icon { width:24px; height:24px; flex-basis:24px; border-radius:7px; }
      .correction-key .jira-issue-icon > .report-icon { width:14px; height:14px; }
      .correction-key b { overflow-wrap:anywhere; }
      .correction-status { justify-self:end; max-width:105px; white-space:normal; }
      footer { position:static; margin-top:auto; padding-top:10px; color:#8191c0; font-size:9.5px; line-height:1.2; }
      .correction-continuation-page .corrections { margin-top:0; }
    </style></head><body>${pages.join('')}</body></html>`;
}

const PDF_BROWSER_OPTIONS = [
  { engine: 'Google Chrome', options: { channel: 'chrome', headless: true } },
  { engine: 'Microsoft Edge', options: { channel: 'msedge', headless: true } },
  { engine: 'Chromium integrado', options: { headless: true } },
];

export async function launchPdfBrowser(launch = chromium.launch.bind(chromium)) {
  const failures = [];
  for (const attempt of PDF_BROWSER_OPTIONS) {
    try {
      return {
        browser: await launch(attempt.options),
        engine: attempt.engine,
      };
    } catch (error) {
      failures.push({ engine: attempt.engine, error });
    }
  }

  const error = new Error(
    'No se pudo iniciar el motor para crear el PDF. Verifica que Google Chrome o Microsoft Edge esten disponibles y que Windows permita ejecutarlos.',
  );
  error.cause = failures.at(-1)?.error;
  error.attempts = failures.map(({ engine, error: failure }) => ({ engine, message: failure.message }));
  throw error;
}

export class TimeReportPdfGenerator {
  constructor({ exportsDir = path.join(process.cwd(), 'exports') } = {}) {
    this.exportsDir = exportsDir;
  }

  async generate(report) {
    await fs.mkdir(this.exportsDir, { recursive: true });
    const safeName = String(report.userDisplayName ?? 'usuario').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'usuario';
    const fileName = `informe-tiempos-${safeName}-${report.fromDate}-${report.toDate}.pdf`;
    const filePath = path.join(this.exportsDir, fileName);
    const pages = buildReportPages(report);
    const html = buildTimeReportHtml(report);
    const { browser } = await launchPdfBrowser();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.pdf({ path: filePath, format: 'Letter', landscape: true, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    } finally {
      await browser.close();
    }
    return { fileName, filePath, pages: pages.length };
  }
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-chromium';
import { formatReportDuration, isSprintOnlyProject } from '../../shared/reports/timeReport.js';
import { compactPersonName } from '../../shared/people/compactPersonName.js';
import { getPdfTheme, pdfThemeVariables } from './pdfThemes.js';

const PDF_PAGE_PROFILES = Object.freeze({
  ISSUE_FIRST: 'issue-first',
  ISSUE_FIRST_WITHOUT_IMPROVEMENT: 'issue-first-without-improvement',
  ISSUE_CONTINUATION: 'issue-continuation',
  IMPROVEMENT_ONLY: 'improvement-only',
  TABLE_ADDITIONAL: 'table-additional',
  TABLE_PENDING: 'table-pending',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapePreservingText(value) {
  return escapeHtml(value)
    .replaceAll('\r', '&#13;')
    .replaceAll('\n', '&#10;');
}

function displayDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function reportDateLabel(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return displayDate(value);
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic'];
  return `${match[3]}-${months[Number(match[2]) - 1]}-${match[1]}`;
}

function reportHeaderMeta(report) {
  return `<span class="report-range-header"><span class="report-range-icon">${reportIcon('calendar')}</span><span class="report-range-copy"><span>Reporte de tiempo</span><span>${escapeHtml(reportDateLabel(report.fromDate))} &#8594; ${escapeHtml(reportDateLabel(report.toDate))}</span><span>${escapeHtml(compactPersonName(report.userDisplayName))}</span></span></span>`;
}

function reportIcon(name) {
  const paths = {
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    stopwatch: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/>',
    sprint: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M12 13v3l2 1"/>',
    checklist: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m8 9 1.5 1.5L12 8M13.5 9H16M8 15l1.5 1.5L12 14M13.5 15H16"/>',
    project: '<path d="M4 7h16v13H4z"/><path d="M9 7V4h6v3M4 12h16M10 12v2h4v-2"/>',
    alert: '<path d="M12 3 22 21H2L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
    issueType: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    jira: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="m7 12 3 3 7-8"/>',
    improvement: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="4"/>',
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
  if (/cread/.test(normalized)) return 'status-created';
  if (/nuev|abiert|por hacer|solicitad/.test(normalized)) return 'status-new';
  return 'status-other';
}

function safeImageUrl(value) {
  const source = String(value ?? '').trim();
  return /^(https?:\/\/|data:image\/)/i.test(source) ? source : '';
}

function jiraIssueIcon(issue) {
  const imageUrl = safeImageUrl(issue?.projectIconUrl) || safeImageUrl(issue?.issueTypeIconUrl);
  const content = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="" />`
    : reportIcon('jira');
  return `<span class="jira-issue-icon jira-issue-type-icon">${content}</span>`;
}

function jiraIssueTypeIcon(issue) {
  const imageUrl = safeImageUrl(
    issue?.issueTypeIconUrl
      ?? issue?.issuetypeIconUrl
      ?? issue?.issuetype_icon_url
      ?? issue?.fields?.issuetype?.iconUrl,
  );
  const content = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="" />`
    : reportIcon('jira');
  return `<span class="jira-issue-icon jira-issue-type-icon">${content}</span>`;
}

function jiraHeaderIssueIcon(issue) {
  const imageUrl = safeImageUrl(
    issue?.issueTypeIconUrl
      ?? issue?.issuetypeIconUrl
      ?? issue?.issuetype_icon_url
      ?? issue?.fields?.issuetype?.iconUrl,
  );
  const content = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="" />`
    : reportIcon('jira');
  return `<span class="jira-issue-icon jira-issue-type-icon">${content}</span>`;
}

function correctionRows(corrections) {
  return corrections.map((correction) => `
    <div class="correction-row" data-correction-key="${escapeHtml(correction.correctionKey)}">
      <span class="correction-key">${jiraIssueTypeIcon(correction)}<b>${escapeHtml(correction.correctionKey)}</b></span>
      <span class="correction-summary" title="${escapeHtml(correction.summary)}">${escapeHtml(truncateIssueSummary(correction.summary))}</span>
      <span class="correction-status ${statusClass(correction.status)}"><span class="status-marker" aria-hidden="true"></span>${escapeHtml(correction.status)}</span>
    </div>`).join('');
}

function reportField(icon, label, value, valueClass = '', fieldClass = '') {
  const className = valueClass ? ` class="${valueClass}"` : '';
  const fieldName = fieldClass ? ` ${fieldClass}` : '';
  return `<div class="report-field${fieldName}"><div class="meta-label"><span class="meta-icon">${reportIcon(icon)}</span><label>${label}</label></div><strong${className}>${escapeHtml(value)}</strong></div>`;
}

function formatReportTimeWithPercentage(seconds, plannedSeconds, includePercentage = true) {
  const duration = formatReportDuration(seconds);
  const planned = Number(plannedSeconds);
  const value = Number(seconds);
  if (!includePercentage) return duration || '-';
  if (!Number.isFinite(planned) || planned <= 0 || !Number.isFinite(value)) return duration;
  return `${duration} (${Math.round((value / planned) * 100)}%)`;
}

function reportRemainingSeconds(issue) {
  const planned = Number(issue?.plannedSeconds);
  const total = Number(issue?.totalSeconds);
  if (!Number.isFinite(planned) || !Number.isFinite(total)) return issue?.remainingSeconds;
  return Math.max(planned - total, 0);
}

function truncateIssueSummary(value) {
  return String(value ?? '').trim();
}

function reportPage(
  issue,
  report,
  corrections,
  includeImprovement = true,
  summary = issue.summary,
  improvementMemo = issue.improvement?.memo,
  compactCorrection = false,
  compactImprovement = false,
  improvementFragmentIndex = null,
) {
  const improvementText = String(improvementMemo ?? issue.improvement?.memo ?? '');
  const showImprovement = includeImprovement && improvementText.length > 0;
  const improvement = showImprovement
    ? { ...(issue.improvement ?? {}), memo: improvementText }
    : null;
  const rows = correctionRows(corrections);
  const isLightTheme = String(report.pdfTheme ?? '').toLocaleLowerCase() === 'claro';
  const pageProfile = showImprovement
    ? PDF_PAGE_PROFILES.ISSUE_FIRST
    : PDF_PAGE_PROFILES.ISSUE_FIRST_WITHOUT_IMPROVEMENT;
  const fragmentAttribute = Number.isInteger(improvementFragmentIndex)
    ? ` data-improvement-fragment-index="${improvementFragmentIndex}"`
    : '';
  return `<section class="page issue-page${showImprovement ? '' : ' without-improvement'}${compactCorrection ? ' compact-correction-page' : ''}${compactImprovement ? ' compact-improvement-page' : ''}${compactCorrection === 'emergency' || compactImprovement === 'emergency' ? ' emergency-compact-page' : ''}" data-page-type="issue" data-page-profile="${pageProfile}" data-issue-key="${escapeHtml(issue.issueKey)}"${fragmentAttribute}>
    <header class="report-header">
      <div><span class="eyebrow">${reportHeaderMeta(report)}</span><div class="issue-heading"><span class="issue-identity">${jiraHeaderIssueIcon(issue)}<h1 class="issue-key">${escapeHtml(issue.issueKey)}</h1></span><span class="status ${statusClass(issue.status)}"><span class="status-marker" aria-hidden="true"></span>${escapeHtml(issue.status)}</span></div><p class="issue-summary">${escapeHtml(truncateIssueSummary(summary))}</p></div>
    </header>
    <div class="report-details-grid">
      ${reportField('project', 'Tipo de incidencia', issue.issueType, '', 'field-type')}
      ${reportField('user', 'Responsable', compactPersonName(issue.assignee), '', 'field-responsible')}
      ${reportField('user', 'Informador', compactPersonName(issue.reporter), '', 'field-reporter')}
      ${reportField('calendar', 'Fecha de creación', displayDate(issue.created), '', 'field-created')}
      ${reportField('user', 'Tester', compactPersonName(issue.tester), '', 'field-tester')}
      ${reportField('project', 'Estado General', issue.estadoGeneral, `general-state ${statusClass(issue.estadoGeneral)}`, 'field-general')}
      <div class="report-divider report-divider-general" aria-hidden="true"></div>
      ${reportField('calendar', 'F. Asignación', displayDate(issue.assignedAt), '', 'field-assigned')}
      ${reportField('calendar', 'F. Inicio', displayDate(issue.startedAt), '', 'field-started')}
      ${reportField('calendar', 'F. Cierre', displayDate(issue.closedAt), '', 'field-closed')}
      <div class="report-divider report-divider-dates" aria-hidden="true"></div>
      ${reportField('target', 'Planeado', formatReportDuration(issue.plannedSeconds) || '-', '', 'field-planned')}
      ${reportField('calendar', 'Tiempo reportado en Sprint', formatReportTimeWithPercentage(issue.rangeSeconds, issue.plannedSeconds, !isLightTheme), '', 'field-sprint')}
      ${reportField('stopwatch', 'Tiempo Total', isSprintOnlyProject(issue) ? '-' : formatReportTimeWithPercentage(issue.totalSeconds, issue.plannedSeconds, !isLightTheme), '', 'field-total')}
      ${reportField('stopwatch', 'Tiempo Restante', formatReportTimeWithPercentage(reportRemainingSeconds(issue), issue.plannedSeconds, !isLightTheme), '', 'field-remaining')}
    </div>
    <div class="corrections"><div class="section-title"><span class="section-title-icon">${reportIcon('alert')}</span>Problemas presentados</div>${rows || '<p class="empty">No hay correcciones asociadas.</p>'}</div>
    ${improvement ? `<div class="improvement-panel"><div class="section-title"><span class="section-title-icon">${reportIcon('improvement')}</span>Acciones de mejora</div><p>${escapePreservingText(improvement.memo)}</p></div>` : ''}
    <footer></footer>
  </section>`;
}

function correctionContinuationPage(
  issue,
  report,
  corrections,
  pageNumber,
  includeImprovement = false,
  improvementMemo = issue.improvement?.memo,
  compactCorrection = false,
  compactImprovement = false,
  improvementFragmentIndex = null,
) {
  const rows = correctionRows(corrections);
  const improvementText = String(improvementMemo ?? issue.improvement?.memo ?? '');
  const showImprovement = includeImprovement && improvementText.length > 0;
  const pageProfile = PDF_PAGE_PROFILES.ISSUE_CONTINUATION;
  const fragmentAttribute = Number.isInteger(improvementFragmentIndex)
    ? ` data-improvement-fragment-index="${improvementFragmentIndex}"`
    : '';
  return `<section class="page issue-page correction-continuation-page${compactCorrection ? ' compact-correction-page' : ''}${compactImprovement ? ' compact-improvement-page' : ''}${compactCorrection === 'emergency' || compactImprovement === 'emergency' ? ' emergency-compact-page' : ''}" data-page-type="issue-continuation" data-page-profile="${pageProfile}" data-issue-key="${escapeHtml(issue.issueKey)}"${fragmentAttribute}><!-- Correcciones ${escapeHtml(pageNumber)} -->
    <header class="report-header continuation-header">
      <div><span class="eyebrow">${reportHeaderMeta(report)}</span><div class="issue-heading"><span class="issue-identity">${jiraHeaderIssueIcon(issue)}<h1 class="issue-key">${escapeHtml(issue.issueKey)}</h1></span><span class="status ${statusClass(issue.status)}"><span class="status-marker" aria-hidden="true"></span>${escapeHtml(issue.status)}</span></div><p class="issue-summary">${escapeHtml(truncateIssueSummary(issue.summary))}</p></div>
    </header>
      <div class="corrections corrections-only"><div class="section-title"><span class="section-title-icon">${reportIcon('alert')}</span>Problemas presentados</div>${rows || '<p class="empty">No hay correcciones asociadas.</p>'}</div>
    ${showImprovement ? `<div class="improvement-panel"><div class="section-title"><span class="section-title-icon">${reportIcon('improvement')}</span>Acciones de mejora</div><p>${escapePreservingText(improvementText)}</p></div>` : ''}
    <footer></footer>
  </section>`;
}

function improvementOnlyPage(issue, report, pageNumber, memo = issue.improvement?.memo ?? '', compactImprovement = false, improvementFragmentIndex = null) {
  const text = String(memo ?? '');
  const fragmentAttribute = Number.isInteger(improvementFragmentIndex)
    ? ` data-improvement-fragment-index="${improvementFragmentIndex}"`
    : '';
  return `<section class="page issue-page correction-continuation-page improvement-only-page${compactImprovement ? ' compact-improvement-page' : ''}${compactImprovement === 'emergency' ? ' emergency-compact-page' : ''}" data-page-type="improvement" data-page-profile="${PDF_PAGE_PROFILES.IMPROVEMENT_ONLY}" data-issue-key="${escapeHtml(issue.issueKey)}"${fragmentAttribute}>
    <header class="report-header continuation-header">
      <div><span class="eyebrow">${reportHeaderMeta(report)}</span><div class="issue-heading"><span class="issue-identity">${jiraHeaderIssueIcon(issue)}<h1 class="issue-key">${escapeHtml(issue.issueKey)}</h1></span><span class="status ${statusClass(issue.status)}"><span class="status-marker" aria-hidden="true"></span>${escapeHtml(issue.status)}</span></div><p class="issue-summary">${escapeHtml(truncateIssueSummary(issue.summary))}</p></div>
    </header>
    ${text.length > 0 ? `<div class="improvement-panel"><div class="section-title"><span class="section-title-icon">${reportIcon('improvement')}</span>Acciones de mejora</div><p>${escapePreservingText(text)}</p></div>` : ''}
    <footer></footer>
  </section>`;
}

function summaryContinuationPage(issue, report, summary, pageNumber) {
  return `<section class="page issue-page summary-continuation-page" data-page-type="summary-continuation" data-issue-key="${escapeHtml(issue.issueKey)}">
    <header class="report-header continuation-header">
      <div><span class="eyebrow">${reportHeaderMeta(report)}</span><div class="issue-heading"><span class="issue-identity">${jiraHeaderIssueIcon(issue)}<h1 class="issue-key">${escapeHtml(issue.issueKey)}</h1></span><span class="status ${statusClass(issue.status)}"><span class="status-marker" aria-hidden="true"></span>${escapeHtml(issue.status)}</span></div><p class="issue-summary">${escapeHtml(truncateIssueSummary(summary))}</p></div>
    </header>
    <footer></footer>
  </section>`;
}

function groupedIssueRows(issues) {
  return issues.map((issue) => `
    <tr data-grouped-issue-key="${escapeHtml(issue.issueKey)}">
      <td>${jiraIssueTypeIcon(issue)}${escapeHtml(issue.issueKey)}</td>
      <td><span class="issue-type-badge ${issueTypeColorClass(issue.issueType)}">${escapeHtml(issue.issueType)}</span></td>
      <td class="long-text">${escapeHtml(truncateIssueSummary(issue.summary))}</td>
      <td>${escapeHtml(formatReportDuration(issue.rangeSeconds))}</td>
      <td><span class="status ${statusClass(issue.status)}"><span class="status-marker" aria-hidden="true"></span>${escapeHtml(issue.status)}</span></td>
    </tr>`).join('');
}

function groupedIssuesPage(issues, report, pageNumber, compactTable = false) {
  return `<section class="page grouped-issues-page${compactTable ? ' compact-table-page' : ''}${compactTable === 'emergency' ? ' emergency-compact-page' : ''}" data-page-type="table-grouped" data-page-profile="${PDF_PAGE_PROFILES.TABLE_ADDITIONAL}">
    <header class="report-header grouped-issues-header">
      <div><span class="eyebrow">${reportHeaderMeta(report)}</span><div class="grouped-issues-heading"><span class="grouped-heading-icon">${reportIcon('sprint')}</span><h1>Tiempos adicionales en el Sprint</h1></div></div>
    </header>
    <div class="grouped-issues-grid-wrap">
      <table class="grouped-issues-grid">
        <thead><tr><th>Incidencia</th><th>Tipo Incidencia</th><th>Asunto</th><th>Tiempo Sprint</th><th>Estado</th></tr></thead>
        <tbody>${groupedIssueRows(issues)}</tbody>
      </table>
    </div>
    <footer></footer>
  </section>`;
}

function issueTypeColorClass(value) {
  const text = String(value ?? '');
  const hash = [...text].reduce((total, character) => total + character.charCodeAt(0), 0);
  return `issue-type-color-${(hash % 6) + 1}`;
}

function pendingIssueRows(issues) {
  return issues.map((issue) => `
    <tr data-pending-issue-key="${escapeHtml(issue.issueKey ?? issue.issueId)}">
      <td>${jiraIssueTypeIcon(issue)}${escapeHtml(issue.issueKey)}</td>
      <td><span class="issue-type-badge ${issueTypeColorClass(issue.issueType)}">${escapeHtml(issue.issueType)}</span></td>
      <td class="long-text">${escapeHtml(truncateIssueSummary(issue.summary))}</td>
      <td>${escapeHtml(compactPersonName(issue.reporter))}</td>
      <td><span class="status ${statusClass(issue.status)}"><span class="status-marker" aria-hidden="true"></span>${escapeHtml(issue.status)}</span></td>
    </tr>`).join('');
}

function pendingIssuesPage(issues, report, pageNumber, compactTable = false) {
  return `<section class="page grouped-issues-page${compactTable ? ' compact-table-page' : ''}${compactTable === 'emergency' ? ' emergency-compact-page' : ''}" data-page-type="table-pending" data-page-profile="${PDF_PAGE_PROFILES.TABLE_PENDING}">
    <header class="report-header grouped-issues-header">
      <div><span class="eyebrow">${reportHeaderMeta(report)}</span><div class="grouped-issues-heading"><span class="grouped-heading-icon">${reportIcon('checklist')}</span><h1>Tareas Pendientes</h1></div></div>
    </header>
    <div class="grouped-issues-grid-wrap">
      <table class="grouped-issues-grid">
        <thead><tr><th>Incidencia</th><th>Tipo Incidencia</th><th>Asunto</th><th>Informador</th><th>Estado</th></tr></thead>
        <tbody>${pendingIssueRows(issues)}</tbody>
      </table>
    </div>
    <footer></footer>
  </section>`;
}

function renderPageSpec(report, pageSpec) {
  if (pageSpec.kind === 'issue-first') {
    return reportPage(
      pageSpec.issue,
      report,
      pageSpec.corrections ?? [],
      pageSpec.includeImprovement !== false,
      pageSpec.summary ?? pageSpec.issue.summary,
      pageSpec.improvementMemo,
      pageSpec.compactCorrection === true,
      pageSpec.compactImprovement === true,
      Number.isInteger(pageSpec.improvementFragmentIndex) ? pageSpec.improvementFragmentIndex : null,
    );
  }
  if (pageSpec.kind === 'issue-continuation') {
    return correctionContinuationPage(
      pageSpec.issue,
      report,
      pageSpec.corrections ?? [],
      pageSpec.pageNumber ?? 'continuacion',
      pageSpec.includeImprovement === true,
      pageSpec.improvementMemo,
      pageSpec.compactCorrection === true,
      pageSpec.compactImprovement === true,
      Number.isInteger(pageSpec.improvementFragmentIndex) ? pageSpec.improvementFragmentIndex : null,
    );
  }
  if (pageSpec.kind === 'improvement') {
    return improvementOnlyPage(
      pageSpec.issue,
      report,
      pageSpec.pageNumber ?? 'accion',
      pageSpec.memo ?? '',
      pageSpec.compactImprovement === true,
      Number.isInteger(pageSpec.improvementFragmentIndex) ? pageSpec.improvementFragmentIndex : null,
    );
  }
  if (pageSpec.kind === 'grouped') {
    return groupedIssuesPage(pageSpec.rows ?? [], report, pageSpec.pageNumber ?? 1, pageSpec.compactTable === true);
  }
  if (pageSpec.kind === 'pending') {
    return pendingIssuesPage(pageSpec.rows ?? [], report, pageSpec.pageNumber ?? 1, pageSpec.compactTable === true);
  }
  throw new Error(`Tipo de pagina candidata no soportado: ${String(pageSpec.kind)}`);
}

function buildReportPages(report, pagination = {}) {
  const selectedIssues = report.issues.filter((item) => item.selected);
  if (Array.isArray(pagination.domPages)) {
    return pagination.domPages.map((pageSpec) => renderPageSpec(report, pageSpec));
  }
  if (pagination.candidatePage) {
    return [renderPageSpec(report, pagination.candidatePage)];
  }
  // Production export always passes DOM-measured pages. Keep this fallback
  // only for direct HTML previews and never use numeric capacities here.
  return selectedIssues
    .filter((issue) => issue.grouped !== true)
    .map((issue) => reportPage(issue, report, issue.corrections ?? [], true))
    .concat(
      selectedIssues.some((issue) => issue.grouped === true)
        ? [groupedIssuesPage(selectedIssues.filter((issue) => issue.grouped === true), report, 1)]
        : [],
      (report.pendingIssues ?? []).length > 0
        ? [pendingIssuesPage(report.pendingIssues, report, 1)]
        : [],
    );
  /* Legacy capacity-based route removed from production. */
  /*
  // Capacities represent vertical space, not a fixed number of incidents.
  // Each row is measured from its summary so one-line and wrapped rows share
  // the available page area correctly.
  // Final export capacities must come from the measured DOM. Undefined values
  // are allowed only for provisional HTML built directly by the test suite.
  const firstPageCorrectionCapacity = pagination.firstPageCorrectionCapacity;
  const continuationCorrectionCapacity = pagination.continuationCorrectionCapacity;
  const finalContinuationCapacity = pagination.finalContinuationCapacity;
  const measuredCapacities = pagination.measuredCapacities;
  for (const issue of selectedIssues.filter((item) => item.grouped !== true)) {
    const issueMeasuredCapacities = pagination.measuredCapacitiesByIssue?.[String(issue.issueKey)] ?? {};
    const sharedMeasuredCapacities = pagination.finalized ? undefined : measuredCapacities;
    const resolvedFirstPageCapacity = issueMeasuredCapacities.firstPage
      ?? sharedMeasuredCapacities?.firstPage
      ?? firstPageCorrectionCapacity;
    // Legacy static HTML callers may still provide a provisional budget. The
    // real PDF generator uses the DOM candidate packer above instead.
    const resolvedContinuationCapacity = issueMeasuredCapacities.continuation
      ?? sharedMeasuredCapacities?.continuation
      ?? sharedMeasuredCapacities?.firstPage
      ?? continuationCorrectionCapacity;
    const resolvedFinalCapacity = issueMeasuredCapacities.final
      ?? sharedMeasuredCapacities?.final
      ?? sharedMeasuredCapacities?.continuation
      ?? sharedMeasuredCapacities?.firstPage
      ?? finalContinuationCapacity;
    const corrections = issue.corrections ?? [];
    if (pagination.finalized && corrections.length > 0
      && !Number.isFinite(resolvedFirstPageCapacity)) {
      throw new Error(`No se pudo medir el espacio del panel de problemas de ${issue.issueKey}`);
    }
    if (pagination.finalized && corrections.length > 1
      && !Number.isFinite(resolvedContinuationCapacity)) {
      throw new Error(`No se pudo medir el espacio de continuación de problemas de ${issue.issueKey}`);
    }
    const issueImprovementParts = pagination.improvementParts?.[String(issue.issueKey)];
    const improvementRemainingParts = pagination.improvementRemainingParts?.[String(issue.issueKey)];
    const forceImprovementSeparate = pagination.improvementSeparate?.[String(issue.issueKey)] === true;
    const summaryParts = [truncateIssueSummary(issue.summary)];
    const improvementMemoOnLastPage = pagination.improvementLastPageMemo?.[String(issue.issueKey)];
    const firstPageCapacity = resolvedFirstPageCapacity;
    const firstPageCorrections = takeCorrectionPage(
      corrections,
      0,
      firstPageCapacity,
      pagination.rowHeights,
      pagination.finalized,
      pagination.compactCorrectionRows,
    );
    const firstPageEnd = firstPageCorrections.length;
    const hasContinuationPages = firstPageEnd < corrections.length;
    const improvementPlacement = pagination.improvementPlacement?.[String(issue.issueKey)];
    const keepImprovementSeparate = Boolean(
      issue.improvement
      && corrections.length > 0
      && !['first-page', 'last-page', 'last-page-fragment'].includes(improvementPlacement),
    );
    const improvementOnLastPage = (
      ['last-page', 'last-page-fragment'].includes(improvementPlacement)
      && (hasContinuationPages || improvementMemoOnLastPage !== undefined)
    );
    const hasRemainingImprovement = improvementPlacement === 'last-page-fragment'
      && Array.isArray(improvementRemainingParts)
      && improvementRemainingParts.some((part) => String(part ?? '').length > 0);
    const splitStandaloneImprovement = Boolean(
      issue.improvement
      && corrections.length === 0
      && (forceImprovementSeparate
        || (Array.isArray(issueImprovementParts) && issueImprovementParts.length > 1))
      && improvementPlacement !== 'last-page-fragment',
    );
    const includeImprovement = !keepImprovementSeparate
      && !hasContinuationPages
      && !splitStandaloneImprovement
      && (!pagination.measurementPass || corrections.length === 0);
    pages.push(reportPage(
      issue,
      report,
      firstPageCorrections,
      includeImprovement,
      summaryParts[0],
      !hasContinuationPages && improvementMemoOnLastPage !== undefined
        ? improvementMemoOnLastPage
        : undefined,
      firstPageCorrections.some((correction) => pagination.compactCorrectionRows?.[String(correction.correctionKey)]),
    ));
    for (let index = firstPageEnd; index < corrections.length;) {
      const remainingUnits = corrections
        .slice(index)
        .reduce((total, correction) => total + correctionRowUnits(correction, pagination.rowHeights), 0);
      // Prefer the final-page budget as soon as all remaining rows, including
      // the action panel reservation, fit there. This lets the last rows stay
      // with the preceding page instead of creating a sparse continuation.
      const pageCapacity = Number.isFinite(resolvedFinalCapacity)
        && remainingUnits <= resolvedFinalCapacity
        ? resolvedFinalCapacity
        : resolvedContinuationCapacity;
      const continuationCorrections = takeCorrectionPage(
        corrections,
        index,
        pageCapacity,
        pagination.rowHeights,
        pagination.finalized,
        pagination.compactCorrectionRows,
      );
      const nextIndex = index + continuationCorrections.length;
      const isLastContinuationPage = nextIndex >= corrections.length;
      pages.push(correctionContinuationPage(
        issue,
        report,
        continuationCorrections,
        `${pages.filter((page) => page.includes('correction-continuation-page')).length + 2}`,
        isLastContinuationPage && !keepImprovementSeparate,
        isLastContinuationPage && improvementOnLastPage
          ? improvementMemoOnLastPage
          : undefined,
        continuationCorrections.some((correction) => pagination.compactCorrectionRows?.[String(correction.correctionKey)]),
      ));
      index = nextIndex;
    }
    if (issue.improvement && (
      (hasContinuationPages && !improvementOnLastPage)
      || keepImprovementSeparate
      || splitStandaloneImprovement
      || hasRemainingImprovement
    )) {
      if (pagination.finalized && !Array.isArray(issueImprovementParts)) {
        throw new Error(`No se pudo medir el texto de acciones de mejora de ${issue.issueKey}`);
      }
      const memoParts = improvementPlacement === 'last-page-fragment'
        && Array.isArray(improvementRemainingParts)
        ? improvementRemainingParts
        : Array.isArray(issueImprovementParts) && issueImprovementParts.length > 0
        ? issueImprovementParts
        : [String(issue.improvement.memo ?? '')];
      memoParts.forEach((memo, memoIndex) => pages.push(improvementOnlyPage(
        issue,
        report,
        `${pages.filter((page) => page.includes('correction-continuation-page')).length + 2}`,
        memo,
      )));
    }
  }
  return pages;
  */
}

export function buildTimeReportHtml(report, pagination = {}) {
  const pages = buildReportPages(report, pagination);
  const theme = getPdfTheme(report.pdfTheme);
  const themeVariables = pdfThemeVariables(theme.name);
  const themeClass = theme.name === 'Claro' ? 'pdf-theme-claro' : 'pdf-theme-oscuro';
  const darkThemeOverrides = theme.name === 'Oscuro' ? `
      /* Keep the dark palette while using the same final geometry as Claro. */
      body.pdf-theme-oscuro { background:#070d20; color:#edf1ff; font-family:"Trebuchet MS", "Segoe UI", sans-serif; }
      body.pdf-theme-oscuro .page { width:338.67mm !important; height:190.5mm !important; min-height:190.5mm !important; max-height:190.5mm !important; padding:5mm 10.5mm 8mm; overflow:visible; background:linear-gradient(135deg,#091b38 0%,#101e3b 55%,#0b2949 100%); }
      body.pdf-theme-oscuro .page::before { content:""; position:absolute; inset:0 0 auto 0; height:38mm; z-index:0; background:linear-gradient(118deg,#168fc8 0%,#123f83 20%,#071e4a 62%,#105b9b 100%); clip-path:polygon(0 0,100% 0,100% 72%,95% 100%,0 100%); }
      body.pdf-theme-oscuro .page::after { content:""; position:absolute; top:0; right:0; width:58mm; height:38mm; z-index:0; background:linear-gradient(135deg,transparent 42%,rgba(27,178,218,.82) 43%,rgba(27,178,218,.82) 61%,transparent 62%); opacity:.9; }
      body.pdf-theme-oscuro .page:last-child::after { top:auto; bottom:0; height:30mm; transform:rotate(180deg); opacity:.58; }
      body.pdf-theme-oscuro .report-header, body.pdf-theme-oscuro .report-details-grid, body.pdf-theme-oscuro .corrections, body.pdf-theme-oscuro footer { position:relative; z-index:1; }
      body.pdf-theme-oscuro .report-header { min-height:33mm; height:33mm; padding:1.5mm 2.5mm 3mm; border:0; }
      body.pdf-theme-oscuro .report-header > div { width:calc(100% - 280px); }
      body.pdf-theme-oscuro .eyebrow { display:block; color:#dce8ff; font-size:0; letter-spacing:0; text-transform:none; }
      body.pdf-theme-oscuro .issue-heading { gap:8px; }
      body.pdf-theme-oscuro .issue-identity { display:inline-flex; align-items:center; gap:3mm; padding:1.5mm 4mm 1.5mm 2.5mm; border-radius:7mm; background:linear-gradient(135deg,#287ebc,#145aa5); }
      body.pdf-theme-oscuro .issue-heading .issue-key { padding:0; margin:0; border-radius:0; color:#ffe14a; background:none; font-size:21px; text-shadow:0 1px 1px rgba(0,0,0,.35); }
      body.pdf-theme-oscuro .issue-heading .jira-issue-icon { width:9mm; height:9mm; border:0; border-radius:2.5mm; background:#f2f6ff; }
      body.pdf-theme-oscuro .issue-heading .jira-issue-icon .report-icon { stroke:#2d78c8; }
      body.pdf-theme-oscuro .issue-heading .jira-issue-type-icon .report-icon { display:block; width:6mm; height:6mm; stroke:#2d78c8; stroke-width:1.8; }
      body.pdf-theme-oscuro .issue-heading .jira-issue-type-icon img { z-index:1; }
      body.pdf-theme-oscuro .issue-heading > .status { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; height:24px; min-height:24px; min-width:78px; padding:3px 7px; font-size:13px; line-height:1.2; white-space:nowrap; }
      body.pdf-theme-oscuro .issue-heading > .status-closed { color:#ffb7c0; background:rgba(255,124,135,.18); border-color:rgba(255,124,135,.72); }
      body.pdf-theme-oscuro .issue-heading > .status-progress { color:#b7f3cf; background:rgba(113,230,164,.18); border-color:rgba(113,230,164,.68); }
      body.pdf-theme-oscuro .issue-heading > .status-production { color:#b7f5f5; background:rgba(91,219,224,.18); border-color:rgba(91,219,224,.68); }
      body.pdf-theme-oscuro .issue-heading > .status-created { color:#c9dcff; background:rgba(127,169,255,.2); border-color:rgba(127,169,255,.7); }
      body.pdf-theme-oscuro .issue-heading > .status-new { color:#eadfff; background:rgba(185,165,255,.2); border-color:rgba(185,165,255,.7); }
      body.pdf-theme-oscuro .issue-heading > .status-waiting { color:#ffe8a8; background:rgba(243,193,91,.2); border-color:rgba(243,193,91,.7); }
      body.pdf-theme-oscuro .issue-heading > .status-other { color:#d5ddff; background:rgba(158,175,255,.2); border-color:rgba(158,175,255,.7); }
      body.pdf-theme-oscuro .report-header p.issue-summary { width:100%; max-width:100%; min-height:17mm; margin-top:3mm; color:#edf1ff; font-size:23px; line-height:1.14; font-weight:700; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; text-overflow:ellipsis; }
      body.pdf-theme-oscuro .report-range-header { top:50%; right:0; transform:translateY(-50%); display:flex; align-items:stretch; gap:4mm; padding:3.5mm 5mm; color:#fff; font-size:16px; line-height:1.42; border:1px solid rgba(169,187,255,.78); border-radius:2mm; background:#061d46; }
      body.pdf-theme-oscuro .report-range-icon { display:none; }
      body.pdf-theme-oscuro .report-range-copy { display:flex; flex-direction:column; align-items:flex-start; padding-bottom:0; }
      body.pdf-theme-oscuro .report-range-copy > span:first-child { color:#fff; font-size:19px; font-weight:700; }
      body.pdf-theme-oscuro .report-range-copy > span:nth-child(2) { color:#ffe14a; font-size:16px; font-weight:700; text-shadow:0 1px 1px rgba(0,0,0,.35); }
      body.pdf-theme-oscuro .report-range-copy > span:last-child { color:#ffe14a; font-size:17px; font-weight:700; }
      body.pdf-theme-oscuro .report-details-grid { grid-template-rows:minmax(48px,auto) minmax(48px,auto) 8px minmax(48px,auto) 8px minmax(48px,auto); margin-top:2mm; padding:4mm 4mm 2mm; border:1px solid rgba(145,160,255,.55); border-radius:5mm; background:rgba(14,29,62,.92); box-shadow:0 3mm 8mm rgba(0,0,0,.24); }
      body.pdf-theme-oscuro .report-field { padding:0 5mm 2mm; border-right:1px solid rgba(145,160,255,.24); }
      body.pdf-theme-oscuro .field-general, body.pdf-theme-oscuro .field-reporter, body.pdf-theme-oscuro .field-closed, body.pdf-theme-oscuro .field-remaining { border-right:0; }
      body.pdf-theme-oscuro .report-field .meta-icon, body.pdf-theme-oscuro .report-field .time-metric-icon { width:8mm; height:8mm; flex:0 0 8mm; border:0; border-radius:2mm; }
      body.pdf-theme-oscuro .report-field .meta-icon .report-icon { stroke:#fff; }
      body.pdf-theme-oscuro .report-field label { color:#a9b6e2 !important; font-size:12px; font-weight:700; }
      body.pdf-theme-oscuro .report-field strong { color:#edf1ff !important; font-size:17px; font-weight:700; }
      body.pdf-theme-oscuro .field-type .meta-icon, body.pdf-theme-oscuro .field-tester .meta-icon { background:#159de4; }
      body.pdf-theme-oscuro .field-responsible .meta-icon, body.pdf-theme-oscuro .field-reporter .meta-icon { background:#7953e8; }
      body.pdf-theme-oscuro .field-created .meta-icon { background:#22a967; }
      body.pdf-theme-oscuro .field-general .meta-icon { background:#f49a13; }
      body.pdf-theme-oscuro .field-assigned .meta-icon, body.pdf-theme-oscuro .field-closed .meta-icon { background:#7852e8; }
      body.pdf-theme-oscuro .field-started .meta-icon { background:#18a8c9; }
      body.pdf-theme-oscuro .field-planned .meta-icon { background:#1264d4; }
      body.pdf-theme-oscuro .field-sprint .meta-icon { background:#3294e6; }
      body.pdf-theme-oscuro .field-total .meta-icon { background:#18a947; }
      body.pdf-theme-oscuro .field-remaining .meta-icon { background:#7952e7; }
      body.pdf-theme-oscuro .field-general .general-state { color:#ffe2a1 !important; }
      body.pdf-theme-oscuro .report-field.field-general .general-state { display:block; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; }
      body.pdf-theme-oscuro .report-divider { border-color:rgba(145,160,255,.28); }
      body.pdf-theme-oscuro .corrections { margin-top:5mm; padding:0 4mm 2mm; border:2px solid #4f8ce3; border-radius:5mm; background:#0d1d3d; overflow:visible; box-shadow:0 2mm 6mm rgba(0,0,0,.2); }
      body.pdf-theme-oscuro .section-title { margin:0 -4mm 0; padding:2.5mm 5mm; color:#fff; font-size:18px; background:linear-gradient(100deg,#303f9d,#397bd0); }
      body.pdf-theme-oscuro .section-title-icon { display:inline-grid; width:8mm; height:8mm; margin-right:3mm; place-items:center; vertical-align:middle; border:1px solid rgba(255,255,255,.7); border-radius:50%; background:rgba(255,255,255,.22); }
      body.pdf-theme-oscuro .section-title-icon .report-icon { width:5mm; height:5mm; stroke:#fff; }
      body.pdf-theme-oscuro .correction-row { grid-template-columns:minmax(0,145px) minmax(0,1fr) minmax(0,105px); width:100%; min-width:0; min-height:11mm; padding:1.5mm 0; border-color:rgba(145,160,255,.24); color:#edf1ff; font-size:16.8px; line-height:1.2; break-inside:avoid; page-break-inside:avoid; }
      body.pdf-theme-oscuro .correction-row > span:not(.correction-status), body.pdf-theme-oscuro .correction-key b { color:#edf1ff; }
      body.pdf-theme-oscuro .correction-key { gap:3mm; }
      body.pdf-theme-oscuro .correction-row > span:not(.correction-status) { min-width:0; overflow-wrap:anywhere; word-break:break-word; }
      body.pdf-theme-oscuro .correction-status { width:100%; max-width:105px; min-width:0; overflow-wrap:anywhere; word-break:break-word; }
      body.pdf-theme-oscuro .correction-summary { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; text-overflow:ellipsis; }
      body.pdf-theme-oscuro .correction-key b { padding:1mm 2.5mm; border-radius:5mm; background:rgba(45,77,160,.46); color:#c9e5ff; font-size:15px; }
      body.pdf-theme-oscuro .correction-key .jira-issue-icon { border:0; border-radius:2mm; background:#5f49d6; }
      body.pdf-theme-oscuro .correction-key .jira-issue-icon .report-icon { stroke:#fff; }
      body.pdf-theme-oscuro .correction-status { color:#ffb7c0; background:rgba(255,124,135,.18); border-color:rgba(255,124,135,.7); font-size:15px; }
      body.pdf-theme-oscuro .correction-status .status-marker { background:#ff7c87; }
      body.pdf-theme-oscuro .corrections .empty { margin:4mm 0 3mm; font-size:16.5px; line-height:1.2; color:#99a6ce !important; }
      body.pdf-theme-oscuro .corrections:has(.empty) { min-height:24mm; overflow:visible; }
      body.pdf-theme-oscuro .corrections:has(.empty) .empty { margin:2.5mm 0 2mm; }
      body.pdf-theme-oscuro .improvement-panel { margin-top:4mm; padding:0 4mm 3mm; border:1px solid rgba(243,193,91,.65); border-radius:4mm; overflow:visible; color:#edf1ff; background:rgba(64,45,23,.68); min-height:24mm; }
      body.pdf-theme-oscuro .improvement-panel .section-title { margin:0 -4mm 2mm; padding:2.5mm 5mm; font-size:0; background:linear-gradient(100deg,#303f9d,#397bd0); }
      body.pdf-theme-oscuro .improvement-panel .section-title::after { content:"Acciones de mejora"; font-size:17px; vertical-align:middle; }
      body.pdf-theme-oscuro .improvement-panel p { margin:0; padding:0 1mm; color:#ffe2a1; font-size:13px; line-height:1.3; white-space:pre-wrap; overflow-wrap:anywhere; }
      body.pdf-theme-oscuro .grouped-issues-header { align-items:center; }
      body.pdf-theme-oscuro .grouped-issues-heading { display:flex; align-items:center; gap:10px; min-height:100%; }
      body.pdf-theme-oscuro .grouped-heading-icon { display:grid; place-items:center; width:28px; height:28px; flex:0 0 28px; border:1px solid rgba(255,255,255,.65); border-radius:8px; background:rgba(255,255,255,.16); }
      body.pdf-theme-oscuro .grouped-heading-icon .report-icon { width:17px; height:17px; stroke:#fff; }
      body.pdf-theme-oscuro .grouped-issues-heading h1 { margin:0; color:#fff; font-size:30px; line-height:1.15; font-weight:700; text-shadow:0 1px 1px rgba(0,0,0,.25); }
      body.pdf-theme-oscuro .grouped-issues-page .report-header { min-height:31mm; }
      body.pdf-theme-oscuro .grouped-issues-page .grouped-issues-grid-wrap { margin-top:5mm; background:#0d1d3d; }
      body.pdf-theme-oscuro .grouped-issues-page .grouped-issues-grid th { color:#a9b6e2; background:rgba(45,77,160,.42); }
      body.pdf-theme-oscuro .grouped-issues-page .grouped-issues-grid td { color:#edf1ff; background:#0d1d3d; }
      body.pdf-theme-oscuro .grouped-issues-page .grouped-issues-grid .status { min-width:88px; justify-content:center; padding:6px 12px; border-radius:99px; font-size:13px; font-weight:600; }
      body.pdf-theme-oscuro .grouped-issues-page .grouped-issues-grid .status-created { color:#c9dcff; background:rgba(127,169,255,.2); border-color:rgba(127,169,255,.7); }
      body.pdf-theme-oscuro .grouped-issues-page .grouped-issues-grid .status-new { color:#eadfff; background:rgba(185,165,255,.2); border-color:rgba(185,165,255,.7); }
      body.pdf-theme-oscuro .grouped-issues-page .grouped-issues-grid .status-waiting { color:#ffe8a8; background:rgba(243,193,91,.2); border-color:rgba(243,193,91,.7); }
      body.pdf-theme-oscuro .grouped-issues-page .grouped-issues-grid .status-progress { color:#b7f3cf; background:rgba(113,230,164,.2); border-color:rgba(113,230,164,.7); }
      body.pdf-theme-oscuro .grouped-issues-page .grouped-issues-grid .status-closed,
      body.pdf-theme-oscuro .grouped-issues-page .grouped-issues-grid .status-danger { color:#ffb7c0; background:rgba(255,124,135,.18); border-color:rgba(255,124,135,.7); }
      body.pdf-theme-oscuro .grouped-issues-page .grouped-issues-grid .status-marker { width:6px; height:6px; flex:0 0 6px; }
    ` : '';
  const lightThemeOverrides = theme.name === 'Claro' ? `
      @page { size: 338.67mm 190.5mm; margin: 0; }
      body.pdf-theme-claro { background:#edf4fb; color:#102d69; font-family:"Trebuchet MS", "Segoe UI", sans-serif; }
      body.pdf-theme-claro .page { width:338.67mm !important; height:190.5mm !important; min-height:190.5mm !important; max-height:190.5mm !important; padding:5mm 10.5mm 8mm; overflow:visible; background:linear-gradient(135deg,#edf7ff 0%,#ffffff 55%,#e8f5ff 100%); }
      body.pdf-theme-claro .page::before { content:""; position:absolute; inset:0 0 auto 0; height:38mm; z-index:0; background:linear-gradient(118deg,#2da9e8 0%,#0c448b 20%,#073b78 62%,#1461a7 100%); clip-path:polygon(0 0,100% 0,100% 72%,95% 100%,0 100%); }
      body.pdf-theme-claro .page::after { content:""; position:absolute; top:0; right:0; width:58mm; height:38mm; z-index:0; background:linear-gradient(135deg,transparent 42%,rgba(44,190,226,.9) 43%,rgba(44,190,226,.9) 61%,transparent 62%); opacity:.9; }
      body.pdf-theme-claro .page:last-child::after { top:auto; bottom:0; height:30mm; transform:rotate(180deg); opacity:.58; }
      body.pdf-theme-claro .report-header, body.pdf-theme-claro .report-details-grid, body.pdf-theme-claro .corrections, body.pdf-theme-claro footer { position:relative; z-index:1; }
      body.pdf-theme-claro .report-header { min-height:33mm; height:33mm; padding:1.5mm 2.5mm 3mm; border:0; }
      body.pdf-theme-claro .report-header > div { width:calc(100% - 280px); }
      body.pdf-theme-claro .eyebrow { display:block; color:#fff; font-size:0; letter-spacing:0; text-transform:none; }
      body.pdf-theme-claro .issue-heading { gap:8px; }
      body.pdf-theme-claro .issue-identity { display:inline-flex; align-items:center; gap:3mm; padding:1.5mm 4mm 1.5mm 2.5mm; border-radius:7mm; background:linear-gradient(135deg,#4ca8ed,#0870cf); }
      body.pdf-theme-claro .issue-heading .issue-key { padding:0; margin:0; border-radius:0; color:#ffe14a; background:none; font-size:21px; text-shadow:0 1px 1px rgba(0,0,0,.2); }
      body.pdf-theme-claro .issue-heading .jira-issue-icon { width:9mm; height:9mm; border:0; border-radius:2.5mm; background:#fff; }
      body.pdf-theme-claro .issue-heading .jira-issue-icon .report-icon { stroke:#2d78c8; }
      body.pdf-theme-claro .issue-heading .jira-issue-type-icon .report-icon { display:block; width:6mm; height:6mm; stroke:#2d78c8; stroke-width:1.8; }
      body.pdf-theme-claro .issue-heading .jira-issue-type-icon img { z-index:1; }
      body.pdf-theme-claro .status { padding:2.5mm 4mm; color:#1d1d1d; background:#ffd348; border:0; font-size:14px; }
      body.pdf-theme-claro .status-waiting { --status-color:#202020; padding:3px 7px; font-size:15px; border:1px solid #e3b52f; }
      body.pdf-theme-claro .issue-heading > .status-progress,
      body.pdf-theme-claro .issue-heading > .status-production,
      body.pdf-theme-claro .issue-heading > .status-new,
      body.pdf-theme-claro .issue-heading > .status-other { padding:3px 7px; font-size:15px; border:1px solid #e3b52f; color:#172b4d; background:#ffd348; }
      body.pdf-theme-claro .issue-heading > .status-progress { color:#17643d; background:#c9f2dc; border-color:#91d9b1; --status-color:#198754; }
      body.pdf-theme-claro .issue-heading > .status-production { color:#9a6500; background:#fff0c2; border-color:#e3c56e; --status-color:#9a6500; }
      body.pdf-theme-claro .issue-heading > .status-created { color:#2453a3; background:#dceaff; border-color:#a9c9f6; --status-color:#4776c5; }
      body.pdf-theme-claro .issue-heading > .status-new,
      body.pdf-theme-claro .issue-heading > .status-other { --status-color:#5264a8; }
      body.pdf-theme-claro .issue-heading > .status-new { color:#6840a4; background:#eee2ff; border-color:#cdb3ef; --status-color:#8052bd; }
      body.pdf-theme-claro .issue-heading .status-closed { padding:3px 7px; color:#cf1d35; background:#ffe5e8; border:1px solid #ffb7c0; font-size:13px; }
      body.pdf-theme-claro .issue-heading .status-closed .status-marker { background:#e51d38; box-shadow:0 0 0 2px rgba(229,29,56,.18); }
      body.pdf-theme-claro .issue-heading > .status { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; height:24px; min-height:24px; min-width:78px; padding:3px 7px; font-size:13px; line-height:1.2; white-space:nowrap; }
      body.pdf-theme-claro .report-header p.issue-summary { width:100%; max-width:100%; min-height:17mm; margin-top:3mm; color:#eaf4ff; font-size:23px; line-height:1.14; font-weight:700; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; text-overflow:ellipsis; }
      body.pdf-theme-claro .report-range-header { top:50%; right:0; transform:translateY(-50%); color:#fff; font-size:16px; line-height:1.42; }
      body.pdf-theme-claro .report-range-header { display:flex; align-items:stretch; gap:4mm; padding:3.5mm 5mm; border:1px solid rgba(255,255,255,.8); border-radius:2mm; background:#073b78; }
      body.pdf-theme-claro .report-range-icon { display:none; }
      body.pdf-theme-claro .report-range-icon .report-icon { width:8mm; height:8mm; stroke:#fff; }
      body.pdf-theme-claro .report-range-copy { display:flex; flex-direction:column; align-items:flex-start; padding-bottom:0; }
      body.pdf-theme-claro .report-range-copy > span:first-child { color:#fff; font-size:19px; font-weight:700; }
      body.pdf-theme-claro .report-range-copy > span:nth-child(2) { color:#FFE14A; font-size:16px; font-weight:700; text-shadow:0 1px 1px rgba(0,0,0,.2); }
      body.pdf-theme-claro .report-range-copy > span:last-child { color:#ffe14a; font-size:17px; font-weight:700; }
      body.pdf-theme-claro .report-details-grid { grid-template-rows:minmax(48px,auto) minmax(48px,auto) 8px minmax(48px,auto) 8px minmax(48px,auto); margin-top:2mm; padding:4mm 4mm 2mm; border:1px solid #b9d4f0; border-radius:5mm; background:rgba(255,255,255,.93); box-shadow:0 3mm 8mm rgba(42,103,170,.14); }
      body.pdf-theme-claro .report-field { padding:0 5mm 2mm; border-right:1px solid #d7e5f4; }
      body.pdf-theme-claro .field-general, body.pdf-theme-claro .field-reporter, body.pdf-theme-claro .field-closed, body.pdf-theme-claro .field-remaining { border-right:0; }
      body.pdf-theme-claro .report-field .meta-icon, body.pdf-theme-claro .report-field .time-metric-icon { width:8mm; height:8mm; flex:0 0 8mm; border:0; border-radius:2mm; }
      body.pdf-theme-claro .report-field .meta-icon .report-icon { stroke:#fff; }
      body.pdf-theme-claro .report-field label { color:#52709f !important; font-size:12px; font-weight:700; }
      body.pdf-theme-claro .report-field strong { color:#102d69 !important; font-size:17px; font-weight:700; }
      body.pdf-theme-claro .field-type .meta-icon, body.pdf-theme-claro .field-tester .meta-icon { background:#159de4; }
      body.pdf-theme-claro .field-responsible .meta-icon, body.pdf-theme-claro .field-reporter .meta-icon { background:#7953e8; }
      body.pdf-theme-claro .field-created .meta-icon { background:#22a967; }
      body.pdf-theme-claro .field-general .meta-icon { background:#f49a13; }
      body.pdf-theme-claro .field-assigned .meta-icon, body.pdf-theme-claro .field-closed .meta-icon { background:#7852e8; }
      body.pdf-theme-claro .field-started .meta-icon { background:#18a8c9; }
      body.pdf-theme-claro .field-planned .meta-icon { background:#1264d4; }
      body.pdf-theme-claro .field-sprint .meta-icon { background:#3294e6; }
      body.pdf-theme-claro .field-total .meta-icon { background:#18a947; }
      body.pdf-theme-claro .field-remaining .meta-icon { background:#7952e7; }
      body.pdf-theme-claro .report-details-grid .report-field .meta-icon { background:#7953e8; }
      body.pdf-theme-claro .report-details-grid .report-field.field-assigned .meta-icon,
      body.pdf-theme-claro .report-details-grid .report-field.field-started .meta-icon,
      body.pdf-theme-claro .report-details-grid .report-field.field-closed .meta-icon { background:#22a967; }
      body.pdf-theme-claro .report-details-grid .report-field.field-planned .meta-icon,
      body.pdf-theme-claro .report-details-grid .report-field.field-sprint .meta-icon,
      body.pdf-theme-claro .report-details-grid .report-field.field-total .meta-icon,
      body.pdf-theme-claro .report-details-grid .report-field.field-remaining .meta-icon { background:#2d78c8; }
      body.pdf-theme-claro .field-general .general-state { color:#9A6500 !important; }
      body.pdf-theme-claro .report-field.field-general .general-state { display:block; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; }
      body.pdf-theme-claro .report-divider { border-color:#d5e3f2; }
      body.pdf-theme-claro .corrections { margin-top:5mm; padding:0 4mm 2mm; border:2px solid #4f8ce3; border-radius:5mm; background:#fff; overflow:visible; box-shadow:0 2mm 6mm rgba(42,103,170,.12); }
      body.pdf-theme-claro .section-title { margin:0 -4mm 0; padding:2.5mm 5mm; color:#fff; font-size:18px; background:linear-gradient(100deg,#303f9d,#397bd0); }
      body.pdf-theme-claro .section-title-icon { display:inline-grid; width:8mm; height:8mm; margin-right:3mm; place-items:center; vertical-align:middle; border:1px solid rgba(255,255,255,.7); border-radius:50%; background:rgba(255,255,255,.22); }
      body.pdf-theme-claro .section-title-icon .report-icon { width:5mm; height:5mm; stroke:#fff; }
      body.pdf-theme-claro .correction-row { grid-template-columns:minmax(0,145px) minmax(0,1fr) minmax(0,105px); width:100%; min-width:0; min-height:11mm; padding:1.5mm 0; border-color:#d5e3f2; color:#102d69; font-size:16.8px; line-height:1.2; break-inside:avoid; page-break-inside:avoid; }
      body.pdf-theme-claro .correction-row > span:not(.correction-status), body.pdf-theme-claro .correction-key b { color:#102d69; }
      body.pdf-theme-claro .correction-key { gap:3mm; }
      body.pdf-theme-claro .correction-row > span:not(.correction-status) { min-width:0; overflow-wrap:anywhere; word-break:break-word; }
      body.pdf-theme-claro .correction-status { width:100%; max-width:105px; min-width:0; overflow-wrap:anywhere; word-break:break-word; }
      body.pdf-theme-claro .correction-summary { display:block; overflow:visible; text-overflow:clip; }
      body.pdf-theme-claro .correction-summary { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; text-overflow:ellipsis; }
      body.pdf-theme-claro .grouped-issues-grid .long-text { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; text-overflow:ellipsis; }
      body.pdf-theme-claro .correction-key b { padding:1mm 2.5mm; border-radius:5mm; background:#e8f3ff; color:#12569e; font-size:15px; }
      body.pdf-theme-claro .correction-key .jira-issue-icon { border:0; border-radius:2mm; background:#5f49d6; }
      body.pdf-theme-claro .correction-key .jira-issue-icon .report-icon { stroke:#fff; }
      body.pdf-theme-claro .correction-status { color:#cf1d35; background:#ffe5e8; border-color:#ffb7c0; font-size:15px; }
      body.pdf-theme-claro .correction-status .status-marker { background:#e51d38; }
      body.pdf-theme-claro .correction-status.status-closed { --status-color:#e51d38; }
      body.pdf-theme-claro .corrections .empty { margin:4mm 0 3mm; font-size:16.5px; line-height:1.2; color:#172b4d !important; }
      body.pdf-theme-claro .corrections:has(.empty) { min-height:24mm; overflow:visible; }
      body.pdf-theme-claro .corrections:has(.empty) .empty { margin:2.5mm 0 2mm; }
      body.pdf-theme-claro .improvement-panel { margin-top:4mm; padding:0 4mm 3mm; border:1px solid #e3c56e; border-radius:4mm; overflow:visible; color:#172b4d; background:#fffaf0; }
      body.pdf-theme-claro .improvement-panel { min-height:24mm; }
      body.pdf-theme-claro .improvement-panel .section-title { margin:0 -4mm 2mm; padding:2.5mm 5mm; font-size:0; background:linear-gradient(100deg,#303f9d,#397bd0); }
      body.pdf-theme-claro .improvement-panel .section-title::after { content:"Acciones de mejora"; font-size:17px; vertical-align:middle; }
      body.pdf-theme-claro .improvement-panel p { margin:0; padding:0 1mm; color:#52627d; font-size:13px; line-height:1.3; white-space:pre-wrap; overflow-wrap:anywhere; }
      body.pdf-theme-claro .improvement-panel .improvement-empty { font-size:16.5px; line-height:1.2; color:#172b4d; }
      .without-improvement .improvement-panel { display:none; }
      body.pdf-theme-claro .grouped-issues-header { align-items:center; }
      body.pdf-theme-claro .grouped-issues-heading { display:flex; align-items:center; gap:10px; min-height:100%; }
      body.pdf-theme-claro .grouped-heading-icon { display:grid; place-items:center; width:28px; height:28px; flex:0 0 28px; border:1px solid rgba(255,255,255,.65); border-radius:8px; background:rgba(255,255,255,.16); }
      body.pdf-theme-claro .grouped-heading-icon .report-icon { width:17px; height:17px; stroke:#fff; }
      body.pdf-theme-claro .grouped-issues-heading h1 { margin:0; color:#fff; font-size:30px; line-height:1.15; font-weight:700; text-shadow:0 1px 1px rgba(0,0,0,.18); }
      body.pdf-theme-claro .grouped-issues-page .report-header { min-height:31mm; }
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid-wrap { margin-top:5mm; background:#fff; }
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid th { color:#52627d; background:#dfe7f4; }
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid td { color:#172b4d; background:#fff; }
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid .status { min-width:88px; justify-content:center; padding:6px 12px; border:0; border-radius:99px; font-size:13px; font-weight:600; }
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid .status-new,
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid .status-waiting { color:#172b4d; background:#ffd348; --status-color:#5264a8; }
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid .status-created { color:#2453a3; background:#dceaff; border:1px solid #a9c9f6; --status-color:#4776c5; }
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid .status-new { color:#6840a4; background:#eee2ff; border:1px solid #cdb3ef; --status-color:#8052bd; }
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid .status-waiting { color:#9a6500; background:#fff0c2; border:1px solid #e3c56e; --status-color:#9a6500; }
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid .status-progress { color:#17643d; background:#c9f2dc; --status-color:#198754; }
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid .status-closed,
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid .status-danger { color:#cf1d35; background:#ffe5e8; border:1px solid #ffb7c0; --status-color:#e51d38; }
      body.pdf-theme-claro .grouped-issues-page .grouped-issues-grid .status-marker { width:6px; height:6px; flex:0 0 6px; }
      @media (max-width: 1100px) {
        body.pdf-theme-claro .report-details-grid { grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-areas:none; grid-template-rows:none; gap:4mm; }
        body.pdf-theme-claro .report-details-grid .report-field { grid-area:auto; border-right:0; border-bottom:1px solid #d7e5f4; }
        body.pdf-theme-claro .report-details-grid .report-divider { display:none; }
        body.pdf-theme-claro .report-header > div { width:100%; }
        body.pdf-theme-claro .report-range-header { position:static; transform:none; align-items:flex-start; margin-top:3mm; text-align:left; }
      }
      @media (max-width: 680px) {
        body.pdf-theme-claro .page { width:100%; height:auto; min-height:100vh; max-height:none; padding:6mm; overflow:visible; }
        body.pdf-theme-claro .report-details-grid { grid-template-columns:1fr; }
        body.pdf-theme-claro .report-header p.issue-summary { font-size:20px; }
        body.pdf-theme-claro .correction-row { grid-template-columns:1fr; gap:2mm; }
        body.pdf-theme-claro .correction-status { justify-self:start; }
        body.pdf-theme-claro .issue-identity { max-width:100%; }
      }
    ` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
      :root { ${themeVariables} }
      @page { size: Letter landscape; margin: 0; } * { box-sizing: border-box; } body { margin: 0; background: #070d20; color: #edf1ff; font-family: "Segoe UI", Arial, sans-serif; } .page { position: relative; width: 279.4mm; min-height: 215.9mm; padding: 14mm 16mm 13mm; page-break-after: always; background: radial-gradient(circle at top right, rgba(83,105,218,.22), transparent 40%), #091128; } .page:last-child { page-break-after: auto; } .report-header { display: flex; justify-content: space-between; gap: 20px; align-items: start; padding-bottom: 12px; border-bottom: 1px solid rgba(145,160,255,.35); } .continuation-header { margin-bottom: 14px; } .eyebrow { color: #9eafff; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; } .issue-key { margin: 6px 0 4px; font-size: 18px; line-height: 1.15; font-weight: 600; } .report-header p.issue-summary { margin: 0; color: #edf1ff; font-size: 19px; line-height: 1.25; font-weight: 600; } .status { display:inline-flex; align-items:center; gap:6px; padding: 6px 12px; border:1px solid color-mix(in srgb, var(--status-color), transparent 45%); border-radius:99px; color:var(--status-color); background:color-mix(in srgb, var(--status-color), transparent 88%); font-size:11px; font-weight:600; } .status-progress, .correction-status.status-progress { --status-color:#71e6a4; } .status-waiting, .correction-status.status-waiting { --status-color:#f3c15b; } .status-closed, .correction-status.status-closed { --status-color:#ff7c87; } .status-production, .correction-status.status-production { --status-color:#5bdbe0; } .status-danger, .correction-status.status-danger { --status-color:#ff7c87; } .status-new, .correction-status.status-new { --status-color:#b9a5ff; } .status-other, .correction-status.status-other { --status-color:#9eafff; } .status-marker { display:inline-block; width:6px; height:6px; flex:0 0 6px; border-radius:50%; background:var(--status-color); box-shadow:0 0 0 2px color-mix(in srgb, var(--status-color), transparent 82%); } label { display:block; color:#93a2d0; font-size:10px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:5px; } strong { font-size:13px; font-weight:500; } .meta-label { display:flex; align-items:center; gap:6px; } .report-icon { width:14px; height:14px; flex:0 0 14px; fill:none; stroke:#9eafff; stroke-linecap:round; stroke-linejoin:round; stroke-width:1.8; } .meta-grid, .dates { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; padding:14px 0; border-bottom:1px solid rgba(145,160,255,.2); } .dates { grid-template-columns:repeat(3,1fr); } .time-panel { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; margin:16px 0; padding:14px 16px; border:1px solid rgba(145,160,255,.35); border-radius:14px; background:rgba(20,31,67,.65); } .time-panel > div { min-width:72px; } .corrections { margin-top:12px; padding:14px 16px; border:1px solid rgba(145,160,255,.3); border-radius:14px; } .corrections-only { margin-top:0; } .section-title { margin-bottom:10px; color:#c9d3ff; font-size:15px; font-weight:700; } .correction-row { display:grid; grid-template-columns:92px 1fr 100px; gap:10px; align-items:center; padding:8px 0; border-top:1px solid rgba(145,160,255,.15); font-size:11px; } .correction-row > b { color:#d8def3; font-weight:600; } .correction-row > span:not(.correction-status) { color:#d8def3; } .correction-status { display:inline-flex; width:max-content; max-width:100%; align-items:center; gap:5px; padding:3px 7px; border:1px solid color-mix(in srgb, var(--status-color), transparent 45%); border-radius:99px; color:var(--status-color); background:color-mix(in srgb, var(--status-color), transparent 90%); font-size:10px; line-height:1.2; white-space:normal; } .empty { color:#99a6ce; font-size:11px; } footer { position:absolute; bottom:8mm; color:#7786b6; font-size:9px; }
      .issue-heading { display:flex; align-items:center; flex-wrap:wrap; gap:12px; } .issue-heading .issue-key { margin:6px 0 4px; } .report-header p.issue-summary { max-width: 920px; } .status { flex:0 0 auto; } .meta-label { display:flex; align-items:center; gap:8px; margin-bottom:5px; } .meta-label label { margin:0; line-height:1.1; } .meta-icon, .time-metric-icon, .project-icon { display:grid; place-items:center; border:1px solid rgba(126,153,255,.42); background:rgba(45,77,160,.28); } .meta-icon { width:24px; height:24px; border-radius:7px; } .report-icon { width:15px; height:15px; flex:0 0 15px; fill:none; stroke:#a9bbff; stroke-linecap:round; stroke-linejoin:round; stroke-width:1.8; } .time-metric-label { display:flex; align-items:center; gap:8px; margin-bottom:7px; } .time-metric-label label { margin:0; line-height:1.1; } .time-metric-icon { width:26px; height:26px; border-color:rgba(104,171,255,.5); border-radius:8px; background:rgba(32,91,179,.25); } .time-metric-icon .report-icon { width:16px; height:16px; } .correction-row { grid-template-columns:124px 1fr 110px; } .correction-key { display:flex; min-width:0; align-items:center; gap:7px; } .correction-key b { overflow-wrap:anywhere; color:#d8def3; font-weight:600; } .project-icon { width:22px; height:22px; flex:0 0 22px; border-color:rgba(126,153,255,.42); border-radius:6px; background:rgba(45,77,160,.24); } .project-icon .report-icon { width:13px; height:13px; }
      /* Final visual hierarchy for the PDF. These overrides keep the source layout compact. */
      @page { size: 338.67mm 190.5mm; margin: 0; }
      .page { width:338.67mm; height:190.5mm; min-height:190.5mm; max-height:190.5mm; }
      .page { position:relative; display:flex; flex-direction:column; width:338.67mm; height:190.5mm; min-height:190.5mm; max-height:190.5mm; overflow:visible; break-inside:avoid; page-break-inside:avoid; padding:12.5mm 15mm 10mm; }
      .report-header { flex:0 0 auto; padding-bottom:8px; }
      .report-details-grid, .corrections, .improvement-panel, .grouped-issues-grid-wrap { flex:0 0 auto; }
      .continuation-header { margin-bottom:13px; }
      .eyebrow { font-size:10px; letter-spacing:.16em; }
      .issue-heading { min-height:34px; align-items:center; gap:9px; }
      .issue-heading .issue-key { margin:0; font-size:21px; line-height:1.15; font-weight:650; }
      .report-header p.issue-summary { margin-top:5px; width:calc(100% - 300px); max-width:calc(100% - 300px); font-size:26px; line-height:1.23; font-weight:600; overflow-wrap:anywhere; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; text-overflow:ellipsis; }
      .jira-issue-icon { position:relative; display:grid; width:22px; height:22px; flex:0 0 22px; place-items:center; overflow:hidden; border:1px solid rgba(126,153,255,.48); border-radius:6px; background:rgba(45,77,160,.28); }
      .jira-issue-icon > .report-icon { width:14px; height:14px; stroke:#a9bbff; }
      .jira-issue-icon img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; background:#1d2b59; }
      .jira-issue-type-icon img { object-fit:contain; padding:2px; background:transparent; }
      .grouped-issues-grid td:first-child .jira-issue-icon { display:inline-grid; vertical-align:middle; margin-right:6px; width:22px; height:22px; }
      .status, .correction-status { display:inline-flex; align-items:center; gap:5px; padding:3px 7px; border:1px solid color-mix(in srgb, var(--status-color), transparent 45%); border-radius:99px; font-size:13px; line-height:1.2; font-weight:600; }
      .issue-heading > .status { box-sizing:border-box; height:24px; min-height:24px; min-width:78px; justify-content:center; white-space:nowrap; }
      .status-marker { width:6px; height:6px; flex:0 0 6px; }
      .meta-grid, .dates { gap:14px; padding:12px 0; }
      .meta-grid > div, .dates > div { min-width:0; }
      .meta-label { min-height:28px; align-items:center; gap:7px; margin-bottom:5px; }
      .meta-label label, .time-metric-label label { margin:0; color:#a9b6e2; font-size:12.5px; line-height:1.1; }
      .meta-grid strong, .dates strong { display:block; overflow-wrap:anywhere; font-size:17.5px; line-height:1.3; font-weight:550; }
      .meta-icon, .time-metric-icon { display:grid; place-items:center; border:1px solid rgba(126,153,255,.52); background:rgba(45,77,160,.3); }
      .meta-icon { width:27px; height:27px; flex:0 0 27px; border-radius:8px; }
      .meta-icon .report-icon { width:16px; height:16px; }
      .time-panel { gap:16px; margin:14px 0 12px; padding:12px 14px; border-radius:13px; }
      .time-metric-label { min-height:30px; align-items:center; gap:8px; margin-bottom:6px; }
      .time-metric-icon { width:30px; height:30px; flex:0 0 30px; border-radius:9px; }
      .time-metric-icon .report-icon { width:18px; height:18px; }
      .time-metric strong { font-size:19.5px; line-height:1.2; font-weight:650; }
      .corrections { margin-top:0; padding:12px 15px; border-radius:13px; }
      .improvement-panel { margin-top:10px; padding:12px 15px; border:1px solid rgba(243,193,91,.45); border-radius:13px; background:rgba(104,70,24,.2); }
      .improvement-panel p { margin:0; color:#ffe2a1; font-size:15px; line-height:1.35; white-space:pre-wrap; overflow-wrap:anywhere; }
      .section-title { margin-bottom:7px; font-size:19.5px; line-height:1.2; }
      .correction-row { grid-template-columns:minmax(0,145px) minmax(0,1fr) minmax(0,105px); gap:12px; width:100%; min-width:0; min-height:37px; align-items:center; padding:6px 0; font-size:15px; line-height:1.3; break-inside:avoid; page-break-inside:avoid; }
      .correction-key { display:flex; min-width:0; align-items:center; gap:8px; overflow-wrap:anywhere; }
      .correction-key .jira-issue-icon { width:24px; height:24px; flex-basis:24px; border-radius:7px; }
      .correction-key .jira-issue-icon > .report-icon { width:14px; height:14px; }
      .correction-key b { min-width:0; overflow-wrap:anywhere; word-break:break-word; }
      .correction-row > span:not(.correction-status) { min-width:0; overflow-wrap:anywhere; word-break:break-word; }
      .correction-summary { display:block; overflow:visible; text-overflow:clip; }
      .correction-summary { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; text-overflow:ellipsis; }
      .grouped-issues-grid .long-text { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; text-overflow:ellipsis; }
      .correction-status { min-width:0; width:100%; justify-self:end; max-width:105px; overflow-wrap:anywhere; word-break:break-word; white-space:normal; }
      .compact-correction-page .correction-row { min-height:0; padding:2px 0; font-size:12px; line-height:1.08; }
      .compact-correction-page .correction-key { gap:5px; }
      .compact-correction-page .correction-key .jira-issue-icon { width:19px; height:19px; flex-basis:19px; }
      .compact-correction-page .correction-status { max-width:88px; padding:2px 4px; font-size:10px; line-height:1.05; }
      .compact-improvement-page .improvement-panel { margin-top:6px; padding:6px 10px; }
      .compact-improvement-page .improvement-panel p { font-size:12px; line-height:1.15; }
      .compact-table-page .grouped-issues-grid { font-size:13px; }
      .compact-table-page .grouped-issues-grid th, .compact-table-page .grouped-issues-grid td { padding:5px 7px; }
      .compact-table-page .grouped-issues-grid th { font-size:10px; }
      .compact-table-page .issue-type-badge { font-size:13px; }
      .compact-table-page .grouped-issues-grid td:first-child .jira-issue-icon { width:17px; height:17px; }
      .emergency-compact-page .report-header { padding-bottom:4px; }
      .emergency-compact-page .report-header p.issue-summary { margin-top:2px; font-size:18px; line-height:1.08; min-height:0; }
      .emergency-compact-page .report-details-grid { margin-top:2px; padding-top:3px; padding-bottom:2px; }
      .emergency-compact-page .report-field { padding-bottom:2px; }
      .emergency-compact-page .report-field .meta-label { min-height:21px; margin-bottom:2px; }
      .emergency-compact-page .report-field strong { font-size:13px; line-height:1.08; }
      .emergency-compact-page .corrections { padding-top:5px; padding-bottom:1px; }
      .emergency-compact-page .section-title { margin-bottom:3px; font-size:15px; }
      .emergency-compact-page .correction-row { min-height:0; padding:1px 0; font-size:10px; line-height:1; }
      .emergency-compact-page .correction-key .jira-issue-icon { width:16px; height:16px; flex-basis:16px; }
      .emergency-compact-page .correction-status { max-width:78px; padding:1px 3px; font-size:8px; line-height:1; }
      .emergency-compact-page .improvement-panel { min-height:0; margin-top:3px; padding:3px 6px 4px; }
      .emergency-compact-page .improvement-panel p { font-size:10px; line-height:1; }
      .emergency-compact-page .grouped-issues-grid { font-size:10px; }
      .emergency-compact-page .grouped-issues-grid th, .emergency-compact-page .grouped-issues-grid td { padding:2px 4px; }
      .emergency-compact-page .grouped-issues-grid th { font-size:8px; }
      .emergency-compact-page .issue-type-badge { font-size:10px; }
      footer { position:static; margin-top:auto; padding-top:10px; color:#8191c0; font-size:12.5px; line-height:1.2; }
      .correction-continuation-page .corrections { margin-top:0; }
      /* All issue fields share the same vertical-column rhythm, including reported times. */
      .report-details-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); grid-template-rows:minmax(54px, auto) minmax(54px, auto) 9px minmax(54px, auto) 9px minmax(54px, auto); grid-template-areas:"type responsible created general" "tester reporter . ." "general-divider general-divider general-divider general-divider" "assigned started closed ." "dates-divider dates-divider dates-divider dates-divider" "planned sprint total remaining"; column-gap:14px; row-gap:0; margin:6px 0 0; padding:6px 0 4px; border-bottom:1px solid rgba(145,160,255,.2); }
      .report-field { min-width:0; align-self:start; padding:0 0 6px; }
      .field-type { grid-area:type; } .field-responsible { grid-area:responsible; } .field-reporter { grid-area:reporter; } .field-created { grid-area:created; } .field-tester { grid-area:tester; } .field-general { grid-area:general; } .field-assigned { grid-area:assigned; } .field-started { grid-area:started; } .field-closed { grid-area:closed; } .field-planned { grid-area:planned; } .field-sprint { grid-area:sprint; } .field-total { grid-area:total; } .field-remaining { grid-area:remaining; }
      .report-divider { min-width:0; align-self:center; border-top:1px solid rgba(145,160,255,.2); }
      .report-divider-general { grid-area:general-divider; } .report-divider-dates { grid-area:dates-divider; }
      .report-field .meta-label { min-height:27px; align-items:center; gap:7px; margin-bottom:5px; }
      .report-field strong { display:block; overflow-wrap:anywhere; font-size:17.5px; line-height:1.3; font-weight:550; }
      .report-field .general-state { color:var(--status-color); font-weight:650; }
      .report-field.field-general .general-state { color:var(--pdf-status-waiting); }
      .report-header { position:relative; }
      .report-header > div { width:calc(100% - 340px); }
      .report-range-header { position:absolute; top:-2mm; right:0; display:flex; width:auto; flex-direction:column; align-items:flex-end; color:var(--pdf-accent); font-size:15.5px; font-weight:600; letter-spacing:.04em; line-height:1.35; text-align:right; text-transform:none; padding:3.5mm 5mm; border:1px solid rgba(169,187,255,.6); border-radius:2mm; background:#073b78; }
      .report-range-copy > span:first-child { font-size:17px; font-weight:700; }
      .report-range-copy > span:nth-child(2), .report-range-copy > span:last-child { font-size:15px; font-weight:700; }
      .report-header .issue-key { color:var(--pdf-issue-key); text-shadow:0 0 7px rgba(71,190,255,.52); }
      .report-field.field-type .meta-label,
      .report-field.field-responsible .meta-label,
      .report-field.field-reporter .meta-label,
      .report-field.field-tester .meta-label,
      .report-field.field-general .meta-label,
      .report-field.field-created .meta-label { color:#82c89d; }
      .report-field.field-type strong,
      .report-field.field-responsible strong,
      .report-field.field-reporter strong,
      .report-field.field-tester strong,
      .report-field.field-general strong,
      .report-field.field-created strong { color:#b8e4c6; }
      .report-field.field-type .meta-label label,
      .report-field.field-responsible .meta-label label,
      .report-field.field-reporter .meta-label label,
      .report-field.field-tester .meta-label label,
      .report-field.field-general .meta-label label,
      .report-field.field-created .meta-label label { color:#78bd93; }
      .report-field.field-assigned .meta-label,
      .report-field.field-started .meta-label,
      .report-field.field-closed .meta-label { color:#ae95e8; }
      .report-field.field-assigned strong,
      .report-field.field-started strong,
      .report-field.field-closed strong { color:#d4c5fa; }
      .report-field.field-assigned .meta-label label,
      .report-field.field-started .meta-label label,
      .report-field.field-closed .meta-label label { color:#a38bd8; }
      .report-field.field-planned .meta-label,
      .report-field.field-sprint .meta-label,
      .report-field.field-total .meta-label,
      .report-field.field-remaining .meta-label { color:#7dc9e8; }
      .report-field.field-planned strong,
      .report-field.field-sprint strong,
      .report-field.field-total strong,
      .report-field.field-remaining strong { color:#b9e8fa; }
      .report-field.field-planned .meta-label label,
      .report-field.field-sprint .meta-label label,
      .report-field.field-total .meta-label label,
      .report-field.field-remaining .meta-label label { color:#72b9d8; }
      .correction-row { grid-template-columns:minmax(0,145px) minmax(0,1fr) minmax(0,88px); width:100%; min-width:0; }
      .correction-status { justify-self:end; width:100%; min-width:0; max-width:88px; justify-content:center; padding:3px 5px; text-align:center; white-space:normal; overflow-wrap:anywhere; word-break:break-word; }
      .grouped-issues-header { min-height:84px; margin-bottom:12px; }
      .grouped-issues-heading { display:flex; min-height:34px; align-items:center; gap:10px; }
      .grouped-heading-icon { display:grid; place-items:center; width:28px; height:28px; flex:0 0 28px; border:1px solid rgba(169,187,255,.6); border-radius:8px; background:rgba(45,77,160,.34); }
      .grouped-heading-icon .report-icon { width:17px; height:17px; stroke:#d8e0ff; }
      .grouped-issues-heading h1 { margin:0; font-size:26px; line-height:1.15; font-weight:650; }
      .grouped-issues-header > div:first-child { padding-right:0; }
      .grouped-issues-header .grouped-issues-heading h1 { max-width:100%; }
      .grouped-issues-grid-wrap { margin-top:18px; overflow:visible; border:1px solid rgba(145,160,255,.3); border-radius:13px; }
      .grouped-issues-grid { width:100%; border-collapse:collapse; color:var(--pdf-text); font-size:16.6px; }
      .grouped-issues-grid th, .grouped-issues-grid td { padding:10px 12px; border-bottom:1px solid rgba(145,160,255,.16); text-align:left; vertical-align:middle; }
      .grouped-issues-grid th { color:var(--pdf-muted-text); font-size:13px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
      .grouped-issues-grid th:nth-child(1), .grouped-issues-grid td:nth-child(1) { width:14%; white-space:nowrap; }
      .grouped-issues-grid th:nth-child(2), .grouped-issues-grid td:nth-child(2) { width:20%; }
      .grouped-issues-grid th:nth-child(4), .grouped-issues-grid td:nth-child(4) { width:13%; text-align:center; white-space:nowrap; }
      .grouped-issues-grid th:nth-child(5), .grouped-issues-grid td:nth-child(5) { width:15%; text-align:center; white-space:nowrap; }
      .grouped-issues-grid tr:last-child td { border-bottom:0; }
      .issue-type-badge { display:inline-block; max-width:100%; font-size:16.6px; line-height:1.2; font-weight:700; white-space:normal; }
      .issue-type-color-1 { color:#66f3ff; text-shadow:0 0 5px rgba(102,243,255,.72); }
      .issue-type-color-2 { color:#e3a7ff; text-shadow:0 0 5px rgba(227,167,255,.72); }
      .issue-type-color-3 { color:#ffe36e; text-shadow:0 0 5px rgba(255,227,110,.72); }
      .issue-type-color-4 { color:#72ffae; text-shadow:0 0 5px rgba(114,255,174,.72); }
      .issue-type-color-5 { color:#ff91ad; text-shadow:0 0 5px rgba(255,145,173,.72); }
      .issue-type-color-6 { color:#9ebdff; text-shadow:0 0 5px rgba(158,189,255,.72); }
      .grouped-issues-grid .issue-type-color-1,
      .grouped-issues-grid .issue-type-color-2,
      .grouped-issues-grid .issue-type-color-3,
      .grouped-issues-grid .issue-type-color-4,
      .grouped-issues-grid .issue-type-color-5,
      .grouped-issues-grid .issue-type-color-6 { text-shadow:none; }
      .issue-type-color-1 { color:var(--pdf-type-1); }
      .issue-type-color-2 { color:var(--pdf-type-2); }
      .issue-type-color-3 { color:var(--pdf-type-3); }
      .issue-type-color-4 { color:var(--pdf-type-4); }
      .issue-type-color-5 { color:var(--pdf-type-5); }
      .issue-type-color-6 { color:var(--pdf-type-6); }
      .report-field.field-type strong { color:var(--pdf-white-value); }
      .report-field .meta-label label { color:#b7f2ca; }
      body { background:var(--pdf-body-background); color:var(--pdf-text); }
      .page { background:radial-gradient(circle at top right, var(--pdf-radial-glow), transparent 40%), var(--pdf-page-background); }
      .report-header, .report-details-grid, .report-divider { border-color:var(--pdf-border); }
      .time-panel { background:var(--pdf-panel-background); border-color:var(--pdf-border); }
      .corrections { background:var(--pdf-section-background); }
      .grouped-issues-grid th { background:var(--pdf-table-header-background); }
      .empty { color:var(--pdf-empty-text) !important; }
      .meta-icon, .time-metric-icon, .project-icon, .jira-issue-icon { background:var(--pdf-icon-background); border-color:var(--pdf-icon-border); }
      .report-details-grid .report-field .meta-icon { background:#7953e8; }
      .report-details-grid .report-field.field-assigned .meta-icon,
      .report-details-grid .report-field.field-started .meta-icon,
      .report-details-grid .report-field.field-closed .meta-icon { background:#22a967; }
      .report-details-grid .report-field.field-planned .meta-icon,
      .report-details-grid .report-field.field-sprint .meta-icon,
      .report-details-grid .report-field.field-total .meta-icon,
      .report-details-grid .report-field.field-remaining .meta-icon { background:#2d78c8; }
      .report-icon, .jira-issue-icon > .report-icon { stroke:var(--pdf-icon-stroke); }
      .section-title { color:var(--pdf-section-title); }
      .report-header p.issue-summary, .correction-row > span:not(.correction-status), .correction-key b { color:var(--pdf-text); }
      .report-field.field-type strong,
      .report-field.field-responsible strong,
      .report-field.field-reporter strong,
      .report-field.field-tester strong,
      .report-field.field-general strong,
      .report-field.field-created strong { color:var(--pdf-primary-value); }
      .report-field.field-assigned strong,
      .report-field.field-started strong,
      .report-field.field-closed strong { color:var(--pdf-secondary-value); }
      .report-field.field-planned strong,
      .report-field.field-sprint strong,
      .report-field.field-total strong,
      .report-field.field-remaining strong { color:var(--pdf-time-value); }
      .report-field.field-type .meta-label label,
      .report-field.field-responsible .meta-label label,
      .report-field.field-reporter .meta-label label,
      .report-field.field-tester .meta-label label,
      .report-field.field-general .meta-label label,
      .report-field.field-created .meta-label label { color:var(--pdf-label); }
      .report-field.field-assigned .meta-label label,
      .report-field.field-started .meta-label label,
      .report-field.field-closed .meta-label label,
      .report-field.field-planned .meta-label label,
      .report-field.field-sprint .meta-label label,
      .report-field.field-total .meta-label label,
      .report-field.field-remaining .meta-label label { color:var(--pdf-muted-text); }
      .grouped-issues-grid-wrap, .corrections { border-color:var(--pdf-border); }
      .report-field .meta-label label,
      .time-metric-label label { color:var(--pdf-label) !important; }
      .report-header p.issue-summary { width:100%; max-width:none; }
      .status-closed, .correction-status.status-closed { --status-color:var(--pdf-status-closed); }
      .status-progress, .correction-status.status-progress { --status-color:var(--pdf-status-progress); }
      .status-waiting, .correction-status.status-waiting { --status-color:var(--pdf-status-waiting); }
      .status-production, .correction-status.status-production { --status-color:var(--pdf-status-production); }
      .status-other, .correction-status.status-other { --status-color:var(--pdf-status-other); }
      .status-danger, .correction-status.status-danger { --status-color:var(--pdf-status-danger); }
      .status-new, .correction-status.status-new { --status-color:var(--pdf-status-new); }
      @page { size: 338.67mm 190.5mm; margin: 0; }
      .page { width:338.67mm !important; height:190.5mm !important; min-height:190.5mm !important; max-height:190.5mm !important; }
      ${darkThemeOverrides}
      ${lightThemeOverrides}
      .compact-improvement-page .improvement-panel { min-height:0; margin-top:6px; padding:6px 10px; }
      .compact-improvement-page .improvement-panel p { font-size:12px; line-height:1.15; }
      .compact-table-page .grouped-issues-grid { font-size:13px; }
      .compact-table-page .grouped-issues-grid th, .compact-table-page .grouped-issues-grid td { padding:5px 7px; }
      .compact-table-page .grouped-issues-grid th { font-size:10px; }
      .compact-table-page .issue-type-badge { font-size:13px; }
      .status-created, .correction-status.status-created { --status-color:var(--pdf-status-created); }
    </style></head><body class="${themeClass}">${pages.join('')}</body></html>`
    .replaceAll('Ã¡', 'á')
    .replaceAll('Ã©', 'é')
    .replaceAll('Ã­', 'í')
    .replaceAll('Ã³', 'ó')
    .replaceAll('Ãº', 'ú')
    .replaceAll('Ã±', 'ñ');
}

async function prepareMeasurementPage(page, report, candidatePage) {
  await page.setContent(buildTimeReportHtml(report, { candidatePage }), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
}

async function measureCandidatePage(page, report, candidatePage) {
  await prepareMeasurementPage(page, report, candidatePage);
  // Candidate acceptance must use the same geometry rules that protect the
  // exported page. A lighter check here can accept a page that final
  // validation correctly rejects.
  const layout = await validatePdfLayout(page, [], [], [], {}, { strict: false });
  const dimensions = await page.evaluate((candidateKind) => {
    const pageElement = document.querySelector('.page');
    if (!pageElement) return { availableHeight: 0, requiredHeight: 0, diagnostic: `tipo=${candidateKind}; causa=pagina candidata ausente` };
    const pageRect = pageElement.getBoundingClientRect();
    const pageStyle = getComputedStyle(pageElement);
    const bottom = pageRect.bottom - Number.parseFloat(pageStyle.paddingBottom || '0');
    return {
      availableHeight: Math.max(0, bottom - pageRect.top),
      requiredHeight: Math.max(0, pageElement.scrollHeight),
      diagnostic: `tipo=${pageElement.dataset.pageType ?? candidateKind}; disponible=${Math.max(0, bottom - pageRect.top).toFixed(1)}px; requerido=${Math.max(0, pageElement.scrollHeight).toFixed(1)}px`,
    };
  }, candidatePage.kind);
  return {
    fits: layout.failures.length === 0,
    failures: layout.failures,
    ...dimensions,
    diagnostic: `${dimensions.diagnostic}; causa=${layout.failures.join(', ') || 'ninguna'}`,
  };
}

async function largestTextPrefixThatFits(page, report, candidateFactory, text) {
  let low = 1;
  let high = text.length;
  let best = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidateText = text.slice(0, middle);
    const result = await measureCandidatePage(page, report, candidateFactory(candidateText));
    if (result.fits) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

async function splitImprovementTextByDom(page, report, issue, text, { compactImprovement = false, fragmentOffset = 0 } = {}) {
  const value = String(text ?? '');
  if (!value) return [];
  const parts = [];
  let offset = 0;
  while (offset < value.length) {
    const remaining = value.slice(offset);
    const best = await largestTextPrefixThatFits(
      page,
      report,
      (memo) => ({ kind: 'improvement', issue, memo, compactImprovement }),
      remaining,
    );
    if (best <= 0) {
      if (!compactImprovement) {
        const compactParts = await splitImprovementTextByDom(page, report, issue, remaining, {
          compactImprovement: true,
          fragmentOffset: fragmentOffset + parts.length,
        });
        return [...parts, ...compactParts];
      }
      throw new Error(`La accion de mejora ${issue.issueKey} no cabe ni en perfil compacto; fragmento ${fragmentOffset + parts.length + 1}`);
    }
    parts.push({ kind: 'improvement', issue, memo: remaining.slice(0, best), compactImprovement, improvementFragmentIndex: fragmentOffset + parts.length });
    offset += best;
  }
  return parts;
}

async function packIssueRowsByDom(page, report, issue, corrections, { firstPage, forceCompact = false }) {
  const rows = [];
  let compactCorrection = forceCompact;
  let lastResult = null;
  for (const correction of corrections) {
    const candidate = {
      kind: firstPage ? 'issue-first' : 'issue-continuation',
      issue,
      corrections: [...rows, correction],
      includeImprovement: false,
      compactCorrection,
    };
    let result = await measureCandidatePage(page, report, candidate);
    lastResult = result;
    if (!result.fits && rows.length === 0 && !compactCorrection) {
      compactCorrection = true;
      result = await measureCandidatePage(page, report, { ...candidate, compactCorrection: true });
      lastResult = result;
    }
    if (!result.fits) break;
    rows.push(correction);
  }
  if (rows.length === 0 && corrections.length > 0) {
    const key = String(corrections[0].correctionKey ?? '(sin clave)');
    throw new Error(`La fila ${key} no cabe completa en una pagina de problemas presentados; ${lastResult?.diagnostic ?? 'sin dimensiones disponibles'}`);
  }
  return { rows, compactCorrection };
}

async function paginateIssueByDom(page, report, issue, { forceCompact = false } = {}) {
  const corrections = issue.corrections ?? [];
  const actionText = String(issue.improvement?.memo ?? '');
  const pages = [];
  if (corrections.length === 0) {
    if (!actionText.trim().length) {
      return [{
        kind: 'issue-first', issue, corrections: [], includeImprovement: true,
        improvementMemo: '', compactImprovement: forceCompact,
      }];
    }
    const fullFirst = {
      kind: 'issue-first', issue, corrections: [], includeImprovement: true, improvementMemo: actionText,
      compactImprovement: forceCompact, improvementFragmentIndex: 0,
    };
    if ((await measureCandidatePage(page, report, fullFirst)).fits) return [fullFirst];
    let compactImprovement = forceCompact;
    let prefixLength = await largestTextPrefixThatFits(
      page,
      report,
      (memo) => ({ ...fullFirst, improvementMemo: memo }),
      actionText,
    );
    if (prefixLength <= 0 && !compactImprovement) {
      compactImprovement = true;
      prefixLength = await largestTextPrefixThatFits(
        page,
        report,
        (memo) => ({ ...fullFirst, improvementMemo: memo, compactImprovement: true }),
        actionText,
      );
    }
    if (prefixLength > 0) {
      pages.push({ ...fullFirst, improvementMemo: actionText.slice(0, prefixLength), compactImprovement, improvementFragmentIndex: 0 });
    } else {
      pages.push({ kind: 'issue-first', issue, corrections: [], includeImprovement: true, improvementMemo: '' });
    }
    const rest = prefixLength > 0 ? actionText.slice(prefixLength) : actionText;
    pages.push(...await splitImprovementTextByDom(page, report, issue, rest, {
      compactImprovement,
      fragmentOffset: prefixLength > 0 ? 1 : 0,
    }));
    return pages;
  }

  let offset = 0;
  const first = await packIssueRowsByDom(page, report, issue, corrections, { firstPage: true, forceCompact });
  pages.push({ kind: 'issue-first', issue, corrections: first.rows, includeImprovement: false, compactCorrection: first.compactCorrection });
  offset = first.rows.length;
  while (offset < corrections.length) {
    const continuation = await packIssueRowsByDom(page, report, issue, corrections.slice(offset), { firstPage: false, forceCompact });
    pages.push({ kind: 'issue-continuation', issue, corrections: continuation.rows, includeImprovement: false, compactCorrection: continuation.compactCorrection });
    offset += continuation.rows.length;
  }

  const last = pages.at(-1);
  const fullFinal = { ...last, includeImprovement: true, improvementMemo: actionText, compactImprovement: forceCompact };
  if ((await measureCandidatePage(page, report, fullFinal)).fits) {
      pages[pages.length - 1] = { ...fullFinal, improvementFragmentIndex: actionText.trim().length > 0 ? 0 : null };
    return pages;
  }
  if (actionText.trim().length > 0) {
    let compactImprovement = forceCompact;
    let prefixLength = await largestTextPrefixThatFits(
      page,
      report,
      (memo) => ({ ...last, includeImprovement: true, improvementMemo: memo }),
      actionText,
    );
    if (prefixLength <= 0 && !compactImprovement) {
      compactImprovement = true;
      prefixLength = await largestTextPrefixThatFits(
        page,
        report,
        (memo) => ({ ...last, includeImprovement: true, improvementMemo: memo, compactImprovement: true }),
        actionText,
      );
    }
    if (prefixLength > 0) {
      pages[pages.length - 1] = {
        ...fullFinal,
        improvementMemo: actionText.slice(0, prefixLength),
        compactImprovement,
        improvementFragmentIndex: 0,
      };
      pages.push(...await splitImprovementTextByDom(page, report, issue, actionText.slice(prefixLength), {
        compactImprovement,
        fragmentOffset: 1,
      }));
      return pages;
    }
  }
  pages.push({ kind: 'improvement', issue, memo: actionText, compactImprovement: true, improvementFragmentIndex: 0 });
  return pages;
}

async function paginateTableByDom(page, report, rows, kind, { forceCompact = false } = {}) {
  const pages = [];
  let offset = 0;
  let compactTable = forceCompact;
  while (offset < rows.length) {
    const pageRows = [];
    let lastResult = null;
    for (const row of rows.slice(offset)) {
      let result = await measureCandidatePage(page, report, {
        kind,
        rows: [...pageRows, row],
        pageNumber: pages.length + 1,
        compactTable,
      });
      lastResult = result;
      if (!result.fits && pageRows.length === 0 && !compactTable) {
        compactTable = true;
        result = await measureCandidatePage(page, report, {
          kind,
          rows: [row],
          pageNumber: pages.length + 1,
          compactTable: true,
        });
        lastResult = result;
      }
      if (!result.fits) break;
      pageRows.push(row);
    }
    if (pageRows.length === 0) {
      const key = rows[offset]?.issueKey ?? rows[offset]?.issueId ?? offset;
      throw new Error(`La fila ${String(key)} no cabe completa en la pagina de ${kind === 'grouped' ? 'tiempos adicionales' : 'tareas pendientes'}; ${lastResult?.diagnostic ?? 'sin dimensiones disponibles'}`);
    }
    pages.push({ kind, rows: pageRows, pageNumber: pages.length + 1, compactTable });
    offset += pageRows.length;
  }
  return pages;
}

async function buildDomPagination(page, report, { forceCompact = false } = {}) {
  const pages = [];
  for (const issue of report.issues.filter((item) => item.selected && item.grouped !== true)) {
    pages.push(...await paginateIssueByDom(page, report, issue, { forceCompact }));
  }
  pages.push(...await paginateTableByDom(
    page,
    report,
    report.issues.filter((item) => item.selected && item.grouped === true),
    'grouped',
    { forceCompact },
  ));
  pages.push(...await paginateTableByDom(page, report, report.pendingIssues ?? [], 'pending', { forceCompact }));
  return pages;
}

/* Legacy capacity-based measurement helpers were removed from production. */
/*
async function measureImprovementPartsRemovedFromProduction(page, report, issue, { firstPage = false } = {}) {
  const text = String(issue.improvement?.memo ?? '');
  if (!text) return { parts: [''], fitsFirstPage: true };
  const measurementReport = {
    ...report,
    issues: [{
      ...issue,
      selected: true,
      grouped: false,
      corrections: [],
      improvement: { memo: text },
    }],
    pendingIssues: [],
  };
  await page.setContent(buildTimeReportHtml(measurementReport, {
    profile: firstPage
      ? PDF_PAGE_PROFILES.ISSUE_FIRST_MEASUREMENT
      : PDF_PAGE_PROFILES.IMPROVEMENT_ONLY,
    measurementOnly: !firstPage,
    measurementFirstPage: firstPage,
  }), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));

  const fits = (candidate) => page.evaluate(({ value, firstPage: isFirstPage }) => {
    const pageElement = document.querySelector(isFirstPage ? '.issue-page' : '.improvement-only-page');
    const panel = pageElement?.querySelector('.improvement-panel');
    const paragraph = panel?.querySelector('p');
    if (!pageElement || !panel || !paragraph) return false;
    // Keep the same flex layout used by the final PDF. The panels themselves
    // are non-shrinkable, so changing the page display here would measure a
    // different geometry than the exported page.
    pageElement.style.overflow = 'visible';
    paragraph.textContent = value;
    const pageRect = pageElement.getBoundingClientRect();
    const pageStyle = getComputedStyle(pageElement);
    const pageBottom = pageRect.bottom - Number.parseFloat(pageStyle.paddingBottom || '0');
    const panelRect = panel.getBoundingClientRect();
    const paragraphRect = paragraph.getBoundingClientRect();
    return panelRect.bottom <= pageBottom + 1
      && paragraphRect.bottom <= pageBottom + 1
      && paragraph.scrollHeight <= paragraph.clientHeight + 1;
  }, { value: candidate, firstPage });

  const parts = [];
  let offset = 0;
  while (offset < text.length) {
    let low = offset + 1;
    let high = text.length;
    let best = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = text.slice(offset, middle);
      if (await fits(candidate)) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    if (best <= offset) {
      if (firstPage) {
        const standalone = await measureImprovementParts(page, report, issue);
        return { parts: standalone.parts, fitsFirstPage: false };
      }
      throw new Error(`La acción de mejora de ${issue.issueKey} no puede caber ni con un carácter en una página`);
    }
    parts.push(text.slice(offset, best));
    offset = best;
  }
  return { parts, fitsFirstPage: true };
}

async function measureImprovementWithCorrections(
  page,
  report,
  issue,
  corrections,
  { continuation = false, memo = issue.improvement?.memo } = {},
) {
  const measurementReport = {
    ...report,
    issues: [{
      ...issue,
      selected: true,
      grouped: false,
      corrections,
      improvement: { memo: String(memo ?? '') },
    }],
    pendingIssues: [],
  };
  await page.setContent(buildTimeReportHtml(measurementReport, {
    profile: continuation
      ? PDF_PAGE_PROFILES.ISSUE_LAST_WITH_IMPROVEMENT
      : PDF_PAGE_PROFILES.ISSUE_FIRST_COMBINED,
    measurementCombinedFirstPage: !continuation,
    measurementCombinedContinuation: continuation,
    measurementCorrections: { [String(issue.issueKey)]: corrections },
  }), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  return page.evaluate(() => {
    const pageElement = document.querySelector('.issue-page');
    if (!pageElement) return false;
    const pageRect = pageElement.getBoundingClientRect();
    const pageStyle = getComputedStyle(pageElement);
    const pageBottom = pageRect.bottom - Number.parseFloat(pageStyle.paddingBottom || '0');
    return [...pageElement.children].every((element) => (
      element.getBoundingClientRect().bottom <= pageBottom + 1
    ));
  });
}

async function measureImprovementFragmentWithCorrections(page, report, issue, corrections, { continuation = false } = {}) {
  const text = String(issue.improvement?.memo ?? '');
  if (!text || corrections.length === 0) return '';
  let low = 1;
  let high = text.length;
  let best = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const fits = await measureImprovementWithCorrections(
      page,
      report,
      issue,
      corrections,
      { continuation, memo: text.slice(0, middle) },
    );
    if (fits) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best > 0 ? text.slice(0, best) : '';
}

function improvementPartsAfterOffset(parts, offset) {
  if (!Array.isArray(parts) || offset <= 0) return parts;
  let consumed = 0;
  const remaining = [];
  for (const part of parts) {
    const value = String(part ?? '');
    if (consumed + value.length <= offset) {
      consumed += value.length;
      continue;
    }
    const localOffset = Math.max(0, offset - consumed);
    remaining.push(value.slice(localOffset));
    consumed += value.length;
  }
  return remaining.length > 0 ? remaining : [''];
}

async function resolveLastPageImprovementPlacements(
  page,
  report,
  layout,
  currentPlacements = {},
  currentMemos = {},
) {
  const placements = { ...currentPlacements };
  const memos = { ...currentMemos };
  for (const issue of report.issues.filter((item) => item.selected && item.grouped !== true && item.improvement)) {
    const issueKey = String(issue.issueKey);
    if (placements[issueKey] === 'first-page') continue;
    delete placements[issueKey];
    delete memos[issueKey];
    const lastCorrectionPage = [...layout.pageSignature]
      .reverse()
      .find((pageInfo) => (
        pageInfo.issueKey === issueKey
        && ['issue', 'issue-continuation'].includes(pageInfo.pageType)
        && pageInfo.correctionKeys.length > 0
      ));
    if (!lastCorrectionPage) continue;
    const correctionKeys = new Set(lastCorrectionPage.correctionKeys);
    const lastCorrections = (issue.corrections ?? [])
      .filter((correction) => correctionKeys.has(String(correction.correctionKey)));
    const continuation = lastCorrectionPage.pageType === 'issue-continuation';
    if (lastCorrections.length > 0 && await measureImprovementWithCorrections(
      page,
      report,
      issue,
      lastCorrections,
      { continuation },
    )) {
      placements[issueKey] = 'last-page';
      continue;
    }
    const fragment = await measureImprovementFragmentWithCorrections(
      page,
      report,
      issue,
      lastCorrections,
      { continuation },
    );
    if (fragment) {
      placements[issueKey] = 'last-page-fragment';
      memos[issueKey] = fragment;
    }
  }
  return { placements, memos };
}

function correctionRowUnits(correction, measuredHeights = null) {
  const measuredHeight = measuredHeights?.[String(correction?.correctionKey)];
  if (Number.isFinite(measuredHeight) && measuredHeight > 0) {
    return measuredHeight;
  }
  return 1;
}

function variableRowUnits(value, charactersPerLine) {
  if (!Number.isFinite(charactersPerLine) || charactersPerLine <= 0) return 1;
  return textLineUnits(String(value ?? '').trim(), charactersPerLine);
}

function textLineUnits(text, charactersPerLine) {
  const lines = String(text ?? '').split(/\r?\n/);
  return Math.max(1, lines.reduce((total, line) => (
    total + Math.max(1, Math.ceil(line.length / charactersPerLine))
  ), 0));
}

function mergeMeasuredCapacity(measuredCapacity, previousCapacity) {
  if (!Number.isFinite(measuredCapacity) || measuredCapacity <= 0) return previousCapacity;
  if (!Number.isFinite(previousCapacity) || previousCapacity <= 0) return measuredCapacity;
  return Math.min(measuredCapacity, previousCapacity);
}

function describeLayoutDifference(previousSignature, currentSignature) {
  if (!previousSignature) return 'no existe una firma anterior para comparar';
  try {
    const previous = JSON.parse(previousSignature);
    const current = JSON.parse(currentSignature);
    const previousPages = previous.pages ?? [];
    const currentPages = current.pages ?? [];
    const pageCount = Math.max(previousPages.length, currentPages.length);
    for (let index = 0; index < pageCount; index += 1) {
      if (JSON.stringify(previousPages[index]) !== JSON.stringify(currentPages[index])) {
        return `diferencia en pagina ${index + 1}: anterior=${JSON.stringify(previousPages[index] ?? null)}; actual=${JSON.stringify(currentPages[index] ?? null)}`;
      }
    }
    return `diferencia en mediciones: anterior=${JSON.stringify({
      correctionHeights: previous.correctionHeights,
      groupedHeights: previous.groupedHeights,
      pendingHeights: previous.pendingHeights,
      correctionCapacities: previous.correctionCapacities,
      tableCapacities: previous.tableCapacities,
    })}; actual=${JSON.stringify({
      correctionHeights: current.correctionHeights,
      groupedHeights: current.groupedHeights,
      pendingHeights: current.pendingHeights,
      correctionCapacities: current.correctionCapacities,
      tableCapacities: current.tableCapacities,
    })}`;
  } catch {
    return 'las firmas no pudieron deserializarse para mostrar la diferencia';
  }
}

function takeVariableRowsPage(
  rows,
  start,
  capacity,
  getText,
  charactersPerLine,
  measuredHeights = null,
  requireMeasured = false,
) {
  const page = [];
  let used = 0;
  for (let index = start; index < rows.length; index += 1) {
    const rowKey = rows[index]?.issueKey ?? rows[index]?.issueId;
    const measuredHeight = measuredHeights?.[String(rowKey)];
    if (requireMeasured && !(Number.isFinite(measuredHeight) && measuredHeight > 0)) {
      throw new Error(`No se pudo medir la fila ${String(rowKey ?? index)} de la tabla`);
    }
    const units = Number.isFinite(measuredHeight) && measuredHeight > 0
      ? measuredHeight
      : variableRowUnits(getText(rows[index]), charactersPerLine);
    if (requireMeasured && page.length === 0 && units > capacity) {
      throw new Error(`La fila ${String(rowKey ?? index)} no cabe completa en el espacio medido de la tabla`);
    }
    if (page.length > 0 && used + units > capacity) break;
    page.push(rows[index]);
    used += units;
  }
  return { rows: page, nextIndex: start + page.length };
}

function takeCorrectionPage(
  corrections,
  start,
  capacity,
  measuredHeights = null,
  requireMeasured = false,
  compactRows = null,
) {
  const page = [];
  let used = 0;
  for (let index = start; index < corrections.length; index += 1) {
    const correctionKey = String(corrections[index]?.correctionKey ?? index);
    const measuredHeight = measuredHeights?.[correctionKey];
    if (requireMeasured && !(Number.isFinite(measuredHeight) && measuredHeight > 0)) {
      throw new Error(`No se pudo medir la fila ${correctionKey} de problemas presentados`);
    }
    const compact = compactRows?.[correctionKey] === true;
    const measuredUnits = correctionRowUnits(corrections[index], measuredHeights);
    const units = compact && Number.isFinite(capacity)
      ? Math.min(measuredUnits, capacity)
      : measuredUnits;
    if (requireMeasured && page.length === 0 && units > capacity && !compact) {
      throw new Error(`La fila ${correctionKey} no cabe completa en el espacio medido de problemas presentados`);
    }
    if (page.length > 0 && used + units > capacity) break;
    page.push(corrections[index]);
    used += units;
  }
  return page;
}

} */

function describeLayoutDifference(previousSignature, currentSignature) {
  if (!previousSignature || !currentSignature) {
    return 'no existen dos firmas completas para comparar';
  }
  try {
    const previous = JSON.parse(previousSignature);
    const current = JSON.parse(currentSignature);
    const previousPages = previous.pages ?? [];
    const currentPages = current.pages ?? [];
    const pageCount = Math.max(previousPages.length, currentPages.length);
    for (let index = 0; index < pageCount; index += 1) {
      if (JSON.stringify(previousPages[index]) !== JSON.stringify(currentPages[index])) {
        return `diferencia en pagina ${index + 1}: anterior=${JSON.stringify(previousPages[index] ?? null)}; actual=${JSON.stringify(currentPages[index] ?? null)}`;
      }
    }
    return `diferencia en dimensiones: anterior=${JSON.stringify(previous.measurements ?? previous)}; actual=${JSON.stringify(current.measurements ?? current)}`;
  } catch {
    return 'las firmas completas no pudieron deserializarse para mostrar la diferencia';
  }
}

function formatReportDurationOrDash(value) {
  return formatReportDuration(value) || '-';
}

async function validatePdfLayout(
  page,
  expectedCorrectionKeys = [],
  expectedGroupedKeys = [],
  expectedPendingKeys = [],
  expectedImprovementTexts = {},
  { strict = true, expectedIssueKeys = [] } = {},
) {
  const result = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('.page')];
    const failures = [];
    const correctionRowHeights = {};
    const correctionRowIssueKeys = {};
    const correctionRowPageKinds = {};
    const groupedRowHeights = {};
    const pendingRowHeights = {};
    const tablePageCapacities = { grouped: 0, pending: 0 };
    const correctionPanelHeights = { firstPage: 0, continuation: 0, final: 0 };
    const correctionPanelCapacities = {};
    const pageSignature = [];
    const improvementTexts = {};
    const improvementFragments = {};
    const issuePanelPresence = {};
    const epsilon = 1;
    const px = (value) => `${Number(value).toFixed(1)}px`;
    const bottomDetails = (rect, boundary) => `(inferior ${px(rect.bottom)} > limite ${px(boundary)})`;
    const overflowDetails = (element) => (
      `(contenido ${px(element.scrollHeight)} / visible ${px(element.clientHeight)})`
    );
    const widthDetails = (element) => (
      `(contenido ${px(element.scrollWidth)} / visible ${px(element.clientWidth)})`
    );

    pages.forEach((pageElement, pageIndex) => {
      const pageRect = pageElement.getBoundingClientRect();
      const pageType = pageElement.dataset.pageType;
      const pageProfile = pageElement.dataset.pageProfile;
      const pageLabel = `pagina ${pageIndex + 1}${pageElement.dataset.issueKey ? ` (${pageType}: ${pageElement.dataset.issueKey})` : ` (${pageType})`}`;
      const issueKey = pageElement.dataset.issueKey;
      const improvementParagraph = pageElement.querySelector('.improvement-panel p');
      const improvementText = improvementParagraph?.textContent ?? '';
      if (issueKey && improvementParagraph && !improvementParagraph.classList.contains('improvement-empty')) {
        improvementTexts[issueKey] = `${improvementTexts[issueKey] ?? ''}${improvementText}`;
        const fragmentIndex = Number.parseInt(pageElement.dataset.improvementFragmentIndex ?? '', 10);
        (improvementFragments[issueKey] ??= []).push({
          index: Number.isInteger(fragmentIndex) ? fragmentIndex : null,
          text: improvementText,
          pageType,
          pageProfile,
        });
      }
      pageSignature.push({
        pageType,
        pageProfile: pageProfile ?? '',
        pageDensity: pageElement.classList.contains('emergency-compact-page')
          ? 'emergency'
          : pageElement.classList.contains('compact-correction-page')
            || pageElement.classList.contains('compact-improvement-page')
            || pageElement.classList.contains('compact-table-page')
            ? 'compact'
            : 'normal',
        issueKey: issueKey ?? '',
        improvementText,
        improvementFragmentIndex: pageElement.dataset.improvementFragmentIndex ?? '',
        correctionKeys: [...pageElement.querySelectorAll('[data-correction-key]')]
          .map((element) => element.dataset.correctionKey),
        groupedKeys: [...pageElement.querySelectorAll('[data-grouped-issue-key]')]
          .map((element) => element.dataset.groupedIssueKey),
        pendingKeys: [...pageElement.querySelectorAll('[data-pending-issue-key]')]
          .map((element) => element.dataset.pendingIssueKey),
      });
      const hasTable = Boolean(pageElement.querySelector('.grouped-issues-grid-wrap'));
      const isIssuePage = ['issue', 'issue-continuation', 'improvement', 'summary-continuation'].includes(pageType);
      const correctionsPanel = pageElement.querySelector('.corrections');
      const improvementPanel = pageElement.querySelector('.improvement-panel');
      const hasIssuePanel = Boolean(correctionsPanel || improvementPanel);
      if (pageType?.startsWith('table-') && hasIssuePanel) {
        failures.push(`${pageLabel}: pagina de tabla contiene panel de incidencia`);
      }
      if (pageType?.startsWith('issue') && hasTable) {
        failures.push(`${pageLabel}: pagina de incidencia contiene tabla agrupada`);
      }
      [...pageElement.children].forEach((child) => {
        const rect = child.getBoundingClientRect();
        if (rect.bottom > pageRect.bottom + epsilon) {
          failures.push(`${pageLabel}: contenido excede el alto disponible ${bottomDetails(rect, pageRect.bottom)}`);
        }
      });

      pageElement.querySelectorAll('.issue-summary, .correction-row, .corrections .empty, .improvement-panel, .grouped-issues-grid-wrap')
        .forEach((element) => {
          const elementKey = element.dataset.correctionKey
            || element.dataset.groupedIssueKey
            || element.dataset.pendingIssueKey;
          const elementLabel = `${element.className}${elementKey ? ` (${elementKey})` : ''}`;
          const rect = element.getBoundingClientRect();
          if (rect.bottom > pageRect.bottom + epsilon) {
            failures.push(`${pageLabel}: ${elementLabel} excede el limite inferior ${bottomDetails(rect, pageRect.bottom)}`);
          }
          const allowsExplicitSummaryClamp = element.matches(
            '.issue-summary, .correction-summary, .grouped-issues-grid .long-text',
          );
          if (element.scrollHeight > element.clientHeight + epsilon && !allowsExplicitSummaryClamp) {
            failures.push(`${pageLabel}: ${elementLabel} contiene contenido oculto ${overflowDetails(element)}`);
          }
          if (element.scrollWidth > element.clientWidth + epsilon) {
            failures.push(`${pageLabel}: ${elementLabel} excede el ancho disponible ${widthDetails(element)}`);
          }
        });
      pageElement.querySelectorAll('*').forEach((element) => {
        const style = getComputedStyle(element);
        const allowsExplicitSummaryClamp = element.matches(
          '.issue-summary, .correction-summary, .grouped-issues-grid .long-text',
        );
        const rect = element.getBoundingClientRect();
        const hasVisibleText = Boolean(element.textContent?.trim());
        const hiddenByStyle = style.display === 'none'
          || style.visibility === 'hidden'
          || Number.parseFloat(style.opacity || '1') <= 0
          || (rect.width <= 0 && rect.height <= 0);
        const isStructuralTextWrapper = element.matches('.eyebrow');
        if (hasVisibleText && hiddenByStyle && !allowsExplicitSummaryClamp && !isStructuralTextWrapper) {
          failures.push(`${pageLabel}: ${element.className || element.tagName.toLowerCase()} oculta contenido real`);
        }
        const verticalClipping = ['hidden', 'clip'].includes(style.overflowY)
          && element.scrollHeight > element.clientHeight + epsilon;
        const horizontalClipping = ['hidden', 'clip'].includes(style.overflowX)
          && element.scrollWidth > element.clientWidth + epsilon;
        if (verticalClipping && !allowsExplicitSummaryClamp) {
          failures.push(`${pageLabel}: ${element.className || element.tagName.toLowerCase()} contiene contenido oculto ${overflowDetails(element)}`);
        }
        if (horizontalClipping && !allowsExplicitSummaryClamp) {
          failures.push(`${pageLabel}: ${element.className || element.tagName.toLowerCase()} excede el ancho disponible ${widthDetails(element)}`);
        }
      });
      pageElement.querySelectorAll('.correction-row, .grouped-issues-grid tr, .pending-issue-row')
        .forEach((row) => {
          const rect = row.getBoundingClientRect();
          const rowKey = row.dataset.correctionKey || row.dataset.groupedIssueKey || row.dataset.pendingIssueKey;
          if (row.dataset.correctionKey) {
            correctionRowHeights[row.dataset.correctionKey] = rect.height;
            correctionRowIssueKeys[row.dataset.correctionKey] = pageElement.dataset.issueKey ?? '';
            correctionRowPageKinds[row.dataset.correctionKey] = pageElement.classList.contains('correction-continuation-page')
              ? (pageElement.querySelector('.improvement-panel') ? 'final' : 'continuation')
              : 'firstPage';
          }
          if (row.dataset.groupedIssueKey) groupedRowHeights[row.dataset.groupedIssueKey] = rect.height;
          if (row.dataset.pendingIssueKey) pendingRowHeights[row.dataset.pendingIssueKey] = rect.height;
          const parentPanel = row.closest('.corrections, .grouped-issues-grid-wrap, .pending-issues-grid-wrap');
          const panelRect = parentPanel?.getBoundingClientRect();
          if (!Number.isFinite(rect.height) || rect.height <= 0) {
            failures.push(`${pageLabel}: fila ${rowKey ?? '(sin clave)'} sin altura medible`);
          }
          if (panelRect && rect.bottom > panelRect.bottom + epsilon) {
            failures.push(`${pageLabel}: fila ${rowKey ?? '(sin clave)'} excede el panel que la contiene ${bottomDetails(rect, panelRect.bottom)}`);
          }
        });
      const corrections = pageElement.querySelector('.corrections');
      if (corrections) {
        const correctionRect = corrections.getBoundingClientRect();
        const improvement = pageElement.querySelector('.improvement-panel');
        const pageStyle = getComputedStyle(pageElement);
        const pageBottomBoundary = pageRect.bottom - Number.parseFloat(pageStyle.paddingBottom || '0');
        const improvementRect = improvement?.getBoundingClientRect();
        const improvementStyle = improvement ? getComputedStyle(improvement) : null;
        const improvementMarginTop = improvementStyle
          ? Number.parseFloat(improvementStyle.marginTop || '0')
          : 0;
        const improvementHeight = improvementRect?.height ?? 0;
        // If the provisional page pushed the action panel below the page,
        // reserve its actual DOM height instead of using the off-page top as
        // the row boundary. This prevents an unbounded correction batch.
        const nextBoundary = improvementRect
          ? Math.min(
            improvementRect.top,
            pageBottomBoundary - improvementHeight - improvementMarginTop,
          )
          : pageBottomBoundary;
        const titleHeight = corrections.querySelector('.section-title')?.getBoundingClientRect().height ?? 0;
        const firstRow = corrections.querySelector('.correction-row, .empty');
        const firstRowTop = firstRow?.getBoundingClientRect().top ?? correctionRect.top + titleHeight;
        const correctionStyle = getComputedStyle(corrections);
        const correctionBottomReserve = (
          Number.parseFloat(correctionStyle.paddingBottom || '0')
          + Number.parseFloat(correctionStyle.borderBottomWidth || '0')
          + (improvementStyle ? Number.parseFloat(improvementStyle.marginTop || '0') : 0)
        );
        // Derive the row budget from the actual section boundaries instead of
        // subtracting a fixed safety value that can waste usable page space.
        const availableHeight = Math.max(0, nextBoundary - firstRowTop - correctionBottomReserve);
        const key = pageElement.classList.contains('correction-continuation-page')
          ? (improvement ? 'final' : 'continuation')
          : 'firstPage';
        correctionPanelHeights[key] = correctionPanelHeights[key] > 0
          ? Math.min(correctionPanelHeights[key], availableHeight)
          : availableHeight;
        const issueKey = pageElement.dataset.issueKey;
        if (issueKey) {
          const capacityKey = `${issueKey}:${key}`;
          correctionPanelCapacities[capacityKey] = correctionPanelCapacities[capacityKey] > 0
            ? Math.min(correctionPanelCapacities[capacityKey], availableHeight)
            : availableHeight;
        }
      }
      const table = pageElement.querySelector('.grouped-issues-grid-wrap');
      if (table) {
        const tableRect = table.getBoundingClientRect();
        const headerRect = table.querySelector('thead')?.getBoundingClientRect();
        const pageStyle = getComputedStyle(pageElement);
        const tableStyle = getComputedStyle(table);
        const pageBottomBoundary = pageRect.bottom - Number.parseFloat(pageStyle.paddingBottom || '0');
        const footerRect = pageElement.querySelector('footer')?.getBoundingClientRect();
        const contentBoundary = footerRect && footerRect.top > tableRect.top
          ? Math.min(pageBottomBoundary, footerRect.top)
          : pageBottomBoundary;
        const tableBorderReserve = (
          Number.parseFloat(tableStyle.borderTopWidth || '0')
          + Number.parseFloat(tableStyle.borderBottomWidth || '0')
        );
        const availableRowsHeight = Math.max(
          0,
          contentBoundary - tableRect.top - (headerRect?.height ?? 0) - tableBorderReserve,
        );
        const capacity = Math.max(1, availableRowsHeight);
        const title = pageElement.querySelector('.grouped-issues-heading h1')?.textContent ?? '';
        const key = title.includes('Tareas Pendientes') ? 'pending' : 'grouped';
        tablePageCapacities[key] = tablePageCapacities[key] > 0
          ? Math.min(tablePageCapacities[key], capacity)
          : capacity;
      }
      if (isIssuePage && issueKey) {
        const state = issuePanelPresence[issueKey] ?? { problems: false, improvements: false };
        state.problems ||= Boolean(correctionsPanel);
        state.improvements ||= Boolean(improvementPanel);
        issuePanelPresence[issueKey] = state;
      }
    });

    const renderedCorrectionKeys = [...document.querySelectorAll('[data-correction-key]')]
      .map((element) => element.dataset.correctionKey);
    return {
      pageCount: pages.length,
      failures: [...new Set(failures)],
      renderedCorrectionKeys,
      renderedGroupedKeys: [...document.querySelectorAll('[data-grouped-issue-key]')]
        .map((element) => element.dataset.groupedIssueKey),
      renderedPendingKeys: [...document.querySelectorAll('[data-pending-issue-key]')]
        .map((element) => element.dataset.pendingIssueKey),
      correctionRowHeights,
      correctionRowIssueKeys,
      correctionRowPageKinds,
      groupedRowHeights,
      pendingRowHeights,
      tablePageCapacities,
      correctionPanelHeights,
      correctionPanelCapacities,
      pageSignature,
      improvementTexts,
      improvementFragments,
      issuePanelPresence,
    };
  });

  if (strict && result.failures.length > 0) {
    throw new Error(`El contenido no cabe completo en el PDF: ${result.failures.join('; ')}`);
  }
  if (strict && expectedCorrectionKeys.length > 0) {
    const expected = expectedCorrectionKeys.map((key) => String(key));
    const actual = result.renderedCorrectionKeys;
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
      throw new Error('El PDF no contiene exactamente todas las incidencias de problemas presentados en el orden esperado');
    }
  }
  if (strict) {
    const renderedIssuePages = new Set(
      result.pageSignature
        .filter(({ pageType }) => ['issue', 'issue-continuation', 'improvement', 'summary-continuation'].includes(pageType))
        .map(({ issueKey }) => issueKey)
        .filter(Boolean),
    );
    expectedIssueKeys.forEach((issueKey) => {
      const key = String(issueKey);
      if (!renderedIssuePages.has(key)) {
        throw new Error(`La incidencia ${key} no tiene ninguna pagina renderizada`);
      }
      const panels = result.issuePanelPresence[key] ?? {};
      if (!panels.problems) {
        throw new Error(`La incidencia ${key} no tiene panel de problemas presentados`);
      }
      if (Object.prototype.hasOwnProperty.call(expectedImprovementTexts, key) && !panels.improvements) {
        throw new Error(`La incidencia ${key} no tiene panel de acciones de mejora`);
      }
    });
  }
  const validateKeys = (expectedKeys, actualKeys, label) => {
    if (expectedKeys.length === 0) return;
    const expected = expectedKeys.map((key) => String(key));
    if (actualKeys.length !== expected.length || actualKeys.some((key, index) => key !== expected[index])) {
      throw new Error(`El PDF no contiene exactamente todas las filas de ${label} en el orden esperado`);
    }
  };
  if (strict) {
    validateKeys(expectedGroupedKeys, result.renderedGroupedKeys, 'tiempos adicionales');
    validateKeys(expectedPendingKeys, result.renderedPendingKeys, 'tareas pendientes');
    Object.entries(expectedImprovementTexts).forEach(([issueKey, expectedText]) => {
      const actualText = result.improvementTexts[issueKey] ?? '';
      if (actualText !== String(expectedText ?? '')) {
        throw new Error(`El PDF altero el texto exacto de acciones de mejora de ${issueKey}: esperado=${JSON.stringify(String(expectedText ?? '').slice(0, 80))} (${String(expectedText ?? '').length} caracteres), actual=${JSON.stringify(actualText.slice(0, 80))} (${actualText.length} caracteres)`);
      }
      const fragments = result.improvementFragments[issueKey] ?? [];
      const expectedIndexes = fragments.map((fragment) => fragment.index);
      if (expectedIndexes.some((index) => !Number.isInteger(index))) {
        throw new Error(`El PDF no identifica todos los fragmentos de acciones de mejora de ${issueKey}: fragmentos=${JSON.stringify(fragments.map(({ index, pageType, pageProfile }) => ({ index, pageType, pageProfile })))}`);
      }
      for (let index = 0; index < expectedIndexes.length; index += 1) {
        if (expectedIndexes[index] !== index) {
          throw new Error(`El PDF reordeno los fragmentos de acciones de mejora de ${issueKey}`);
        }
      }
    });
  }
  return result;
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
  constructor({ exportsDir = path.join(process.cwd(), 'exports'), browserLauncher = launchPdfBrowser } = {}) {
    this.exportsDir = exportsDir;
    this.browserLauncher = browserLauncher;
  }

  async generate(report) {
    await fs.mkdir(this.exportsDir, { recursive: true });
    const safeName = String(report.userDisplayName ?? 'usuario')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'usuario';
    const fileName = `informe-tiempos-${safeName}-${report.fromDate}-${report.toDate}.pdf`;
    const filePath = path.join(this.exportsDir, fileName);
    await fs.rm(filePath, { force: true });

    const expectedCorrectionKeys = report.issues
      .filter((issue) => issue.selected && issue.grouped !== true)
      .flatMap((issue) => (issue.corrections ?? []).map((correction) => correction.correctionKey));
    const expectedIssueKeys = report.issues
      .filter((issue) => issue.selected && issue.grouped !== true)
      .map((issue) => issue.issueKey);
    const expectedGroupedKeys = report.issues
      .filter((issue) => issue.selected && issue.grouped === true)
      .map((issue) => issue.issueKey);
    const expectedPendingKeys = (report.pendingIssues ?? [])
      .map((issue) => issue.issueKey ?? issue.issueId);
    const expectedImprovementTexts = Object.fromEntries(
      report.issues
        .filter((issue) => issue.selected && issue.grouped !== true && String(issue.improvement?.memo ?? '').trim().length > 0)
        .map((issue) => [String(issue.issueKey), String(issue.improvement.memo)]),
    );
    const { browser } = await this.browserLauncher();
    try {
      const measurementPage = await browser.newPage();
      const renderPage = await browser.newPage();
      await measurementPage.emulateMedia({ media: 'print' });
      await renderPage.emulateMedia({ media: 'print' });

      let previousSignature = null;
      let currentSignature = null;
      let stablePages = null;
      let lastDiagnostics = '';
      let forceCompact = false;
      const maxPasses = 32;
      for (let pass = 1; pass <= maxPasses; pass += 1) {
        let domPages;
        try {
          domPages = await buildDomPagination(measurementPage, report, { forceCompact });
        } catch (error) {
          const message = String(error.message ?? error);
          if (!/no cabe|no se pudo medir/i.test(message)) throw error;
          lastDiagnostics = `empaquetado ${pass}: ${message}`;
          previousSignature = null;
          currentSignature = null;
          if (forceCompact === false) {
            forceCompact = true;
            continue;
          }
          if (forceCompact === true) {
            forceCompact = 'emergency';
            continue;
          }
          throw new Error(`El contenido no pudo redistribuirse en el perfil de emergencia: ${lastDiagnostics}`, { cause: error });
        }
        const html = buildTimeReportHtml(report, { domPages });
        await renderPage.setContent(html, { waitUntil: 'load' });
        await renderPage.evaluate(() => document.fonts?.ready);
        await renderPage.waitForFunction(() => [...document.images].every((image) => image.complete));

        const layout = await validatePdfLayout(
          renderPage,
          expectedCorrectionKeys,
          expectedGroupedKeys,
          expectedPendingKeys,
          expectedImprovementTexts,
          { strict: false, expectedIssueKeys },
        );
        const signature = JSON.stringify({
          pages: layout.pageSignature,
          correctionRows: layout.correctionRowHeights,
          groupedRows: layout.groupedRowHeights,
          pendingRows: layout.pendingRowHeights,
          correctionCapacities: layout.correctionPanelCapacities,
          tableCapacities: layout.tablePageCapacities,
        });

        if (layout.failures.length > 0) {
          lastDiagnostics = `medicion ${pass}: ${layout.failures.join('; ')}`;
          // A final geometry failure is recoverable: rebuild every candidate
          // with the compact DOM profile instead of retrying the same layout.
          // A failed pass never counts toward the two consecutive signatures.
          previousSignature = null;
          currentSignature = null;
          if (!forceCompact) {
            forceCompact = true;
            continue;
          }
          if (forceCompact === true) {
            forceCompact = 'emergency';
            continue;
          }
          throw new Error(`El contenido no pudo redistribuirse en el perfil de emergencia: ${lastDiagnostics}`);
        }
        previousSignature = currentSignature;
        currentSignature = signature;
        if (currentSignature !== previousSignature) {
          lastDiagnostics = '';
          continue;
        }

        let finalLayout;
        try {
          finalLayout = await validatePdfLayout(
            renderPage,
            expectedCorrectionKeys,
            expectedGroupedKeys,
            expectedPendingKeys,
            expectedImprovementTexts,
            { expectedIssueKeys },
          );
        } catch (error) {
          if (String(error.message).startsWith('El contenido no cabe completo en el PDF:') && forceCompact !== 'emergency') {
            forceCompact = forceCompact === false ? true : 'emergency';
            previousSignature = null;
            currentSignature = null;
            lastDiagnostics = `validacion final ${pass}: ${error.message}`;
            continue;
          }
          throw error;
        }
        stablePages = domPages;
        if (finalLayout.failures.length > 0) {
          throw new Error(`El contenido no cabe completo en el PDF: ${finalLayout.failures.join('; ')}`);
        }
        break;
      }

      if (!stablePages) {
        throw new Error(`La distribucion del PDF no se estabilizo: ${lastDiagnostics || describeLayoutDifference(previousSignature, currentSignature)}`);
      }
      await renderPage.pdf({
        path: filePath,
        width: '338.67mm',
        height: '190.5mm',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return { fileName, filePath, pages: stablePages.length, signature: currentSignature };
    } catch (error) {
      // Never leave a stale or partially written PDF after any generation error.
      await fs.rm(filePath, { force: true });
      throw error;
    } finally {
      await browser.close();
    }
  }
}

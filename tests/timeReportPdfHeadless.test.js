import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { TimeReportPdfGenerator } from '../src/main/reports/timeReportPdfGenerator.js';

const headlessTest = process.env.RUN_PDF_HEADLESS_TESTS === '1' ? test : test.skip;

function reportFixture(pdfTheme, { corrections = [], improvement = null, grouped = [], pendingIssues = [] } = {}) {
  return {
    pdfTheme,
    fromDate: '2026-09-01',
    toDate: '2026-09-15',
    userDisplayName: 'Usuario de prueba',
    issues: [
      {
        selected: true,
        issueKey: 'QA-HEADLESS',
        summary: 'Resumen corto de prueba',
        status: 'En Progreso',
        issueType: 'Tarea',
        assignee: 'Usuario',
        reporter: 'Usuario',
        corrections,
        improvement: improvement ? { memo: improvement } : null,
      },
      ...grouped.map((issue, index) => ({
        selected: true,
        grouped: true,
        issueKey: issue.issueKey ?? `GROUP-${index + 1}`,
        issueType: 'Tarea',
        summary: issue.summary,
        rangeSeconds: 3600,
        status: 'Creado',
        corrections: [],
      })),
    ],
    pendingIssues: pendingIssues.map((summary, index) => ({
      issueKey: `PENDING-${index + 1}`,
      summary,
      issueType: 'Tarea',
      reporter: 'Usuario',
      status: 'En Espera',
    })),
  };
}

headlessTest('genera combinaciones completas de PDF en claro y oscuro', async () => {
  const exportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-pdf-headless-'));
  const longMemo = 'Accion de mejora completa que debe conservarse sin truncar. '.repeat(160);
  const corrections = Array.from({ length: 18 }, (_, index) => ({
    correctionKey: `COR-${index + 1}`,
    summary: index % 2 === 0 ? 'Problema corto' : 'Problema con una descripcion larga '.repeat(8),
    status: 'Cerrado',
  }));
  const grouped = Array.from({ length: 18 }, (_, index) => ({
    issueKey: `GROUP-${index + 1}`,
    summary: index % 2 === 0 ? 'Asunto agrupado corto' : 'Asunto agrupado largo '.repeat(8),
  }));
  const pending = Array.from({ length: 18 }, (_, index) => (
    index % 2 === 0 ? 'Pendiente corto' : 'Pendiente largo '.repeat(8)
  ));

  try {
    for (const pdfTheme of ['claro', 'oscuro']) {
      const result = await new TimeReportPdfGenerator({ exportsDir }).generate(reportFixture(pdfTheme, {
        corrections,
        improvement: longMemo,
        grouped,
        pendingIssues: pending,
      }));
      assert.ok(result.pages >= 4);
      assert.equal((await fs.stat(result.filePath)).isFile(), true);
    }
  } finally {
    await fs.rm(exportsDir, { recursive: true, force: true });
  }
});

headlessTest('reparte correcciones masivas y acciones independientes sin desbordar', async () => {
  const exportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-pdf-headless-regression-'));
  const corrections = Array.from({ length: 42 }, (_, index) => ({
    correctionKey: `REG-${index + 1}`,
    summary: index % 3 === 0 ? 'Descripcion extensa '.repeat(7) : 'Problema corto',
    status: 'Cerrado',
  }));

  try {
    for (const pdfTheme of ['claro', 'oscuro']) {
      const manyCorrections = reportFixture(pdfTheme, { corrections });
      const correctionsResult = await new TimeReportPdfGenerator({ exportsDir }).generate(manyCorrections);
      assert.ok(correctionsResult.pages > 1);

      const standaloneImprovement = reportFixture(pdfTheme, {
        improvement: 'Accion extensa sin problemas asociados '.repeat(180),
      });
      const improvementResult = await new TimeReportPdfGenerator({ exportsDir }).generate(standaloneImprovement);
      assert.ok(improvementResult.pages > 1);
    }
  } finally {
    await fs.rm(exportsDir, { recursive: true, force: true });
  }
});

headlessTest('usa la capacidad minima cuando las incidencias tienen encabezados de distinta altura', async () => {
  const exportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-pdf-headless-variable-header-'));
  const memo = 'Accion de mejora con contenido que debe conservarse completo. '.repeat(300);

  try {
    for (const pdfTheme of ['claro', 'oscuro']) {
      const report = reportFixture(pdfTheme);
      const baseIssue = report.issues[0];
      report.issues = [
        {
          ...baseIssue,
          issueKey: 'SHORT-1',
          improvement: { memo },
        },
        {
          ...baseIssue,
          issueKey: 'TALL-1',
          summary: 'Resumen con encabezado variable '.repeat(15),
          issueType: 'Tipo de incidencia con una descripcion particularmente extensa',
          assignee: 'Responsable con un nombre muy extenso para forzar el ajuste vertical',
          reporter: 'Informador con un nombre muy extenso para forzar el ajuste vertical',
          tester: 'Tester con un nombre muy extenso para forzar el ajuste vertical',
          estadoGeneral: 'Estado general con una descripcion extensa',
          improvement: { memo },
        },
      ];
      const result = await new TimeReportPdfGenerator({ exportsDir }).generate(report);
      assert.ok(result.pages > 2);
      assert.equal((await fs.stat(result.filePath)).isFile(), true);
    }
  } finally {
    await fs.rm(exportsDir, { recursive: true, force: true });
  }
});

headlessTest('redivide acciones cuando los saltos de linea no se distribuyen uniformemente', async () => {
  const exportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-pdf-headless-line-breaks-'));
  const memo = `${'\n'.repeat(80)}${'Accion de mejora con texto completo. '.repeat(250)}`;

  try {
    for (const pdfTheme of ['claro', 'oscuro']) {
      const result = await new TimeReportPdfGenerator({ exportsDir }).generate(reportFixture(pdfTheme, {
        improvement: memo,
      }));
      assert.ok(result.pages > 2);
      assert.equal((await fs.stat(result.filePath)).isFile(), true);
    }
  } finally {
    await fs.rm(exportsDir, { recursive: true, force: true });
  }
});

headlessTest('mide si las acciones caben junto al ultimo bloque de problemas', async () => {
  const exportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-pdf-headless-last-panel-'));
  const corrections = Array.from({ length: 30 }, (_, index) => ({
    correctionKey: `LAST-${index + 1}`,
    summary: index % 2 === 0 ? 'Problema corto' : 'Problema con descripcion de dos lineas '.repeat(4),
    status: 'Cerrado',
  }));

  try {
    for (const pdfTheme of ['claro', 'oscuro']) {
      const result = await new TimeReportPdfGenerator({ exportsDir }).generate(reportFixture(pdfTheme, {
        corrections,
        improvement: 'Accion final que debe conservarse completa.',
      }));
      assert.ok(result.pages > 1);
    }
  } finally {
    await fs.rm(exportsDir, { recursive: true, force: true });
  }
});

headlessTest('omite el panel de acciones cuando la incidencia esta vacia', async () => {
  const exportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-pdf-headless-empty-'));
  try {
    for (const pdfTheme of ['claro', 'oscuro']) {
      const result = await new TimeReportPdfGenerator({ exportsDir }).generate(reportFixture(pdfTheme));
      assert.equal(result.pages, 1);
      assert.equal((await fs.stat(result.filePath)).isFile(), true);
    }
  } finally {
    await fs.rm(exportsDir, { recursive: true, force: true });
  }
});

headlessTest('conserva acciones exactas y soporta palabras largas, tildes y saltos', async () => {
  const exportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-pdf-headless-special-'));
  const memo = 'Linea 1: áéíóú Ñ ñ <>&\nLinea 2: ' + 'PalabraExtremadamenteLarga'.repeat(80);
  const corrections = [
    { correctionKey: 'SPECIAL-1', summary: 'Una linea de correccion', status: 'Cerrado' },
    { correctionKey: 'SPECIAL-2', summary: 'Dos lineas de correccion\ncon caracteres áéíóú', status: 'En Progreso' },
  ];
  try {
    for (const pdfTheme of ['claro', 'oscuro']) {
      const result = await new TimeReportPdfGenerator({ exportsDir }).generate(reportFixture(pdfTheme, {
        corrections,
        improvement: memo,
      }));
      assert.ok(result.pages >= 1);
      assert.equal((await fs.stat(result.filePath)).isFile(), true);
    }
  } finally {
    await fs.rm(exportsDir, { recursive: true, force: true });
  }
});

headlessTest('mide tablas de una y varias paginas y estabiliza dos ejecuciones iguales', async () => {
  const exportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-pdf-headless-tables-'));
  try {
    for (const pdfTheme of ['claro', 'oscuro']) {
      const onePage = reportFixture(pdfTheme, {
        grouped: [{ issueKey: 'GROUP-ONE', summary: 'Asunto corto' }],
        pendingIssues: ['Pendiente corto'],
      });
      const first = await new TimeReportPdfGenerator({ exportsDir }).generate(onePage);
      const second = await new TimeReportPdfGenerator({ exportsDir }).generate(onePage);
      assert.equal(second.pages, first.pages);
      assert.equal(second.signature, first.signature);
      assert.equal((await fs.stat(second.filePath)).isFile(), true);

      const manyRows = reportFixture(pdfTheme, {
        grouped: Array.from({ length: 40 }, (_, index) => ({ issueKey: `GROUP-${index}`, summary: `Asunto ${index} ${'largo '.repeat(8)}` })),
        pendingIssues: Array.from({ length: 40 }, (_, index) => `Pendiente ${index} ${'largo '.repeat(8)}`),
      });
      const many = await new TimeReportPdfGenerator({ exportsDir }).generate(manyRows);
      assert.ok(many.pages > first.pages);
    }
  } finally {
    await fs.rm(exportsDir, { recursive: true, force: true });
  }
});

headlessTest('no deja archivo cuando falla el motor externo', async () => {
  const exportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-pdf-headless-external-'));
  const report = reportFixture('claro');
  const filePath = path.join(exportsDir, 'informe-tiempos-usuario-de-prueba-2026-09-01-2026-09-15.pdf');
  try {
    await assert.rejects(
      () => new TimeReportPdfGenerator({
        exportsDir,
        browserLauncher: async () => { throw new Error('browser externo no disponible'); },
      }).generate(report),
      /browser externo no disponible/,
    );
    await assert.rejects(() => fs.stat(filePath), { code: 'ENOENT' });
  } finally {
    await fs.rm(exportsDir, { recursive: true, force: true });
  }
});

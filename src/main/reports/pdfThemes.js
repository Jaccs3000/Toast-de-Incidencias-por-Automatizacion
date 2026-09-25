const DARK_PDF_THEME = Object.freeze({
  name: 'Oscuro',
  variables: Object.freeze({
    pageBackground: '#091128',
    bodyBackground: '#070d20',
    text: '#edf1ff',
    mutedText: '#a9b6e2',
    label: '#c4e8d2',
    primaryValue: '#b8e4c6',
    whiteValue: '#ffffff',
    secondaryValue: '#d4c5fa',
    timeValue: '#b9e8fa',
    accent: '#ffd45a',
    issueKey: '#72c9ff',
    border: 'rgba(145,160,255,.35)',
    panelBackground: 'rgba(20,31,67,.65)',
    sectionBackground: 'rgba(20,31,67,.65)',
    tableHeaderBackground: 'rgba(45,77,160,.18)',
    emptyText: '#99a6ce',
    radialGlow: 'rgba(83,105,218,.22)',
    iconBackground: 'rgba(45,77,160,.28)',
    iconBorder: 'rgba(126,153,255,.42)',
    iconStroke: '#a9bbff',
    sectionTitle: '#c9d3ff',
    statusDanger: '#ff7c87',
    statusCreated: '#7fa9ff',
    statusNew: '#b9a5ff',
    statusClosed: '#ff8b99',
    statusProgress: '#71e6a4',
    statusWaiting: '#f3c15b',
    statusProduction: '#5bdbe0',
    statusOther: '#9eafff',
    type1: '#66f3ff', type2: '#e3a7ff', type3: '#ffe36e',
    type4: '#72ffae', type5: '#ff91ad', type6: '#9ebdff',
  }),
});

const LIGHT_PDF_THEME = Object.freeze({
  name: 'Claro',
  variables: Object.freeze({
    pageBackground: '#f4f7fb',
    bodyBackground: '#e8edf5',
    text: '#1d2638',
    mutedText: '#53627a',
    label: '#386b55',
    primaryValue: '#244f3d',
    whiteValue: '#172235',
    secondaryValue: '#514477',
    timeValue: '#245d79',
    accent: '#9a6500',
    issueKey: '#12628f',
    border: 'rgba(66,87,125,.34)',
    panelBackground: 'rgba(224,232,244,.82)',
    sectionBackground: 'rgba(225,232,243,.9)',
    tableHeaderBackground: 'rgba(184,199,226,.42)',
    emptyText: '#53627a',
    radialGlow: 'rgba(106,133,208,.18)',
    iconBackground: 'rgba(112,139,207,.16)',
    iconBorder: 'rgba(72,103,170,.48)',
    iconStroke: '#365d9d',
    sectionTitle: '#304f82',
    statusDanger: '#a3294d',
    statusCreated: '#4776c5',
    statusNew: '#4f5fa0',
    statusClosed: '#b32645',
    statusProgress: '#187347',
    statusWaiting: '#956300',
    statusProduction: '#08707a',
    statusOther: '#4f5fa0',
    type1: '#007a8a', type2: '#77439b', type3: '#8a6500',
    type4: '#187347', type5: '#a3294d', type6: '#365da3',
  }),
});

export const PDF_THEMES = Object.freeze({
  oscuro: DARK_PDF_THEME,
  claro: LIGHT_PDF_THEME,
});

export function getPdfTheme(themeName = 'oscuro') {
  return PDF_THEMES[String(themeName ?? '').trim().toLocaleLowerCase()] ?? DARK_PDF_THEME;
}

export function pdfThemeVariables(themeName = 'oscuro') {
  const theme = getPdfTheme(themeName);
  return Object.entries(theme.variables)
    .map(([name, value]) => `--pdf-${name.replace(/[A-Z0-9]/g, (letter) => `-${letter.toLowerCase()}`)}:${value};`)
    .join('');
}

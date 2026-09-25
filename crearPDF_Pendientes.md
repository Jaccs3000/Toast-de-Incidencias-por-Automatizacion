Plan de acción para cerrar los faltantes:
1. Eliminar la paginación heredada
Retirar de [timeReportPdfGenerator.js](C:/Jira Notifications/src/main/reports/timeReportPdfGenerator.js) las ramas de measurementPass, capacidades acumuladas, perfiles de medición antiguos y funciones que ya no usa generate().
La única ruta de producción quedará así: página candidata DOM → medir → aceptar o mover elemento completo → reconstruir.
Criterio: no quedarán capacidades numéricas ni rutas alternativas que puedan volver a usar estimaciones.
2. Validar acciones sin normalizar texto
Cambiar la validación de acciones para comparar el texto exacto fragmento por fragmento, incluido cada salto de línea, espacio significativo y carácter especial.
Cada panel de acción llevará un identificador de incidencia y de orden de fragmento para reconstruir el contenido original exactamente antes de exportar.
Criterio: cualquier pérdida, alteración o reordenamiento de texto detendrá la exportación.
3. Convertir desbordes recuperables en reempaquetado
Reemplazar los errores de “no cabe” por perfiles progresivos medidos en DOM:
- Correcciones: perfil normal y perfil compacto.
- Tablas: perfil normal y compacto si una fila excepcional lo requiere.
- Acciones: página exclusiva normal y perfil compacto si un fragmento mínimo no cabe.
- Palabras largas: conservar overflow-wrap:anywhere para evitar pérdida horizontal.
La generación solo fallará por causas externas reales, como navegador no disponible o error al escribir el archivo.
Criterio: ninguna incidencia, corrección, acción o fila de tabla se omite ni causa error por su volumen.
4. Corregir estabilización y diagnósticos
Conservar las dos últimas firmas completas en cada ciclo. Si no hay convergencia, el error mostrará la diferencia real entre ambas, no la misma firma comparada consigo misma.
Cada diagnóstico incluirá página, tipo, incidencia, fila o corrección, índice de fragmento, alto disponible, alto requerido y causa de ajuste.
Criterio: cualquier fallo permite localizar el elemento exacto sin revisar manualmente todo el PDF.
5. Completar la matriz de pruebas
Agregar pruebas headless reales para:
- Incidencia vacía, con ambos paneles vacíos.
- Correcciones de una y dos líneas.
- Palabras extremadamente largas, tildes, caracteres especiales y saltos de línea.
- Acciones largas en varias páginas.
- Tablas de tiempos y pendientes en una y varias páginas.
- Dos ejecuciones consecutivas con igual entrada e igual firma.
- Casos de perfil compacto para correcciones, acciones y tablas.
- Verificación de que no se crea archivo si falla una causa externa.
Criterio: ejecutar la matriz en claro y oscuro, además de una revisión visual final con reportes reales.
El alcance se mantiene limitado al generador PDF y sus pruebas; no se modificarán Jira, sincronización, persistencia ni interfaz.
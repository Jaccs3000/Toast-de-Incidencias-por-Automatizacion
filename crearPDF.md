Objetivo
Dejar la generación del PDF blindada para cualquier cantidad de incidencias, correcciones, acciones de mejora, tiempos adicionales y tareas pendientes:
- Sin contenido oculto, truncado fuera de las reglas permitidas o omitido.
- Sin filas partidas.
- Sin páginas de medición exportadas por error.
- Sin espacio desperdiciado cuando una fila o un fragmento de acción sí puede caber.
- Con una distribución que solo se exporta después de estabilizarse.
El alcance quedará concentrado en [timeReportPdfGenerator.js](C:/Jira Notifications/src/main/reports/timeReportPdfGenerator.js) y las pruebas de PDF. No se modificarán consultas Jira, sincronización, persistencia ni la interfaz de la aplicación.
Flujo Objetivo
Datos del reporte
      |
      v
Validar datos y contratos
      |
      v
Medir en DOM separado, con estilos de impresión
      |
      v
Construir páginas candidatas por tipo
      |
      v
Agregar filas y fragmentos solo mientras encajen
      |
      v
Validar contenido, paneles, orden y límites
      |
      v
¿La firma de distribución cambió?
      |
  Sí -- repetir medición y armado
  No -- exportar PDF
Plan De Acción
1. Separar completamente la página de medición de la página de exportación
Actualmente, algunas funciones de medición reutilizan la misma página que después se valida y exporta. Eso abre la posibilidad de que una página temporal sustituya al documento final.
Se modificará generate() para crear dos instancias:
- measurementPage: usada exclusivamente para setContent, mediciones y pruebas de ajuste.
- renderPage: usada exclusivamente para el HTML final, validación final y page.pdf().
Todas las funciones de medición recibirán measurementPage. La página de exportación no volverá a contener HTML temporal.
Criterio de aceptación: ninguna función de medición podrá modificar el DOM que se exporta.
2. Definir explícitamente los perfiles de página
Se reemplazarán los modos dispersos de medición por perfiles explícitos:
- Primera página de incidencia con detalles.
- Primera página con panel vacío de acciones.
- Continuación de problemas.
- Última continuación con acciones vacías.
- Última continuación con acciones reales.
- Página exclusiva de acciones.
- Página de tiempos adicionales.
- Página de tareas pendientes.
Cada perfil incluirá exactamente los componentes fijos que tendrá la página final. Esto corrige la medición actual que omite el panel vacío de acciones aunque luego se muestre en el PDF.
Criterio de aceptación: una medición y su página final tendrán la misma estructura, estilos, padding, encabezado y paneles fijos.
3. Eliminar los últimos respaldos por caracteres o valores globales
Se retirarán del flujo final:
- improvementCharacters.
- El factor heurístico 0.72.
- Capacidades compartidas no asociadas a una incidencia concreta.
- Infinity como respaldo de paginación.
- División alternativa por caracteres durante la exportación.
La única fuente válida para decidir qué cabe será el DOM medido. Los valores por caracteres podrán existir únicamente en pruebas unitarias de HTML estático, nunca en generate().
Criterio de aceptación: si una altura, capacidad o fragmento no fue medido, el PDF falla con un mensaje explícito y no usa una estimación.
4. Rehacer el empaquetado de problemas por página
Se implementará un empaquetador único para problemas:
1. Crea una página candidata con su perfil real.
2. Agrega una corrección completa.
3. Mide el resultado.
4. Conserva la fila si cabe.
5. Pasa la siguiente fila completa a la siguiente página si no cabe.
La primera página se calculará con su encabezado y detalle. Las continuaciones se calcularán con su encabezado de continuación. La última continuación tendrá en cuenta el panel de acciones cuando corresponda.
Esto evita depender de una altura estimada acumulada que puede variar por tipografía, bordes, saltos de línea o tema.
Criterio de aceptación: ninguna corrección se parte, se oculta ni se mueve innecesariamente a una página nueva.
5. Empaquetar acciones por fragmentos dentro del espacio sobrante
Las acciones de mejora conservarán el texto completo, pero se dividirán según el espacio real:
- Si la acción completa cabe con los últimos problemas, se integra completa.
- Si solo cabe una parte, se medirá el mayor fragmento que cabe junto a esos problemas.
- El siguiente fragmento iniciará una página exclusiva de acciones.
- Cada fragmento conservará el orden exacto del texto original.
- Los saltos de línea se preservarán.
La división no usará caracteres máximos. Se encontrará el mayor prefijo válido mediante medición DOM, idealmente con búsqueda binaria para reducir el número de renderizados.
Criterio de aceptación: no habrá espacio vacío en la última página de problemas si cabe al menos un fragmento válido de la acción.
6. Formalizar invariantes de integridad antes de exportar
La validación final comprobará, por cada incidencia seleccionada:
- Que existe al menos una página asociada a la incidencia.
- Que el panel de problemas existe siempre.
- Que el panel de acciones existe una vez por incidencia, incluso cuando esté vacío.
- Que una acción vacía se muestre como “No hay acciones de mejora registradas.”.
- Que todas las correcciones estén presentes, una sola vez y en el orden original.
- Que todos los textos de acciones estén presentes, sin normalizar ni perder saltos de línea.
- Que las incidencias agrupadas y pendientes estén completas y ordenadas.
- Que no existan elementos con overflow, visibility, opacity o dimensiones que oculten contenido real.
Las excepciones permitidas serán únicamente los resúmenes con truncamiento explícito a dos líneas y puntos suspensivos.
Criterio de aceptación: cualquier omisión detiene la exportación con la incidencia, página, elemento y dimensión implicados.
7. Corregir la estabilización iterativa
La estabilización se convertirá en un ciclo formal:
1. Construir distribución.
2. Renderizar en renderPage.
3. Medir firma de páginas, filas, paneles y fragmentos.
4. Reconstruir si cambió una capacidad, fragmento o asignación de fila.
5. Repetir hasta obtener dos firmas consecutivas idénticas.
6. Solo entonces validar estrictamente y exportar.
Se conservará un límite técnico de seguridad para evitar ciclos infinitos. Si se alcanza, no se exportará; el error mostrará las diferencias entre las dos últimas firmas.
La firma incluirá:
- Tipo y orden de cada página.
- Incidencia asociada.
- Correcciones por página.
- Filas de tablas por página.
- Fragmentos de acciones por página.
- Alturas medidas y capacidades por panel.
Criterio de aceptación: nunca se exportará una distribución que cambió en la última medición.
8. Consolidar tablas de tiempos adicionales y tareas pendientes
Las dos tablas usarán el mismo empaquetador de filas que los problemas:
- Medición de encabezado de tabla.
- Medición de cada fila con asunto truncado a dos líneas.
- Agregado secuencial mientras la fila completa quepa.
- Nueva página cuando la siguiente fila no quepa.
- Validación de orden, presencia y altura de cada fila.
No se alterará su diseño ni encabezados actuales; solo el cálculo interno de distribución.
Criterio de aceptación: una tabla genera las páginas mínimas necesarias, sin filas ocultas ni espacio desaprovechado por límites fijos.
9. Fortalecer diagnósticos
Los errores finales incluirán:
- Página física.
- Tipo de página.
- Clave de incidencia.
- Clave de corrección o fila.
- Parte de la acción, si aplica.
- Alto disponible.
- Alto requerido.
- Límite inferior o ancho excedido.
- Diferencia entre última y penúltima firma si no converge.
Además, se agruparán errores equivalentes para evitar mensajes repetidos decenas de veces.
Criterio de aceptación: un error debe permitir localizar su causa sin inspeccionar manualmente todo el PDF.
Pruebas Requeridas
Se ampliarán las pruebas headless para cubrir, en tema claro y oscuro:
- Incidencia sin problemas ni acciones.
- Incidencia con problemas y panel vacío de acciones.
- Una corrección corta y una de dos líneas.
- Muchas correcciones con páginas de continuación.
- Acción corta junto al último bloque de problemas.
- Acción larga cuyo primer fragmento cabe con el último bloque.
- Acción larga con múltiples páginas exclusivas.
- Saltos de línea, palabras muy largas y caracteres especiales.
- Varias incidencias con encabezados de diferentes alturas.
- Tiempos adicionales en una y varias páginas.
- Tareas pendientes en una y varias páginas.
- Ejecuciones consecutivas con la misma entrada y misma firma.
- Caso imposible que debe fallar sin crear PDF.
También se agregarán pruebas unitarias para las invariantes, sin depender de Chromium.
Dependencia Externa
El único elemento fuera del código es desbloquear la ejecución headless. Actualmente Chromium falla con spawn EPERM. Para cerrar el punto 12 se necesita ejecutar:
$env:RUN_PDF_HEADLESS_TESTS='1'
npm test
en una sesión de Windows donde la política de seguridad permita iniciar Chrome, Edge o Chromium integrado.
Orden De Implementación
1. Separar measurementPage y renderPage.
2. Corregir perfiles de medición con paneles fijos reales.
3. Eliminar heurísticas y respaldos.
4. Rehacer empaquetado de problemas y acciones.
5. Implementar invariantes completas.
6. Implementar estabilización estricta.
7. Unificar tablas.
8. Agregar pruebas.
9. Ejecutar validación headless y revisar PDFs reales.
Con este orden se eliminan primero los riesgos de exportar HTML temporal o medir una estructura distinta a la final; después se mejora la ocupación de espacio sin sacrificar integridad.

Si un elemento no cabe en su página, la aplicación debe redistribuirlo automáticamente hasta que quepa completo. Solo los resúmenes pueden truncarse a dos líneas con puntos suspensivos; las acciones de mejora nunca se truncarán. El manejo técnico sería:
1. Las acciones de mejora se dividen en tantos fragmentos como sean necesarios, incluso si deben ocupar muchas páginas.
2. Si cabe una parte de la acción bajo los últimos problemas, se coloca ese fragmento allí y el resto continúa en páginas posteriores.
3. Las correcciones nunca se dividen. Si una no cabe, pasa completa a otra página.
4. Los resúmenes de incidencias, problemas, tiempos adicionales y tareas pendientes mantienen el límite visual de dos líneas con ..., que ya es una regla funcional aceptada.
5. Los textos no separables, como una palabra extremadamente larga, se parten visualmente con overflow-wrap:anywhere, sin perder caracteres.
6. Si la estructura fija de una página impidiera incluir siquiera una fila completa, se usa un perfil de continuación compacto, no se produce un error.
7. La validación final no debe detener la generación ante un desborde recuperable: debe reconstruir la distribución con el contenido movido o fragmentado. Solo se reportarán errores externos reales, como que Windows no pueda iniciar Chromium, falta de espacio en disco o ausencia de permisos para escribir el archivo.

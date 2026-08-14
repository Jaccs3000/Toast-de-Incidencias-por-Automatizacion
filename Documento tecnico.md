# Monitor de Jira Cloud

## Documento tecnico

### 1. Objetivo

Construir una aplicacion web para uso local que monitoree Jira Cloud, detecte cambios relevantes y avise al usuario cuando se cumplan reglas definidas por el usuario.

La aplicacion:

- se conecta a Jira mediante REST;
- usa una sesion propia guardada por la app en `data/session`;
- guarda solo la informacion necesaria en DuckDB;
- no guarda historico;
- funciona con sincronizaciones automaticas y manuales;
- muestra alertas dentro de la interfaz y como toast;
- se abre en una pestaña de Google Chrome;
- usa un backend local para sincronizar en segundo plano;
- el backend arranca desde el lanzador `run.vbs`, que ejecuta `run.bat` en segundo plano, y puede seguir funcionando aunque se cierre la pestaña de la interfaz.

### 2. Tecnologias

- Node.js
- React + Vite
- Playwright
- DuckDB
- Pino

El proyecto usara JavaScript. No se usara Python.

### 3. Principios

- Cada modulo tendra una sola responsabilidad.
- Los modulos se comunicaran solo por interfaces publicas.
- La interfaz no contendra logica de negocio.
- Jira y DuckDB solo se accederan desde sus modulos autorizados.
- La configuracion estara separada del codigo.
- La arquitectura debe permitir crecer sin rehacer el sistema.

### 4. Modulos

- **Configuracion**: carga y valida archivos JSON.
- **Autenticacion**: obtiene y valida la sesion de Jira con Playwright.
- **Autenticacion**: abre Jira en un navegador controlado por Playwright para iniciar sesion, valida la sesion y la conserva mientras siga siendo valida.
- **Jira Client**: hace todas las llamadas REST a Jira.
- **Sincronizacion**: coordina el flujo completo.
- **Grafo**: construye ProjectGroups siguiendo `graph.json`.
- **Persistencia**: lee y escribe en DuckDB.
- **Motor SQL**: ejecuta reglas SQL configuradas por el usuario.
- **Alertas**: crea, guarda y controla alertas y reenvios.
- **Notificaciones**: intenta mostrar notificaciones nativas de Windows mediante Web Notifications API y usa Toast interno como respaldo.
- **Interfaz**: muestra estado, configuracion y alertas.
- **Logs**: registra la actividad tecnica.

### 5. Datos de Jira

La app obtiene datos desde Jira con endpoints REST y no almacena el JSON completo. Solo persiste los campos configurados y necesarios para funcionar.

Cada sincronizacion parte de una o varias consultas JQL configuradas en `config/app.json`. La interfaz permite administrarlas por bloques, incluso si una consulta ocupa varias lineas. Se ejecutan mediante `POST /rest/api/3/search/jql` y sus resultados solo sirven como punto de entrada para construir los ProjectGroups.

Los recorridos obtenidos desde distintas incidencias se consolidan cuando comparten incidencias. Asi, varias entradas del JQL que pertenecen al mismo desarrollo producen un solo ProjectGroup, sin duplicar incidencias ni relaciones.

La JQL no define el alcance final del grupo. El recorrido del grafo debe completar cada ProjectGroup con todas las incidencias que le correspondan, aunque la incidencia de entrada sea distinta.

A partir de cualquier incidencia valida del grafo, la app debe poder recorrer el conjunto completo de relaciones permitidas para reconstruir el ProjectGroup entero.

Campos iniciales a extraer de cada incidencia:

- `id`
- `key`
- `project`
- `issuetype`
- `summary`
- `description`
- `status`
- `reporter`
- `assignee`
- `created`
- `updated`
- `parent`
- `timeestimate`
- `timespent`
- `issuelinks`

### 5.1 Autenticacion

La app valida la sesion de Jira antes de sincronizar.

Si no hay sesion valida:

- muestra una notificacion nativa de Windows con el mensaje `Se requiere inicio de sesion en Jira`;
- si el permiso esta bloqueado o denegado, muestra un Toast interno con el mismo mensaje;
- si el usuario hace clic en la notificacion, en el Toast interno o en el boton de inicio de sesion, abre Chromium administrado por Playwright con Jira Cloud;
- el usuario inicia sesion ahi;
- si el usuario cierra el navegador o usa credenciales invalidas, el navegador no se cierra automaticamente y el boton sigue visible;
- si el inicio de sesion es correcto, la app muestra una notificacion de exito durante unos segundos;
- despues cierra el navegador de Playwright;
- la sesion se guarda en un archivo local y la app continua con la sincronizacion.

La sesion queda asociada a un archivo local de `storageState` de Playwright y se reutiliza en siguientes ciclos mientras Jira la mantenga valida.
La validacion se realiza consultando `GET /rest/api/3/myself` con la sesion almacenada.

Si la sesion expira o deja de ser valida:

- la sincronizacion falla;
- la app vuelve a mostrar la notificacion de inicio de sesion requerido en cada intervalo de sincronizacion configurado mientras la sesion siga invalida;
- tambien muestra el boton de inicio de sesion en la interfaz.

La sincronizacion automatica o manual nunca abre Playwright por si sola. Chromium administrado por Playwright solo se abre cuando el usuario hace clic en la notificacion, en el Toast interno o en el boton de inicio de sesion.

### 6. ProjectGroups

Un ProjectGroup es el conjunto de incidencias que forman un mismo desarrollo.

Caracteristicas:

- tiene un `id` propio;
- no tiene nombre;
- no existe en Jira;
- se construye recorriendo relaciones definidas en `graph.json` hasta completar el grupo;
- el recorrido debe poder comenzar desde cualquier incidencia valida del grafo y aun asi llegar al ProjectGroup completo;
- puede tener varias incidencias del mismo tipo;
- una incidencia puede pertenecer a varios ProjectGroups;
- se guarda una sola copia fisica de cada incidencia;
- sus campos propios se calculan con `projectgroup_rules.json`.

### 7. Base de datos

DuckDB mantiene un espejo del estado actual de Jira obtenido en la ultima sincronizacion completa.
En cada sincronizacion exitosa se reemplazan las tablas de incidencias, ProjectGroups y relaciones por lo recibido y recorrido desde Jira. Lo que ya no venga en esa sincronizacion se elimina de esas tablas.

Tablas principales:

- `JIRA_ISSUES`
- `JIRA_PROJECT_GROUPS`
- `JIRA_PROJECT_GROUP_ISSUES`
- `JIRA_RELATIONSHIPS`
- `ALERT_RULES`
- `ALERTS`
- `SYNC_CHANGES`
- `SETTINGS`
- `SYNC_STATUS`

Propuesta minima de uso:

- `JIRA_ISSUES`: una fila por incidencia unica de Jira.
- `JIRA_PROJECT_GROUPS`: una fila por `ProjectGroup`.
- `JIRA_PROJECT_GROUP_ISSUES`: tabla puente entre grupos e incidencias.
- `JIRA_RELATIONSHIPS`: relaciones descubiertas entre incidencias.
- `ALERT_RULES`: reglas SQL del usuario.
- `ALERTS`: alertas generadas por reglas.
- `SYNC_CHANGES`: cambios detectados en la sincronizacion actual: nuevas, actualizadas y ausentes.
- `SETTINGS`: configuracion interna de la app.
- `SYNC_STATUS`: estado de la ultima sincronizacion.

Propuesta de flujo de uso:

- `JIRA_ISSUES` almacena la version actual de cada incidencia.
- `JIRA_RELATIONSHIPS` almacena las relaciones descubiertas durante la sincronizacion.
- `JIRA_PROJECT_GROUPS` almacena el grupo ya consolidado.
- `JIRA_PROJECT_GROUP_ISSUES` relaciona cada grupo con sus incidencias.
- `ALERT_RULES` se consulta para saber que reglas estan activas.
- `ALERTS` registra lo que debe mostrarse y reenviarse.
- `SYNC_STATUS` mantiene un unico registro con el estado operativo de la app.

### 8. Configuracion

Archivos JSON iniciales:

- `app.json`: parametros generales.
- `graph.json`: define que tipos de incidencias entran al ProjectGroup, que relaciones se siguen, que ramas se expanden y hasta donde se recorre.
- `projectgroup_rules.json`: reglas para calcular campos del ProjectGroup, incluido `Estado General`.

La validacion de estos archivos corresponde al modulo de Configuracion.

### 8.1 Grids configurables

Las definiciones de grids se persisten en la tabla `GRID_DEFINITIONS` de DuckDB. Cada registro guarda el nombre unico, el limite por pagina, los campos seleccionados y las condiciones visuales en JSON.

La pestaña `Configuracion` conserva toda la interfaz existente y agrega la seccion `Grids configurados`. El backend expone endpoints independientes para listar, guardar, eliminar y consultar los datos de cada grid. El usuario no escribe SQL: el backend genera la consulta de lectura a partir de la definicion validada.

Cada fila del resultado representa un ProjectGroup. Los valores de varias incidencias del mismo tipo y campo se muestran en una sola celda separados por ` | `. Si no existe la incidencia solicitada, la celda queda vacia. Las condiciones se evalúan sobre el conjunto de incidencias del ProjectGroup y admiten `AND` y `OR`.

Las pestañas de grids se muestran junto a `Configuracion`. Cada una se actualiza de forma independiente, con paginacion configurable. Un error al consultar un grid no afecta a los demas ni a las funciones existentes. Los cambios de grids se bloquean mientras hay una sincronizacion activa.

Propuesta de forma para `graph.json`:

- un nodo por tipo de incidencia;
- cada nodo define relaciones permitidas de entrada y salida;
- cada relacion indica:
  - tipo de relacion Jira;
  - tipos de destino permitidos;
  - si la incidencia encontrada se incluye en el grupo;
  - si desde esa incidencia se sigue expandiendo;
  - si aplica filtro por proyecto cuando sea necesario;
- el recorrido debe poder iniciar desde cualquier incidencia valida y expandirse hasta completar el grupo.

Propuesta de forma para `projectgroup_rules.json`:

- lista ordenada de reglas;
- cada regla tiene prioridad;
- la primera regla que cumpla define el valor calculado;
- si ninguna aplica, el valor por defecto es `No definido`;
- inicialmente se usa para `Estado General`, pero debe poder crecer para otros campos calculados.

Propuesta de uso:

- evaluar reglas sobre un `ProjectGroup` ya completo;
- permitir que una regla consulte una o varias incidencias del mismo tipo;
- permitir que una regla combine tipos de incidencias y relaciones;
- mantener el orden como prioridad real de decision.

Propuesta de `app.json`:

- `version`: version de configuracion.
- `syncIntervalSeconds`: tiempo entre sincronizaciones automaticas, en segundos.
- `queryDelaySeconds`: espera entre consultas, en segundos.
- `jqlQueries`: lista de consultas JQL, una cadena por cada consulta.
- `logRetentionDays`: retencion de logs en dias.
- `startMinimized`: si la app arranca minimizada.
- `enableToasts`: si las notificaciones Toast estan activas.
- `autoSyncEnabled`: activa o apaga la sincronizacion automatica. La sincronizacion manual sigue disponible.

La interfaz incluye un boton para detener backend y frontend. Primero se detiene el backend y luego el coordinador detiene Vite, dejando libres los puertos `3000` y `5174`. La interfaz deja de consultar el backend e intenta cerrar la pestaña; si Chrome bloquea ese cierre, muestra un mensaje para cerrarla manualmente.

Al iniciar, `scripts/dev.mjs` revisa `data/runtime-services.json`. Si encuentra un estado propio anterior y los servicios no estan completamente disponibles, valida los PID registrados como procesos `node`, detiene solo esos procesos, elimina el estado obsoleto y vuelve a iniciar backend y frontend. Si hay un servicio parcial sin registro propio, no se detiene automaticamente para evitar afectar otra aplicacion.

Las fechas de inicio y fin se muestran como `dd-mm-yyyy hh:mm:ss` usando la zona horaria `America/Bogota`. Durante la sincronizacion se registran temporalmente las etapas de validacion, ejecucion de JQL, recorrido del grafo, persistencia y errores, sin registrar cookies ni credenciales.

La interfaz incluye `Borrar BD local`. Requiere confirmacion, no puede ejecutarse durante una sincronizacion y vacia las tablas de datos dentro de una transaccion. No elimina la sesion Jira, la configuracion ni los logs.

Propuesta final de `graph.json`:

El grafo configura los 14 tipos de incidencia del desarrollo. Usa `subtasks` para las ramas marcadas como subtareas, `parent` para permitir el recorrido desde una subtarea hacia su padre e `issuelinks` para las relaciones entre tipos. Las relaciones se incluyen y expanden por defecto; solo una regla con `include: false` o `expand: false` cambia ese comportamiento. La regla de `Solicitud Paso a Produccion` limita la rama de infraestructura al proyecto `Intervencion de infraestructura (MDI)`.

El campo persistido `timeestimate` representa la estimacion original de Jira (`timeoriginalestimate`) y `timespent` representa el tiempo registrado. El exportado los muestra como horas y minutos.

- `version`: version del esquema.
- `entryTypes`: tipos de incidencia que pueden iniciar un recorrido.
- `nodes`: mapa de reglas por tipo de incidencia.

Cada nodo tiene:

- `follow`: lista de relaciones permitidas desde ese tipo.

Cada relacion tiene:

- `relation`: `subtasks`, `parent` o `issuelinks`.
- `linkTypes`: lista de tipos de enlace Jira, cuando aplique.
- `to`: tipos de destino permitidos.
- `include`: si la incidencia encontrada entra al `ProjectGroup`.
- `expand`: si desde esa incidencia se sigue recorriendo.
- `project`: filtro opcional por proyecto.

Regla del grafo:

- el recorrido puede empezar desde cualquier incidencia valida;
- el motor sigue expandiendo hasta que no haya mas relaciones permitidas;
- si una incidencia ya fue visitada, no se procesa otra vez;
- el objetivo es reconstruir el `ProjectGroup` completo.

Propuesta final de `projectgroup_rules.json`:

- `version`: version del esquema.
- `defaultValue`: valor por defecto si ninguna regla aplica.
- `rules`: lista ordenada de reglas.

Cada regla tiene:

- `priority`: prioridad de evaluacion.
- `enabled`: si la regla esta activa.
- `output`: valor que se guarda en `Estado General`.
- `when`: condiciones de evaluacion.

Condiciones posibles dentro de `when`:

- `exists`: la incidencia existe en el ProjectGroup.
- `status`: estado exacto.
- `statusNot`: estado distinto al indicado.
- `issueType`: tipo exacto.
- `all`: todas las condiciones deben cumplirse.
- `any`: al menos una condicion debe cumplirse.
- `none`: ninguna condicion debe cumplirse.
- `subtaskExists`: existe una subtarea del tipo y estado configurados bajo una incidencia padre.
- `linkedProject`: existe un enlace hacia una incidencia del proyecto indicado.
- `linkedProjectNot`: no existe un enlace hacia una incidencia del proyecto indicado.

Regla del motor:

- la primera regla que cumpla define el resultado;
- si ninguna aplica, el valor es `No definido`.

### 9. Sincronizacion

La app usa un staging temporal dentro de DuckDB. La BD real solo se modifica en una transaccion final. Si falla Jira, el recorrido, la comparacion, una regla o la persistencia, se hace `ROLLBACK` y se conserva el estado anterior.
Una incidencia se considera eliminada si existia en la BD y no aparece en el resultado completo de la nueva sincronizacion. Si la sincronizacion falla, el `ROLLBACK` conserva el espejo anterior.
Los Toast de alertas se muestran solo despues del `COMMIT`.

La sincronizacion sigue este orden:

1. Validar sesion.
2. Obtener datos desde Jira.
3. Construir ProjectGroups.
4. Calcular campos derivados.
5. Comparar con lo persistido.
6. Actualizar DuckDB dentro de una transaccion.
7. Ejecutar reglas SQL y generar alertas.

Si la sesion no es valida, el proceso termina con error controlado despues del primer paso y no abre el navegador de login.

Durante el proceso:

- no hay sincronizaciones concurrentes;
- todo se trabaja en memoria hasta el final;
- si ocurre un error o cancelacion, no se aplica ningun cambio parcial;
- el estado anterior se conserva intacto.

Regla operativa:

- la JQL solo marca el inicio;
- el grafo completa el `ProjectGroup`;
- luego se calculan campos derivados;
- despues se compara con lo guardado;
- solo al final se persiste todo dentro de una transaccion.

Propuesta de evaluacion de reglas SQL:

- primero se obtiene el nuevo estado desde Jira;
- luego se compara contra el estado guardado en DuckDB;
- esa comparacion determina que cambio;
- despues de persistir el estado consolidado, se evaluan las reglas SQL sobre el resultado final y, cuando haga falta, sobre los cambios detectados;
- si una regla devuelve filas, se generan alertas.

### 10. Alertas y notificaciones

La interfaz incluye un constructor visual de alertas. El usuario selecciona el evento (`Incidencia nueva`, `Incidencia actualizada` o `Incidencia eliminada`), el campo, el operador, el valor y el texto del Toast. La app genera el SQL internamente y no exige escribir SQL para las reglas comunes.

Cada regla SQL devuelve posibles alertas. Cada fila de resultado representa una alerta potencial para una incidencia especifica.

Antes de crear una nueva alerta, la app verifica si ya existe una alerta no leida para la misma regla e incidencia.

Si no existe:

- se guarda en DuckDB;
- se muestra un Toast;
- queda disponible en la campana de notificaciones.

Cada alerta puede reenviarse segun el numero de sincronizaciones configurado para la regla.

La misma incidencia no se notifica dos veces dentro de la misma regla. Reglas distintas pueden generar alertas distintas para la misma incidencia.

Regla operativa:

- una alerta existe por combinacion de regla e incidencia;
- si la alerta sigue no leida, puede reenviarse segun la configuracion;
- si se marca como leida, deja de reenviarse;
- la persistencia de la alerta no depende de que el Toast se haya mostrado en ese momento.

Propuesta minima de `ALERT_RULES`:

- `id`
- `name`
- `sql`
- `toast_text`
- `toast_image`
- `retry_syncs`
- `is_active`
- `created`
- `updated`

Propuesta minima de `ALERTS`:

- `id`
- `rule_id`
- `issue_id`
- `project_group_id`
- `is_read`
- `created`
- `updated`
- `last_notified_at`
- `retry_count`
- `next_retry_sync`
- `payload_json`

### 11. Interfaz

La primera version tendra una sola pantalla con:

- estado de la aplicacion;
- sincronizacion manual;
- cancelacion de sincronizacion;
- administracion de consultas JQL;
- administracion de reglas SQL;
- parametros generales;
- campana de alertas no leidas.

La interfaz no consultara Jira ni DuckDB directamente. Hablará con el backend local.

### 12. Logs

Los logs se guardaran en archivos fisicos, uno por dia. El tiempo de retencion sera configurable y los archivos vencidos se eliminaran al iniciar la app.

### 13. Ejecucion

La aplicacion se distribuira como una carpeta. La ejecucion se hara con `run.vbs`, que mostrara `CMD` y llamara a `run.bat`. Ese `.bat` validara el entorno, preparara las carpetas necesarias, verificara la base de datos e iniciara el backend y la interfaz.

Flujo de arranque:

- el usuario hace clic en `run.vbs`;
- si es la primera ejecucion, el script instala las librerias necesarias;
- el script arranca backend y frontend y mantiene `CMD` visible;
- el navegador local se abre automaticamente en `http://localhost:5174`;
- la interfaz muestra `Iniciando app...` mientras espera al backend;
- cuando backend y frontend ya estan listos, la pantalla se actualiza y carga la app normal;
- desde ahi comienza la sincronizacion automatica.

Para que eso funcione:

- el `.vbs` debe mostrar la ventana de `CMD`;
- el `.bat` sigue siendo el motor de arranque interno;
- el `.bat` debe instalar las dependencias necesarias en la primera ejecucion;
- el backend tiene que arrancar de forma silenciosa;
- el frontend debe mostrar una pantalla de espera mientras detecta que el backend ya responde.

### 14. Sesion local

La sesion de Jira se guarda en un archivo local dentro de la carpeta de datos de la app.

Ubicacion:

- `data/session/jira-storage-state.json`

Reglas:

- si el archivo existe y sigue siendo valido, la app lo reutiliza;
- si ya no es valido, la app pide iniciar sesion otra vez;
- cuando se crea una nueva sesion, se borran antes solo los archivos anteriores de esa carpeta para evitar guardar datos obsoletos;
- no se borra la carpeta contenedora.
- el archivo de sesion no debe incluirse en control de versiones ni compartirse.

### 15. Estado de la sesion de Windows

Al iniciar el backend, la app registra dos tareas programadas para el usuario actual:

- `Jira Notifications - Windows Session Lock`;
- `Jira Notifications - Windows Session Unlock`.

Las tareas ejecutan `scripts/update-windows-session-hidden.vbs`, que llama de forma oculta a `scripts/update-windows-session.ps1`, cuando Windows bloquea o desbloquea la sesion. No debe mostrarse ninguna ventana de CMD o PowerShell durante este proceso. El estado actual se guarda en:

- `data/windows-session/session-state.json`;

El historial de eventos se conserva en:

- `data/windows-session/session-state-history.jsonl`.

Cada evento registra `locked` o `unlocked`, la fecha y hora de Colombia (`UTC-05:00`) y el identificador de sesion. Al iniciar el backend por el flujo normal de la app se escribe `unlocked`, porque ese flujo requiere una sesion activa y desbloqueada. Esta marca de arranque no se agrega al historial. Esta primera prueba solo registra los cambios; todavia no bloquea sincronizaciones ni Toast.

Si Windows no permite registrar las tareas, el backend deja el estado en `unknown` y lo registra en el log. No se cambian politicas ni variables de entorno. Al detener el backend, se deshabilitan solo estas dos tareas de la aplicacion. Al iniciar nuevamente, se habilitan si existen o se crean si faltan.

Antes de cada sincronizacion automatica y de cada reenvio de Toast se lee `session-state.json`. Con estado `locked` o `unknown`, la sincronizacion automatica se omite y su proximo intervalo se reinicia. Los reenvios de alertas no se procesan. Al desbloquear, cada alerta no leida conserva el tiempo que le faltaba antes del bloqueo; no se envia Toast inmediatamente. La sincronizacion siguiente ocurre solo cuando llega su nuevo intervalo. Una sincronizacion ya iniciada no se interrumpe.

La sincronizacion manual solo puede solicitarse desde el boton de la interfaz. Antes de ejecutarla, si el estado no es `unlocked`, se actualiza a `unlocked` con origen `manual-sync`; despues se reanudan los conteos pausados y se ejecuta la sincronizacion.

### 16. Objetivo tecnico

La app debe mantenerse simple, modular y facil de extender. Los cambios futuros deben resolverse, en lo posible, con configuracion o con modulos nuevos, no tocando lo que ya este estable.

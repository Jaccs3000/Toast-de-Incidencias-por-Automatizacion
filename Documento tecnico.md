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

Cada sincronizacion parte de una o varias consultas JQL. Las incidencias devueltas por esas consultas solo sirven como punto de entrada para construir los ProjectGroups.

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
- la app vuelve a mostrar el Toast de inicio de sesion requerido en el siguiente intento;
- tambien muestra el boton de inicio de sesion en la interfaz.

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

DuckDB guarda solo el estado actual de Jira para el alcance configurado.

Tablas principales:

- `JIRA_ISSUES`
- `JIRA_PROJECT_GROUPS`
- `JIRA_PROJECT_GROUP_ISSUES`
- `JIRA_RELATIONSHIPS`
- `ALERT_RULES`
- `ALERTS`
- `SETTINGS`
- `SYNC_STATUS`

Propuesta minima de uso:

- `JIRA_ISSUES`: una fila por incidencia unica de Jira.
- `JIRA_PROJECT_GROUPS`: una fila por `ProjectGroup`.
- `JIRA_PROJECT_GROUP_ISSUES`: tabla puente entre grupos e incidencias.
- `JIRA_RELATIONSHIPS`: relaciones descubiertas entre incidencias.
- `ALERT_RULES`: reglas SQL del usuario.
- `ALERTS`: alertas generadas por reglas.
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
- si ninguna aplica, el valor por defecto es `Creado`;
- inicialmente se usa para `Estado General`, pero debe poder crecer para otros campos calculados.

Propuesta de uso:

- evaluar reglas sobre un `ProjectGroup` ya completo;
- permitir que una regla consulte una o varias incidencias del mismo tipo;
- permitir que una regla combine tipos de incidencias y relaciones;
- mantener el orden como prioridad real de decision.

Propuesta de `app.json`:

- `version`: version de configuracion.
- `syncIntervalMinutes`: tiempo entre sincronizaciones automaticas, en minutos.
- `queryDelaySeconds`: espera entre consultas, en segundos.
- `logRetentionDays`: retencion de logs en dias.
- `startMinimized`: si la app arranca minimizada.
- `enableToasts`: si las notificaciones Toast estan activas.

La interfaz se cierra al cerrar la pestaña del navegador. El backend local sigue corriendo hasta que se detiene con el lanzador `run.vbs` o se cierre el proceso por el medio definido para la app.

Propuesta final de `graph.json`:

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

Regla del motor:

- la primera regla que cumpla define el resultado;
- si ninguna aplica, el valor es `Creado`.

### 9. Sincronizacion

La sincronizacion sigue este orden:

1. Validar sesion.
2. Obtener datos desde Jira.
3. Construir ProjectGroups.
4. Calcular campos derivados.
5. Comparar con lo persistido.
6. Actualizar DuckDB dentro de una transaccion.
7. Ejecutar reglas SQL y generar alertas.

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

### 15. Objetivo tecnico

La app debe mantenerse simple, modular y facil de extender. Los cambios futuros deben resolverse, en lo posible, con configuracion o con modulos nuevos, no tocando lo que ya este estable.

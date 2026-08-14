# Monitor de Jira Cloud

## Documento funcional

### 1. Que es

Es una aplicacion web que trabaja junto con Jira Cloud.

Su tarea es revisar automaticamente las incidencias que el usuario quiere monitorear, entender como se relacionan entre si y avisar cuando ocurre algo importante.

### 2. Como arranca

La aplicacion no pide usuario ni contrasena.

La app intenta validar si ya existe una sesion de Jira valida.
Si no la hay, el usuario inicia sesion dentro de Chromium administrado por Playwright.
La sesion queda guardada en la app mientras Jira la mantenga valida.

Al iniciar:

- carga la configuracion;
- carga el grafo de relaciones;
- abre DuckDB;
- queda lista para sincronizar.

### 3. Que configuracion usa

La aplicacion lee:

- `app.json`: parametros generales;
- `graph.json`: reglas para recorrer incidencias y formar ProjectGroups;
- `projectgroup_rules.json`: reglas para calcular campos del ProjectGroup;
- reglas SQL de alertas guardadas en DuckDB;
- consultas JQL guardadas en la configuracion local de la app.

### 4. Como obtiene datos de Jira

La aplicacion consulta Jira por REST usando endpoints como `issue/{key}` y `POST /rest/api/3/search/jql`.

El usuario puede configurar uno o varios JQL desde la interfaz. Cada consulta puede ocupar varias lineas; las consultas se separan en bloques. Se guardan en `config/app.json` y se ejecutan en cada sincronizacion.
Las consultas JQL devuelven incidencias iniciales.
Cada incidencia es solo un punto de partida.

Desde ahi, la app recorre relaciones segun el grafo y arma el ProjectGroup completo.
La JQL no define el alcance final del grupo. Solo define donde empezar.
A partir de cualquier incidencia valida del grafo, la app debe recorrer todas las relaciones permitidas hasta completar el ProjectGroup entero.
Si varios recorridos comparten incidencias, se consolidan en un solo ProjectGroup para evitar duplicados.

Campos iniciales que se extraen de cada incidencia:

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

### 4.1 Inicio de sesion

Si no existe una sesion valida de Jira:

- la app muestra una notificacion nativa de Windows con el mensaje `Se requiere inicio de sesion en Jira`;
- si Windows no permite la notificacion, la app muestra un Toast interno con el mismo mensaje;
- si el usuario hace clic en esa notificacion, en el Toast interno o en el boton de inicio de sesion, se abre Chromium administrado por Playwright con Jira Cloud;
- el usuario inicia sesion con sus credenciales;
- si el usuario cierra la ventana o usa credenciales invalidas, la ventana no se cierra automaticamente;
- si el login es correcto, la app muestra una notificacion de exito por unos segundos y despues cierra ese navegador;
- la sesion se guarda en un archivo local;
- la app continua con la sincronizacion.

La sesion queda disponible para siguientes sincronizaciones mientras siga siendo valida.
Si expira, la app vuelve a mostrar la notificacion de inicio de sesion requerido en cada intervalo de sincronizacion configurado mientras la sesion siga invalida y tambien muestra el boton de inicio de sesion.
La sincronizacion automatica o manual no abre el navegador de Playwright. Este solo se abre cuando el usuario hace clic en la notificacion, en el Toast interno o en el boton de inicio de sesion.

### 5. Que es un ProjectGroup

Un ProjectGroup representa un desarrollo completo.

Tiene un `id` propio para poder mostrarse despues en una version mas avanzada de la interfaz.

El grafo completo contempla los 14 tipos de incidencia, sus subtareas, sus enlaces y la rama especial de incidencias del proyecto MDI.

Puede incluir:

- una incidencia principal;
- subtareas;
- documentos;
- pruebas;
- correcciones;
- pasos a ambientes;
- otras incidencias relacionadas.

Un ProjectGroup puede tener varias incidencias del mismo tipo.
Una misma incidencia puede pertenecer a varios ProjectGroups.
El recorrido del grafo debe completar el grupo con todas las incidencias que le correspondan, sin importar cual haya sido la incidencia raiz de la JQL.

### 6. Que guarda la base local

La base de datos mantiene un espejo de lo que existe en Jira al finalizar la ultima sincronizacion completa.

Cuando una sincronizacion termina correctamente, se reemplazan las incidencias, ProjectGroups y relaciones anteriores por el resultado recibido y recorrido desde Jira. Todo lo que no se reciba en esa sincronizacion se elimina de esas tablas.

No guarda historico.
Si una incidencia ya existia en la base y no se recibe en la nueva sincronizacion, deja de existir en la base.

### 7. Para que sirve la base local

Sirve para ejecutar consultas SQL sin volver a consultar Jira.

Esto permite crear reglas de negocio complejas sobre datos ya normalizados.

### 8. Como funcionan las alertas

El usuario puede crear una alerta desde un constructor visual seleccionando evento, campo, operador y valor. La app genera el SQL internamente para las reglas comunes.

El usuario crea reglas SQL.

Cuando una regla devuelve filas, cada fila representa una alerta posible.

Antes de crear una alerta nueva, la aplicacion verifica si ya existe una alerta no leida para la misma regla e incidencia.

Si ya existe, no la duplica.

Si no existe:

- la guarda en la base;
- muestra un Toast;
- la deja visible en la campana de notificaciones.

Una incidencia puede disparar varias reglas.
Cada regla puede mostrar su propio Toast.
La misma incidencia no se notifica dos veces dentro de la misma regla.
Reglas distintas si pueden generar alertas distintas para la misma incidencia.

### 9. Que pasa con los Toast

Cada Toast muestra:

- una imagen configurada;
- un texto configurado por el usuario;
- valores tomados del resultado SQL.

Si el usuario hace clic:

- la alerta se marca como leida;
- se abre la incidencia en Jira con el navegador predeterminado.

Si el Toast informa inicio de sesion requerido y el usuario hace clic:

- se abre el navegador de Playwright con Jira Cloud;
- el usuario inicia sesion ahi;
- si el login es correcto, se guarda la sesion y el navegador se cierra.

### 10. Sincronizacion

La app compara el resultado nuevo contra el anterior y clasifica los cambios como incidencia nueva, actualizada o eliminada. Una eliminacion solo se confirma cuando el ProjectGroup fue reconstruido completo. Las alertas se evaluan antes del `COMMIT`, pero sus Toast se muestran solo despues de confirmarlo.

La sincronizacion puede ser automatica o manual.

Cada sincronizacion:

1. valida la sesion;
2. consulta Jira;
3. construye ProjectGroups;
4. calcula campos derivados;
5. compara contra lo guardado;
6. actualiza la base local;
7. ejecuta reglas SQL;
8. genera alertas y Toasts.

Si la sesion no es valida, la sincronizacion termina despues del primer paso y no abre el navegador de login.

La base de datos solo se actualiza cuando todo termina bien.

Si ocurre un error, no se aplica ningun cambio y se deja todo como estaba.

La sincronizacion automatica se dispara cada `x` minutos segun lo configurado por el usuario.

### 11. Cancelacion

El usuario puede detener una sincronizacion en curso.

La cancelacion es ordenada:

- la app termina la operacion que ya estaba en marcha;
- luego revierte los cambios pendientes;
- al final informa que la sincronizacion fue cancelada.

### 12. Estado de la app

La interfaz siempre muestra:

- estado actual;
- fecha y hora de la ultima sincronizacion;
- resultado de la ultima sincronizacion;
- contador para la siguiente sincronizacion.

Estados principales:

- Sincronizando...
- Cancelando sincronizacion...
- Sincronizado correctamente.
- Sincronizacion cancelada por el usuario.
- Error durante la sincronizacion.

### 13. Interfaz

La primera version tendra una sola pantalla.

Desde ahi se podra:

- ver el estado de la aplicacion;
- iniciar una sincronizacion manual;
- cancelar una sincronizacion;
- administrar consultas JQL;
- administrar reglas SQL;
- configurar parametros generales;
- ver alertas pendientes.

Tambien mostrara una campana con la cantidad de alertas no leidas.

Si la pagina se refresca, la app vuelve a leer la informacion en la base local y valida con el backend si la sesion sigue vigente.

### 14. Funcionamiento local

La aplicacion se ejecuta en local y la interfaz permanece abierta en una pestaña de Google Chrome.

Si un arranque anterior dejo procesos propios registrados pero sin servicios disponibles, el siguiente arranque intenta recuperarlos automaticamente. Solo se revisan y detienen los PID guardados por la aplicacion; no se detienen procesos generales ni de otras aplicaciones.

La interfaz incluye un boton para detener backend y frontend. Primero se detiene el backend y despues el frontend, dejando libres los puertos `3000` y `5174`. La app deja de consultar los servicios e intenta cerrar la pestaña; si Chrome bloquea ese cierre, informa al usuario que puede cerrarla manualmente.

Las fechas de inicio y fin se muestran como `dd-mm-yyyy hh:mm:ss` con la hora de Bogota. Mientras se prueba la sincronizacion, el log registra sus etapas principales sin guardar cookies ni credenciales.

El boton `Borrar BD local` solicita confirmacion y vacia los datos locales sin borrar la sesion Jira, la configuracion ni los logs. Se desactiva mientras hay una sincronizacion activa.

Flujo de arranque:

- el usuario hace clic en `run.vbs`;
- si es la primera ejecucion, el script instala las librerias necesarias;
- el script arranca backend y frontend y mantiene `CMD` visible;
- el navegador se abre automaticamente en `http://localhost:5174`;
- la interfaz muestra `Iniciando app...` mientras espera al backend;
- cuando backend y frontend ya estan listos, la pantalla se actualiza y carga la app normal;
- desde ahi comienza la sincronizacion automatica.

### 15. Logs

La aplicacion guarda logs tecnicos para diagnostico.

No existe una pantalla para verlos.

### 16. Que puede configurar el usuario

El usuario puede cambiar sin tocar el codigo:

- consultas JQL;
- reglas SQL;
- tiempo entre sincronizaciones;
- activar o apagar la sincronizacion automatica;
- tiempo de espera entre consultas;
- numero de sincronizaciones para reenviar alertas no leidas;
- texto e imagen de cada alerta;
- grafo de recorrido;
- reglas para calcular el Estado General del ProjectGroup;
- retencion de logs.

La configuracion de tiempos se expresa en minutos para la sincronizacion automatica y en segundos para los tiempos internos de consulta.

### Grids

La vista actual se conserva dentro de la pestaña `Configuracion`. En ella se incluye la seccion `Grids configurados`, desde donde el usuario puede crear, editar o eliminar grids.

Cada grid:

- exige un nombre unico;
- crea una pestaña propia con ese nombre;
- muestra una fila por ProjectGroup;
- permite seleccionar, en orden, campos del ProjectGroup y atributos de tipos de incidencia definidos en `graph.json`;
- permite agregar condiciones visuales con `AND` u `OR`;
- permite configurar entre 1 y 200 registros por pagina;
- se actualiza despues de una sincronizacion exitosa o mediante el boton `Actualizar`.

Los grids se guardan en la BD local. Al eliminar uno, se elimina tambien su definicion. La configuracion de un grid no modifica alertas, JQL, sesion ni el proceso de sincronizacion. Durante una sincronizacion se pueden consultar los grids, pero no modificar su configuracion.

### 17. Estado General

El campo `Estado General` del ProjectGroup se calcula por prioridad.
La primera regla que cumpla define el valor.
Si ninguna regla aplica, el valor es `No definido`.

Reglas actuales:

- `Definiendo Criterios` si existe una incidencia de tipo `Documentar Criterios de Aceptación` distinta de `Cerrado`.
- `Espera Jira Testing` si existe una incidencia `Documentar Criterios de Aceptación` en estado `Cerrado` y no existe una incidencia tipo `Testing`.
- `Probando en TEST` si existe una incidencia de tipo `Testing` en estado `En Progreso`.
- `En Espera` si existe una incidencia `Testing` o `Testing Pre-Producción` en estado `En Espera`.
- `Pedir Montaje PRE` si una incidencia `Testing` tiene una subtarea `Test Tarea` distinta de `Cerrado`.
- `Solicitado montaje Pre-Prod` si existe una incidencia de tipo `Solicitud Paso a Pre-Producción` distinta de `Cerrado`.
- `Probando en PRE` si existe una incidencia de tipo `Testing Pre-Producción` en estado `En Progreso`.
- `Pedir Montaje PROD` si existen incidencias `Testing de Criterios` y `Testing Pre-Producción` cerradas y no existe una incidencia de tipo `Solicitud montaje a Produccion`.
- `Solicitado Montaje PROD` si existe una incidencia `Solicitud Paso a Producción` distinta de `Cerrado` sin enlace a una incidencia del proyecto `MDI`.
- `En Producción` si existe una incidencia `Solicitud Paso a Producción` con enlace a una incidencia del proyecto `MDI`, sin importar su estado.

### 18. Sesion local

La sesion de Jira se guarda en un archivo local dentro de la carpeta de datos de la app.

Ubicacion:

- `data/session/jira-storage-state.json`

Si se crea una nueva sesion, primero se borran solo los archivos anteriores de esa carpeta para evitar guardar informacion obsoleta.
No se borra la carpeta contenedora.

### 19. Registro de bloqueo de Windows

Durante la primera prueba, el backend registra automaticamente dos tareas programadas para el usuario actual. Una responde al bloqueo de la sesion y otra al desbloqueo.

El wrapper oculto `scripts/update-windows-session-hidden.vbs` ejecuta `scripts/update-windows-session.ps1` sin mostrar ventanas. El script actualiza `data/windows-session/session-state.json`. Cada cambio tambien se agrega a `data/windows-session/session-state-history.jsonl` con fecha y hora de Colombia (`UTC-05:00`) para verificar el orden y la hora de los eventos.

Los estados posibles son `locked`, `unlocked` y `unknown`. Al iniciar el backend por el flujo normal de la app, el estado actual se establece como `unlocked`; esa marca no se agrega al historial. `unknown` queda reservado para errores o estados que no puedan confirmarse. Esta funcionalidad solo registra el estado en esta fase; no modifica aun la sincronizacion ni el envio de Toast.

Si la politica del equipo impide crear o ejecutar la tarea, no se intenta saltar la restriccion. La app conserva `unknown` y deja el detalle en el log. Al detener el backend, se deshabilitan solo las dos tareas creadas por la app. Al iniciar nuevamente, se habilitan si existen o se crean si faltan.

Cuando el estado es `locked` o `unknown`, la sincronizacion automatica no se ejecuta al llegar a cero: se reinicia su conteo completo. Tambien se pausa el conteo de reenvio de todas las alertas no leidas. Al pasar a `unlocked`, cada alerta continua desde el tiempo restante que tenia; no se reenvia de inmediato. Si una sincronizacion ya habia comenzado, termina normalmente.

Si el usuario pulsa `Sincronizar ahora`, la app cambia el estado a `unlocked` cuando sea diferente y continua con la sincronizacion manual y el resto del flujo.

### 20. Objetivo final

La app debe monitorear Jira por el usuario y avisarle solo cuando una regla configurada se cumpla.

Todo lo que muestre la aplicacion debe salir de la base local, no de consultas directas a Jira desde la interfaz.

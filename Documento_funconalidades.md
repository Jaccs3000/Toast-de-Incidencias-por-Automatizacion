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
- consultas JQL guardadas en DuckDB.

### 4. Como obtiene datos de Jira

La aplicacion consulta Jira por REST usando endpoints como `issue/{key}`.

Las consultas JQL devuelven incidencias iniciales.
Cada incidencia es solo un punto de partida.

Desde ahi, la app recorre relaciones segun el grafo y arma el ProjectGroup completo.
La JQL no define el alcance final del grupo. Solo define donde empezar.
A partir de cualquier incidencia valida del grafo, la app debe recorrer todas las relaciones permitidas hasta completar el ProjectGroup entero.

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
Si expira, la app vuelve a pedir inicio de sesion con el mismo Toast y tambien muestra el boton de inicio de sesion.

### 5. Que es un ProjectGroup

Un ProjectGroup representa un desarrollo completo.

Tiene un `id` propio para poder mostrarse despues en una version mas avanzada de la interfaz.

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

La base de datos guarda solo el estado actual de Jira para el alcance configurado.

No guarda historico.
Si una incidencia deja de estar dentro del alcance, deja de existir en la base.

### 7. Para que sirve la base local

Sirve para ejecutar consultas SQL sin volver a consultar Jira.

Esto permite crear reglas de negocio complejas sobre datos ya normalizados.

### 8. Como funcionan las alertas

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

La sincronizacion automatica depende de un backend local que sigue corriendo mientras la app este en uso, aunque el usuario cierre la pestaña de la interfaz.

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
- tiempo de espera entre consultas;
- numero de sincronizaciones para reenviar alertas no leidas;
- texto e imagen de cada alerta;
- grafo de recorrido;
- reglas para calcular el Estado General del ProjectGroup;
- retencion de logs.

La configuracion de tiempos se expresa en minutos para la sincronizacion automatica y en segundos para los tiempos internos de consulta.

### 17. Estado General

El campo `Estado General` del ProjectGroup se calcula por prioridad.
La primera regla que cumpla define el valor.
Si ninguna regla aplica, el valor es `Creado`.

Reglas actuales:

- `Solicitado montaje Test` si existe una incidencia de tipo `Solicitud de Paso a TEST` y no esta en estado `Cerrado`.
- `Probando Test` si existe una incidencia de tipo `Testing de Criterios` en estado `En Progreso`.
- `Solicitado montaje Pre-Prod` si existe una incidencia de tipo `Solicitud Paso a Pre-Produccion` y no esta en estado `Cerrado`.
- `Probando Pre-Prod` si existe una incidencia de tipo `Testing de Criterios` en estado `Cerrado` y una de tipo `Testing Pre-Produccion` en estado `En Progreso`.
- `Pruebas finalizadas` si existen cerradas las incidencias de tipo `Testing de Criterios` y `Testing Pre-Produccion` y no existe una incidencia de tipo `Solicitud montaje a Produccion`.
- `Solicitado montaje Produccion` si existe una incidencia de tipo `Solicitud Paso a Produccion` no cerrada y no tiene vinculada una incidencia del proyecto `Intervencion de infraestructura (MDI)`.
- `Montado en Produccion` si existe una incidencia de tipo `Solicitud Paso a Produccion` y tiene vinculada una incidencia de cualquier tipo del proyecto `Intervencion de infraestructura (MDI)`.

### 18. Sesion local

La sesion de Jira se guarda en un archivo local dentro de la carpeta de datos de la app.

Ubicacion:

- `data/session/jira-storage-state.json`

Si se crea una nueva sesion, primero se borran solo los archivos anteriores de esa carpeta para evitar guardar informacion obsoleta.
No se borra la carpeta contenedora.

### 19. Objetivo final

La app debe monitorear Jira por el usuario y avisarle solo cuando una regla configurada se cumpla.

Todo lo que muestre la aplicacion debe salir de la base local, no de consultas directas a Jira desde la interfaz.

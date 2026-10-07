# Usar Jira Notifications como PWA administrada

El acceso directo inicia un backend local que sirve el frontend compilado y la API desde `http://localhost:3000`. Chrome abre la interfaz en una ventana independiente. Al cerrarse la ultima ventana de la app, esta deja de enviar senales de actividad y el backend se apaga automaticamente. Si hay una sincronizacion en curso, espera a que termine antes de apagarse.

## Preparacion (una vez y despues de cada actualizacion del frontend)

Desde PowerShell, en la carpeta del proyecto:

```powershell
npm ci
npm run build
```

Despues, haz doble clic en `create-pwa-shortcut.vbs`. Se creara `Jira Notifications (Iniciar servicios).lnk` en el escritorio. Ancla ese acceso a la barra de tareas. Si ya habias anclado la PWA directamente desde Chrome, desancla ese acceso anterior y ancla el nuevo acceso del escritorio: el acceso PWA directo no puede iniciar el backend.

## Uso diario

1. Haz clic en el acceso nuevo anclado.
2. El lanzador inicia el backend y abre la app en una ventana de Chrome sin la barra normal del navegador.
3. Al cerrar la ventana, la app envia una senal de cierre y el backend se detiene automaticamente en unos 15 segundos. Si esa senal no llega, usa las senales periodicas como respaldo con una tolerancia de tres minutos para permitir que Chrome reduzca temporizadores cuando la ventana esta en segundo plano.

El lanzador y el backend se ejecutan ocultos. Los errores de inicio quedan registrados en `logs/pwa-launcher.log`; la actividad y los errores del backend quedan en `logs/pwa-backend.log`. Esta configuracion requiere Node.js y Google Chrome instalados, y no inicia servicios durante el arranque de Windows.

## Inicio manual

Para iniciar el backend manualmente desde PowerShell, usa `npm run start:pwa`. En este modo, cerrar la ventana no detiene el backend; detenlo manualmente con `Ctrl+C`.

El service worker no intercepta ni guarda en cache las solicitudes `/api/`. Las funciones de la app requieren que el backend este activo.

# Usar Jira Notifications como PWA

La PWA se sirve desde el backend local para que la interfaz y la API usen el mismo origen. El frontend necesita que el backend esté activo; cerrar la ventana PWA no detiene el servidor.

## Preparar e iniciar

Desde PowerShell, en la carpeta del proyecto:

```powershell
npm ci
npm run build
npm run start:pwa
```

Mantén abierta esa terminal mientras uses la app. Abre `http://localhost:3000` en Chrome. En el menú de Chrome, selecciona **Instalar Jira Notifications** (el texto puede variar según la versión). La app se abrirá en una ventana independiente; desde Windows puedes crear un acceso directo y anclarlo a la barra de tareas.

## Uso diario

1. Inicia el backend con `npm run start:pwa` desde la carpeta del proyecto.
2. Abre Jira Notifications desde el icono instalado o anclado.
3. Al terminar, cierra la ventana de la app y detén el backend con `Ctrl+C` en la terminal.

Tras reiniciar Windows, repite el primer paso antes de abrir el icono. La app instalada no inicia el backend por sí sola.

## Actualizar la interfaz

Después de cambiar el código del frontend, vuelve a ejecutar `npm run build`. El service worker solicita la página a la red y usa la última página almacenada si el servidor no responde; no intercepta ni almacena en caché las rutas `/api/`. Las funciones que usan la API requieren que el backend esté disponible.

# Guía de Despliegue y PWA - Imalá OS

## 1. Subir a Hostinger

Para desplegar tu sistema en Hostinger, sigue estos pasos:

1.  **Conéctate a Hostinger**: Ingresa a tu panel de control y ve al **Administrador de Archivos** (File Manager) de tu dominio.
2.  **Carpeta Pública**: Navega a la carpeta `public_html`. (Asegúrate de que esté vacía o elimina el archivo `default.php` si existe).
3.  **Subir Archivos**:
    *   Sube **SOLO** el contenido de la carpeta `dist/` que está en tu proyecto local.
    *   **NO subas** la carpeta `dist` completa, sino **lo q hay adentro** (archivos `.html`, carpetas `assets`, `js`, etc).
    *   Al finalizar, deberías ver `index.html` directamente dentro de `public_html`.
4.  **Verificar**: Visita tu dominio. Deberías ver el Login o el Dashboard.

> **Importante**: Si usas Firebase, asegúrate de que tu dominio de Hostinger (ej: imalaos.com) esté autorizado en la consola de Firebase -> Authentication -> Sign-in method -> Dominios autorizados.

## 2. Configuración de Seguridad (Google/Firebase)

Hemos mejorado la seguridad para ocultar tus claves del repositorio público.

1.  En tu carpeta local `dist/assets/js/` verás un archivo `config.example.js`.
2.  También verás un archivo `config.js` (que contiene tus claves reales). **Este archivo NO se sube a GitHub** para protegerte.
3.  **Al subir a Hostinger**: Asegúrate de subir manualmente el archivo `config.js` a la carpeta `assets/js/` en tu hosting. Sin este archivo, la web no conectará.

## 3. Aplicación Móvil (PWA)

El sistema ahora está configurado como una **Progressive Web App (PWA)**. Esto permite instalarlo como una "App" nativa en celulares.

### En iPhone (Safari - iOS)
1.  Abre Safari y visita tu dominio.
2.  Toca el boton **Compartir** (cuadrado con flecha hacia arriba).
3.  Desliza hacia abajo y busca la opción **"Agregar al inicio"** (Add to Home Screen).
4.  Toca **Agregar**.
5.  Ahora tendrás el icono de Imalá OS en tu pantalla de inicio y se abrirá en pantalla completa sin barras de navegador.

### En Android (Chrome)
1.  Abre Chrome y visita tu dominio.
2.  Toca los tres puntos (menú).
3.  Selecciona **"Instalar aplicación"** o **"Agregar a pantalla principal"**.

---
**Nota**: El archivo `manifest.json` y las etiquetas meta requeridas ya han sido agregadas al código (`dist/manifest.json` y `dist/index.html`).

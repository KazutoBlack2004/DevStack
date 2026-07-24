# DevStack: Developer Resource & Docs Manager 🔗

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/chrys.devstack?style=for-the-badge&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=chrys.devstack)
[![Licencia](https://img.shields.io/github/license/Kazuto-Black/devstack-vscode-extension?style=for-the-badge)](LICENSE)

**DevStack** es una extensión nativa para Visual Studio Code diseñada para ayudar a los desarrolladores a organizar, buscar y acceder a recursos, documentación y enlaces web directamente desde el panel lateral (Activity Bar). 

Olvídate de buscar enlaces repetidamente en tu navegador o de llenar tus marcadores personales de cosas que solo usas al programar. DevStack mantiene tu caja de herramientas de desarrollo unificada y a la mano.

---

## ✨ Características Principales

*   **🗂️ Panel Lateral Jerárquico**: Organiza tus recursos en carpetas, subcarpetas y enlaces directamente en el panel lateral de VS Code.
*   **🖱️ Arrastrar y Soltar (Drag & Drop) Nativo**: Reordena tus carpetas y mueve tus enlaces de forma fluida y visual. Cuenta con validación contra bucles infinitos.
*   **🎨 Iconos Personalizados (Codicons)**: Elige entre 24 iconos temáticos especialmente seleccionados para desarrolladores (Bases de datos, terminales, seguridad, UX/UI, nubes, etc.) para que tus carpetas tengan personalidad.
*   **🌐 Favicons Dinámicos**: DevStack extrae de forma automática y transparente el logotipo oficial de cada sitio web (ej. React, Google, StackOverflow) y lo pinta en tu árbol de recursos.
*   **🔍 Búsqueda Rápida en Tiempo Real**: Ejecuta `DevStack: Buscar Recursos` (o pulsa la lupa del panel) para buscar en títulos, notas o etiquetas mediante la interfaz QuickPick de VS Code.
*   **☁️ Sincronización con GitHub (Gist Privado)**: Vincula tu cuenta de GitHub de forma nativa. Haz copias de seguridad de tus recursos en un Gist privado para restaurarlos en cualquier otra computadora si formateas o cambias de PC. ¡No volverás a perder tus enlaces!
*   **🌍 Acceso Global Independiente**: Tus enlaces se guardan globalmente. Puedes acceder a ellos sin importar qué proyecto tengas abierto o si estás en una ventana vacía de VS Code.
*   **🖥️ Navegador Integrado**: Elige si abrir los enlaces en el navegador simple integrado de VS Code (`Simple Browser`) o en el navegador predeterminado del sistema.

---

## 🛠️ Cómo Utilizar

1.  **Añadir Carpetas/Enlaces**: Haz clic en los botones del encabezado del panel (`+ Carpeta` o `+ Enlace`) o haz clic derecho sobre cualquier carpeta creada para abrir el menú interactivo.
2.  **Modificar**: Haz clic derecho sobre una carpeta o enlace para **Editar**, **Eliminar** o **Copiar la URL** al portapapeles.
3.  **Buscar**: Pulsa el icono de la lupa en el panel lateral, escribe palabras clave o etiquetas y presiona `Enter` para abrir el enlace seleccionado.
4.  **Sincronizar**: Pulsa el icono de la nube (`cloud-upload`) en la barra de herramientas del panel lateral, inicia sesión con tu cuenta de GitHub de forma segura y elige si deseas **Subir** (Respaldar) o **Descargar** (Restaurar) tus enlaces.

---

## ⚙️ Configuración Personalizada

Puedes personalizar el comportamiento en tu `settings.json` o desde las preferencias de VS Code (`Ctrl+,`):

*   `devstack.openInSimpleBrowser`: Si está en `true` (por defecto), los enlaces se abrirán en el navegador simple integrado de VS Code en una pestaña lateral. Si se desactiva, se abrirán en tu navegador externo del sistema.

---

## 📦 Publicación e Instalación Manual

### Cómo instalar localmente (.vsix)

Si deseas empaquetar la extensión para ti o tus amigos sin subirla a la tienda:
1. Instala el gestor de extensiones de VS Code:
   ```bash
   npm install -g @vscode/vsce
   ```
2. Empaqueta el proyecto en la raíz:
   ```bash
   vsce package
   ```
3. Se generará un archivo `devstack-0.1.0.vsix`. Instálalo en VS Code abriendo la pestaña de extensiones, haciendo clic en el menú `...` (arriba a la derecha) y seleccionando **Instalar desde VSIX...**

### Cómo publicar en la tienda oficial (VS Code Marketplace)

1. Crea una cuenta de desarrollador en [Azure DevOps Portal](https://aka.ms/devops) y obtén un Personal Access Token (PAT) con accesos de Marketplace.
2. Crea un publicador en [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage).
3. Inicia sesión en tu terminal:
   ```bash
   vsce login <nombre-de-tu-publicador>
   ```
4. Sube la extensión a la tienda:
   ```bash
   vsce publish
   ```

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.

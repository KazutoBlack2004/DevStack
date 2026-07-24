import * as vscode from 'vscode';
import { Resource, FolderResource, LinkResource } from './types';
import { StorageManager, generateId } from './storage';
import { DevStackTreeDataProvider, ResourceTreeItem } from './treeDataProvider';

/**
 * Registra todos los comandos de DevStack en la extensión.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  treeDataProvider: DevStackTreeDataProvider
): void {

  // 1. Abrir Enlace
  context.subscriptions.push(
    vscode.commands.registerCommand('devstack.openLink', async (url: string) => {
      if (!url) {
        return;
      }
      const openInSimpleBrowser = vscode.workspace.getConfiguration('devstack').get<boolean>('openInSimpleBrowser', true);
      
      if (openInSimpleBrowser) {
        try {
          await vscode.commands.executeCommand('simpleBrowser.show', url);
        } catch (err) {
          // Fallback al navegador externo si falla el simpleBrowser
          const uri = vscode.Uri.parse(url);
          await vscode.env.openExternal(uri);
        }
      } else {
        const uri = vscode.Uri.parse(url);
        await vscode.env.openExternal(uri);
      }
    })
  );

  // 2. Actualizar Vista
  context.subscriptions.push(
    vscode.commands.registerCommand('devstack.refresh', () => {
      treeDataProvider.refresh();
    })
  );

  // 3. Crear Carpeta
  context.subscriptions.push(
    vscode.commands.registerCommand('devstack.addFolder', async (selectedItem?: ResourceTreeItem) => {
      const resources = StorageManager.load();
      
      const folderName = await vscode.window.showInputBox({
        prompt: 'Nombre de la nueva carpeta',
        placeHolder: 'Ej. Recursos Útiles, Documentación, API',
        validateInput: (value) => value.trim() ? null : 'El nombre no puede estar vacío.'
      });

      if (!folderName) {
        return;
      }

      const icon = await promptForFolderIcon();

      const newFolder: FolderResource = {
        id: `folder_${generateId()}`,
        type: 'folder',
        name: folderName.trim(),
        children: [],
        icon: icon !== 'folder' ? icon : undefined
      };

      // Si se hizo clic derecho sobre una carpeta, la agregamos allí.
      // Si no, permitimos elegir carpeta de destino mediante un QuickPick.
      let targetFolderId: string | undefined = undefined;
      
      if (selectedItem && selectedItem instanceof ResourceTreeItem && selectedItem.resource.type === 'folder') {
        targetFolderId = selectedItem.resource.id;
      } else {
        const selected = await promptForTargetFolder(resources, 'Selecciona dónde crear la carpeta');
        if (selected === null) {
          return; // Cancelado
        }
        targetFolderId = selected;
      }

      if (!targetFolderId) {
        resources.push(newFolder);
      } else {
        const parent = findFolder(resources, targetFolderId);
        if (parent) {
          parent.children.push(newFolder);
        }
      }

      StorageManager.save(resources);
      treeDataProvider.refresh();
      vscode.window.showInformationMessage(`Carpeta "${newFolder.name}" creada con éxito.`);
    })
  );

  // 4. Agregar Enlace
  context.subscriptions.push(
    vscode.commands.registerCommand('devstack.addLink', async (selectedItem?: ResourceTreeItem) => {
      const resources = StorageManager.load();

      // Pedir Título
      const title = await vscode.window.showInputBox({
        prompt: 'Título del enlace',
        placeHolder: 'Ej. Documentación de VS Code API',
        validateInput: (value) => value.trim() ? null : 'El título no puede estar vacío.'
      });
      if (!title) {
        return;
      }

      // Pedir URL con validación y auto-corrección de prefijo https://
      const urlInput = await vscode.window.showInputBox({
        prompt: 'URL del recurso',
        placeHolder: 'Ej. https://code.visualstudio.com/api',
        validateInput: (value) => {
          const val = value.trim();
          if (!val) {
            return 'La URL es requerida.';
          }
          try {
            new URL(val.includes('://') ? val : `https://${val}`);
            return null;
          } catch (_) {
            return 'Ingresa una URL válida.';
          }
        }
      });
      if (!urlInput) {
        return;
      }
      
      // Auto-prefijo si no tiene esquema
      const formattedUrl = urlInput.trim().includes('://') 
        ? urlInput.trim() 
        : `https://${urlInput.trim()}`;

      // Pedir Descripción (Opcional)
      const description = await vscode.window.showInputBox({
        prompt: 'Descripción corta del enlace (Opcional)',
        placeHolder: 'Ej. Referencia oficial de la API de extensiones'
      });

      // Pedir Etiquetas (Opcional)
      const tagsInput = await vscode.window.showInputBox({
        prompt: 'Etiquetas separadas por comas (Opcional)',
        placeHolder: 'Ej. vscode, api, typescript'
      });

      const tags = tagsInput 
        ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
        : [];

      const newLink: LinkResource = {
        id: `link_${generateId()}`,
        type: 'link',
        name: title.trim(),
        url: formattedUrl,
        description: description?.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined
      };

      let targetFolderId: string | undefined = undefined;

      if (selectedItem && selectedItem instanceof ResourceTreeItem && selectedItem.resource.type === 'folder') {
        targetFolderId = selectedItem.resource.id;
      } else {
        const selected = await promptForTargetFolder(resources, 'Selecciona dónde guardar el enlace');
        if (selected === null) {
          return; // Cancelado
        }
        targetFolderId = selected;
      }

      if (!targetFolderId) {
        resources.push(newLink);
      } else {
        const parent = findFolder(resources, targetFolderId);
        if (parent) {
          parent.children.push(newLink);
        }
      }

      StorageManager.save(resources);
      treeDataProvider.refresh();
      vscode.window.showInformationMessage(`Enlace "${newLink.name}" guardado.`);
    })
  );

  // 5. Editar Elemento (Carpeta o Enlace)
  context.subscriptions.push(
    vscode.commands.registerCommand('devstack.editItem', async (selectedItem: ResourceTreeItem) => {
      if (!selectedItem || !selectedItem.resource) {
        vscode.window.showErrorMessage('Selecciona un elemento válido para editar.');
        return;
      }

      const resources = StorageManager.load();
      const currentItem = selectedItem.resource;

      if (currentItem.type === 'folder') {
        // Editar Carpeta (Solo nombre)
        const newName = await vscode.window.showInputBox({
          prompt: 'Editar nombre de la carpeta',
          value: currentItem.name,
          validateInput: (value) => value.trim() ? null : 'El nombre no puede estar vacío.'
        });

        if (!newName) {
          return;
        }

        const newIcon = await promptForFolderIcon(currentItem.icon);

        currentItem.name = newName.trim();
        currentItem.icon = newIcon !== 'folder' ? newIcon : undefined;
        findAndReplaceItem(resources, currentItem.id, currentItem);
      } else {
        // Editar Enlace (Todos los campos)
        const name = await vscode.window.showInputBox({
          prompt: 'Editar título',
          value: currentItem.name,
          validateInput: (value) => value.trim() ? null : 'El título no puede estar vacío.'
        });
        if (!name) {
          return;
        }

        const urlInput = await vscode.window.showInputBox({
          prompt: 'Editar URL',
          value: currentItem.url,
          validateInput: (value) => {
            const val = value.trim();
            if (!val) {
              return 'La URL es requerida.';
            }
            try {
              new URL(val.includes('://') ? val : `https://${val}`);
              return null;
            } catch (_) {
              return 'Ingresa una URL válida.';
            }
          }
        });
        if (!urlInput) {
          return;
        }

        const formattedUrl = urlInput.trim().includes('://') 
          ? urlInput.trim() 
          : `https://${urlInput.trim()}`;

        const description = await vscode.window.showInputBox({
          prompt: 'Editar descripción (Opcional)',
          value: currentItem.description || ''
        });

        const tagsInput = await vscode.window.showInputBox({
          prompt: 'Editar etiquetas (separadas por comas, Opcional)',
          value: currentItem.tags ? currentItem.tags.join(', ') : ''
        });

        const tags = tagsInput 
          ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
          : [];

        const updatedLink: LinkResource = {
          id: currentItem.id,
          type: 'link',
          name: name.trim(),
          url: formattedUrl,
          description: description?.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined
        };

        findAndReplaceItem(resources, currentItem.id, updatedLink);
      }

      StorageManager.save(resources);
      treeDataProvider.refresh();
      vscode.window.showInformationMessage('Elemento actualizado.');
    })
  );

  // 6. Eliminar Elemento
  context.subscriptions.push(
    vscode.commands.registerCommand('devstack.deleteItem', async (selectedItem: ResourceTreeItem) => {
      if (!selectedItem || !selectedItem.resource) {
        vscode.window.showErrorMessage('Selecciona un elemento válido para eliminar.');
        return;
      }

      const resources = StorageManager.load();
      const currentItem = selectedItem.resource;

      const typeLabel = currentItem.type === 'folder' ? 'la carpeta y su contenido' : 'el enlace';
      const confirm = await vscode.window.showWarningMessage(
        `¿Estás seguro de que deseas eliminar ${typeLabel} "${currentItem.name}"?`,
        { modal: true },
        'Eliminar'
      );

      if (confirm !== 'Eliminar') {
        return;
      }

      const removed = removeItem(resources, currentItem.id);
      if (removed) {
        StorageManager.save(resources);
        treeDataProvider.refresh();
        vscode.window.showInformationMessage(`"${currentItem.name}" eliminado.`);
      } else {
        vscode.window.showErrorMessage('No se pudo encontrar el elemento para eliminar.');
      }
    })
  );

  // 7. Copiar URL al portapapeles
  context.subscriptions.push(
    vscode.commands.registerCommand('devstack.copyUrl', async (selectedItem: ResourceTreeItem) => {
      if (!selectedItem || !selectedItem.resource || selectedItem.resource.type !== 'link') {
        vscode.window.showErrorMessage('Debes seleccionar un enlace para copiar la URL.');
        return;
      }
      const url = selectedItem.resource.url;
      await vscode.env.clipboard.writeText(url);
      vscode.window.showInformationMessage('URL copiada al portapapeles.');
    })
  );

  // 8. Búsqueda Rápida (QuickPick)
  context.subscriptions.push(
    vscode.commands.registerCommand('devstack.search', async () => {
      const resources = StorageManager.load();
      const links = flattenLinks(resources);

      if (links.length === 0) {
        vscode.window.showInformationMessage('No hay enlaces guardados para buscar.');
        return;
      }

      const quickPickItems: vscode.QuickPickItem[] = links.map(link => {
        const tagsLabel = link.tags ? link.tags.map(t => `#${t}`).join(' ') : '';
        const descriptionLabel = link.description ? ` - ${link.description}` : '';
        return {
          label: link.name,
          detail: link.url,
          description: `${tagsLabel}${descriptionLabel}`.trim(),
          // Guardamos la URL en una propiedad personalizada para recuperarla en la selección
          buttons: []
        };
      });

      const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Buscar enlaces por título, descripción o etiquetas...',
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (selected && selected.detail) {
        vscode.commands.executeCommand('devstack.openLink', selected.detail);
      }
    })
  );
}

// ==========================================
// Funciones Auxiliares de Manipulación
// ==========================================

interface FolderOption {
  id: string;
  pathName: string;
}

/**
 * Obtiene todas las carpetas del árbol de forma recursiva para presentarlas en una lista.
 */
function getAllFolders(resources: Resource[], currentPath = ''): FolderOption[] {
  let folders: FolderOption[] = [];
  for (const item of resources) {
    if (item.type === 'folder') {
      const folderPath = currentPath ? `${currentPath} / ${item.name}` : item.name;
      folders.push({ id: item.id, pathName: folderPath });
      folders = folders.concat(getAllFolders(item.children, folderPath));
    }
  }
  return folders;
}

/**
 * Muestra un QuickPick al usuario para elegir en qué carpeta colocar un recurso.
 * Retorna undefined para indicar la Raíz, string para una carpeta, o null si se canceló.
 */
async function promptForTargetFolder(resources: Resource[], title: string): Promise<string | undefined | null> {
  const folders = getAllFolders(resources);
  const options = [
    { label: '$(home) [Raíz]', description: 'Nivel principal', id: 'root' },
    ...folders.map(f => ({ label: `$(folder) ${f.pathName}`, id: f.id }))
  ];

  const selection = await vscode.window.showQuickPick(options, {
    placeHolder: title,
    ignoreFocusOut: true
  });

  if (!selection) {
    return null; // Cancelado por el usuario (ej. Escape)
  }

  return selection.id === 'root' ? undefined : selection.id;
}

/**
 * Busca recursivamente una carpeta por su ID.
 */
function findFolder(resources: Resource[], folderId: string): FolderResource | undefined {
  for (const item of resources) {
    if (item.id === folderId && item.type === 'folder') {
      return item;
    }
    if (item.type === 'folder') {
      const found = findFolder(item.children, folderId);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Elimina recursivamente un elemento (carpeta o enlace) del árbol por su ID.
 */
function removeItem(resources: Resource[], targetId: string): boolean {
  for (let i = 0; i < resources.length; i++) {
    if (resources[i].id === targetId) {
      resources.splice(i, 1);
      return true;
    }
    const item = resources[i];
    if (item.type === 'folder') {
      const removed = removeItem(item.children, targetId);
      if (removed) {
        // Actualizar el número de hijos en el descriptor si fuera necesario
        return true;
      }
    }
  }
  return false;
}

/**
 * Busca un elemento por ID y lo reemplaza por una versión actualizada.
 */
function findAndReplaceItem(resources: Resource[], targetId: string, updatedItem: Resource): boolean {
  for (let i = 0; i < resources.length; i++) {
    if (resources[i].id === targetId) {
      resources[i] = updatedItem;
      return true;
    }
    const item = resources[i];
    if (item.type === 'folder') {
      const replaced = findAndReplaceItem(item.children, targetId, updatedItem);
      if (replaced) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Aplana todos los enlaces del árbol recursivamente para indexar y buscar.
 */
function flattenLinks(resources: Resource[]): LinkResource[] {
  let links: LinkResource[] = [];
  for (const item of resources) {
    if (item.type === 'link') {
      links.push(item);
    } else if (item.type === 'folder') {
      links = links.concat(flattenLinks(item.children));
    }
  }
  return links;
}

// ==========================================
// Selector de Iconos para Carpetas
// ==========================================

const ICON_OPTIONS = [
  { label: '$(folder) Por defecto', description: 'Carpeta estándar', icon: 'folder' },
  { label: '$(book) Documentación / Libros', description: 'Referencias, guías, APIs', icon: 'book' },
  { label: '$(database) Base de Datos', description: 'Postgres, MySQL, Mongo, Redis', icon: 'database' },
  { label: '$(terminal) Terminal / Consola', description: 'Comandos CLI, scripts, Docker', icon: 'terminal' },
  { label: '$(repo) Repositorio / Código', description: 'GitHub, GitLab, código fuente', icon: 'repo' },
  { label: '$(gear) Configuración / Ajustes', description: 'Ajustes, consolas de administración', icon: 'gear' },
  { label: '$(symbol-interface) API / Enlaces Web', description: 'Endpoints, Swagger, Postman', icon: 'symbol-interface' },
  { label: '$(globe) Recursos Globales', description: 'Sitios web externos, blogs, utilidades', icon: 'globe' },
  { label: '$(bookmark) Marcadores', description: 'Enlaces favoritos o temporales', icon: 'bookmark' },
  { label: '$(circuit-board) Infraestructura / Nube', description: 'AWS, GCP, Vercel, servidores', icon: 'circuit-board' },
  { label: '$(bug) Depuración / Bugs', description: 'Registro de errores, issues, debuggers', icon: 'bug' },
  { label: '$(key) Seguridad / Llaves / Auth', description: 'Autenticación, tokens, secrets, contraseñas', icon: 'key' },
  { label: '$(paintcan) UI / UX / Frontend / Estilos', description: 'Canva, Figma, CSS, Tailwind, paletas', icon: 'paintcan' },
  { label: '$(rocket) Despliegues / Producción', description: 'Vercel, Netlify, pipelines CI/CD, deploys', icon: 'rocket' },
  { label: '$(beaker) Pruebas / Testing', description: 'Jest, Vitest, Cypress, laboratorios', icon: 'beaker' },
  { label: '$(briefcase) Proyectos / Trabajo', description: 'Jira, Trello, Notion, tableros de equipo', icon: 'briefcase' },
  { label: '$(tag) Etiquetas / Versiones', description: 'Releases, tags de Git, clasificaciones', icon: 'tag' },
  { label: '$(cloud) Almacenamiento / Cloud', description: 'S3, Google Drive, recursos en la nube', icon: 'cloud' },
  { label: '$(checklist) Tareas / Listas', description: 'Tareas pendientes, checklists, hojas de ruta', icon: 'checklist' },
  { label: '$(heart) Favoritos / Especiales', description: 'Recursos más queridos o de uso diario', icon: 'heart' },
  { label: '$(star-full) Destacados / Importantes', description: 'Sitios web de alta prioridad', icon: 'star-full' },
  { label: '$(graph) Métricas / Analítica', description: 'Google Analytics, Mixpanel, dashboards', icon: 'graph' },
  { label: '$(dashboard) Paneles / Dashboards', description: 'Paneles de administración y control', icon: 'dashboard' },
  { label: '$(code) Snippets / Lenguajes', description: 'Hojas de trucos, playgrounds, code snippets', icon: 'code' }
];

async function promptForFolderIcon(currentIcon?: string): Promise<string> {
  const options = ICON_OPTIONS.map(opt => ({
    ...opt,
    detail: opt.icon === currentIcon ? '✓ Icono actual' : undefined
  }));

  const selection = await vscode.window.showQuickPick(options, {
    placeHolder: 'Elige un icono para personalizar la carpeta',
    ignoreFocusOut: true
  });

  return selection ? selection.icon : (currentIcon || 'folder');
}

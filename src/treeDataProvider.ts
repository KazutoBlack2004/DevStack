import * as vscode from 'vscode';
import { Resource, FolderResource } from './types';
import { StorageManager } from './storage';

export class DevStackTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.TreeDragAndDropController<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = 
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  // 1. Configuración de Drag & Drop
  dragMimeTypes = ['application/vnd.code.tree.devstackView'];
  dropMimeTypes = ['application/vnd.code.tree.devstackView'];

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!element) {
      // Nivel raíz
      const rootResources = StorageManager.load();
      if (rootResources.length === 0) {
        return Promise.resolve([
          new InfoTreeItem("Crea tu primera carpeta o enlace")
        ]);
      }
      return Promise.resolve(
        rootResources.map(res => new ResourceTreeItem(res))
      );
    }

    // Hijos de una carpeta
    if (element instanceof ResourceTreeItem && element.resource.type === 'folder') {
      const folder = element.resource as FolderResource;
      const children = folder.children || [];
      if (children.length === 0) {
        return Promise.resolve([
          new InfoTreeItem("Carpeta vacía")
        ]);
      }
      return Promise.resolve(
        children.map(res => new ResourceTreeItem(res))
      );
    }

    return Promise.resolve([]);
  }

  // ==========================================
  // Implementación de Drag & Drop
  // ==========================================

  public handleDrag(
    source: vscode.TreeItem[],
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    const resources = source.filter((item): item is ResourceTreeItem => item instanceof ResourceTreeItem);
    if (resources.length === 0) {
      return;
    }
    const ids = resources.map(r => r.resource.id);
    dataTransfer.set('application/vnd.code.tree.devstackView', new vscode.DataTransferItem(JSON.stringify(ids)));
  }

  public async handleDrop(
    target: vscode.TreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    const transferItem = dataTransfer.get('application/vnd.code.tree.devstackView');
    if (!transferItem) {
      return;
    }

    let draggedIds: string[];
    try {
      draggedIds = JSON.parse(transferItem.value);
    } catch (_) {
      return;
    }

    if (!draggedIds || draggedIds.length === 0) {
      return;
    }

    const resources = StorageManager.load();

    // 1. Localizar los elementos arrastrados
    const draggedItems: Resource[] = [];
    for (const id of draggedIds) {
      const item = findItem(resources, id);
      if (item) {
        draggedItems.push(item);
      }
    }

    if (draggedItems.length === 0) {
      return;
    }

    // 2. Determinar la carpeta destino
    let targetFolderId: string | undefined = undefined;

    if (target instanceof ResourceTreeItem) {
      if (target.resource.type === 'folder') {
        targetFolderId = target.resource.id;
      } else {
        // Soltado sobre un enlace: buscamos la carpeta madre de dicho enlace
        const parent = findParentFolder(resources, target.resource.id);
        targetFolderId = parent ? parent.id : undefined;
      }
    }

    // 3. Validar ciclos (evitar arrastrar una carpeta dentro de sí misma o de un descendiente)
    for (const item of draggedItems) {
      if (item.type === 'folder') {
        if (targetFolderId === item.id || (targetFolderId && isDescendant(resources, item.id, targetFolderId))) {
          vscode.window.showErrorMessage(`No puedes mover la carpeta "${item.name}" dentro de sí misma o de sus subcarpetas.`);
          return;
        }
      }
    }

    // 4. Remover elementos de sus posiciones de origen
    for (const item of draggedItems) {
      removeItem(resources, item.id);
    }

    // 5. Insertar en la posición de destino
    if (!targetFolderId) {
      // Mover al nivel raíz
      resources.push(...draggedItems);
    } else {
      const targetFolder = findFolder(resources, targetFolderId);
      if (targetFolder) {
        targetFolder.children.push(...draggedItems);
      }
    }

    // Guardar cambios y actualizar la vista
    StorageManager.save(resources);
    this.refresh();
  }
}

export class ResourceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly resource: Resource
  ) {
    super(
      resource.name,
      resource.type === 'folder'
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.id = resource.id;
    this.contextValue = resource.type; // "folder" o "link" para menús contextuales

    if (resource.type === 'folder') {
      // Soporte para icono Codicon personalizado, o carpeta por defecto
      const iconName = resource.icon || 'folder';
      this.iconPath = new vscode.ThemeIcon(iconName);
      
      const childrenCount = resource.children ? resource.children.length : 0;
      this.description = `(${childrenCount})`;
      this.tooltip = `${resource.name} (${childrenCount} elementos)`;
    } else {
      let icon: vscode.Uri | vscode.ThemeIcon = new vscode.ThemeIcon('link');
      try {
        const urlObj = new URL(resource.url);
        if (urlObj.hostname && urlObj.hostname !== 'localhost' && !urlObj.hostname.startsWith('127.0.0.1')) {
          icon = vscode.Uri.parse(`https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`);
        }
      } catch (_) {
        // Fallback al ThemeIcon por defecto
      }
      this.iconPath = icon;
      
      // Mostrar etiquetas en la descripción secundaria del ítem
      if (resource.tags && resource.tags.length > 0) {
        this.description = resource.tags.map(t => `#${t}`).join(' ');
      }
      
      // Tooltip interactivo con formato Markdown
      const tooltipMarkdown = new vscode.MarkdownString();
      tooltipMarkdown.isTrusted = true;
      tooltipMarkdown.appendMarkdown(`### 🔗 ${resource.name}\n\n`);
      tooltipMarkdown.appendMarkdown(`**URL:** [${resource.url}](${resource.url})\n\n`);
      if (resource.description) {
        tooltipMarkdown.appendMarkdown(`**Descripción:** *${resource.description}*\n\n`);
      }
      if (resource.tags && resource.tags.length > 0) {
        tooltipMarkdown.appendMarkdown(`**Etiquetas:** ${resource.tags.map(t => `\`${t}\``).join(', ')}\n`);
      }
      this.tooltip = tooltipMarkdown;

      // Comando al hacer clic simple para abrir el enlace
      this.command = {
        command: 'devstack.openLink',
        title: 'Abrir Enlace',
        arguments: [resource.url]
      };
    }
  }
}

class InfoTreeItem extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('info');
    this.contextValue = 'info';
  }
}

// ==========================================
// Funciones de utilidad recursiva
// ==========================================

function findItem(resources: Resource[], id: string): Resource | undefined {
  for (const item of resources) {
    if (item.id === id) {
      return item;
    }
    if (item.type === 'folder') {
      const found = findItem(item.children, id);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

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

function findParentFolder(resources: Resource[], targetId: string, currentParent?: FolderResource): FolderResource | undefined {
  for (const item of resources) {
    if (item.id === targetId) {
      return currentParent;
    }
    if (item.type === 'folder') {
      const found = findParentFolder(item.children, targetId, item);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function isDescendant(resources: Resource[], parentId: string, childId: string): boolean {
  const parent = findFolder(resources, parentId);
  if (!parent) {
    return false;
  }
  const child = findItem(parent.children, childId);
  return child !== undefined;
}

function removeItem(resources: Resource[], id: string): boolean {
  for (let i = 0; i < resources.length; i++) {
    if (resources[i].id === id) {
      resources.splice(i, 1);
      return true;
    }
    const item = resources[i];
    if (item.type === 'folder') {
      const removed = removeItem(item.children, id);
      if (removed) {
        return true;
      }
    }
  }
  return false;
}

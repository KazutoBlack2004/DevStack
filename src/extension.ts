import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DevStackTreeDataProvider } from './treeDataProvider';
import { registerCommands } from './commands';
import { StorageManager } from './storage';
import { handleGitHubSync } from './sync';

export function activate(context: vscode.ExtensionContext) {
  console.log('La extensión "DevStack" está activa.');

  // 1. Inicializar el administrador de almacenamiento global
  StorageManager.initialize(context);

  // 2. Inicializar el proveedor de datos de la interfaz
  const treeDataProvider = new DevStackTreeDataProvider();

  // 3. Registrar la vista del árbol (TreeView) con soporte de Drag & Drop
  const treeView = vscode.window.createTreeView('devstackView', {
    treeDataProvider: treeDataProvider,
    showCollapseAll: true,
    dragAndDropController: treeDataProvider
  });
  context.subscriptions.push(treeView);

  // 4. Registrar los comandos
  registerCommands(context, treeDataProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand('devstack.githubSync', () => {
      handleGitHubSync(context, treeDataProvider);
    })
  );

  // 5. Configurar el observador de archivos global (File Watcher)
  // Observamos el directorio del almacenamiento global para detectar cambios en devstack.json de forma robusta.
  const filePath = StorageManager.getFilePath();
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  try {
    const watcher = fs.watch(dirPath, (eventType, filename) => {
      if (filename === 'devstack.json') {
        treeDataProvider.refresh();
      }
    });
    context.subscriptions.push({ dispose: () => watcher.close() });
  } catch (err) {
    console.error('Error al iniciar observador de archivos global:', err);
  }

  // 6. Escuchar cambios en los espacios de trabajo
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      treeDataProvider.refresh();
    })
  );
}

export function deactivate() {
  // Limpieza al desactivar la extensión (si es necesario)
}

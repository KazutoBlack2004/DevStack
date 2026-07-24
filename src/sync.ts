import * as vscode from 'vscode';
import * as https from 'https';
import { IncomingMessage } from 'http';
import { StorageManager } from './storage';
import { DevStackTreeDataProvider } from './treeDataProvider';
import { Resource } from './types';

/**
 * Envoltura para peticiones HTTPS a la API de GitHub
 */
function githubRequest(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  token: string,
  body?: any
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.github.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'User-Agent': 'DevStack-VSCode-Extension',
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res: IncomingMessage) => {
      let responseBody = '';
      res.on('data', chunk => {
        responseBody += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = responseBody ? JSON.parse(responseBody) : null;
          resolve({ status: res.statusCode || 0, data: parsed });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', err => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

interface GistFile {
  filename: string;
  raw_url: string;
  content?: string;
}

interface Gist {
  id: string;
  description: string;
  files: { [key: string]: GistFile };
}

/**
 * Busca si ya existe un Gist privado con la copia de DevStack
 */
async function findBackupGist(token: string): Promise<Gist | undefined> {
  const res = await githubRequest('GET', '/gists', token);
  if (res.status !== 200 || !Array.isArray(res.data)) {
    return undefined;
  }
  
  return res.data.find((g: Gist) => 
    g.description === 'DevStack Backup Storage' && g.files['devstack.json'] !== undefined
  );
}

/**
 * Obtiene el contenido del Gist de copia de seguridad
 */
async function getGistContent(gistId: string, token: string): Promise<string | undefined> {
  const res = await githubRequest('GET', `/gists/${gistId}`, token);
  if (res.status !== 200 || !res.data) {
    return undefined;
  }
  const file = res.data.files['devstack.json'];
  return file ? file.content : undefined;
}

/**
 * Crea un Gist privado para la copia de seguridad de DevStack
 */
async function createBackupGist(token: string, content: string): Promise<Gist | undefined> {
  const body = {
    description: 'DevStack Backup Storage',
    public: false,
    files: {
      'devstack.json': {
        content: content
      }
    }
  };
  
  const res = await githubRequest('POST', '/gists', token, body);
  if (res.status === 201 && res.data) {
    return res.data;
  }
  return undefined;
}

/**
 * Actualiza el Gist de copia de seguridad existente
 */
async function updateBackupGist(gistId: string, token: string, content: string): Promise<boolean> {
  const body = {
    files: {
      'devstack.json': {
        content: content
      }
    }
  };
  
  const res = await githubRequest('PATCH', `/gists/${gistId}`, token, body);
  return res.status === 200;
}

/**
 * Maneja la sincronización interactiva con GitHub
 */
export async function handleGitHubSync(
  context: vscode.ExtensionContext,
  treeDataProvider: DevStackTreeDataProvider
): Promise<void> {
  try {
    // 1. Obtener la sesión de autenticación de GitHub con permisos de gist
    const session = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Conectando con GitHub...',
      cancellable: false
    }, async () => {
      return await vscode.authentication.getSession('github', ['gist'], { createIfNone: true });
    });

    if (!session) {
      vscode.window.showErrorMessage('No se pudo autenticar con GitHub.');
      return;
    }

    const token = session.accessToken;
    
    // 2. Ofrecer menú de opciones de sincronización
    const options = [
      {
        label: '📤 Guardar copia en la nube (Subir a GitHub)',
        description: 'Sube tus enlaces locales actuales y reemplaza la copia de GitHub',
        action: 'upload'
      },
      {
        label: '📥 Restaurar copia desde la nube (Descargar de GitHub)',
        description: 'Descarga tus enlaces guardados en GitHub y reemplaza los locales',
        action: 'download'
      }
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: `Conectado como ${session.account.label}. Elige una acción de sincronización:`,
      ignoreFocusOut: true
    });

    if (!selected) {
      return;
    }

    if (selected.action === 'upload') {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Guardando copia de DevStack en GitHub...',
        cancellable: false
      }, async (progress) => {
        const localData = StorageManager.load();
        const contentStr = JSON.stringify({ version: "1.0", resources: localData }, null, 2);
        
        progress.report({ message: 'Buscando copia existente...' });
        const existingGist = await findBackupGist(token);
        
        if (existingGist) {
          progress.report({ message: 'Actualizando copia en GitHub...' });
          const success = await updateBackupGist(existingGist.id, token, contentStr);
          if (success) {
            vscode.window.showInformationMessage('¡Sincronización completa! Tus enlaces de DevStack se subieron a GitHub.');
          } else {
            throw new Error('Error al actualizar el Gist en GitHub.');
          }
        } else {
          progress.report({ message: 'Creando nueva copia privada...' });
          const newGist = await createBackupGist(token, contentStr);
          if (newGist) {
            vscode.window.showInformationMessage('¡Sincronización completa! Se creó una copia privada en GitHub.');
          } else {
            throw new Error('Error al crear el Gist en GitHub.');
          }
        }
      });
    } else if (selected.action === 'download') {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Restaurando copia de DevStack desde GitHub...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Buscando copia en la nube...' });
        const existingGist = await findBackupGist(token);
        
        if (!existingGist) {
          vscode.window.showWarningMessage('No se encontró ninguna copia de seguridad de DevStack en tu cuenta de GitHub.');
          return;
        }
        
        progress.report({ message: 'Descargando datos...' });
        const gistContent = await getGistContent(existingGist.id, token);
        if (!gistContent) {
          throw new Error('No se pudo leer el contenido de la copia de seguridad.');
        }

        const data = JSON.parse(gistContent);
        let resources: Resource[] = [];
        if (Array.isArray(data)) {
          resources = data;
        } else if (data && Array.isArray(data.resources)) {
          resources = data.resources;
        }
        
        // Guardar localmente y actualizar árbol
        StorageManager.save(resources);
        treeDataProvider.refresh();
        vscode.window.showInformationMessage('¡Sincronización completa! Enlaces restaurados desde GitHub.');
      });
    }

  } catch (err: any) {
    console.error('Error durante la sincronización:', err);
    vscode.window.showErrorMessage(`Error en sincronización con GitHub: ${err.message || err}`);
  }
}

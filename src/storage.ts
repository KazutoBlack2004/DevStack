import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Resource } from './types';

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class StorageManager {
  private static globalStoragePath: string;

  /**
   * Inicializa la ruta del almacenamiento global de la extensión.
   */
  public static initialize(context: vscode.ExtensionContext): void {
    this.globalStoragePath = context.globalStorageUri.fsPath;
  }

  /**
   * Obtiene la ruta del archivo devstack.json global.
   */
  public static getFilePath(): string {
    if (!this.globalStoragePath) {
      throw new Error('StorageManager no ha sido inicializado con el contexto.');
    }
    return path.join(this.globalStoragePath, 'devstack.json');
  }

  /**
   * Carga los recursos globales.
   * Si no existe el archivo, crea uno con la plantilla por defecto.
   */
  public static load(): Resource[] {
    const filePath = this.getFilePath();

    if (!fs.existsSync(filePath)) {
      const defaultData = this.getDefaultTemplate();
      this.save(defaultData);
      return defaultData;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Soporta formato directo [Resource, ...] o envuelto { resources: [Resource, ...] }
      if (Array.isArray(data)) {
        return data;
      } else if (data && Array.isArray(data.resources)) {
        return data.resources;
      }
      return [];
    } catch (err) {
      console.error('Error al leer devstack.json global:', err);
      return [];
    }
  }

  /**
   * Guarda el arreglo de recursos en el archivo devstack.json global.
   */
  public static save(resources: Resource[]): void {
    const filePath = this.getFilePath();
    const dirPath = path.dirname(filePath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    try {
      const data = {
        version: "1.0",
        resources
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error al guardar devstack.json global:', err);
      vscode.window.showErrorMessage(`No se pudo guardar DevStack: ${err}`);
    }
  }

  /**
   * Genera la plantilla predeterminada con solo carpetas, ningún link.
   */
  private static getDefaultTemplate(): Resource[] {
    return [
      {
        id: `folder_docs_${generateId()}`,
        type: 'folder',
        name: 'Documentación Oficial',
        children: []
      },
      {
        id: `folder_tools_${generateId()}`,
        type: 'folder',
        name: 'Herramientas y Frameworks',
        children: []
      },
      {
        id: `folder_team_${generateId()}`,
        type: 'folder',
        name: 'Recursos del Equipo',
        children: []
      }
    ];
  }
}

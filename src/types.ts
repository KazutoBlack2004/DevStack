export interface LinkResource {
  id: string;
  type: 'link';
  name: string;
  url: string;
  description?: string;
  tags?: string[];
}

export interface FolderResource {
  id: string;
  type: 'folder';
  name: string;
  children: Resource[];
  icon?: string; // Nombre del Codicon de VS Code (ej: 'database', 'terminal')
}

export type Resource = LinkResource | FolderResource;

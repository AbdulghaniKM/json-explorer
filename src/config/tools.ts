export interface ToolLink {
  label: string;
  path: string;
  icon: string;
  description: string;
}

export const TOOLS: ToolLink[] = [
  {
    label: 'Explore',
    path: '/explore',
    icon: 'icon-[solar--folder-with-files-linear]',
    description: 'Collapsible tree with search, filtering and path copy',
  },
  {
    label: 'Format',
    path: '/format',
    icon: 'icon-[solar--magic-stick-3-linear]',
    description: 'Beautify, minify, sort keys, repair and escape',
  },
  {
    label: 'Compare',
    path: '/compare',
    icon: 'icon-[solar--transfer-horizontal-linear]',
    description: 'Semantic diff that ignores key order',
  },
  {
    label: 'Analyze',
    path: '/analyze',
    icon: 'icon-[solar--chart-square-linear]',
    description: 'Characters, bytes, gzip, depth and key stats',
  },
  {
    label: 'Convert',
    path: '/convert',
    icon: 'icon-[solar--refresh-square-linear]',
    description: 'TypeScript, C#, .NET DTOs, Zod, YAML, CSV and query strings',
  },
  {
    label: 'API',
    path: '/api',
    icon: 'icon-[solar--routing-2-linear]',
    description: 'Read a Swagger or OpenAPI file: endpoints, parameters and responses',
  },
  {
    label: 'Graph',
    path: '/graph',
    icon: 'icon-[solar--share-linear]',
    description: 'Draw the document as a node graph you can pan, zoom and pick through',
  },
];

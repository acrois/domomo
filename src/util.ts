export enum NodeType {
  WINDOW,
  DOCUMENT,
  DOCUMENT_TYPE,
  ELEMENT,
  TEXT,
  COMMENT,
}

export type NodeTypeName = keyof typeof NodeType;

export type Node = {
  id: string | null;
  node_type: NodeTypeName;
  children: Node[];
  name: string | null;
  value: string | null;
  position: number;
  parent: string | null;
}

export const nodeToHTML = (node: Node): string => {
  const children: string = node.children ? node.children.map(nodeToHTML).join("") : "";

  switch (node.node_type) {
    case "DOCUMENT_TYPE":
      return `<${node.value}>`;
    case "ELEMENT":
      return `<${node.name} data-guid="${node.id}">${children}</${node.name}>`;
    case "TEXT":
      return node.value ?? '';
    case "COMMENT":
      return `<!--#${node.id} ${children}-->`;
    default:
    case "WINDOW":
    case "DOCUMENT":
      return children;
  }
}

export const rowsToParents = (treeRows: any[]) => {
  const parents: Node[] = [{
    id: null,
    node_type: 'WINDOW',
    children: [],
    name: null,
    value: null,
    position: 0,
    parent: null,
  }];

  for (let i = 0; i < treeRows.length; i++) {
    const p = {
      ...treeRows[i],
      children: [],
    };
    parents.push(p);
    for (const parent of parents) {
      if (parent.id === treeRows[i].parent) {
        parent.children.splice(treeRows[i].position, 0, p);
      }
    }
  }

  return parents;
}

export const rowsToTree = (treeRows: any[]) => {
  const parents = rowsToParents(treeRows);
  return parents[0];
}

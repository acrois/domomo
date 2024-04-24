import { type Node } from "unist";

export const rowsToTree = (treeRows: any[]) => {
  const parents = [
    {
      id: null,
      type_id: 0, // TODO type_id -> type
      children: [],
      name: null,
      value: null,
      position: 0,
      parent: null,
    },
  ];

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

  return parents[0]!;
}

export const treeToRows = (node: Node, documentPath?: string) => {
  // TODO resolve type -> id
  /*
  SELECT id
  FROM node_type
  WHERE tag = ${type}
  */
  const type = (
    node.type === 'root'
      ? 'document'
      : node.type === 'doctype'
        ? 'document_type'
        : node.type
  ).toUpperCase()
  const name = node.name ?? type === 'DOCUMENT_TYPE'
    ? '!doctype'
    : type === 'DOCUMENT'
      ? documentPath
      : null
  const value = node.value ?? type === 'DOCUMENT_TYPE'
    ? '!DOCTYPE html'
    : null
  const id = node?.id || crypto.randomUUID()

  const rows = [
    {
      id,
      type_id: 1, // TODO resolve type -> id
      name,
      value,
    },
  ];

  const attachments: any[] = [];

  if (node.children) {
    // rows.push(node.children.flatMap(c => treeToRows(tree, c)));
  }

  if (node.attributes) {

  }

  return {
    rows,
    attachments,
  };
}

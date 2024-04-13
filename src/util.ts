import { DomHandler, Parser } from "htmlparser2";

export enum NodeType {
  WINDOW,
  DOCUMENT,
  DOCUMENT_TYPE,
  ELEMENT,
  TEXT,
  COMMENT,
  DOMAIN,
}

export type NodeTypeName = keyof typeof NodeType;

export type BasicNode = {
  node_type: NodeTypeName;
  name: string | null;
  value: string | null;
  children: BasicNode[];
}

export type DatabaseNode = BasicNode & {
  id: string | null;
  position: number;
  parent: string | null;
  children: DatabaseNode[];
}

export const nodeToHTML = (node: DatabaseNode): string => {
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
  const parents: DatabaseNode[] = [{
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

export const rowsToTree = (treeRows: any[]): DatabaseNode => {
  const parents = rowsToParents(treeRows);
  return parents[0]!;
}

export const htmlToDocument = (path: string, html: string): BasicNode[] => {
  const handler = new DomHandler();
  const parser = new Parser(handler);
  parser.write(html);
  parser.end();

  const simplifyDom = (node: any): BasicNode => {
    const node_type = node.type
      .replace('directive', 'document_type')
      .replace('tag', 'element')
      .toUpperCase()
      ;

    const attribs = node.attribs;

    // console.log(attribs);

    return {
      node_type,
      name: node.name,
      value: node.value || node.data,
      children: node.children ? node.children.map(simplifyDom) : undefined,
    }
  };

  return {
    node_type: 'WINDOW',
    name: null,
    value: null,
    children: [
      {
        node_type: 'DOCUMENT',
        name: path,
        value: null,
        children: handler.dom.map(simplifyDom),
      },
    ],
  };
}

export const cleanTree = ({ name, node_type, value, children }: BasicNode): BasicNode => {
  return {
    node_type,
    name,
    value,
    children: children.map(cleanTree),
  };
}

export const removeKeys = (obj: object, keys: string[]) => obj !== Object(obj)
  ? obj
  : Array.isArray(obj)
    ? obj.map((item) => removeKeys(item, keys))
    : Object.keys(obj)
      .filter((k) => !keys.includes(k))
      .reduce(
        (acc, x) => Object.assign(acc, { [x]: removeKeys(obj[x], keys) }),
        {}
      )

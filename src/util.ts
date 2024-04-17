import { DomHandler, Parser } from "htmlparser2";
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';

export enum NodeType {
  WINDOW,
  DOMAIN,
  DOCUMENT,
  DOCUMENT_TYPE,
  ELEMENT,
  TEXT,
  COMMENT,
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

export const nodesToProperties = (node: any) => {
  // console.log(node);
  return {
    ...node,
    children: node?.children?.filter(v => v.type.toUpperCase() !== 'ATTRIBUTE')?.map(nodesToProperties),
    properties: Object.fromEntries(
      node?.children
        ?.filter(v => v.type.toUpperCase() === 'ATTRIBUTE')
        ?.map(v => [
          v.tagName,
          v.tagName == 'className'
            ? JSON.parse("[" + v.value.slice(1, v.value.length-1) + "]")
            : v.value,
        ])
      ?? {}
    ),
  }
}

export const propertiesToNodes = (node: any) => {
  if (node.properties) {
    for (const key in node.properties) {
      if (!node.children) { node.children = [] }
      node.children.push({
        node_type: 'ATTRIBUTE',
        name: key,
        value: node.properties[key],
      });
      delete node.properties[key];
    }
  }

  if (node.children) {
    for (const child of node.children) {
      propertiesToNodes(child);
    }
  }

  return node;
}

export const astToHTML = (ast: any) => {
  const trans = transformPropertyValue(
    renameProperty(
      renameProperty(
        removeKeys(ast, ['position']),
        'node_type', // from
        'type' // to
      ),
      'name', // from
      'tagName' // to
    ),
    'type',
    v => v == 'DOCUMENT' ? 'root' : v == 'DOCUMENT_TYPE' ? 'doctype' : v.toLowerCase()
  );
  const fin =
    // trans
    nodesToProperties(trans)
  ;
  // console.log(ast, JSON.stringify(fin));
  return unified()
    .use(rehypeStringify)
    .stringify(fin)
    ;
}

export const parseToAST = (html: string, fragment: boolean = false) => {
  const root = transformPropertyValue(
    renameProperty(
      renameProperty(
        removeKeys(
          unified()
            .use(rehypeParse, {
              fragment,
              verbose: false,
            })
            .parse(html),
          ['position'] // remove
        ),
        'type', // from
        'node_type' // to
      ),
      'tagName', // from
      'name' // to
    ),
    'node_type',
    v => v == 'doctype' ? 'DOCUMENT_TYPE' : v.toUpperCase()
  );

  if (!fragment) {
    root.node_type = 'DOCUMENT';
  }

  const fin =
    // root
    propertiesToNodes(root)
  ;
  // console.log(JSON.stringify(fin));
  return fin;
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

type AnyObject = { [key: string]: any };

export const renameProperty = (obj: AnyObject, oldProp: string, newProp: string): AnyObject => {
  if (Array.isArray(obj)) {
    // If it's an array, apply the function to each element
    return obj.map(item => renameProperty(item, oldProp, newProp));
  } else if (obj !== null && typeof obj === 'object') {
    // If it's an object, rename the property and apply the function to each property
    const newObj: AnyObject = {};
    for (const key in obj) {
      const value = obj[key];
      // CHEAP HACK to disable type/node_type confusion
      const newValue = key === 'properties' ? value : renameProperty(value, oldProp, newProp);
      // If the current key matches the old property name, rename it
      if (key === oldProp) {
        newObj[newProp] = newValue;
      } else {
        newObj[key] = newValue;
      }
    }
    return newObj;
  }
  // Return the value if it's neither an array nor an object
  return obj;
}

export const transformPropertyValue = (
  obj: AnyObject,
  propName: string,
  transformFunction: (value: any) => any
): AnyObject => {
  if (Array.isArray(obj)) {
    // If it's an array, apply the function to each element
    return obj.map(item => transformPropertyValue(item, propName, transformFunction));
  } else if (obj !== null && typeof obj === 'object') {
    // If it's an object, check each property
    const newObj: AnyObject = {};
    for (const key in obj) {
      const value = obj[key];
      // Apply the transform function to the property if it matches
      if (key === propName) {
        newObj[key] = transformFunction(value);
      } else {
        newObj[key] = transformPropertyValue(value, propName, transformFunction);
      }
    }
    return newObj;
  }
  // Return the value if it's neither an array nor an object
  return obj;
}

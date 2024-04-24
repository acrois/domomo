import { DomHandler, Parser } from "htmlparser2";
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import rehypePresetMinify from 'rehype-preset-minify';
import diff from "unist-diff";

export enum NodeType {
  ROOT,
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

export const rowsToParents = (treeRows: any[]) => {
  const parents: DatabaseNode[] = [{
    id: null,
    type_id: 0,
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
    children: node?.children?.filter(v => v.type.toUpperCase() !== 'ATTRIBUTE')?.map(nodesToProperties) ?? [],
    properties: Object.fromEntries(
      (node?.children ?? [])
        ?.filter(v => v.type.toUpperCase() === 'ATTRIBUTE')
        ?.map(v => [
          v.tagName,
          v.tagName == 'className'
            ? JSON.parse("[" + v.value.slice(1, v.value.length - 1) + "]")
            : v.value,
        ])
      ?? {}
    ),
  }
}

export const astPrepareForRehype = (ast: any) => {
  return nodesToProperties(
    transformPropertyValue(
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
    )
  );
}

const processor = (fragment?: boolean) => unified()
  .use(rehypePresetMinify)
  .use(rehypeStringify)
  .use(rehypeParse, {
    fragment,
    verbose: false,
  })
  ;

export const cleanAST = (ast: any, fragment?: boolean) => {
  return processor(fragment).run(ast);
}

export const cleanHTML = (html: string, fragment?: boolean) => {
  return processor(fragment).process(html);
}

export const htmlToAST = (html: string, fragment?: boolean) => {
  return cleanAST(processor().parse(html), fragment);
}

export const astToHTML = (ast: any, fragment?: boolean) => {
  return processor(fragment).stringify(astPrepareForRehype(ast));
}

export const diffTreeWithHTML = async (oldTree: any, newTree: string) => {
  const oldTreePrep = astPrepareForRehype(oldTree);
  const newTreePrep = htmlToAST(newTree);
  const d = diff(oldTreePrep, newTreePrep, {});
  return d;
}

export const parseToAST = async (html: string, fragment?: boolean) => {
  const ast = await htmlToAST(html, fragment);
  // console.log(ast);
  const root = transformPropertyValue(
    renameProperty(
      renameProperty(
        removeKeys(
          ast,
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

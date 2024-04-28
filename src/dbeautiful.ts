import type { Root, Doctype, Element, Literals, Text, Comment, Parent, Node, ElementContent } from 'hast'

const getNodeId = (node: Node): string | undefined => {
  return ('id' in node && node.id && typeof node.id === 'string')
    ? node.id
    : (node.data && 'id' in node.data && node.data.id && typeof node.data.id === 'string')
      ? node.data.id : undefined
}

const hasUpdate = (name: string, a: any, b: any, stringify: boolean = false) => {
  return name in a
    && name in b
    && (stringify
      ? JSON.stringify(a[name]) !== JSON.stringify(b[name])
      : a[name] !== b[name])
    ;
}

// Helper function to find a node by ID within children
const findNodeById = (children: Node[], id: string) =>
  children.find(child => getNodeId(child) === id);
const findNodeByIdRecursive = (children: Node[], id: string) =>
  findNodeById(children.flatMap(flattenTree), id)
const flattenTree = (node: any) =>
  [node, ...node?.children?.flatMap(flattenTree) ?? []]

interface Operation {
  type: 'insert' | 'delete' | 'update'
  id: string
  parentId?: string
  node?: Node
  value?: string
  properties?: Record<string, any>
  name?: string
}

// movements can be thought of as two operations: remove + insert
export const diffTrees = (oldNode: Node, newNode: Node) => {
  let operations: Operation[] = [];

  if ('children' in oldNode && 'children' in newNode) {
    const oldParent = (oldNode as Parent);
    const newParent = (newNode as Parent);

    // Check for deletions or updates
    oldParent.children.forEach(child => {
      const cId = getNodeId(child);

      if (!cId) {
        console.error(child);
        // oops?
        return;
      }

      const correspondingNode = findNodeById(newParent.children, cId);

      if (correspondingNode) {
        const hasValueUpdate = hasUpdate('value', child, correspondingNode);
        const hasPropertyUpdate = hasUpdate('properties', child, correspondingNode, true);
        const hasNameUpdate = hasUpdate('name', child, correspondingNode);
        const hasTypeUpdate = hasUpdate('type', child, correspondingNode);

        // Check for updates
        if (hasValueUpdate || hasPropertyUpdate || hasNameUpdate || hasTypeUpdate) {
          const update: Operation = {
            type: 'update',
            id: cId,
            node: {
              type: correspondingNode.type,
            }
          };

          if (hasValueUpdate) {
            update.node.value = correspondingNode.value;
          }

          if (hasPropertyUpdate) {
            // TODO attribute-level updates?
            update.node.properties = correspondingNode.properties;
          }

          if (hasNameUpdate) {
            update.node.name = correspondingNode.name;
          }

          // if (hasTypeUpdate) {
          //   update.node.type = correspondingNode.type;
          // }

          operations.push(update);
        }

        // Recurse on children
        operations = operations.concat(diffTrees(child, correspondingNode));
      }
      else {
        operations.push({
          type: 'delete',
          id: cId,
          // parentId,
          parentId: getNodeId(newParent),
        });
      }
    });

    // Check for insertions
    newParent.children.forEach(child => {
      const cId = getNodeId(child);

      if (!cId) {
        console.error(child);
        // oops?
        return;
      }

      if (!findNodeById(oldParent.children, cId)) {
        // TODO optimize node (child) remove children?
        operations.push({
          type: 'insert',
          id: cId,
          parentId: getNodeId(newParent),
          node: child,
        });
      }
    });
  }

  return operations;
}

export const applyTreeDiff = (tree: Root, operations: Operation[]) => {
  for (const op of operations) {
    console.log(op.type, op.id);
    switch (op.type) {
      case 'insert':
        let parent = undefined;

        if (op.parentId) {
          // attempt to resolve by parent ID
          parent = findNodeByIdRecursive(tree.children, op.parentId);
        }

        if (parent === undefined) {
          // if is still unresolved, choose the tree as the root.
          parent = tree;
          // return;
        }

        if (!op.node) {
          throw 'Invalid node';
        }

        if ('children' in parent) {
          const parentElement = (parent as Element);
          parentElement.children.push(op.node as ElementContent);
        }
        break;
      case 'update':
        const content = op.node;
        const existing = findNodeByIdRecursive(tree.children, op.id);

        if (!content || !existing) {
          console.error(content, existing);
          throw 'Invalid empty content.';
        }

        if ('type' in content) {
          existing.type = content.type;
        }

        if ('properties' in content) {
          existing.properties = content.properties;
        }

        if ('name' in content) {
          existing.name = content.name
        }

        if ('value' in content) {
          existing.value = content.value;
        }
        break;
      case 'delete':
        let parentD = undefined;

        if (op.parentId) {
          // attempt to resolve by parent ID
          parentD = findNodeByIdRecursive(tree.children, op.parentId);
        }

        if (parentD === undefined) {
          // if is still unresolved, choose the tree as the root.
          parentD = tree;
          // return;
        }

        if ('children' in parentD) {
          const parentElement = (parentD as Element);
          // Find the index of the child with the specified ID
          const index = parentElement.children.findIndex(child => getNodeId(child) === op.id);

          // If the child is found, remove it using splice
          if (index !== -1) {
            parentElement.children.splice(index, 1);
          }
        }
        break;
    }
  }
  // return tree;
}

export const rowsToTrees = ({
  rows,
  attachments
}) => {
  // const attrs = {};
  const nodes: Node[] = rows.map(r => {
    let type = r.type;

    const rowNode = {
      data: {
        id: r.id,
      },
    }

    // console.log(rowNode, r);
    if (type === 'DOCUMENT') {
      type = 'root';
    }
    else if (type === 'DOCUMENT_TYPE') {
      type = 'doctype';
    }
    else {
      type = type.toLowerCase();
    }

    rowNode.type = type;

    switch (rowNode.type) {
      case 'root':
        rowNode.children = [];
        break;
      case 'element':
        rowNode.tagName = r.name;
        rowNode.children = [];
        rowNode.properties = {};
        break;
      // will not actually get added as a child
      case 'attribute':
        rowNode.tagName = r.name;
        rowNode.value = r.value;
        break;
      case 'comment':
      case 'text':
        rowNode.value = r.value;
        break;
      default:
        // console.error(r);
        break;
    }

    return rowNode;
  });

  // console.log(nodes);

  attachments?.map(a => {
    nodes
      .filter(n => getNodeId(n) === a.parent_id)
      .map(n => {
        const filt = nodes.filter(n2 => getNodeId(n2) === a.child_id);
        const srcAttr = filt.at(0)!; // we expect to find 1 result

        // map attributes to properties instead of children
        if (n.type === 'element' && srcAttr.type === 'attribute') {
          let k = srcAttr.tagName;
          let v = JSON.parse(srcAttr.value);

          if (k === 'className') {
            k = 'class';
          }

          n.properties[k] = v;
        }
        else {
          n?.children?.splice(
            a.position || 0,
            0,
            srcAttr
          )
        }
      })
  })

  // console.log(JSON.stringify(nodes[0], undefined, 2));
  return nodes;
}

// export const rowsToTree = (treeRows: any[]) => {
//   const parents = [
//     {
//       id: null,
//       type_id: 0, // TODO type_id -> type
//       children: [],
//       name: null,
//       value: null,
//       position: 0,
//       parent: null,
//     },
//   ];

//   for (let i = 0; i < treeRows.length; i++) {
//     console.log(i, treeRows[i])
//     const parentNode = {
//       ...treeRows[i],
//       children: [],
//     };

//     parentNode.type = parentNode.node_type.toLowerCase();
//     parentNode.type = (
//       parentNode.type === 'document'
//         ? 'root'
//         : parentNode.type === 'document_type'
//           ? 'doctype'
//           : parentNode.type
//     )
//     parents.push(parentNode);

//     for (const parent of parents) {
//       if (parent.id === treeRows[i].parent) {
//         parent.children.push(parentNode);
//         // TODO determine attribute
//         // parent.children.splice(treeRows[i].position, 0);
//       }
//     }
//   }

//   return parents;
// }

export const treeToRows = (node: Node, documentPath?: string, idGenerator?: Function) => {
  // console.log(idGenerator);
  const idg = () => idGenerator !== undefined && idGenerator !== null
    ? idGenerator()
    : crypto.randomUUID();
  const id: string = node?.id
    || idg()
  let type: string | undefined
  let name: string | undefined
  let value: string | undefined

  switch (node.type) {
    case 'root':
      // const r = (node as Root);
      type = 'DOCUMENT';
      name = documentPath;
      break;
    case 'doctype':
      // const dt = (node as Doctype);
      type = 'DOCUMENT_TYPE';
      name = '!doctype';
      value = '!DOCTYPE html';
      break;
    case 'element':
      const e = (node as Element);
      type = 'ELEMENT';
      name = e.tagName;
      break;
    case 'comment':
    case 'text':
      const l = (node as Literals);
      type = node.type.toUpperCase();
      value = l.value;
      break;
    default:
      type = node.type.toUpperCase();
      break;
  }

  // TODO resolve type -> id
  /*
  SELECT id
  FROM node_type
  WHERE tag = ${type}
  */

  // if (type === 'ELEMENT' && name === null) {
  //   console.error(node);
  //   throw 'what';
  // }

  const rows: any[] = [
    {
      id,
      type: type, // TODO resolve type -> id
      name: name || null,
      value: value || null,
    },
  ];

  const attachments: any[] = [];

  if ('children' in node && node.children) {
    (node as Parent).children
      .flatMap(c => treeToRows(c, documentPath, idGenerator))
      .map(ttr => {
        rows.push(...ttr.rows);
        attachments.push(
          ...ttr.attachments,
        );

        attachments.push(
          {
            parent_id: id,
            child_id: ttr.rows[0].id,
            position: attachments.filter(pv => pv.parent_id == id).length,
          },
        );
      });
  }

  if (node.type === 'element') {
    const props = (node as Element).properties;

    for (const k in props) {
      const attr = {
        id: idg(),
        type: 'ATTRIBUTE',
        name: k,
        value: JSON.stringify(props[k]),
      };
      rows.push(attr);
      attachments.push({
        parent_id: id,
        child_id: attr.id,
        position: attachments.filter(pv => pv.parent_id == id).length,
      });

      // console.log(t);
    }
    // (node as Parent).properties
    //   .flatMap(c => treeToRows(c, documentPath))
    //   .map(tree => {
    //     rows.push(tree.rows);
    //     attachments.push(tree.attachments);
    //   });
  }

  return {
    rows,
    attachments,
  };
}

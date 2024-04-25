import type { Root, Doctype, Element, Literals, Text, Comment, Parent, Node } from 'hast'

export const rowsToTree = ({
  rows,
  attachments
}) => {
  const nodes: Node[] = [];

  for (const r of rows) {
    let type = r.type;

    if (type === 'DOCUMENT_TYPE') {
      type = 'doctype';
    }
    else if (type === 'DOCUMENT') {
      type = 'root';
    }
    else {
      type = type.toLowerCase();
    }

    const rowNode = {
      id: r.id,
      type: type,
      tagName: r.name ?? null,
      value: r.value ?? null,
      children: [],
      properties: {},
    }

    nodes.push(rowNode);
  }

  for (const a of attachments) {
    nodes
      .filter(n => n.id === a.parent_id)
      .map(n =>
        n?.children?.splice(
          a.position || 0,
          0,
          ...nodes.filter(n2 => n2?.id === a.child_id)
        )
      );
  }

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
  const id = node?.id
    || idGenerator !== undefined
    ? idGenerator()
    : crypto.randomUUID()
  let type: string | undefined
  let name: string | undefined
  let value: string | undefined

  switch (node.type) {
    case 'root':
      const r = (node as Root);
      type = 'DOCUMENT';
      name = documentPath;
      break;
    case 'doctype':
      const dt = (node as Doctype);
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

  const rows: any[] = [
    {
      id,
      type: type, // TODO resolve type -> id
      name,
      value,
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
            position: attachments.filter(pv => pv.parent_id == id).length
          },
        );
      });
  }

  if (node.type === 'element') {
    const props = (node as Element).properties;
    for (const k in props) {
      const t = props[k];
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

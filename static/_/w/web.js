// src/dbeautiful.ts
var getNodeId = (node) => {
  return "id" in node && node.id && typeof node.id === "string" ? node.id : node.data && ("id" in node.data) && node.data.id && typeof node.data.id === "string" ? node.data.id : undefined;
};
var hasUpdate = (name, a, b, stringify = false) => {
  return name in a && name in b && (stringify ? JSON.stringify(a[name]) !== JSON.stringify(b[name]) : a[name] !== b[name]);
};
var findNodeById = (children, id) => children.find((child) => getNodeId(child) === id);
var findNodeByIdRecursive = (children, id) => findNodeById(children.flatMap(flattenTree), id);
var flattenTree = (node) => [node, ...node?.children?.flatMap(flattenTree) ?? []];
var diffTrees = (oldNode, newNode) => {
  let operations = [];
  if ("children" in oldNode && "children" in newNode) {
    const oldParent = oldNode;
    const newParent = newNode;
    oldParent.children.forEach((child) => {
      const cId = getNodeId(child);
      if (!cId) {
        console.error(child);
        return;
      }
      const correspondingNode = findNodeById(newParent.children, cId);
      if (correspondingNode) {
        const hasValueUpdate = hasUpdate("value", child, correspondingNode);
        const hasPropertyUpdate = hasUpdate("properties", child, correspondingNode, true);
        const hasNameUpdate = hasUpdate("name", child, correspondingNode);
        const hasTypeUpdate = hasUpdate("type", child, correspondingNode);
        if (hasValueUpdate || hasPropertyUpdate || hasNameUpdate || hasTypeUpdate) {
          const update = {
            type: "update",
            id: cId,
            node: {
              type: correspondingNode.type
            }
          };
          if (hasValueUpdate) {
            update.node.value = correspondingNode.value;
          }
          if (hasPropertyUpdate) {
            update.node.properties = correspondingNode.properties;
          }
          if (hasNameUpdate) {
            update.node.name = correspondingNode.name;
          }
          operations.push(update);
        }
        operations = operations.concat(diffTrees(child, correspondingNode));
      } else {
        operations.push({
          type: "delete",
          id: cId,
          parentId: getNodeId(newParent)
        });
      }
    });
    newParent.children.forEach((child, index) => {
      const cId = getNodeId(child);
      if (!cId) {
        console.error(child);
        return;
      }
      if (!findNodeById(oldParent.children, cId)) {
        operations.push({
          type: "insert",
          id: cId,
          parentId: getNodeId(newParent),
          position: index,
          node: child
        });
      }
    });
  }
  return operations;
};
var applyTreeDiff = (tree, operations) => {
  for (const op of operations) {
    console.log(op.type, op.id);
    switch (op.type) {
      case "insert":
        let parent = undefined;
        if (op.parentId) {
          parent = findNodeByIdRecursive(tree.children, op.parentId);
        }
        if (parent === undefined) {
          parent = tree;
        }
        if (!op.node) {
          throw "Invalid node";
        }
        if ("children" in parent) {
          const parentElement = parent;
          const childElement = op.node;
          if ("index" in op) {
            parentElement.children.splice(op.index, 0, childElement);
          } else {
            parentElement.children.push(childElement);
          }
        }
        break;
      case "update":
        const content = op.node;
        const existing = findNodeByIdRecursive(tree.children, op.id);
        if (!content || !existing) {
          console.error(content, existing);
          throw "Invalid empty content.";
        }
        if ("type" in content) {
          existing.type = content.type;
        }
        if ("properties" in content) {
          existing.properties = content.properties;
        }
        if ("name" in content) {
          existing.name = content.name;
        }
        if ("value" in content) {
          existing.value = content.value;
        }
        break;
      case "delete":
        let parentD = undefined;
        if (op.parentId) {
          parentD = findNodeByIdRecursive(tree.children, op.parentId);
        }
        if (parentD === undefined) {
          parentD = tree;
        }
        if ("children" in parentD) {
          const parentElement = parentD;
          const index = parentElement.children.findIndex((child) => getNodeId(child) === op.id);
          if (index !== -1) {
            parentElement.children.splice(index, 1);
          }
        }
        break;
    }
  }
};
var rowsToTrees = ({
  rows,
  attachments
}) => {
  const nodes = rows.map((r) => {
    let type = r.type;
    const rowNode = {
      data: {
        id: r.id
      }
    };
    if (type === "DOCUMENT") {
      type = "root";
    } else if (type === "DOCUMENT_TYPE") {
      type = "doctype";
    } else {
      type = type.toLowerCase();
    }
    rowNode.type = type;
    switch (rowNode.type) {
      case "root":
        rowNode.children = [];
        break;
      case "element":
        rowNode.tagName = r.name;
        rowNode.children = [];
        rowNode.properties = {};
        break;
      case "attribute":
        rowNode.tagName = r.name;
        rowNode.value = r.value;
        break;
      case "comment":
      case "text":
        rowNode.value = r.value;
        break;
      default:
        break;
    }
    return rowNode;
  });
  attachments?.map((a) => {
    nodes.filter((n) => getNodeId(n) === a.parent_id).map((n) => {
      const filt = nodes.filter((n2) => getNodeId(n2) === a.child_id);
      const srcAttr = filt.at(0);
      if (!srcAttr) {
        console.error("not found", a, n);
        throw "Invalid.";
      }
      if (n.type === "element" && srcAttr.type === "attribute") {
        let k = srcAttr.tagName;
        let v = JSON.parse(srcAttr.value);
        if (k === "className") {
          k = "class";
        }
        n.properties[k] = v;
      } else {
        n?.children?.splice(a.position || 0, 0, srcAttr);
      }
    });
  });
  return nodes;
};
var treeToRows = (node, documentPath, idGenerator) => {
  const idg = () => idGenerator !== undefined && idGenerator !== null ? idGenerator() : crypto.randomUUID();
  const id = getNodeId(node) || idg();
  let type;
  let name;
  let value;
  switch (node.type) {
    case "root":
      type = "DOCUMENT";
      name = documentPath;
      break;
    case "doctype":
      type = "DOCUMENT_TYPE";
      name = "!doctype";
      value = "!DOCTYPE html";
      break;
    case "element":
      const e = node;
      type = "ELEMENT";
      name = e.tagName;
      break;
    case "comment":
    case "text":
      const l = node;
      type = node.type.toUpperCase();
      value = l.value;
      break;
    default:
      type = node.type.toUpperCase();
      break;
  }
  const rows = [
    {
      id,
      type,
      name: name || null,
      value: value || null
    }
  ];
  const attachments = [];
  if ("children" in node && node.children) {
    node.children.flatMap((c) => treeToRows(c, documentPath, idGenerator)).map((ttr) => {
      rows.push(...ttr.rows);
      attachments.push(...ttr.attachments);
      attachments.push({
        parent_id: id,
        child_id: ttr.rows[0].id,
        position: attachments.filter((pv) => pv.parent_id == id).length
      });
    });
  }
  if (node.type === "element") {
    const props = node.properties;
    for (const k in props) {
      const attr = {
        id: idg(),
        type: "ATTRIBUTE",
        name: k,
        value: JSON.stringify(props[k])
      };
      rows.push(attr);
      attachments.push({
        parent_id: id,
        child_id: attr.id,
        position: attachments.filter((pv) => pv.parent_id == id).length
      });
    }
  }
  return {
    rows,
    attachments
  };
};
export {
  treeToRows,
  rowsToTrees,
  hasUpdate,
  getNodeId,
  flattenTree,
  findNodeByIdRecursive,
  findNodeById,
  diffTrees,
  applyTreeDiff
};

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
    newParent.children.forEach((child) => {
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
          parentElement.children.push(op.node);
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
export {
  diffTrees,
  applyTreeDiff
};

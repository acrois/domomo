import { toDom } from 'https://esm.sh/hast-util-to-dom@4?bundle';
import { toHtml } from "https://esm.sh/hast-util-to-html@9?bundle";

// TODO build module
function patch(obj, diffs) {
  let arrayDelQueue = [];
  const removeSymbol = Symbol("micropatch-delete");
  for (const diff of diffs) {
    if (!diff.path || diff.path.length === 0) continue;
    let currObj = obj;
    let diffPathLength = diff.path.length;
    let lastPathElement = diff.path[diffPathLength - 1];
    let secondLastPathElement = diff.path[diffPathLength - 2];
    for (let i = 0; i < diffPathLength - 1; i++) {
      currObj = currObj[diff.path[i]];
    }
    switch (diff.type) {
      case "CREATE":
      case "CHANGE":
        currObj[lastPathElement] = diff.value;
        break;
      case "REMOVE":
        if (Array.isArray(currObj)) {
          currObj[lastPathElement] = removeSymbol;
          arrayDelQueue.push(() => {
            if (secondLastPathElement !== undefined) {
              currObj[secondLastPathElement] = currObj[
                secondLastPathElement
              ].filter((e) => e !== removeSymbol);
            } else {
              obj = obj.filter((e) => e !== removeSymbol);
            }
          });
        } else {
          delete currObj[lastPathElement];
        }
        break;
    }
  }
  arrayDelQueue.forEach((arrayDeletion) => arrayDeletion());
  return obj;
}

if (!window.es) {
  window.es = new EventSource(window.location.href, {
    withCredentials: true,
  });
  es.addEventListener("open", ev => {
    console.log(ev);
  });
  es.addEventListener('init', ev => {
    const decoded = JSON.parse(ev.data);
    if (decoded) {
      window.esd = decoded;
      const tree = toDom(decoded, {});
      document.body = tree.body;
    }
  });
  es.addEventListener("step", ev => {
    const decoded = JSON.parse(ev.data);
    if (decoded) {
      const attempt = patch(window.esd, decoded);
      if (attempt) {
        window.esd = attempt;
        const tree = toDom(window.esd, {});
        document.body = tree.body;
      }
    }
  });
  es.addEventListener("error", ev => {
    console.log(ev);
  });
}

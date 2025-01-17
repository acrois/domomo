import { toDom } from 'https://esm.sh/hast-util-to-dom@4?bundle';
// import { toHtml } from "https://esm.sh/hast-util-to-html@9?bundle";
import { applyTreeDiff, diffTrees } from '../w/web.js';

if (!window.es) {
  window.es = new EventSource(window.location.href, {
    withCredentials: true,
  });
  const callback = (hastNode, domNode) => {
    if (hastNode.type === 'element') {
      domNode.dataset.id = hastNode.data.id;
    }

    // console.log(hastNode, domNode);
  };
  es.addEventListener("open", ev => {
    console.log(ev);
  });
  es.addEventListener('init', ev => {
    const decoded = JSON.parse(ev.data);
    if (decoded) {
      window.esd = decoded;
      window.init = structuredClone(decoded);
      const tree = toDom(decoded, {
        afterTransform: callback,
      });
      console.log(tree);
      document.body = tree.body;
      document.designMode = 'off';
    }
  });
  es.addEventListener('diff', ev => {
    const decoded = JSON.parse(ev.data);
    if (decoded) {
      console.log(window.init, decoded);
      applyTreeDiff(window.init, decoded);
      window.esd = structuredClone(window.init);
      const tree = toDom(window.init, {
        afterTransform: callback,
      });
      // TODO target specific nodes
      console.log(tree);
      document.body = tree.body;
      document.designMode = 'off';
    }
  });
  es.addEventListener("error", ev => {
    console.log(ev);
  });
}

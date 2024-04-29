import { diffTrees } from '../w/web.js';

const goodTags = ['SPAN', 'A', 'PRE', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
const incrTags = ['P', 'H6', 'H5', 'H4', 'H3', 'H2', 'H1'];

function getCurrentEditingElement() {
  const selection = window.getSelection();
  // Check if there is a selection or if the cursor is placed within some content
  if (!selection.rangeCount) return null; // No active selection

  const range = selection.getRangeAt(0); // Get the first range of the selection
  let element = range.startContainer;

  // If the starting container of the range is a text node, get its parent element
  if (element.nodeType === Node.TEXT_NODE) {
    element = element.parentNode;
  }

  return element;
}

function selectElementContents(el) {
  var range = document.createRange();
  range.selectNodeContents(el);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

const toggleDesignMode = () => {
  document.designMode = document.designMode == 'on' ? 'off' : 'on';
  document.body.removeAttribute('data-cmd');
  document.querySelectorAll('[contenteditable]').forEach(c => c.removeAttribute('contentEditable'));

  if (document.designMode == 'off') {
    document.querySelectorAll('[class=selected]').forEach(c => c.classList.remove('selected'));
    document.body.classList.remove('design-mode');
  }
  else {
    document.body.classList.add('design-mode');
  }
};

// Rename a tag (change tag type). Ex, <div> -> <a>
const renameTag = (target, newNode) => {
  // copy attributes
  for (var i = 0; i < target.attributes.length; i++) {
    newNode.setAttribute(
      target.attributes[i].nodeName,
      target.attributes[i].nodeValue
    );
  }

  // move children. firstChild is a live API so we can 'while' on that
  while (target.firstChild) {
    newNode.appendChild(target.firstChild);
  }

  // copy in-line styles
  if (target.style.length > 0) {
    newNode.style.cssText = target.style.cssText;
  }

  if (target.contentEditable !== undefined) {
    newNode.contentEditable = target.contentEditable;
  }

  return target.parentNode.replaceChild(newNode, target);
}

// generic event listener
const target = document;

for (const key in target) {
  if (/^on/.test(key)) {
    const eventType = key.substr(2);

    if (eventType == 'pointermove' || eventType == 'pointerrawupdate' || eventType == 'mousemove') {
      continue;
    }

    console.log('bind', eventType);
    target.addEventListener(eventType, (e) => {
      // console.log(e.type, e.type, e);
    });
  }
}

// editor event listeners
document.addEventListener('pointerover', e => {
  // console.log(e.type, e.target);
  if (!['HTML', 'BODY'].includes(e.target.tagName) && (
    document.designMode == 'on'
    || e.shiftKey
  )) {
    e.target.classList.add('selected');
    e.target.draggable = true;
  }
}, true);

document.addEventListener('keydown', e => {
  // console.log(e);
  if (!['HTML', 'BODY'].includes(e.target.tagName) && e.shiftKey) {
    e.target.classList.add('selected');
    e.target.draggable = true;
  }

  const tgt = e.target.tagName == 'BODY' ? getCurrentEditingElement() : e.target;

  if (e.ctrlKey && e.shiftKey && e.key != 'V') {
    // Disallow CTRL+SHIFT browser default shortcut
    // Explicit allow CTRL+SHIFT+V (paste without formatting)
    e.preventDefault();
  }

  // allow CTRL+SHIFT+ENTER on acceptable tags
  if (e.key === 'Enter'
    && !e.ctrlKey
    && !e.shiftKey
    && goodTags.includes(tgt.tagName)
  ) {
    // console.log('good tags');
    if (tgt.hasAttribute('contentEditable')) {
      e.preventDefault();
      if (tgt.tagName == 'PRE') {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        console.log(selection, range);
        // range.insertNode(br);
        // range.setStartAfter(br);
        // selection.removeAllRanges();
        // selection.addRange(range);
      }
      else {
        tgt.removeAttribute('contentEditable');
      }
    }
    // different behavior for designMode than with contentEditable
    else if (document.designMode == 'on') {
      // if (tgt.tagName != 'P') {
      e.preventDefault();
      // }

      let t = null;

      const newParagraph = document.createElement('p');
      newParagraph.innerHTML = '<br/>';

      if (tgt.parentNode.tagName == 'P') {
        t = tgt.parentNode.insertAdjacentElement('afterend', newParagraph);
      }
      else {
        t = tgt.insertAdjacentElement('afterend', newParagraph);
      }
      // console.log(t, newParagraph);
      selectElementContents(newParagraph);

      // TODO find selection area and insert paragraph cleanly
      console.log('designer', tgt);

      if (tgt.tagName == 'PRE') {
        e.stopImmediatePropagation();
      }
    }
  }
}, true);

document.addEventListener('keyup', e => {
  if (!['HTML', 'BODY'].includes(e.target.tagName) && e.shiftKey) {
    e.target.classList.remove('selected');
    e.target.removeAttribute('draggable');
  }

  const tgt = e.target.tagName == 'BODY' ? getCurrentEditingElement() : e.target;

  if (e.ctrlKey && e.shiftKey) {
    // console.log(tgt);
    if (incrTags.includes(tgt.tagName)) {
      e.preventDefault();
      // console.log(tgt.tagName, e.keyCode, e.code, e.key);
      const curIdx = incrTags.indexOf(tgt.tagName);
      const upOrDown = e.code == 'Equal'
        ? 1
        : e.code == 'Minus'
          ? -1 : 0
        ;
      const fixedKey = (55 - e.keyCode);
      const newIdx = (upOrDown === 0 ? fixedKey : curIdx + upOrDown);
      const nextIdx = Math.max(
        Math.min(
          newIdx,
          incrTags.length - 1
        ),
        0
      );
      const nextTag = incrTags[nextIdx];
      // console.log(upOrDown, fixedKey, newIdx, curIdx, nextTag, nextIdx)

      if (nextTag != tgt.tagName) {
        const newElement = document.createElement(nextTag);
        renameTag(tgt, newElement);

        if (document.designMode == 'on') {
          // use selection API
          selectElementContents(newElement);
        }
        else if (newElement.isContentEditable) {
          newElement.focus();
        }
      }
    }
  }
}, true);

document.addEventListener('keyup', e => {
  const when = new Date().getTime();
  // console.log(e);
  if (e.keyCode == 17) {
    if (document.body.hasAttribute('data-cmd')) {
      const lastTimeRaw = +document.body.getAttribute('data-cmd');
      const lastTime = new Date(lastTimeRaw).getTime();
      const delta = when - lastTime;
      // console.log(when, lastTimeRaw, lastTime, delta);
      if (delta > 250) {
        document.body.removeAttribute('data-cmd');
      }
    }

    if (!document.body.hasAttribute('data-cmd')) {
      document.body.setAttribute('data-cmd', when + '')
    }
    else {
      toggleDesignMode();
    }
  }
}, true);

document.addEventListener('click', e => {
  if (document.designMode == 'off') {
    document.querySelectorAll('[contenteditable]').forEach(c => {
      if (e.target !== c) {
        c.removeAttribute('contentEditable');
      }
    })
    console.log(e);
  }
  // if (e.ctrlKey) {
  //   // e.target.parent.contentEditable = true;
  //   e.target.contentEditable = true;
  //   e.target.focus();
  // }
});

document.addEventListener('click', e => {
  if (document.designMode == 'on') {
    console.log(e);
  }
}, true);

document.addEventListener('dblclick', e => {
  if (document.designMode == 'off' && e.target.tagName !== 'HTML') {

    if (goodTags.includes(e.target.tagName)) {
      e.target.contentEditable = true;
      e.target.focus();
    }
  }
});

document.addEventListener('pointerout', e => {
  // console.log(e.type, e.target);
  e.target.classList.remove('selected');
  e.target.removeAttribute('draggable');
}, true);

const dragDropTarget = (e) => {
  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const horizontalThreshold = rect.width / 2;
  const verticalThreshold = rect.height / 2;

  if (x < horizontalThreshold && x < y && x < (rect.height - y)) {
    return 'left';
  } else if (x >= horizontalThreshold && (rect.width - x) < y && (rect.width - x) < (rect.height - y)) {
    return 'right';
  } else if (y < verticalThreshold && y < x && y < (rect.width - x)) {
    return 'above';
  } else if (y >= verticalThreshold && (rect.height - y) < x && (rect.height - y) < (rect.width - x)) {
    return 'below';
  }

  return 'inside';
}

document.addEventListener('dragenter', e => {
  event.dataTransfer.dropEffect = "move";
}, true);

document.addEventListener('dragstart', e => {
  if (!['HTML', 'BODY'].includes(e.target.tagName) && (
    document.designMode == 'on'
    || e.shiftKey
  )) {
    event.dataTransfer.effectAllowed = "copyMove";

    if (!e.target.dataset.id) {
      e.target.dataset.id = crypto.randomUUID();
    }

    e.dataTransfer.setData('text/plain', e.target.dataset.id);
    e.dataTransfer.setDragImage(e.target, 10, 10);
  }
}, true);

document.addEventListener('dragover', e => {
  e.preventDefault();
  const targetDirection = dragDropTarget(e);
  const canMoveTo = !['BODY', 'HTML'].includes(e.target.tagName);
  const directions = ['left', 'right', 'above', 'below'];
  let removeDirections = directions;
  e.dataTransfer.dropEffect = canMoveTo ? 'move' : 'none';

  if (canMoveTo) {
    e.target.classList.add('dropper', targetDirection);
    removeDirections = directions.filter(v => v !== targetDirection ? v : undefined)
    // console.log(targetDirection);
  }

  document.querySelectorAll('.dropper').forEach(c => {
    if (e.target !== c) {
      c.classList.remove('dropper', ...directions);
    }
    else {
      c.classList.remove(...removeDirections);
    }
  })
}, true);

document.addEventListener('drop', e => {
  e.preventDefault();
  const d = e.dataTransfer.getData('text/plain');

  if (e.target
    && !['BODY', 'HTML'].includes(e.target.tagName)
  ) {
    const dragElement = document.querySelector(`[data-id="${d}"]`);

    if (dragElement != e.target) {
      const targetDirection = dragDropTarget(e);
      let position = 'afterend';

      switch (targetDirection) {
        case 'above':
          position = 'beforebegin';
          break;
        case 'below':
          position = 'afterend';
          break;
        case 'left':
          position = 'afterbegin';
          break;
        case 'right':
          position = 'beforeend';
          // e.target.appendChild(dragElement);
          break;
      }

      if (dragElement) {
        dragElement.removeAttribute('draggable');
        e.target.insertAdjacentElement(position, dragElement)
      }
      else {
        // if empty, replace?
        // e.target.append(d);
        e.target.insertAdjacentHTML(position, d)
      }
    }
  }

  document.querySelectorAll('.dropper').forEach(c => c.classList.remove('dropper'))
}, true);

const editableClassNames = ['design-mode', 'selected', 'above', 'dropper', 'right', 'left', 'below'];

const mutation = (mutationList, observer) => {
  const changeset = crypto.randomUUID();

  for (const mutation of mutationList) {
    if (mutation.type === 'attributes') {
      if (mutation.attributeName === 'data-cmd' || mutation.attributeName === 'data-id') {
        // ignore body super design trigger and guid encoding
        continue;
      }

      if (mutation.attributeName === 'class') {
        if (
          editableClassNames.includes(mutation.oldValue)
        ) {
          // ignore JS-styling / editing
          continue;
        }

        const classListWithoutEditables = mutation.target.classList.values().filter(v => !editableClassNames.includes(v)).toArray();

        if (
          // (mutation.oldValue === null || mutation.oldValue === undefined || mutation.oldValue === '') &&
          classListWithoutEditables.length == 0
        ) {
          // console.log(mutation.target.classList);
          // ignore selected class style
          continue;
        }

        console.log(classListWithoutEditables);
      }

      if (mutation.attributeName === 'draggable' || mutation.attributeName === 'contenteditable') {
        // ignore editing attributes
        continue;
      }
    }
    else if (mutation.type === 'childList') {
      // console.log(mutation?.target?.tagName, mutation.addedNodes.length, mutation.removedNodes.length);

      if (
        mutation?.target?.tagName === 'HTML'
        && mutation.addedNodes.length === 1
        && mutation.removedNodes.length === 1
      ) {
        // ignore complete replacements of the document
        continue;
      }
    }
    else if (mutation.type === 'characterData') {

    }

    console.log(changeset, mutation);

    // TODO resolve node -> GUID?
    // const mutty = {
    //   attributeName: mutation.attributeName,
    //   type: mutation.type,
    //   oldValue: mutation.oldValue,
    //   // target:
    // }
    // console.log(JSON.stringify(mutty));
  }
};

const observer = new MutationObserver(mutation);
observer.observe(document, {
  attributes: true,
  childList: true,
  subtree: true,
  characterData: true,
  attributeOldValue: true,
  characterDataOldValue: true,
});
//observer.disconnect();

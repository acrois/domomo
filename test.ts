const htmlparser2 = require("htmlparser2");
const domSerializer = require("dom-serializer").default;

// Parse HTML to DOM (AST)
function parseHtmlToDom(html) {
    return htmlparser2.parseDocument(html);
}

// Serialize DOM back to HTML
function serializeDomToHtml(dom) {
    return domSerializer(dom);
}

function getCircularReplacer() {
    const ancestors = [];
    return function (key, value) {
      if (typeof value !== "object" || value === null) {
        return value;
      }
      // `this` is the object that value is contained in,
      // i.e., its direct parent.
      while (ancestors.length > 0 && ancestors.at(-1) !== this) {
        ancestors.pop();
      }
      if (ancestors.includes(value)) {
        // return "[Circular]";
        return undefined;
      }
      ancestors.push(value);
      return value;
    };
  }

// Example HTML
const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Document</title>
</head>
<body>
    <div id="main" class="container">
        <h1>Hello, World!</h1>
        <p>This is a test paragraph.</p>
    </div>
</body>
</html>
`;

// Parse the HTML to a DOM (AST)
const dom = parseHtmlToDom(html);
console.log(JSON.stringify(dom, getCircularReplacer()));

// Serialize the DOM back to HTML
const serializedHtml = serializeDomToHtml(dom.children);

console.log("Original HTML:\n", html);
console.log("Serialized HTML:\n", serializedHtml);
console.log('They are ' + (serializedHtml == html ? '' : 'not ') + 'the same');
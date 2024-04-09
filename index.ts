import { parseDocument, Parser } from "htmlparser2";
import { DomHandler } from "domhandler";
import diff from "microdiff";
import postgres from 'postgres'

const sql = postgres({
  user: 'domomo',
  password: 'developer',
  database: 'domomo',
  host: 'localhost',
  port: 5432,
});

const now = await sql`SELECT NOW()`;
console.log(now);

// Parse HTML to a simplified JSON structure
function htmlToJson(html) {
  const handler = new DomHandler();
  const parser = new Parser(handler);
  parser.write(html);
  parser.end();

  const simplifyDom = (node) => ({
    type: node.type,
    name: node.name,
    attribs: node.attribs,
    children: node.children ? node.children.map(simplifyDom) : undefined,
    data: node.data,
  });

  return handler.dom.map(simplifyDom);
}

// Reconstruct HTML from the simplified JSON structure
function jsonToHtml(nodes) {
  const buildHtml = (node) => {
    if (node.type === "tag") {
      const attrs = node.attribs
        ? Object.entries(node.attribs)
          .map(([key, value]) => `${key}="${value}"`)
          .join(" ")
        : "";
      const openingTag = `<${node.name}${attrs ? ` ${attrs}` : ""}>`;
      const closingTag = `</${node.name}>`;
      const children = node.children ? node.children.map(buildHtml).join("") : "";
      return `${openingTag}${children}${closingTag}`;
    } else if (node.type == "directive") {
      return `<${node.data}>`;
    } else if (node.type === "text") {
      return node.data;
    }
    return '';
  };

  return nodes.map(buildHtml).join("");
}

const content: any = {
  "/": [
    {
      "type": "directive",
      "name": "!doctype",
      "data": "!DOCTYPE html"
    },
    {
      "type": "tag",
      "name": "html",
      "attribs": {},
      "children": [
        {
          "type": "tag",
          "name": "head",
          "attribs": {},
          "children": [
            {
              "type": "tag",
              "name": "title",
              "attribs": {},
              "children": [
                {
                  "type": "text",
                  "data": "Test Document"
                }
              ]
            },
          ]
        },
        {
          "type": "tag",
          "name": "body",
          "attribs": {},
          "children": [
            {
              "type": "tag",
              "name": "div",
              "attribs": {
                "id": "main",
                "class": "container"
              },
              "children": [
                {
                  "type": "tag",
                  "name": "h1",
                  "attribs": {},
                  "children": [
                    {
                      "type": "text",
                      "data": "Hello, World!"
                    }
                  ]
                },
                {
                  "type": "tag",
                  "name": "p",
                  "attribs": {},
                  "children": [
                    {
                      "type": "text",
                      "data": "This is a test paragraph."
                    }
                  ]
                },
              ]
            },
          ]
        },
      ]
    },
  ],
}

// 0,0  0,1
// [{}, {}]

/*
{
  // document
  children: [
    {
      children: []
    }
  ]
}
*/

const organize = (treeRows: any[]) => {
  const parents = [{
    id: null,
    data: undefined,
    children: [],
  }];
  const str: any = [parents[0]];

  for (let i = 0; i < treeRows.length; i++) {
    const p = {
      id: treeRows[i].id,
      data: treeRows[i],
      children: [],
    };
    parents.push(p)
    for (const parent of parents) {
      if (parent.id === treeRows[i].parent) {
        parent.children.splice(treeRows[i].position, 0, p);
      }
    }
  }

  return str;
}

const server = Bun.serve({
  port: 3000,
  websocket: {
    message(ws, message) {
      console.log(ws, message);
    },
  },
  async fetch(request, server) {
    if (server.upgrade(request)) {
      return; // do not return a Response
    }

    const uri = new URL(request.url);
    const document = await sql`SELECT * FROM documents WHERE name = ${uri.pathname}`;

    let cd = content[uri.pathname];

    if (document.length > 0) {
      const doc = document[0];
      // console.log(doc);
      const tree = await sql`SELECT * FROM document_tree WHERE root = ${doc.id}`;
      // console.log(tree);
      const organized = organize(tree);
      console.log(JSON.stringify(organized));
    }

    switch (request.method) {
      case 'GET':
        if (document.length === 0) {
          return new Response('Not found.', { status: 404 });
        }

        return new Response(jsonToHtml(cd), {
          headers: {
            "Content-Type": "text/html",
          },
        });
      case 'PUT':
        // curl -X PUT -H "Content-Type: text/html" -d @test.html http://localhost:3000/spoke
        const type = request.headers.get('Content-Type');
        console.log(type); // TODO handle application/json-html-ast
        content[uri.pathname] = htmlToJson(await (await request.blob()).text());

        if (cd !== undefined) {
          // generate a diff
          const e = diff(cd, content[uri.pathname]);
          console.log(e);
        }
        // console.log(content);
        // TODO handle Accepts
        return new Response('Created.', { status: 201 });
    }

    return new Response('Bad request.', { status: 400 });
  },
});

console.log(`Listening on localhost:${server.port}`);

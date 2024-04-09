import postgres from 'postgres'

const sql = postgres({
  user: 'domomo',
  password: 'developer',
  database: 'domomo',
  host: 'localhost',
  port: 5432,
});

enum NodeType {
  WINDOW,
  DOCUMENT,
  DOCUMENT_TYPE,
  ELEMENT,
  TEXT,
  COMMENT,
}

type NodeTypeName = keyof typeof NodeType;

interface Node {
  id: string | null;
  node_type: NodeTypeName;
  children: Node[];
  name: string | null;
  value: string | null;
  position: number;
  parent: string | null;
}

const nodeToHTML = (node: Node): string => {
  const children: string = node.children ? node.children.map(nodeToHTML).join("") : "";

  switch (node.node_type) {
    case "DOCUMENT_TYPE":
      return `<${node.value}>`;
    case "ELEMENT":
      return `<${node.name}>${children}</${node.name}>`;
    case "TEXT":
      return node.value ?? '';
    case "COMMENT":
      return `<!--${children}-->`;
    default:
    case "WINDOW":
    case "DOCUMENT":
      return children;
  }
}

const rowsToTree = (treeRows: any[]) => {
  const parents: Node[] = [{
    id: null,
    node_type: 'WINDOW',
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

  return parents[0];
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
    const document = await sql`
      SELECT
        id
      FROM documents
      WHERE name = ${uri.pathname}
    `;

    let organized = null;

    if (document.length > 0) {
      const doc = document[0];
      // console.log(doc);
      const tree = await sql`
        SELECT
          id,
          node_type,
          name,
          value,
          position,
          parent
        FROM document_tree
        WHERE root = ${doc.id}
      `;
      // console.log(tree);
      organized = rowsToTree(tree);
      // console.log(JSON.stringify(organized));
    }

    switch (request.method) {
      case 'GET':
        // curl http://localhost:3000/
        if (document.length === 0 || organized === null || organized === undefined) {
          return new Response('Not found.', { status: 404 });
        }

        // const content = jsonToHtml(cd);
        const content = nodeToHTML(organized);
        // console.log(content);
        return new Response(content, {
          headers: {
            "Content-Type": "text/html",
          },
        });
      case 'PUT':
        // curl -X PUT -H "Content-Type: text/html" -d @test.html http://localhost:3000/spoke
        const type = request.headers.get('Content-Type');
        console.log(type); // TODO handle application/json-html-ast
        // content[uri.pathname] = htmlToJson(await (await request.blob()).text());

        // if (cd !== undefined) {
        //   // generate a diff
        //   const e = diff(cd, content[uri.pathname]);
        //   console.log(e);
        // }
        // console.log(content);
        // TODO handle Accepts
        return new Response('Created.', { status: 201 });
    }

    return new Response('Bad request.', { status: 400 });
  },
});

console.log(`Listening on localhost:${server.port}`);

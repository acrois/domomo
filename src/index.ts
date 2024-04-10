import { Elysia, NotFoundError } from "elysia";
import postgres from 'postgres'
import { nodeToHTML, rowsToParents, rowsToTree } from "./util";

// client-side script to connect websocket for bidirectional async updates
// uri per node
// update nodes
// create nodes
// client-side designMode html attribute and contenteditable element attribute
// client-side keyboard shortcuts for typographic changes to current element
// TODO handle application/json-html-ast

// curl http://localhost:3000/
// curl -X PUT -H "Content-Type: text/html" -d @test.html http://localhost:3000/spoke

// content[uri.pathname] = htmlToJson(await (await request.blob()).text());
// if (cd !== undefined) {
//   // generate a diff
//   const e = diff(cd, content[uri.pathname]);
//   console.log(e);
// }
// console.log(content);

const name = 'Nodula';
const sql = postgres({
  user: 'domomo',
  password: 'developer',
  database: 'domomo',
  host: 'localhost',
  port: 5432,
});
const encoder = new TextEncoder();
const app = new Elysia()
  .derive(({ headers }) => {
    const auth = headers['Authorization']

    return {
      bearer: auth?.startsWith('Bearer ') ? auth.slice(7) : null
    }
  })
  .mapResponse(({ query, response, set, headers }) => {
    let type = headers['Content-Type'] ?? 'text/plain';
    let text = typeof response === 'string' ? response : '';

    if (response !== null && typeof response === 'object') {
      if ('id' in response && 'children' in response && !('raw' in query)) {
        type = 'text/html'
        text = nodeToHTML(response);
      }
      else if (response instanceof Response) {
        text = response.toString()
      }
      else {
        type = 'application/json'
        text = JSON.stringify(response)
      }
    }

    // console.log(response);

    set.headers['Content-Encoding'] = 'gzip'
    set.headers['Content-Type'] = `${type}; charset=utf-8`

    return new Response(
      Bun.gzipSync(encoder.encode(text)),
    )
  })
  .onError(({ code, error, set }) => {
    const estr = error?.toString();

    if (code === 'NOT_FOUND' || estr === 'NOT_FOUND') {
      set.status = 404
      return ''
    }

    // console.log(code);
    return estr;
  })
  .get("*", async ({ params }) => {
    // console.log(params);
    const path = `/${params['*']}`
    const document = await sql`
      SELECT
        id
      FROM documents
      WHERE name = ${path}
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

    if (document.length === 0 || organized === null || organized === undefined) {
      throw new NotFoundError();
    }

    return organized;
  })
  .guard({

  }, (app) => app
    .resolve(async ({ params: { document, fragment } }) => {
      const doc = await sql`
        SELECT
          *
        FROM documents
        WHERE id = ${document}
      `;

      const frag = await sql`
        SELECT
          *
        FROM node
        WHERE id = ${fragment}
      `;

      if (doc.length === 0 || frag.length === 0) {
        throw new NotFoundError();
      }

      return {
        document: doc[0],
        fragment: frag[0],
      };
    })
    .get("/:document/:fragment", async ({ document, fragment }) => {
      // console.log(document, fragment);
      const tree = await sql`
        SELECT
          id,
          node_type,
          name,
          value,
          position,
          parent
        FROM document_tree
        WHERE root = ${document.id}
      `;
      // console.log(tree);
      const parents = rowsToParents(tree);
      // console.log(parents);

      for (const parent of parents) {
        if (parent.id === fragment.id) {
          return parent;
        }
      }

      throw 'Invalid';
    })
  )
  .listen(3000)
  ;

console.log(
  `🦊 ${name} is running at ${app.server?.hostname}:${app.server?.port}`
);

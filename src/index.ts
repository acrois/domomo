import { Elysia, NotFoundError, ParseError } from "elysia";
import postgres from 'postgres'
import { cleanTree, htmlToDocument, nodeToHTML, rowsToParents, rowsToTree } from "./util";
import diff from "microdiff";

// client-side script to connect websocket for bidirectional async updates
// update nodes
// create nodes
// client-side designMode html attribute and contenteditable element attribute
// client-side keyboard shortcuts for typographic changes to current element
// TODO handle application/json-html-ast

// curl http://localhost:3000/
// curl -X PUT -H "Content-Type: text/html" -d @sample/test.html http://localhost:3000/spoke

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
  .derive(async ({ headers, request }) => {
    const uri = new URL(request.url);
    const domain = uri.hostname;
    // console.log(domain);
    const t = await sql`SELECT id FROM domains WHERE name = ${domain}`

    if (t.length > 0 ) {
      return {
        domain: t[0],
      }
    }

    return {
      domain: null,
    }
  })
  .derive(({ headers }) => {
    const auth = headers['authorization']

    return {
      bearer: auth?.startsWith('Bearer ') ? auth.slice(7) : null
    }
  })
  .onParse(({ request }, contentType) => {
    if (contentType == 'text/html') {
      const uri = new URL(request.url);
      return (async () => htmlToDocument(uri.pathname, await request.text()))();
    }
  })
  .mapResponse(({ query, response, set, headers }) => {
    let type = headers['Content-Type'] ?? 'text/plain';
    let text = typeof response === 'string' ? response : '';

    if (response !== null && typeof response === 'object') {
      // id and children in object is a good indicator of tree
      //   TODO find a better one
      // also, we did not request the raw (server default) response
      //   raw is useful for debugging and as an escape hatch
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
  .get("*", async ({ params, domain }) => {
    if (!domain) {
      throw new NotFoundError();
    }

    // console.log(params);
    const path = `/${params['*']}`
    const document = await sql`
      SELECT
        document_id AS id
      FROM domain_documents
      WHERE id = ${domain.id}
        AND document_name = ${path}
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
  .put('*', async ({ params, domain, body }) => {
    if (!domain) {
      throw new NotFoundError();
    }

    if (!body) {
      throw new ParseError();
    }

    console.log(JSON.stringify(body));

    // console.log(params);
    const path = `/${params['*']}`
    const document = await sql`
      SELECT
        document_id AS id
      FROM domain_documents
      WHERE id = ${domain.id}
        AND document_name = ${path}
    `;

    // let organized = null;
    // let organizedClean = null;

    // if (document.length > 0) {
    //   const doc = document[0];
    //   // console.log(doc);
    //   const tree = await sql`
    //     SELECT
    //       id,
    //       node_type,
    //       name,
    //       value,
    //       position,
    //       parent
    //     FROM document_tree
    //     WHERE root = ${doc.id}
    //   `;
    //   // console.log(tree);
    //   organized = rowsToTree(tree);

    //   if (organized) {
    //     organized = organized;
    //     organizedClean = cleanTree(organized);
    //   }
    //   // console.log(JSON.stringify(organized));
    // }

    // console.log(organized, organizedClean);
    // const d = diff(organizedClean ?? {}, body ?? {});
    // console.log(JSON.stringify(d));
    // const c = sql``

    // return organized;
  })
  .guard({}, (app) => app
    .resolve(async ({ domain, params: { document, fragment } }) => {
      if (!domain) {
        throw new NotFoundError();
      }
      // console.log(domain, document);
      const doc = await sql`
        SELECT
          *
        FROM domain_documents
        WHERE id = ${domain.id}
        AND document_id = ${document}
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
        WHERE root = ${document.document_id}
      `;
      // console.log(tree);
      const parents = rowsToParents(tree);
      // console.log(parents);

      for (const parent of parents) {
        if (parent.id === fragment.id) {
          return parent;
        }
      }

      throw new NotFoundError();
    })
  )
  .listen(3000)
  ;

console.log(
  `🦊 ${name} is running at ${app.server?.hostname}:${app.server?.port}`
);

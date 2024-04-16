import { Elysia, NotFoundError, ParseError } from "elysia";
import { Pool } from "pg";
import { astToHTML, parseToAST, rowsToParents, rowsToTree } from "./util";
import { JwksClient } from "jwks-rsa";
import jwt from "jsonwebtoken";
import { SQL } from "sql-template-strings";
// import diff from "microdiff";

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

const app = (env: any) => {
  const AUD = env.CFZT_AUDIENCE;
  const TEAM_DOMAIN = env.CFZT_TEAM;
  const CERTS_URL = `${TEAM_DOMAIN}/cdn-cgi/access/certs`;

  const client = new JwksClient({
    jwksUri: CERTS_URL
  });

  const getKey = (header, callback) => {
    client.getSigningKey(header.kid, function (err, key) {
      callback(err, key?.getPublicKey());
    });
  }

  const pgUri: string = env.PG_URI || env.POSTGRES_URI || env.POSTGRES_URL
    || env.DB_URI || env.DB_URL || env.PG_URL
    || `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@localhost:5432/${env.POSTGRES_DB}`;
  // const sql = postgres(pgUri);
  const encoder = new TextEncoder();
  return new Elysia({
    aot: false,
  })
    .decorate('pool', new Pool({
      connectionString: pgUri,
    }))
    .derive(async ({ headers, request, pool }) => {
      const db = await pool.connect();
      const uri = new URL(request.url);
      const domain = uri.hostname;
      // console.log(domain);
      const t = await db.query(SQL`SELECT id FROM domains WHERE name = ${domain}`)

      if (t.rowCount && t.rowCount > 0) {
        return {
          domain: t.rows[0],
        }
      }

      return {
        domain: null,
      }
    })
    .derive(({ headers, cookie }) => {
      const basicAuth = headers['authorization'] ?? headers['Authorization']
      const cfAuth = cookie['CF_Authorization'] ?? headers['cf_authorization']

      let decodedJwt = null;

      if (cfAuth && cfAuth.value) {
        decodedJwt = jwt.verify(cfAuth.value, getKey, { audience: AUD });
      }

      return {
        bearer: basicAuth?.startsWith('Bearer ') ? basicAuth.slice(7) : null,
        jwt: decodedJwt,
      }
    })
    // parse
    .onParse(({ request }, contentType) => {
      // console.log('test');
      if (contentType == 'text/html') {
        return (async () => {
          const ast = parseToAST(await request.text())
          ast.name = new URL(request.url).pathname
          // console.log(ast);
          return ast;
        })();
      }
      // else if ()
    })
    // mapResponse
    .onAfterHandle(({ query, response, set, headers }) => {
      let type = headers['Content-Type'] ?? 'text/plain';
      let text = typeof response === 'string' ? response : '';
      // console.log(type);
      if (response !== null && typeof response === 'object') {
        // id and children in object is a good indicator of tree
        //   TODO find a better one
        // also, we did not request the raw (server default) response
        //   raw is useful for debugging and as an escape hatch
        if ('id' in response && 'children' in response && !('raw' in query)) {
          type = 'text/html'
          text = astToHTML(response);
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
        Bun.gzipSync(
          encoder.encode(text)
        ),
      );
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
    .get('-', async ({ bearer, jwt, domain }) => {
      return {
        bearer,
        jwt,
        domain
      };
    })
    .get("*", async ({ params, domain, pool }) => {
      const db = await pool.connect();
      if (!domain) {
        throw new NotFoundError();
      }

      // console.log(params);
      const path = `/${params['*']}`
      const document = await db.query(SQL`
        SELECT
          document_id AS id
        FROM domain_documents
        WHERE id = ${domain.id}
          AND document_name = ${path}
      `);

      let organized = null;

      if (document.rowCount && document.rowCount > 0) {
        const doc = document.rows[0];
        // console.log(doc);
        const tree = await db.query(SQL`
          SELECT
            id,
            node_type,
            name,
            value,
            position,
            parent
          FROM document_tree
          WHERE root = ${doc!.id}
        `);
        // console.log(tree);
        organized = rowsToTree(tree.rows);
        // console.log(JSON.stringify(organized));
      }

      if (!document.rowCount || document.rowCount === 0 || organized === null || organized === undefined || organized.children.length === 0) {
        throw new NotFoundError();
      }

      return organized.children[0];
    })
    .put('*', async ({ params, domain, body, pool }) => {
      const db = await pool.connect();
      if (!domain) {
        throw new NotFoundError();
      }

      if (!body) {
        throw new ParseError();
      }

      // console.log(JSON.stringify(body));

      // console.log(params);
      const path = `/${params['*']}`
      const document = await db.query(SQL`
        SELECT
          document_attachment_id
        FROM domain_documents
        WHERE id = ${domain.id}
          AND document_name = ${path}
      `);

      // await sql.begin(async sql => {
      if (document.rowCount !== 0) {
        await db.query(SQL`
          DELETE FROM node_attachment
          WHERE id = ${document.rows[0]!.document_attachment_id}
        `);
      }

      const insertNode = async (node: any, parentId: string, next_position: number = 0) => {
        // console.log(node);
        const type = node.node_type;
        let name = node.name;

        if (name === null || name === undefined) {
          name = type === 'DOCUMENT_TYPE'
            ? '!doctype'
            : type === 'DOCUMENT'
              ? path
              : null
        }

        let value = node.value;

        if (value === null || value === undefined) {
          value = type === 'DOCUMENT_TYPE'
            ? '!DOCTYPE html'
            : null
        }
        // console.log(node.name, type, name, value);
        const inserted = await db.query(SQL`
          INSERT INTO node (
              type_id,
              name,
              value
          ) VALUES (
            (
              SELECT id
              FROM node_type
              WHERE tag = ${type}
            ),
            ${name},
            ${value}
          ) returning id
        `);
        // console.log(inserted);
        const nodeId = inserted.rows[0]!.id;
        // console.log(nodeId, parentId, next_position);
        // throw ';';
        // const nextAttachment = await sql`
        //   SELECT next_position
        //   FROM node_attachment_next
        //   WHERE parent_id = ${parentId}
        // `;

        // if (nextAttachment.length === 0) {
        //   throw 'Uh oh...';
        // }

        // console.log(node.name, node.value, node.node_type, parentId, nodeId, next_position);

        await db.query(SQL`
          INSERT INTO node_attachment
            (parent_id, child_id, position)
          VALUES
            (${parentId}, ${nodeId}, ${next_position})
        `)

        // console.log(c);

        const children: any[] = node?.children || [];
        for (let i = 0; i < children.length; i++) {
          // console.log(nodeId, i);
          await insertNode(children[i], nodeId, i);
        }

        // children.map(v => await insertNode(v, nodeId));
      }

      const nextAttachment = await db.query(SQL`
        SELECT next_position
        FROM node_attachment_next
        WHERE parent_id = ${domain.id}
      `);

      if (!nextAttachment.rowCount || nextAttachment.rowCount === 0) {
        throw 'Uh oh...';
      }

      await insertNode(body, domain.id, nextAttachment.rows[0]!.next_position);
      // });


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
      .resolve(async ({ domain, pool, params: { document, fragment } }) => {
        const db = await pool.connect();
        if (!domain) {
          throw new NotFoundError();
        }
        // console.log(domain, document);
        const doc = await db.query(SQL`
          SELECT
            *
          FROM domain_documents
          WHERE id = ${domain.id}
          AND document_id = ${document}
        `);

        const frag = await db.query(SQL`
          SELECT
            *
          FROM node
          WHERE id = ${fragment}
        `);

        if (!doc.rowCount || doc.rowCount === 0 || !frag.rowCount || frag.rowCount === 0) {
          throw new NotFoundError();
        }

        return {
          document: doc.rows[0],
          fragment: frag.rows[0],
        };
      })
      .get("/:document/:fragment", async ({ document, fragment, pool }) => {
        const db = await pool.connect();
        // console.log(document, fragment);
        const tree = await db.query(SQL`
          SELECT
            id,
            node_type,
            name,
            value,
            position,
            parent
          FROM document_tree
          WHERE root = ${document.document_id}
        `);
        // console.log(tree);
        const parents = rowsToParents(tree.rows);
        // console.log(parents);

        for (const parent of parents) {
          if (parent.id === fragment.id) {
            return parent;
          }
        }

        throw new NotFoundError();
      })
    )
}

export default app;
import { Elysia, NotFoundError, ParseError, error } from "elysia";
import { Pool } from "pg";
import { cron, Patterns } from '@elysiajs/cron'
import { astPrepareForRehype, astToHTML, parseToAST, rowsToParents, rowsToTree } from "./util";
import { SQL } from "sql-template-strings";
import Stream from "@elysiajs/stream";
import diff from "microdiff";
import codecPlugin from "./encoder";
import authPlugin, { AuthError } from "./auth";
import { watch } from "fs";
import { readdir } from "node:fs/promises";

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

function convertFileUrlToHttp(url: URL): string {
  // Extract the pathname and split into segments
  const pathSegments = url.pathname.split('/');

  // Find the index of 'static' and determine the host, which is the segment right after 'static'
  const staticIndex = pathSegments.indexOf('static');

  if (staticIndex === -1 || staticIndex + 1 >= pathSegments.length) {
    throw new Error('Invalid URL format: "static" directory not found');
  }

  const host = pathSegments[staticIndex + 1];

  // Construct the path by joining segments after the host, remove '.html' from the last segment
  const newPath = pathSegments
    .slice(staticIndex + 2)
    .filter(v => v === 'index.html' ? undefined : v)
    .join('/')
    .replace('.html', '')
    .replace('//', '/')
    ;

  // Construct and return the new HTTP URL
  return `http://${host}/${newPath}`;
}

const loadFileByRelativePath = async (handle: any, event: any, filename: string) => {
  const location = Bun.pathToFileURL('./static/' + filename);
  const z = Bun.file(location);

  if (!z.exists()) {
    console.error('bad', filename, location);
    return;
  }

  if (z.type.startsWith('text/html')) {
    const newUrl = convertFileUrlToHttp(location);

    const request = new Request(newUrl, {
      method: 'PUT',
      body: await z.arrayBuffer(),
      headers: {
        'Content-Type': z.type,
      }
    });
    handle(request)
    console.log('Handled', event, newUrl);
  }
  else {
    console.log(`Detected ${event} in ${filename}`);
  }
}

const fetcher = (fetch) => {
  return new Stream(async (stream) => {
    let initial = await fetch();

    if (!initial) {
      throw 'Invalid document.';
    }

    let initialPrep = astPrepareForRehype(initial);
    stream.event = 'init';
    stream.send(initialPrep);

    let connected = true;
    while (connected) {
      await stream.wait(1500)
      // TODO LISTEN postgres pubsub this stuff only when it is actually edited.
      const renewed = await fetch();

      if (!renewed) {
        throw 'Invalid document';
      }

      const prep = astPrepareForRehype(renewed);
      const d = diff(initialPrep, prep);

      // console.log(d);
      // stream.send(d.length > 0 ? renewed : []);

      if (d && d.length > 0) {
        // console.log(JSON.stringify(d), JSON.stringify(prep), JSON.stringify(diff(astPrepareForRehype(initial), prep)));
        stream.event = 'step';
        // console.log(d);
        stream.send(d);
        initial = renewed;
        initialPrep = prep;
      }
    }

    stream.close()
  })
}

const app = (env: any) => {
  const pgUri: string = env.PG_URI || env.POSTGRES_URI || env.POSTGRES_URL
    || env.DB_URI || env.DB_URL || env.PG_URL
    || `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@localhost:5432/${env.POSTGRES_DB}`;

  return new Elysia({
    // aot: false, // false for cloudflare worker
  })
    .use(authPlugin(env))
    .use(codecPlugin)
    .onError(({ code, error, set }) => {
      // console.error(error, code);
      const estr = typeof error === 'string' ? error : 'toString' in error ? error?.toString() : '';

      if (code === 'NOT_FOUND' || estr === 'NOT_FOUND') {
        set.status = 404;
        return '';
      }
    })
    .decorate('pool', new Pool({
      connectionString: pgUri,
    }))
    .onStop(async ({ decorator: { pool } }) => {
      await pool.end();
    })
    .use(
      cron({
        name: 'heartbeat',
        pattern: Patterns.everySecond(),
        run() {
          // console.log("Heartbeat")
        }
      })
    )
    .derive(async ({ headers, request, pool, }) => {
      const db = await pool.connect();
      const uri = new URL(request.url);

      try {
        const domain = uri.hostname;
        // console.log(domain);
        const t = await db.query(SQL`SELECT
          id, name
        FROM domains
        WHERE name = ${domain}`);

        if (t.rowCount && t.rowCount > 0) {
          return {
            domain: t.rows[0],
            uri,
          }
        }

        const newDomain = await db.query(SQL`INSERT INTO node (
          type_id,
          name
        ) VALUES (
          (SELECT id FROM node_type WHERE tag = 'DOMAIN'),
          ${domain}
        ) returning id, name`);

        if (newDomain.rowCount && newDomain.rowCount > 0) {
          return {
            domain: newDomain.rows[0],
            uri,
          }
        }
      }
      finally {
        db.release();
      }

      return {
        domain: null,
        uri,
      }
    })
    .get("*", async ({ params, domain, pool, headers }) => {
      if (!domain) {
        throw new NotFoundError();
      }

      // console.log(params);
      const path = `/${params['*']}`

      const fetch = async () => {
        const tree = await pool.query(SQL`
          SELECT
            dt.id,
            dt.node_type,
            dt.name,
            dt.value,
            dt.position,
            dt.parent
          FROM document_tree dt
          JOIN domain_documents dd
            ON dd.document_id = dt.root
          WHERE dd.id = ${domain.id}
            AND dd.document_name = ${path}
        `);
        // console.log(tree);
        const organized = rowsToTree(tree.rows);

        if (organized === null || organized === undefined || organized.children.length === 0) {
          throw new NotFoundError();
        }

        return organized.children[0];
      }

      const accept = headers['accept'];

      if (accept === 'text/event-stream') {
        // db.release();
        return fetcher(fetch);
      }

      return fetch();
    })
    .guard({
      beforeHandle({ set, auth, path, domain, uri }) {
        // allow localhost changes :)
        if (uri.hostname.match(/.*\.?localhost/) !== null) {
          return;
        }

        if (!auth
          || !auth.email
          || !auth!.email!.endsWith('@kinetech.llc')
        ) {
          throw new AuthError();
        }
      },
    }, (app) => app
      // .get('_', () => 'ok')
      .put('*', async ({ params, domain, body, pool }) => {
        const db = await pool.connect();
        try {
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

          // await db.query('BEGIN');

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

            // console.log();
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
          // await db.query('COMMIT');
        }
        catch (e) {
          // await db.query('ROLLBACK');
          throw e;
        }
        finally {
          db.release();
        }
      })
    )
    .guard({}, (app) => app
      .resolve(async ({ domain, pool, params: { document, fragment } }) => {
        const db = await pool.connect();
        try {
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
        }
        finally {
          db.release();
        }
      })
      .get("/:document/:fragment", async ({ document, fragment, pool }) => {
        const db = await pool.connect();

        try {
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
        }
        finally {
          db.release();
        }
      })
    )
    .onStart(async app => {
      const watcher = watch(
        './static',
        { recursive: true },
        async (event, filename) => await loadFileByRelativePath(app.handle, event, filename!),
      );

      // read all the files in the current directory, recursively
      const rd = await readdir("./static", { recursive: true });

      for await (const filename of rd) {
        await loadFileByRelativePath(app.handle, 'load', filename!)
      }

      process.on('exit', () => {
        // console.log('msg', message);
        watcher.close();
      });
    })
}

export default app;

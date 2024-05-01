import { Elysia, NotFoundError, ParseError } from "elysia";
import { Pool } from "pg";
import { cron, Patterns } from '@elysiajs/cron'
import { SQL } from "sql-template-strings";
import Stream from "@elysiajs/stream";
import codecPlugin from "./encoder";
import authPlugin, { AuthError } from "./auth";
import { watch } from "fs";
import { readdir } from "node:fs/promises";
import { diffTrees, getNodeId, treeToRows } from "./dbeautiful";
import { loadFileByRelativePath, serveStaticDirectory, serveStaticFile } from "./util";
import { fetchTree, fetchTrees } from "./database";

// client-side script to connect websocket for bidirectional async updates
// update nodes
// create nodes
// client-side designMode html attribute and contenteditable element attribute
// client-side keyboard shortcuts for typographic changes to current element
// TODO handle application/json-html-ast

// curl http://localhost:3000/
// curl -X PUT -H "Content-Type: text/html" -d @sample/test.html http://localhost:3000/spoke
// curl -X PATCH -H "Content-Type: text/html" -d @static/localhost/example.html http://localhost/example

// content[uri.pathname] = htmlToJson(await (await request.blob()).text());
// if (cd !== undefined) {
//   // generate a diff
//   const e = diff(cd, content[uri.pathname]);
//   console.log(e);
// }


const fetcher = (fetch: () => Promise<any>) => {
  return new Stream(async (stream) => {
    let initial = await fetch();

    if (!initial) {
      throw 'Invalid document.';
    }

    stream.event = 'init';
    stream.send(initial);

    let connected = true;
    while (connected) {
      await stream.wait(1500)
      // TODO LISTEN postgres pubsub this stuff only when it is actually edited.
      const renewed = await fetch();

      if (!renewed) {
        throw 'Invalid document';
      }

      const d = diffTrees(initial, renewed);

      // console.log(d);
      // stream.send(d.length > 0 ? renewed : []);

      if (d && d.length > 0) {
        stream.event = 'diff';
        // console.log(d);
        stream.send(d);
        initial = renewed;
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
    // @ts-ignore
    .onError(({ code, error, set }) => {
      // console.error(error, code);
      const estr = typeof error === 'string' ? error : 'toString' in error ? error?.toString() : '';

      if (code === 'NOT_FOUND' || estr === 'NOT_FOUND' || estr.includes('ENOENT') || error instanceof NotFoundError) {
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
    .derive(async ({ request, pool, }) => {
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
    .get('/m/*', serveStaticDirectory('m'))
    .get('/w/*', serveStaticDirectory('w'))
    .get('/s/*', serveStaticDirectory('s'))
    .get('favicon.ico', serveStaticFile(Bun.file('./static/_/favicon.ico')))
    .get("*", async ({ params, domain, pool, headers }) => {
      if (!domain) {
        throw new NotFoundError();
      }

      // console.log(params);
      const path = `/${params['*']}`
      const accept = headers['accept'];
      const boundFetcher = () => fetchTree(<any>pool, domain.id, path);

      if (accept === 'text/event-stream') {
        return fetcher(boundFetcher);
      }

      return boundFetcher();
    })
    .guard({
      beforeHandle({ auth, uri }) {
        // allow localhost changes :)
        if (uri.hostname.match(/.*\.?localhost/) !== null) {
          return;
        }

        if (!auth
          || !auth.email
          || !auth!.email!.toString().endsWith('@kinetech.llc')
        ) {
          throw new AuthError();
        }
      },
    }, (app) => app
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

          await db.query('BEGIN');

          if (document.rowCount !== 0) {
            await db.query(SQL`
              DELETE FROM node_attachment
              WHERE id = ${document.rows[0]!.document_attachment_id}
            `);
          }

          const t = treeToRows(body as any, path);
          // console.log(JSON.stringify(t));

          t.rows.map(r => db.query(SQL`
            INSERT INTO node (
              id,
              type_id,
              name,
              value
            ) VALUES (
              ${r.id},
              (
                SELECT id
                FROM node_type
                WHERE tag = ${r.type}
              ),
              ${r.name},
              ${r.value}
            ) ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              type_id = EXCLUDED.type_id,
              value = EXCLUDED.value
            returning id
          `))
          t.attachments.map(a => db.query(SQL`
            INSERT INTO node_attachment
              (parent_id, child_id, position)
            VALUES
              (${a.parent_id}, ${a.child_id}, ${a.position})
            ON CONFLICT (id) DO UPDATE
            SET
              parent_id = EXCLUDED.parent_id,
              child_id = EXCLUDED.child_id,
              position = EXCLUDED.position + 1
          `))

          const nextAttachment = await db.query(SQL`
            SELECT next_position
            FROM node_attachment_next
            WHERE parent_id = ${domain.id}
          `);

          if (!nextAttachment.rowCount || nextAttachment.rowCount === 0) {
            throw 'Uh oh...';
          }

          db.query(SQL`
            INSERT INTO node_attachment
              (parent_id, child_id, position)
            VALUES
              (${domain.id}, ${t.rows[0].id}, ${nextAttachment.rows[0].next_position})
          `)
          await db.query('COMMIT');
        }
        catch (e) {
          console.error(e);
          await db.query('ROLLBACK');
          throw e;
        }
        finally {
          db.release();
        }
      })
      .patch('*', async ({ params, domain, body, pool }) => {
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
          let initialTree = null;

          try {
            initialTree = await fetchTree(db, domain.id, path);
          }
          catch (ex: any) {
            if (ex instanceof NotFoundError || ex?.code === 'NOT_FOUND') {
              // allow it to be empty.
            }
          }

          if (!initialTree) {

          }
          console.log(initialTree, body);
          // const d = await diffTreeWithHTML(initialTree, body);
          // console.log(d);

          // await db.query('COMMIT');
        }
        catch (e) {
          // await db.query('ROLLBACK');
          console.error(e);
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
          const parents = await fetchTrees(db, document.id, document.document_name)
          // console.log(parents);

          for (const parent of parents) {
            if (getNodeId(parent) === fragment.id) {
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

import { SQL } from "sql-template-strings";
import { ClientBase, Query, } from "pg";
import { rowsToTrees } from "./dbeautiful";
import { NotFoundError } from "elysia";

const DEBUG_QUERIES = false;

if (DEBUG_QUERIES) {
  const submit = Query.prototype.submit;
  Query.prototype.submit = function () {
    // @ts-ignore
    const text = this.text;
    // @ts-ignore
    const values = this.values || [];
    // @ts-ignore
    const query = text.replace(/\$([0-9]+)/g, (m, v) => JSON.stringify(values[parseInt(v) - 1]))
    console.debug('QUERY', query);
    // @ts-ignore
    submit.apply(this, arguments);
  };
}

export const fetchTrees = async (client: ClientBase, domainId: string, documentPath: string) => {
  const tree = await client.query(SQL`
    SELECT
      get_document_tree(dd.document_id) AS tree
    FROM domain_documents dd
    WHERE dd.id = ${domainId}
      AND dd.document_name = ${documentPath}
  `);

  if (tree === null || tree === undefined || tree.rows.length === 0) {
    throw new NotFoundError();
  }

  const t = tree.rows[0].tree
  // console.log(t);
  // console.log(tree);
  const organized = rowsToTrees(t);

  if (organized === null || organized === undefined || organized.length === 0) {
    throw new NotFoundError();
  }

  return organized;
}

export const fetchTree = async (client: ClientBase, domainId: string, documentPath: string) =>
  (await fetchTrees(client, domainId, documentPath))[0]

export const insertNodesAttachments = (db: ClientBase, rows: any[], attachments: any[]) => {
  rows.map(r => db.query(SQL`
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
  `));
  attachments.map(a => db.query(SQL`
    INSERT INTO node_attachment
      (parent_id, child_id, position)
    VALUES
      (${a.parent_id}, ${a.child_id}, ${a.position})
    ON CONFLICT (id) DO UPDATE
    SET
      parent_id = EXCLUDED.parent_id,
      child_id = EXCLUDED.child_id,
      position = EXCLUDED.position + 1
  `));
}

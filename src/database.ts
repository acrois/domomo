import { SQL } from "sql-template-strings";
import { ClientBase, } from "pg";
import { rowsToTrees } from "./dbeautiful";
import { NotFoundError } from "elysia";

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

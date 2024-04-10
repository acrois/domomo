CREATE OR REPLACE VIEW public.documents
AS SELECT id,
    type_id,
    name,
    value
   FROM node
  WHERE type_id = (( SELECT node_type.id
           FROM node_type
          WHERE node_type.tag::text = 'DOCUMENT'::text));

CREATE OR REPLACE VIEW public.document_tree
AS WITH RECURSIVE cte AS (
         SELECT documents.id,
            documents.type_id,
            documents.name,
            documents.value,
            documents.id AS root,
            0 AS level,
            NULL::uuid AS parent,
            0 AS "position",
            ARRAY[documents.id] AS path
           FROM documents
        UNION ALL
         SELECT nc.id,
            nc.type_id,
            nc.name,
            nc.value,
            ct.root,
            ct.level + 1,
            c.parent_id AS parent,
            c."position",
            ct.path || nc.id
           FROM cte ct
             JOIN node_attachment c ON c.parent_id = ct.id
             JOIN node nc ON nc.id = c.child_id
        )
 SELECT nt.tag AS node_type,
    m.id,
    m.type_id,
    m.name,
    m.value,
    m.root,
    m.level,
    m.parent,
    m."position",
    m.path
   FROM cte m
     JOIN node_type nt ON nt.id = m.type_id
  ORDER BY m.level, m."position";

drop function if exists fetch_nodes;
CREATE OR REPLACE FUNCTION fetch_nodes(root_uuid uuid)
RETURNS TABLE(id uuid, name varchar, type varchar, value varchar) AS $$
BEGIN
    RETURN QUERY
    SELECT n.id, n.name, n.node_type AS type, n.value
    FROM document_tree n
    WHERE n.root = root_uuid;
END;
$$ LANGUAGE plpgsql;

drop function if exists fetch_attachments;
CREATE OR REPLACE FUNCTION fetch_attachments(root_uuid uuid)
RETURNS TABLE(parent_id uuid, child_id uuid, "position" int) AS $$
BEGIN
    RETURN QUERY
    SELECT distinct na.parent_id, na.child_id, na.position
    FROM node_attachment na
    JOIN fetch_nodes(root_uuid) fn ON na.parent_id = fn.id OR na.child_id = fn.id;
END;
$$ LANGUAGE plpgsql;

drop function if exists get_document_tree;
CREATE OR REPLACE FUNCTION get_document_tree(root_uuid uuid)
RETURNS jsonb AS $$
DECLARE
    nodes jsonb;
    attachments jsonb;
BEGIN
    -- Fetch nodes and format as JSON
    nodes := jsonb_agg(to_jsonb(row) - 'row')
    FROM (
        SELECT * FROM fetch_nodes(root_uuid)
    ) row;

    -- Fetch attachments and format as JSON
    attachments := jsonb_agg(to_jsonb(row) - 'row')
    FROM (
        SELECT * FROM fetch_attachments(root_uuid)
    ) row;

    -- Combine both results into one JSON object
    RETURN jsonb_build_object(
        'attachments', attachments,
        'rows', nodes
    );
END;
$$ LANGUAGE plpgsql;

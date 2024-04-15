create or replace view node_attachment_next as
select
  n.id as parent_id,
  max(coalesce(na.position, 0)) + 1 as next_position
from node n
left join node_attachment na
  on na.parent_id = n.id
group by n.id
;

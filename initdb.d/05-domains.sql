create or replace view domains as
select
	*
from node
where type_id = (select id from node_type where tag = 'DOMAIN')
;

create or replace view domain_documents as
select
	dm.id,
	dm.type_id,
	dm.name,
	c.id as document_attachment_id,
	doc.id as document_id,
	doc.type_id as document_type_id,
	doc.name as document_name
from domains dm
join node_attachment c on
	c.parent_id = dm.id
join documents doc
	on doc.id = c.child_id
;

INSERT INTO public.node (id,type_id,"name",value) VALUES
	 ('6354fab5-cdeb-4172-883f-90f4a8a8b0c3',0,'localhost',NULL);
INSERT INTO public.node_attachment (id,parent_id,child_id,"position") VALUES
	 ('e69f0590-5ad5-4257-9c2d-981f9dba76cd','6354fab5-cdeb-4172-883f-90f4a8a8b0c3','460347c3-1285-4e7b-8ddc-7352cb4e3aec',0);

-- select * from domain_documents;

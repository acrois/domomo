CREATE TABLE public.node_type (
	id int2 NOT NULL,
	tag varchar NOT NULL,
	description varchar NULL,
	CONSTRAINT node_type_pk PRIMARY KEY (id)
);

CREATE TABLE public.node (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	type_id int2 NOT NULL,
	"name" varchar NULL,
	value varchar NULL,
	CONSTRAINT node_pk PRIMARY KEY (id),
	CONSTRAINT node_node_type_fk FOREIGN KEY (type_id) REFERENCES public.node_type(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE public.node_attachment (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	parent_id uuid NOT NULL,
	child_id uuid NOT NULL,
	"position" int4 DEFAULT 0 NOT NULL,
	CONSTRAINT node_attachment_pk PRIMARY KEY (id),
	CONSTRAINT node_attachment_unique UNIQUE (parent_id, "position"),
	CONSTRAINT node_attachment_node_fk FOREIGN KEY (parent_id) REFERENCES public.node(id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT node_attachment_node_fk_1 FOREIGN KEY (child_id) REFERENCES public.node(id) ON DELETE CASCADE ON UPDATE CASCADE
);

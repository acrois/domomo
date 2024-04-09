INSERT INTO public.node ("name",value) VALUES
	 ('/',NULL),
	 ('!doctype','!DOCTYPE html'),
	 (NULL,'
'),
	 ('html',NULL),
	 ('head',NULL),
	 ('body',NULL),
	 (NULL,'Test Document'),
	 ('title',NULL),
	 ('p',NULL);

INSERT INTO public.node_attachment (id,parent_id,child_id,"position") VALUES
	 ('9669b51e-1278-453a-9f2d-fe6e4b89a3eb','460347c3-1285-4e7b-8ddc-7352cb4e3aec','63787a60-1886-4dd9-8f89-e382f05b2217',0),
	 ('9b32724e-85ea-4496-9241-ced955084971','460347c3-1285-4e7b-8ddc-7352cb4e3aec','5bbc6a6c-fde2-4947-a449-0ead50b2356d',1),
	 ('8eabb9d1-6696-4f76-a3cc-4b6eaffd06ee','5bbc6a6c-fde2-4947-a449-0ead50b2356d','7d907b80-061f-4984-bafc-465ed363a5c7',0),
	 ('3c9920c9-7405-43a3-9eb3-eda6b72f1bd3','5bbc6a6c-fde2-4947-a449-0ead50b2356d','40c0753c-2f6f-47a8-80b2-5f10a5dfc1b3',1),
	 ('67b5c14f-f669-4ed8-9348-0b8bdab85d72','7d907b80-061f-4984-bafc-465ed363a5c7','c5014d95-9c0d-4c33-8770-beea58ae74d1',0),
	 ('08752f36-58ba-4821-859b-a504df5984cf','c5014d95-9c0d-4c33-8770-beea58ae74d1','63f20fd3-c17a-4ec1-a8af-fa681e7f8516',0),
	 ('6f79d144-b778-4218-a5e5-f37df591cde8','40c0753c-2f6f-47a8-80b2-5f10a5dfc1b3','37680211-1548-4ab5-9551-36fa0a4e346c',0),
	 ('6c27ba8a-cab6-4795-a9fc-ad44c02e2489','37680211-1548-4ab5-9551-36fa0a4e346c','63f20fd3-c17a-4ec1-a8af-fa681e7f8516',0);

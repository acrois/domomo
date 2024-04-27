import { expect, test } from "bun:test";
import { treeToRows, rowsToTrees, diffTrees, applyTreeDiff } from "../src/dbeautiful";
import { astToHTML, htmlToAST } from "../src/util";

const uuidMock = function* () {
  yield '79455613-836f-44cb-9036-de551c6c0d23';
  yield '04e1b12b-c42d-4c67-916c-8acf9dec75f6';
  yield '06e18375-1962-47be-b8d1-b272b0013bea';
  yield '896c8aa4-c868-4c9c-af0b-c2969dd12c18';
  yield '882bbc2b-2c53-46f0-8e9e-d1bd3e5d0e5f';
  yield '2115feec-c2a2-410a-b3a7-9e2593d592a3';
  yield "0d8afb3f-416a-48bc-8631-61872af9e880";
  yield "4f81f0fe-ada5-4a0a-91d4-cdb40e492271";
  yield "de02bea8-04cd-4f5d-807f-2bcd3daf6ceb";
  yield "8cadab15-b7bd-4303-8ba3-4b4044b577e0";
  yield "e57657c7-d63c-44a2-a307-b2521513f1dc";
  yield "a7f94b39-a72f-4452-8ffc-f4aa652f43ed";
  yield "2953960c-9aa5-4c5a-b47d-42b20bdae370";
  yield "378b6f72-9c3c-416c-97c5-252911e9cd3f";
  yield "57f74768-8c25-4106-9836-2b87196d3d87";
  yield "3cbd8796-f203-4a9d-a4ff-687ba3b80c37";
  yield "21db6b00-a785-4ae7-8082-cfa15ed21d02";
  yield "5a7fafaf-beb2-45f2-9eff-dce0cba2049c";
  yield "d10ff0d3-3b4f-49ad-ae8e-d6c9c9629dcb";
  yield "57bce452-1a40-4bb7-ba10-b2849c97543a";
  yield "b029763f-e4eb-44bf-a86f-f1004cc0339d";
  yield "bb912caa-9970-4963-8042-94608b758224";
  yield "c3ea33be-b707-4bf7-8220-c00525bfa2d8";
  yield "f4ef812a-2cc4-465f-88a2-c3d204133e3e";
  yield "d1a210c2-1615-403d-b825-e948681521b1";
  yield "17feedf5-f0e2-4ba7-a88d-4ebb45b9bb41";
  yield "11ccce97-f66b-420b-a9d5-f78c85d8acfa";
  yield "6454eb56-79de-4d1d-bab9-f5f5a9fd6c53";
  yield "b360443d-8fef-4de0-b676-b4cecfc6a654";
  yield "479982d5-ae7d-446e-bcd2-3a3942ba1f0e";
  yield "922c7053-7d2c-47d8-b279-a896a56e2800";
  yield "01cc1b04-95c7-4761-a14d-fd748bf0f506";
  yield "e485a86a-1407-4e05-86e3-35084394af6e";
  yield "e15b6b62-e80f-4e78-8b62-403f57963d31";
  yield "602966c7-c959-4143-8098-4385e37b947e";
  yield "12a653b9-762b-46ad-b813-49c2b8611346";
  yield "c92e8f22-d72b-41fa-8100-a8b547410610";
  yield "5426a295-f98c-4ece-9619-3977e223d9c3";
  yield "2f91f126-d577-473c-beff-378b68070a14";
  yield "e259f815-3614-4c10-b286-f44df5118bf1";
  yield "af8ef275-515c-4bbb-bb99-5e4e347fcadb";
  yield "9e3d0933-cbf3-48f8-a474-dd36c12008ee";
  yield "ce3d4c63-342d-4a84-b9d4-d73bdc4c0887";
  yield "51a0c6fe-ce28-4a93-bcc3-a448963ad4d4";
  yield "81fae9d7-a4f7-4c91-b186-210c3c81a88c";
  yield "4b1cc06a-28b9-4c70-8195-aa98f5c56c25";
  yield "2d43262f-eb78-4ddd-90f9-d6cfdb98290d";
  yield "d5dd6b9c-a8bc-445a-847b-3562ffaab83b";
  yield "cdda9c06-a433-4966-a44f-4074932685a5";
  yield "ec92e386-8c43-4318-9675-2d62f89135a0";
  yield "682ad8cb-7cf5-40b6-a8c6-b1d1d5d05acb";
  yield "97e5b5e3-49c5-489e-92b9-7c60c9261c1d";
  yield "f5c008f1-a8e4-48f9-b6f8-62ab78592c31";
  yield "f7ce3501-4704-43fb-8858-1cf0f2994063";
  yield "5db92bba-08e7-44fc-8bbf-8e920597511d";
  yield "a67949a0-b61f-49e7-b1e1-4221e68fe185";
  yield "289c7292-d27a-4919-b4cb-898ccecc31cf";
  yield "2d3f4868-c467-413c-a41e-508a3e7bcb18";
  yield "e833a6bd-2aec-4fd6-8346-6ca777b96281";
  yield "cd4d3673-cd8b-443f-a7f0-37e1ef024410";
  yield "a3a2865b-0ab9-49fc-9851-9cafcb8b2e1a";
  yield "57087756-962d-423d-a3ba-fa95fb391d86";
  yield "852250d8-8bc7-44a3-bcbb-e0c8464b3345";
  yield "edcedba8-d52d-4218-8849-0b5b90f322d8";
  yield "d4107510-dff8-42a6-95ec-ce0a8e5091f1";
  yield "8789943b-1022-48cb-9631-cce64a80674a";
  yield "15e387f8-d06e-4389-a49b-5649ddec542e";
  yield "1a044f50-6dcb-4438-81d9-0d065dc60799";
  yield "8723d490-314f-4300-b676-dcb22b7ac313";
  yield "9c2de7fc-5d6e-4394-9426-60b0fb64766f";
  yield "8bf1d035-2530-4aea-960b-ee2755772884";
  yield "8b019b94-e568-4fa4-81de-4ff957e71639";
  yield "8862c9bf-4b7f-422c-b406-e3c1b6f123c4";
  yield "0f40ace2-493e-4ec6-b7a8-dbc38d74db05";
  yield "284c89fe-828e-4117-9cf0-9accf0db17e7";
  yield "3f79fee2-8901-434d-babf-5f601ec015d3";
  yield "1ba39eb3-7191-4242-815c-0f054110e2f7";
  yield "449b54ee-1a2d-49d2-81a7-eae4abd1e55e";
  yield "55003e65-bbd4-4408-bd6c-746a2a47807d";
  yield "ced684a5-fe59-4293-99e5-3e004c96279e";
  yield "85880a2c-87dc-45c8-92e2-fb5db0803994";
  yield "2cf8b8a0-634b-42d7-8f8a-ce23b46a8cf4";
  yield "4ac68e0c-03d3-4089-b94a-c5dfee5799c2";
  yield "6f003f3f-67e2-4014-83df-b150facea19d";
  yield "c649aa1e-aa37-4d8a-8901-0938d5967c69";
  yield "0e894b9c-b15d-475c-b615-3c377d9e53c2";
  yield "0b6037ab-6edc-4938-94e2-3d12a718f193";
  yield "44dd41da-78d8-4160-ab5d-4ceada305d65";
  yield "b8c5e34f-153d-44e8-990e-986516a1d3ca";
  yield "cfeead1b-8185-4f36-b6e5-c44a5a18ddb1";
  yield "1400f022-5dcf-4e97-86fe-cb046a71755e";
  yield "ef92d2d3-d0e0-43e2-bb36-68802b8978e1";
  yield "fc6cbc93-9e16-48ae-8d95-6ed25d0f9c72";
  return '02731456-7853-43a5-a125-2290614a2d0b';
}

const uuidNext = () => {
  let r = uuidMock();

  return () => {
    const next = r.next();

    if (next.done) {
      r = uuidMock();
    }

    return next.value
  }
}

const testy = `<!doctype html>
<html>
  <head>
    <title>text</title>
    <link rel="stylesheet" src="test.css" />
  </head>
  <body>
    <p class="cancel-culture">test</p>
  </body>
</html>`;

test('Convert AST to DB rows', async () => {
  const ast = await htmlToAST(testy);
  expect(ast).toMatchSnapshot();
  // console.log(JSON.stringify(ast));
  const rows = treeToRows(ast, '/', uuidNext());
  // console.log(JSON.stringify(rows));
  expect(rows).toMatchSnapshot();
});

test('Convert HTML to AST and back', async () => {
  const ast = await htmlToAST(testy);
  expect(ast).toMatchSnapshot();
  // console.log(ast);
  const html = await astToHTML(ast);
  // console.log(html);
  expect(html).toMatchSnapshot();
});

test('Convert DB rows to AST', async () => {
  const ast = await htmlToAST(testy);
  expect(ast).toMatchSnapshot();
  // console.log(JSON.stringify(ast));
  const rows = treeToRows(ast, '/', uuidNext());
  // console.log(JSON.stringify(rows));
  expect(rows).toMatchSnapshot();
  const tree = rowsToTrees(rows);
  expect(tree).toMatchSnapshot();
  // console.log(JSON.stringify(tree[0]));
  const html = astToHTML(tree[0]);
  // console.log(JSON.stringify(tree[0]));
  expect(html).toMatchSnapshot();
});

test('Tree Difference and Apply', async () => {
  // Example usage:
  const oldTree = {
    id: "guid1",
    type: "element",
    name: "p",
    children: [
      { id: "guid2", type: "text", name: null, value: "test", properties: {} }
    ],
  };
  const newTree = {
    id: "guid1",
    type: "element",
    name: "div",
    children: [
      { id: "guid2", type: "text", name: null, value: "changed", properties: {} },
      { id: "guid3", type: "element", name: "p", value: null, properties: {}, children: [] }
    ],
  };

  const operations = diffTrees(oldTree, newTree, 'root');
  expect(operations).toMatchSnapshot();

  const transferTree = JSON.parse(JSON.stringify(oldTree)); // simulate what the network will do
  // applyTreeDiff(transferTree, operations);
  console.log(transferTree, newTree, operations);
  // console.log(JSON.stringify(operations));

})

import { expect, test } from "bun:test";
import { astToHTML, parseToAST, nodesToProperties, propertiesToNodes } from "../src/util";

// curl -X PUT -H "Content-Type: text/html" -d @sample/example.html http://localhost/example --output -

test('n2p', () => {
  const n = nodesToProperties({
    "tagName": "p",
    "type": "ELEMENT",
    "properties": {},
    "children": [
      {
        "type": "ATTRIBUTE",
        "tagName": "data-title",
        "value": "Test Document",
      },
    ],
  });
  console.log(n);
});

test('p2n', () => {
  const p = propertiesToNodes({
    name: "p",
    node_type: "ELEMENT",
    properties: {
      "data-title": "Test Document",
    },
    children: [],
  });
  console.log(p);
});

test("node to html", () => {
  // expect(
  //   nodeToHTML(
  //     { "id": null, "node_type": "WINDOW", "children": [{ "id": "460347c3-1285-4e7b-8ddc-7352cb4e3aec", "node_type": "DOCUMENT", "name": "/", "value": null, "position": 0, "parent": null, "children": [{ "id": "63787a60-1886-4dd9-8f89-e382f05b2217", "node_type": "DOCUMENT_TYPE", "name": "!doctype", "value": "!DOCTYPE html", "position": 0, "parent": "460347c3-1285-4e7b-8ddc-7352cb4e3aec", "children": [] }, { "id": "5bbc6a6c-fde2-4947-a449-0ead50b2356d", "node_type": "ELEMENT", "name": "html", "value": null, "position": 1, "parent": "460347c3-1285-4e7b-8ddc-7352cb4e3aec", "children": [{ "id": "7d907b80-061f-4984-bafc-465ed363a5c7", "node_type": "ELEMENT", "name": "head", "value": null, "position": 0, "parent": "5bbc6a6c-fde2-4947-a449-0ead50b2356d", "children": [{ "id": "c5014d95-9c0d-4c33-8770-beea58ae74d1", "node_type": "ELEMENT", "name": "title", "value": null, "position": 0, "parent": "7d907b80-061f-4984-bafc-465ed363a5c7", "children": [{ "id": "63f20fd3-c17a-4ec1-a8af-fa681e7f8516", "node_type": "TEXT", "name": null, "value": "Test Document", "position": 0, "parent": "c5014d95-9c0d-4c33-8770-beea58ae74d1", "children": [] }] }] }, { "id": "40c0753c-2f6f-47a8-80b2-5f10a5dfc1b3", "node_type": "ELEMENT", "name": "body", "value": null, "position": 1, "parent": "5bbc6a6c-fde2-4947-a449-0ead50b2356d", "children": [{ "id": "37680211-1548-4ab5-9551-36fa0a4e346c", "node_type": "ELEMENT", "name": "p", "value": null, "position": 0, "parent": "40c0753c-2f6f-47a8-80b2-5f10a5dfc1b3", "children": [{ "id": "63f20fd3-c17a-4ec1-a8af-fa681e7f8516", "node_type": "TEXT", "name": null, "value": "Test Document", "position": 0, "parent": "37680211-1548-4ab5-9551-36fa0a4e346c", "children": [] }] }] }] }] }], "name": null, "value": null, "position": 0, "parent": null }
  //   )
  // ).toMatchSnapshot();

  expect(
    astToHTML({
      "id": "460347c3-1285-4e7b-8ddc-7352cb4e3aec",
      "node_type": "DOCUMENT",
      "name": "/",
      "value": null,
      "position": 0,
      "parent": null,
      "children": [
        {
          "id": "63787a60-1886-4dd9-8f89-e382f05b2217",
          "node_type": "DOCUMENT_TYPE",
          "name": "!doctype",
          "value": "!DOCTYPE html",
          "position": 0,
          "parent": "460347c3-1285-4e7b-8ddc-7352cb4e3aec",
          "children": []
        },
        {
          "id": "5bbc6a6c-fde2-4947-a449-0ead50b2356d",
          "node_type": "ELEMENT",
          "name": "html",
          "value": null,
          "position": 1,
          "parent": "460347c3-1285-4e7b-8ddc-7352cb4e3aec",
          "children": [
            {
              "id": "7d907b80-061f-4984-bafc-465ed363a5c7",
              "node_type": "ELEMENT",
              "name": "head",
              "value": null,
              "position": 0,
              "parent": "5bbc6a6c-fde2-4947-a449-0ead50b2356d",
              "children": [
                {
                  "id": "c5014d95-9c0d-4c33-8770-beea58ae74d1",
                  "node_type": "ELEMENT",
                  "name": "title",
                  "value": null,
                  "position": 0,
                  "parent": "7d907b80-061f-4984-bafc-465ed363a5c7",
                  "children": [
                    {
                      "id": "63f20fd3-c17a-4ec1-a8af-fa681e7f8516",
                      "node_type": "TEXT",
                      "name": null,
                      "value": "Test Document",
                      "position": 0,
                      "parent": "c5014d95-9c0d-4c33-8770-beea58ae74d1",
                      "children": []
                    }
                  ]
                }
              ]
            },
            {
              "id": "40c0753c-2f6f-47a8-80b2-5f10a5dfc1b3",
              "node_type": "ELEMENT",
              "name": "body",
              "value": null,
              "position": 1,
              "parent": "5bbc6a6c-fde2-4947-a449-0ead50b2356d",
              "children": [
                {
                  "id": "37680211-1548-4ab5-9551-36fa0a4e346c",
                  "node_type": "ELEMENT",
                  "name": "p",
                  "value": null,
                  "position": 0,
                  "parent": "40c0753c-2f6f-47a8-80b2-5f10a5dfc1b3",
                  "children": [
                    {
                      "id": "63f20fd3-c17a-4ec1-a8af-fa681e7f8516",
                      "node_type": "TEXT",
                      "name": null,
                      "value": "Test Document",
                      "position": 0,
                      "parent": "37680211-1548-4ab5-9551-36fa0a4e346c",
                      "children": []
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    })
  ).toMatchSnapshot();
});

test("html to node", async () => {
  // expect(htmlToDocument('/', `<!DOCTYPE html>
  // <html>

  // <head>
  //   <title>Test Document</title>
  // </head>

  // <body>
  //   <div id="main" class="container">
  //     <h1>Hello, World!</h1>
  //     <p>This is a test paragraph.</p>
  //   </div>
  // </body>

  // </html>`)).toMatchSnapshot();
  // expect(
  //   htmlToDocument(
  //     '/',
  //     '<!DOCTYPE html><html data-guid="5bbc6a6c-fde2-4947-a449-0ead50b2356d"><head data-guid="7d907b80-061f-4984-bafc-465ed363a5c7"><title data-guid="c5014d95-9c0d-4c33-8770-beea58ae74d1">Test Document</title></head><body data-guid="40c0753c-2f6f-47a8-80b2-5f10a5dfc1b3"><p data-guid="37680211-1548-4ab5-9551-36fa0a4e346c">Test Document</p></body></html>'
  //   )
  // ).toMatchSnapshot();
  const t = await parseToAST("<!doctype html><html><head><title>Test Document</title></head><body><p>Test Document</p></body></html>");
  // console.log(t);
  expect(t).toMatchSnapshot();
});

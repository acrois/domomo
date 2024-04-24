import { expect, test } from "bun:test";
import { treeToRows } from "../src/dbeautiful";
import { htmlToAST } from "../src/util";

test('Convert AST to DB rows', async () => {
  const test = '<!doctypehtml><html><head><title>text</title></head><body><p>test</p></body></html>';
  const ast = await htmlToAST(test);
  console.log(ast);
  const rows = treeToRows(ast);
  expect(rows).toMatchSnapshot();
});

test('Convert DB rows to AST', () => {

});

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import { removeKeys, renameProperty } from './util';

const htmlToAstToJsonToHtml = async (html) => {
    // Parse HTML to AST
    const ast = unified()
        .use(rehypeParse, {
          fragment: true,
          verbose: false,
        })
        .parse(html);

    const cleanAST = renameProperty(
      renameProperty(
        removeKeys(ast, ['position']),
        'type',
        'node_type'
      ),
      'tagName',
      'name'
    );

    // Optionally convert AST to JSON
    const json = JSON.stringify(cleanAST); // Convert AST to JSON
    console.log(json);

    // Convert AST back to HTML
    const htmlOutput = unified()
        .use(rehypeStringify)
        .stringify(ast);

    return htmlOutput;
};

// Example HTML
const html = `
<div>
    <h1>Title</h1>
    <p>This is a paragraph.</p>
</div>
`;

htmlToAstToJsonToHtml(html)
    .then(result => console.log(result))
    .catch(err => console.error(err));

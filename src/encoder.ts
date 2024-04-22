import { Elysia } from 'elysia';
import { astToHTML, parseToAST } from './util';
import Stream from '@elysiajs/stream';

const encoder = new TextEncoder();
const codecPlugin = new Elysia({
  // name: 'html-codec',
})
  .onParse({
    as: 'global',
  }, ({ request }, contentType) => {
    // console.log('test');
    if (contentType == 'text/html') {
      return (async () => {
        const ast = await parseToAST(await request.text())
        ast.name = new URL(request.url).pathname
        // console.log(ast);
        return ast;
      })();
    }
    // return request;
  })
  // mapResponse
  .onAfterHandle({
    as: 'global',
  }, ({ query, response, set, headers }) => {
    let type = headers['Content-Type'] ?? 'text/plain';
    let text = typeof response === 'string' ? response : '';
    // console.log(type);
    if (response !== null && typeof response === 'object') {
      // id and children in object is a good indicator of tree
      //   TODO find a better one
      // also, we did not request the raw (server default) response
      //   raw is useful for debugging and as an escape hatch
      if ('id' in response && 'children' in response && !('raw' in query)) {
        type = 'text/html'
        text = astToHTML(response);
      }
      else if (response instanceof Stream) {
        return response;
      }
      else if (response instanceof Response) {
        text = response.toString()
      }
      else {
        type = 'application/json'
        text = JSON.stringify(response)
      }
    }

    // console.log(response);

    set.headers['Content-Encoding'] = 'gzip'
    set.headers['Content-Type'] = `${type}; charset=utf-8`
    // console.log(set.

    return new Response(
      Bun.gzipSync(
        encoder.encode(text)
      ),
      // {
      //   status: set.status
      // }
    );
  });

export default codecPlugin;

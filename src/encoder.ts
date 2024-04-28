import { Elysia } from 'elysia';
import Stream from '@elysiajs/stream';
import { astToHTML, htmlToAST } from './util';

type ValidGZIPType = string | ArrayBuffer | Uint8Array
const checkResponseType = (response: any): response is ValidGZIPType  =>
  typeof response === 'string'
    || response instanceof ArrayBuffer
    || response instanceof Uint8Array
;
const encoder = new TextEncoder();
const codecPlugin = new Elysia({
  // name: 'html-codec',
})
  .onParse({
    as: 'global',
  }, async ({ request }, contentType) => {
    // console.log('test');
    if (contentType == 'text/html') {
      return await htmlToAST(await request.text());
    }
    // return request;
  })
  // mapResponse
  .onAfterHandle({
    as: 'global',
  }, async ({ query, response, set }) => {
    // console.log(headers);
    let type = set.headers['Content-Type']
      ?? 'text/plain; charset=utf-8';
    let dat = checkResponseType(response)
      ? response
      : '';

    // console.log(type);

    if (response !== null
      && typeof response === 'object'
      && !(response instanceof Response)
      && dat === ''
    ) {
      // id and children in object is a good indicator of tree
      //   TODO find a better one
      // also, we did not request the raw (server default) response
      //   raw is useful for debugging and as an escape hatch
      if ('data' in response && 'children' in response && !('raw' in query)) {
        type = 'text/html; charset=utf-8'
        dat = astToHTML(response);
      }
      else if (response instanceof Stream) {
        return response;
      }
      else if (response instanceof File) {
        dat = await response.arrayBuffer();
      }
      else {
        type = 'application/json; charset=utf-8'
        dat = JSON.stringify(response)
      }
    }

    // console.log(type, dat);
    // const isTextContent = type.startsWith('text/') || type.includes('charset=');

    if (dat !== null
      && dat !== undefined
      && checkResponseType(dat)
      // && (
      //   // if it is a string, length > 0
      //   (typeof dat === 'string' && dat.length > 0)
      //   // if it is not a string
      //   || (typeof dat !== 'string')
      // )
    ) {
      set.headers['Content-Encoding'] = 'gzip'
      set.headers['Content-Type'] = type;
      return Bun.gzipSync(
        typeof dat === 'string'
          ? encoder.encode(dat)
          : dat
      );
    }

    return response;
  });

export default codecPlugin;

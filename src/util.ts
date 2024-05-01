import rehypePresetMinify from 'rehype-preset-minify';
// import diff from "unist-diff";
import { rehype } from 'rehype';
import { NotFoundError } from 'elysia';
import type { BunFile } from "bun";

const processor = (fragment?: boolean) => rehype()
  .use(rehypePresetMinify)
  .data('settings', {
    fragment: fragment,
    verbose: false,
    // emitParseErrors: true,
    // tightDoctype: false,
    // abruptDoctypePublicIdentifier: false,
  })
  ;

export const cleanAST = (ast: any, fragment?: boolean) => {
  return processor(fragment).run(ast);
}

export const cleanHTML = (html: string, fragment?: boolean) => {
  return processor(fragment).process(html);
}

export const htmlToAST = (html: string, fragment?: boolean) => {
  const proc = processor(fragment)
  const parsed = proc.parse(html)
  return proc.run(parsed);
}

export const astToHTML = (ast: any, fragment?: boolean) => {
  // const t = astPrepareForRehype(ast);
  // console.log(JSON.stringify(t));
  return processor(fragment).stringify(ast);
}

export const removeKeys: any = (obj: object, keys: string[]) => obj !== Object(obj)
  ? obj
  : Array.isArray(obj)
    ? obj.map((item) => removeKeys(item, keys))
    : Object.keys(obj)
      .filter((k) => !keys.includes(k))
      .reduce(
        (acc, x) => Object.assign(acc, { [x]: removeKeys((<any>obj)[x], keys) }),
        {}
      )

type AnyObject = { [key: string]: any };

export const renameProperty = (obj: AnyObject, oldProp: string, newProp: string): AnyObject => {
  if (Array.isArray(obj)) {
    // If it's an array, apply the function to each element
    return obj.map(item => renameProperty(item, oldProp, newProp));
  } else if (obj !== null && typeof obj === 'object') {
    // If it's an object, rename the property and apply the function to each property
    const newObj: AnyObject = {};
    for (const key in obj) {
      const value = obj[key];
      // CHEAP HACK to disable type/node_type confusion
      const newValue = key === 'properties' ? value : renameProperty(value, oldProp, newProp);
      // If the current key matches the old property name, rename it
      if (key === oldProp) {
        newObj[newProp] = newValue;
      } else {
        newObj[key] = newValue;
      }
    }
    return newObj;
  }
  // Return the value if it's neither an array nor an object
  return obj;
}

export const transformPropertyValue = (
  obj: AnyObject,
  propName: string,
  transformFunction: (value: any) => any
): AnyObject => {
  if (Array.isArray(obj)) {
    // If it's an array, apply the function to each element
    return obj.map(item => transformPropertyValue(item, propName, transformFunction));
  } else if (obj !== null && typeof obj === 'object') {
    // If it's an object, check each property
    const newObj: AnyObject = {};
    for (const key in obj) {
      const value = obj[key];
      // Apply the transform function to the property if it matches
      if (key === propName) {
        newObj[key] = transformFunction(value);
      } else {
        newObj[key] = transformPropertyValue(value, propName, transformFunction);
      }
    }
    return newObj;
  }
  // Return the value if it's neither an array nor an object
  return obj;
}

export const serveStaticDirectory = (directory: string) => {
  return async ({ params, set }: any) => {
    const path = `/${directory}/${params['*']}`
    const f = Bun.file(`./static/_${path}`);
    return await serveStaticFile(f)({ params, set });
  }
}

export const serveStaticFile = (f: BunFile) => {
  return async ({ set }: any) => {
    const exists = await f.exists();

    if (!exists) {
      throw new NotFoundError();
    }

    set.headers['Content-Type'] = f.type;
    return f.arrayBuffer();
  }
}

export const convertFileUrlToHttp = (url: URL): string => {
  // Extract the pathname and split into segments
  const pathSegments = url.pathname.split('/');

  // Find the index of 'static' and determine the host, which is the segment right after 'static'
  const staticIndex = pathSegments.indexOf('static');

  if (staticIndex === -1 || staticIndex + 1 >= pathSegments.length) {
    throw new Error('Invalid URL format: "static" directory not found');
  }

  const host = pathSegments[staticIndex + 1];

  // Construct the path by joining segments after the host, remove '.html' from the last segment
  const newPath = pathSegments
    .slice(staticIndex + 2)
    .filter(v => v === 'index.html' ? undefined : v)
    .join('/')
    .replace('.html', '')
    .replace('//', '/')
    ;

  // Construct and return the new HTTP URL
  return `http://${host}/${newPath}`;
}

export const loadFileByRelativePath = async (handle: any, event: any, filename: string) => {
  const location = Bun.pathToFileURL('./static/' + filename);
  const z = Bun.file(location);

  if (!z.exists()) {
    console.error('bad', filename, location);
    return;
  }

  if (z.type.startsWith('text/html')) {
    const newUrl = convertFileUrlToHttp(location);

    const request = new Request(newUrl, {
      method: 'PUT',
      body: await z.arrayBuffer(),
      headers: {
        'Content-Type': z.type,
      }
    });
    handle(request)
    console.log('Handled', event, newUrl);
  }
  else {
    console.log(`Detected ${event} in ${filename}`);
  }
}

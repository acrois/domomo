const { parseDocument, Parser } = require("htmlparser2");
const { DomHandler } = require("domhandler");

// Parse HTML to a simplified JSON structure
function htmlToJson(html) {
    const handler = new DomHandler();
    const parser = new Parser(handler);
    parser.write(html);
    parser.done();

    const simplifyDom = (node) => ({
        type: node.type,
        name: node.name,
        attribs: node.attribs,
        children: node.children ? node.children.map(simplifyDom) : undefined,
        data: node.data,
    });

    return handler.dom.map(simplifyDom);
}

// Reconstruct HTML from the simplified JSON structure
function jsonToHtml(nodes) {
    const buildHtml = (node) => {
        if (node.type === "tag") {
            const attrs = node.attribs
                ? Object.entries(node.attribs)
                    .map(([key, value]) => `${key}="${value}"`)
                    .join(" ")
                : "";
            const openingTag = `<${node.name}${attrs ? ` ${attrs}` : ""}>`;
            const closingTag = `</${node.name}>`;
            const children = node.children ? node.children.map(buildHtml).join("") : "";
            return `${openingTag}${children}${closingTag}`;
        } else if (node.type == "directive") {
            return `<${node.data}>`;
        } else if (node.type === "text") {
            return node.data;
        }
        return '';
    };

    return nodes.map(buildHtml).join("");
}

const content: any = {
    "/": [
        {
            "type": "directive",
            "name": "!doctype",
            "data": "!DOCTYPE html"
        },
        {
            "type": "text",
            "data": "\n"
        },
        {
            "type": "tag",
            "name": "html",
            "attribs": {},
            "children": [
                {
                    "type": "text",
                    "data": "\n"
                },
                {
                    "type": "tag",
                    "name": "head",
                    "attribs": {},
                    "children": [
                        {
                            "type": "text",
                            "data": "\n    "
                        },
                        {
                            "type": "tag",
                            "name": "title",
                            "attribs": {},
                            "children": [
                                {
                                    "type": "text",
                                    "data": "Test Document"
                                }
                            ]
                        },
                        {
                            "type": "text",
                            "data": "\n"
                        }
                    ]
                },
                {
                    "type": "text",
                    "data": "\n"
                },
                {
                    "type": "tag",
                    "name": "body",
                    "attribs": {},
                    "children": [
                        {
                            "type": "text",
                            "data": "\n    "
                        },
                        {
                            "type": "tag",
                            "name": "div",
                            "attribs": {
                                "id": "main",
                                "class": "container"
                            },
                            "children": [
                                {
                                    "type": "text",
                                    "data": "\n        "
                                },
                                {
                                    "type": "tag",
                                    "name": "h1",
                                    "attribs": {},
                                    "children": [
                                        {
                                            "type": "text",
                                            "data": "Hello, World!"
                                        }
                                    ]
                                },
                                {
                                    "type": "text",
                                    "data": "\n        "
                                },
                                {
                                    "type": "tag",
                                    "name": "p",
                                    "attribs": {},
                                    "children": [
                                        {
                                            "type": "text",
                                            "data": "This is a test paragraph."
                                        }
                                    ]
                                },
                                {
                                    "type": "text",
                                    "data": "\n    "
                                }
                            ]
                        },
                        {
                            "type": "text",
                            "data": "\n"
                        }
                    ]
                },
                {
                    "type": "text",
                    "data": "\n"
                }
            ]
        },
        {
            "type": "text",
            "data": "\n"
        }
    ],
}

const server = Bun.serve({
    port: 3000,
    fetch(request) {
        const uri = new URL(request.url);
        const cd = content[uri.pathname];

        if (request.method === 'GET') {
            if (cd === undefined) {
                return new Response('Not found.', { status: 404 });
            }
    
            return new Response(jsonToHtml(cd), {
                headers: {
                    "Content-Type": "text/html",
                },
            });
        }

        return new Response('Not allowed', { status: 405 });
    },
});

console.log(`Listening on localhost:${server.port}`);
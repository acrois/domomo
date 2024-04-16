import app from "./app";

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // console.log(ctx);
    return app(env).fetch(request);
    // ctx.waitUntil(client.end());
  }
}

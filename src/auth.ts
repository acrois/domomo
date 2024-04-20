import { Elysia } from 'elysia';
import { createRemoteJWKSet } from "jose";
import jwt from "@elysiajs/jwt";

const authPlugin = (env: any) => {
  const AUD = env.JWKS_AUDIENCE;
  const TEAM_DOMAIN = env.CFZT_TEAM;
  const CERTS_URL = new URL(TEAM_DOMAIN ? `${TEAM_DOMAIN}/cdn-cgi/access/certs` : env.JWKS_CERT_URL);
  const JWT_COOKIE = env.JWT_COOKIE;
  const JWT_HEADER = env.JWT_HEADER;
  const options = {
    // issuer: TEAM_DOMAIN,
    audience: AUD,
  }
  const jwkset = createRemoteJWKSet(<URL>CERTS_URL);
  return (app: Elysia) =>
    app.use(
      jwt({
        name: 'jwt',
        secret: jwkset,
      })
    )
    .derive(async ({ headers, cookie, jwt }) => {
      // check cookies, then check headers
      const token = JWT_COOKIE in cookie
        ? cookie[JWT_COOKIE]!.value
        : headers[JWT_HEADER];
      return {
        auth: token ? await jwt.verify(token, options) : null,
      };
    })
    .get('-', async ({ auth }) => {
      return {
        auth,
      };
    })
    .guard({
      beforeHandle({ set, jwt, path, request }) {
        const uri = new URL(request.url);
        const domain = uri.hostname;
        // allow localhost changes :)
        if (uri.hostname.match(/.*\.?localhost/) !== null) {
          return;
        }

        if (!jwt || !('email' in jwt) || !jwt.email) {
          const redirect = `${TEAM_DOMAIN}/cdn-cgi/access/login/${domain}?kid=${AUD}&redirect_url=${path}&meta={}`;
          set.redirect = redirect;
          throw 'UNAUTHORIZED_REDIRECT';
        }
      },
    }, (app) => app
      .get('_', () => 'ok')
    )
    .onError(({ error, set }) => {
      if (error?.toString() === 'UNAUTHORIZED_REDIRECT') {
        set.status = 303;
      }
    })
};
export default authPlugin;

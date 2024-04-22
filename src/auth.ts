import { Elysia, error } from 'elysia';
import { createRemoteJWKSet } from "jose";
import jwt from "@elysiajs/jwt";

export class AuthError extends Error {
  constructor () {
    super('Authentication Required');
  }
}

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
    .error({
      AuthError,
    })
    .onError({
      as: 'global',
    }, ({ code, error, set, request, path }) => {
      const uri = new URL(request.url);
      const domain = uri.hostname;
      // console.log(error, code);
      if (code == 'AuthError') {
        set.status = 303;
        const redirect = `${TEAM_DOMAIN}/cdn-cgi/access/login/${domain}?kid=${AUD}&redirect_url=${path}&meta={}`;
        set.redirect = redirect;
        // console.log('Authenticate', set.redirect);
        return '';
      }
    })
    .guard({
      beforeHandle({ jwt, request }) {
        const uri = new URL(request.url);
        // console.log(request);

        // allow localhost changes :)
        if (uri.hostname.match(/.*\.?localhost/) !== null) {
          return;
        }

        if (!jwt || !('email' in jwt) || !jwt.email) {
          throw new AuthError()
        }
      },
    }, (app) => app
      .get('_', () => 'ok')
    )
};
export default authPlugin;

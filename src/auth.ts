import { Elysia } from 'elysia';
import { createRemoteJWKSet } from "jose";
import jwt from "@elysiajs/jwt";

export class BasicAuthError extends Error {
  public code: string = 'BASIC_AUTH_ERROR';

  constructor(public message: string = 'Authentication Required') {
    super(message);
  }
}

export interface BasicAuthUser {
  username: string;
  password: string;
}

export interface BasicAuthConfig {
  users: BasicAuthUser[];
  realm?: string;
  errorMessage?: string;
  exclude?: string[];
  noErrorThrown?: boolean;
}

export class AuthError extends Error {
  public code: string = 'AUTH_ERROR';

  constructor (public message: string = 'Authentication Required') {
    super(message);
  }
}

const authPlugin = (env: any) => {
  const AUD = env.JWKS_AUDIENCE;
  const TEAM_DOMAIN = env.CFZT_TEAM;
  const CERTS_URL = new URL(TEAM_DOMAIN ? `${TEAM_DOMAIN}/cdn-cgi/access/certs` : env.JWKS_CERT_URL);
  const JWT_COOKIE = env.JWT_COOKIE;
  const JWT_HEADER = env.JWT_HEADER;
  const INTERNAL_SECRET = env.INTERNAL_SECRET;
  const options = {
    // issuer: TEAM_DOMAIN,
    audience: AUD,
  }
  const config: BasicAuthConfig = {
    users: [
      { username: "internal", password: INTERNAL_SECRET },
    ],
    noErrorThrown: true,
  }
  const jwkset = createRemoteJWKSet(<URL>CERTS_URL);
  return (app: Elysia) =>
    app.use(
      jwt({
        name: 'jwt',
        secret: jwkset,
      })
    )
    .derive({
      as: 'global',
    }, ({ headers }) => {
      const authorization = headers?.authorization;
      // console.log(authorization);
      if (!authorization)
        return { basicAuth: { isAuthed: false, username: null } };
      const [username, password] = atob(authorization.split(' ')[1]).split(':');
      // console.log(username, password, config.users);
      const user = config.users.find(
        (user) => user.username === username && user.password === password
      );
      if (!user) return { basicAuth: { isAuthed: false, username: null } };
      return { basicAuth: { isAuthed: true, username: user.username } };
    })
    .onTransform({
      as: 'global',
    }, (ctx) => {
      if (
        !ctx.basicAuth.isAuthed &&
        !config.noErrorThrown &&
        ctx.path !== undefined && // handle elysia start event when ctx.path is undefined
        // !isPathExcluded(ctx.path, config.exclude) &&
        ctx.request.method !== 'OPTIONS'
      )
        throw new BasicAuthError(config.errorMessage ?? 'Unauthorized');
    })
    // .onError({
    //   as: 'global',
    // }, ({ code, error }) => {
    //   if (code === 'BASIC_AUTH_ERROR') {
    //     return new Response(error.message, {
    //       status: 401,
    //       headers: {
    //         'WWW-Authenticate': `Basic${
    //           config.realm ? ` realm="${config.realm}"` : ''
    //         }`,
    //       },
    //     });
    //   }
    // })
    .derive({
      as: 'global',
    }, async ({ headers, cookie, jwt }) => {
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
      BasicAuthError,
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
      beforeHandle({ jwt, request, store }) {
        const uri = new URL(request.url);
        // console.log(store);
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

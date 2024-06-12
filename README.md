# domomo

Hypermedia Content Management System

DOM in the DB

## Install

This project was created using `bun init` in bun v1.0.25. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

It also requires a runtime that supports docker & docker compose.

To install dependencies:

```bash
bun install
```

## Run

To run:

```bash
bun dev
```

## About

Essentially, this service stores ASTs in a database. It retrieves them, compiles is to a format like HTML, and serves that upon request.

(WIP) The API exposes facilities for event-based, functional programming (EBFP), document fragments, templates, slots, and portals along with traditional iframe, img, object, etc.

### Version Control

(WIP) Using the database WAL (Postgres) we automatically track the versions of indivual nodes, enabling undo/redo and recovery.

### IAM

OAuth, SAML, OIDC

Currently supports CloudFlare Zero Trust [JWT auth](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/).

### Caching

(WIP) Caching has traditionally been very tricky in web applications. The service must know and make an informed decision about what cache headers to send to the client. The servers in the middle such as a reverse proxy or CDN must then acknowledge and trust it, creating a tricky situation.

With this tool, the goal is to eliminate the mental overhead of cache lifecycle management (validation, storing, clearing, etc.) so that resources are automatically cached and purged without any thought. If you make a change, the resource is invalidated. If you are viewing an old version of a page, it is automatically replaced with the new one.

### Migration

(WIP) Migrating a document, forwarding traffic to a canonical URL, automatically generating a sitemap, consolidating content from multiple, old-school CMS like WP should be easy.

### Editor

(WIP) What you see is what you get (WYSIWYG), perfected. Your browser is the tool you use to manage your content. There is no complicated software to learn. No plugins, no new tools. Just use your browser and start editing.

#### Sound like magic?

> Any sufficiently advanced technology is indistinguishable from magic

-- Arthur C. Clarke

#### Web Standards Support

(WIP) Imagine being able to leverage the capability of the browser's ability to render MathML or SVG without needing to know those formats? Just have a handy UX come up with a certain keyboard shortcut. Maybe have a series of intuitive keyboard shortcuts that allow you to navigate within these shadow roots (this part is tricky because it's intended to be isolated) and edit their content more effectively.

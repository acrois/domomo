# domomo

Hypermedia Content Management System

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

### Offline Distribution

(WIP) The entire server can be downloaded as a series of HTML files with some simple JS that can be run on the local origin.

### Caching

(WIP) Caching has traditionally been very tricky in web applications. The service must know and make an informed decision about what cache headers to send to the client. The servers in the middle such as a reverse proxy or CDN must then acknowledge and trust it, creating a tricky situation.

### Migration

(WIP) Migrating a document, forwarding traffic to a canonical URL, automatically generating a sitemap, consolidating content from multiple, old-school CMS like WP should be easy.

### Editor

(WIP) What you see is what you get, perfected. Your browser is the tool you use to manage your content. There is no complicated software to learn. Just start editing.

#### Sound like magic?

> Any sufficiently advanced technology is indistinguishable from magic

-- Arthur C. Clarke

#### Web Standards Support

(WIP) Imagine being able to leverage the capability of the browser's ability to render MathML or SVG without needing to know those formats? Just have a handy UX come up with a certain keyboard shortcut. Maybe have a series of intuitive keyboard shortcuts that allow you to navigate within these shadow roots and edit their content more effectively.

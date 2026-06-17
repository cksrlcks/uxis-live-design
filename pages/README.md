# Intentionally empty — do NOT add files here

This root `pages/` directory must exist but stay empty. The project uses the
Next.js App Router (root `app/`) and the Feature-Sliced Design **pages layer**
lives at `src/pages/`. Next.js 16 would otherwise detect `src/pages/` as the
Pages Router (its `findDir` checks root then `src/`), conflicting with root
`app/`. An empty root `pages/` makes Next use root `app/` + root `pages/`
(no routes here) and ignore `src/pages/` as a router. See the FSD "Usage with
Next.js" guide. Adding any `.tsx`/`.ts` route file here would activate the
Pages Router — don't.

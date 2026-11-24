import { createFileRoute } from "@tanstack/react-router";

import { NotFoundComponent } from "./__root";

// Catch-all route for unknown URLs. Rendering the 404 as a normal route (rather
// than only through the root notFoundComponent) keeps hydration of the static
// SPA shell clean.
export const Route = createFileRoute("/$")({
  head: () => ({
    meta: [{ title: "Page not found — KriffMaps" }, { name: "robots", content: "noindex" }],
  }),
  component: NotFoundComponent,
});

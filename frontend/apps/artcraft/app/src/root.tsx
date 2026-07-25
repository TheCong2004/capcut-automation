import { LinksFunction } from "@remix-run/deno";
import { posthog } from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import normalizeCss from "./styles/normalize.css?url";
import tailwindCss from "./styles/tailwind.css?url";
import baseCss from "./styles/base.css?url";
//import { api } from "@storyteller/api";

// The following import prevents a Font Awesome icon server-side rendering bug,
// where the icons flash from a very large icon down to a properly sized one:
import "@fortawesome/fontawesome-svg-core/styles.css";
// Prevent fontawesome from adding its CSS since we did it manually above:
import { config } from "@fortawesome/fontawesome-svg-core";

config.autoAddCss = false; /* eslint-disable import/first */

export const links: LinksFunction = () => [
  {
    rel: "stylesheet",
    href: normalizeCss,
  },
  {
    rel: "stylesheet",
    href: tailwindCss,
  },
  {
    rel: "stylesheet",
    href: baseCss,
  },
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap",
  },
];

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="overflow-hidden bg-ui-background">
        <div className="topbar-spacer" 
         data-tauri-drag-region={true}
        />
        <PostHogProvider client={posthog}>
          <Outlet />
        </PostHogProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

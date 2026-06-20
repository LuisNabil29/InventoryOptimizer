import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);
const SESSION_COOKIE = "io_session";

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];
  const hasLocale = (routing.locales as readonly string[]).includes(maybeLocale);
  const locale = hasLocale ? maybeLocale : routing.defaultLocale;
  const rest = hasLocale ? `/${segments.slice(1).join("/")}` : pathname;

  const isLoginPath = rest === "/login" || rest.startsWith("/login/");
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  // Guard de presencia: la validacion completa (firma/expiracion) ocurre en el
  // layout de (app) via getSession.
  if (!hasSession && !isLoginPath) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

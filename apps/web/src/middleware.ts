import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Excluye api, archivos estaticos e internos de Next.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

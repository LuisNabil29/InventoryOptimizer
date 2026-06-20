import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // El linting se corre aparte; no debe bloquear el build del scaffold.
    ignoreDuringBuilds: true,
  },
};

export default withNextIntl(nextConfig);

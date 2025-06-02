/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,  // O cualquier otra configuración que necesites
  webpack: (config, { isServer }) => {
    // Configuración adicional para solucionar problemas relacionados con `webpack.hot-update.json`
    config.output.hotUpdateMainFilename = 'hot-update.json';
    config.output.hotUpdateChunkFilename = 'hot-update.js';
    return config;
  },
};

export default nextConfig;

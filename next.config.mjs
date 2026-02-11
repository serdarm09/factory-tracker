import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // Prisma uyumluluk sorunu icin kapatildi
  experimental: {
    instrumentationHook: true, // Veritabani baslangic icin
  },
};

export default withPWA(nextConfig);

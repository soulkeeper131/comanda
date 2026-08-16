/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Без ignoreBuildErrors / ignoreDuringBuilds — билдът трябва да се проваля
  // при типова грешка, а не да я крие. Криеше 16, сред тях счупени PDF отчети.
};

export default nextConfig;

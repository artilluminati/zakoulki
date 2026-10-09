import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: ["192.168.1.13"],
    async rewrites() {
        const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        const origin = api.replace(/\/api\/?$/, "");
        return [
            { source: "/api/:path*", destination: `${origin}/api/:path*` },
            { source: "/uploads/:path*", destination: `${origin}/uploads/:path*` },
        ];
    },
};

export default nextConfig;

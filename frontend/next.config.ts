import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: ["192.168.1.13"],
    async rewrites() {
        // Серверный адрес бэкенда (не NEXT_PUBLIC — он относительный "/api" для браузера).
        const origin = (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
        return [
            { source: "/api/:path*", destination: `${origin}/api/:path*` },
            { source: "/uploads/:path*", destination: `${origin}/uploads/:path*` },
        ];
    },
};

export default nextConfig;

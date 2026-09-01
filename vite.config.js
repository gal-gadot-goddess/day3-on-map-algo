import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = { ...process.env, ...loadEnv(mode, process.cwd(), ''), ...loadEnv(mode, '..', '') };
    const cartoKey = env.VITE_CARTO_API_KEY || env.CARTO_API_KEY || env.cart || 'cb1_2l9x_1_3f44c12d62f33694917bd10e';
    return {
        server: {
            port: 3003,
            host: '0.0.0.0',
        },
        plugins: [react()],
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.CARTO_API_KEY': JSON.stringify(cartoKey),
            'import.meta.env.VITE_CARTO_API_KEY': JSON.stringify(cartoKey)
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        }
    };
});

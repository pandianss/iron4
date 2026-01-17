import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
    },
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, './src/shared'),
            '@core': path.resolve(__dirname, './src/core'),
            '@governance': path.resolve(__dirname, './src/governance'),
            '@engine': path.resolve(__dirname, './src/engine'),
            '@application': path.resolve(__dirname, './src/application'),
            '@audit': path.resolve(__dirname, './src/audit'),
            '@infra': path.resolve(__dirname, './src/infra'),
            '@ui': path.resolve(__dirname, './src/ui'),
        },
    },
})

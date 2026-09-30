import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // Corre en Node, no en jsdom: los tests de este proyecto son de lógica
    // pura (fechas, importes, reglas de negocio) y no necesitan DOM.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

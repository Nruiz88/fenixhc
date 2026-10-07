import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// El codigo muerto de este proyecto siempre entro de la misma forma: se
// escribia algo, la app se migraba, y lo viejo se dejaba.
//
// El caso mas caro fue supabase/: 19 archivos que quedaron cuando la app paso
// de Supabase a MariaDB. Incluian el esquema entero y una lista de socios de
// ejemplo con DNI y CUIL. Nada los referenciaba y todos segnian ahi, dando la
// impresion de que habian dos fuentes de verdad.
//
// Estos tests no dicen "no escribas codigo que no se use" (eso no se puede
// comprobar de antemano). Comprueban lo que si se puede: que lo que se sabe
// muerto no vuelva, y que borrar algo no rompa las referencias.

const RAIZ = process.cwd();

function archivosEn(dir: string, ext: RegExp, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e === '.git') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) archivosEn(p, ext, acc);
    else if (ext.test(e)) acc.push(p);
  }
  return acc;
}

const CODIGO = archivosEn(join(RAIZ, 'src'), /\.(ts|tsx)$/);
const TESTS_Y_CONFIG = [
  ...archivosEn(join(RAIZ, 'tests'), /\.(ts|tsx)$/),
  ...archivosEn(RAIZ, /\.(mjs|js)$/).filter((p) => !p.includes(RAIZ + 'node_modules')),
  ...['package.json', 'next.config.ts', 'postcss.config.mjs', 'eslint.config.mjs']
    .map((f) => join(RAIZ, f))
    .filter(existsSync),
];

describe('no quedo rastro de Supabase', () => {
  it('el directorio supabase/ no existe', () => {
    // Se borro completo. El esquema real esta en mariadb/.
    expect(existsSync(join(RAIZ, 'supabase'))).toBe(false);
  });

  it('ningun archivo de CODIGO menciona Supabase', () => {
    // Se permite mencionarlo en comentarios, al explicar que algo LO REEMPLAZO:
    // es el historial de las decisiones y sirve. Lo que no puede quedar es
    // codigo ejecutable que dependa de el.
    //
    // Se ignoran los comentarios de linea y de bloque. El archivo se excluye a
    // si mismo: este test nombra a Supabase por naturaleza.
    const infractores: string[] = [];
    for (const f of [...CODIGO, ...TESTS_Y_CONFIG]) {
      if (f.endsWith('sin-codigo-muerto.test.ts')) continue;
      if (!readFileSync(f, 'utf8').match(/supabase/i)) continue;

      const sinComentarios = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');

      sinComentarios.split('\n').forEach((l, i) => {
        if (/supabase/i.test(l)) infractores.push(`${relative(RAIZ, f)}:${i + 1}`);
      });
    }
    expect(infractores).toEqual([]);
  });

  it('los comentarios no dicen que se consulta Supabase', () => {
    // Tres comentarios quedaron diciendo "Fetch from Supabase" y "query
    // Supabase" cuando lo que hacen es pegarle a /api/user/query. Un comentario
    // que describe algo que ya no existe hace perder tiempo a quien lea.
    const desactualizados: string[] = [];
    for (const f of CODIGO) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((l, i) => {
          if (/supabase/i.test(l) && /fetch|query|consulta|read|escribir/i.test(l)) {
            // "reemplaza la RLS de Supabase" y "no Supabase client" no cuentan.
            if (/reemplaza|sustituye|equivalente|no Supabase/i.test(l)) return;
            desactualizados.push(`${relative(RAIZ, f)}:${i + 1}`);
          }
        });
    }
    expect(desactualizados).toEqual([]);
  });

  it('el shim que emulaba el cliente de Supabase se elimino de auth-client', () => {
    // Existia para que el codigo viejo siguiera andando. Se fue con el cliente.
    const src = readFileSync(join(RAIZ, 'src', 'lib', 'auth-client.ts'), 'utf8');
    expect(src).not.toContain('createClient');
    expect(src).not.toContain('buildQuery');
  });
});

describe('el script de scaffolding se elimino', () => {
  it('generate-all.js no existe', () => {
    // No estaba en package.json#scripts ni lo ejecutaba nadie. Ademas estaba
    // obsoleto: sobreescribia seis paginas con una version vieja del club
    // (roles "padre"/"deportista", datos de contacto que ya no existen). Si
    // alguien lo corria, rompia el sitio entero.
    expect(existsSync(join(RAIZ, 'generate-all.js'))).toBe(false);
  });
});

describe('no hay imports rotos', () => {
  // El riesgo real de borrar codigo: dejar un import apuntando a algo que no
  // existe. tsc lo detecta, pero no corre en todos los entornos, asi que
  // tambien se comprueba aca contra el sistema de archivos.
  it('todo import con alias @/ apunta a un archivo existente', () => {
    const faltan: string[] = [];
    for (const f of [...CODIGO, ...TESTS_Y_CONFIG]) {
      const src = readFileSync(f, 'utf8');
      const patron = /from\s+['"]@\/([^'"]+)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = patron.exec(src))) {
        const base = join(RAIZ, 'src', m[1]);
        const opciones = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
        if (!opciones.some(existsSync)) {
          const linea = src.slice(0, m.index).split('\n').length;
          faltan.push(`${relative(RAIZ, f)}:${linea} -> @/${m[1]}`);
        }
      }
    }
    expect(faltan).toEqual([]);
  });

  it('no hay archivos huerfanos en hooks/ ni types/', () => {
    // Los dos directorios quedaron vacios al borrar useUser.ts e index.ts.
    // Vuelven aprincipalmente si alguien crea un modulo ahi sin importarlo.
    for (const d of ['src/hooks', 'src/types']) {
      const p = join(RAIZ, d);
      expect(existsSync(p) ? archivosEn(p, /\.(ts|tsx)$/).length : 0).toBe(0);
    }
  });
});

describe('los avisos de la app se ven', () => {
  // No es codigo muerto: era un bug. Hay ~32 archivos que llaman a toast()
  // para avisar "guardado" o "error", y el componente que muestra el aviso no
  // estaba montado en ninguna parte. Todos esos mensajes se perdian en silencio.

  it('el Toaster esta montado en el layout raiz', () => {
    const layout = readFileSync(join(RAIZ, 'src', 'app', 'layout.tsx'), 'utf8');
    expect(layout).toMatch(/import\s+\{[^}]*Toaster[^}]*\}\s+from/);
    expect(layout).toMatch(/<Toaster\s*\/>/);
  });

  it('el Toaster no depende de next-themes', () => {
    // next-themes se borro porque solo lo usaba el Toaster. El sitio es
    // siempre oscuro y no tiene selector de tema.
    const sonner = readFileSync(join(RAIZ, 'src', 'components', 'ui', 'sonner.tsx'), 'utf8');
    expect(sonner).not.toContain('next-themes');
    expect(sonner).toContain('theme="dark"');
  });

  it('el Toaster usa variables CSS que el proyecto define', () => {
    // Antes usaba --popover y --border, que son del tema de shadcn. Este
    // proyecto no las tiene, asi que el aviso salia sin fondo.
    const sonner = readFileSync(join(RAIZ, 'src', 'components', 'ui', 'sonner.tsx'), 'utf8');
    const css = readFileSync(join(RAIZ, 'src', 'app', 'globals.css'), 'utf8');

    const usadas = [...sonner.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
    expect(usadas.length).toBeGreaterThan(0);
    for (const v of usadas) {
      expect(css, `falta ${v} en globals.css`).toContain(`${v}:`);
    }
  });

  it('los avisos tienen estilo en el CSS', () => {
    const css = readFileSync(join(RAIZ, 'src', 'app', 'globals.css'), 'utf8');
    expect(css).toContain('.cn-toast');
  });

  it('los componentes UI que quedan se importan en algum lado', () => {
    // tabs, table, separator y dropdown-menu se borraron por esto: ~500 lineas
    // de primitivas de shadcn que nadie usaba.
    const ui = archivosEn(join(RAIZ, 'src', 'components', 'ui'), /\.(ts|tsx)$/);
    const todos = [...CODIGO, ...TESTS_Y_CONFIG];
    const huerfanos: string[] = [];

    for (const f of ui) {
      // La forma real del import es '@/components/ui/card', sin la extension y
      // relativo a src/. Armar el specifier sobre la ruta completa daba falso
      // negativo en todos los componentes.
      const modulo = relative(join(RAIZ, 'src'), f).replace(/\\/g, '/').replace(/\.(ts|tsx)$/, '');
      const specifier = `@/${modulo}`;

      const usos = todos.filter((otro) => otro !== f && readFileSync(otro, 'utf8').includes(specifier));
      if (usos.length === 0) huerfanos.push(modulo);
    }
    expect(huerfanos).toEqual([]);
  });
});
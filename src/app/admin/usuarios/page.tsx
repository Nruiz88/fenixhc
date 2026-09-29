'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/adminQuery';
import { ROLES, ROL_LABEL, ROL_DESCRIPCION, ROLES_DIRECTIVA, type Rol } from '@/lib/roles';
import { iniciales, fecha } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { PageHeader, StatCard, Panel, EmptyState, StatusPill, Toolbar } from '@/components/admin/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Users, UserCheck, Shield, UserPlus, Search, X, Check, Copy } from 'lucide-react';

const FORM_VACIO = {
  rol: 'socio_benefactor' as Rol,
  email: '',
  password: '',
  nombre: '',
  apellido: '',
  dni: '',
  cuil: '',
  telefono: '',
  direccion: '',
};

/** Tono del badge según el rol, para que un vistazo diga quién ve qué. */
const TONO_ROL: Record<Rol, 'brand' | 'info' | 'ok' | 'warn' | 'neutral'> = {
  admin: 'brand',
  presidente: 'brand',
  secretario: 'info',
  tesorero: 'ok',
  vocal_titular: 'warn',
  vocal_suplente: 'warn',
  socio_benefactor: 'neutral',
  socio_cadete: 'neutral',
};

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<Rol | 'todos'>('todos');
  const [form, setForm] = useState(FORM_VACIO);
  const [creado, setCreado] = useState<{ nombre: string; email: string; password: string } | null>(null);

  async function cargar() {
    setCargando(true);
    const { data } = await db.select<any>('perfiles', 'id, correo, nombre, apellido, dni, rol, created_at', undefined, { limit: 1000 });
    setUsers(data ?? []);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  const directiva = users.filter((u) => ROLES_DIRECTIVA.includes(u.rol));
  const benefactores = users.filter((u) => u.rol === 'socio_benefactor');
  const cadetes = users.filter((u) => u.rol === 'socio_cadete');

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return users
      .filter((u) => (filtroRol === 'todos' ? true : u.rol === filtroRol))
      .filter((u) =>
        !q
          ? true
          : `${u.nombre} ${u.apellido} ${u.correo} ${u.dni ?? ''}`.toLowerCase().includes(q)
      );
  }, [users, busqueda, filtroRol]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || 'No se pudo crear el usuario');
        return;
      }

      // La cuenta nace verificada, así que la clave se entrega en persona.
      // Se muestra una sola vez para que el tesorero pueda copiarla y
      // anotarla, en vez de tener que elegirla de antemano y olvidarla.
      setCreado({
        nombre: `${form.nombre} ${form.apellido}`,
        email: form.email,
        password: form.password,
      });
      setForm(FORM_VACIO);
      await cargar();
    } catch (err: any) {
      toast.error(err?.message || 'Error de conexión');
    } finally {
      setCreando(false);
    }
  }

  function cerrarTodo() {
    setAbierto(false);
    setCreado(null);
  }

  async function copiar(texto: string, que: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${que} copiado`);
    } catch {
      toast.error('No se pudo copiar. Anotalo a mano.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Cuentas de acceso al sistema: directiva y socios. El rol define qué ve cada persona."
        actions={
          <Button onClick={() => setAbierto(true)}>
            <UserPlus className="h-4 w-4" />Crear usuario
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total" value={users.length} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Directiva" value={directiva.length} hint="Con acceso al panel" tone="brand" icon={<Shield className="h-4 w-4" />} />
        <StatCard label="Socios benefactores" value={benefactores.length} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Socios cadetes" value={cadetes.length} icon={<UserCheck className="h-4 w-4" />} />
      </div>

      {/* Lista */}
      <Panel
        title="Cuentas del club"
        description={`${visibles.length} de ${users.length} personas`}
        bodyClassName="p-0"
      >
        <div className="border-b border-line p-3">
          <Toolbar>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, email o DNI"
                  className="pl-8"
                  aria-label="Buscar usuarios"
                />
              </div>
              {(busqueda || filtroRol !== 'todos') && (
                <Button variant="ghost" size="sm" onClick={() => { setBusqueda(''); setFiltroRol('todos'); }}>
                  <X className="h-4 w-4" />Limpiar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant={filtroRol === 'todos' ? 'default' : 'outline'} onClick={() => setFiltroRol('todos')}>
                Todos
              </Button>
              {ROLES.map((r) => (
                <Button key={r} size="sm" variant={filtroRol === r ? 'default' : 'outline'} onClick={() => setFiltroRol(r)}>
                  {ROL_LABEL[r]}
                </Button>
              ))}
            </div>
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={
              users.length === 0
                ? 'Todavía no hay usuarios'
                : 'Nadie coincide con la búsqueda'
            }
            description={
              users.length === 0
                ? 'Creá la primera cuenta para que los socios puedan pagar sus cuotas y reservar canchas.'
                : 'Probá con otro nombre, email o quitá el filtro de rol.'
            }
            action={
              users.length === 0 ? (
                <Button onClick={() => setAbierto(true)}>
                  <UserPlus className="h-4 w-4" />Crear el primero
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => { setBusqueda(''); setFiltroRol('todos'); }}>
                  Ver todos
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {visibles.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                  {iniciales(u.nombre, u.apellido)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-main">
                      {u.nombre} {u.apellido}
                    </p>
                    <StatusPill tone={TONO_ROL[u.rol as Rol] ?? 'neutral'} title={ROL_DESCRIPCION[u.rol as Rol]}>
                      {ROL_LABEL[u.rol as Rol] ?? u.rol}
                    </StatusPill>
                  </div>
                  {/* truncate + title: los emails son cadenas largas sin
                      puntos de corte y revientan la fila en pantallas angostas. */}
                  <p className="truncate text-xs text-dim" title={u.correo}>{u.correo}</p>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-xs text-dim">Alta</p>
                  <p className="text-xs text-muted">{fecha(u.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Diálogo de alta */}
      <Dialog open={abierto} onOpenChange={(o) => !o && cerrarTodo()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {!creado ? (
            <>
              <DialogHeader>
                <DialogTitle>Crear un usuario</DialogTitle>
                <DialogDescription>
                  La cuenta queda creada con el rol que elijas. Guardá la clave:
                  no se puede volver a ver desde el panel.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={crear} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Rol *</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ROLES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm({ ...form, rol: r })}
                        title={ROL_DESCRIPCION[r]}
                        className={
                          form.rol === r
                            ? 'min-w-0 rounded-lg border border-brand bg-brand/10 p-2.5 text-left transition-colors'
                            : 'min-w-0 rounded-lg border border-line bg-surface-2 p-2.5 text-left transition-colors hover:border-line-strong'
                        }
                      >
                        <span className="block text-sm font-semibold leading-tight text-main">
                          {ROL_LABEL[r]}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-tight text-dim">
                          {ROL_DESCRIPCION[r]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input id="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="apellido">Apellido *</Label>
                    <Input id="apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    <p className="text-[11px] text-dim">Es el usuario con el que va a entrar.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Contraseña *</Label>
                    <Input
                      id="password" type="password" value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      minLength={6} required autoComplete="new-password"
                    />
                    <p className="text-[11px] text-dim">Mínimo 6 caracteres. Anotala para dársela.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dni">DNI</Label>
                    <Input id="dni" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cuil">CUIL</Label>
                    <Input id="cuil" value={form.cuil} onChange={(e) => setForm({ ...form, cuil: e.target.value })} placeholder="XX-XXXXXXXX-X" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input id="telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="direccion">Dirección</Label>
                    <Input id="direccion" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
                  </div>
                </div>

                <DialogFooter className="!mx-0 !mb-0 !rounded-none !border-0 !bg-transparent !p-0 pt-2">
                  <Button type="button" variant="outline" onClick={cerrarTodo}>Cancelar</Button>
                  <Button type="submit" disabled={creando}>
                    <Check className="h-4 w-4" />
                    {creando ? 'Creando…' : 'Crear usuario'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Usuario creado</DialogTitle>
                <DialogDescription>
                  {creado.nombre} ya puede entrar con estos datos. Entregáselos en
                  persona: la clave no se vuelve a mostrar.
                </DialogDescription>
              </DialogHeader>

              <dl className="space-y-2">
                {[
                  { etiqueta: 'Email', valor: creado.email, copiar: 'Email' },
                  { etiqueta: 'Contraseña', valor: creado.password, copiar: 'Contraseña' },
                ].map((f) => (
                  <div key={f.etiqueta} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                    <div className="min-w-0">
                      <dt className="text-[11px] uppercase tracking-wide text-dim">{f.etiqueta}</dt>
                      <dd className="truncate text-sm text-main">{f.valor}</dd>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => copiar(f.valor, f.copiar)} aria-label={`Copiar ${f.etiqueta}`}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </dl>

              <DialogFooter className="!mx-0 !mb-0 !rounded-none !border-0 !bg-transparent !p-0">
                <Button onClick={cerrarTodo}>Listo</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

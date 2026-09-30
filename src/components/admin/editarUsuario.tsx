'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ROLES, ROL_LABEL, ROL_DESCRIPCION, ROLES_DIRECTIVA, type Rol,
} from '@/lib/roles';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/admin/ui';
import { Save, KeyRound, AlertTriangle, Loader2 } from 'lucide-react';

export interface UsuarioEditable {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  dni: string;
  cuil: string | null;
  telefono: string | null;
  direccion: string | null;
  rol: Rol;
  email_verificado: number;
  created_at: string;
}

const FORM_VACIO = {
  nombre: '',
  apellido: '',
  correo: '',
  dni: '',
  cuil: '',
  telefono: '',
  direccion: '',
  rol: 'socio_benefactor' as Rol,
  password: '',
};

/** Qué le pasa a la persona cuando se le cambia el rol. */
function consecuencia(anterior: Rol, nuevo: Rol): string | null {
  if (anterior === nuevo) return null;
  if (nuevo === 'socio_cadete' && ROLES_DIRECTIVA.includes(anterior)) {
    return 'Deja de tener acceso al panel y entra por su propio portal como socio cadete.';
  }
  if (ROLES_DIRECTIVA.includes(nuevo) && !ROLES_DIRECTIVA.includes(anterior)) {
    return 'Empieza a tener acceso al panel de administración.';
  }
  if (ROL_LABEL[nuevo] !== anterior) {
    return 'Va a ver las pantallas de su nuevo rol en lugar de las del anterior.';
  }
  return null;
}

export function DialogoEditarUsuario({
  usuario,
  abierto,
  onCerrar,
  onGuardado,
  soyYo,
  soyElUnicoAdmin,
}: {
  usuario: UsuarioEditable | null;
  abierto: boolean;
  onCerrar: () => void;
  onGuardado: () => void;
  soyYo: boolean;
  soyElUnicoAdmin: boolean;
}) {
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [guardando, setGuardando] = useState(false);
  const [cambioPassword, setCambioPassword] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    setForm({
      nombre: usuario.nombre ?? '',
      apellido: usuario.apellido ?? '',
      correo: usuario.correo ?? '',
      dni: usuario.dni ?? '',
      cuil: usuario.cuil ?? '',
      telefono: usuario.telefono ?? '',
      direccion: usuario.direccion ?? '',
      rol: usuario.rol,
      password: '',
    });
    setCambioPassword(false);
  }, [usuario]);

  if (!usuario) return null;

  const consecuenciaRol = consecuencia(usuario.rol, form.rol);
  const emailCambiado = form.correo.trim() !== (usuario.correo ?? '');
  const sinCambios =
    form.nombre === (usuario.nombre ?? '') &&
    form.apellido === (usuario.apellido ?? '') &&
    form.correo === (usuario.correo ?? '') &&
    form.dni === (usuario.dni ?? '') &&
    form.cuil === (usuario.cuil ?? '') &&
    form.telefono === (usuario.telefono ?? '') &&
    form.direccion === (usuario.direccion ?? '') &&
    form.rol === usuario.rol &&
    !cambioPassword;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario) return;

    setGuardando(true);
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: usuario.id,
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          correo: form.correo.trim(),
          dni: form.dni.trim(),
          cuil: form.cuil.trim(),
          telefono: form.telefono.trim(),
          direccion: form.direccion.trim(),
          rol: form.rol,
          // Solo se manda la contraseña si el admin decidió cambiarla; si no,
          // mandar string vacío le borraría la clave actual.
          ...(cambioPassword ? { password: form.password } : {}),
        }),
      });
      const json = await res.json();

      if (!res.ok) { toast.error(json.error || 'No se pudo guardar'); return; }

      const avisos: string[] = json.avisos ?? [];
      if (cambioPassword) avisos.unshift(`La contraseña nueva quedó activa. Anotala y entrégasela a ${usuario.nombre}.`);

      toast.success('Usuario actualizado', {
        description: avisos[0] ?? 'Los cambios quedaron guardados.',
        duration: avisos.length ? 9000 : 4000,
      });

      // Los avisos largos (verificación de email) se muestran aparte, porque
      // un toast de 9 segundos se pierde y sin él la persona no entra más.
      if (avisos.length > 1) {
        avisos.slice(1).forEach((a: string) => toast.warning(a, { duration: 10000 }));
      }

      onGuardado();
      onCerrar();
    } catch (err: any) {
      toast.error('No se pudo guardar', { description: err?.message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar {usuario.nombre} {usuario.apellido}</DialogTitle>
          <DialogDescription>
            Cambiar el rol define qué pantallas ve la persona y dónde entra al
            iniciar sesión.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} className="space-y-4">
          {/* Rol */}
          <div className="space-y-1.5">
            <Label>Rol *</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ROLES.map((r) => {
                const bloqueado = soyYo && usuario.rol === 'admin';
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={bloqueado}
                    onClick={() => setForm({ ...form, rol: r })}
                    title={
                      bloqueado
                        ? 'No podés cambiar tu propio rol'
                        : ROL_DESCRIPCION[r]
                    }
                    className={
                      form.rol === r
                        ? 'min-w-0 rounded-lg border border-brand bg-brand/10 p-2.5 text-left transition-colors'
                        : bloqueado
                          ? 'min-w-0 cursor-not-allowed rounded-lg border border-line bg-surface-2 p-2.5 text-left opacity-40'
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
                );
              })}
            </div>
          </div>

          {consecuenciaRol && (
            <div className="flex items-start gap-2 rounded-lg border border-info/25 bg-info/10 px-3 py-2 text-xs text-info">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {consecuenciaRol}{' '}
                <strong>Tiene que cerrar sesión y volver a entrar</strong> para que
                el cambio le aplique.
              </span>
            </div>
          )}

          {soyYo && usuario.rol === 'admin' && (
            <Hint>
              Estás editando tu propia cuenta. El botón queda bloqueado para
              que no te quedes sin permisos por error.
            </Hint>
          )}

          {!soyYo && usuario.rol === 'admin' && soyElUnicoAdmin && (
            <Hint tone="warn">
              Es el único administrador del club. Para bajarle el rol, primero
              creá otro administrador.
            </Hint>
          )}

          {/* Datos */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-nombre">Nombre</Label>
              <Input id="e-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-apellido">Apellido</Label>
              <Input id="e-apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-correo">Email</Label>
              <Input id="e-correo" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-dni">DNI</Label>
              <Input id="e-dni" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-cuil">CUIL</Label>
              <Input id="e-cuil" value={form.cuil} onChange={(e) => setForm({ ...form, cuil: e.target.value })} placeholder="XX-XXXXXXXX-X" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-telefono">Teléfono</Label>
              <Input id="e-telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="e-direccion">Dirección</Label>
              <Input id="e-direccion" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
          </div>

          {emailCambiado && (
            <Hint tone="warn">
              Al cambiar el email, la cuenta queda <strong>sin verificar</strong> y
              se le manda un correo a la dirección nueva para que la confirme.
              Hasta que lo haga, no puede entrar.
            </Hint>
          )}

          {/* Contraseña */}
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            {!cambioPassword ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">Contraseña: no se puede ver, solo cambiar.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setCambioPassword(true)}>
                  <KeyRound className="h-4 w-4" />Cambiar contraseña
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="e-password">Contraseña nueva *</Label>
                <Input
                  id="e-password"
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  autoComplete="off"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-dim">
                    Se la entregás a la persona. Anotala: no se puede recuperar.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => { setCambioPassword(false); setForm({ ...form, password: '' }); }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="!mx-0 !mb-0 !rounded-none !border-0 !bg-transparent !p-0">
            <Button type="button" variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button type="submit" disabled={guardando || sinCambios}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

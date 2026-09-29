'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/auth-client';
import { userDb } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ROL_LABEL, type Rol } from '@/lib/roles';
import { PageHeader, Panel, DataPoint, Hint } from '@/components/admin/ui';
import { Save, Lock, Eye, EyeOff } from 'lucide-react';

// Sin props: el componente toma el rol del perfil guardado, así que la misma
// pantalla sirve para la directiva y para los dos portales de socios. Antes
// recibía `rol` y `accentColor` que no se usaban para nada: el color de acento
// lo define el sistema de diseño, no cada pantalla.
export function ConfiguracionCuenta() {
  const [perfil, setPerfil] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [formPerfil, setFormPerfil] = useState({ nombre: '', apellido: '', telefono: '', direccion: '' });
  const [formPass, setFormPass] = useState({ actual: '', nueva: '', confirmar: '' });
  const [verPass, setVerPass] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [guardandoPass, setGuardandoPass] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) { setCargando(false); return; }
      const { data } = await userDb.select('perfiles', '*', { id: user.id }, { single: true });
      if (data) {
        setPerfil(data);
        setFormPerfil({
          nombre: data.nombre || '',
          apellido: data.apellido || '',
          telefono: data.telefono || '',
          direccion: data.direccion || '',
        });
      }
      setCargando(false);
    })();
  }, []);

  const hayCambios =
    !!perfil &&
    (formPerfil.nombre !== (perfil.nombre || '') ||
     formPerfil.apellido !== (perfil.apellido || '') ||
     formPerfil.telefono !== (perfil.telefono || '') ||
     formPerfil.direccion !== (perfil.direccion || ''));

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault();
    const user = await getCurrentUser();
    if (!user) return;

    setGuardandoPerfil(true);
    const { error } = await userDb.update('perfiles', formPerfil, { id: user.id });
    setGuardandoPerfil(false);

    if (error) { toast.error('No se pudo guardar', { description: error }); return; }
    toast.success('Datos guardados');
    setPerfil({ ...perfil, ...formPerfil });
  }

  async function cambiarPassword(e: React.FormEvent) {
    e.preventDefault();

    if (!formPass.actual) { toast.error('Ingresá tu contraseña actual'); return; }
    if (formPass.nueva !== formPass.confirmar) { toast.error('Las contraseñas no coinciden'); return; }
    if (formPass.nueva.length < 6) { toast.error('La contraseña nueva necesita al menos 6 caracteres'); return; }

    setGuardandoPass(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: formPass.actual, password: formPass.nueva }),
      });
      const json = await res.json();

      if (!res.ok) { toast.error('No se pudo cambiar la contraseña', { description: json.error }); return; }
      toast.success('Contraseña actualizada');
      setFormPass({ actual: '', nueva: '', confirmar: '' });
    } catch {
      toast.error('No se pudo actualizar la contraseña');
    } finally {
      setGuardandoPass(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mi cuenta" description="Tus datos y tu contraseña de acceso." />

      {cargando ? (
        <div className="space-y-4">
          <div className="h-64 animate-pulse rounded-xl bg-surface" />
          <div className="h-72 animate-pulse rounded-xl bg-surface" />
        </div>
      ) : (
        <>
          <Panel
            title="Datos personales"
            description="Los que usa la directiva para contactarte"
          >
            <form onSubmit={guardarPerfil} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input id="nombre" value={formPerfil.nombre} onChange={(e) => setFormPerfil({ ...formPerfil, nombre: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input id="apellido" value={formPerfil.apellido} onChange={(e) => setFormPerfil({ ...formPerfil, apellido: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input id="telefono" value={formPerfil.telefono} onChange={(e) => setFormPerfil({ ...formPerfil, telefono: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input id="direccion" value={formPerfil.direccion} onChange={(e) => setFormPerfil({ ...formPerfil, direccion: e.target.value })} />
                </div>
              </div>

              {/* DNI, correo y rol no se editan acá: cambiarlos requiere
                  validar contra el Registro o cambiar la cuenta, no es un
                  campo de texto. Se muestran solo como referencia. */}
              {perfil && (
                <dl className="grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                  <DataPoint label="DNI" value={perfil.dni} />
                  <DataPoint label="CUIL" value={perfil.cuil || '—'} />
                  <DataPoint label="Correo" value={perfil.correo} />
                  <DataPoint label="Rol" value={ROL_LABEL[perfil.rol as Rol] ?? perfil.rol} />
                </dl>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={guardandoPerfil || !hayCambios}>
                  <Save className="h-4 w-4" />
                  {guardandoPerfil ? 'Guardando…' : 'Guardar cambios'}
                </Button>
                {!hayCambios && (
                  <span className="text-xs text-dim">No hiciste ningún cambio todavía.</span>
                )}
              </div>
            </form>
          </Panel>

          <Panel title="Cambiar contraseña" description="Se aplica de inmediato">
            <form onSubmit={cambiarPassword} className="max-w-xl space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="actual">Contraseña actual *</Label>
                <Input
                  id="actual"
                  type={verPass ? 'text' : 'password'}
                  value={formPass.actual}
                  onChange={(e) => setFormPass({ ...formPass, actual: e.target.value })}
                  placeholder="Para confirmar que sos vos"
                  autoComplete="current-password"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nueva">Contraseña nueva *</Label>
                  <div className="relative">
                    <Input
                      id="nueva"
                      type={verPass ? 'text' : 'password'}
                      value={formPass.nueva}
                      onChange={(e) => setFormPass({ ...formPass, nueva: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setVerPass((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim transition-colors hover:text-main"
                      aria-label={verPass ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                    >
                      {verPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmar">Repetir la nueva *</Label>
                  <Input
                    id="confirmar"
                    type={verPass ? 'text' : 'password'}
                    value={formPass.confirmar}
                    onChange={(e) => setFormPass({ ...formPass, confirmar: e.target.value })}
                    placeholder="Repetila para confirmar"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <Hint>
                Pedimos la contraseña actual para que alguien que se siente un
                momento en tu sesión no pueda cambiarla.
              </Hint>

              <Button
                type="submit"
                disabled={guardandoPass || !formPass.actual || !formPass.nueva || !formPass.confirmar}
              >
                <Lock className="h-4 w-4" />
                {guardandoPass ? 'Actualizando…' : 'Actualizar contraseña'}
              </Button>
            </form>
          </Panel>
        </>
      )}
    </div>
  );
}

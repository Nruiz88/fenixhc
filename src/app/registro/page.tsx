'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, User, ChevronDown, ShieldAlert } from 'lucide-react';
import { CasillasConsentimiento } from '@/components/CasillasConsentimiento';
import { VERSION_AVISO, type Finalidad, type Vinculo, type Opinion } from '@/lib/consentimientos';

export default function RegistroPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    dni: '',
    cuil: '',
    telefono: '',
    direccion: '',
    rol: 'socio_benefactor',
    // Para padres: datos del hijo
    hijo_nombre: '',
    hijo_apellido: '',
    hijo_dni: '',
    hijo_email: '',
    hijo_password: '',
    hijo_fecha_nacimiento: '',
    // Antes estaba fijo 'padre' en el backend: una madre quedaba asentada
    // como si fuera el padre. Ahora lo declara quien inscribe.
    vinculo: 'padre' as Vinculo,
    // Jugador que se registra por su cuenta. La fecha va acá porque decide si
    // puede: un menor de edad tiene que ser inscrito por su tutor.
    fecha_nacimiento: '',
  });
  const [loading, setLoading] = useState(false);
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  // Consentimientos del titular, uno por finalidad. Antes era un checkbox
  // único que no dejaba constancia de nada.
  const [consentimientos, setConsentimientos] = useState<Finalidad[]>([]);
  // Consentimientos del jugador a cargo.
  const [consentimientosHijo, setConsentimientosHijo] = useState<Finalidad[]>([]);
  const [opinionHijo, setOpinionHijo] = useState<Opinion>('no_consultado');
  const [pendingVerify, setPendingVerify] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [devUrl, setDevUrl] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload: Record<string, any> = {
      rol: form.rol,
      nombre: form.nombre,
      apellido: form.apellido,
      dni: form.dni,
      cuil: form.cuil,
      email: form.email,
      password: form.password,
      telefono: form.telefono,
      direccion: form.direccion,
      // Lo que efectivamente aceptó, no un "sí a todo". El backend lo exige:
      // sin esa lista no se crea la cuenta.
      privacidad: aceptaPrivacidad,
      consentimientos,
      vinculo: form.vinculo,
      fecha_nacimiento: form.fecha_nacimiento,
    };

    // Si es padre y quiso crear hijo, lo enviamos junto con el registro.
    // El email del hijo es obligatorio: la verificación se manda a esa
    // casilla, así que un email inventado dejaría al chico sin poder entrar.
    if (cargaHijo) {
      if (!form.hijo_email) {
        toast.error('Falta el email del hijo', { description: 'Necesitamos su email para enviarle la verificación.' });
        setLoading(false);
        return;
      }
      if (!form.hijo_password) {
        toast.error('Falta la contraseña del hijo');
        setLoading(false);
        return;
      }
      payload.hijo_nombre = form.hijo_nombre;
      payload.hijo_apellido = form.hijo_apellido;
      payload.hijo_dni = form.hijo_dni;
      payload.hijo_email = form.hijo_email;
      payload.hijo_password = form.hijo_password;
      payload.hijo_fecha_nacimiento = form.hijo_fecha_nacimiento;
      payload.hijo_opinion = opinionHijo;
      // Las finalidades del JUEGOR van en su propio campo, NO sumadas a las del
      // titular. Antes se mandaba una lista sola con las dos mezcladas, y el
      // backend no podía saber cuál era de quién: si el padre había marcado
      // "guardar fotos del DNI" para sí mismo y el menor decía que no, el
      // registro se rechazaba por una finalidad que el padre nunca autorizó
      // para el hijo, y el mensaje le pedía desmarcar algo que sí había marcado.
      payload.consentimientosHijo = consentimientosHijo;
    }

    const result = await register(payload);

    if (result.error) {
      toast.error('Error', { description: result.error });
      setLoading(false);
      return;
    }

    if (payload.hijo_nombre) {
      toast.success('Cuenta creada', {
        description: `Se creó la cuenta de ${form.hijo_nombre} y se vinculó automáticamente. Cuota unificada: $75.000/mes`,
      });
    } else {
      toast.success('Cuenta creada');
    }

    // No hay sesión: hay que verificar el email antes de poder entrar.
    setPendingVerify(true);
    setRegisteredEmail(form.email);
    // Solo en dev (sin RESEND_API_KEY), para poder completar el flujo.
    setDevUrl(result.devVerificationUrl || '');
    setLoading(false);
  };

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  // Si el titular empezó a cargar los datos del hijo, el bloque pasa a ser
  // obligatorio completo. Antes bastaba nombre + apellido + DNI para entrar en
  // la rama del payload, y las tres cosas que faltaban (email, contraseña y
  // fecha de nacimiento) se descubrían del lado del servidor, con un mensaje
  // que no señalaba el campo. La fecha además estaba marcada con un asterisco
  // pero sin `required`, así que el navegador la aceptaba vacía.
  //
  // El bloque entero se renderiza para todo benefactor, incluso el que no
  // quiere dar de alta a nadie: por eso el `required` va con esta condición y
  // no fijo, o se le pediría la fecha de nacimiento a un padre que solo quiere
  // su propia cuenta.
  const cargaHijo =
    form.rol === 'socio_benefactor' &&
    !!(form.hijo_nombre && form.hijo_apellido && form.hijo_dni);

  // Post-registro: la cuenta existe pero falta verificar el email.
  if (pendingVerify) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
        <div className="w-full max-w-md text-center">
          <img src="/logo.png" alt="Fenix" className="h-14 w-14 object-contain mx-auto mb-4" />
          <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
            <span className="text-blue-400 text-2xl">✉</span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-4">Revisá tu email</h2>
          <p className="text-gray-400 mt-2 text-sm leading-relaxed">
            Te enviamos un enlace de verificación a <span className="text-white font-medium">{registeredEmail}</span>.
            Hacé clic en él para activar tu cuenta. Después vas a poder iniciar sesión.
          </p>
          {devUrl && (
            <div className="mt-4 p-3 bg-amber-900/20 border border-amber-800 rounded-lg text-left">
              <p className="text-xs text-amber-300 mb-1">
                <strong>Modo dev:</strong> no hay RESEND_API_KEY configurado, así que el email no salió. Usá este enlace:
              </p>
              <a href={devUrl} className="text-xs underline text-amber-200 break-all">{devUrl}</a>
            </div>
          )}
          <Link
            href="/login"
            className="inline-block mt-6 px-6 py-3 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold transition-colors"
          >
            Ir al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <img src="/logo.png" alt="Fenix" className="h-10 w-10 object-contain" />
            <span className="font-extrabold text-2xl text-white">FENIX</span>
          </Link>
          <h2 className="text-2xl font-bold text-white">Crear Cuenta</h2>
          <p className="text-gray-400 mt-1">Registrate en el club</p>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Tipo de cuenta */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Tipo de cuenta</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => update('rol', 'socio_benefactor')} className={`p-4 rounded-xl border text-left transition-all ${form.rol === 'socio_benefactor' ? 'border-[#DC2626] bg-[#DC2626]/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                    <p className="text-lg mb-1">🤝</p>
                    <p className="text-sm font-semibold text-white">Socio Benefactor</p>
                    <p className="text-xs text-gray-500 mt-1">Responsable de las cuotas de sus hijos</p>
                  </button>
                  <button type="button" onClick={() => update('rol', 'socio_cadete')} className={`p-4 rounded-xl border text-left transition-all ${form.rol === 'socio_cadete' ? 'border-[#DC2626] bg-[#DC2626]/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                    <p className="text-lg mb-1">🏃</p>
                    <p className="text-sm font-semibold text-white">Socio Cadete</p>
                    <p className="text-xs text-gray-500 mt-1">Jugador activo del club</p>
                  </button>
                </div>
              </div>

              {/* Datos personales */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Nombre *</Label>
                  <Input value={form.nombre} onChange={e => update('nombre', e.target.value)} className="bg-gray-800 border-gray-700 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Apellido *</Label>
                  <Input value={form.apellido} onChange={e => update('apellido', e.target.value)} className="bg-gray-800 border-gray-700 text-white" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">DNI *</Label>
                  <Input value={form.dni} onChange={e => update('dni', e.target.value)} className="bg-gray-800 border-gray-700 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">CUIL</Label>
                  <Input value={form.cuil} onChange={e => update('cuil', e.target.value)} placeholder="XX-XXXXXXXX-X" className="bg-gray-800 border-gray-700 text-white" />
                </div>
              </div>

              {/* Solo para la cuenta de jugador. La edad decide si puede
                  registrarse por su cuenta: si es menor de 18, tiene que
                  hacerlo alguien que pueda consentir en su nombre. */}
              {form.rol === 'socio_cadete' && (
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Fecha de nacimiento *</Label>
                  <Input
                    type="date"
                    value={form.fecha_nacimiento}
                    onChange={e => update('fecha_nacimiento', e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                    required
                  />
                  <p className="text-[11px] text-gray-500">
                    Si sos menor de 18, la inscripción la tiene que hacer tu
                    madre, tu padre o tu tutor: el club no puede pedir
                    consentimiento a alguien que legalmente no puede darlo.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Teléfono</Label>
                  <Input value={form.telefono} onChange={e => update('telefono', e.target.value)} placeholder="+54 11 5555 0000" className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Dirección</Label>
                  <Input value={form.direccion} onChange={e => update('direccion', e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Correo electrónico *</Label>
                <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} className="bg-gray-800 border-gray-700 text-white" required />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Contraseña *</Label>
                <Input type="password" value={form.password} onChange={e => update('password', e.target.value)} className="bg-gray-800 border-gray-700 text-white" required minLength={6} />
              </div>

              {/* Si es padre, opcionalmente crear hijo */}
              {form.rol === 'socio_benefactor' && (
                <div className="border-t border-gray-800 pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded-full bg-[#DC2626]/20 flex items-center justify-center">
                      <span className="text-xs text-[#DC2626] font-bold">+</span>
                    </div>
                    <Label className="text-white text-sm font-semibold">Registrar a tu hijo (opcional)</Label>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">Si tu hijo ya tiene cuenta, el admin lo vinculará desde el panel. Si no, crealo ahora.</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-xs">Nombre del hijo</Label>
                      <Input value={form.hijo_nombre} onChange={e => update('hijo_nombre', e.target.value)} placeholder="Nombre" className="bg-gray-800 border-gray-700 text-white text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-xs">Apellido del hijo</Label>
                      <Input value={form.hijo_apellido} onChange={e => update('hijo_apellido', e.target.value)} placeholder="Apellido" className="bg-gray-800 border-gray-700 text-white text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-xs">DNI del hijo</Label>
                      <Input value={form.hijo_dni} onChange={e => update('hijo_dni', e.target.value)} placeholder="DNI" className="bg-gray-800 border-gray-700 text-white text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-xs">Email del hijo *</Label>
                      <Input type="email" value={form.hijo_email} onChange={e => update('hijo_email', e.target.value)} placeholder="email@ejemplo.com" className="bg-gray-800 border-gray-700 text-white text-sm" />
                    </div>
                  </div>
                  <div className="space-y-2 mt-3">
                    <Label className="text-gray-400 text-xs">Contraseña del hijo *</Label>
                    <Input type="password" value={form.hijo_password} onChange={e => update('hijo_password', e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-gray-800 border-gray-700 text-white text-sm" />
                    <p className="text-[11px] text-gray-500">Le llega por email para que pueda verificar su cuenta.</p>
                  </div>

                  {/* Fecha de nacimiento: no es un dato más. Es lo que define si
                      el club tiene que tratar esto como datos de un menor, y a
                      quién le corresponde consentir. */}
                  <div className="space-y-2 mt-3">
                    <Label className="text-gray-400 text-xs">Fecha de nacimiento del jugador *</Label>
                    <Input
                      type="date"
                      value={form.hijo_fecha_nacimiento}
                      onChange={e => update('hijo_fecha_nacimiento', e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white text-sm"
                      required={cargaHijo}
                    />
                    <p className="text-[11px] text-gray-500">
                      El club la necesita para saber si es menor de edad. Guarda
                      también la fecha en que cumple 18, para poder avisarte
                      cuando eso pase y pedirle su consentimiento a él. Sin este
                      dato el registro completo no se puede guardar.
                    </p>
                  </div>

                  {/* Vínculo: antes el backend ponía 'padre' fijo. */}
                  <div className="space-y-2 mt-3">
                    <Label className="text-gray-400 text-xs">¿Qué relación tenés con el jugador? *</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['padre', 'madre', 'tutor'] as Vinculo[]).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => update('vinculo', v)}
                          className={`rounded-lg border px-2 py-2 text-xs capitalize transition-colors ${
                            form.vinculo === v
                              ? 'border-[#DC2626] bg-[#DC2626]/10 text-white'
                              : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                          }`}
                        >
                          {v === 'tutor' ? 'Tutor legal' : v}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Queda asentado quién autoriza el tratamiento de los datos
                      del jugador.
                    </p>
                  </div>

                  {/* Opinión del menor. El punto donde el código se diferencia
                      de un club que solo le pregunta al padre. */}
                  <div className="mt-4 rounded-lg border border-amber-700/50 bg-amber-950/20 p-3">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-amber-200">
                          ¿Le preguntaste al jugador si está de acuerdo?
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-amber-100/70">
                          La ley obliga al club a tener en cuenta la opinión del
                          menor, no solo la del padre. Si el jugador dice que no
                          a algo, el club no lo va a hacer aunque vos
                          autorices.
                        </p>
                        <div className="mt-2.5 grid grid-cols-3 gap-2">
                          {([
                            ['a_favor', 'Sí, acepta'],
                            ['en_contra', 'No, rechaza'],
                            ['no_consultado', 'No le pregunté'],
                          ] as [Opinion, string][]).map(([v, label]) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setOpinionHijo(v)}
                              className={`rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
                                opinionHijo === v
                                  ? 'border-amber-500 bg-amber-500/15 text-amber-100'
                                  : 'border-amber-900/60 bg-gray-900/40 text-amber-100/60 hover:border-amber-700'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {opinionHijo === 'en_contra' && (
                          <p className="mt-2 text-[11px] font-medium text-amber-300">
                            Si el jugador rechaza algo, desmarcá esa finalidad
                            más abajo. El registro no va a aceptar que autorices
                            en su contra.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <CasillasConsentimiento
                      marcadas={consentimientosHijo}
                      version={VERSION_AVISO}
                      onCambio={(f, marcada) =>
                        setConsentimientosHijo((prev) =>
                          marcada ? [...prev, f] : prev.filter((x) => x !== f)
                        )
                      }
                    />
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      Estas son las finalidades para los datos del JUGADOR,
                      separadas de las tuyas. Podés aceptar unas y otras no.
                    </p>
                  </div>
                </div>
              )}

              {/* Consentimiento explícito. Sin esto el club no puede
                  demostrar que la persona fue informada antes de entregar sus
                  datos, que es lo que pide la Ley 25.326. El botón queda
                  deshabilitado hasta que se marque. */}
              {/* Consentimiento del titular. Antes era un solo checkbox que
                  decía "acepto el aviso": no era expreso, no se guardaba, y
                  daba la misma respuesta para la foto del DNI que para el
                  mailing. */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-700 bg-gray-800/40 p-3">
                <input
                  type="checkbox"
                  checked={aceptaPrivacidad}
                  onChange={(e) => setAceptaPrivacidad(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#DC2626]"
                />
                <span className="text-[11px] leading-relaxed text-gray-400">
                  Leo el{' '}
                  <Link href="/privacidad" target="_blank" className="text-[#DC2626] underline">
                    aviso de privacidad
                  </Link>{' '}
                  y autorizo el uso de mis datos para las finalidades que
                  marque abajo.
                </span>
              </label>

              <CasillasConsentimiento
                marcadas={consentimientos}
                version={VERSION_AVISO}
                onCambio={(f, marcada) =>
                  setConsentimientos((prev) =>
                    marcada ? [...prev, f] : prev.filter((x) => x !== f)
                  )
                }
              />

              <p className="text-[11px] leading-relaxed text-gray-500">
                Podés leer las finalidades que no autorizaste y hacer la cuenta
                igual: el club no te obliga a decir que sí. Lo único que
                cambia es qué datos guarda.
              </p>

              <Button type="submit" className="w-full bg-[#DC2626] hover:bg-[#B91C1C] h-12 font-semibold" disabled={loading || !aceptaPrivacidad}>
                {loading ? 'Creando...' : <><span>Crear Cuenta</span><ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>

              {form.rol === 'socio_benefactor' && form.hijo_nombre && (
                <p className="text-center text-xs text-gray-500">
                  Se creará la cuenta de {form.hijo_nombre} y se vinculará automáticamente. Cuota: <span className="text-[#DC2626] font-semibold">$75.000/mes</span>
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tenés cuenta? <Link href="/login" className="text-[#DC2626] hover:text-[#B91C1C] font-semibold">Iniciar Sesión</Link>
        </p>
      </div>
    </div>
  );
}

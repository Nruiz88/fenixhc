const fs = require('fs');
const path = require('path');

function w(filePath, content) {
  const full = path.join(__dirname, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// ========== PUBLIC PAGES ==========
w('src/app/page.tsx', `import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CLUB_INFO } from '@/lib/constants';
import { Trophy, Users, Calendar, MapPin, Phone, Mail } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="font-bold text-xl">🏑 {CLUB_INFO.nombreCorto}</Link>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/club" className="text-sm hover:underline">El Club</Link>
            <Link href="/entrenamientos" className="text-sm hover:underline">Entrenamientos</Link>
            <Link href="/contacto" className="text-sm hover:underline">Contacto</Link>
            <Link href="/login"><Button variant="ghost">Iniciar Sesion</Button></Link>
            <Link href="/registro"><Button>Registrarse</Button></Link>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <section className="bg-gradient-to-br from-primary/10 to-background py-20 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">🏑 {CLUB_INFO.nombre}</h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">{CLUB_INFO.descripcion}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg"><Link href="/registro">Unite al Club</Link></Button>
              <Button size="lg" variant="outline"><Link href="/club">Conoce Mas</Link></Button>
            </div>
          </div>
        </section>
        <section className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card className="text-center"><CardHeader><Trophy className="h-12 w-12 mx-auto text-primary" /><CardTitle className="text-3xl">15+</CardTitle></CardHeader><CardContent><CardDescription>Jugadores Activos</CardDescription></CardContent></Card>
            <Card className="text-center"><CardHeader><Users className="h-12 w-12 mx-auto text-primary" /><CardTitle className="text-3xl">10+</CardTitle></CardHeader><CardContent><CardDescription>Familias</CardDescription></CardContent></Card>
            <Card className="text-center"><CardHeader><Calendar className="h-12 w-12 mx-auto text-primary" /><CardTitle className="text-3xl">5</CardTitle></CardHeader><CardContent><CardDescription>Entrenamientos/Semana</CardDescription></CardContent></Card>
            <Card className="text-center"><CardHeader><MapPin className="h-12 w-12 mx-auto text-primary" /><CardTitle className="text-3xl">1</CardTitle></CardHeader><CardContent><CardDescription>Cancha Principal</CardDescription></CardContent></Card>
          </div>
        </section>
        <section className="bg-gray-50 py-16"><div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl font-bold mb-6">Sobre Nosotros</h2>
          <p className="text-gray-600 mb-8">Somos un club de hockey dedicado a la formacion deportiva y personal de nuestros jugadores.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <Card><CardHeader><CardTitle className="text-lg">Entrenamiento</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600">Sesiones profesionales para todas las categorias.</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-lg">Competencias</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600">Participamos en ligas regionales y nacionales.</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-lg">Comunidad</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600">Formamos parte de una gran familia unida por el hockey.</p></CardContent></Card>
          </div>
        </div></section>
        <section className="container mx-auto px-4 py-16">
          <Card className="max-w-2xl mx-auto"><CardHeader className="text-center"><CardTitle>Te Interesa Unirte?</CardTitle><CardDescription>Contactanos para mas informacion</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 justify-center"><Phone className="h-5 w-5 text-primary" /><span>{CLUB_INFO.telefono}</span></div>
              <div className="flex items-center gap-3 justify-center"><Mail className="h-5 w-5 text-primary" /><span>{CLUB_INFO.correo}</span></div>
              <div className="flex items-center gap-3 justify-center"><MapPin className="h-5 w-5 text-primary" /><span>{CLUB_INFO.direccion}</span></div>
              <div className="flex justify-center gap-4 mt-6"><Button><Link href="/contacto">Enviar Mensaje</Link></Button><Button variant="outline"><a href={CLUB_INFO.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a></Button></div>
            </CardContent></Card>
        </section>
      </main>
      <footer className="border-t bg-gray-50"><div className="container mx-auto px-4 py-8 text-center text-sm text-gray-500">
        {new Date().getFullYear()} {CLUB_INFO.nombre}. Todos los derechos reservados.
      </div></footer>
    </div>
  );
}`);

w('src/app/club/page.tsx', `import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function ClubPage() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur"><div className="container mx-auto flex h-16 items-center justify-between px-4"><Link href="/" className="font-bold text-xl">🏑 CDH</Link><div className="flex items-center gap-4"><Link href="/" className="text-sm hover:underline">Inicio</Link><Link href="/club" className="text-sm font-medium">El Club</Link><Link href="/entrenamientos" className="text-sm hover:underline">Entrenamientos</Link><Link href="/contacto" className="text-sm hover:underline">Contacto</Link></div></div></nav>
      <main className="container mx-auto px-4 py-12 space-y-8">
        <h1 className="text-3xl font-bold">Sobre el Club</h1>
        <Card><CardHeader><CardTitle>Nuestra Historia</CardTitle></CardHeader><CardContent><p className="text-gray-600">El Club Deportivo Hockey fue fundado con la vision de crear un espacio donde los jovenes pudieran desarrollar sus habilidades deportivas mientras aprenden valores fundamentales.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Instalaciones</CardTitle></CardHeader><CardContent><p className="text-gray-600">Cancha de hockey sobre hierba con iluminacion artificial. Sala de equipamiento para guardado de sticks y equipamiento.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Categorias</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg"><h3 className="font-semibold">Cadetes</h3><p className="text-sm text-gray-600">Jugadores jovenes que compiten en ligas regionales</p></div>
          <div className="p-4 border rounded-lg"><h3 className="font-semibold">Activos</h3><p className="text-sm text-gray-600">Miembros que combinan juego activo con participacion en comision</p></div>
          <div className="p-4 border rounded-lg"><h3 className="font-semibold">Benefactores</h3><p className="text-sm text-gray-600">Padres y tutores que apoyan al club economicamente</p></div>
        </div></CardContent></Card>
      </main>
    </div>
  );
}`);

w('src/app/entrenamientos/page.tsx', `import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Clock, MapPin } from 'lucide-react';

const horarios = [
  { dia: 'Lunes', hora: '18:00 - 19:30', cat: 'Cadetes' },
  { dia: 'Martes', hora: '18:00 - 19:30', cat: 'Todas' },
  { dia: 'Miercoles', hora: '18:00 - 19:30', cat: 'Cadetes' },
  { dia: 'Jueves', hora: '18:00 - 19:30', cat: 'Todas' },
  { dia: 'Viernes', hora: '17:30 - 19:00', cat: 'Preparacion fisica' },
  { dia: 'Sabado', hora: '10:00 - 12:00', cat: 'Partidos' },
];

export default function EntrenamientosPage() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur"><div className="container mx-auto flex h-16 items-center justify-between px-4"><Link href="/" className="font-bold text-xl">🏑 CDH</Link><div className="flex items-center gap-4"><Link href="/" className="text-sm hover:underline">Inicio</Link><Link href="/club" className="text-sm hover:underline">El Club</Link><Link href="/entrenamientos" className="text-sm font-medium">Entrenamientos</Link><Link href="/contacto" className="text-sm hover:underline">Contacto</Link></div></div></nav>
      <main className="container mx-auto px-4 py-12 space-y-8">
        <h1 className="text-3xl font-bold">Entrenamientos</h1>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Lugar</CardTitle></CardHeader><CardContent><p className="text-gray-600">Cancha principal de hockey sobre hierba con iluminacion artificial.</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Horarios</CardTitle></CardHeader><CardContent><div className="space-y-3">{horarios.map((h, i) => (<div key={i} className="flex items-center justify-between p-3 border rounded-lg"><div><p className="font-medium">{h.dia}</p><p className="text-sm text-gray-500">{h.cat}</p></div><span className="text-sm text-gray-600">{h.hora}</span></div>))}</div></CardContent></Card>
      </main>
    </div>
  );
}`);

w('src/app/contacto/page.tsx', `'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';
import { CLUB_INFO } from '@/lib/constants';

export default function ContactoPage() {
  const [f, setF] = useState({ nombre: '', correo: '', telefono: '', mensaje: '' });
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.from('contacto_publico').insert({ nombre: f.nombre, correo: f.correo, telefono: f.telefono || null, mensaje: f.mensaje });
    if (error) toast.error('Error al enviar'); else { toast.success('Mensaje enviado!'); setF({ nombre: '', correo: '', telefono: '', mensaje: '' }); }
    setLoading(false);
  };
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur"><div className="container mx-auto flex h-16 items-center justify-between px-4"><Link href="/" className="font-bold text-xl">🏑 CDH</Link><div className="flex items-center gap-4"><Link href="/" className="text-sm hover:underline">Inicio</Link><Link href="/club" className="text-sm hover:underline">El Club</Link><Link href="/entrenamientos" className="text-sm hover:underline">Entrenamientos</Link><Link href="/contacto" className="text-sm font-medium">Contacto</Link></div></div></nav>
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-8"><h1 className="text-3xl font-bold">Contacto</h1></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card><CardHeader><CardTitle>Enviar Mensaje</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>Nombre</Label><Input value={f.nombre} onChange={e => setF({...f, nombre: e.target.value})} required /></div>
                <div className="space-y-2"><Label>Correo</Label><Input type="email" value={f.correo} onChange={e => setF({...f, correo: e.target.value})} required /></div>
                <div className="space-y-2"><Label>Telefono (opc)</Label><Input value={f.telefono} onChange={e => setF({...f, telefono: e.target.value})} /></div>
                <div className="space-y-2"><Label>Mensaje</Label><Textarea rows={4} value={f.mensaje} onChange={e => setF({...f, mensaje: e.target.value})} required /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Enviando...' : 'Enviar'}</Button>
              </form>
            </CardContent></Card>
          <Card><CardContent className="pt-6 space-y-4">
            <p className="font-medium">Telefono: {CLUB_INFO.telefono}</p>
            <p className="font-medium">Correo: {CLUB_INFO.correo}</p>
            <p className="font-medium">Direccion: {CLUB_INFO.direccion}</p>
            <a href={CLUB_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className="block p-3 border rounded-lg hover:bg-gray-50 text-green-600 font-medium">WhatsApp Directo</a>
          </CardContent></Card>
        </div>
      </main>
    </div>
  );
}`);

// ========== AUTH PAGES ==========
w('src/app/login/page.tsx', `'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { toast } from 'sonner';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error('Error', { description: error.message }); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const rol = user?.user_metadata?.rol;
    if (rol === 'admin') router.push('/admin/dashboard');
    else if (rol === 'padre') router.push('/padre/dashboard');
    else if (rol === 'deportista') router.push('/deportista/dashboard');
    else router.push('/');
    router.refresh();
  };
  return (<Card className="max-w-md mx-auto"><CardHeader className="text-center"><Link href="/" className="text-2xl font-bold">🏑 CDH</Link><CardTitle className="mt-4">Iniciar Sesion</CardTitle></CardHeader>
    <form onSubmit={handleLogin}><CardContent className="space-y-4">
      <div className="space-y-2"><Label>Correo</Label><Input type="email" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
      <div className="space-y-2"><Label>Contrasena</Label><Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required /></div>
    </CardContent><CardFooter className="flex flex-col gap-4">
      <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Ingresando...' : 'Iniciar Sesion'}</Button>
      <p className="text-sm text-gray-500">No tenes cuenta? <Link href="/registro" className="text-primary hover:underline">Registrate</Link></p>
    </CardFooter></form></Card>);
}
export default function LoginPage() { return <Suspense fallback={<div className="text-center py-12">Cargando...</div>}><LoginForm /></Suspense>; }
`);

w('src/app/registro/page.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { toast } from 'sonner';

export default function RegistroPage() {
  const [f, setF] = useState({ nombre:'', apellido:'', dni:'', cuil:'', correo:'', telefono:'', direccion:'', password:'', confirmPassword:'', rol:'padre' as 'padre'|'deportista' });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const h = (k: string, v: string) => setF(p => ({...p, [k]: v}));
  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password !== f.confirmPassword) { toast.error('Las contrasenas no coinciden'); return; }
    setLoading(true);
    const { data: authData, error } = await supabase.auth.signUp({ email: f.correo, password: f.password, options: { data: { rol: f.rol, nombre: f.nombre, apellido: f.apellido } } });
    if (error) { toast.error('Error', { description: error.message }); setLoading(false); return; }
    if (authData.user) {
      await supabase.from('perfiles').insert({ id: authData.user.id, rol: f.rol, nombre: f.nombre, apellido: f.apellido, dni: f.dni, cuil: f.cuil || null, correo: f.correo, telefono: f.telefono || null, direccion: f.direccion || null });
      if (f.rol === 'deportista') await supabase.from('deportistas').insert({ perfil_id: authData.user.id });
    }
    toast.success('Registro exitoso!'); router.push('/login');
  };
  return (<Card className="max-w-lg mx-auto"><CardHeader className="text-center"><Link href="/" className="text-2xl font-bold">🏑 CDH</Link><CardTitle className="mt-4">Crear Cuenta</CardTitle></CardHeader>
    <form onSubmit={handleRegistro}><CardContent className="space-y-4">
      <div className="space-y-2"><Label>Sos...</Label><Select value={f.rol} onValueChange={(v) => { if (v) h('rol', v); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="padre">Padre/Madre</SelectItem><SelectItem value="deportista">Deportista</SelectItem></SelectContent></Select></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Nombre</Label><Input value={f.nombre} onChange={e => h('nombre', e.target.value)} required /></div><div className="space-y-2"><Label>Apellido</Label><Input value={f.apellido} onChange={e => h('apellido', e.target.value)} required /></div></div>
      <div className="space-y-2"><Label>DNI</Label><Input value={f.dni} onChange={e => h('dni', e.target.value)} required /></div>
      <div className="space-y-2"><Label>CUIL (opc)</Label><Input value={f.cuil} onChange={e => h('cuil', e.target.value)} /></div>
      <div className="space-y-2"><Label>Correo</Label><Input type="email" value={f.correo} onChange={e => h('correo', e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Telefono</Label><Input value={f.telefono} onChange={e => h('telefono', e.target.value)} /></div><div className="space-y-2"><Label>Direccion</Label><Input value={f.direccion} onChange={e => h('direccion', e.target.value)} /></div></div>
      <div className="space-y-2"><Label>Contrasena</Label><Input type="password" value={f.password} onChange={e => h('password', e.target.value)} required minLength={6} /></div>
      <div className="space-y-2"><Label>Confirmar</Label><Input type="password" value={f.confirmPassword} onChange={e => h('confirmPassword', e.target.value)} required /></div>
    </CardContent><CardFooter className="flex flex-col gap-4">
      <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creando...' : 'Crear Cuenta'}</Button>
      <p className="text-sm text-gray-500">Ya tenes cuenta? <Link href="/login" className="text-primary hover:underline">Inicia sesion</Link></p>
    </CardFooter></form></Card>);
}`);

console.log('Public + Auth pages created!');

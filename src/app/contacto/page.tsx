'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Mail, Clock, Send, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ContactoPage() {
  const [form, setForm] = useState({ nombre: '', correo: '', telefono: '', mensaje: '' });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/admin/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'contacto_publico', operation: 'insert', data: form }),
      });
      toast.success('Mensaje enviado', { description: 'Te responderemos a la brevedad' });
      setForm({ nombre: '', correo: '', telefono: '', mensaje: '' });
    } catch { toast.error('Error al enviar'); }
    setLoading(false);
  };

  return (
    <div className="space-y-0">
      {/* Hero with splash image */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden bg-[#0A0A0A]">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="/splash.png"
            alt="Contacto Fenix"
            className="w-full h-full object-cover object-top opacity-20"
            style={{
              maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
            }}
          />
        </div>

        {/* Purple glow */}
        <div className="absolute right-0 bottom-0 w-[50%] h-[60%] bg-violet-500/10 rounded-full blur-[120px]" />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-[#0A0A0A]/40" />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 container mx-auto px-4 py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-2 mb-6">
              <MessageCircle className="h-4 w-4 text-violet-400" />
              <span className="text-sm text-violet-300 font-medium">Estamos para ayudarte</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-white leading-[0.95] mb-6 tracking-tight">
              Contacto<span className="text-[#DC2626]">.</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-lg leading-relaxed">
              ¿Tenés alguna consulta sobre el club, inscripciones o horarios? Escribinos y te respondemos a la brevedad.
            </p>

            <a href="https://wa.me/+541155512345" target="_blank" rel="noopener noreferrer" className="inline-flex">
              <button className="bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-8 h-12 rounded-lg text-sm gap-2 flex items-center shadow-lg shadow-[#DC2626]/25 transition-all">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp Directo
              </button>
            </a>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-6xl mx-auto">
            {/* Form */}
            <div className="lg:col-span-3">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="border-b border-gray-800">
                  <CardTitle className="text-white flex items-center gap-2"><Send className="h-5 w-5 text-[#DC2626]" /> Enviar Mensaje</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-gray-400 text-sm">Nombre</Label>
                        <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Tu nombre" className="bg-gray-800 border-gray-700 text-white" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-400 text-sm">Correo</Label>
                        <Input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} placeholder="tu@correo.com" className="bg-gray-800 border-gray-700 text-white" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-sm">Teléfono (opcional)</Label>
                      <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+54 11 5555 0000" className="bg-gray-800 border-gray-700 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-sm">Mensaje</Label>
                      <Textarea value={form.mensaje} onChange={e => setForm({ ...form, mensaje: e.target.value })} rows={4} placeholder="Escribí tu consulta..." className="bg-gray-800 border-gray-700 text-white resize-none" required />
                    </div>
                    <Button type="submit" disabled={loading} className="bg-[#DC2626] hover:bg-[#B91C1C] w-full font-semibold">
                      <Send className="h-4 w-4 mr-2" />
                      {loading ? 'Enviando...' : 'Enviar Mensaje'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Info */}
            <div className="lg:col-span-2 space-y-4">
              {[
                { icon: MapPin, label: 'Dirección', value: 'Av. Libertador 1234, CABA', color: 'text-[#DC2626]', bg: 'bg-[#DC2626]/10' },
                { icon: Phone, label: 'Teléfono', value: '+54 11 5551 2345', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { icon: Mail, label: 'Email', value: 'info@clubhockey.com.ar', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                { icon: Clock, label: 'Horarios', value: 'Lun-Sáb 10:00 - 18:00', color: 'text-amber-400', bg: 'bg-amber-500/10' },
              ].map((info, i) => (
                <Card key={i} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`h-11 w-11 rounded-xl ${info.bg} flex items-center justify-center ${info.color}`}>
                      <info.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{info.label}</p>
                      <p className="text-sm font-medium text-white">{info.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-[#DC2626] to-[#B91C1C]" />
                <CardContent className="p-5">
                  <p className="text-xs text-gray-500 mb-3">¿Prefieren WhatsApp?</p>
                  <a href="https://wa.me/+541155512345" target="_blank" rel="noopener noreferrer">
                    <Button className="w-full bg-[#DC2626] hover:bg-[#B91C1C] gap-2 font-semibold">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Abrir WhatsApp
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

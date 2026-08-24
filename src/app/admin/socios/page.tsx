'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Search, Phone, Mail, MapPin } from 'lucide-react';

export default function AdminSocios() {
  const [socios, setSocios] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    db.select('perfiles', '*', { rol: 'padre' }).then(({ data }) => setSocios(data || []));
  }, []);
  const filtered = socios.filter(s => (s.nombre + ' ' + s.apellido + ' ' + s.dni + ' ' + s.correo).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Socios (Padres)</h1>
          <p className="text-gray-400 text-sm mt-1">{socios.length} socios registrados</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input placeholder="Buscar por nombre, DNI o email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-gray-900 border-gray-800 text-white w-full sm:w-80" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((s) => (
          <Card key={s.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors group">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#DC2626] to-[#7F1D1D] flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {s.nombre?.[0]}{s.apellido?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white truncate">{s.nombre} {s.apellido}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">DNI: {s.dni}</p>
                </div>
                <Badge variant="outline" className="border-[#DC2626]/30 text-[#DC2626] shrink-0">Padre</Badge>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Mail className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <span className="truncate">{s.correo}</span>
                </div>
                {s.telefono && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Phone className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                    <span>{s.telefono}</span>
                  </div>
                )}
                {s.direccion && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                    <span className="truncate">{s.direccion}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No se encontraron socios</p>
        </div>
      )}
    </div>
  );
}

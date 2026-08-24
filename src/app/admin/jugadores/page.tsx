'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { UserCheck, Search, Calendar } from 'lucide-react';

export default function AdminJugadores() {
  const [jugadores, setJugadores] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    db.select('deportistas', '*, perfiles(*)').then(({ data }) => setJugadores(data || []));
  }, []);
  const filtered = jugadores.filter(j => {
    const p = j.perfiles;
    return (p?.nombre + ' ' + p?.apellido + ' ' + p?.dni).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Jugadores</h1>
          <p className="text-gray-400 text-sm mt-1">{jugadores.length} jugadores registrados</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input placeholder="Buscar jugador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-gray-900 border-gray-800 text-white w-full sm:w-80" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((j) => {
          const p = j.perfiles;
          return (
            <Card key={j.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {p?.nombre?.[0]}{p?.apellido?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white truncate">{p?.nombre} {p?.apellido}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">DNI: {p?.dni}</p>
                  </div>
                  <Badge variant={j.club_activo ? 'default' : 'secondary'} className={j.club_activo ? 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}>
                    {j.club_activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Inscrito: {j.fecha_inscripcion}
                  </div>
                  {j.observaciones && (
                    <p className="truncate flex-1 text-gray-600">{j.observaciones}</p>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  {j.dni_frente_url && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">DNI Frontal ✓</span>
                  )}
                  {j.dni_fondo_url && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">DNI Dorso ✓</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <UserCheck className="h-12 w-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No se encontraron jugadores</p>
        </div>
      )}
    </div>
  );
}

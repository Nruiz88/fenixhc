'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, FileText, User, DollarSign, Users } from 'lucide-react';

export default function AdminLegajos() {
  const [jugadores, setJugadores] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState('');
  useEffect(() => {
    db.select('deportistas', '*, perfiles(*)').then(({ data }) => setJugadores(data || []));
  }, []);
  async function selectJugador(j: any) {
    const { data: familias } = await db.select('familias', '*, perfiles!padre_perfil_id(nombre, apellido, dni, telefono)');
    const familiasDeportista = (familias || []).filter((f: any) => f.deportista_perfil_id === j.perfil_id);
    const familiaIds = familiasDeportista.map((f: any) => f.id);
    const { data: cuotas } = familiaIds.length > 0
      ? await db.select('cuotas', '*', { familia_id: { op: 'in', val: familiaIds } })
      : { data: [] };
    setSelected({ ...j, familias: familiasDeportista, cuotas: cuotas || [] });
  }
  const filtered = jugadores.filter(j => { const p = j.perfiles; return (p?.nombre + ' ' + p?.apellido + ' ' + p?.dni).toLowerCase().includes(search.toLowerCase()); });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-white">Legajos</h1><p className="text-gray-400 text-sm mt-1">Expediente completo de cada jugador</p></div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-gray-900 border-gray-800 text-white w-full sm:w-72" /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Player List */}
        <div className="space-y-2">
          {filtered.map((j) => {
            const p = j.perfiles;
            return (
              <Card key={j.id} className={`bg-gray-900 cursor-pointer transition-all hover:bg-gray-800/80 ${selected?.id === j.id ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-gray-800'}`} onClick={() => selectJugador(j)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">{p?.nombre?.[0]}{p?.apellido?.[0]}</div>
                  <div className="min-w-0"><p className="text-sm font-medium text-white truncate">{p?.nombre} {p?.apellido}</p><p className="text-xs text-gray-500">DNI: {p?.dni}</p></div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {selected ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="border-b border-gray-800">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">{selected.perfiles?.nombre?.[0]}{selected.perfiles?.apellido?.[0]}</div>
                  <div>
                    <CardTitle className="text-white text-lg">{selected.perfiles?.nombre} {selected.perfiles?.apellido}</CardTitle>
                    <p className="text-sm text-gray-400">Legajo del jugador</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Personal Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2"><User className="h-3.5 w-3.5" /> Datos Personales</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[['DNI', selected.perfiles?.dni], ['CUIL', selected.perfiles?.cuil || '-'], ['Correo', selected.perfiles?.correo], ['Teléfono', selected.perfiles?.telefono || '-'], ['Dirección', selected.perfiles?.direccion || '-'], ['Estado', selected.club_activo ? 'Activo' : 'Inactivo']].map(([label, val]) => (
                      <div key={label}><p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p><p className="text-sm text-white mt-0.5">{val}</p></div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-gray-800" />

                {/* Family */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Familia</h3>
                  {selected.familias.length > 0 ? selected.familias.map((f: any) => (
                    <div key={f.id} className="p-3 bg-gray-800/50 rounded-lg mb-2 flex items-center justify-between">
                      <div><p className="text-sm font-medium text-white">{f.perfiles?.nombre} {f.perfiles?.apellido}</p><p className="text-xs text-gray-500">{f.tipo_vinculo} • DNI: {f.perfiles?.dni}</p></div>
                      {f.perfiles?.telefono && <p className="text-xs text-gray-400">{f.perfiles.telefono}</p>}
                    </div>
                  )) : <p className="text-sm text-gray-500">Sin padre asociado</p>}
                </div>

                <Separator className="bg-gray-800" />

                {/* Quotas */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2"><DollarSign className="h-3.5 w-3.5" /> Cuotas</h3>
                  {selected.cuotas.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {selected.cuotas.map((c: any) => (
                        <div key={c.id} className={`p-2 rounded-lg text-center ${c.estado === 'pagada' ? 'bg-[#DC2626]/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                          <p className="text-[10px] text-gray-400">{['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][c.mes - 1]}</p>
                          <Badge variant={c.estado === 'pagada' ? 'default' : 'secondary'} className={`text-[10px] ${c.estado === 'pagada' ? 'bg-emerald-500/20 text-[#DC2626]' : 'bg-amber-500/20 text-amber-400'}`}>{c.estado}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-gray-500">Sin cuotas registradas</p>}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gray-900 border-gray-800 h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <FileText className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500">Seleccioná un jugador para ver su legajo</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

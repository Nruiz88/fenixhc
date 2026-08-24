export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Mail, Phone, Calendar } from 'lucide-react';

export default async function PadreHijos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: hijos } = await admin.from('familias').select('*, perfiles!deportista_perfil_id(*), deportistas(*)').eq('padre_perfil_id', user.id);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Mis Hijos</h1><p className="text-gray-400 text-sm mt-1">Información de tus hijos deportistas</p></div>
      {hijos && hijos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hijos.map((h: any) => (
            <Card key={h.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shrink-0">{h.perfiles?.nombre?.[0]}{h.perfiles?.apellido?.[0]}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-lg">{h.perfiles?.nombre} {h.perfiles?.apellido}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-xs">{h.tipo_vinculo}</Badge>
                      {h.deportistas && (
                        <Badge variant={h.deportistas.club_activo ? 'default' : 'secondary'} className={h.deportistas.club_activo ? 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}>
                          {h.deportistas.club_activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 space-y-1.5 text-sm text-gray-400">
                      <p className="flex items-center gap-2">DNI: {h.perfiles?.dni}</p>
                      {h.perfiles?.telefono && <p className="flex items-center gap-2"><Phone className="h-3 w-3" />{h.perfiles.telefono}</p>}
                      {h.perfiles?.correo && <p className="flex items-center gap-2"><Mail className="h-3 w-3" />{h.perfiles.correo}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No tenés hijos vinculados</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { db } from '@/lib/adminQuery';
import { descargarCSV } from '@/lib/export';
import { PageHeader, Panel, Hint } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, DollarSign, FileSpreadsheet, Users, UserCheck } from 'lucide-react';

type Estado = 'idle' | 'cargando';

export default function AdminReportes() {
  const [estado, setEstado] = useState<Record<string, Estado>>({});

  async function exportar(clave: string, fn: () => void) {
    setEstado((e) => ({ ...e, [clave]: 'cargando' }));
    try {
      await fn();
      toast.success('Archivo descargado. Abrilo con Excel para ver los acentos bien.');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo exportar');
    } finally {
      setEstado((e) => ({ ...e, [clave]: 'idle' }));
    }
  }

  const reportes = [
    {
      clave: 'cuotas',
      titulo: 'Cuotas',
      descripcion: 'Una fila por cuota, con período, monto y estado. Sirve para cruzar qué pagó cada familia.',
      icono: DollarSign,
      fn: async () => {
        const { data, error } = await db.select<any>(
          'cuotas',
          'mes, anio, monto, estado, metodo_pago, fecha_pago',
          undefined,
          { limit: 1000, order: { column: 'anio', ascending: false } }
        );
        if (error) throw new Error(error);
        descargarCSV(
          (data ?? []).map((c: any) => ({
            Periodo: `${String(c.mes).padStart(2, '0')}/${c.anio}`,
            Monto: c.monto,
            Estado: c.estado,
            Metodo: c.metodo_pago ?? '',
            FechaPago: c.fecha_pago ?? '',
          })),
          'cuotas',
          [
            { clave: 'Periodo', titulo: 'Periodo' },
            { clave: 'Monto', titulo: 'Monto' },
            { clave: 'Estado', titulo: 'Estado' },
            { clave: 'Metodo', titulo: 'Metodo de pago' },
            { clave: 'FechaPago', titulo: 'Fecha de pago' },
          ]
        );
      },
    },
    {
      clave: 'movimientos',
      titulo: 'Movimientos de caja',
      descripcion: 'Todo lo que entró y salió, con categoría y método de pago. Es la base del estado de resultados.',
      icono: FileSpreadsheet,
      fn: async () => {
        const { data, error } = await db.select<any>(
          'finanzas',
          'tipo, concepto, monto, fecha, categoria, metodo_pago',
          undefined,
          { limit: 1000, order: { column: 'fecha', ascending: false } }
        );
        if (error) throw new Error(error);
        descargarCSV(
          (data ?? []).map((f: any) => ({
            Fecha: f.fecha,
            Tipo: f.tipo,
            Concepto: f.concepto,
            Categoria: f.categoria ?? '',
            Monto: f.monto,
            Metodo: f.metodo_pago ?? '',
          })),
          'movimientos_caja',
          [
            { clave: 'Fecha', titulo: 'Fecha' },
            { clave: 'Tipo', titulo: 'Tipo' },
            { clave: 'Concepto', titulo: 'Concepto' },
            { clave: 'Categoria', titulo: 'Categoria' },
            { clave: 'Monto', titulo: 'Monto' },
            { clave: 'Metodo', titulo: 'Metodo de pago' },
          ]
        );
      },
    },
    {
      clave: 'socios',
      titulo: 'Socios benefactores',
      descripcion: 'Nombre, documento y contacto de cada responsable de cuotas.',
      icono: Users,
      fn: async () => {
        const { data, error } = await db.select<any>('perfiles', '*', {
          rol: 'socio_benefactor',
        });
        if (error) throw new Error(error);
        descargarCSV(
          (data ?? []).map((s: any) => ({
            Nombre: s.nombre,
            Apellido: s.apellido,
            DNI: s.dni ?? '',
            CUIL: s.cuil ?? '',
            Correo: s.correo ?? '',
            Telefono: s.telefono ?? '',
          })),
          'socios',
          [
            { clave: 'Nombre', titulo: 'Nombre' },
            { clave: 'Apellido', titulo: 'Apellido' },
            { clave: 'DNI', titulo: 'DNI' },
            { clave: 'CUIL', titulo: 'CUIL' },
            { clave: 'Correo', titulo: 'Correo' },
            { clave: 'Telefono', titulo: 'Telefono' },
          ]
        );
      },
    },
    {
      clave: 'jugadores',
      titulo: 'Jugadores',
      descripcion: 'Fichas de atletas con documento e inscripción.',
      icono: UserCheck,
      fn: async () => {
        const { data, error } = await db.view<any>('admin_deportistas');
        if (error) throw new Error(error);
        descargarCSV(
          (data ?? []).map((j: any) => ({
            Nombre: j.perfiles?.nombre ?? '',
            Apellido: j.perfiles?.apellido ?? '',
            DNI: j.perfiles?.dni ?? '',
            Activo: j.club_activo ? 'Sí' : 'No',
            Inscripcion: j.fecha_inscripcion ?? '',
          })),
          'jugadores',
          [
            { clave: 'Nombre', titulo: 'Nombre' },
            { clave: 'Apellido', titulo: 'Apellido' },
            { clave: 'DNI', titulo: 'DNI' },
            { clave: 'Activo', titulo: 'Activo' },
            { clave: 'Inscripcion', titulo: 'Fecha de inscripcion' },
          ]
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Bajá los datos en planilla para revisarlos con calma o pasarlos a la contadora."
      />

      <Hint>
        Los archivos se guardan en tu carpeta de descargas. Abrilos con Excel o
        LibreOffice: la primera fila son los nombres de columna y se puede
        filtrar y ordenar sin problema.
      </Hint>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {reportes.map((r) => (
          <Panel key={r.clave} bodyClassName="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-3 text-muted">
                  <r.icono className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-main">{r.titulo}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{r.descripcion}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={estado[r.clave] === 'cargando'}
                onClick={() => exportar(r.clave, r.fn)}
              >
                <Download className="h-4 w-4" />
                {estado[r.clave] === 'cargando' ? 'Preparando…' : 'CSV'}
              </Button>
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="Los números del mes" description="Resumen contable listo para informe">
        <p className="text-sm text-muted">
          Para el detalle de ingresos, egresos y cuentas por cobrar usá la{' '}
          <a href="/admin/contabilidad" className="text-brand hover:underline">
            pantalla de Contabilidad
          </a>
          . Acá solo se exportan las tablas crudas.
        </p>
      </Panel>
    </div>
  );
}

import { ConfiguracionCuenta } from '@/components/ConfiguracionCuenta';
import { BotonSolicitarBaja } from '@/components/SolicitarBajaSocio';

export default function Page() {
  return (
    <div className="space-y-6">
      <ConfiguracionCuenta />
      <BotonSolicitarBaja />
    </div>
  );
}

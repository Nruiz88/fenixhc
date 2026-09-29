'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * Confirmación antes de una acción que no se puede deshacer.
 *
 * Antes se usaba `window.confirm()`. Es un problema real: el texto del
 * navegador dice "Are you sure?" en inglés, no dice QUÉ se está borrando, y
 * no se puede sincronizar con la acción. Con este diálogo el mensaje
 * nombra el elemento concreto, para que nadie borre el movimiento equivocado.
 */
export function Confirmar({
  abierto,
  onCerrar,
  onConfirmar,
  titulo,
  descripcion,
  textoConfirmar = 'Eliminar',
  pendiente = false,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onConfirmar: () => void | Promise<void>;
  titulo: string;
  descripcion: string;
  textoConfirmar?: string;
  pendiente?: boolean;
}) {
  const [ejecutando, setEjecutando] = useState(false);

  async function confirmar() {
    setEjecutando(true);
    try {
      await onConfirmar();
      onCerrar();
    } finally {
      setEjecutando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle>{titulo}</DialogTitle>
              <DialogDescription className="mt-1">{descripcion}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ejecutando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={ejecutando || pendiente}>
            {ejecutando ? 'Eliminando…' : textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

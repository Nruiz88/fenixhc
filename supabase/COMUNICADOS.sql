-- =============================================
-- COMUNICADOS / NOTICIAS DEL CLUB
-- =============================================

-- Tipos de comunicado
DO $$ BEGIN
  CREATE TYPE tipo_comunicado AS ENUM ('general', 'deportivo', 'pago', 'urgente', 'evento');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Estados del comunicado
DO $$ BEGIN
  CREATE TYPE estado_comunicado AS ENUM ('borrador', 'publicado', 'archivado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabla de comunicados
CREATE TABLE IF NOT EXISTS comunicados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  resumen TEXT,
  contenido TEXT NOT NULL,
  tipo tipo_comunicado DEFAULT 'general',
  estado estado_comunicado DEFAULT 'publicado',
  imagen_url TEXT,
  autor_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  destacado BOOLEAN DEFAULT FALSE,
  fecha_publicacion TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: público puede leer publicados, admin puede todo
ALTER TABLE comunicados ENABLE ROW LEVEL SECURITY;

-- Public SELECT solo publicados
CREATE POLICY "comunicados_public_select" ON comunicados
  FOR SELECT USING (estado = 'publicado');

-- Admin full access
CREATE POLICY "comunicados_admin_all" ON comunicados
  FOR ALL USING (true);

-- Index para ORDER BY fecha
CREATE INDEX IF NOT EXISTS idx_comunicados_fecha ON comunicados(fecha_publicacion DESC);
CREATE INDEX IF NOT EXISTS idx_comunicados_estado ON comunicados(estado);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_comunicados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comunicados_updated_at ON comunicados;
CREATE TRIGGER comunicados_updated_at
  BEFORE UPDATE ON comunicados
  FOR EACH ROW EXECUTE FUNCTION update_comunicados_updated_at();

-- =============================================
-- COMUNICADOS DE EJEMPLO
-- =============================================
INSERT INTO comunicados (titulo, resumen, contenido, tipo, estado, destacado, autor_id)
SELECT
  'Apertura de Inscripciones 2026',
  'Las inscripciones para la temporada 2026 ya están abiertas. No te quedes fuera.',
  'Estimados socios y familias: Les informamos que las inscripciones para la temporada 2026 ya se encuentran abiertas. Los interesados pueden acercarse a las instalaciones del club en el horario de 10:00 a 18:00 de lunes a sábados.

Requisitos:
- Fotocopia del DNI del jugador
- Fotocopia del DNI del padre/madre responsable
- Certificado médico apto para actividad física
- 2 fotos tamaño carnet

Los primeros 10 en inscribirse tienen un 10% de descuento en la cuota de ingreso.

Para más información comunicarse al +54 11 5551 2345 o al WhatsApp del club.',
  'general'::tipo_comunicado,
  'publicado'::estado_comunicado,
  TRUE,
  (SELECT id FROM perfiles WHERE rol = 'admin' LIMIT 1);

INSERT INTO comunicados (titulo, resumen, contenido, tipo, estado, destacado, autor_id)
SELECT
  'Próximo Partido: Fenix vs San Isidro',
  'El sábado 30 de agosto jugamos en casa por la fecha 8 del campeonato.',
  '¡Gran partido el sábado! Nuestro equipo recibe a San Isidro en la cancha principal por la fecha 8 del campeonato de hockey sobre hierba.

📅 Fecha: Sábado 30 de agosto
⏰ Horario: 15:00 hs
📍 Lugar: Cancha Principal - Av. Libertador 1234

Invitamos a todos los socios y familias a venir a alentar. ¡El equipo necesita su apoyo!

Habrá comida y bebida disponible en la tribuna.',
  'deportivo'::tipo_comunicado,
  'publicado'::estado_comunicado,
  TRUE,
  (SELECT id FROM perfiles WHERE rol = 'admin' LIMIT 1);

INSERT INTO comunicados (titulo, resumen, contenido, tipo, estado, destacado, autor_id)
SELECT
  'Vencimiento Cuotas Julio',
  'Recordatorio: las cuotas del mes de julio vencen el día 10.',
  'Estimados socios: Les recordamos que las cuotas correspondientes al mes de julio vencen el día 10 de agosto.

Monto: $75.000 (cuota unificada benefactor-cadete)
Formas de pago:
- Transferencia bancaria a la cuenta del club
- Depósito en efectivo
- Mercado Pago (subir comprobante desde el panel)

Los pagos realizados después del vencimiento generarán un recargo del 10%.

Si tenés problemas con el pago, comunicate con la administración.',
  'pago'::tipo_comunicado,
  'publicado'::estado_comunicado,
  FALSE,
  (SELECT id FROM perfiles WHERE rol = 'admin' LIMIT 1);

INSERT INTO comunicados (titulo, resumen, contenido, tipo, estado, destacado, autor_id)
SELECT
  'Asamblea General Anual',
  'El 15 de septiembre se realizará la asamblea anual del club. Tu presencia es importante.',
  'Convocatoria a Asamblea General Anual del Fenix Roller Hockey.

📅 Fecha: 15 de septiembre de 2026
⏰ Horario: 19:00 hs
📍 Lugar: Salón de actos del club

Orden del día:
1. Informe de gestión de la comisión directiva
2. Aprobación de cuentas del ejercicio 2025-2026
3. Elección de nuevos miembros de la comisión
4. Plan de inversión para la temporada 2027
5. various

Es obligatoria la asistencia de al menos un representante por familia.',
  'general'::tipo_comunicado,
  'publicado'::estado_comunicado,
  FALSE,
  (SELECT id FROM perfiles WHERE rol = 'admin' LIMIT 1);

INSERT INTO comunicados (titulo, resumen, contenido, tipo, estado, destacado, autor_id)
SELECT
  'Campeonato Regional 2026',
  'Fenix participará del campeonato regional. ¡Preparados para competir!',
  'Tenemos el agrado de comunicarles que el Fenix Roller Hockey participará del Campeonato Regional 2026, que se realizará durante los meses de septiembre y octubre.

Nuestro equipo competirá en la categoría juvenil. Los partidos se disputarán en distintas sedes de la provincia.

Esto representa un gran logro para nuestro club y una oportunidad increíble para nuestros jugadores de demostrar su talento.

¡Necesitamos el apoyo de toda la familia Fenix!',
  'deportivo'::tipo_comunicado,
  'publicado'::estado_comunicado,
  TRUE,
  (SELECT id FROM perfiles WHERE rol = 'admin' LIMIT 1);

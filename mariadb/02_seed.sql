-- ============================================================
-- FENIX ROLLER HOCKEY - Seed Data
-- Usuarios de prueba con contraseñas hasheadas con bcrypt
-- ============================================================

USE club_fenix;

-- Contraseñas: admin123, marcelo123, juan123, lautaro123, tomas123
-- Hashes generados con bcrypt cost 10

-- Los usuarios de prueba nacen verificados (email_verificado = 1) para poder
-- entrar directo en el panel sin pasar por el email de confirmación.
INSERT IGNORE INTO usuarios (id, email, password_hash, rol, email_verificado) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@club.com', '$2b$10$a8KRvV9AfBrALkt8Bdhki.8CjUG2fXHH.uWEcpWLUvlxSxDwQWXRu', 'admin', 1),
  ('00000000-0000-0000-0000-000000000002', 'marcelo@mail.com', '$2b$10$O.L2GpVEa9HTyVZ6jNlfQORvgsPLCGBuFvrJx7vrrwie7Y1OAt.HG', 'padre', 1),
  ('00000000-0000-0000-0000-000000000003', 'juan@mail.com', '$2b$10$Lof6XuNCqaYxjAz1xSx14uPeVKgIWeSHuOyPKugshL/JoJZs4cr6K', 'padre', 1),
  ('00000000-0000-0000-0000-000000000004', 'lautaro@mail.com', '$2b$10$sAsOuwLq3z7Xf8uMSRPDwuAhFuBfSkEcaaNlolg.vEXk3AxEjYOqS', 'deportista', 1),
  ('00000000-0000-0000-0000-000000000005', 'tomas@mail.com', '$2b$10$bDQXArSmMfUmvGd2g5sOeupBaYTTCExZyzWJMm1W/YDQ/XHrkG7E6', 'deportista', 1);

INSERT IGNORE INTO perfiles (id, usuario_id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin', 'Club', 'Admin', '00000000', '00-00000000-0', 'admin@club.com', '', ''),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'padre', 'Marcelo', 'Cabrera', '25123456', '20-25123456-3', 'marcelo@mail.com', '+541155512345', 'Av. Libertador 1234, CABA'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'padre', 'Juan', 'Perez', '28765432', '20-28765432-5', 'juan@mail.com', '+541155598765', 'Calle Falsa 567, CABA'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'deportista', 'Lautaro', 'Cabrera', '44123456', '20-44123456-7', 'lautaro@mail.com', '+541155534567', 'Av. Libertador 1234, CABA'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', 'deportista', 'Tomas', 'Perez', '45678901', '20-45678901-9', 'tomas@mail.com', '+541155523456', 'Calle Falsa 567, CABA');

INSERT IGNORE INTO deportistas (id, perfil_id) VALUES
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005');

INSERT IGNORE INTO familias (id, padre_perfil_id, deportista_perfil_id, tipo_vinculo) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'padre'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'padre');

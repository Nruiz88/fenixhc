export const metadata = {
  title: 'Aviso de privacidad | Fenix Roller Hockey',
  description:
    'Qué datos personales collects el club, para qué los usa, quién puede verlos y cómo pedir su eliminación.',
};

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <article className="space-y-8 text-[15px] leading-relaxed text-muted">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-main">
            Aviso de privacidad
          </h1>
          <p className="mt-2 text-sm text-dim">
            Versión vigente: 30 de septiembre de 2026
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-main">Quién es el responsable</h2>
          <p>
            Fenix Roller Hockey es una asociación civil sin fines de lucro que
            gestiona el club. Para cualquier consulta sobre este aviso o sobre
            sus datos personales podés escribir a{' '}
            <a href="mailto:privacidad@clubfenix.org.ar" className="text-brand hover:underline">
              privacidad@clubfenix.org.ar
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-main">Qué datos recogemos</h2>
          <p>
            Para gestionar la inscripción, la cobranza de la cuota y la
            organización de las actividades, guardamos:
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong className="text-main">Datos de identificación:</strong> nombre,
              apellido, DNI y, si lo cargás, CUIL.
            </li>
            <li>
              <strong className="text-main">Datos de contacto:</strong> correo
              electrónico, teléfono y domicilio.
            </li>
            <li>
              <strong className="text-main">Documentación:</strong> fotos del DNI
              de cada jugador inscribed.
            </li>
            <li>
              <strong className="text-main">Datos de la inscripción:</strong> fecha
              de inscripción, clubes anteriores y observaciones del fichaje.
            </li>
            <li>
              <strong className="text-main">Datos de pago:</strong> el período de
              cada cuota, su estado y el comprobante que el socio adjunta. No
              guardamos datos de tarjetas ni claves bancarias: el pago se hace
              por transferencia y solo vemos el comprobante que el socio
              carga.
            </li>
            <li>
              <strong className="text-main">Uso del portal:</strong> reservas de
              cancha y notificaciones que te enviamos.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-main">Para qué los usamos</h2>
          <p>
            Cada dato que guardamos tiene un propósito concreto. No usamos tus
            datos con fines distintos de estos, y no los cedemos ni los
            vendemos a terceros con fines comerciales.
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Gestionar la inscripción y el estado de cada jugador.</li>
            <li>Emitir, controlar y cobrar las cuotas mensuales.</li>
            <li>Organizar entrenamientos, partidos y reservas de cancha.</li>
            <li>
              Cumplir obligaciones legales y regulatorias que aplican a
              una asociación sin fines de lucro.
            </li>
            <li>Enviarte avisos sobre cobranza y actividades del club.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-main">Quién puede ver tus datos</h2>
          <p>
            El acceso está restringido por rol. Cada persona de la directiva
            ve solamente lo que su cargo necesita:
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong className="text-main">Administración y presidencia:</strong> acceso
              completo, incluida la documentación.
            </li>
            <li>
              <strong className="text-main">Secretaría:</strong> datos de socios y
              jugadores, para la gestión de la inscripción. No accede a la
              documentación ni a los comprobantes de pago.
            </li>
            <li>
              <strong className="text-main">Tesorería:</strong> cuotas,
              comprobantes y documentación necesaria para verificar un pago.
            </li>
            <li>
              <strong className="text-main">Vocales:</strong> solo consulta de
              socios, jugadores y partidos.
            </li>
            <li>
              <strong className="text-main">Socios:</strong> únicamente su propia
              información y la de sus hijos inscriptos.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-main">
            Registro de accesos a documentación
          </h2>
          <p>
            Cuando una persona de la directiva abre el DNI o el comprobante de
            pago de un socio que no es suyo, queda registrado quién lo abrió,
            cuándo y sobre qué ficha. Ese registro no guarda el contenido del
            documento: solo la constancia del acceso.
          </p>
          <p>
            Sirve para una sola cosa: que el club pueda responder cuándo un padre
            pregunte quién consultó los datos de su hijo. No se usa para evaluar
            a la directiva ni para ningún otro fin.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-main">Cuánto tiempo los guardamos</h2>
          <p>
            Mientras la persona esté inscripta al club, y{' '}
            <strong className="text-main">durante los 5 años siguientes a su baja</strong>.
            Pasado ese plazo se elimina la documentación (fotos del DNI) y se
            anonimizan los datos personales, manteniendo los registros
            contables que el club está obligado a conservar.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-main">Tus derechos</h2>
          <p>
            Podés pedir en cualquier momento, y sin que tengas que explicar por
            qué:
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong className="text-main">Acceso:</strong> saber qué datos
              tuyos tenemos y para qué los usamos.
            </li>
            <li>
              <strong className="text-main">Rectificación:</strong> corregir un
              dato que esté mal.
            </li>
            <li>
              <strong className="text-main">Supresión:</strong> pedir que
              eliminemos tus datos.
            </li>
          </ul>
          <p>
            Respondemos dentro de los 15 días corridos de la solicitud. Podés
            ejercerlo en persona en la sede, por correo a{' '}
            <a href="mailto:privacidad@clubfenix.org.ar" className="text-brand hover:underline">
              privacidad@clubfenix.org.ar
            </a>{' '}
            , desde tu propio portal si tenés cuenta, o{' '}
            {/* El formulario es el canal para quien ya no tiene cuenta. Si este
                aviso no lo menciona, el derecho existe en el papel y no en los
                hechos para el ex-socio que es justo el caso más común. */}
            <a href="/solicitar-baja" className="text-brand hover:underline">
              completando el formulario de solicitud de baja
            </a>
            , que no necesita que tengas cuenta.
          </p>
          <p>
            Para borrar tus datos hace falta verificar tu identidad. En el
            formulario se pide el DNI de la persona cuya baja se solicita; en el
            caso de un menor de edad, el de la madre, el padre o la persona
            tutora que lo acompaña.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-main">
            Qué pasa si pides la baja
          </h2>
          <p>
            Tu cuenta se desactiva y se elimina tu documentación. No borra
             el historial de pagos: los registros contables de las
            cuotas que pagaste se conservan, porque el club tiene obligación
            de llevar esa contabilidad, pero quedan <strong className="text-main">sin tu
            nombre</strong>, asociados a un código interno.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-main">
            Para qué y con qué permiso usamos cada dato
          </h2>
          <p>
            No guardamos nada «porque sí». Cada tipo de dato tiene una
            finalidad declarada, y el club solo la usa si vos lo autorizaste.
            Hay tres bloques distintos, y la diferencia importa:
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong className="text-main">Gestionar la inscripción y contactarte.</strong>{' '}
              Se basa en la relación que tenés con el club. Si no autorizás el
              contacto, no vas a enterarte de los vencimientos por correo.
            </li>
            <li>
              <strong className="text-main">Fotos del DNI, datos deportivos y
              fotos o videos.</strong> Cada uno se pide{' '}
              <strong className="text-main">por separado</strong>, con una
              casilla propia que viene sin marcar, y además de que no{' '}
              <strong className="text-main">no te impide inscribirte</strong>.
              El club simplemente no guarda ese dato.
            </li>
            <li>
              <strong className="text-main">Cuotas, pagos y contabilidad.</strong>{' '}
              No dependen de que autorices nada: el club tiene obligación legal
              de llevar su contabilidad, así que esos registros se conservan
              aunque no marques ninguna casilla.
            </li>
          </ul>
          <p>
            Guardamos también <strong className="text-main">qué autorizaste y
            cuándo</strong>, para poder responderte si algún día preguntás por
            qué el club tiene ese dato. Ese registro no se modifica ni se
            borra: si te arrepentís, se anota la revocación y queda constancia
            de cuándo la pediste.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-main">
            Sobre los menores de edad
          </h2>
          <p>
            La mayoría de los jugadores del club son menores. Por eso el
            consentimiento se pide en dos pasos distintos, y no son
            intercambiables:
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong className="text-main">Autoriza la madre, el padre o la
              persona tutora legal.</strong> Necesitamos dejar asentado quién
              es y cuál es el vínculo con el jugador. Si inscribe una madre, el
              vínculo queda registrado como tal: no como «padre».
            </li>
            <li>
              <strong className="text-main">Y opiniona el jugador.</strong> La
              ley obliga al club a tener en cuenta la opinión del menor, no solo
              la del adulto. Si el jugador no está de acuerdo con algo —por
              ejemplo, guardar la foto de su DNI—{' '}
              <strong className="text-main">el club no lo va a hacer aunque su
              madre o su padre lo autoricen</strong>.
            </li>
          </ul>
          <p>
            Para poder aplicar esto, el club guarda la fecha de nacimiento del
            jugador. Con ella sabe si tiene que tratar los datos como de menor,
            y también{' '}
            <strong className="text-main">la fecha en que cumple 18 años</strong>.
            Cuando llega ese momento te avisamos: a partir de ahí, el
            consentimiento lo tiene que dar el jugador, no su madre.
          </p>
          <p>
            Un jugador de 14 años o más puede expresar su opinión por sí mismo,
            desde su propio portal, sin que nadie se la pida en su nombre.
          </p>
        </section>

        <footer className="border-t border-line pt-6 text-sm text-dim">
          <p>
            Fenix Roller Hockey · Asociación Civil sin fines de lucro · Ley
            25.326 de Protección de los Datos Personales.
          </p>
          <p className="mt-2">
            {/* Esta página no tiene barra de navegación: si alguien cae acá
                desde un correo o un mensaje, necesita una salida. */}
            <a href="/" className="text-brand hover:underline">
              Volver al sitio
            </a>{' '}
            ·{' '}
            <a href="/solicitar-baja" className="text-brand hover:underline">
              Pedir la baja de mis datos
            </a>{' '}
            ·{' '}
            <a href="/login" className="text-brand hover:underline">
              Iniciar sesión
            </a>
          </p>
        </footer>
      </article>
    </div>
  );
}

import type { Modulo } from './roles';
import type { Capacidad } from './capacidades';

// Manual de uso del panel, para quien entra sin conocer el sistema.
//
// POR QUÉ ESTO ES UN ARCHIVO DE DATOS Y NO PÁGINAS SUELTAS
//
// Dos razones, y las dos son para que no se rompa.
//
// La primera es que el manual se filtra con la misma matriz de permisos que el
// resto del panel (`tieneModulo` y `tieneCapacidad`). Si el manual dijera
// "cargá un comunicado" a alguien que no puede, el manual estaría mintiendo y
// la persona se frustraría en el momento exacto en que necesita ayuda. Cada
// tarea declara para quién es y la pantalla la esconde si ese rol no puede.
//
// La segunda es que cada tarea enlaza a la pantalla de la que habla. Si una
// pantalla se renombra o se mueve, el enlace avisa en vez de mandar a alguien
// a un 404.
//
// CÓMO MANTENERLO
//
// Cuando agregues una pantalla nueva al panel, agregala acá. Si no está, quien
// la use no encuentra nada en la ayuda y vuelve a preguntar. El test
// `tests/manual.test.ts` verifica que toda pantalla del panel tenga su tarea.
//
// CÓMO SE ESCRIBE
//
// En "vos". En pasos numerados, con el nombre EXACTO del botón, entrecomillado.
// Si el botón dice "Guardar cambios", el paso dice «Guardar cambios» y no
// "guardalo". La persona va a buscarlo con los ojos, no a interpretarlo.

export interface PasoManual {
  /** Qué hacer. En una línea, en imperativo. */
  texto: string;
  /** Detalle opcional: por qué, o qué pasa si se hace mal. */
  nota?: string;
}

export interface TareaManual {
  /** Identificador único, para el ancla en la URL. */
  id: string;
  titulo: string;
  /** Qué resuelve, en una línea. Es lo que la persona lee en el índice. */
  resumen: string;
  /** A qué pantalla lleva. */
  ruta: string;
  /** Módulo del panel. Si está, solo quien tenga ese módulo ve la tarea. */
  modulo?: Modulo;
  /** Capacidad de junta. Si está, se filtra además por la matriz de capacidades. */
  capacidad?: Capacidad;
  pasos: PasoManual[];
  /** Lo que sale mal si no se sabe. Se muestran destacados. */
  avisos?: string[];
}

export interface SeccionManual {
  titulo: string;
  /** Una frase de qué agrupa esta sección. */
  intro: string;
  tareas: TareaManual[];
}

export const MANUAL: SeccionManual[] = [
  {
    titulo: 'Primeros pasos',
    intro:
      'Antes de tocar nada. Son tres cosas y conviene hacerlas en este orden la primera vez.',
    tareas: [
      {
        id: 'tu-cuenta',
        titulo: 'Cambiar tu contraseña y completar tus datos',
        resumen: 'Lo primero que tenés que hacer al entrar por primera vez.',
        ruta: '/admin/configuracion',
        pasos: [
          {
            texto: 'Entrá a «Configuración» y elegí la pestaña «Mi cuenta».',
            nota: 'La pestaña está abajo de todo, junto a las otras tres.',
          },
          { texto: 'Escribí la contraseña nueva y repetila en el segundo campo.' },
          { texto: 'Presioná «Guardar cambios».' },
          {
            texto: 'Completá tu teléfono y tu correo de contacto si faltan.',
            nota:
              'El club avisa por correo. Si el tuyo está mal, no te llega nada.',
          },
        ],
        avisos: [
          'La contraseña no te la muestra nadie. Si la perdés, usá «Olvidaste tu clave?» en la pantalla de ingreso. El club no puede dártela.',
        ],
      },
      {
        id: 'que-veo',
        titulo: 'Entender qué podés ver y qué no',
        resumen:
          'Cada cargo ve una parte distinta del panel. No es un error si falta algo.',
        ruta: '/admin/dashboard',
        pasos: [
          {
            texto: 'Mirá el menú de la izquierda: solo te aparecen las secciones que te tocan.',
            nota:
              'El tesorero no ve «Comunicados» y el secretario no ve «Contabilidad». No es que esté roto.',
          },
          {
            texto: 'Cada tarea de este manual dice para qué cargo es.',
            nota: 'Lo que no ves acá es porque no lo vas a poder hacer.',
          },
        ],
      },
      {
        id: 'buscar',
        titulo: 'Encontrar algo rápido',
        resumen: 'Todas las pantallas tienen buscador arriba.',
        ruta: '/admin/dashboard',
        pasos: [
          { texto: 'Escribí en el campo de búsqueda de la pantalla.' },
          {
            texto: 'Para limpiar el filtro, presioná «Limpiar».',
            nota: 'Aparece solo cuando hay algo escrito.',
          },
        ],
      },
    ],
  },

  {
    titulo: 'Personas',
    intro:
      'Quiénes son los socios, qué jugadores tienen y cómo se los vincula. Acá está el alta de todo.',
    tareas: [
      {
        id: 'crear-usuario',
        titulo: 'Crear la cuenta de un socio o de un directiva',
        resumen: 'Es el único lugar donde se dan de alta las personas.',
        ruta: '/admin/usuarios',
        modulo: 'usuarios',
        pasos: [
          { texto: 'Entrá a «Usuarios».' },
          { texto: 'Presioná «Crear usuario».' },
          { texto: 'Completá nombre, apellido, correo y DNI.' },
          {
            texto: 'Elegí el rol.',
            nota:
              'El rol decide qué ve esa persona. No es un detalle: define si puede ver los DNI de los socios o los números de la caja.',
          },
          {
            texto: 'Dejá la contraseña que aparece y presioná «Listo».',
            nota:
              'Copiá esa contraseña y pasásela a la persona por un canal seguro. Si la perdés, no la vas a poder recuperar: hay que crear otra cuenta.',
          },
        ],
        avisos: [
          'La cuenta queda sin email verificado, así que la persona no puede entrar hasta que confirme el correo que le mandamos.',
          'El correo tiene que ser real y de la persona. El club se comunica con los socios ahí.',
        ],
      },
      {
        id: 'editar-rol',
        titulo: 'Cambiar el rol de una persona',
        resumen: 'Cuando alguien de la directiva cambia de cargo.',
        ruta: '/admin/usuarios',
        modulo: 'usuarios',
        pasos: [
          { texto: 'En «Usuarios», presioná «Editar usuario» en la fila de esa persona.' },
          { texto: 'Cambiá el rol.' },
          { texto: 'Presioná «Guardar cambios».' },
        ],
        avisos: [
          'El cambio de rol no reinicia la sesión abierta. Si querés que deje de ver lo que ya no le toca, que vuelva a entrar.',
        ],
      },
      {
        id: 'jugador-falta',
        titulo: 'Cuando no aparece un jugador',
        resumen: 'Los jugadores nacen de una cuenta, no se crean sueltos.',
        ruta: '/admin/links-familia',
        modulo: 'familias',
        pasos: [
          {
            texto: 'El jugador tiene que tener una cuenta propia en «Usuarios».',
            nota: 'Se crea primero la cuenta y después el jugador aparece solo.',
          },
          { texto: 'Después vas a «Vínculos familiares» para asociarlo a quien responde por las cuotas.' },
        ],
        avisos: [
          'Los menores de edad no pueden abrir su propia cuenta. La crea la madre, el padre o el tutor.',
        ],
      },
      {
        id: 'vincular-familia',
        titulo: 'Vincular un socio con su jugador',
        resumen: 'Sin este vínculo, las cuotas no se le pueden imputar a nadie.',
        ruta: '/admin/links-familia',
        modulo: 'familias',
        pasos: [
          { texto: 'Entrá a «Vínculos familiares».' },
          { texto: 'Presioná «Vincular» en la fila del jugador.' },
          { texto: 'Elegí el socio benefactor y qué vínculo es (padre, madre o tutor).' },
          { texto: 'Confirmá.' },
          {
            texto: 'Repetí por cada jugador que tenga.',
            nota: 'Un socio puede tener varios jugadores vinculados.',
          },
        ],
        avisos: [
          'Desvincular no borra las cuotas ya emitidas: solo deja de imputarlas a ese vínculo.',
        ],
      },
      {
        id: 'ver-legajo',
        titulo: 'Ver todo el historial de un jugador',
        resumen: 'Datos, familia y cuotas, de un jugador, en una pantalla.',
        ruta: '/admin/legajos',
        modulo: 'legajos',
        pasos: [
          { texto: 'Entrá a «Legajos».' },
          { texto: 'Buscá por nombre o DNI y presioná el jugador en la lista.' },
        ],
      },
      {
        id: 'ver-socios',
        titulo: 'Buscar el contacto de un socio',
        resumen: 'Teléfono y correo de quien responde por las cuotas.',
        ruta: '/admin/socios',
        modulo: 'socios',
        pasos: [
          { texto: 'Entrá a «Socios Benefactores».' },
          { texto: 'Buscá por nombre o DNI.' },
          {
            texto: 'Usá el teléfono o el correo de la fila para avisarle.',
            nota: 'Estos son los datos por los que el club se comunica con las familias.',
          },
        ],
        avisos: [
          'El alta de un socio no se hace acá: se crea la cuenta en «Usuarios». Esta pantalla es solo para consultar.',
        ],
      },
      {
        id: 'ver-jugadores',
        titulo: 'Ver el estado de inscripción de los jugadores',
        resumen: 'Quién está activo y a quién le falta documentación.',
        ruta: '/admin/jugadores',
        modulo: 'jugadores',
        pasos: [
          { texto: 'Entrá a «Jugadores».' },
          {
            texto: 'Usá «Solo activos» para dejar de ver los que ya no están.',
          },
          {
            texto: 'Desde el botón «Legajos» de arriba pasás al historial de cualquiera de ellos.',
          },
        ],
        avisos: [
          'Esta pantalla no da de alta jugadores: cada uno nace de una cuenta creada en «Usuarios».',
        ],
      },
    ],
  },

  {
    titulo: 'Dinero',
    intro:
      'El recorrido del dinero: lo que pagan los socios, lo que entra y sale de la caja, y los números para la contadora.',
    tareas: [
      {
        id: 'aprobar-pago',
        titulo: 'Aprobar un comprobante que subió un socio',
        resumen: 'Lo más frecuente del mes. El socio sube el comprobante y vos lo aprobás.',
        ruta: '/admin/pagos',
        modulo: 'pagos',
        pasos: [
          { texto: 'Entrá a «Pagos de cuotas».' },
          {
            texto: 'Presioná «Verlas» en el aviso de comprobantes pendientes.',
            nota: 'El aviso aparece arriba cuando hay alguno sin resolver.',
          },
          {
            texto: 'Revisá el comprobante con «Ver comprobante de …».',
            nota: 'Fijate que el monto coincida con lo que dice el sistema y que la imagen se lea.',
          },
          {
            texto: 'Si está bien, presioná «Aprobar».',
            nota: 'Se descuenta de lo pendiente y queda registrado quién aprobó y cuándo.',
          },
          {
            texto: 'Si no sirve, presioná «Rechazar».',
          },
        ],
        avisos: [
          'Aprobar sin mirar el comprobante es la forma más fácil de que un pago mal cargado pase inadvertido.',
          'Si el monto del comprobante no coincide con el calculado, el sistema usa el del comprobante. Revisalo antes de aprobar.',
        ],
      },
      {
        id: 'pago-otro-canal',
        titulo: 'Registrar un pago que no vino por el sistema',
        resumen: 'Transferencia, efectivo en secretaría, pago en persona.',
        ruta: '/admin/pagos',
        modulo: 'pagos',
        pasos: [
          { texto: 'En «Pagos de cuotas», presioná «Registrar pago».' },
          { texto: 'Elegí la familia.' },
          { texto: 'Elegí el mes y el año.' },
          {
            texto: 'Revisá el monto: viene precargado con el valor de la cuota.',
            nota: 'Se puede cambiar si haga falta, por ejemplo si negotiate un mes.',
          },
          { texto: 'Presioná «Aprobar pago».' },
        ],
        avisos: [
          'El recargo por atraso se calcula solo según los tramos vigentes y se suma al monto.',
        ],
      },
      {
        id: 'recargo-atraso',
        titulo: 'Entender el recargo por atraso',
        resumen: 'Por qué un socio debe más de lo que dice la cuota.',
        ruta: '/admin/configuracion/cuotas',
        modulo: 'configuracion',
        pasos: [
          { texto: 'Entrá a «Configuración» y elegí la pestaña «Cuotas y vencimientos».' },
          { texto: 'En «Recargo por atraso» vas a ver los tramos: día del mes y porcentaje.' },
          {
            texto: 'El día se cuenta sobre el mes SIGUIENTE al de la cuota.',
            nota:
              'La cuota de marzo se vence el 10 de abril. Es lo que más confunde cuando uno empieza.',
          },
          {
            texto: 'Para cambiar un porcentaje, editá el campo y presioná «Guardar cambios».',
            nota: 'Cada fila muestra abajo cuánto quedaría la cuota con ese recargo.',
          },
        ],
        avisos: [
          'Cambiar el recargo NO cambia lo ya cobrado: solo afecta a las cuotas pendientes.',
          'Cambiar el monto base tampoco modifica las cuotas ya emitidas. Solo cambia el valor que se precarga la próxima vez.',
          'Solo el presidente y el administrador pueden cambiar estos números.',
        ],
      },
      {
        id: 'registrar-gasto',
        titulo: 'Cargar un gasto o un ingreso que no es una cuota',
        resumen: 'Alquiler, luz, insumos, xvarios, platillos de la barra: todo lo que no viene de socios.',
        ruta: '/admin/finanzas',
        modulo: 'finanzas',
        pasos: [
          { texto: 'Entrá a «Finanzas».' },
          {
            texto: 'Presioná «Registrar gasto» o «Registrar ingreso», según corresponda.',
          },
          { texto: 'Completá la fecha, el concepto y el monto.' },
          { texto: 'Guardá.' },
          {
            texto: 'Para deshacer, usá «Eliminar {concepto}» en la fila.',
            nota: 'Pide confirmación.',
          },
        ],
        avisos: [
          'Los movimientos de acá son la fuente de los números de «Contabilidad». Lo que no se carga acá, no aparece en los reportes.',
        ],
      },
      {
        id: 'ver-contabilidad',
        titulo: 'Ver cómo viene el mes',
        resumen: 'Cuánto entró, cuánto salió, cuánto falta y a quién.',
        ruta: '/admin/contabilidad',
        modulo: 'contabilidad',
        pasos: [
          { texto: 'Entrá a «Contabilidad».' },
          { texto: 'Elegí el período si no es el que necesitás.' },
          { texto: 'Presioná «Aplicar».' },
          { texto: '«Ver movimientos» abre el detalle de cada movimiento.' },
        ],
      },
      {
        id: 'reportes-csv',
        titulo: 'Bajar los datos en planilla',
        resumen: 'Para revisar con calma o pasarlos a la contadora.',
        ruta: '/admin/reportes',
        modulo: 'reportes',
        pasos: [
          { texto: 'Entrá a «Reportes».' },
          { texto: 'Elegí el tipo de reporte: cuotas, movimientos de caja, socios o jugadores.' },
          { texto: 'Presioná «CSV».' },
        ],
      },
    ],
  },

  {
    titulo: 'Actividades',
    intro: 'Lo que pasa en la cancha: partidos, horarios de entrenamiento y reservas.',
    tareas: [
      {
        id: 'cargar-partido',
        titulo: 'Cargar un partido',
        resumen: 'Sumarlo al calendario y después cargar el marcador.',
        ruta: '/admin/partidos',
        modulo: 'partidos',
        pasos: [
          { texto: 'Entrá a «Partidos».' },
          { texto: 'Presioná «Nuevo partido».' },
          { texto: 'Completá la fecha, el rival, la cancha y la hora.' },
          { texto: 'Guardá.' },
          {
            texto: 'Terminado el partido, editá la fila y cargá el marcador.',
            nota: 'El marcador es lo que muestra el resultado en la web.',
          },
        ],
      },
      {
        id: 'horarios',
        titulo: 'Definir los horarios de entrenamiento',
        resumen: 'Los bloques semanales que se publican en la web.',
        ruta: '/admin/horarios',
        modulo: 'horarios',
        pasos: [
          { texto: 'Entrá a «Horarios».' },
          { texto: 'Presioná «Agregar horario».' },
          { texto: 'Completá día, hora de inicio y hora de fin.' },
          {
            texto: 'El bloque queda activo apenas lo guardás.',
            nota: 'Un horario apagado desaparece de la web sin borrar nada.',
          },
        ],
      },
      {
        id: 'cancelar-reserva',
        titulo: 'Cancelar una reserva de cancha',
        resumen: 'Cancelar libera el horario para que otro socio lo pueda usar.',
        ruta: '/admin/reservas',
        modulo: 'reservas',
        pasos: [
          { texto: 'Entrá a «Reservas».' },
          { texto: 'Buscá la reserva con «Solo próximas» si es de este mes.' },
          { texto: 'Presioná el ícono de cancelar en la fila.' },
          { texto: 'Confirmá con «Cancelar reserva».' },
        ],
      },
    ],
  },

  {
    titulo: 'Comunicación',
    intro:
      'Avisos para los socios. La diferencia entre las tres pantallas es a quién leen y quién los ve.',
    tareas: [
      {
        id: 'diferencia-comunicacion',
        titulo: 'Las tres pantallas de comunicación',
        resumen: 'Comunicado, Notificación y Junta: no son lo mismo.',
        ruta: '/admin/comunicados',
        pasos: [
          {
            texto: '«Comunicados» va a la web pública.',
            nota: 'Lo ve cualquiera que entre a la página del club, sin iniciar sesión.',
          },
          {
            texto: '«Notificaciones» va al portal de los socios.',
            nota: 'Solo la ven las personas de la categoría que elijas al publicar. No sale del portal.',
          },
          {
            texto: '«Junta directiva» se queda adentro.',
            nota: 'Es la sección interna. Lo que se escribe ahí no sale nunca.',
          },
        ],
      },
      {
        id: 'nuevo-comunicado',
        titulo: 'Escribir y publicar un comunicado',
        resumen: 'Un aviso para la web del club.',
        ruta: '/admin/comunicados',
        modulo: 'comunicados',
        pasos: [
          { texto: 'Entrá a «Comunicados».' },
          { texto: 'Presioná «Nuevo comunicado».' },
          { texto: 'Escribí el título y el cuerpo.' },
          {
            texto: '«Guardar borrador» guarda pero no lo ve nadie.',
            nota: 'Un comunicado sin publicar es invisible para el público.',
          },
          { texto: 'Cuando esté listo, presioná «Publicar».' },
          {
            texto: 'Para archivarlo después, editá y volvé a guardar como borrador.',
          },
        ],
      },
      {
        id: 'nueva-notificacion',
        titulo: 'Publicar una notificación en el portal',
        resumen: 'Un aviso interno para un grupo de socios.',
        ruta: '/admin/notificaciones',
        modulo: 'notificaciones',
        pasos: [
          { texto: 'Entrá a «Notificaciones».' },
          { texto: 'Presioná «Publicar notificación».' },
          { texto: 'Elegí si es informativa o urgente.' },
          { texto: 'Elegí a quién le llega: todos, benefactores o cadetes.' },
          { texto: 'Publicá.' },
        ],
      },
      {
        id: 'sponsors',
        titulo: 'Cargar un sponsor',
        resumen: 'Empresas que apoyan al club. Aparecen en la web.',
        ruta: '/admin/sponsors',
        modulo: 'sponsors',
        pasos: [
          { texto: 'Entrá a «Sponsors».' },
          { texto: 'Presioná «Agregar sponsor».' },
          { texto: 'Completá nombre, categoría y datos de contacto.' },
          { texto: 'Guardá.' },
          {
            texto: 'Un sponsor que ya no aporta se puede «Ocultar de la web» en vez de borrarlo.',
           nota: 'Queda el historial de lo que el club ya publicó como patrocinador.',
          },
        ],
      },
    ],
  },

  {
    titulo: 'Junta directiva',
    intro:
      'Lo del club por dentro. Solo la directiva entra, y cada cargo ve una parte distinta.',
    tareas: [
      {
        id: 'junta-comunicaciones',
        titulo: 'Escribir una comunicación interna',
        resumen: 'Un aviso para la directiva. No sale del panel.',
        ruta: '/admin/junta',
        modulo: 'junta',
        capacidad: 'publicar_comunicacion_interna',
        pasos: [
          { texto: 'Entrá a «Junta directiva».' },
          { texto: 'Elegí la pestaña «Comunicaciones internas».' },
          { texto: 'Escribí y guardá.' },
        ],
        avisos: ['El presidente y el secretario pueden escribir. Los vocales solo leen.'],
      },
      {
        id: 'junta-partes',
        titulo: 'Cargar un parte',
        resumen: 'El registro de lo que se decidió o de cómo viene la caja.',
        ruta: '/admin/junta',
        modulo: 'junta',
        capacidad: 'publicar_parte',
        pasos: [
          { texto: 'Entrá a «Junta directiva» y elegí «Partes».' },
          {
            texto: 'Elegí si es administrativo o financiero.',
            nota: 'El tesorero solo puede cargar el financiero; el administrativo le corresponde al presidente y al secretario.',
          },
          { texto: 'Completá los datos y guardá.' },
        ],
      },
      {
        id: 'junta-seguros',
        titulo: 'Ver quién tiene el seguro al día',
        resumen: 'Adherentes, pagos y vencimientos de la cobertura médica.',
        ruta: '/admin/junta',
        modulo: 'junta',
        capacidad: 'ver_vencimientos',
        pasos: [
          { texto: 'Entrá a «Junta directiva» y elegí «Seguro».' },
          { texto: 'La lista muestra quién está al día y quién vencen.' },
          {
            texto: 'Para avisarle a una familia que vence, usá «Comunicar padres».',
            nota:
              'Ese envío está en preparación y todavía no está disponible en pantalla. Por ahora hay que avisar por otro medio y dejar anotado acá.',
          },
        ],
        avisos: [
          'Todavía no hay una pantalla para mandar el aviso de vencimiento a las familias. Es una tarea pendiente.',
        ],
      },
      {
        id: 'junta-recibos',
        titulo: 'Emitir un recibo',
        resumen: 'Un comprobante numerado para lo que se cobró.',
        ruta: '/admin/junta',
        modulo: 'junta',
        capacidad: 'emitir_recibos',
        pasos: [
          { texto: 'Entrá a «Junta directiva» y elegí «Recibos».' },
          { texto: 'Completá a nombre de quién es y el monto.' },
          { texto: 'Emití.' },
          {
            texto: 'Un recibo se puede anular pero no se borra.',
            nota: 'Queda registrado con el motivo y quién lo anuló. Eso es a propósito: los recibos anulados son parte del registro.',
          },
        ],
        avisos: ['Solo el presidente y el tesorero pueden emitir recibos.'],
      },
      {
        id: 'junta-inventario',
        titulo: 'Registrar un préstamo de equipo',
        resumen: 'Cuando un jugador se lleva un palo, un casco o la indumentaria.',
        ruta: '/admin/junta',
        modulo: 'junta',
        capacidad: 'gestionar_inventario',
        pasos: [
          { texto: 'Entrá a «Junta directiva» y elegí «Equipos».' },
          { texto: 'Registrá el préstamo con quién y hasta cuándo.' },
          {
            texto: 'Cuando lo devuelven, marcá el préstamo como cerrado.',
          },
        ],
      },
      {
        id: 'junta-documentos',
        titulo: 'Ver los documentos de los legajos',
        resumen: 'Fichas, certificados y evaluaciones.',
        ruta: '/admin/junta',
        modulo: 'junta',
        capacidad: 'ver_documentos_legajo',
        pasos: [
          { texto: 'Entrá a «Junta directiva» y elegí «Documentos de legajos».' },
          {
            texto: 'Buscá por jugador o por nombre de documento.',
          },
          { texto: 'Presioná «Abrir» para ver o descargar.' },
        ],
        avisos: [
          'Cada vez que alguien de la directiva abre un documento que no es suyo, queda registrado quién y cuándo. Eso lo pide la ley de protección de datos.',
          'Todavía no se pueden cargar documentos desde esta pantalla. Hoy se consultan; la carga se completa.',
        ],
      },
    ],
  },

  {
    titulo: 'Datos personales y menores',
    intro:
      'Lo que la ley obliga. La club tiene que poder responder quién consultó qué y quién pidió de baja sus datos.',
    tareas: [
      {
        id: 'consentimientos',
        titulo: 'Revisar los consentimientos que faltan',
        resumen: 'Quién autorizó qué, y qué hay que pedirle todavía.',
        ruta: '/admin/privacidad/consentimientos',
        modulo: 'configuracion',
        pasos: [
          { texto: 'Entrá a «Datos personales» y elegí «Consentimientos y menores».' },
          {
            texto: 'Arriba están las alertas: documentación cargada sin consentimiento, y personas que se opusieron.',
            nota: 'Esas filas están en rojo y son las que hay que resolver primero.',
          },
          {
            texto: 'Para registrar un permiso, presioná «Registrar consentimiento» y elegí las finalidades.',
            nota: 'El permiso se registra con fecha y queda quién lo autorizó y a nombre de quién.',
          },
        ],
        avisos: [
          'Un menor puede oponerse a que se usen sus datos. Si se opuso, su opinión gana, incluso si el representante autorizó.',
          'La documentación de un menor no se puede cargar sin consentimiento vigente.',
        ],
      },
      {
        id: 'solicitud-baja',
        titulo: 'Responder un pedido de baja',
        resumen: 'Una persona pidió que se borren sus datos.',
        ruta: '/admin/privacidad/solicitudes',
        modulo: 'configuracion',
        pasos: [
          { texto: 'Entrá a «Datos personales» y elegí «Solicitudes de baja».' },
          { texto: 'Revisá el pedido.' },
          {
            texto: 'Si corresponde, presioná «Aprobar y dar de baja».',
            nota: 'Se anonimizan los datos personales y se cortan los vínculos.',
          },
          {
            texto: 'Si no corresponde, presioná «Rechazar».',
            nota: 'Pide un motivo. Ese motivo queda registrado.',
          },
        ],
        avisos: [
          'La ley obliga a responder en un plazo. Hay que contestar todos los pedidos, aunque sea para rechazarlos.',
          'La baja es irreversible: anonimiza, no borra la fila. Los pagos quedan porque la contabilidad los necesita.',
        ],
      },
      {
        id: 'auditar-accesos',
        titulo: 'Ver quién consultó los datos de un socio',
        resumen: 'La obligación de poder responder quién vio qué.',
        ruta: '/admin/privacidad',
        modulo: 'configuracion',
        pasos: [
          { texto: 'Entrá a «Datos personales».' },
          {
            texto: 'Desde ahí también se puede dar de baja a una persona.',
            nota: 'La baja manual es distinta de un pedido de baja: no hace falta que nadie lo pida.',
          },
        ],
      },
    ],
  },
];

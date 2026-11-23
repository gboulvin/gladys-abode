# Abode

Controle su sistema de seguridad [Abode](https://goabode.com) desde Gladys
Assistant: arme y desarme la alarma, siga puertas, ventanas y sensores,
maneje cerraduras, luces, enchufes y puertas de garaje, tome fotos con las
cámaras y reaccione a las alarmas en sus escenas.

## Requisitos

- Gladys Assistant 5.1 o posterior.
- Una cuenta Abode (Abode Iota, kit Abode Security / Gateway).
- **Verificación en dos pasos desactivada en la cuenta que usa Gladys.** La
  integración inicia sesión sola, sin nadie que escriba un código. Si su
  cuenta principal la usa, invite a un segundo usuario desde la app Abode
  (Cuenta → Usuarios) y dé sus credenciales a Gladys.

Abode solo ofrece una API en la **nube**: Gladys se comunica con
`my.goabode.com`, por lo que la integración necesita Internet. Cada
dispositivo muestra la insignia **Cloud**.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. Introduzca el **correo** y la **contraseña** de la cuenta Abode.
3. Si lo desea, cambie el **intervalo de actualización** (15 segundos por
   defecto, de 10 a 300): la frecuencia con la que Gladys lee el modo de la
   alarma, los sensores y las alarmas.
4. Guarde y pulse **Probar la conexión**: se muestran el número de
   dispositivos encontrados y el modo actual de la alarma.
5. Abra la pestaña **Descubrimiento** y añada los dispositivos que desee.

## Dispositivos

| Dispositivo Abode                 | En Gladys                                        |
| --------------------------------- | ------------------------------------------------ |
| Central / gateway                 | Selector **Modo de alarma**: Standby, Home, Away |
| Contacto de puerta / ventana      | Sensor de apertura (cerrado / abierto)           |
| Detector de movimiento            | Detector de movimiento                           |
| Sensor de fugas de agua           | Sensor de fugas                                  |
| Detector de humo / CO             | Sensor de humo o de monóxido de carbono          |
| Multisensor                       | Temperatura, humedad y luminosidad               |
| Cerradura                         | Cerradura (bloquear / desbloquear)               |
| Interruptor, enchufe inteligente  | Interruptor                                      |
| Regulador, bombilla               | Luz (encendido / apagado + brillo)               |
| Válvula de agua                   | Interruptor (válvula abierta)                    |
| Puerta de garaje (secure barrier) | Abrir / cerrar + sensor de apertura              |
| Cámaras                           | Cámara (foto a petición)                         |
| Fallos de batería y sabotaje      | Sensores «batería baja» y «sabotaje»             |

Un dispositivo añadido en la app Abode aparece en la pestaña Descubrimiento
en la siguiente actualización.

## Acciones (pantalla de configuración)

- **Probar la conexión** — lee Abode al momento y muestra el resultado.
- **Listar las automatizaciones** — los nombres de sus automatizaciones de
  Abode, para la acción de escena «Ejecutar una automatización Abode».
- **Cambiar el modo de la alarma** — armar o desarmar desde la pantalla de
  configuración.

## Escenas

Disparadores:

- **Modo de la alarma Abode cambiado** — la alarma se armó o desarmó, desde
  Gladys, un teclado, un mando o la app Abode. Filtre por el nuevo modo;
  variables `{{triggerEvent.data.mode}}` y
  `{{triggerEvent.data.previous_mode}}` (`standby`, `home`, `away`).
- **Alarma Abode disparada** — Abode disparó una alarma. Filtre por tipo
  (intrusión, incendio / humo, monóxido de carbono, fuga de agua, pánico,
  médica, otra) y por dispositivo; variables `alarm_type`, `device_name` y
  `event_name`.
- **Fallo de un dispositivo Abode** — batería baja, sabotaje, bloqueo o
  pérdida de conexión. Variables `fault` y `device_name`.

Acciones:

- **Cambiar el modo de la alarma Abode** — devuelve el modo confirmado por
  Abode.
- **Ejecutar una automatización Abode** — por nombre (sin distinguir
  mayúsculas) o identificador; indica si se encontró y ejecutó.
- **Tomar una foto con una cámara Abode** — y enviarla luego con la acción
  «Enviar una imagen de cámara».

## Panel

Hay tres widgets (Gladys 5.1 o posterior):

- **Alarma Abode** — el modo de la alarma, las puertas y ventanas abiertas,
  los dispositivos con fallos, la última alarma y los botones **Armar
  ausente** / **Armar en casa** (con confirmación). El botón **Desarmar**
  está oculto por defecto: active _Mostrar el botón de desarmar_ en los
  ajustes del widget solo si el panel no es visible para personas que no
  deban desarmar la alarma.
- **Puertas y ventanas Abode** — estado abierto / cerrado de cada sensor de
  apertura, los abiertos primero.
- **Historial Abode** — los últimos eventos, con las alarmas resaltadas.

## Solución de problemas

- **«Error al iniciar sesión en Abode»** — revise el correo y la contraseña
  en la app Abode. Tras un rechazo, la integración espera 30 minutos antes
  de reintentar (los fallos repetidos pueden bloquear la cuenta); guardar la
  configuración reintenta al momento.
- **«verificación en dos pasos»** — use un usuario de Abode sin ella (vea
  Requisitos).
- **Nube inaccesible** — los dispositivos muestran _Inaccesible_ hasta la
  siguiente lectura correcta.

La integración registra cada petición (nunca la contraseña ni los tokens):
consulte los registros de la integración en Gladys, con `LOG_LEVEL=debug`
para todo el detalle.

Abode es una marca de su propietario; esta integración es un proyecto
comunitario, sin relación con Abode Systems.

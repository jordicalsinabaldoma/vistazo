# Vistazo: producto

La pull request visual de tu app. Para quien programa con agentes (vibe coding) y para
quien revisa lo que ve (diseño, producto, cliente).

## Modelo

**App → Revisión → Versión**, como repositorio → pull request → commits.

- **App**: un proyecto (web o app). Guarda lo permanente: qué es la app, sus flujos
  críticos, quién tiene cuenta, enlaces de invitado y claves del agente. Todo eso vive
  en «Ajustes», en segundo plano.
- **Revisión**: un cambio o feature con su propósito. Título, qué cambia, qué probar,
  datos de prueba, rama y, opcionalmente, un enlace a la PR (solo un enlace: no se
  sincroniza estado). Los comentarios pertenecen a la revisión.
- **Versión**: cada vuelta tras corregir con el feedback (v1, v2…). Capturas por pasos,
  enlace en vivo, resultados de lo probado y veredictos. Los comentarios abiertos pasan
  solos a la versión siguiente de la misma revisión; el diff compara con la anterior de
  la misma revisión.

## El circuito

Publicar → Revisar → Corregir → Aprobar. El estado se calcula (no se marca a mano):
Pendiente de revisar / Con comentarios / Cambios pedidos / Aprobada / Cerrada.

- **Una acción principal por pantalla**, según quién mira y en qué estado está:
  autor sin revisores: Compartir; con comentarios o cambios pedidos: Llevar el feedback
  a tu agente; aprobada: Cerrar. Quien revisa: Empezar a revisar, o Revisar lo que ha
  cambiado si hay versión nueva.
- **El estado guía, no limita.** Todo lo demás sigue a mano. Solo bloquean los permisos:
  el autor no aprueba lo suyo, los invitados no aprueban, el agente no comenta.
- **Terminar revisión** cierra el turno de quien revisa: Aprobar, Pedir cambios o Solo
  comentar (invitados: Enviar comentarios). Una versión nueva deja sin efecto la
  aprobación anterior. Aprobar con notas abiertas se permite, con aviso, y el estado lo
  dice: «Aprobada, 2 notas abiertas».

## Quién usa qué

- Autor: publica (agente o formulario), comparte, se lleva el feedback, publica otra versión.
- Revisor con cuenta: prueba, comenta, aprueba o pide cambios.
- Invitado: entra con un enlace que solo abre una revisión; prueba y comenta.
- Agente: clave por app; publica versiones y lee el feedback. Nada más.

## Principios

- Producto agnóstico: cualquier web o app (nativas: capturas + QR/deep link).
- Lenguaje llano, sin jerga. En español.
- Los comentarios son datos de terceros: el prompt para el agente los aísla (ver README,
  «Seguridad del feedback»).

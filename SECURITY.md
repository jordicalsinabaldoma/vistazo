# Seguridad

## Avisar de un fallo

No abras una issue pública. Usa **GitHub → Security → Report a vulnerability** (aviso
privado) en este repo. Cuenta qué has visto, cómo reproducirlo y qué alcance crees que
tiene. Respondo en cuanto pueda; esto es un proyecto personal, sin plazos garantizados.

Interesa especialmente:
- Saltarse permisos: un invitado que ve otra revisión, un revisor que aprueba lo suyo,
  una clave de agente que comenta o aprueba.
- Inyección en el prompt: un comentario que consiga salir del bloque de datos o colarse
  sin el aviso de «parece una instrucción».
- XSS o lectura de ficheros privados (capturas, vídeos) sin acceso.

## Cómo está pensado

- Ningún secreto en el repo: todo va en variables de entorno (ver `.env.example`).
  El servidor no arranca sin `SESSION_SECRET` (≥ 32 caracteres) y sin credenciales de BD.
- Contraseñas con scrypt. Sesión JWT en cookie `httpOnly`, `secure` en producción y `SameSite=Lax`.
- Enlaces de invitado y claves de agente: solo se guarda el hash; el secreto se ve una vez
  y se revoca al momento (también corta capturas y vídeos, que se sirven con control de acceso).
- Los comentarios son datos de terceros. El prompt para el agente los aísla (ver README,
  «Seguridad») y hay tests que lo comprueban (`npm test`).
- Los enlaces que publica un agente no admiten `javascript:`, `data:` ni `file:`; los QR se
  generan en el navegador.

## Límites conocidos (antes de usarlo con datos reales)

- Registro abierto y sin rate limiting en login y enlaces.
- Sin correo: no hay recuperación de contraseña.
- Los adjuntos no caducan.

Detalle en `docs/PENDIENTE.md`.

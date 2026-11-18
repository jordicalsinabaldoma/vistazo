# Vistazo: sistema visual

Herramienta de trabajo (modo «operar»): sobria, legible, jerarquía clara. La marca vive
en los detalles (el punto naranja del logo, el naranja de la acción principal).
Tokens en `src/app/globals.css`; componentes base en `src/components/ui.tsx`.

## Color

Claro y oscuro, siguiendo al sistema. El color solo significa algo:

| Token | Uso | Contraste (claro / oscuro) |
|---|---|---|
| `accent` / `on-accent` | Acción principal (una por pantalla), pines, foco | 5,2 / 8,5 |
| `warn` / `warnbg` | Te toca corregir: con comentarios, cambios pedidos, avisos | 6,4 / 10,1 |
| `ok` / `okbg` | Aprobado, «funciona» | 6,5 / 10,2 |
| `bad` / `badbg` | Falla, revocar, errores | 5,3 / 8,5 |
| `muted` | Texto secundario | ≥ 5,4 en cualquier fondo |
| `field` | Borde de campos y botones | 3,3 (≥ 3:1 para controles) |
| `ink`, `paper`, `card`, `sunken`, `line`, `neutral` | Neutros | |

## Estados de una revisión

Etiqueta `StateLabel`, siempre igual: Pendiente (neutro), Con comentarios / Cambios
pedidos (ámbar), Aprobada (verde), Cerrada (gris).

## Botones

- `btn-primary` (naranja): la acción principal. Una por pantalla.
- `btn-strong` (tinta): acciones fuertes dentro de una herramienta (comentar).
- `btn`: secundaria. `btn-quiet`: terciaria. `btn-danger`: quitar, revocar.
- Altura mínima 36px (32px en `btn-sm`); pines con área táctil de 40px.

## Tipografía y espacio

Geist y Geist Mono (solo para código, ramas y datos de prueba). Escala: 12 / 13 / 14 /
15 / 16 / 20 / 28. Dos pesos: normal y semibold. Espaciado en múltiplos de 4.

## Forma

Controles 8px, superficies 12px, etiquetas y pines redondos. Sombras solo en capas que
flotan (diálogos, menús, pines).

## Reglas

- Sin rayas largas en textos de interfaz, sin emojis como iconos (Phosphor), sin
  etiquetas en mayúsculas sobre los títulos.
- Diálogos con `<dialog>` nativo (`Sheet`): Esc, foco atrapado, fondo inerte.
- Movimiento solo para dar feedback (entrada de diálogos), respetando
  `prefers-reduced-motion`.

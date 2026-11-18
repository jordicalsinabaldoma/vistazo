// Third-party text (reviewers, guests, the reviewed web page itself): cleaning and flags.
//
// This is NOT the defence against prompt injection; it is one more layer. The defence
// is structural (feedback.ts): a single channel for third-party data, an unguessable
// delimiter, a human in the loop and no dangerous tools in the CLI/MCP. Here we strip
// characters a person cannot see (so what they review is what the agent receives) and
// flag texts that look like orders for an agent, so the person decides whether to
// include them. Detection is multilingual (English and Spanish).

// Invisible or text-reordering characters:
// - U+E0000–U+E007F: "tag characters", can hide a whole ASCII text.
// - U+E0100–U+E01EF and U+FE00–U+FE0F: variation selectors (emoji smuggling).
// - Bidi controls, zero-width characters, BOM, Mongolian vowel separator.
// - C0/C1 controls except newline and tab.
const INVISIBLE =
  /[\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}\uFE00-\uFE0F\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C\u200B-\u200D\u2060-\u2064\u180E\uFEFF\u00AD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/gu;

export function hasInvisible(s: string) {
  INVISIBLE.lastIndex = 0;
  return INVISIBLE.test(s);
}

/** Cleans third-party text: no invisibles, NFC, no floods of line breaks. */
export function clean(s: string, max = 4000) {
  return s
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .slice(0, max);
}

// For matching: Unicode compatibility (＜ → <), lower case, no accents.
const fold = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const RULES: [string, RegExp][] = [
  [
    "asks to ignore instructions",
    /\b(ignora|ignorad|ignore|olvida|olvidad|forget|disregard|omite|salta(te)?|override|bypass)\b.{0,60}\b(instruc\w*|reglas|rules|prompt|anterior\w*|previous|above|arriba|sistema|system)/,
  ],
  [
    "addresses an agent or changes its role",
    /\b(eres un (agente|asistente|modelo|ia)|you are (an?|the) (agent|assistant|ai|model)|act(ua|úa)? como|act as|a partir de ahora|from now on|system prompt|developer (message|mode)|nuevas instrucciones|new instructions|you are now|pretend (to be|you are)|your new (role|task)|modo (dios|desarrollador)|jailbreak)\b/,
  ],
  [
    "asks for git commands or deletion",
    /\bgit\s+(push|reset|rebase|commit|checkout|clean|remote|config|filter-branch)\b|--force\b|\brm\s+-[a-z]*[rf]|\bdrop\s+(table|database)\b|\b(borra|borrad|elimina|eliminad|delete|remove|wipe)\b.{0,40}\b(carpeta|directorio|folder|repo\w*|rama|branch|tests?|base de datos|database|ficheros|archivos|files|historial|history)\b/,
  ],
  ["asks to deploy or publish", /\b(despliega\w*|desplegar|deploy\w*|vercel\s+(--)?prod|npm\s+publish|merge(a|ar)?\s+(a|en|to|into)\s+(main|master|prod\w*)|push\s+(a|to)\s+(main|master|prod\w*))\b/],
  [
    "asks to run commands",
    /\b(ejecuta\w*|corre|lanza|run|execute)\b.{0,40}(`|\b(comando|command|script|bash|shell|terminal)\b)|\b(curl|wget|powershell|chmod|sudo|pip\s+install|npm\s+(i|install|exec)|npx\s+\S+|bash\s+-c|sh\s+-c|eval\s*\()/,
  ],
  [
    "asks to reveal or send secrets",
    /\b(envia\w*|manda\w*|muestra\w*|revela\w*|imprime|pega|comparte|sube|send|reveal|print|share|upload|exfiltr\w*|leak|dump)\b.{0,50}\b(tokens?|api[\s_-]?keys?|secret\w*|secreto\w*|contrasenas?|passwords?|credencial\w*|\.env|ssh|clave(s)? (privada|de api|secreta)|private key|cookies?)\b/,
  ],
  ["opens or downloads links", /\b(abre|abrid|visita|descarga\w*|lee|consulta|fetch|open|visit|download|navigate|ve a|go to)\b.{0,40}https?:\/\//],
  ["imitates prompt tags", /<\/?\s*(reviewer\w*|system|assistant|user|human|instructions?|prompt|tool\w*|im_(start|end)|function\w*|data)\b[^>]*>/],
];

/** Reasons why a text looks like an order for an agent ([] if none). */
export function suspicious(s: string): string[] {
  const out: string[] = [];
  if (hasInvisible(s)) out.push("contains hidden characters");
  const f = fold(s);
  for (const [why, re] of RULES) if (re.test(f)) out.push(why);
  if (s.length > 2500) out.push("very long text");
  return out;
}

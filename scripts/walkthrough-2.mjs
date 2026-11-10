// Recorrido grabado en vídeo del control de versiones de Vistazo, contra el despliegue real.
// Una sola ventana: autora → invitado → revisor. Subtítulos y cursor visibles.
//   VISTAZO_URL=… DEMO_PASSWORD=… PROJECT=… node scripts/walkthrough.mjs
import { mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, request } from "../cli/node_modules/playwright/index.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_ = process.env.VISTAZO_URL.replace(/\/$/, "");
const PW = process.env.DEMO_PASSWORD;
const PID = process.env.PROJECT;
const DEMO = "https://brasa-demo-murex.vercel.app";
const OUT = path.join(ROOT, "evidence", "video");
mkdirSync(OUT, { recursive: true });
const AUTORA = "autora+final@brasa.test";
const REVISOR = "revisor+final@brasa.test";

// Segunda parte (continúa la numeración de la primera).
const api = await request.newContext({ baseURL: URL_ });
await api.post("/api/auth/login", { data: { email: AUTORA, password: PW } });
const { url: link } = await (await api.post(`/api/projects/${PID}/links`, { data: { label: "Diseñadora (vídeo 2)", days: 7 } })).json();
await api.dispose();
const v3Url = process.env.V3;

// ── Grabación ──
const browser = await chromium.launch({ slowMo: 90 });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: "es-ES",
  recordVideo: { dir: path.join(OUT, "p2"), size: { width: 1280, height: 800 } },
});
await ctx.addInitScript(() => {
  if (window.top !== window) return;
  const css = `#__cur{position:fixed;left:-50px;top:-50px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
    border:3px solid #ff5b1f;background:rgba(255,91,31,.18);pointer-events:none;z-index:2147483647;transition:transform .12s}
    #__cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:88%;z-index:2147483646;pointer-events:none;
    background:#17181c;color:#fff;font:600 19px/1.35 system-ui,sans-serif;padding:12px 20px;border-radius:12px;
    box-shadow:0 8px 30px rgba(0,0,0,.35);text-align:center}#__cap b{color:#ff7a45;margin-right:8px}`;
  const boot = () => {
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement("div"); c.id = "__cur"; document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => (c.style.transform = "scale(.6)"), true);
    addEventListener("mouseup", () => (c.style.transform = ""), true);
    const saved = localStorage.getItem("__cap"); if (saved) window.__cap(saved);
  };
  window.__cap = (html) => {
    localStorage.setItem("__cap", html);
    let d = document.getElementById("__cap");
    if (!d) { d = document.createElement("div"); d.id = "__cap"; document.body.appendChild(d); }
    d.innerHTML = html;
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", boot); else boot();
});

const page = await ctx.newPage();
page.on("dialog", (d) => d.accept());
let n = 15;
const wait = (ms) => page.waitForTimeout(ms);
async function cap(text, ms = 2600) {
  n++;
  await page.evaluate((h) => window.__cap?.(h), `<b>${n}</b>${text}`).catch(() => {});
  await wait(400);
  await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, "0")}.png`) });
  await wait(ms);
}
async function clk(loc, opts) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
  await wait(250);
  await loc.click(opts);
}
async function type(loc, text) {
  await clk(loc);
  await loc.pressSequentially(text, { delay: 18 });
}
async function login(email) {
  await page.goto(URL_);
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await page.press("#password", "Enter");
  await page.waitForURL("**/app");
}

try {
  await page.goto(link);
  await page.fill("#gn", "Ana (diseñadora)");
  await page.getByRole("button", { name: "Entrar a la revisión" }).click();
  await page.waitForURL("**/r/*");
  const ab = await page.getByText("Aprobar (requiere cuenta)").boundingBox();
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2, { steps: 20 });
  await cap("Como invitada no puede aprobar: eso es solo para usuarios identificados", 3200);

  // 10. Revisor aprueba
  await login(REVISOR);
  await page.goto(v3Url);
  await page.getByText("Flujos críticos").waitFor();
  await cap("El revisor identificado abre la v3 y repasa la checklist de flujos críticos", 2200);
  for (const t of ["Compra completa hasta el pago", "El error de login se entiende", "Se ve bien en móvil"]) {
    await clk(page.locator("li").filter({ hasText: t }).getByTitle("Funciona"));
    await wait(700);
  }
  await clk(page.getByRole("button", { name: "Feedback para el agente" }));
  await page.getByTestId("feedback-text").waitFor();
  await wait(1500);
  await cap("«Feedback para el agente»: el prompt con los comentarios pendientes, listo para pegar en Claude", 3500);
  await page.mouse.click(30, 400);
  await wait(500);
  await clk(page.getByRole("button", { name: "✓ Aprobar revisión" }));
  await page.getByTestId("approved").waitFor();
  await cap("Aprueba la v3 de forma explícita. Es una aprobación visual: no hace merge ni deploy", 3500);

  // 11. Historial
  await page.goto(`${URL_}/p/${PID}`);
  await page.getByText("v3").first().waitFor();
  await cap("Historial del proyecto: v1, v2 y v3, cada una con quién la publicó y quién la aprobó", 4000);
} finally {
  const vid = page.video();
  await ctx.close();
  await browser.close();
  if (vid) renameSync(await vid.path(), path.join(OUT, "recorrido-2.webm"));
}

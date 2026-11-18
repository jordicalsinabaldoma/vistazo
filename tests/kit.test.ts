import assert from "node:assert/strict";
import { test } from "node:test";
import { kindOf, kindsFor, kitFromHtml, kitSchema, kitSize } from "../src/lib/kit";
import { publishSchema } from "../src/lib/revisions";

// Mismo formato que una «página de etiquetas QR»: pages / rows (lead o title) / labels / products con ean.
const labelPage = {
  title: "Recepción · Almacén demo",
  intro: "Pasa el ratón por una etiqueta para ver su QR.",
  pages: [
    {
      title: "Entrada 1",
      subtitle: "20/10 13:40",
      meta: [{ label: "Id", value: "demo#1" }],
      notice: "Aviso opcional.",
      rows: [
        {
          lead: { kind: "pallet", code: "PAL-0001", detail: "2 cajas" },
          labels: [
            {
              kind: "box",
              code: "BOX-0001",
              products: [
                { name: "Taza", quantity: 12, ean: "98765433" },
                { name: "Sudadera", ean: "2000000000008", status: "unexpected" },
              ],
            },
          ],
        },
        { title: "Verificación", note: "Playa y bolsa.", labels: [{ kind: "beach", code: "B-1", detail: "Verificación" }, { kind: "tare", code: "H-1" }] },
        { title: "Cajas sueltas", icon: "box", note: "nada", labels: [] },
      ],
    },
  ],
};

test("acepta tal cual el JSON de una página de etiquetas", () => {
  const k = kitSchema.parse(labelPage);
  assert.equal(k.pages[0].rows[0].lead?.code, "PAL-0001");
  const p = k.pages[0].rows[0].labels[0].products!;
  assert.equal(p[0].code, "98765433", "ean pasa a code");
  assert.equal(p[1].status, "unexpected");
  assert.equal(kitSize(k), 4);
});

test("lee el JSON del bloque page-data de la página HTML", () => {
  const html = `<!doctype html><title>x</title><script type="application/json" id="page-data">${JSON.stringify(labelPage)}</script><script>1</script>`;
  assert.deepEqual(kitFromHtml(html), labelPage);
  assert.throws(() => kitFromHtml("<html></html>"));
});

test("tipos: genéricos por defecto, propios encima, y desconocidos con nombre legible", () => {
  const map = kindsFor([{ key: "pallet", name: "Palé", color: "orange", icon: "stack" }]);
  assert.equal(kindOf(map, "pallet").name, "Palé");
  assert.equal(kindOf(map, "user").icon, "user");
  assert.equal(kindOf(map, "mesa").name, "Mesa");
});

test("el kit externo solo admite https", () => {
  assert.throws(() => kitSchema.parse({ pages: [], url: "http://x.test" }));
  assert.ok(kitSchema.parse({ pages: [], url: "https://x.test/kit" }).url);
});

test("los enlaces para abrir la app no admiten javascript: ni data:", () => {
  const base = { title: "t", source: "agent" as const };
  for (const url of ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,x"])
    assert.throws(() => publishSchema.parse({ ...base, previews: [{ kind: "qr", label: "x", url }] }), url);
  assert.ok(publishSchema.parse({ ...base, previews: [{ kind: "qr", label: "Expo", url: "exp+app://expo-development-client/?url=http://10.0.0.2:8081" }] }));
});

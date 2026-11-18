import assert from "node:assert/strict";
import { test } from "node:test";
import { kindOf, kindsFor, kitFromHtml, kitSchema, kitSize } from "../src/lib/kit";
import { publishSchema } from "../src/lib/revisions";

// Same format as a "QR label page": pages / rows (lead or title) / labels / products with ean.
const labelPage = {
  title: "Receiving · Demo warehouse",
  intro: "Hover a label to see its QR.",
  pages: [
    {
      title: "Inbound 1",
      subtitle: "20/10 13:40",
      meta: [{ label: "Id", value: "demo#1" }],
      notice: "Optional notice.",
      rows: [
        {
          lead: { kind: "pallet", code: "PAL-0001", detail: "2 boxes" },
          labels: [
            {
              kind: "box",
              code: "BOX-0001",
              products: [
                { name: "Mug", quantity: 12, ean: "98765433" },
                { name: "Sweatshirt", ean: "2000000000008", status: "unexpected" },
              ],
            },
          ],
        },
        { title: "Verification", note: "Bay and bag.", labels: [{ kind: "beach", code: "B-1", detail: "Verification" }, { kind: "tare", code: "H-1" }] },
        { title: "Loose boxes", icon: "box", note: "none", labels: [] },
      ],
    },
  ],
};

test("accepts a label page JSON as-is", () => {
  const k = kitSchema.parse(labelPage);
  assert.equal(k.pages[0].rows[0].lead?.code, "PAL-0001");
  const p = k.pages[0].rows[0].labels[0].products!;
  assert.equal(p[0].code, "98765433", "ean becomes code");
  assert.equal(p[1].status, "unexpected");
  assert.equal(kitSize(k), 4);
});

test("reads the JSON from the page-data block of the HTML page", () => {
  const html = `<!doctype html><title>x</title><script type="application/json" id="page-data">${JSON.stringify(labelPage)}</script><script>1</script>`;
  assert.deepEqual(kitFromHtml(html), labelPage);
  assert.throws(() => kitFromHtml("<html></html>"));
});

test("kinds: generic defaults, custom ones on top, unknown ones with a readable name", () => {
  const map = kindsFor([{ key: "pallet", name: "Pallet", color: "orange", icon: "stack" }]);
  assert.equal(kindOf(map, "pallet").name, "Pallet");
  assert.equal(kindOf(map, "user").icon, "user");
  assert.equal(kindOf(map, "table").name, "Table");
});

test("an external kit only accepts https", () => {
  assert.throws(() => kitSchema.parse({ pages: [], url: "http://x.test" }));
  assert.ok(kitSchema.parse({ pages: [], url: "https://x.test/kit" }).url);
});

test("links to open the app reject javascript: and data:", () => {
  const base = { title: "t", source: "agent" as const };
  for (const url of ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,x"])
    assert.throws(() => publishSchema.parse({ ...base, previews: [{ kind: "qr", label: "x", url }] }), url);
  assert.ok(publishSchema.parse({ ...base, previews: [{ kind: "qr", label: "Expo", url: "exp+app://expo-development-client/?url=http://10.0.0.2:8081" }] }));
});

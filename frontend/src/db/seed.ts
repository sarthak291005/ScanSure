import { db } from "./index";
import {
  users,
  rules,
  products,
  scans,
  verifications,
  findings,
  sessions,
} from "./schema";
import bcrypt from "bcryptjs";

const day = 24 * 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * day);
// "today" for demo data (seeded 15 days ago, all relative to environment clock)
const T0 = daysAgo(15);
const rel = (n: number) => new Date(T0.getTime() + n * day);
const relIso = (n: number) => iso(rel(n));

async function seed() {
  console.log("Seeding database…");

  // wipe
  await db.delete(findings);
  await db.delete(verifications);
  await db.delete(scans);
  await db.delete(products);
  await db.delete(rules);
  await db.delete(sessions);
  await db.delete(users);

  // ---------- Rules (Legal Metrology / Packing Rules requirements) ----------
  const ruleRows = [
    {
      code: "LM-001",
      title: "Net Quantity Declared Clearly",
      description:
        'The net quantity must be declared in the format "Net Wt: X [unit]" and legibly visible on the principal display panel.',
      legalReference: "Rule 4, Legal Metrology (Packing Rules) 2011",
      category: "Declaration",
      severity: "major",
      applicableTo: "all",
      active: true,
    },
    {
      code: "LM-002",
      title: "Legible Marking & Minimum Font Size",
      description:
        "Net quantity characters must be at least 2 mm high for packs under 20 units, scaling with pack size. Text must be permanent and contrast against the background.",
      legalReference: "Rule 6(1), Legal Metrology (Packing Rules) 2011",
      category: "Presentation",
      severity: "major",
      applicableTo: "all",
      active: true,
    },
    {
      code: "LM-003",
      title: "Name & Address of Manufacturer / Packer / Importer",
      description:
        'The label must carry the name, complete address and place of business of the manufacturer, packer or importer, in the form "Mfgd./Pkd./Imprd. by" or similar.',
      legalReference: "Rule 4(2)(a), Legal Metrology (Packing Rules) 2011",
      category: "Declaration",
      severity: "major",
      applicableTo: "all",
      active: true,
    },
    {
      code: "LM-004",
      title: "Date of Manufacturing / Packing",
      description:
        'The date of manufacture or packing must be marked, in the form "Mfd./Pkd. on DD-MM-YYYY" or "Date of Mfg".',
      legalReference: "Rule 4(2)(c), Legal Metrology (Packing Rules) 2011",
      category: "Declaration",
      severity: "major",
      applicableTo: "all",
      active: true,
    },
    {
      code: "LM-005",
      title: "Best Before / Expiry Date (Perishable Goods)",
      description:
        "Perishable and date-sensitive products must declare a best before date in the form 'Best before DD-MM-YYYY'.",
      legalReference: "Rule 4(2)(d), Legal Metrology (Packing Rules) 2011",
      category: "Declaration",
      severity: "major",
      applicableTo: "food,dairy,bakery,beverages,pharma,cosmetics",
      active: true,
    },
    {
      code: "LM-006",
      title: "Country of Origin",
      description:
        'Imported goods must declare "Country of Origin" along with the importer name and address.',
      legalReference: "Rule 4(2)(e), Legal Metrology (Packing Rules) 2011",
      category: "Declaration",
      severity: "major",
      applicableTo: "all",
      active: true,
    },
    {
      code: "LM-007",
      title: "Price / Maximum Retail Price with Date",
      description:
        "For sale in India, the Maximum Retail Price inclusive of all taxes must be marked, optionally with MRP validity date.",
      legalReference: "Rule 4(2)(f) / MRP (Printing on Prepackaged Goods) Rules 2021",
      category: "Pricing",
      severity: "minor",
      applicableTo: "all",
      active: true,
    },
    {
      code: "LM-008",
      title: "Manufacturing / FSSAI / Importer Licence Number",
      description:
        'Food products must carry the FSSAI licence number in the form "Mfg. Lic. No" / "Imp. Lic. No". Other goods must display the relevant statutory licence.',
      legalReference: "Rule 4(2)(g), Legal Metrology (Packing Rules) 2011; FSS Act 2006",
      category: "Declaration",
      severity: "major",
      applicableTo: "food,dairy,bakery,beverages,pharma,cosmetics",
      active: true,
    },
    {
      code: "LM-009",
      title: "Product Marking (Identification of Goods)",
      description:
        "The name of the article/consignment and its identification must be marked so the pack can be distinguished from other goods.",
      legalReference: "Rule 4(2)(b), Legal Metrology (Packing Rules) 2011",
      category: "Declaration",
      severity: "major",
      applicableTo: "all",
      active: true,
    },
    {
      code: "LM-010",
      title: "No Expiry / Date In the Future",
      description:
        "Manufacturing dates must not be in the future; best-before dates must follow the manufacturing date. Reverse dates indicate tampering.",
      legalReference: "LM (Packing Rules) 2011 – Fair packing practice",
      category: "Integrity",
      severity: "critical",
      applicableTo: "all",
      active: true,
    },
  ];
  const ruleIds: Record<string, string> = {};
  for (const r of ruleRows) {
    const [row] = await db
      .insert(rules)
      .values(r)
      .returning({ id: rules.id });
    ruleIds[r.code] = row.id;
  }
  console.log(`  ${ruleRows.length} rules`);

  // ---------- Users ----------
  const demoPass = await bcrypt.hash("demo1234", 10);
  const [inspector] = await db
    .insert(users)
    .values({
      name: "Compliance Officer",
      email: "demo@scansure.ai",
      passwordHash: demoPass,
      company: "ScanSure Compliance Labs",
      role: "inspector",
      createdAt: daysAgo(40),
    })
    .returning();

  await db
    .insert(users)
    .values({
      name: "Compliance Officer",
      email: "demo@labelcheck.ai",
      passwordHash: demoPass,
      company: "ScanSure Compliance Labs",
      role: "inspector",
      createdAt: daysAgo(40),
    });

  await db
    .insert(users)
    .values({
      name: "Meera Krishnan",
      email: "demo@labelguard.in",
      passwordHash: demoPass,
      company: "ScanSure Compliance Labs",
      role: "inspector",
      createdAt: daysAgo(40),
    });

  const [seller] = await db
    .insert(users)
    .values({
      name: "Rohan Malhotra",
      email: "rohan@spicewala.com",
      passwordHash: demoPass,
      company: "SpiceWala Foods Pvt Ltd",
      role: "manufacturer",
      createdAt: daysAgo(25),
    })
    .returning();
  console.log("  2 users");

  // ---------- Products ----------
  const productDefs = [
    {
      name: "Roasted Almonds Premium",
      category: "food",
      hsnCode: "0802",
      packagingUnit: "g",
      declaredWeight: "500",
      manufacturerName: "SpiceWala Foods Pvt Ltd",
      manufacturerAddress:
        "B-14, Okhla Industrial Area Phase II, New Delhi 110020",
      mfgDate: relIso(-12),
      expDate: relIso(165),
      mfgLicense: "10023456789123",
      countryOfOrigin: "India",
      mrp: 89900, // ₹899
      netQuantity: "500 g",
      imageUrl: "/images/label-1.jpg",
      notes: "Flagship SKU for marketplace channel.",
    },
    {
      name: "Basmati Rice (Long Grain)",
      category: "food",
      hsnCode: "1006",
      packagingUnit: "kg",
      declaredWeight: "1",
      manufacturerName: "Aroma Grains (India) Ltd",
      manufacturerAddress: "Plot 22, SEZ Unit, Sonipat, Haryana 131001",
      mfgDate: relIso(-6),
      expDate: null,
      mfgLicense: "10011122233344",
      countryOfOrigin: "India",
      mrp: 64900,
      netQuantity: "1 kg",
      imageUrl: "/images/label-2.jpg",
      notes: "",
    },
    {
      name: "Toned Milk (Ambient)",
      category: "dairy",
      hsnCode: "0401",
      packagingUnit: "L",
      declaredWeight: "2",
      manufacturerName: "Deshi Dairy Cooperative",
      manufacturerAddress: "Survey No 88, Palghar Road, Thane 401101",
      mfgDate: relIso(-3),
      expDate: relIso(87),
      mfgLicense: "10055566677788",
      countryOfOrigin: "India",
      mrp: 12000,
      netQuantity: "2 L",
      imageUrl: "/images/label-3.jpg",
      notes: "High-velocity SKU, daily production run.",
    },
    {
      name: "Multigrain Atta 1kg",
      category: "food",
      hsnCode: "1904",
      packagingUnit: "kg",
      declaredWeight: "1",
      manufacturerName: "SpiceWala Foods Pvt Ltd",
      manufacturerAddress:
        "B-14, Okhla Industrial Area Phase II, New Delhi 110020",
      mfgDate: relIso(-2),
      expDate: relIso(238),
      mfgLicense: "10023456789123",
      countryOfOrigin: "India",
      mrp: 24500,
      netQuantity: "1 kg",
      imageUrl: null,
      notes: "",
    },
    {
      name: "Cold-Pressed Groundnut Oil",
      category: "food",
      hsnCode: "1508",
      packagingUnit: "L",
      declaredWeight: "1",
      manufacturerName: "Himalia Oils & Extracts",
      manufacturerAddress: "Unit 7, MIDC Chakan, Pune 410501",
      mfgDate: relIso(-20),
      expDate: relIso(280),
      mfgLicense: "10099988877766",
      countryOfOrigin: "India",
      mrp: 64500,
      netQuantity: "1 L",
      imageUrl: null,
      notes: "",
    },
  ];

  const productsInserted: (typeof products.$inferSelect)[] = [];
  for (const p of productDefs) {
    const [row] = await db.insert(products).values(p).returning();
    productsInserted.push(row);
  }
  console.log(`  ${productsInserted.length} products`);

  // ---------- Scans ----------
  const [almonds, rice, milk, atta, oil] = productsInserted;

  const scanDefs: {
    product: (typeof productsInserted)[number];
    status: "completed" | "pending";
    image: string | null;
    extracted: Record<string, string | null>;
    confidence: number;
    createdDaysAgo: number;
  }[] = [
    {
      product: almonds,
      status: "completed",
      image: "/images/label-1.jpg",
      extracted: {
        netWeight: "Net Wt: 500 g",
        brand: "SpiceWala Almonds",
        manufacturer: "Mfd. by: SpiceWala Foods Pvt Ltd",
        address: "B-14, Okhla Industrial Area Phase II, New Delhi 110020",
        mfgDate: "Mfd. on: 14-02-2026",
        bestBefore: "Best Before: 13-08-2026",
        countryOfOrigin: "Product of India",
        mrp: "MRP: ₹899.00 incl. of all taxes",
        licence: "Mfg. Lic. No: 10023456789123",
      },
      confidence: 97,
      createdDaysAgo: 12,
    },
    {
      product: rice,
      status: "completed",
      image: "/images/label-2.jpg",
      extracted: {
        netWeight: "Net Weight 1 kg",
        brand: "Aroma Basmati",
        manufacturer: "Pkd. by: Aroma Grains (India) Ltd",
        address: "Plot 22, SEZ Unit, Sonipat, Haryana 131001",
        mfgDate: "Date of Pack: 20-02-2026",
        bestBefore: null,
        countryOfOrigin: "Product of India",
        mrp: "MRP ₹649.00",
        licence: "FSSAI Lic: 10011122233344",
      },
      confidence: 94,
      createdDaysAgo: 6,
    },
    {
      product: milk,
      status: "completed",
      image: "/images/label-3.jpg",
      extracted: {
        netWeight: "Net Content: 2 L",
        brand: "Deshi Toned Milk",
        manufacturer: "Mfd. by: Deshi Dairy Cooperative",
        address: null, // missing on label -> fails LM-003
        mfgDate: "Mfd. on: 23-02-2026",
        bestBefore: "Best before: 24-05-2026",
        countryOfOrigin: "Product of India",
        mrp: "MRP ₹120.00",
        licence: "FSSAI Lic. No: 10055566677788",
      },
      confidence: 88,
      createdDaysAgo: 3,
    },
    {
      product: atta,
      status: "pending",
      image: null,
      extracted: {},
      confidence: 0,
      createdDaysAgo: 0,
    },
  ];

  const scanRows: (typeof scans.$inferSelect)[] = [];
  for (const s of scanDefs) {
    const [row] = await db
      .insert(scans)
      .values({
        productId: s.product.id,
        status: s.status,
        imageUrl: s.image ?? s.product.imageUrl ?? "",
        extracted: s.extracted,
        confidence: s.confidence,
        createdBy: inspector.id,
        createdAt: rel(-s.createdDaysAgo),
      })
      .returning();
    scanRows.push(row);
  }

  // one pending scan for oil too
  const [pendingOil] = await db
    .insert(scans)
    .values({
      productId: oil.id,
      status: "pending",
      imageUrl: "",
      extracted: {},
      confidence: 0,
      createdBy: seller.id,
      createdAt: rel(-1),
    })
    .returning();
  console.log("  5 scans");

  // ---------- Verifications + findings ----------
  const verifDefs = [
    {
      scan: scanRows[0],
      product: almonds,
      result: "compliant",
      summary:
        "All 9 applicable Legal Metrology declarations verified on the label. Net quantity, dates, MRP and FSSAI licence are present and correctly formatted. Certificate ready for marketplace upload.",
      findings: [
        ["LM-001", "pass", "Net quantity '500 g' found and matches declared pack size.", "Label: 'Net Wt: 500 g' — principal display panel, lower-left."],
        ["LM-002", "pass", "Character height estimated at 3.1 mm — exceeds the 2 mm minimum for this pack class.", "OCR glyph metrics: average character height 3.1 mm at 160 dpi."],
        ["LM-003", "pass", "Manufacturer name and full address present with 'Mfd. by' prefix.", "Label: 'Mfd. by: SpiceWala Foods Pvt Ltd, B-14, Okhla Industrial Area Phase II, New Delhi 110020'."],
        ["LM-004", "pass", "Date of manufacture found in the required format.", "Label: 'Mfd. on: 14-02-2026' (DD-MM-YYYY)."],
        ["LM-005", "pass", "Best-before date present and consistent with a 180-day shelf life.", "Label: 'Best Before: 13-08-2026'."],
        ["LM-006", "pass", "Country of origin declared.", "Label: 'Product of India'."],
        ["LM-007", "pass", "MRP with tax-inclusive note present.", "Label: 'MRP: ₹899.00 incl. of all taxes'."],
        ["LM-008", "pass", "FSSAI licence number present and 14-digit valid format.", "Label: 'Mfg. Lic. No: 10023456789123'."],
        ["LM-009", "pass", "Product identification clear on the pack.", "Label: 'Roasted Almonds Premium' with SKU 'SW-ALM-500'."],
        ["LM-010", "pass", "Dates internally consistent: MFG 14-02-2026 < BB 13-08-2026.", "Computed delta: 180 days."],
      ],
    },
    {
      scan: scanRows[1],
      product: rice,
      result: "compliant",
      summary:
        "Rice pack passed all applicable checks. Best-before date is not required for non-perishable staples under these rules; all other declarations verified.",
      findings: [
        ["LM-001", "pass", "Net quantity '1 kg' found.", "Label: 'Net Weight 1 kg'."],
        ["LM-002", "pass", "Print contrast and size meet the Rule 6(1) minimum for 1 kg packs.", "Glyph height est. 4.2 mm; contrast ratio 11.2:1."],
        ["LM-003", "pass", "Packer name and address present.", "Label: 'Pkd. by: Aroma Grains (India) Ltd, Plot 22, SEZ Unit, Sonipat, Haryana 131001'."],
        ["LM-004", "pass", "Pack date present.", "Label: 'Date of Pack: 20-02-2026'."],
        ["LM-005", "not_applicable", "Best-before date is not mandated for non-perishable cereals.", "Rule applicability: cereals / staples exempt."],
        ["LM-006", "pass", "Country of origin declared.", "Label: 'Product of India'."],
        ["LM-007", "warning", "MRP present but printed without the 'incl. of all taxes' note.", "Label: 'MRP ₹649.00' — tax-inclusive wording absent (recommended, not blocking)."],
        ["LM-008", "pass", "FSSAI licence number present.", "Label: 'FSSAI Lic: 10011122233344'."],
        ["LM-009", "pass", "Article identified as basmati rice.", "Label: 'Aroma Basmati (Long Grain)'."],
        ["LM-010", "pass", "Pack date consistent with current production calendar.", "MFG 20-02-2026 is within the last 7 days."],
      ],
    },
    {
      scan: scanRows[2],
      product: milk,
      result: "non_compliant",
      summary:
        "2 critical failures: manufacturer address missing from the label and MRP printed without the tax-inclusive note. The pack must not be dispatched to marketplace fulfilment centres until reprinted.",
      findings: [
        ["LM-001", "pass", "Net quantity '2 L' found.", "Label: 'Net Content: 2 L'."],
        ["LM-002", "pass", "Print size within limits.", "Glyph height est. 2.9 mm."],
        ["LM-003", "fail", "Manufacturer name present but the full address is MISSING from the label.", "OCR located 'Mfd. by: Deshi Dairy Cooperative' but no street address, city or PIN code anywhere on the pack."],
        ["LM-004", "pass", "Manufacture date present.", "Label: 'Mfd. on: 23-02-2026'."],
        ["LM-005", "pass", "Best-before date present.", "Label: 'Best before: 24-05-2026'."],
        ["LM-006", "pass", "Country of origin declared.", "Label: 'Product of India'."],
        ["LM-007", "warning", "MRP printed without 'incl. of all taxes' notation.", "Label: 'MRP ₹120.00'."],
        ["LM-008", "pass", "FSSAI licence present.", "Label: 'FSSAI Lic. No: 10055566677788'."],
        ["LM-009", "pass", "Article identified.", "Label: 'Deshi Toned Milk (Ambient)'."],
        ["LM-010", "pass", "Dates consistent (90-day shelf life).", "MFG 23-02-2026 → BB 24-05-2026."],
      ],
    },
  ];

  for (const v of verifDefs) {
    const rows = v.findings as [string, string, string, string][];
    const passed = rows.filter((f) => f[1] === "pass").length;
    const failed = rows.filter((f) => f[1] === "fail").length;
    const warnings = rows.filter((f) => f[1] === "warning").length;
    const applicable = rows.filter((f) => f[1] !== "not_applicable").length;
    const score = Math.round(((passed + warnings * 0.5) / applicable) * 100);

    const [ver] = await db
      .insert(verifications)
      .values({
        scanId: v.scan.id,
        productId: v.product.id,
        result: v.result,
        score,
        passed,
        failed,
        warnings,
        summary: v.summary,
        createdBy: inspector.id,
        createdAt: v.scan.createdAt,
      })
      .returning();

    for (const [code, status, detail, evidence] of rows) {
      await db.insert(findings).values({
        verificationId: ver.id,
        ruleId: ruleIds[code],
        status,
        detail,
        evidence,
      });
    }
  }

  // a "needs_review" verification for oil (partial OCR)
  const [verOil] = await db
    .insert(verifications)
    .values({
      scanId: pendingOil.id,
      productId: oil.id,
      result: "needs_review",
      score: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      summary:
        "OCR confidence below threshold (61%). FSSAI licence number partially occluded by fold line; manual review recommended before certificate issuance.",
      createdBy: seller.id,
      createdAt: rel(-1),
    })
    .returning();

  for (const code of ["LM-008"]) {
    await db.insert(findings).values({
      verificationId: verOil.id,
      ruleId: ruleIds[code],
      status: "warning",
      detail: "Licence number partially legible — '1009998887?766' — re-capture recommended.",
      evidence: "OCR region 'FSSAI Lic' occluded by pack fold; confidence 58%.",
    });
  }
  console.log("  4 verifications with findings");

  console.log("Seed complete.");
  console.log("Login: demo@scansure.ai / demo1234");

  void seller;
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));

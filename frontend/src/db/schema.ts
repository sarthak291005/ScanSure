import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  date,
  index,
} from "drizzle-orm/pg-core";

// ---------- Users & auth ----------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 200 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 200 }).notNull(),
    company: varchar("company", { length: 160 }),
    role: varchar("role", { length: 30 }).notNull().default("seller"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    token: varchar("token", { length: 128 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
);

// ---------- Rules (Legal Metrology requirements) ----------

export const rules = pgTable(
  "rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    legalReference: varchar("legal_reference", { length: 200 }).notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("major"),
    applicableTo: text("applicable_to").notNull().default("all"), // comma list of categories or "all"
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// ---------- Products ----------

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    hsnCode: varchar("hsn_code", { length: 20 }),
    packagingUnit: varchar("packaging_unit", { length: 40 }).notNull().default("g"),
    declaredWeight: varchar("declared_weight", { length: 40 }).notNull(),
    manufacturerName: varchar("manufacturer_name", { length: 200 }).notNull(),
    manufacturerAddress: text("manufacturer_address").notNull(),
    mfgDate: date("mfg_date").notNull(),
    expDate: date("exp_date"),
    mfgLicense: varchar("mfg_license", { length: 60 }), // FSSAI / ISO etc
    countryOfOrigin: varchar("country_of_origin", { length: 80 }).notNull().default("India"),
    importCode: varchar("import_code", { length: 30 }),
    mrp: integer("mrp"), // paise
    netQuantity: varchar("net_quantity", { length: 60 }).notNull(),
    imageUrl: text("image_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("products_category_idx").on(t.category)],
);

// ---------- Scans (OCR + AI extraction) ----------

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),

    detectedProductName: varchar("detected_product_name", { length: 200 }),
    detectedCategory: varchar("detected_category", { length: 80 }),
    categoryConfidence: integer("category_confidence"),

    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | completed
    imageUrl: text("image_url").notNull(),
    extracted: jsonb("extracted").$type<Record<string, string | null>>(),
    confidence: integer("confidence"), // 0-100
    error: text("error"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("scans_product_idx").on(t.productId)],
);

// ---------- Verification runs & findings ----------

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    result: varchar("result", { length: 20 }).notNull().default("pending"), // compliant | non_compliant | needs_review
    score: integer("score").notNull().default(0), // 0-100
    passed: integer("passed").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    warnings: integer("warnings").notNull().default(0),
    summary: text("summary"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("verifications_product_idx").on(t.productId)],
);

export const findings = pgTable(
  "findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    verificationId: uuid("verification_id")
      .notNull()
      .references(() => verifications.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pass | fail | warning | not_applicable
    detail: text("detail"),
    evidence: text("evidence"), // what the OCR saw on the label
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("findings_verification_idx").on(t.verificationId)],
);

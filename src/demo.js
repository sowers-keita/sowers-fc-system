// デモモード（URL に ?demo=1）用のメモリ内データベース。本番のSupabaseには一切接続しません。
// 再読み込みすると初期状態に戻ります。

export const DEMO_SCHOOL = {
  id: "demo-test",
  area: "テスト",
  name: "テスト体操教室（デモ）",
  day: "土曜（月3回）",
  venue: "テスト体育館",
  defaultRate: 1200,
  classes: [{ name: "A", time: "10:00-11:00" }, { name: "B", time: "11:10-12:10" }],
};

export const DEMO_SCHOOL2 = {
  id: "demo-test2",
  area: "テスト",
  name: "テスト第2教室（デモ・未提出）",
  day: "日曜（月3回）",
  venue: "テスト公民館",
  defaultRate: 1200,
  classes: [{ name: "A", time: "10:00-11:00" }],
};

export const DEMO_ADMIN = { id: "demo-admin", display_name: "経理担当（デモ）", school_id: null, role: "admin" };
export const DEMO_TEACHER = { id: "demo-teacher", display_name: "テスト 先生", school_id: "demo-test", role: "teacher" };

let seq = 1;
const rid = (p) => `${p}-${seq++}`;

function work(className, role, dates, rate) {
  return { id: rid("w"), dates, workDetail: `${className}クラス ${role === "sub" ? "サブ" : "メイン"}`, rate, memo: "", role, className };
}

function seed() {
  const names = {
    A: ["青木 ひなた", "石井 そうた", "上田 ゆい", "江口 はると", "大野 さくら"],
    B: ["加藤 りく", "木村 あおい", "工藤 れん", "小林 めい", "近藤 ゆうと"],
  };
  const students = [];
  Object.entries(names).forEach(([cls, list]) => list.forEach((full_name, i) => students.push({
    id: rid("s"), user_id: DEMO_TEACHER.id, school_id: DEMO_SCHOOL.id, page_no: 1, full_name,
    join_month: `2026-0${3 + i}`, class_name: cls, status: "active", enrollment_fee: 0, monthly_fee: 6000, memo: "",
    created_at: "2026-04-01T00:00:00Z",
  })));
  const roster = students.map((s) => ({ id: s.id, full_name: s.full_name, class_name: s.class_name, join_month: s.join_month, status: s.status, page_no: 1 }));
  const base = {
    user_id: DEMO_TEACHER.id, school_id: DEMO_SCHOOL.id, issuer: "テスト体操教室 テスト 先生",
    bank_info: "テスト銀行 デモ支店 普通 0000000 テスト センセイ", notes: "", roster, status: "submitted",
  };
  const aug = {
    ...base, id: rid("inv"), target_month: "2026-08", invoice_date: "2026-08-31", invoice_no: "SW-20260831",
    submitted_at: "2026-08-31T12:00:00Z", updated_at: "2026-08-31T12:00:00Z", paid_at: "2026-09-25T03:00:00Z",
    people: [
      { id: rid("p"), name: "テスト 花子", works: [work("A", "main", ["2026-08-01", "2026-08-08", "2026-08-22", "2026-08-29"], 2500)] },
      { id: rid("p"), name: "テスト 太郎", works: [work("B", "main", ["2026-08-01", "2026-08-08", "2026-08-22", "2026-08-29"], 2500), work("A", "sub", ["2026-08-01", "2026-08-08"], 1100)] },
    ],
    expenses: [
      { id: rid("e"), applicant: "テスト 花子", item: "テスト体育館 使用料", quantity: 4, amount: 2400, memo: "" },
      { id: rid("e"), applicant: "テスト 太郎", item: "交通費", quantity: 4, amount: 500, memo: "" },
    ],
    withholding: {
      "テスト花子": { type: "kou", rate: 3.063, amount: 0 },
      "テスト太郎": { type: "otsu", rate: 3.063, amount: null },
    },
  };
  const sep = {
    ...base, id: rid("inv"), target_month: "2026-09", invoice_date: "2026-09-30", invoice_no: "SW-20260930",
    submitted_at: "2026-09-30T12:00:00Z", updated_at: "2026-09-30T12:00:00Z",
    people: [
      { id: rid("p"), name: "テスト 花子", works: [work("A", "main", ["2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26"], 2500)] },
      { id: rid("p"), name: "テスト 太郎", works: [work("B", "main", ["2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26"], 2500), work("A", "sub", ["2026-09-12", "2026-09-26"], 1100)] },
      { id: rid("p"), name: "体験 次郎", works: [work("B", "sub", ["2026-09-19", "2026-09-26"], 1100)] },
    ],
    expenses: [
      { id: rid("e"), applicant: "テスト 花子", item: "テスト体育館 使用料", quantity: 4, amount: 2400, memo: "" },
      { id: rid("e"), applicant: "テスト 太郎", item: "マット補修テープ", quantity: 1, amount: 1980, memo: "領収書あり" },
      { id: rid("e"), applicant: "テスト 太郎", item: "交通費", quantity: 4, amount: 500, memo: "" },
      { id: rid("e"), applicant: "テスト 花子", item: "体験料の集金（控除）", quantity: 1, amount: -1000, memo: "現金で受領" },
    ],
    withholding: {},
  };
  return {
    invoice_months: [aug, sep],
    students,
    fc_withholding_settings: [
      { person_key: "テスト花子", person_name: "テスト 花子", type: "kou", rate: 3.063, kou_amount: 0, updated_at: "2026-08-31T13:00:00Z" },
      { person_key: "テスト太郎", person_name: "テスト 太郎", type: "otsu", rate: 3.063, kou_amount: null, updated_at: "2026-08-31T13:00:00Z" },
    ],
    profiles: [DEMO_ADMIN, DEMO_TEACHER, { id: "demo-teacher2", display_name: "テスト 次郎", school_id: "demo-test2", role: "teacher" }],
  };
}

let db = seed();
export function resetDemo() { db = seed(); }

const clone = (v) => JSON.parse(JSON.stringify(v));

class Query {
  constructor(table) { this.table = table; this.filters = []; this.orders = []; this.op = "select"; this.payload = null; this.opts = {}; this.wantRows = false; }
  select() { if (this.op !== "select") this.wantRows = true; return this; }
  insert(p) { this.op = "insert"; this.payload = p; return this; }
  update(p) { this.op = "update"; this.payload = p; return this; }
  upsert(p, opts = {}) { this.op = "upsert"; this.payload = p; this.opts = opts; return this; }
  delete() { this.op = "delete"; return this; }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this; }
  neq(k, v) { this.filters.push((r) => r[k] !== v); return this; }
  in(k, vs) { this.filters.push((r) => vs.includes(r[k])); return this; }
  order(k, o = {}) { this.orders.push([k, o.ascending !== false]); return this; }
  maybeSingle() { this.single1 = "maybe"; return this; }
  single() { this.single1 = "one"; return this; }
  run() {
    if (!db[this.table]) db[this.table] = [];
    const rows = db[this.table];
    const match = (r) => this.filters.every((f) => f(r));
    let out = [];
    if (this.op === "select") {
      out = rows.filter(match);
      out.sort((a, b) => { for (const [k, asc] of this.orders) { const x = a[k] ?? ""; const y = b[k] ?? ""; if (x < y) return asc ? -1 : 1; if (x > y) return asc ? 1 : -1; } return 0; });
    } else if (this.op === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      out = list.map((p) => ({ id: rid(this.table), created_at: new Date().toISOString(), ...clone(p) }));
      rows.push(...out);
    } else if (this.op === "update") {
      out = rows.filter(match);
      out.forEach((r) => Object.assign(r, clone(this.payload)));
    } else if (this.op === "upsert") {
      const keys = String(this.opts.onConflict || "id").split(",").map((s) => s.trim());
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      out = list.map((p) => {
        const hit = rows.find((r) => keys.every((k) => r[k] === p[k]));
        if (hit) { Object.assign(hit, clone(p)); return hit; }
        const row = { id: rid(this.table), created_at: new Date().toISOString(), ...clone(p) };
        rows.push(row);
        return row;
      });
    } else if (this.op === "delete") {
      out = rows.filter(match);
      db[this.table] = rows.filter((r) => !match(r));
    }
    const data = clone(out);
    if (this.single1 === "maybe") return { data: data[0] || null, error: null };
    if (this.single1 === "one") return data[0] ? { data: data[0], error: null } : { data: null, error: { message: "not found" } };
    if (this.op !== "select" && !this.wantRows) return { data: null, error: null };
    return { data, error: null };
  }
  then(resolve, reject) { try { resolve(this.run()); } catch (e) { reject(e); } }
}

export function createDemoClient() {
  return {
    from: (t) => new Query(t),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: { message: "demo" } }),
      signUp: async () => ({ error: { message: "デモでは登録できません" } }),
      resetPasswordForEmail: async () => ({ error: { message: "デモでは使えません" } }),
      updateUser: async () => ({ error: null }),
    },
  };
}

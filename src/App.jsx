
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { CalendarDays, FileText, LogOut, Plus, Printer, Save, Trash2, UserPlus, Users, LayoutDashboard, TrendingUp, Wallet, Megaphone, BookOpen, ChevronLeft, Settings, KeyRound, Eye, X, Check, ChevronRight } from "lucide-react";
import schools from "./schools.json";
import { createDemoClient, resetDemo, DEMO_SCHOOL, DEMO_SCHOOL2, DEMO_ADMIN, DEMO_TEACHER } from "./demo.js";

// ?demo=1 で開くと、本番DBに接続しないデモ（テスト教室）で動く
const DEMO = import.meta.env.VITE_FORCE_DEMO === "1" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo"));
if (DEMO) [DEMO_SCHOOL, DEMO_SCHOOL2].forEach((d) => { if (!schools.some((s) => s.id === d.id)) schools.push(d); });
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = DEMO ? createDemoClient() : (supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null);

function yen(value) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(Number(value || 0));
}
function todayString() { return new Date().toISOString().slice(0, 10); }
function monthString(date = new Date()) { return date.toISOString().slice(0, 7); }
function shortDate(ts) { const d = new Date(ts); return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()}`; }
function monthLabel(m) { const [y, mm] = String(m).split("-"); return `${y}年${Number(mm)}月分`; }
// 請求書の状態：未提出 / 振込待ち（提出済み） / 振込済み
function invoiceState(r) { if (r && r.paid_at) return "paid"; if (r && r.status === "submitted") return "submitted"; return "unsubmitted"; }
function uniqueId() { return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function safeNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function getSchoolById(id) { return schools.find((school) => school.id === id) || schools[0]; }
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function formatJapaneseDate(dateText) {
  const [, month, day] = dateText.split("-");
  return `${Number(month)}/${Number(day)}`;
}
function addMonths(monthText, diff) {
  const [year, month] = monthText.split("-").map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function buildCalendarDays(targetMonth) {
  const [year, month] = targetMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const firstWeekday = start.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(formatDate(new Date(year, month - 1, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function toggleDate(dates, date) {
  if (dates.includes(date)) return dates.filter((item) => item !== date);
  return [...dates, date].sort();
}
function monthsBetween(joinMonth, targetMonth = monthString()) {
  if (!joinMonth) return "";
  const [jy, jm] = joinMonth.split("-").map(Number);
  const [ty, tm] = targetMonth.split("-").map(Number);
  const months = (ty - jy) * 12 + (tm - jm) + 1;
  if (!Number.isFinite(months) || months < 0) return "";
  if (months < 12) return `${months}ヶ月`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years}年${rest}ヶ月` : `${years}年`;
}
function makeWorkRow(rate, workDetail = "Aクラス メイン") {
  return { id: uniqueId(), dates: [], workDetail, rate, memo: "" };
}
function makePerson(rate, name = "") {
  return { id: uniqueId(), name, works: [makeWorkRow(rate)] };
}
// 給料ルール：メイン＝クラス在籍1〜4人は1日2,000円、5人目から1人ごとに+500円／サブ＝1,100円（変更可）。室川は従来どおり単価を手入力。
const FLAT_RATE_SCHOOLS = ["murokawa-acro"];
const MAIN_BASE_RATE = 2000, MAIN_BASE_COUNT = 4, MAIN_STEP = 500, SUB_DEFAULT_RATE = 1100;
function usesEnrollRule(schoolId) { return !FLAT_RATE_SCHOOLS.includes(schoolId); }
function normClass(name) { return String(name || "").replace(/\s+/g, "").replace(/クラス$/, ""); }
function countClassStudents(students, className) { const k = normClass(className); return (students || []).filter((s) => (s.status || "active") === "active" && normClass(s.class_name) === k).length; }
function mainRateFor(count) { return MAIN_BASE_RATE + Math.max(0, count - MAIN_BASE_COUNT) * MAIN_STEP; }
function workLabel(className, role) { return `${className}クラス ${role === "sub" ? "サブ" : "メイン"}`; }
function newWorkFor(school) {
  const cls = school.classes[0]?.name || "A";
  if (!usesEnrollRule(school.id)) return makeWorkRow(school.defaultRate, `${cls}クラス メイン`);
  return { ...makeWorkRow(MAIN_BASE_RATE, workLabel(cls, "main")), role: "main", className: cls };
}
function makeExpenseRow() {
  return { id: uniqueId(), applicant: "", item: "", quantity: 1, amount: "", memo: "" };
}
const STUDENT_STATUSES = [
  { value: "active", label: "在籍" },
  { value: "suspended", label: "休会" },
  { value: "withdrawn", label: "退会" },
];
function studentStatusLabel(status) {
  return (STUDENT_STATUSES.find((s) => s.value === (status || "active")) || STUDENT_STATUSES[0]).label;
}
// 同じ名前（空白の違いは無視）の人が複数いたら1人にまとめ、クラス（出勤行）をその人の下に並べる
function mergeSamePeople(list) {
  const out = [];
  const byKey = {};
  (list || []).forEach((person) => {
    const key = personKey(person.name);
    if (!key) { out.push(person); return; }
    if (byKey[key]) { byKey[key].works = [...(byKey[key].works || []), ...(person.works || [])]; return; }
    byKey[key] = { ...person, works: [...(person.works || [])] };
    out.push(byKey[key]);
  });
  return out;
}
function personSubtotal(person) {
  return person.works.reduce((sum, work) => sum + work.dates.length * safeNumber(work.rate), 0);
}
function personWorkDays(person) {
  return person.works.reduce((sum, work) => sum + work.dates.length, 0);
}
function calcTotals(people, expenses) {
  const list = Array.isArray(people) ? people : [];
  const exps = Array.isArray(expenses) ? expenses : [];
  const workTotal = list.reduce((sum, person) => sum + personSubtotal(person), 0);
  const totalWorkDays = list.reduce((sum, person) => sum + personWorkDays(person), 0);
  const expenseTotal = exps.reduce((sum, expense) => sum + safeNumber(expense.quantity) * safeNumber(expense.amount), 0);
  return { workTotal, totalWorkDays, expenseTotal, total: workTotal + expenseTotal };
}

// 源泉徴収（給料・甲欄/乙欄）。対象は出勤の小計（経費は対象外）。1円未満切り捨て。
const WH_LABEL = { none: "なし", kou: "甲欄", otsu: "乙欄" };
const OTSU_DEFAULT_RATE = 3.063;
// 乙欄で3.063%になるのは月の支給額が105,000円未満のとき（令和8年分 月額表）。それ以上は税額表の金額を手入力する
const OTSU_FLAT_LIMIT = 105000;
function otsuNeedsTable(entry, base) { return !!entry && entry.type === "otsu" && safeNumber(base) >= OTSU_FLAT_LIMIT && (entry.amount === null || entry.amount === undefined || entry.amount === ""); }
function personKey(name) { return String(name || "").replace(/[\s\u3000]+/g, ""); }
function rateTax(base, rate) { return Math.floor((Math.round(safeNumber(base)) * Math.round(safeNumber(rate) * 1000)) / 100000); }
function whTax(entry, base) {
  if (!entry || entry.type === "none") return 0;
  if (entry.amount !== null && entry.amount !== undefined && entry.amount !== "") return Math.max(0, Math.floor(safeNumber(entry.amount)));
  if (entry.type === "otsu") return Math.max(0, rateTax(base, entry.rate ?? OTSU_DEFAULT_RATE));
  return 0;
}
function calcWithholding(people, withholding) {
  const map = withholding && typeof withholding === "object" ? withholding : {};
  const rows = (Array.isArray(people) ? people : []).map((p, i) => {
    const key = personKey(p.name);
    const base = personSubtotal(p);
    const entry = key ? map[key] : null;
    return { key, name: p.name || `人物${i + 1}`, base, entry: entry || null, tax: whTax(entry, base) };
  });
  return { rows, taxTotal: rows.reduce((s, r) => s + r.tax, 0), hasAny: rows.some((r) => r.entry) };
}
function whDesc(entry) {
  if (!entry) return "未設定";
  if (entry.type === "none") return "源泉なし";
  if (entry.type === "otsu") return `乙欄 ${entry.rate ?? OTSU_DEFAULT_RATE}%${entry.amount !== null && entry.amount !== undefined && entry.amount !== "" ? "（金額手入力）" : ""}`;
  return "甲欄";
}

function FieldLabel({ children }) { return <label className="text-sm font-bold text-slate-700">{children}</label>; }
function TextInput(props) {
  return <input {...props} className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 ${props.className || ""}`} />;
}
function TextAreaInput(props) {
  return <textarea {...props} className={`w-full min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 ${props.className || ""}`} />;
}
function SelectInput({ value, onChange, children }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50">{children}</select>;
}
function Card({ children, className = "" }) {
  return <div className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}
function Button({ children, onClick, variant = "primary", disabled = false, className = "", type = "button" }) {
  const base = "inline-flex min-h-12 items-center justify-center rounded-2xl px-4 py-3 text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
  const styles = variant === "outline"
    ? "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
    : variant === "ghost"
      ? "bg-white text-slate-500 hover:bg-red-50 hover:text-red-600"
      : "bg-emerald-600 text-white hover:bg-emerald-700";
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>{children}</button>;
}

function DateCalendar({ displayMonth, selectedDates, onToggle, onPrevMonth, onNextMonth }) {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const days = buildCalendarDays(displayMonth);
  const [year, month] = displayMonth.split("-");
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl bg-emerald-50 px-2 py-2 text-base font-bold text-slate-800">
        <button type="button" onClick={onPrevMonth} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-emerald-700 shadow-sm">前月</button>
        <div className="text-center">{year}年{Number(month)}月</div>
        <button type="button" onClick={onNextMonth} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-emerald-700 shadow-sm">次月</button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500">
        {weekdays.map((weekday) => <div key={weekday}>{weekday}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="h-11" />;
          const selected = selectedDates.includes(date);
          return <button key={date} type="button" onClick={() => onToggle(date)} className={`h-11 rounded-2xl text-base transition ${selected ? "bg-emerald-600 font-bold text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-orange-50"}`}>{Number(date.slice(-2))}</button>;
        })}
      </div>
    </div>
  );
}

function AuthShell({ subtitle, children }) {
  return (
    <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-orange-400 to-pink-500" />
        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Sowers FC System</p>
            <h1 className="mt-2 text-2xl font-black">教室管理システム</h1>
            {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
          </div>
          {children}
        </div>
      </Card>
    </div>
  );
}

function AuthScreen() {
  const [tab, setTab] = useState("login"); // login | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [schoolId, setSchoolId] = useState(schools[0].id);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setMessage(""); setOk(""); };
  const guard = () => {
    if (!supabase) { setMessage("Supabaseの環境変数が未設定です。Vercelに VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。"); return false; }
    return true;
  };

  const login = async () => {
    reset(); if (!guard()) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMessage("ログインできません。メールアドレスまたはパスワードを確認してください。");
  };

  const signup = async () => {
    reset(); if (!guard()) return;
    if (!displayName.trim()) { setMessage("氏名を入力してください。"); return; }
    if (password.length < 6) { setMessage("パスワードは6文字以上で設定してください。"); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName.trim(), school_id: schoolId } } });
    setBusy(false);
    if (error) { setMessage(`登録できません：${error.message}`); return; }
    if (!data.session) setOk("確認メールを送信しました。メール内のリンクから登録を完了してください。");
    // セッションが返った場合はAppがprofileを自動作成してログイン状態に進みます
  };

  const forgot = async () => {
    reset(); if (!guard()) return;
    if (!email) { setMessage("メールアドレスを入力してください。"); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setBusy(false);
    if (error) setMessage(`送信できません：${error.message}`);
    else setOk("再設定メールを送信しました。メールのリンクから新しいパスワードを設定してください。");
  };

  const Tabs = (
    <div className="grid grid-cols-2 gap-2">
      <Button variant={tab === "login" ? "primary" : "outline"} onClick={() => { setTab("login"); reset(); }} className="w-full">ログイン</Button>
      <Button variant={tab === "signup" ? "primary" : "outline"} onClick={() => { setTab("signup"); reset(); }} className="w-full">新規登録</Button>
    </div>
  );
  const Alerts = (
    <>
      {message && <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{message}</div>}
      {ok && <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{ok}</div>}
    </>
  );

  if (tab === "forgot") {
    return (
      <AuthShell subtitle="登録済みのメールアドレスに再設定リンクを送ります。">
        <div className="space-y-2">
          <FieldLabel>メールアドレス</FieldLabel>
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="例：teacher@example.com" />
        </div>
        {Alerts}
        <Button onClick={forgot} disabled={busy} className="w-full">再設定メールを送信</Button>
        <button type="button" onClick={() => { setTab("login"); reset(); }} className="w-full text-sm font-bold text-emerald-700 hover:text-emerald-800">ログインに戻る</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle={tab === "login" ? "メールアドレスとパスワードでログインしてください。" : "先生ご自身の情報を入力して登録してください。"}>
      {Tabs}
      {tab === "signup" && (
        <>
          <div className="space-y-2">
            <FieldLabel>氏名（フルネーム）</FieldLabel>
            <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例：沢野 太郎" />
          </div>
          <div className="space-y-2">
            <FieldLabel>担当教室</FieldLabel>
            <SelectInput value={schoolId} onChange={setSchoolId}>
              {schools.map((item) => <option key={item.id} value={item.id}>{item.area}｜{item.name}</option>)}
            </SelectInput>
          </div>
        </>
      )}
      <div className="space-y-2">
        <FieldLabel>メールアドレス</FieldLabel>
        <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="例：teacher@example.com" />
      </div>
      <div className="space-y-2">
        <FieldLabel>パスワード{tab === "signup" && "（6文字以上）"}</FieldLabel>
        <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード" />
      </div>
      {Alerts}
      {tab === "login" ? (
        <>
          <Button onClick={login} disabled={busy} className="w-full">ログイン</Button>
          <button type="button" onClick={() => { setTab("forgot"); reset(); }} className="w-full text-sm font-bold text-slate-500 hover:text-emerald-700">パスワードをお忘れですか？</button>
        </>
      ) : (
        <Button onClick={signup} disabled={busy} className="w-full">この内容で登録する</Button>
      )}
    </AuthShell>
  );
}

function PasswordRecoveryScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const update = async () => {
    setMessage("");
    if (!supabase) return;
    if (password.length < 6) { setMessage("パスワードは6文字以上で設定してください。"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setMessage(`更新できません：${error.message}`); return; }
    setMessage("パスワードを更新しました。ログインします...");
    setTimeout(onDone, 1200);
  };

  return (
    <AuthShell subtitle="新しいパスワードを設定してください。">
      <div className="space-y-2">
        <FieldLabel>新しいパスワード（6文字以上）</FieldLabel>
        <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="新しいパスワード" />
      </div>
      {message && <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>}
      <Button onClick={update} disabled={busy} className="w-full">パスワードを更新</Button>
    </AuthShell>
  );
}

export default function App() {
  return DEMO ? <DemoApp /> : <RealApp />;
}

// 実際のアプリに出す「デモを試す」入口。デモの「デモを終了」を押すと、この端末では表示しなくなる
const DEMO_HIDE_KEY = "fc_demo_hidden_v1";
function demoHidden() { try { return localStorage.getItem(DEMO_HIDE_KEY) === "1"; } catch { return false; } }
function endDemo() {
  try { localStorage.setItem(DEMO_HIDE_KEY, "1"); } catch { /* 保存できない環境では何もしない */ }
  window.location.href = window.location.pathname;
}
function DemoEntry() {
  if (DEMO || demoHidden()) return null;
  return (
    <a href="?demo=1" className="flex items-center justify-between gap-3 rounded-3xl border-2 border-dashed border-sky-300 bg-sky-50 p-4 text-left shadow-sm transition hover:bg-sky-100">
      <span>
        <span className="block text-base font-black text-sky-800">デモを試す（テスト教室）</span>
        <span className="mt-0.5 block text-xs leading-5 text-sky-800">源泉徴収（甲・乙）の設定と、先生からの見え方を本番データに触れずに試せます。経理担当の画面だけに表示されます。デモ画面の「デモを終了」を押すとこの案内は消えます。</span>
      </span>
      <Eye className="h-6 w-6 shrink-0 text-sky-600" />
    </a>
  );
}

// デモ：経理担当／テスト先生を切り替えて試せる（データはこの画面の中だけ・再読み込みで初期化）
function DemoApp() {
  const [role, setRole] = useState("admin");
  const [ver, setVer] = useState(0);
  const user = role === "admin" ? DEMO_ADMIN : DEMO_TEACHER;
  const session = { user: { id: user.id, email: role === "admin" ? "経理担当（デモ）" : "テスト先生（デモ）", user_metadata: {} } };
  return (
    <div>
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-2 bg-slate-900 px-3 py-2 text-xs font-bold text-white print:hidden">
        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-slate-900">デモ</span>
        <span>本番データには接続していません</span>
        <button type="button" onClick={() => { setRole("admin"); setVer((v) => v + 1); }} className={`rounded-full px-3 py-1 ${role === "admin" ? "bg-emerald-500" : "bg-white/15"}`}>経理担当で見る</button>
        <button type="button" onClick={() => { setRole("teacher"); setVer((v) => v + 1); }} className={`rounded-full px-3 py-1 ${role === "teacher" ? "bg-emerald-500" : "bg-white/15"}`}>テスト先生で見る</button>
        <button type="button" onClick={() => { resetDemo(); setVer((v) => v + 1); }} className="rounded-full bg-white/15 px-3 py-1">最初の状態に戻す</button>
        <button type="button" onClick={endDemo} className="rounded-full bg-red-500 px-3 py-1">デモを終了</button>
      </div>
      {role === "admin"
        ? <AdminSystem key={`a${ver}`} session={session} profile={DEMO_ADMIN} />
        : <MainSystem key={`t${ver}`} session={session} profile={DEMO_TEACHER} setProfile={() => {}} />}
    </div>
  );
}

function RealApp() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appReady, setAppReady] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAppReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setAppReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function ensureProfile() {
      if (!session?.user || !supabase) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (data) { setProfile(data); return; }
      const meta = session.user.user_metadata || {};
      const newProfile = {
        id: session.user.id,
        display_name: meta.display_name || session.user.email,
        school_id: meta.school_id || schools[0].id,
        role: "teacher",
      };
      const { data: inserted } = await supabase.from("profiles").insert(newProfile).select().maybeSingle();
      setProfile(inserted || newProfile);
    }
    ensureProfile();
  }, [session]);

  if (!appReady) return <div className="p-6">読み込み中...</div>;
  if (recovery) return <PasswordRecoveryScreen onDone={() => setRecovery(false)} />;
  if (!session) return <AuthScreen />;
  if (!profile) return <div className="p-6">プロフィール読み込み中...</div>;

  if (profile.role === "admin") return <AdminSystem session={session} profile={profile} />;
  return <MainSystem session={session} profile={profile} setProfile={setProfile} />;
}

function MainSystem({ session, profile, setProfile, viewAs = null, onExitPreview = null }) {
  // viewAs = { userId, schoolId, targetMonth } … 経理担当が「先生からの見え方」を閲覧専用で確認するとき
  const readOnly = !!viewAs;
  const uid = viewAs ? viewAs.userId : session.user.id;
  const allowedSchool = getSchoolById(viewAs ? viewAs.schoolId : profile.school_id);
  const [mode, setMode] = useState(viewAs ? "invoice" : "dashboard");
  const [schoolId, setSchoolId] = useState(allowedSchool.id);
  const school = getSchoolById(schoolId);
  const recipient = "Sowers株式会社";

  const [invoiceDate, setInvoiceDate] = useState(todayString());
  const [targetMonth, setTargetMonth] = useState(viewAs?.targetMonth || monthString());
  const [issuer, setIssuer] = useState(profile.display_name || "");
  const [invoiceNo, setInvoiceNo] = useState(`SW-${todayString().split("-").join("")}`);
  const [bankInfo, setBankInfo] = useState("");
  const [notes, setNotes] = useState("");
  const [people, setPeople] = useState([makePerson(school.defaultRate, "")]);
  const [activePersonId, setActivePersonId] = useState(null);
  const [openCalendarKey, setOpenCalendarKey] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(viewAs?.targetMonth || monthString());
  const [expenses, setExpenses] = useState([makeExpenseRow()]);
  const [saveMessage, setSaveMessage] = useState("");
  const [savedMonths, setSavedMonths] = useState([]);
  const [status, setStatus] = useState("draft");
  const [submitting, setSubmitting] = useState(false);
  const [withholding, setWithholding] = useState({});
  const [paidAt, setPaidAt] = useState(null); // 経理が「振込済み」にした日時（あれば編集不可）
  const [myMonthRecords, setMyMonthRecords] = useState([]); // 給与明細用：同じ月の自分の他教室の請求書
  useEffect(() => {
    if (!supabase || status !== "submitted") { setMyMonthRecords([]); return; }
    supabase.from("invoice_months").select("*").eq("user_id", uid).eq("target_month", targetMonth)
      .then(({ data }) => setMyMonthRecords(data || []));
  }, [uid, targetMonth, status]);

  const [students, setStudents] = useState([]);
  const [rosterPage, setRosterPage] = useState(1);
  const [studentMessage, setStudentMessage] = useState("");

  const actualActivePersonId = activePersonId || people[0]?.id;
  const activePerson = people.find((person) => person.id === actualActivePersonId) || people[0];

  const totals = useMemo(() => {
    const workTotal = people.reduce((sum, person) => sum + personSubtotal(person), 0);
    const totalWorkDays = people.reduce((sum, person) => sum + personWorkDays(person), 0);
    const expenseTotal = expenses.reduce((sum, expense) => sum + safeNumber(expense.quantity) * safeNumber(expense.amount), 0);
    return { workTotal, totalWorkDays, expenseTotal, total: workTotal + expenseTotal };
  }, [people, expenses]);

  const classCounts = useMemo(() => {
    return students.filter((s) => (s.status || "active") === "active").reduce((acc, student) => {
      const key = student.class_name || "未設定";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [students]);

  const studentStats = useMemo(() => {
    const active = students.filter((s) => (s.status || "active") === "active");
    const suspended = students.filter((s) => s.status === "suspended");
    const withdrawn = students.filter((s) => s.status === "withdrawn");
    const monthlyRevenue = active.reduce((sum, s) => sum + safeNumber(s.monthly_fee), 0);
    return { activeCount: active.length, suspendedCount: suspended.length, withdrawnCount: withdrawn.length, monthlyRevenue };
  }, [students]);

  const visibleStudents = students;

  // メインの先生の1日単価を、クラスの在籍人数（生徒名簿の「在籍」）から自動で合わせる
  const enrollRule = usesEnrollRule(schoolId);
  useEffect(() => {
    if (!enrollRule) return;
    setPeople((prev) => {
      let changed = false;
      const next = prev.map((person) => ({ ...person, works: person.works.map((work) => {
        if (work.role !== "main") return work;
        const rate = mainRateFor(countClassStudents(students, work.className));
        if (safeNumber(work.rate) === rate) return work;
        changed = true;
        return { ...work, rate };
      }) }));
      return changed ? next : prev;
    });
  }, [students, people, enrollRule]);

  useEffect(() => {
    loadInvoice();
    loadStudents();
    loadSavedMonths();
  }, [schoolId, targetMonth]);

  // この教室で保存済みの月の一覧（後から見返すため）
  async function loadSavedMonths() {
    if (!supabase) return;
    const { data } = await supabase
      .from("invoice_months")
      .select("target_month, updated_at")
      .eq("user_id", uid)
      .eq("school_id", schoolId)
      .order("target_month", { ascending: false });
    setSavedMonths(data || []);
  }

  async function loadInvoice() {
    if (!supabase) return;
    const { data } = await supabase
      .from("invoice_months")
      .select("*")
      .eq("user_id", uid)
      .eq("school_id", schoolId)
      .eq("target_month", targetMonth)
      .maybeSingle();

    if (data) {
      setInvoiceDate(data.invoice_date || todayString());
      setInvoiceNo(data.invoice_no || `SW-${todayString().split("-").join("")}`);
      setIssuer(data.issuer || profile.display_name || "");
      setBankInfo(data.bank_info || "");
      setNotes(data.notes || "");
      setPeople(Array.isArray(data.people) && data.people.length ? mergeSamePeople(data.people) : [makePerson(school.defaultRate, "")]);
      setExpenses(Array.isArray(data.expenses) && data.expenses.length ? data.expenses : [makeExpenseRow()]);
      setActivePersonId(null);
      setStatus(data.status === "submitted" ? "submitted" : "draft");
      setWithholding(data.withholding && typeof data.withholding === "object" ? data.withholding : {});
      setPaidAt(data.paid_at || null);
    } else {
      const defaultClassName = school.classes[0]?.name || "A";
      setPeople([makePerson(school.defaultRate, "")]);
      setPeople([{ ...makePerson(school.defaultRate, ""), works: [newWorkFor(school)] }]);
      setExpenses([makeExpenseRow()]);
      setNotes("");
      setStatus("draft");
      setWithholding({});
      setPaidAt(null);
    }
  }

  async function saveInvoice() {
    if (!supabase || readOnly || paidAt) return;
    setSaveMessage("保存中...");
    const mergedPeople = mergeSamePeople(people);
    const didMerge = mergedPeople.length < people.length;
    if (didMerge) { setPeople(mergedPeople); setActivePersonId(mergedPeople[0]?.id || null); }
    const payload = {
      user_id: session.user.id,
      school_id: schoolId,
      target_month: targetMonth,
      invoice_date: invoiceDate,
      invoice_no: invoiceNo,
      issuer,
      bank_info: bankInfo,
      notes,
      people: mergedPeople,
      expenses,
      status: "draft",
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("invoice_months").upsert(payload, { onConflict: "user_id,school_id,target_month" });
    setSaveMessage(error ? `保存エラー：${error.message}` : `${targetMonth} 分を保存しました（同じ月は上書きされます）。${didMerge ? "同じ名前の方は1人にまとめました。" : ""}`);
    if (!error) { setStatus("draft"); loadSavedMonths(); }
  }

  async function submitInvoice() {
    if (!supabase || readOnly || paidAt) return;
    if (!window.confirm("請求書を提出します。生徒名簿は最新の状態に更新しましたか？\nこの時点の名簿が管理者に記録されます。よろしければ「OK」を押してください。")) return;
    setSubmitting(true);
    setSaveMessage("提出中...");
    const mergedPeople = mergeSamePeople(people);
    const didMerge = mergedPeople.length < people.length;
    if (didMerge) { setPeople(mergedPeople); setActivePersonId(mergedPeople[0]?.id || null); }
    const payload = {
      user_id: session.user.id,
      school_id: schoolId,
      target_month: targetMonth,
      invoice_date: invoiceDate,
      invoice_no: invoiceNo,
      issuer,
      bank_info: bankInfo,
      notes,
      people: mergedPeople,
      expenses,
      roster: (students || []).map((s) => ({ id: s.id, full_name: s.full_name, class_name: s.class_name, join_month: s.join_month, status: s.status, page_no: s.page_no })),
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("invoice_months").upsert(payload, { onConflict: "user_id,school_id,target_month" });
    setSubmitting(false);
    if (error) { setSaveMessage("提出エラー：" + error.message); return; }
    setStatus("submitted");
    setSaveMessage(targetMonth + " 分を提出しました。管理者が確認できます。" + (didMerge ? "同じ名前の方は1人にまとめました。" : ""));
    loadSavedMonths();
  }

  async function copyPreviousMonth() {
    if (!supabase || readOnly) return;
    const prevMonth = addMonths(targetMonth, -1);
    const { data, error } = await supabase
      .from("invoice_months")
      .select("*")
      .eq("user_id", uid)
      .eq("school_id", schoolId)
      .eq("target_month", prevMonth)
      .maybeSingle();

    if (error || !data) {
      setSaveMessage("前月データが見つかりません。");
      return;
    }

    const copiedPeople = (data.people || []).map((person) => ({
      ...person,
      id: uniqueId(),
      works: (person.works || []).map((work) => ({ ...work, id: uniqueId(), dates: [] })),
    }));
    const copiedExpenses = (data.expenses || []).map((expense) => ({ ...expense, id: uniqueId(), amount: "", quantity: expense.quantity || 1 }));

    setPeople(copiedPeople.length ? copiedPeople : [makePerson(school.defaultRate, "")]);
    setExpenses(copiedExpenses.length ? copiedExpenses : [makeExpenseRow()]);
    setIssuer(data.issuer || issuer);
    setBankInfo(data.bank_info || bankInfo);
    setNotes("");
    setActivePersonId(null);
    setSaveMessage(`${prevMonth} の内容をコピーしました。出勤日と経費金額は今月分に入力してください。`);
  }

  async function loadStudents() {
    if (!supabase) return;
    const { data } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", uid)
      .eq("school_id", schoolId)
      .order("page_no", { ascending: true })
      .order("created_at", { ascending: false });
    setStudents(data || []);
  }

  async function addStudent() {
    if (!supabase || readOnly) return;
    const { data, error } = await supabase
      .from("students")
      .insert({
        user_id: session.user.id,
        school_id: schoolId,
        page_no: rosterPage,
        full_name: "新規生徒",
        join_month: targetMonth,
        class_name: school.classes[0]?.name || "",
        status: "active",
        enrollment_fee: 0,
        monthly_fee: 0,
      })
      .select()
      .single();
    if (error) {
      setStudentMessage(`追加エラー：${error.message}`);
      return;
    }
    setStudents((prev) => [data, ...prev]);
    setStudentMessage("生徒を追加しました。");
  }

  async function updateStudent(id, key, value) {
    if (readOnly) return;
    setStudents((prev) => prev.map((student) => (student.id === id ? { ...student, [key]: value } : student)));
    if (!supabase) return;
    await supabase.from("students").update({ [key]: value, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", uid);
  }

  async function deleteStudent(id) {
    if (readOnly) return;
    setStudents((prev) => prev.filter((student) => student.id !== id));
    if (!supabase) return;
    await supabase.from("students").delete().eq("id", id).eq("user_id", uid);
  }

  async function logout() {
    if (readOnly) { onExitPreview && onExitPreview(); return; }
    await supabase.auth.signOut();
  }
  const whCalc = calcWithholding(people, withholding);

  const updatePerson = (personId, key, value) => setPeople((prev) => prev.map((person) => (person.id === personId ? { ...person, [key]: value } : person)));
  const updateWork = (personId, workId, key, value) => {
    setPeople((prev) => prev.map((person) =>
      person.id === personId
        ? { ...person, works: person.works.map((work) => (work.id === workId ? { ...work, [key]: value } : work)) }
        : person
    ));
  };
  const updateWorkFields = (personId, workId, fields) => setPeople((prev) => prev.map((person) => person.id === personId ? { ...person, works: person.works.map((work) => (work.id === workId ? { ...work, ...fields } : work)) } : person));
  const changeWorkRole = (personId, work, role) => {
    if (!role) return;
    const cls = work.className || school.classes[0]?.name || "A";
    updateWorkFields(personId, work.id, { role, className: cls, rate: role === "sub" ? SUB_DEFAULT_RATE : mainRateFor(countClassStudents(students, cls)), workDetail: workLabel(cls, role) });
  };
  const changeWorkClass = (personId, work, className) => {
    if (!className) return;
    updateWorkFields(personId, work.id, { className, workDetail: workLabel(className, work.role), ...(work.role === "main" ? { rate: mainRateFor(countClassStudents(students, className)) } : {}) });
  };
  const addPerson = () => {
    const defaultClassName = school.classes[0]?.name || "A";
    const next = { ...makePerson(school.defaultRate, ""), works: [newWorkFor(school)] };
    setPeople((prev) => [...prev, next]);
    setActivePersonId(next.id);
  };
  const removePerson = (personId) => {
    setPeople((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((person) => person.id !== personId);
      setActivePersonId(next[0]?.id || null);
      return next;
    });
  };
  const addWork = (personId) => {
    const defaultClassName = school.classes[0]?.name || "A";
    setPeople((prev) => prev.map((person) => person.id === personId ? { ...person, works: [...person.works, newWorkFor(school)] } : person));
  };
  const removeWork = (personId, workId) => {
    setPeople((prev) => prev.map((person) => person.id === personId ? { ...person, works: person.works.length === 1 ? person.works : person.works.filter((work) => work.id !== workId) } : person));
  };
  const updateExpense = (id, key, value) => setExpenses((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  const addExpense = () => setExpenses((prev) => [...prev, makeExpenseRow()]);
  const removeExpense = (id) => setExpenses((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== id)));

  const printInvoice = () => window.print();

  async function downloadPdf() {
    // 継ぎ目のない「1枚の長いページ」として保存する
    await exportElementAsLongPdf("invoice-pdf-area", `${invoiceNo || "invoice"}.pdf`, setSaveMessage);
  }

  if (mode === "dashboard") {
    return (
      <DashboardHome
        profile={profile}
        session={session}
        school={school}
        schoolId={schoolId}
        setSchoolId={setSchoolId}
        targetMonth={targetMonth}
        studentStats={studentStats}
        totals={totals}
        onSelect={setMode}
        logout={logout}
      />
    );
  }

  if (["trend", "sales", "news", "manual"].includes(mode)) {
    return (
      <PlaceholderPage
        mode={mode}
        school={school}
        studentStats={studentStats}
        totals={totals}
        students={students}
        onBack={() => setMode("dashboard")}
      />
    );
  }

  if (mode === "account" && !readOnly) {
    return (
      <AccountPanel
        session={session}
        profile={profile}
        setProfile={setProfile}
        onBack={() => setMode("dashboard")}
        logout={logout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-4 md:p-8 print:bg-white print:p-0">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_560px] print:block">
        <section className="space-y-4 print:hidden">
          <div className="space-y-3">
            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="mb-4 h-2 w-24 rounded-full bg-gradient-to-r from-emerald-500 via-orange-400 to-pink-500" />
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Sowers FC System</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">教室管理システム</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">{school.name} / {profile.display_name || session.user.email}</p>
            </div>

            {readOnly ? (
              <div className="rounded-3xl border-2 border-sky-300 bg-sky-50 p-4">
                <p className="flex items-center gap-1 text-sm font-black text-sky-800"><Eye className="h-4 w-4" />先生からの見え方（閲覧専用）</p>
                <p className="mt-1 text-xs leading-5 text-sky-800">「{profile.display_name}」さんのアカウントで表示される画面です。ここでは入力・保存はできません。</p>
                <Button variant="outline" onClick={onExitPreview} className="mt-3 w-full"><ChevronLeft className="mr-1 h-4 w-4" />経理の画面に戻る</Button>
              </div>
            ) : (
              <button type="button" onClick={() => setMode("dashboard")} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-800"><ChevronLeft className="h-4 w-4" />ダッシュボードに戻る</button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant={mode === "invoice" ? "primary" : "outline"} onClick={() => setMode("invoice")} className="w-full"><FileText className="mr-1 h-4 w-4" />請求書</Button>
              <Button variant={mode === "students" ? "primary" : "outline"} onClick={() => setMode("students")} className="w-full"><Users className="mr-1 h-4 w-4" />生徒名簿</Button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {mode === "invoice" && !readOnly && !paidAt && <Button variant="outline" onClick={saveInvoice} className="w-full"><Save className="mr-1 h-4 w-4" />下書き保存</Button>}
              {mode === "invoice" && <Button onClick={downloadPdf} className="w-full"><FileText className="mr-1 h-4 w-4" />PDF保存</Button>}
              {mode === "invoice" && <Button variant="outline" onClick={printInvoice} className="w-full"><Printer className="mr-1 h-4 w-4" />印刷</Button>}
              {!readOnly && <Button variant="ghost" onClick={logout} className="w-full"><LogOut className="mr-1 h-4 w-4" />ログアウト</Button>}
            </div>
            {mode === "invoice" && (
              <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-700">{targetMonth} の状態</span>
                  {paidAt
                    ? <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">お振込済み（{shortDate(paidAt)}）</span>
                    : status === "submitted"
                    ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">提出済み（お振込待ち）</span>
                    : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">下書き（未提出）</span>}
                </div>
                {paidAt ? <p className="mt-2 text-xs leading-5 text-slate-500">この月の請求書はお振込が完了しているため変更できません。修正が必要な場合は経理担当までご連絡ください。</p> : <p className="mt-2 text-xs leading-5 text-slate-500">「下書き保存」はあなただけに見えます。内容が確定したら「提出」を押すと管理者が確認できます。提出後に下書き保存すると未提出に戻るので、もう一度提出してください。</p>}
                {whCalc.hasAny && (
                  <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
                    <p className="font-bold">経理担当者が源泉徴収税を設定しました</p>
                    {whCalc.rows.filter((r) => r.entry && r.entry.type !== "none").map((r) => <p key={r.key}>{r.name}：源泉徴収税 −{yen(r.tax)}</p>)}
                    <p className="mt-1 font-bold">お振込額は {yen(totals.total - whCalc.taxTotal)}（請求書の「差引お振込額」）です。</p>
                  </div>
                )}
                {!readOnly && !paidAt && <Button onClick={submitInvoice} disabled={submitting} className="mt-3 w-full">{status === "submitted" ? "この内容で再提出する" : "この内容で提出する（確定）"}</Button>}
              </div>
            )}
            {saveMessage && <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{saveMessage}</div>}
            {mode === "invoice" && status === "submitted" && <PayslipButtons records={[...myMonthRecords.filter((r) => r.school_id !== schoolId), { id: "current", school_id: schoolId, status, people, expenses, withholding, target_month: targetMonth, paid_at: paidAt, roster: students }]} />}
          </div>

          <fieldset disabled={readOnly || (mode === "invoice" && !!paidAt)} className={`min-w-0 space-y-4 ${readOnly || (mode === "invoice" && paidAt) ? "opacity-80" : ""}`}>
          {mode === "invoice" ? (
            <>
              <Card>
                <div className="space-y-3 p-4 md:p-5">
                  <div className="h-1.5 w-20 rounded-full bg-emerald-500" />
                  <h2 className="text-lg font-black">保存済みの月</h2>
                  <p className="text-xs text-slate-500">月をタップすると、その月の保存内容を表示します。請求書は月ごとに1件で、同じ月に保存すると上書きされます。</p>
                  {savedMonths.length ? (
                    <div className="flex flex-wrap gap-2">
                      {savedMonths.map((m) => (
                        <button key={m.target_month} type="button" onClick={() => { setTargetMonth(m.target_month); setCalendarMonth(m.target_month); }} className={`rounded-full border px-3 py-1.5 text-sm font-bold transition ${m.target_month === targetMonth ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50"}`}>{m.target_month}</button>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">まだ保存された月がありません。下で内容を入力し「保存」すると、ここに月が並びます。</p>}
                </div>
              </Card>

              <Card>
                <div className="space-y-4 p-4 md:p-5">
                  <div className="h-1.5 w-20 rounded-full bg-pink-500" />
                  <h2 className="text-lg font-black">1. 基本情報</h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel>教室名</FieldLabel>
                      <SelectInput value={schoolId} onChange={setSchoolId}>
                        {schools.map((item) => <option key={item.id} value={item.id}>{item.area}｜{item.name}</option>)}
                      </SelectInput>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>対象月</FieldLabel>
                      <TextInput type="month" value={targetMonth} onChange={(event) => { setTargetMonth(event.target.value); setCalendarMonth(event.target.value); }} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>請求日</FieldLabel>
                      <TextInput type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>請求書番号</FieldLabel>
                      <TextInput value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>宛名</FieldLabel>
                      <TextInput value={recipient} readOnly className="bg-slate-100" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel>請求者名</FieldLabel>
                      <TextInput value={issuer} onChange={(event) => setIssuer(event.target.value)} placeholder="例：〇〇体操教室 代表 〇〇〇〇" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel>振込先</FieldLabel>
                      <TextAreaInput value={bankInfo} onChange={(event) => setBankInfo(event.target.value)} placeholder="例：〇〇銀行 〇〇支店 普通 1234567 〇〇〇〇" />
                    </div>
                  </div>
                  <Button onClick={copyPreviousMonth} variant="outline" className="w-full">前月の人物・業務をコピー</Button>
                </div>
              </Card>

              <Card>
                <div className="space-y-4 p-4 md:p-5">
                  <div className="grid grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <div className="h-1.5 w-20 rounded-full bg-orange-500" />
                      <h2 className="mt-3 text-lg font-black">2. 人物ごとの出勤情報</h2>
                    </div>
                    <Button onClick={addPerson} className="w-full sm:w-auto"><UserPlus className="mr-1 h-4 w-4" />人物を追加</Button>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {people.map((person, index) => {
                      const isActive = person.id === actualActivePersonId;
                      return <button key={person.id} type="button" onClick={() => setActivePersonId(person.id)} className={`shrink-0 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${isActive ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50"}`}>{person.name || `人物${index + 1}`}<br /><span className="text-xs opacity-80">{yen(personSubtotal(person))}</span></button>;
                    })}
                  </div>

                  {activePerson && (
                    <div className="space-y-4 rounded-3xl border border-orange-200 bg-white p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                        <div className="space-y-1">
                          <FieldLabel>氏名（フルネーム）</FieldLabel>
                          <TextInput value={activePerson.name} onChange={(event) => updatePerson(activePerson.id, "name", event.target.value)} placeholder="例：沢野 太郎" />
                        </div>
                        <Button variant="ghost" onClick={() => removePerson(activePerson.id)} disabled={people.length === 1} className="w-full sm:w-auto"><Trash2 className="mr-1 h-4 w-4" />この人物を削除</Button>
                      </div>

                      <div className="space-y-3">
                        {activePerson.works.map((work, workIndex) => {
                          const calendarKey = `${activePerson.id}-${work.id}`;
                          const isCalendarOpen = openCalendarKey === calendarKey;
                          const workDays = work.dates.length;
                          const amount = workDays * safeNumber(work.rate);

                          return (
                            <div key={work.id} className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold">担当業務 {workIndex + 1}</p>
                                <Button variant="ghost" onClick={() => removeWork(activePerson.id, work.id)} disabled={activePerson.works.length === 1} className="min-h-10 px-3 py-2 text-sm"><Trash2 className="mr-1 h-4 w-4" />削除</Button>
                              </div>

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                                {enrollRule && (
                                  <>
                                    <div className="space-y-1 md:col-span-3">
                                      <FieldLabel>役割</FieldLabel>
                                      <SelectInput value={work.role || ""} onChange={(value) => changeWorkRole(activePerson.id, work, value)}>
                                        {!work.role && <option value="">手入力（以前のデータ）</option>}
                                        <option value="main">メイン</option>
                                        <option value="sub">サブ</option>
                                      </SelectInput>
                                    </div>
                                    <div className="space-y-1 md:col-span-3">
                                      <FieldLabel>クラス</FieldLabel>
                                      <SelectInput value={work.className || ""} onChange={(value) => changeWorkClass(activePerson.id, work, value)}>
                                        {!work.className && <option value="">選択してください</option>}
                                        {school.classes.map((c) => <option key={c.name} value={c.name}>{c.name}クラス</option>)}
                                      </SelectInput>
                                    </div>
                                  </>
                                )}
                                <div className="space-y-1 md:col-span-2">
                                  <FieldLabel>担当したクラス・業務名</FieldLabel>
                                  <TextInput value={work.workDetail} onChange={(event) => updateWork(activePerson.id, work.id, "workDetail", event.target.value)} placeholder="例：Aクラス メイン" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <FieldLabel>出勤日</FieldLabel>
                                  <button type="button" onClick={() => setOpenCalendarKey(isCalendarOpen ? null : calendarKey)} className="flex min-h-14 w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-base outline-none hover:bg-slate-50">
                                    <span className={work.dates.length ? "text-slate-900" : "text-slate-400"}>{work.dates.length ? work.dates.map(formatJapaneseDate).join("、") : "タップして日付を選択"}</span>
                                    <CalendarDays className="h-5 w-5 shrink-0 text-slate-500" />
                                  </button>
                                </div>
                                <div className="space-y-1">
                                  <FieldLabel>{enrollRule && work.role === "main" ? "1日単価（自動）" : "1日単価"}</FieldLabel>
                                  <TextInput type="number" value={work.rate} readOnly={enrollRule && work.role === "main"} className={enrollRule && work.role === "main" ? "bg-slate-100" : ""} onChange={(event) => updateWork(activePerson.id, work.id, "rate", event.target.value)} />
                                </div>
                                {enrollRule && work.role === "main" && (
                                  <p className="md:col-span-6 rounded-2xl bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">{work.className}クラスの在籍 {countClassStudents(students, work.className)}人 → 1日 {yen(work.rate)}（1〜4人は2,000円、5人目から1人ごとに+500円。人数は生徒名簿の「在籍」から数えます）</p>
                                )}
                                {isCalendarOpen && (
                                  <div className="md:col-span-6">
                                    <DateCalendar displayMonth={calendarMonth} selectedDates={work.dates} onToggle={(date) => updateWork(activePerson.id, work.id, "dates", toggleDate(work.dates, date))} onPrevMonth={() => setCalendarMonth((current) => addMonths(current, -1))} onNextMonth={() => setCalendarMonth((current) => addMonths(current, 1))} />
                                  </div>
                                )}
                                <div className="space-y-1 md:col-span-6">
                                  <FieldLabel>備考</FieldLabel>
                                  <TextInput value={work.memo} onChange={(event) => updateWork(activePerson.id, work.id, "memo", event.target.value)} placeholder="任意" />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-2 rounded-2xl bg-white px-4 py-3 text-sm sm:grid-cols-2">
                                <span>出勤日数：<b>{workDays}日</b></span>
                                <span>小計：<b>{yen(amount)}</b></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <Button onClick={() => addWork(activePerson.id)} variant="outline" className="w-full"><Plus className="mr-1 h-4 w-4" />この人物に担当業務を追加</Button>

                      <div className="rounded-3xl bg-emerald-600 p-4 text-white">
                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <span>人物別出勤日数：<b>{personWorkDays(activePerson)}日</b></span>
                          <span>人物別合計：<b>{yen(personSubtotal(activePerson))}</b></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <div className="space-y-4 p-4 md:p-5">
                  <div className="grid grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <div className="h-1.5 w-20 rounded-full bg-emerald-500" />
                      <h2 className="mt-3 text-lg font-black">3. 経費</h2>
                    </div>
                    <Button onClick={addExpense} className="w-full sm:w-auto"><Plus className="mr-1 h-4 w-4" />経費を追加</Button>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    集金・控除（例：教室で受け取った現金をお給料から差し引く場合）は、「金額」欄にマイナスで入力してください（例：-9000）。合計から自動で差し引かれます。備考に文章で書いても金額としては計算されません。
                  </div>

                  <div className="space-y-3">
                    {expenses.map((expense, index) => {
                      const expenseSubtotal = safeNumber(expense.quantity) * safeNumber(expense.amount);
                      return (
                        <div key={expense.id} className="space-y-3 rounded-3xl border border-emerald-200 bg-white p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold">経費 {index + 1}</p>
                            <Button variant="ghost" onClick={() => removeExpense(expense.id)} disabled={expenses.length === 1} className="min-h-10 px-3 py-2 text-sm"><Trash2 className="mr-1 h-4 w-4" />削除</Button>
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                            <div className="space-y-1 md:col-span-2"><FieldLabel>申請者</FieldLabel><TextInput value={expense.applicant} onChange={(e) => updateExpense(expense.id, "applicant", e.target.value)} placeholder="例：沢野 太郎" /></div>
                            <div className="space-y-1 md:col-span-2"><FieldLabel>経費の項目</FieldLabel><TextInput value={expense.item} onChange={(e) => updateExpense(expense.id, "item", e.target.value)} placeholder="例：○○体育館（11:00-14:00）" /></div>
                            <div className="space-y-1"><FieldLabel>数量</FieldLabel><TextInput type="number" value={expense.quantity} onChange={(e) => updateExpense(expense.id, "quantity", e.target.value)} /></div>
                            <div className="space-y-1"><FieldLabel>金額</FieldLabel><TextInput type="number" step="10" value={expense.amount} onChange={(e) => updateExpense(expense.id, "amount", e.target.value)} placeholder="例：1000" /></div>
                            <div className="space-y-1 md:col-span-6"><FieldLabel>備考</FieldLabel><TextInput value={expense.memo} onChange={(e) => updateExpense(expense.id, "memo", e.target.value)} placeholder="任意" /></div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right text-sm">小計：<b>{yen(expenseSubtotal)}</b></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              <Card>
                <div className="space-y-3 p-4 md:p-5">
                  <div className="h-1.5 w-20 rounded-full bg-slate-400" />
                  <h2 className="text-lg font-black">4. 備考</h2>
                  <TextAreaInput value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="必要な場合のみ入力" />
                </div>
              </Card>
            </>
          ) : (
            <StudentRoster
              school={school}
              targetMonth={targetMonth}
              students={students}
              visibleStudents={visibleStudents}
              rosterPage={rosterPage}
              setRosterPage={setRosterPage}
              addStudent={addStudent}
              updateStudent={updateStudent}
              deleteStudent={deleteStudent}
              classCounts={classCounts}
              studentStats={studentStats}
              message={studentMessage}
            />
          )}
          </fieldset>
        </section>

        <section className="space-y-4 print:space-y-0">
          <InvoicePreview
            recipient={recipient}
            invoiceNo={invoiceNo}
            invoiceDate={invoiceDate}
            targetMonth={targetMonth}
            issuer={issuer}
            school={school}
            people={people}
            expenses={expenses}
            totals={totals}
            bankInfo={bankInfo}
            notes={notes}
            withholding={withholding}
          />
        </section>
      </div>
    </div>
  );
}

function StudentRoster({ school, targetMonth, students, visibleStudents, rosterPage, setRosterPage, addStudent, updateStudent, deleteStudent, classCounts, studentStats, message }) {
  const [pdfMsg, setPdfMsg] = useState("");
  // 並び順：クラス順（school.classes の順）→ 同クラス内は入会が古い順
  const classOrder = (school.classes || []).map((c) => c.name);
  const rankClass = (n) => { const i = classOrder.indexOf(n); return i < 0 ? 999 : i; };
  const sortedStudents = [...students].sort((a, b) => {
    const ca = rankClass(a.class_name), cb = rankClass(b.class_name);
    if (ca !== cb) return ca - cb;
    const cn = (a.class_name || "").localeCompare(b.class_name || "");
    if (cn !== 0) return cn;
    return (a.join_month || "9999-99").localeCompare(b.join_month || "9999-99");
  });
  return (
    <Card>
      <div className="space-y-4 p-4 md:p-5">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-between">
          <div>
            <div className="h-1.5 w-20 rounded-full bg-orange-500" />
            <h2 className="mt-3 text-lg font-black">生徒名簿</h2>
            <p className="mt-1 text-xs text-slate-500">氏名・入会月・継続期間・クラスを管理できます。</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex">
            <Button variant="outline" onClick={() => exportElementAsLongPdf("roster-pdf-area", `${school.area}｜${school.name}_生徒名簿.pdf`, setPdfMsg)} className="w-full sm:w-auto"><FileText className="mr-1 h-4 w-4" />PDF保存</Button>
            <Button onClick={addStudent} className="w-full sm:w-auto"><Plus className="mr-1 h-4 w-4" />生徒を追加</Button>
          </div>
        </div>

        {message && <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>}
        {pdfMsg && <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{pdfMsg}</div>}

        <div id="roster-pdf-area" className="space-y-4 bg-white p-4">
          <div className="border-b-2 border-orange-500 pb-2">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600">Sowers FC System</p>
            <h3 className="text-lg font-black text-slate-900">{school.area}｜{school.name}　生徒名簿</h3>
            <p className="text-xs text-slate-500">対象月：{targetMonth}</p>
          </div>

        {studentStats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">在籍</p><p className="text-xl font-black text-emerald-800">{studentStats.activeCount}名</p></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-700">休会</p><p className="text-xl font-black text-amber-800">{studentStats.suspendedCount}名</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-600">退会</p><p className="text-xl font-black text-slate-700">{studentStats.withdrawnCount}名</p></div>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-sm font-bold">クラス人数</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.keys(classCounts).length ? Object.entries(classCounts).map(([className, count]) => (
              <div key={className} className="rounded-2xl bg-white p-3 text-sm font-bold">{className}：{count}名</div>
            )) : <div className="text-sm text-slate-500">まだ生徒が登録されていません。</div>}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold">名簿一覧（全{students.length}名）</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.3fr_0.6fr_0.8fr_0.9fr_0.6fr] gap-1 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">
              <span>氏名</span><span>クラス</span><span>入会月</span><span>継続期間</span><span>状態</span>
            </div>
            {sortedStudents.length ? sortedStudents.map((s, i) => {
              const st = s.status || "active";
              const stColor = st === "active" ? "text-emerald-700" : st === "suspended" ? "text-amber-700" : "text-slate-400";
              return (
                <div key={s.id} className={`grid grid-cols-[1.3fr_0.6fr_0.8fr_0.9fr_0.6fr] items-center gap-1 px-3 py-2 text-sm ${i % 2 ? "bg-white" : "bg-slate-50/60"}`}>
                  <span className="font-bold break-words" style={{ wordBreak: "auto-phrase" }}>{s.full_name || "（未入力）"}</span>
                  <span className="break-words text-slate-600">{s.class_name || "-"}</span>
                  <span className="text-slate-600">{s.join_month || "-"}</span>
                  <span className="text-slate-600">{monthsBetween(s.join_month, targetMonth) || "-"}</span>
                  <span className={`font-bold ${stColor}`}>{studentStatusLabel(st)}</span>
                </div>
              );
            }) : <div className="px-3 py-4 text-sm text-slate-500">生徒が登録されていません。</div>}
          </div>
        </div>
        </div>

        <p className="text-sm font-bold text-slate-500">名簿の編集</p>
        <div className="space-y-3">
          {visibleStudents.map((student) => {
            const status = student.status || "active";
            const statusStyle = status === "active" ? "border-emerald-300 bg-emerald-50" : status === "suspended" ? "border-amber-300 bg-amber-50" : "border-slate-300 bg-slate-100";
            return (
            <div key={student.id} className={`space-y-3 rounded-3xl border p-4 ${statusStyle}`}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                <div className="space-y-1 md:col-span-2"><FieldLabel>生徒氏名</FieldLabel><TextInput value={student.full_name} onChange={(e) => updateStudent(student.id, "full_name", e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>入会月</FieldLabel><TextInput type="month" value={student.join_month || ""} onChange={(e) => updateStudent(student.id, "join_month", e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>継続期間</FieldLabel><TextInput value={monthsBetween(student.join_month, targetMonth)} readOnly className="bg-white/70" /></div>
                <div className="space-y-1"><FieldLabel>クラス</FieldLabel><TextInput value={student.class_name || ""} onChange={(e) => updateStudent(student.id, "class_name", e.target.value)} placeholder={school.classes[0]?.name || "A"} /></div>
                <div className="space-y-1"><FieldLabel>在籍状態</FieldLabel>
                  <SelectInput value={status} onChange={(value) => updateStudent(student.id, "status", value)}>
                    {STUDENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </SelectInput>
                </div>
                <div className="space-y-1 md:col-span-6"><FieldLabel>メモ</FieldLabel><TextInput value={student.memo || ""} onChange={(e) => updateStudent(student.id, "memo", e.target.value)} placeholder="任意" /></div>
              </div>
              <Button variant="ghost" onClick={() => deleteStudent(student.id)} className="w-full"><Trash2 className="mr-1 h-4 w-4" />この生徒を削除</Button>
            </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// 指定要素を「継ぎ目のない1枚の長いページ」としてPDF保存する共通処理
async function exportElementAsLongPdf(elementId, filename, onStatus) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (onStatus) onStatus("PDFを作成中...");
  try {
    const [html2canvasMod, jsPDFmod] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const html2canvas = html2canvasMod.default || html2canvasMod;
    const jsPDF = jsPDFmod.jsPDF || jsPDFmod.default;

    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    const pageW = 210;                                  // A4と同じ幅(mm)
    const margin = 8;                                   // 左右・上下の余白(mm)
    const contentW = pageW - margin * 2;
    const imgH = (canvas.height * contentW) / canvas.width;
    const pageH = imgH + margin * 2;                    // 中身に合わせて縦に伸ばす

    // 中身全体が収まる縦長1ページのPDFを作る（途中で改ページしない）
    const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: "portrait" });
    pdf.addImage(imgData, "JPEG", margin, margin, contentW, imgH);
    pdf.save(filename);
    if (onStatus) onStatus("PDFを保存しました。");
  } catch (e) {
    if (onStatus) onStatus(`PDF作成に失敗しました：${e.message}`);
  }
}

function InvoicePreview({ recipient, invoiceNo, invoiceDate, targetMonth, issuer, school, people, expenses, totals, bankInfo, notes, withholding }) {
  const wh = calcWithholding(people, withholding);
  return (
    <Card className="print:rounded-none print:shadow-none">
      <div id="invoice-pdf-area" className="bg-white p-4 md:p-8 print:p-0">
        <div className="pdf-block mb-6 border-b-2 border-emerald-600 pb-4">
          <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-emerald-600">Sowers Franchise System</p>
          <h2 className="mt-1 text-center text-2xl font-black tracking-[0.25em] text-slate-900 md:text-3xl">請求書</h2>
        </div>

        <div className="pdf-block mb-6 grid grid-cols-1 gap-5 text-sm md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <p className="inline-block border-b border-slate-400 pb-1 pr-8 text-lg font-bold">{recipient}</p>
              <p className="mt-3">下記の通りご請求申し上げます。</p>
            </div>
            <div className="rounded-3xl border border-pink-100 bg-pink-50 p-5 print:border print:bg-white print:text-slate-900">
              <p className="text-xs font-bold text-pink-600 print:text-slate-600">ご請求金額</p>
              <p className="text-4xl font-black text-slate-900">{yen(totals.total)}</p>
            </div>
          </div>
          <div className="space-y-1 text-left md:text-right">
            <p>請求書番号：{invoiceNo}</p>
            <p>請求日：{invoiceDate}</p>
            <p>対象月：{targetMonth}</p>
            <div className="pt-3"><p className="whitespace-pre-wrap font-bold">{issuer || "請求者名未入力"}</p></div>
          </div>
        </div>

        <div className="pdf-block mb-5 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <p><span className="text-slate-500">教室名：</span>{school.name}</p>
          <p><span className="text-slate-500">エリア：</span>{school.area}</p>
          <p><span className="text-slate-500">曜日：</span>{school.day}</p>
          <p><span className="text-slate-500">会場：</span>{school.venue}</p>
        </div>

        <p className="pdf-block mb-2 text-sm font-bold" data-pdf-keep="next">人物別出勤情報</p>
        <div className="space-y-3">
          {people.map((person, personIndex) => (
            <div key={person.id} className="pdf-block rounded-2xl border border-slate-200 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <p className="font-bold">{person.name || `人物${personIndex + 1}`}</p>
                <p className="text-sm font-black text-emerald-700">{yen(personSubtotal(person))}</p>
              </div>
              <div className="space-y-2">
                {person.works.map((work) => {
                  const workDays = work.dates.length;
                  const amount = workDays * safeNumber(work.rate);
                  return (
                    <div key={work.id} className="rounded-xl bg-slate-50 p-2.5 text-xs print:bg-white print:border print:border-slate-200">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold leading-snug" style={{ wordBreak: "auto-phrase" }}>{work.workDetail}</span>
                        <span className="shrink-0 font-bold">{yen(amount)}</span>
                      </div>
                      <p className="mt-1 leading-snug text-slate-600">{work.dates.length ? work.dates.map(formatJapaneseDate).join("、") : "日付未選択"}</p>
                      <p className="mt-0.5 text-slate-500">{workDays}日 × {yen(work.rate)}{work.memo ? `　/　${work.memo}` : ""}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="pdf-block mb-2 mt-4 text-sm font-bold" data-pdf-keep="next">経費</p>
        <div className="space-y-2">
          {expenses.map((expense) => {
            const expenseSubtotal = safeNumber(expense.quantity) * safeNumber(expense.amount);
            return (
              <div key={expense.id} className="pdf-block rounded-xl border border-slate-200 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold leading-snug" style={{ wordBreak: "auto-phrase" }}>{expense.item || "未入力"}</span>
                  <span className="shrink-0 font-bold">{yen(expenseSubtotal)}</span>
                </div>
                <p className="mt-1 text-slate-500">{expense.applicant || "申請者未入力"}　/　{expense.quantity || 0} × {yen(expense.amount)}{expense.memo ? `　/　${expense.memo}` : ""}</p>
              </div>
            );
          })}
        </div>

        <div className="pdf-block mb-6 mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm print:bg-white print:border print:border-slate-300">
          <div className="flex justify-between"><span className="text-slate-500">合計出勤日数</span><span className="font-bold">{totals.totalWorkDays}日</span></div>
          <div className="flex justify-between"><span className="text-slate-500">出勤小計</span><span className="font-bold">{yen(totals.workTotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">経費小計</span><span className="font-bold">{yen(totals.expenseTotal)}</span></div>
          <div className="mt-1 flex items-center justify-between border-t border-slate-300 pt-2"><span className="text-base font-black">合計金額</span><span className="text-lg font-black text-emerald-700">{yen(totals.total)}</span></div>
          {wh.hasAny && (
            <>
              {wh.rows.filter((r) => r.entry && r.entry.type !== "none").map((r) => (
                <div key={r.key} className="flex justify-between text-slate-600"><span>源泉徴収税　{r.name}</span><span className="font-bold">−{yen(r.tax)}</span></div>
              ))}
              <div className="mt-1 flex items-center justify-between border-t border-slate-300 pt-2"><span className="text-base font-black">差引お振込額</span><span className="text-lg font-black text-sky-700">{yen(totals.total - wh.taxTotal)}</span></div>
              <p className="text-[11px] leading-4 text-slate-400">※源泉徴収税は経理担当者が設定します（対象は出勤の報酬分・経費は対象外）。</p>
            </>
          )}
        </div>

        <div className="pdf-block grid grid-cols-1 gap-4 text-sm">
          <div><p className="mb-1 font-bold">振込先</p><div className="min-h-16 whitespace-pre-wrap rounded-lg border p-3">{bankInfo || "未入力"}</div></div>
          <div><p className="mb-1 font-bold">備考</p><div className="min-h-12 whitespace-pre-wrap rounded-lg border p-3">{notes || "-"}</div></div>
        </div>
      </div>
    </Card>
  );
}

const DASHBOARD_MENU = [
  { mode: "invoice", label: "請求書作成", desc: "出勤・経費を入力して請求書を発行", Icon: FileText, theme: "emerald" },
  { mode: "students", label: "生徒名簿", desc: "氏名・入会月・クラス・在籍状態を管理", Icon: Users, theme: "orange" },
  { mode: "trend", label: "生徒数推移", desc: "在籍・休会・退会とクラス別人数", Icon: TrendingUp, theme: "pink" },
  { mode: "sales", label: "売上管理", desc: "今月の請求額・出勤小計を把握", Icon: Wallet, theme: "emerald" },
  { mode: "news", label: "お知らせ", desc: "先生・保護者への連絡（準備中）", Icon: Megaphone, theme: "orange" },
  { mode: "manual", label: "マニュアル", desc: "操作手順・運用ルール（準備中）", Icon: BookOpen, theme: "pink" },
];
const THEME = {
  emerald: { card: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50", chip: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  orange: { card: "border-orange-200 hover:border-orange-400 hover:bg-orange-50", chip: "bg-orange-100 text-orange-700", bar: "bg-orange-500" },
  pink: { card: "border-pink-200 hover:border-pink-400 hover:bg-pink-50", chip: "bg-pink-100 text-pink-700", bar: "bg-pink-500" },
};

function AccountPanel({ session, profile, setProfile, onBack, logout }) {
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [schoolId, setSchoolId] = useState(profile.school_id || schools[0].id);
  const [newPassword, setNewPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const saveProfile = async () => {
    setProfileMsg("");
    if (!supabase) return;
    if (!displayName.trim()) { setProfileMsg("氏名を入力してください。"); return; }
    const updates = { display_name: displayName.trim(), school_id: schoolId, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("profiles").update(updates).eq("id", session.user.id);
    if (error) { setProfileMsg(`保存エラー：${error.message}`); return; }
    setProfile((prev) => ({ ...prev, ...updates }));
    setProfileMsg("プロフィールを更新しました。");
  };

  const changePassword = async () => {
    setPwMsg("");
    if (!supabase) return;
    if (newPassword.length < 6) { setPwMsg("パスワードは6文字以上で設定してください。"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPwMsg(`変更エラー：${error.message}`); return; }
    setNewPassword("");
    setPwMsg("パスワードを変更しました。");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-800"><ChevronLeft className="h-4 w-4" />ダッシュボードに戻る</button>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-orange-400 to-pink-500" />
          <div className="flex items-center gap-3 p-5">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Settings className="h-6 w-6" /></span>
            <div>
              <h1 className="text-2xl font-black">アカウント設定</h1>
              <p className="text-sm text-slate-600">{session.user.email}</p>
            </div>
          </div>
        </div>

        <Card><div className="space-y-4 p-5">
          <div className="h-1.5 w-20 rounded-full bg-emerald-500" />
          <h2 className="text-lg font-black">プロフィール</h2>
          <div className="space-y-2">
            <FieldLabel>氏名（フルネーム）</FieldLabel>
            <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例：沢野 太郎" />
          </div>
          <div className="space-y-2">
            <FieldLabel>担当教室</FieldLabel>
            <SelectInput value={schoolId} onChange={setSchoolId}>
              {schools.map((item) => <option key={item.id} value={item.id}>{item.area}｜{item.name}</option>)}
            </SelectInput>
          </div>
          {profileMsg && <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{profileMsg}</div>}
          <Button onClick={saveProfile} className="w-full"><Save className="mr-1 h-4 w-4" />保存</Button>
        </div></Card>

        <Card><div className="space-y-4 p-5">
          <div className="h-1.5 w-20 rounded-full bg-pink-500" />
          <h2 className="text-lg font-black">パスワード変更</h2>
          <div className="space-y-2">
            <FieldLabel>新しいパスワード（6文字以上）</FieldLabel>
            <TextInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="新しいパスワード" />
          </div>
          {pwMsg && <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{pwMsg}</div>}
          <Button onClick={changePassword} className="w-full"><KeyRound className="mr-1 h-4 w-4" />パスワードを変更</Button>
          <p className="text-xs text-slate-500" style={{ wordBreak: "auto-phrase" }}>メールアドレス（ID）の変更が必要な場合は管理者にご連絡ください。</p>
        </div></Card>

        <Button variant="ghost" onClick={logout} className="w-full"><LogOut className="mr-1 h-4 w-4" />ログアウト</Button>
      </div>
    </div>
  );
}

function DashboardHome({ profile, session, school, schoolId, setSchoolId, targetMonth, studentStats, totals, onSelect, logout }) {
  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 bg-gradient-to-r from-emerald-500 via-orange-400 to-pink-500 px-5 py-2 text-xs font-bold uppercase tracking-[0.25em] text-white">Sowers FC System</div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">ダッシュボード</h1>
              <p className="mt-1 text-sm text-slate-600">{profile.display_name || session.user.email} さん</p>
              <div className="mt-3 space-y-2">
                <FieldLabel>教室</FieldLabel>
                <SelectInput value={schoolId} onChange={setSchoolId}>
                  {schools.map((item) => <option key={item.id} value={item.id}>{item.area}｜{item.name}</option>)}
                </SelectInput>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="outline" onClick={() => onSelect("account")} className="w-full sm:w-auto"><Settings className="mr-1 h-4 w-4" />アカウント設定</Button>
              <Button variant="ghost" onClick={logout} className="w-full sm:w-auto"><LogOut className="mr-1 h-4 w-4" />ログアウト</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">在籍生徒数</p><p className="text-2xl font-black text-emerald-800">{studentStats.activeCount}名</p></div>
          <div className="rounded-3xl border border-orange-200 bg-orange-50 p-4"><p className="text-xs font-bold text-orange-700">{targetMonth} 請求額</p><p className="text-2xl font-black text-orange-800">{yen(totals.total)}</p></div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DASHBOARD_MENU.map(({ mode, label, desc, Icon, theme }) => {
            const t = THEME[theme];
            return (
              <button key={mode} type="button" onClick={() => onSelect(mode)} className={`flex flex-col items-start gap-3 rounded-3xl border bg-white p-5 text-left shadow-sm transition ${t.card}`}>
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${t.chip}`}><Icon className="h-6 w-6" /></span>
                <div>
                  <p className="text-lg font-black">{label}</p>
                  <p className="mt-1 text-sm text-slate-600" style={{ wordBreak: "auto-phrase" }}>{desc}</p>
                </div>
                <div className={`mt-1 h-1.5 w-12 rounded-full ${t.bar}`} />
              </button>
            );
          })}
        </div>
        <p className="text-center text-xs text-slate-400">{school.area}｜{school.name}</p>
      </div>
    </div>
  );
}

function PlaceholderPage({ mode, school, studentStats, totals, students, onBack }) {
  const meta = DASHBOARD_MENU.find((m) => m.mode === mode) || DASHBOARD_MENU[0];
  const t = THEME[meta.theme];
  const Icon = meta.Icon;
  const classCounts = students.filter((s) => (s.status || "active") === "active").reduce((acc, s) => { const k = s.class_name || "未設定"; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const maxClass = Math.max(1, ...Object.values(classCounts));

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-800"><ChevronLeft className="h-4 w-4" />ダッシュボードに戻る</button>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 p-5">
            <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${t.chip}`}><Icon className="h-6 w-6" /></span>
            <div>
              <h1 className="text-2xl font-black">{meta.label}</h1>
              <p className="text-sm text-slate-600">{school.area}｜{school.name}</p>
            </div>
          </div>
        </div>

        {mode === "trend" && (
          <Card><div className="space-y-4 p-5">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">在籍</p><p className="text-xl font-black text-emerald-800">{studentStats.activeCount}名</p></div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-700">休会</p><p className="text-xl font-black text-amber-800">{studentStats.suspendedCount}名</p></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-600">退会</p><p className="text-xl font-black text-slate-700">{studentStats.withdrawnCount}名</p></div>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">クラス別 在籍人数</p>
              <div className="space-y-2">
                {Object.keys(classCounts).length ? Object.entries(classCounts).map(([name, count]) => (
                  <div key={name} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 font-bold">{name}</span>
                    <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-pink-500" style={{ width: `${(count / maxClass) * 100}%` }} /></div>
                    <span className="w-12 shrink-0 text-right font-bold">{count}名</span>
                  </div>
                )) : <p className="text-sm text-slate-500">生徒が登録されていません。</p>}
              </div>
            </div>
          </div></Card>
        )}

        {mode === "sales" && (
          <Card><div className="space-y-3 p-5">
            <div className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3"><span className="font-bold">今月の請求額</span><span className="text-xl font-black text-orange-800">{yen(totals.total)}</span></div>
            <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"><span className="font-bold">出勤小計</span><span className="text-xl font-black text-emerald-800">{yen(totals.workTotal)}</span></div>
            <p className="text-xs text-slate-500">※ 月次の売上推移グラフは今後のアップデートで追加予定です。</p>
          </div></Card>
        )}

        {(mode === "news" || mode === "manual") && (
          <Card><div className="space-y-3 p-8 text-center">
            <p className="text-lg font-black">準備中</p>
            <p className="text-sm text-slate-600" style={{ wordBreak: "auto-phrase" }}>{meta.label}機能は今後のアップデートで追加予定です。ご要望があれば内容をお知らせください。</p>
          </div></Card>
        )}
      </div>
    </div>
  );
}


function AdminSystem({ session, profile }) {
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filterMonth, setFilterMonth] = useState(addMonths(monthString(), -1)); // 既定は先月分（毎月はじめに先月分が提出される）
  const [filterState, setFilterState] = useState("all");
  const [teacherSchools, setTeacherSchools] = useState([]);
  const [paying, setPaying] = useState(null);
  const [roster, setRoster] = useState([]);
  const [settings, setSettings] = useState({});
  const [editing, setEditing] = useState(null); // 源泉徴収を設定中の人物 { key, name, base }
  const [preview, setPreview] = useState(null);  // 先生からの見え方（閲覧専用）

  useEffect(() => { loadAll(); }, []);

  // 前に設定した区分（甲・乙）を、まだ設定のない請求書に自動で引き継ぐ
  useEffect(() => {
    if (!selected || !supabase) return;
    const current = selected.withholding && typeof selected.withholding === "object" ? selected.withholding : {};
    const add = {};
    (Array.isArray(selected.people) ? selected.people : []).forEach((p) => {
      const key = personKey(p.name);
      const st = settings[key];
      if (key && !current[key] && st) add[key] = { type: st.type, rate: st.rate ?? OTSU_DEFAULT_RATE, amount: st.type === "kou" ? safeNumber(st.kou_amount) : null, carried: true };
    });
    if (!Object.keys(add).length) return;
    saveWithholding(selected, { ...current, ...add });
  }, [selected?.id, settings]);

  async function saveWithholding(record, nextMap) {
    const { error } = await supabase.from("invoice_months").update({ withholding: nextMap }).eq("id", record.id);
    if (error) { setMessage("源泉徴収の保存エラー：" + error.message); return false; }
    const next = { ...record, withholding: nextMap };
    setRecords((prev) => prev.map((r) => (r.id === record.id ? next : r)));
    setSelected((cur) => (cur && cur.id === record.id ? next : cur));
    return true;
  }

  async function saveSetting(row, entry) {
    // 1) この請求書の分を保存
    const current = selected.withholding && typeof selected.withholding === "object" ? selected.withholding : {};
    const ok = await saveWithholding(selected, { ...current, [row.key]: { type: entry.type, rate: entry.rate, amount: entry.amount } });
    if (!ok) return;
    // 2) 翌月以降も同じ区分を使えるように人事設定として保存
    const st = { person_key: row.key, person_name: row.name, type: entry.type, rate: entry.rate, kou_amount: entry.type === "kou" ? safeNumber(entry.amount) : null, updated_at: new Date().toISOString(), updated_by: session.user.id };
    const { error } = await supabase.from("fc_withholding_settings").upsert(st, { onConflict: "person_key" });
    if (error) { setMessage("人事設定の保存エラー：" + error.message); return; }
    setSettings((prev) => ({ ...prev, [row.key]: st }));
    setEditing(null);
    setMessage(`${row.name} さんの源泉徴収を保存しました（翌月以降も同じ設定で自動入力されます）。`);
  }

  useEffect(() => {
    if (!selected) { setRoster([]); return; }
    const m = selected.target_month;
    const snap = Array.isArray(selected.roster) ? selected.roster : [];
    if (snap.length) {
      setRoster(snap.filter((s) => (s.status || "active") !== "withdrawn" && (!s.join_month || s.join_month <= m)));
      return;
    }
    if (!supabase) { setRoster([]); return; }
    (async () => {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("school_id", selected.school_id)
        .neq("status", "withdrawn")
        .order("page_no")
        .order("created_at");
      setRoster((data || []).filter((s) => !s.join_month || s.join_month <= m));
    })();
  }, [selected]);

  async function loadAll() {
    setLoading(true);
    if (!supabase) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("invoice_months")
      .select("*")
      .order("target_month", { ascending: false })
      .order("submitted_at", { ascending: false });
    if (error) setMessage("読み込みエラー：" + error.message);
    setRecords(data || []);
    // 先生が登録している教室（未提出の判定に使う）
    const { data: pf } = await supabase.from("profiles").select("school_id, role");
    setTeacherSchools(Array.from(new Set((pf || []).filter((p) => p.role !== "admin" && p.school_id).map((p) => p.school_id))));
    const { data: st } = await supabase.from("fc_withholding_settings").select("*");
    setSettings(Object.fromEntries((st || []).map((r) => [r.person_key, r])));
    setLoading(false);
  }

  async function setPaid(record, paid, day = null) {
    if (!supabase) return;
    setPaying(record.id);
    const patch = paid ? { paid_at: day ? new Date(`${day}T12:00:00+09:00`).toISOString() : new Date().toISOString(), paid_by: session.user.id } : { paid_at: null, paid_by: null };
    const { error } = await supabase.from("invoice_months").update(patch).eq("id", record.id);
    setPaying(null);
    if (error) { setMessage("振込状況の保存エラー：" + error.message); return; }
    const next = { ...record, ...patch };
    setRecords((prev) => prev.map((r) => (r.id === record.id ? next : r)));
    setSelected((cur) => (cur && cur.id === record.id ? next : cur));
  }

  async function logout() { await supabase.auth.signOut(); }
  const printInvoice = () => window.print();

  // その月の教室ごとの状態。請求書を出したことがある教室＋先生が登録している教室を「対象」とする
  const thisMonth = monthString();
  const minMonth = records.reduce((m, r) => (r.target_month && r.target_month < m ? r.target_month : m), addMonths(thisMonth, -1));
  const canPrev = filterMonth > minMonth;
  const canNext = filterMonth < thisMonth;
  const targetSchoolIds = Array.from(new Set([...records.map((r) => r.school_id), ...teacherSchools]))
    .filter((id) => schools.some((s) => s.id === id))
    .sort((a, b) => schools.findIndex((s) => s.id === a) - schools.findIndex((s) => s.id === b));
  const monthRecords = records.filter((r) => r.target_month === filterMonth);
  const board = [];
  targetSchoolIds.forEach((sid) => {
    const recs = monthRecords.filter((r) => r.school_id === sid);
    const done = recs.filter((r) => invoiceState(r) !== "unsubmitted");
    if (done.length) done.forEach((r) => board.push({ key: r.id, schoolId: sid, state: invoiceState(r), record: r }));
    else board.push({ key: "none-" + sid, schoolId: sid, state: "unsubmitted", record: recs[0] || null });
  });
  const counts = { unsubmitted: 0, submitted: 0, paid: 0 };
  board.forEach((b) => { counts[b.state] += 1; });
  const order = { unsubmitted: 0, submitted: 1, paid: 2 };
  const shown = board.filter((b) => filterState === "all" || b.state === filterState).sort((a, b) => order[a.state] - order[b.state]);
  const unpaidTotal = board.filter((b) => b.state === "submitted").reduce((sum, b) => sum + calcTotals(b.record.people, b.record.expenses).total - calcWithholding(b.record.people, b.record.withholding).taxTotal, 0);

  if (selected && preview) {
    return (
      <MainSystem
        session={session}
        profile={{ display_name: selected.issuer || "先生", school_id: selected.school_id, role: "teacher" }}
        setProfile={() => {}}
        viewAs={{ userId: selected.user_id, schoolId: selected.school_id, targetMonth: selected.target_month }}
        onExitPreview={() => setPreview(null)}
      />
    );
  }

  if (selected) {
    const school = getSchoolById(selected.school_id);
    const people = Array.isArray(selected.people) ? selected.people : [];
    const expenses = Array.isArray(selected.expenses) ? selected.expenses : [];
    const totals = calcTotals(people, expenses);
    const wh = calcWithholding(people, selected.withholding);
    return (
      <div className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-4 md:p-8 print:bg-white print:p-0">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_560px] print:block">
          <section className="space-y-3 print:hidden">
            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="mb-4 h-2 w-24 rounded-full bg-gradient-to-r from-emerald-500 via-orange-400 to-pink-500" />
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Sowers FC System｜管理者</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900">請求書の確認</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">{school.area}｜{school.name} ／ 対象月 {selected.target_month} ／ 請求者 {selected.issuer || "未入力"}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => { setSelected(null); setMessage(""); }} className="w-full"><ChevronLeft className="mr-1 h-4 w-4" />一覧に戻る</Button>
              <Button variant="outline" onClick={printInvoice} className="w-full"><Printer className="mr-1 h-4 w-4" />PDF保存・印刷</Button>
            </div>
            <Button onClick={() => setPreview(true)} className="w-full bg-sky-600 hover:bg-sky-700"><Eye className="mr-1 h-4 w-4" />先生からの見え方を確認</Button>
            {message && <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>}
            <PayBox record={selected} amount={totals.total - wh.taxTotal} busy={paying === selected.id} onPaid={(v, day) => setPaid(selected, v, day)} />
            <PayslipButtons records={records.filter((r) => r.target_month === selected.target_month).map((r) => (r.id === selected.id && !(Array.isArray(r.roster) && r.roster.length) ? { ...r, roster } : r))} onlyKeys={(Array.isArray(selected.people) ? selected.people : []).map((p) => personKey(p.name))} />

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-1.5 w-20 rounded-full bg-sky-500" />
              <h2 className="mt-3 text-lg font-black">源泉徴収税（給料）</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">先生の名前をタップして甲欄・乙欄を設定します。乙欄は出勤の報酬分×3.063%を自動入力（1円未満切り捨て）。金額は後から変更できます。一度設定すると翌月以降も同じ区分で自動入力されます。</p>
              <div className="mt-3 space-y-2">
                {wh.rows.map((r) => (
                  <button key={r.key || r.name} type="button" disabled={!r.key} onClick={() => setEditing(r)} className="grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-400 hover:bg-sky-50 disabled:opacity-50">
                    <span>
                      <span className="block text-base font-black text-sky-800 underline decoration-sky-300 underline-offset-4">{r.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">報酬 {yen(r.base)}　／　{r.entry ? whDesc(r.entry) : <b className="text-amber-600">未設定（タップして設定）</b>}{r.entry?.carried ? "　※前回の設定を引き継ぎ" : ""}</span>
                      {otsuNeedsTable(r.entry, r.base) && <span className="mt-1 block rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700">報酬が105,000円以上です。乙欄の税額表で金額を確認して入力してください</span>}
                    </span>
                    <span className="text-right"><span className="block text-sm font-black">{r.entry ? `−${yen(r.tax)}` : "—"}</span><span className="block text-xs font-bold text-sky-700">差引 {yen(r.base - r.tax)}</span></span>
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-1 rounded-2xl bg-slate-50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">請求金額（報酬＋経費）</span><b>{yen(totals.total)}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">源泉徴収税 合計</span><b>−{yen(wh.taxTotal)}</b></div>
                <div className="flex justify-between border-t border-slate-200 pt-1"><span className="font-black">差引お振込額</span><b className="text-sky-700">{yen(totals.total - wh.taxTotal)}</b></div>
              </div>
            </div>

            <Button variant="ghost" onClick={logout} className="w-full"><LogOut className="mr-1 h-4 w-4" />ログアウト</Button>
          </section>
          {editing && <WithholdingModal row={editing} entry={(selected.withholding || {})[editing.key]} setting={settings[editing.key]} onClose={() => setEditing(null)} onSave={(entry) => saveSetting(editing, entry)} />}
          <section className="space-y-4 print:space-y-0">
            <InvoicePreview recipient="Sowers株式会社" invoiceNo={selected.invoice_no} invoiceDate={selected.invoice_date} targetMonth={selected.target_month} issuer={selected.issuer} school={school} people={people} expenses={expenses} totals={totals} bankInfo={selected.bank_info} notes={selected.notes} withholding={selected.withholding} />
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">生徒名簿（{selected.target_month} 在籍）</h3>
                <span className="text-sm font-bold text-slate-500">{roster.length}名</span>
              </div>
              {roster.length === 0 ? (
                <p className="text-sm text-slate-500">この月に在籍していた生徒は見つかりませんでした。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 p-2 text-left">氏名</th>
                        <th className="border border-slate-300 p-2 text-left">クラス</th>
                        <th className="border border-slate-300 p-2 text-left">入会月</th>
                        <th className="border border-slate-300 p-2 text-left">状態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((st) => (
                        <tr key={st.id}>
                          <td className="border border-slate-300 p-2">{st.full_name}</td>
                          <td className="border border-slate-300 p-2">{st.class_name || "-"}</td>
                          <td className="border border-slate-300 p-2">{st.join_month || "-"}</td>
                          <td className="border border-slate-300 p-2">{st.status === "suspended" ? "休会" : "在籍"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="mb-4 h-2 w-24 rounded-full bg-gradient-to-r from-emerald-500 via-orange-400 to-pink-500" />
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Sowers FC System｜管理者</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">請求書の提出・振込状況</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">月ごとに「未提出／振込待ち／振込済み」が分かります。振込が終わったら「振込済みにする」を押してください（{profile.display_name || session.user.email}）。</p>
        </div>
        <DemoEntry />
        <div className="flex items-center justify-between gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
          <button type="button" disabled={!canPrev} onClick={() => setFilterMonth(addMonths(filterMonth, -1))} className="flex h-12 w-12 items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="前の月"><ChevronLeft className="h-6 w-6" /></button>
          <div className="text-center">
            <p className="text-lg font-black text-slate-900">{monthLabel(filterMonth)}</p>
            {filterMonth === addMonths(thisMonth, -1) && <p className="text-xs font-bold text-emerald-600">今月提出してもらう月</p>}
          </div>
          <button type="button" disabled={!canNext} onClick={() => setFilterMonth(addMonths(filterMonth, 1))} className="flex h-12 w-12 items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="次の月"><ChevronRight className="h-6 w-6" /></button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["unsubmitted", "未提出", counts.unsubmitted, "border-red-200 bg-red-50 text-red-700", "ring-red-400"],
            ["submitted", "振込待ち", counts.submitted, "border-amber-200 bg-amber-50 text-amber-700", "ring-amber-400"],
            ["paid", "振込済み", counts.paid, "border-sky-200 bg-sky-50 text-sky-700", "ring-sky-400"],
          ].map(([key, label, n, cls, ring]) => (
            <button key={key} type="button" onClick={() => setFilterState(filterState === key ? "all" : key)} className={`rounded-3xl border p-3 text-center shadow-sm transition ${cls} ${filterState === key ? "ring-2 " + ring : ""}`}>
              <span className="block text-xs font-bold">{label}</span>
              <span className="block text-3xl font-black leading-tight">{n}</span>
            </button>
          ))}
        </div>
        {counts.submitted > 0 && <p className="px-1 text-right text-sm font-bold text-amber-700">振込待ちの合計 {yen(unpaidTotal)}</p>}
        {filterState !== "all" && <button type="button" onClick={() => setFilterState("all")} className="w-full text-center text-xs font-bold text-slate-500 underline">すべて表示に戻す</button>}
        {message && <div className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{message}</div>}
        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">読み込み中...</div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">該当する教室はありません。</div>
        ) : (
          <div className="space-y-2">
            {shown.map((b) => {
              const school = getSchoolById(b.schoolId);
              const r = b.record;
              if (b.state === "unsubmitted") {
                return (
                  <div key={b.key} className="flex items-center justify-between gap-3 rounded-3xl border border-red-200 bg-white p-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="text-base font-black text-slate-900">{school.area}｜{school.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{r ? "先生が下書き中です（まだ提出されていません）" : "まだ請求書がありません"}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-sm font-black text-red-700">未提出</span>
                  </div>
                );
              }
              const totals = calcTotals(r.people, r.expenses);
              const whr = calcWithholding(r.people, r.withholding);
              const unset = whr.rows.filter((x) => !x.entry && !settings[x.key]).length;
              const paid = b.state === "paid";
              const resubmitted = paid && r.submitted_at && new Date(r.submitted_at) > new Date(r.paid_at);
              return (
                <div key={b.key} className={`rounded-3xl border bg-white p-4 shadow-sm ${paid ? "border-sky-200" : "border-amber-300"}`}>
                  <button type="button" onClick={() => setSelected(r)} className="flex w-full items-start justify-between gap-3 text-left">
                    <span className="min-w-0">
                      <span className="block text-base font-black text-slate-900">{school.area}｜{school.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{r.issuer || "請求者未入力"}{r.submitted_at ? "　提出 " + shortDate(r.submitted_at) : ""}</span>
                      <span className="mt-1 block text-lg font-black text-slate-900">{yen(totals.total - whr.taxTotal)}<span className="ml-1 text-xs font-bold text-slate-500">振込額</span></span>
                      {unset ? <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">源泉未設定 {unset}名</span> : null}
                      {resubmitted ? <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">振込後に再提出あり・要確認</span> : null}
                    </span>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-black ${paid ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>{paid ? `振込済み ${shortDate(r.paid_at)}` : "振込待ち"}</span>
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setSelected(r)} className="w-full"><FileText className="mr-1 h-4 w-4" />開いて確認</Button>
                    {paid
                      ? <Button variant="ghost" disabled={paying === r.id} onClick={() => setPaid(r, false)} className="w-full border border-slate-200 text-sm">振込済みを取り消す</Button>
                      : <Button disabled={paying === r.id} onClick={() => setPaid(r, true)} className="w-full whitespace-nowrap bg-sky-600 px-2 text-sm hover:bg-sky-700"><Check className="mr-1 h-4 w-4" />振込済みにする</Button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && <PayslipButtons records={monthRecords} title={`給与明細書（${monthLabel(filterMonth)}）`} />}
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAll} className="flex-1">再読み込み</Button>
          <Button variant="ghost" onClick={logout} className="flex-1"><LogOut className="mr-1 h-4 w-4" />ログアウト</Button>
        </div>
      </div>
    </div>
  );
}


function classKey(name) { return String(name || "").replace(/[\s　]+/g, "").replace(/クラス/g, ""); }
// メインのクラスの在籍人数（提出時の名簿。クラス名は出勤内容→クラス欄の順で名簿と照合）
function mainClassCount(work, roster) {
  const isMain = work.role === "main" || /メイン/.test(work.workDetail || "");
  if (!isMain || !Array.isArray(roster) || !roster.length) return null;
  const active = roster.filter((s) => (s.status || "active") === "active");
  const cands = [classKey(String(work.workDetail || "").replace(/\s*(メイン|サブ)\s*$/, "")), classKey(work.className)].filter(Boolean);
  for (const c of cands) {
    const n = active.filter((s) => classKey(s.class_name) === c).length;
    if (n) return n;
  }
  return null;
}
// ===== 給与明細書（1人×1か月。複数の教室の請求書をまとめる）=====
// 経費の行のうち、マイナスで施設関係でないもの＝先生が現金で受け取った分（給与から差し引く）
function isHandedCash(e) {
  const sub = safeNumber(e.quantity) * safeNumber(e.amount);
  return sub < 0 && !/(施設|利用料|返金|会場|体育館|公民館|交通|駐車)/.test(String(e.item || ""));
}
function jpDate(ts) { const t = new Date(ts); return Number.isNaN(t.getTime()) ? "" : `${t.getFullYear()}年${t.getMonth() + 1}月${t.getDate()}日`; }
function buildPayslip(records, key) {
  const list = (records || []).filter((r) => (Array.isArray(r.people) ? r.people : []).some((p) => personKey(p.name) === key))
    .sort((a, b) => schools.findIndex((x) => x.id === a.school_id) - schools.findIndex((x) => x.id === b.school_id));
  let name = "";
  const blocks = list.map((r) => {
    const person = mergeSamePeople(r.people).find((p) => personKey(p.name) === key);
    name = name || person.name;
    const roster = Array.isArray(r.roster) ? r.roster : [];
    const works = (person.works || []).filter((w) => (w.dates || []).length).map((w) => ({
      ...w, days: w.dates.length, amount: w.dates.length * safeNumber(w.rate),
      isMain: w.role === "main" || /メイン/.test(w.workDetail || ""), students: mainClassCount(w, roster),
    }));
    const pay = works.reduce((sum, w) => sum + w.amount, 0);
    const wh = r.withholding && typeof r.withholding === "object" ? r.withholding[key] : null;
    const handed = (Array.isArray(r.expenses) ? r.expenses : []).filter((e) => personKey(e.applicant) === key && isHandedCash(e))
      .map((e) => ({ id: e.id, label: `手渡しで受け取った分（${e.item || "現金"}${safeNumber(e.quantity) > 1 ? ` ${e.quantity}名分` : ""}）`, amount: -safeNumber(e.quantity) * safeNumber(e.amount) }));
    return { record: r, school: getSchoolById(r.school_id), works, pay, tax: whTax(wh, pay), handed, days: Array.from(new Set(works.flatMap((w) => w.dates))).sort() };
  });
  const pay = blocks.reduce((sum, b) => sum + b.pay, 0);
  const tax = blocks.reduce((sum, b) => sum + b.tax, 0);
  const handed = blocks.flatMap((b) => b.handed.map((h) => ({ ...h, school: b.school })));
  const handedTotal = handed.reduce((sum, h) => sum + h.amount, 0);
  const allPaid = list.length && list.every((r) => r.paid_at);
  const payDay = allPaid ? jpDate(list.map((r) => r.paid_at).sort().slice(-1)[0]) : "";
  return { key, name: name || "（氏名未入力）", month: list[0]?.target_month || "", blocks, pay, tax, handed, handedTotal, deductTotal: tax + handedTotal, net: pay - tax - handedTotal, payDay, multi: blocks.length > 1 };
}

function PayslipSheet({ slip }) {
  const [y, m] = String(slip.month).split("-");
  const cell = "border border-slate-300 px-3 py-2";
  const head = "border border-slate-300 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800";
  return (
    <div id="payslip-pdf-area" className="mx-auto w-full max-w-[720px] bg-white p-6 text-slate-900 sm:p-10" style={{ fontFeatureSettings: '"palt"' }}>
      <div className="flex items-end justify-between border-b-4 border-emerald-600 pb-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.3em] text-emerald-600">SOWERS PAYSLIP</p>
          <h2 className="mt-1 text-3xl font-black tracking-[0.3em]">給与明細書</h2>
        </div>
        <p className="text-lg font-black">{y}年{Number(m)}月分</p>
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-4">
        <div>
          <p className="inline-block border-b border-slate-400 pb-1 pr-10 text-2xl font-black">{slip.name}　様</p>
          <p className="mt-2 text-sm text-slate-600">{slip.blocks.map((b) => `${b.school.area}｜${b.school.name}`).join("　/　")}</p>
        </div>
        <div className="text-right text-xs leading-5 text-slate-600">
          <p className="text-sm">支給日：<b className="text-slate-900">{slip.payDay || "お振込後に記載"}</b></p>
          <p className="font-bold text-slate-900">Sowers株式会社</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border-2 border-emerald-600 p-4 text-center">
        <p className="text-xs font-bold text-emerald-700">差引支給額</p>
        <p className="text-4xl font-black tracking-tight">{yen(slip.net)}</p>
      </div>

      <p className="mt-6 mb-1.5 text-sm font-black">勤怠</p>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {slip.blocks.map((b) => (
            <React.Fragment key={b.record.id || b.school.id}>
              <tr><td className={head} colSpan={2}>{b.school.name}</td></tr>
              <tr><td className={`${cell} w-1/3 bg-slate-50 text-slate-600`}>出勤日数</td><td className={`${cell} text-right font-bold`}>{b.days.length}日</td></tr>
              <tr><td className={`${cell} bg-slate-50 text-slate-600`}>出勤日</td><td className={`${cell} text-xs leading-5`}>{b.days.length ? b.days.map(formatJapaneseDate).join("、") : "—"}</td></tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <p className="mt-5 mb-1.5 text-sm font-black">支給</p>
      <table className="w-full border-collapse text-sm">
        <thead><tr className="bg-slate-50 text-xs text-slate-600"><th className={`${cell} text-left`}>内容</th><th className={`${cell} w-16 text-right`}>回数</th><th className={`${cell} w-24 text-right`}>単価</th><th className={`${cell} w-28 text-right`}>金額</th></tr></thead>
        <tbody>
          {slip.blocks.map((b) => (
            <React.Fragment key={b.record.id || b.school.id}>
              {slip.multi && <tr><td className={head} colSpan={4}>{b.school.name}</td></tr>}
              {b.works.map((w) => (
                <tr key={w.id}><td className={cell}>{w.workDetail}{w.isMain && <span className="ml-1 text-xs text-slate-500">（生徒 {w.students ?? "—"}名）</span>}</td><td className={`${cell} text-right`}>{w.days}</td><td className={`${cell} text-right`}>{yen(w.rate)}</td><td className={`${cell} text-right font-bold`}>{yen(w.amount)}</td></tr>
              ))}
            </React.Fragment>
          ))}
          <tr className="bg-slate-50"><td className={`${cell} font-black`} colSpan={3}>支給合計</td><td className={`${cell} text-right font-black`}>{yen(slip.pay)}</td></tr>
        </tbody>
      </table>

      <p className="mt-5 mb-1.5 text-sm font-black">控除</p>
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr><td className={cell}>源泉所得税</td><td className={`${cell} w-28 text-right font-bold`}>{yen(slip.tax)}</td></tr>
          {slip.handed.map((h) => (
            <tr key={h.id}><td className={cell}>{h.label}{slip.multi ? `　${h.school.name}` : ""}</td><td className={`${cell} text-right font-bold`}>{yen(h.amount)}</td></tr>
          ))}
          <tr className="bg-slate-50"><td className={`${cell} font-black`}>控除合計</td><td className={`${cell} text-right font-black`}>{yen(slip.deductTotal)}</td></tr>
        </tbody>
      </table>

      <div className="mt-5 flex items-center justify-between border-y-2 border-slate-900 py-3">
        <span className="text-base font-black">差引支給額</span>
        <span className="text-2xl font-black">{yen(slip.net)}</span>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">※源泉所得税は支給合計にかかります。経費の精算分はこの明細書に含みません。</p>
    </div>
  );
}

// 明細書を開くポップアップ（PDFで保存）
function PayslipModal({ slip, onClose }) {
  const [msg, setMsg] = useState("");
  const file = `給与明細_${slip.month}_${slip.key || "氏名未入力"}.pdf`;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-3 sm:p-6 print:hidden">
      <div className="mx-auto max-w-[760px] space-y-3">
        <div className="sticky top-0 z-10 grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 shadow">
          <Button onClick={() => exportElementAsLongPdf("payslip-pdf-area", file, setMsg)} className="w-full"><FileText className="mr-1 h-4 w-4" />PDFで保存</Button>
          <Button variant="outline" onClick={onClose} className="w-full"><X className="mr-1 h-4 w-4" />閉じる</Button>
        </div>
        {msg && <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{msg}</div>}
        <div className="overflow-hidden rounded-2xl shadow-lg"><PayslipSheet slip={slip} /></div>
      </div>
    </div>
  );
}

// 人ごとの「明細書」ボタン一覧。records＝その月の請求書（複数教室）、onlyKeys＝表示する人を絞る
function PayslipButtons({ records, onlyKeys = null, title = "給与明細書" }) {
  const [open, setOpen] = useState(null);
  const done = (records || []).filter((r) => r && (r.status === "submitted" || r.paid_at));
  const keys = [];
  done.forEach((r) => (Array.isArray(r.people) ? r.people : []).forEach((p) => {
    const k = personKey(p.name);
    if (k && !keys.includes(k) && (p.works || []).some((w) => (w.dates || []).length) && (!onlyKeys || onlyKeys.includes(k))) keys.push(k);
  }));
  if (!keys.length) return null;
  const slips = keys.map((k) => buildPayslip(done, k));
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="h-1.5 w-20 rounded-full bg-emerald-500" />
      <h2 className="mt-3 text-lg font-black">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">名前をタップすると明細書を開いてPDFで保存できます。複数の教室を担当している人は1枚にまとまります。</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {slips.map((sl) => (
          <button key={sl.key} type="button" onClick={() => setOpen(sl)} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50">
            <span className="min-w-0"><span className="block font-black">{sl.name}</span>{sl.multi && <span className="block text-xs text-slate-500">{sl.blocks.length}教室</span>}</span>
            <span className="text-sm font-bold text-emerald-700">{yen(sl.net)}</span>
          </button>
        ))}
      </div>
      {open && <PayslipModal slip={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

// 請求書詳細の「振込状況」ボックス（経理担当者用）
function PayBox({ record, amount, busy, onPaid }) {
  const [payDate, setPayDate] = useState(todayString());
  const state = invoiceState(record);
  if (state === "unsubmitted") return null;
  const paid = state === "paid";
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${paid ? "border-sky-200 bg-sky-50" : "border-amber-300 bg-amber-50"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-700">振込状況</span>
        <span className={`rounded-full px-3 py-1 text-sm font-black ${paid ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>{paid ? `振込済み（${shortDate(record.paid_at)}）` : "振込待ち"}</span>
      </div>
      <p className="mt-2 text-sm">差引お振込額 <b className="text-lg">{yen(amount)}</b></p>
      {paid
        ? <Button variant="ghost" disabled={busy} onClick={() => onPaid(false)} className="mt-3 w-full border border-slate-200 text-sm">振込済みを取り消す</Button>
        : <>
            <label className="mt-3 flex items-center justify-between gap-2 text-sm"><span className="font-bold text-slate-700">支給日（振込日）</span><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2" /></label>
            <Button disabled={busy || !payDate} onClick={() => onPaid(true, payDate)} className="mt-2 w-full bg-sky-600 hover:bg-sky-700"><Check className="mr-1 h-4 w-4" />振込済みにする</Button>
          </>}
      <p className="mt-2 text-xs leading-5 text-slate-500">振込済みにすると、先生の画面にも「お振込済み」と表示され、その月の請求書は先生側で変更できなくなります。</p>
    </div>
  );
}

// 源泉徴収の設定ポップアップ（経理担当者用）
function WithholdingModal({ row, entry, setting, onClose, onSave }) {
  const init = entry || (setting ? { type: setting.type, rate: setting.rate, amount: setting.type === "kou" ? setting.kou_amount : null } : null);
  const [type, setType] = useState(init?.type || "otsu");
  const [rate, setRate] = useState(String(init?.rate ?? OTSU_DEFAULT_RATE));
  const hasManual = init && init.amount !== null && init.amount !== undefined && init.amount !== "";
  const [manual, setManual] = useState(init?.type === "otsu" ? !!hasManual : false);
  const [amount, setAmount] = useState(hasManual ? String(init.amount) : "");
  const [saving, setSaving] = useState(false);
  const auto = rateTax(row.base, rate);
  const shown = type === "otsu" ? (manual ? amount : String(auto)) : type === "kou" ? amount : "0";
  const tax = type === "none" ? 0 : Math.max(0, Math.floor(safeNumber(shown)));

  const save = async () => {
    setSaving(true);
    await onSave({
      type,
      rate: safeNumber(rate) || OTSU_DEFAULT_RATE,
      amount: type === "none" ? null : type === "otsu" ? (manual ? Math.max(0, Math.floor(safeNumber(amount))) : null) : Math.max(0, Math.floor(safeNumber(amount))),
    });
    setSaving(false);
  };
  const choice = (v, label, sub) => (
    <button type="button" onClick={() => setType(v)} className={`rounded-2xl border-2 px-3 py-3 text-center transition ${type === v ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-sky-300"}`}>
      <span className="block text-base font-black">{label}</span><span className="block text-[11px] opacity-80">{sub}</span>
    </button>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center print:hidden" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="h-2 bg-gradient-to-r from-sky-500 via-emerald-400 to-orange-400" />
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-sky-700">源泉徴収税の設定</p>
              <h3 className="text-xl font-black">{row.name}</h3>
              <p className="text-xs text-slate-500">この月の報酬（出勤分） {yen(row.base)}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {choice("kou", "甲", "扶養控除等申告書あり")}
            {choice("otsu", "乙", "申告書なし")}
            {choice("none", "なし", "徴収しない")}
          </div>
          {type === "otsu" && (
            <div className="space-y-2">
              <FieldLabel>税率（%）</FieldLabel>
              <TextInput type="number" step="0.001" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          )}
          {type !== "none" && (
            <div className="space-y-2">
              <FieldLabel>源泉徴収税額（円）{type === "otsu" && !manual ? "　自動計算" : ""}</FieldLabel>
              <TextInput type="number" value={shown} onChange={(e) => { if (type === "otsu") setManual(true); setAmount(e.target.value); }} placeholder="0" />
              {type === "otsu" && (manual
                ? <button type="button" onClick={() => { setManual(false); setAmount(""); }} className="text-xs font-bold text-sky-700">自動計算（{yen(row.base)} × {rate}% = {yen(auto)}）に戻す</button>
                : <p className="text-xs text-slate-500">{yen(row.base)} × {rate}% ＝ {yen(auto)}（1円未満切り捨て）。金額を直接書き換えることもできます。</p>)}
              {type === "otsu" && !manual && row.base >= OTSU_FLAT_LIMIT && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">この月の報酬は105,000円以上なので、3.063%ではなく乙欄の税額表の金額になります。税額表で確認した金額を上の欄に入力してください。</p>}
              {type === "kou" && <p className="text-xs leading-5 text-slate-500">甲欄は源泉徴収税額表（月額表）で、支給額と扶養の人数から求めた金額を入力してください。入力した金額は翌月も初期値として入ります。</p>}
            </div>
          )}
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm"><span className="font-bold">この月の源泉徴収税</span><span className="text-lg font-black text-sky-700">−{yen(tax)}</span></div>
          <Button onClick={save} disabled={saving} className="w-full bg-sky-600 hover:bg-sky-700"><Save className="mr-1 h-4 w-4" />{saving ? "保存中..." : "保存する（翌月以降も同じ設定）"}</Button>
        </div>
      </div>
    </div>
  );
}

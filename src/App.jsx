
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { CalendarDays, FileText, LogOut, Plus, Printer, Save, Trash2, UserPlus, Users, LayoutDashboard, TrendingUp, Wallet, Megaphone, BookOpen, ChevronLeft, Settings, KeyRound } from "lucide-react";
import schools from "./schools.json";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function yen(value) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(Number(value || 0));
}
function todayString() { return new Date().toISOString().slice(0, 10); }
function monthString(date = new Date()) { return date.toISOString().slice(0, 7); }
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
function personSubtotal(person) {
  return person.works.reduce((sum, work) => sum + work.dates.length * safeNumber(work.rate), 0);
}
function personWorkDays(person) {
  return person.works.reduce((sum, work) => sum + work.dates.length, 0);
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

  return <MainSystem session={session} profile={profile} setProfile={setProfile} />;
}

function MainSystem({ session, profile, setProfile }) {
  const allowedSchool = getSchoolById(profile.school_id);
  const [mode, setMode] = useState("dashboard");
  const [schoolId, setSchoolId] = useState(allowedSchool.id);
  const school = getSchoolById(schoolId);
  const recipient = "Sowers株式会社";

  const [invoiceDate, setInvoiceDate] = useState(todayString());
  const [targetMonth, setTargetMonth] = useState(monthString());
  const [issuer, setIssuer] = useState(profile.display_name || "");
  const [invoiceNo, setInvoiceNo] = useState(`SW-${todayString().split("-").join("")}`);
  const [bankInfo, setBankInfo] = useState("");
  const [notes, setNotes] = useState("");
  const [people, setPeople] = useState([makePerson(school.defaultRate, "")]);
  const [activePersonId, setActivePersonId] = useState(null);
  const [openCalendarKey, setOpenCalendarKey] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(monthString());
  const [expenses, setExpenses] = useState([makeExpenseRow()]);
  const [saveMessage, setSaveMessage] = useState("");

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

  useEffect(() => {
    loadInvoice();
    loadStudents();
  }, [schoolId, targetMonth]);

  async function loadInvoice() {
    if (!supabase) return;
    const { data } = await supabase
      .from("invoice_months")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("school_id", schoolId)
      .eq("target_month", targetMonth)
      .maybeSingle();

    if (data) {
      setInvoiceDate(data.invoice_date || todayString());
      setInvoiceNo(data.invoice_no || `SW-${todayString().split("-").join("")}`);
      setIssuer(data.issuer || profile.display_name || "");
      setBankInfo(data.bank_info || "");
      setNotes(data.notes || "");
      setPeople(Array.isArray(data.people) && data.people.length ? data.people : [makePerson(school.defaultRate, "")]);
      setExpenses(Array.isArray(data.expenses) && data.expenses.length ? data.expenses : [makeExpenseRow()]);
      setActivePersonId(null);
    } else {
      const defaultClassName = school.classes[0]?.name || "A";
      setPeople([makePerson(school.defaultRate, "")]);
      setPeople([{ ...makePerson(school.defaultRate, ""), works: [makeWorkRow(school.defaultRate, `${defaultClassName}クラス メイン`)] }]);
      setExpenses([makeExpenseRow()]);
      setNotes("");
    }
  }

  async function saveInvoice() {
    if (!supabase) return;
    setSaveMessage("保存中...");
    const payload = {
      user_id: session.user.id,
      school_id: schoolId,
      target_month: targetMonth,
      invoice_date: invoiceDate,
      invoice_no: invoiceNo,
      issuer,
      bank_info: bankInfo,
      notes,
      people,
      expenses,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("invoice_months").upsert(payload, { onConflict: "user_id,school_id,target_month" });
    setSaveMessage(error ? `保存エラー：${error.message}` : "保存しました。");
  }

  async function copyPreviousMonth() {
    if (!supabase) return;
    const prevMonth = addMonths(targetMonth, -1);
    const { data, error } = await supabase
      .from("invoice_months")
      .select("*")
      .eq("user_id", session.user.id)
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
      .eq("user_id", session.user.id)
      .eq("school_id", schoolId)
      .order("page_no", { ascending: true })
      .order("created_at", { ascending: false });
    setStudents(data || []);
  }

  async function addStudent() {
    if (!supabase) return;
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
    setStudents((prev) => prev.map((student) => (student.id === id ? { ...student, [key]: value } : student)));
    if (!supabase) return;
    await supabase.from("students").update({ [key]: value, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", session.user.id);
  }

  async function deleteStudent(id) {
    setStudents((prev) => prev.filter((student) => student.id !== id));
    if (!supabase) return;
    await supabase.from("students").delete().eq("id", id).eq("user_id", session.user.id);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  const updatePerson = (personId, key, value) => setPeople((prev) => prev.map((person) => (person.id === personId ? { ...person, [key]: value } : person)));
  const updateWork = (personId, workId, key, value) => {
    setPeople((prev) => prev.map((person) =>
      person.id === personId
        ? { ...person, works: person.works.map((work) => (work.id === workId ? { ...work, [key]: value } : work)) }
        : person
    ));
  };
  const addPerson = () => {
    const defaultClassName = school.classes[0]?.name || "A";
    const next = { ...makePerson(school.defaultRate, ""), works: [makeWorkRow(school.defaultRate, `${defaultClassName}クラス メイン`)] };
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
    setPeople((prev) => prev.map((person) => person.id === personId ? { ...person, works: [...person.works, makeWorkRow(school.defaultRate, `${defaultClassName}クラス メイン`)] } : person));
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

  if (mode === "account") {
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

            <button type="button" onClick={() => setMode("dashboard")} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-800"><ChevronLeft className="h-4 w-4" />ダッシュボードに戻る</button>

            <div className="grid grid-cols-2 gap-2">
              <Button variant={mode === "invoice" ? "primary" : "outline"} onClick={() => setMode("invoice")} className="w-full"><FileText className="mr-1 h-4 w-4" />請求書</Button>
              <Button variant={mode === "students" ? "primary" : "outline"} onClick={() => setMode("students")} className="w-full"><Users className="mr-1 h-4 w-4" />生徒名簿</Button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {mode === "invoice" && <Button variant="outline" onClick={saveInvoice} className="w-full"><Save className="mr-1 h-4 w-4" />保存</Button>}
              {mode === "invoice" && <Button onClick={downloadPdf} className="w-full"><FileText className="mr-1 h-4 w-4" />PDF保存</Button>}
              {mode === "invoice" && <Button variant="outline" onClick={printInvoice} className="w-full"><Printer className="mr-1 h-4 w-4" />印刷</Button>}
              <Button variant="ghost" onClick={logout} className="w-full"><LogOut className="mr-1 h-4 w-4" />ログアウト</Button>
            </div>
            {saveMessage && <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{saveMessage}</div>}
          </div>

          {mode === "invoice" ? (
            <>
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
                                  <FieldLabel>1日単価</FieldLabel>
                                  <TextInput type="number" value={work.rate} onChange={(event) => updateWork(activePerson.id, work.id, "rate", event.target.value)} />
                                </div>
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
          />
        </section>
      </div>
    </div>
  );
}

function StudentRoster({ school, targetMonth, students, visibleStudents, rosterPage, setRosterPage, addStudent, updateStudent, deleteStudent, classCounts, studentStats, message }) {
  const [pdfMsg, setPdfMsg] = useState("");
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
            <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr] gap-1 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">
              <span>氏名</span><span>クラス</span><span>状態</span>
            </div>
            {students.length ? students.map((s, i) => {
              const st = s.status || "active";
              const stColor = st === "active" ? "text-emerald-700" : st === "suspended" ? "text-amber-700" : "text-slate-400";
              return (
                <div key={s.id} className={`grid grid-cols-[1.5fr_0.7fr_0.7fr] items-center gap-1 px-3 py-2 text-sm ${i % 2 ? "bg-white" : "bg-slate-50/60"}`}>
                  <span className="font-bold break-words" style={{ wordBreak: "auto-phrase" }}>{s.full_name || "（未入力）"}</span>
                  <span className="break-words text-slate-600">{s.class_name || "-"}</span>
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

function InvoicePreview({ recipient, invoiceNo, invoiceDate, targetMonth, issuer, school, people, expenses, totals, bankInfo, notes }) {
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

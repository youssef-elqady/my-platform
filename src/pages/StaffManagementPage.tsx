import React, { useCallback, useEffect, useState } from 'react';
import { Shield, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { STAFF_PERMISSIONS } from '../lib/permissions';

type Row = { user_id: string; display_name: string; permissions: Record<string, unknown> | null; is_active: boolean; created_at: string };

export default function StaffManagementPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('staff_members').select('user_id,display_name,permissions,is_active,created_at').order('created_at', { ascending: false });
    if (e) setError('تعذر تحميل المساعدين.');
    else setRows((data ?? []) as Row[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setError(''); setMessage('');
    if (name.trim().length < 2) return setError('اكتب اسم المساعد.');
    if (!email.includes('@')) return setError('اكتب بريدًا صحيحًا.');
    if (password.length < 8) return setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
    const selected = Object.fromEntries(Object.entries(permissions).filter(([, v]) => v));
    setBusy(true);
    try {
      const { data, error: e } = await supabase.functions.invoke('create-assistant', { body: { email: email.trim().toLowerCase(), password, display_name: name.trim(), permissions: selected } });
      if (e || data?.error) throw new Error(data?.error || 'تعذر إنشاء المساعد.');
      setMessage('تم إنشاء حساب المساعد بنجاح.'); setOpen(false); setName(''); setEmail(''); setPassword(''); setPermissions({}); await load();
    } catch (e) { setError('تعذر إنشاء المساعد. تأكد من البيانات والصلاحيات ثم حاول مرة أخرى.'); console.error(e); }
    finally { setBusy(false); }
  };

  return <main dir="rtl" className="min-h-screen bg-[#07090f] px-4 py-6 text-white sm:px-6"><div className="mx-auto max-w-6xl">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black text-sky-400">إدارة الفريق</p><h1 className="mt-2 text-3xl font-black">المساعدون والصلاحيات</h1><p className="mt-2 text-sm text-slate-500">مصدر واحد للصلاحيات، مع منع التكرار والنقر المزدوج أثناء الإنشاء.</p></div><button type="button" onClick={()=>{setError('');setMessage('');setOpen(true)}} className="rounded-2xl bg-sky-500 px-5 py-3 font-black text-slate-950"><UserPlus size={17} className="inline"/> إنشاء مساعد</button></header>
    {error&&<div className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-bold text-red-300">{error}</div>}{message&&<div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-300">{message}</div>}
    <div className="grid gap-3">{rows.map(row=>{const raw=row.permissions as any;const p=(raw?.permissions&&typeof raw.permissions==='object')?raw.permissions:raw??{};const count=Object.values(p).filter(Boolean).length;return <div key={row.user_id} className="rounded-3xl border border-white/[0.07] bg-[#0d1118] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">{row.display_name}</h2><p className="mt-1 text-xs text-slate-500">{row.is_active?'نشط':'موقوف'} • {count} صلاحية</p></div><Shield className="text-sky-400" size={20}/></div></div>})}{rows.length===0&&<div className="rounded-3xl border border-white/[0.07] bg-[#0d1118] py-16 text-center text-slate-500">لا يوجد مساعدين حتى الآن.</div>}</div>
    {open&&<div className="fixed inset-0 z-[1000] grid place-items-center bg-black/80 p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false)}}><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/[0.08] bg-[#0d1118] p-5 sm:p-7"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-black">إنشاء حساب مساعد</h2><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="text-slate-500">إغلاق</button></div><div className="grid gap-4"><label className="text-sm font-black">الاسم<input className="mt-2 w-full rounded-2xl border border-white/[0.08] bg-[#11151d] px-4 py-3 text-white outline-none" value={name} onChange={e=>setName(e.target.value)}/></label><label className="text-sm font-black">البريد<input className="mt-2 w-full rounded-2xl border border-white/[0.08] bg-[#11151d] px-4 py-3 text-white outline-none" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="text-sm font-black">كلمة المرور<input className="mt-2 w-full rounded-2xl border border-white/[0.08] bg-[#11151d] px-4 py-3 text-white outline-none" type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label><div className="grid gap-2 sm:grid-cols-2">{STAFF_PERMISSIONS.map(([key,label])=><label key={key} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3 text-sm font-bold"><input type="checkbox" checked={Boolean(permissions[key])} onChange={e=>setPermissions(p=>({...p,[key]:e.target.checked}))}/>{label}</label>)}</div><button type="button" disabled={busy} onClick={()=>void create()} className="rounded-2xl bg-sky-500 px-5 py-3 font-black text-slate-950 disabled:opacity-40">{busy?'جاري الإنشاء...':'إنشاء الحساب'}</button></div></div></div>}
  </div></main>;
}

import { useEffect, useMemo, useState } from "react";
import { Search, Calendar, ChevronLeft, User, X } from "lucide-react";
import SelectField from "./components/SelectField";
import { expiryOptions, positionOptions, repeatOptions, weekdayOptions, dayOfMonthOptions } from "./data/options";

type TrelloCard = { id: string; name: string; desc?: string; idList: string; idLabels?: string[]; idMembers?: string[] };
type TrelloList = { id: string; name: string };
type CloneRule = { id: string; srcId: string; srcName: string; listId: string; listName: string; repeat: string; weekday: string; dayOfMonth: number; time: string; pos: string; expiry: string; active: boolean; lastRun: string | null; created: string };
type Context = "board" | "list" | "card";
declare global { interface Window { TrelloPowerUp: any } }
const RULES_KEY = "autoCloneRules";
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function isDue(rule: CloneRule): boolean {
  if (!rule.active) return false;
  const now = new Date();
  if (rule.expiry !== "never" && now > new Date(rule.expiry)) return false;
  if (rule.lastRun) {
    const lr = new Date(rule.lastRun);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lrDay = new Date(lr.getFullYear(), lr.getMonth(), lr.getDate());
    if (rule.repeat === "Daily" && lrDay >= today) return false;
    if (rule.repeat === "Weekly" && (today.getTime() - lrDay.getTime()) / 864e5 < 6) return false;
    if (rule.repeat === "Monthly" && lr.getMonth() === now.getMonth() && lr.getFullYear() === now.getFullYear()) return false;
  }
  const [h, m] = (rule.time || "00:00").split(":").map(Number);
  if (now.getHours() < h || (now.getHours() === h && now.getMinutes() < m)) return false;
  if (rule.repeat === "Weekly") { const idx = weekdayOptions.indexOf(rule.weekday); if (idx >= 0 && idx !== now.getDay()) return false; }
  if (rule.repeat === "Monthly" && rule.dayOfMonth !== now.getDate()) return false;
  return true;
}

function computeExpiry(opt: string): string {
  if (opt === "Never") return "never";
  const d = new Date();
  d.setDate(d.getDate() + ({ "1 Week": 7, "2 Weeks": 14, "1 Month": 30, "3 Months": 90, "6 Months": 180 }[opt] ?? 30));
  return d.toISOString();
}

function App() {
  const [t, setT] = useState<any>(null);
  const [ctx, setCtx] = useState<Context>("board");
  const [view, setView] = useState<"form" | "rules" | "account" | "cardback">("form");
  const [member, setMember] = useState<{ fullName?: string; username?: string; avatarUrl?: string } | null>(null);
  const [cards, setCards] = useState<TrelloCard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState("");
  const [cardQuery, setCardQuery] = useState("");
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [targetListId, setTargetListId] = useState("");
  const [repeat, setRepeat] = useState("Weekly");
  const [weekday, setWeekday] = useState("Monday");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [atTime, setAtTime] = useState("09:00");
  const [expiry, setExpiry] = useState("1 Month");
  const [position, setPosition] = useState("Top");
  const [rules, setRules] = useState<CloneRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [debugError, setDebugError] = useState<string>("");
  const [debugData, setDebugData] = useState<string>("");
  const TRELLO_APP_KEY = "e533ed095b0c07ac12a6f8d2aef8a3dd";


  useEffect(() => { let a = 0; const id = setInterval(() => { a++; try { const c = window.TrelloPowerUp?.iframe?.({ appKey: TRELLO_APP_KEY, appName: 'Auto Clone' }); if (c) { setT(c); clearInterval(id); } } catch {} if (a >= 30) clearInterval(id); }, 120); return () => clearInterval(id); }, []);
  useEffect(() => { if (!t?.render || !t?.sizeTo) return; try { t.render(() => t.sizeTo("#root").catch(() => {})); } catch {} }, [t]);
  useEffect(() => { if (!t?.sizeTo) return; const id = requestAnimationFrame(() => t.sizeTo("#root").catch(() => {})); return () => cancelAnimationFrame(id); }, [t, cardMenuOpen, view, cards.length, rules.length, selectedListId, ctx]);

  useEffect(() => {
    if (!t) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const urlCtx = new URLSearchParams(window.location.search).get("ctx");
        let ctxArg = null;
        try { if (typeof t.arg === "function") ctxArg = t.arg("context"); } catch {}
        
        const [m, l, c, cc, cl] = await Promise.all([
          t.member("all").catch((e: any) => { setDebugError(prev => prev + " memErr:" + e?.message); return null; }), 
          t.lists("all").catch((e: any) => { setDebugError(prev => prev + " listErr:" + e?.message); return []; }), 
          t.cards("all").catch((e: any) => { setDebugError(prev => prev + " cardErr:" + e?.message); return []; }),
          t.card("all").catch(() => null),
          t.list("all").catch(() => null)
        ]);
        
        let mem = m;
        let bLists = l;
        let bCards = c;
        const curCard = cc;
        const curList = cl;

        // Detect context: URL param > arg > infer from data
        let context: Context | "cardback" = "board";
        if (urlCtx === "card" || urlCtx === "list" || urlCtx === "board" || urlCtx === "cardback") {
          context = urlCtx as Context | "cardback";
        } else if (ctxArg === "card" || ctxArg === "list" || ctxArg === "board") {
          context = ctxArg as Context;
        } else if (curCard?.id && curCard?.name) {
          context = "card";
        } else if (curList?.id && curList?.name) {
          context = "list";
        }
        
        if (!cancelled) {
          if (context === "cardback") {
            setCtx("card"); // Keep as card so other things don't break
            setView("cardback"); // But view is cardback
            const urlCardId = new URLSearchParams(window.location.search).get("cardId");
            if (urlCardId) setSelectedCardId(urlCardId);
          } else {
            setCtx(context as Context);
          }
        }
        if (!mem?.username || !bLists?.length || !bCards?.length) {
          try {
            const api = await t.getRestApi(); 
            const ok = await api.isAuthorized();
            if (!ok) {
              setNeedsAuth(true);
              setLoading(false);
              return;
            }
            const c2 = await t.getContext().catch(() => ({})); 
            const bid = c2?.board || (await t.board("id").catch(() => null))?.id || "";
            if (!bid) setDebugError(prev => prev + " noBid");
            
            const [me, ls, cs] = await Promise.all([
              api.get("members/me", { fields: "fullName,username,avatarUrl" }).catch((e: any) => { setDebugError(prev => prev + " apiMem:" + e?.message); return null; }), 
              bid ? api.get(`boards/${bid}/lists`, { fields: "id,name", filter: "open" }).catch((e: any) => { setDebugError(prev => prev + " apiList:" + e?.message); return []; }) : [], 
              bid ? api.get(`boards/${bid}/cards`, { fields: "id,name,desc,idList,idMembers,idLabels", filter: "open" }).catch((e: any) => { setDebugError(prev => prev + " apiCard:" + e?.message); return []; }) : []
            ]);
            
            setDebugData(`ls_len:${Array.isArray(ls)?ls.length:typeof ls} bid:${bid}`);
            
            mem = { ...(mem ?? {}), ...(me ?? {}) }; 
            if (!bLists?.length && Array.isArray(ls)) bLists = ls; 
            if (!bCards?.length && Array.isArray(cs)) bCards = cs;
          } catch (err: any) {
            setDebugError(prev => prev + " apiOut:" + err?.message);
            setToast("API error: " + err?.message);
          }
        }
        if (cancelled) return;

        setMember({ fullName: mem?.fullName ?? mem?.name, username: mem?.username ?? mem?.membername, avatarUrl: mem?.avatarUrl ?? mem?.avatarURL });
        const normLists = (bLists ?? []).map((l: any) => ({ id: l.id, name: l.name }));
        setLists(normLists);
        const normCards = (bCards ?? []).filter((c: any) => c?.id && c?.name).map((c: any) => ({ id: c.id, name: c.name, desc: c.desc ?? "", idList: c.idList, idMembers: c.idMembers ?? [], idLabels: c.idLabels ?? [] }));
        if (curCard?.id && curCard?.name && !normCards.some((c: TrelloCard) => c.id === curCard.id)) {
          normCards.unshift({ id: curCard.id, name: curCard.name, desc: curCard.desc ?? "", idList: curCard.idList ?? normLists[0]?.id ?? "", idMembers: curCard.idMembers ?? [], idLabels: curCard.idLabels ?? [] });
        }
        setCards(normCards);

        // Auto-select based on context
        if ((context === "card" || context === "cardback") && curCard?.id) {
          if (!selectedCardId) setSelectedCardId(curCard.id);
          setCardQuery(curCard.name);
          setSelectedListId(curCard.idList ?? "");
          const ln = normLists.find((l: TrelloList) => l.id === curCard.idList)?.id;
          if (ln) setTargetListId(ln);
        } else if (context === "list" && curList?.id) {
          setSelectedListId(curList.id);
          setTargetListId(curList.id);
        } else if (normLists.length) {
          setSelectedListId(normLists[0].id);
          setTargetListId(normLists[0].id);
        }
      } catch (err: any) { 
        if (!cancelled) { 
          setDebugError(prev => prev + " | outerCatch: " + (err?.message || String(err)));
          setLists([]); 
          setCards([]); 
        } 
      } finally { 
        if (!cancelled) setLoading(false); 
      }
    }
    load();
    return () => { cancelled = true; };
  }, [t]);

  useEffect(() => { if (!t) return; t.get("board", "shared", RULES_KEY).then((d: CloneRule[] | null) => { if (Array.isArray(d)) setRules(d); }).catch(() => {}); }, [t]);

  useEffect(() => {
    if (!t || !rules.length || loading) return;
    async function runDue() {
      const api = await t.getRestApi(); if (!(await api.isAuthorized())) return;
      const updated = [...rules]; const names: string[] = []; let ran = false;
      for (let i = 0; i < updated.length; i++) {
        if (!isDue(updated[i])) continue;
        try {
          const token = await api.getToken();
          const appKey = "e533ed095b0c07ac12a6f8d2aef8a3dd";
          const posStr = updated[i].pos === "Top" ? "top" : "bottom";
          const res = await fetch(`https://api.trello.com/1/cards?key=${appKey}&token=${token}&idList=${updated[i].listId}&idCardSource=${updated[i].srcId}&pos=${posStr}&keepFromSource=all`, { method: "POST" });
          if (res.ok) {
            updated[i] = { ...updated[i], lastRun: new Date().toISOString() };
            names.push(updated[i].srcName);
            ran = true;
          }
        } catch {}
      }
      if (ran) { setRules(updated); await t.set("board", "shared", RULES_KEY, updated).catch(() => {}); showToast(`Auto-cloned: ${names.join(", ")}`); }
    }
    runDue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, loading]);

  const selectedCard = useMemo(() => cards.find((c) => c.id === selectedCardId) ?? null, [cards, selectedCardId]);
  const listNameById = useMemo(() => { const m = new Map<string, string>(); for (const l of lists) m.set(l.id, l.name); return m; }, [lists]);
  const cardsInList = useMemo(() => selectedListId ? cards.filter((c) => c.idList === selectedListId) : cards, [cards, selectedListId]);
  const filteredCards = useMemo(() => {
    const q = cardQuery.trim().toLowerCase();
    if (!q) return cardsInList.slice(0, 40);
    return cardsInList.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 40);
  }, [cardsInList, cardQuery]);
  const targetList = useMemo(() => lists.find((l) => l.id === targetListId) ?? null, [lists, targetListId]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000); }
  async function persistRules(next: CloneRule[]) { setRules(next); if (t) await t.set("board", "shared", RULES_KEY, next).catch(() => {}); }

  async function onSave() {
    if (!t || saving) return;
    if (!selectedCard) { showToast("⚠ Select a card first"); return; }
    if (!selectedListId) { showToast("⚠ No list selected"); return; }
    const actualTargetListId = targetList?.id ?? selectedListId;
    const listName = listNameById.get(actualTargetListId) ?? "Unknown";
    setSaving(true);
    try {
      const rule: CloneRule = { id: uid(), srcId: selectedCard.id, srcName: selectedCard.name, listId: actualTargetListId, listName, repeat, weekday, dayOfMonth: parseInt(dayOfMonth, 10), time: atTime || "09:00", pos: position, expiry: computeExpiry(expiry), active: true, lastRun: null, created: new Date().toISOString() };
      const api = await t.getRestApi(); 
      if (!(await api.isAuthorized())) await api.authorize({ scope: "read,write", expiration: "never" });
      
      const token = await api.getToken();
      const appKey = "e533ed095b0c07ac12a6f8d2aef8a3dd";
      const posStr = position === "Top" ? "top" : "bottom";
      
      const res = await fetch(`https://api.trello.com/1/cards?key=${appKey}&token=${token}&idList=${actualTargetListId}&idCardSource=${selectedCard.id}&pos=${posStr}&keepFromSource=all`, {
        method: 'POST'
      });
      
      if (!res.ok) {
        throw new Error(`Trello API: ${await res.text()}`);
      }
      
      rule.lastRun = new Date().toISOString();
      await persistRules([...rules, rule]);
      showToast("✓ Rule created & first clone done!");
    } catch (err: any) { showToast("✗ Failed: " + (err?.message || String(err))); } finally { setSaving(false); }
  }

  async function deleteRule(id: string) { await persistRules(rules.filter((r) => r.id !== id)); showToast("Rule deleted"); }
  async function toggleRule(id: string) { await persistRules(rules.map((r) => r.id === id ? { ...r, active: !r.active } : r)); }
  function scheduleLabel(r: CloneRule) { if (r.repeat === "Daily") return `Daily at ${r.time}`; if (r.repeat === "Weekly") return `Every ${r.weekday} at ${r.time}`; return `Monthly day ${r.dayOfMonth} at ${r.time}`; }
  function expiryLabel(r: CloneRule) { return r.expiry === "never" ? "No expiry" : `Expires ${new Date(r.expiry).toLocaleDateString()}`; }

  return (
    <div className={`p-4 bg-[#2b2c2f] text-[#B6C2CF] w-full font-sans flex flex-col relative overflow-x-hidden ${view === "cardback" ? "" : "min-h-screen"}`}>
      {toast && <div className="fixed top-2 left-2 right-2 z-[999] bg-[#22272B] border border-[#3B444C] text-[#B6C2CF] text-[13px] px-4 py-2 rounded-xl shadow-2xl animate-pulse text-center">{toast}</div>}

      {view !== "cardback" && (
        <div className="flex items-center justify-between mb-5 relative">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setView(view === "account" ? "form" : "account"); setCardMenuOpen(false); }} className="h-8 pl-1 pr-3 rounded-full border border-[#2C333A] bg-[#2C333A] hover:bg-[#3B444C] transition flex items-center gap-2" aria-label="Account">
              <div className="h-6 w-6 rounded-full overflow-hidden bg-[#22272b] grid place-items-center shrink-0">
                {member?.avatarUrl ? <img src={member.avatarUrl} alt="User" className="h-full w-full object-cover" /> : <User size={14} className="text-[#8C9BAB]" />}
              </div>
              <span className="text-[12px] text-[#B6C2CF] font-medium truncate max-w-[100px]">{member?.fullName?.split(" ")[0] ?? member?.username ?? "User"}</span>
            </button>
          </div>

          {view !== "form" ? (
            <button type="button" onClick={() => setView("form")} className="p-1 -mr-1 text-[#8C9BAB] hover:text-[#B6C2CF] transition" aria-label="Back">
              <ChevronLeft size={22} />
            </button>
          ) : (
            <button type="button" onClick={() => { if (t) t.closePopup(); }} className="p-1 -mr-1 text-[#8C9BAB] hover:text-[#B6C2CF] transition" aria-label="Close">
              <X size={20} />
            </button>
          )}
        </div>
      )}

      {view === "account" && (
        <div className="mt-1">
          <div className="flex items-center gap-2 bg-[#22272b] border border-[#3B444C] rounded-lg p-3">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-[#2C333A] bg-[#2C333A] grid place-items-center shrink-0">
              {member?.avatarUrl ? <img src={member.avatarUrl} alt="User" className="h-full w-full object-cover" /> : <User size={20} className="text-[#8C9BAB]" />}
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-white truncate">{member?.fullName ?? "Unknown"}</div>
              <div className="text-[13px] text-[#8C9BAB] truncate">{member?.username ? `@${member.username}` : "@"}</div>
            </div>
          </div>
        </div>
      )}

      {view === "rules" && (
        <div className="mt-1">
          <h2 className="text-[12px] font-medium text-[#8C9BAB] mb-2 px-1">Rules ({rules.length})</h2>
          {rules.length === 0 ? <div className="text-[12px] text-[#738496] bg-[#22272b] border border-[#3B444C] rounded-lg p-4 text-center">No rules yet.</div> : (
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
              {rules.map((r) => (
                <div key={r.id} className={`bg-[#22272b] border rounded-lg p-2.5 transition ${r.active ? "border-[#2C333A]" : "border-[#3B444C] opacity-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium text-[#B6C2CF] truncate">{r.srcName}</div>
                      <div className="text-[12px] text-[#8C9BAB] truncate mt-0.5">→ {r.listName}</div>
                      <div className="text-[11px] text-[#738496] mt-2">{scheduleLabel(r)} · {expiryLabel(r)}</div>
                      {r.lastRun && <div className="text-[11px] text-[#738496] mt-0.5">Last: {new Date(r.lastRun).toLocaleString()}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-1">
                      <button type="button" onClick={() => toggleRule(r.id)} className={`h-6 w-10 rounded-full transition relative ${r.active ? "bg-zinc-600" : "bg-[#2C333A]"}`}><div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${r.active ? "left-5" : "left-1"}`} /></button>
                      <button type="button" onClick={() => deleteRule(r.id)} className="h-8 w-8 rounded-lg hover:bg-[#2C333A] transition grid place-items-center text-[#738496] hover:text-red-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {needsAuth ? (
        <div className="flex flex-col items-center justify-center mt-10 p-4 text-center border border-[#3B444C] rounded-xl bg-[#22272b]">
          <p className="text-[#B6C2CF] text-[14px] mb-4">Auto Clone needs permission to read your lists and cards to work correctly.</p>
          <button type="button" onClick={async () => {
            try {
              const api = await t.getRestApi();
              await api.authorize({ scope: "read,write", expiration: "never" });
              window.location.reload();
            } catch (err: any) {
              setToast("Auth failed: " + err?.message);
            }
          }} className="bg-[#579DFF] text-[#141518] px-6 py-2 rounded-xl font-medium hover:bg-[#85B8FF] transition">
            Authorize Trello
          </button>
        </div>
      ) : view === "form" && (
        <div className="flex flex-col gap-2.5 pb-2">
          {loading ? <div className="flex items-center justify-center py-10 text-[13px] text-[#738496]">Loading board data…</div> : (
            <>
              {/* CARD context: show card info only, no selectors */}
              {ctx === "card" && selectedCard && (
                <div className="bg-[#22272b] border border-[#3B444C] rounded-lg p-3">
                  <div className="text-[11px] font-medium text-[#738496] uppercase tracking-widest mb-1">Cloning card</div>
                  <div className="text-[14px] font-medium text-[#B6C2CF] truncate">{selectedCard.name}</div>
                  <div className="text-[12px] text-[#8C9BAB] truncate">in {listNameById.get(selectedCard.idList) ?? "list"}</div>
                </div>
              )}

              {/* BOARD context: Select a list first */}
              {ctx === "board" && (
                <>
                  <SelectField
                    label="Select a list"
                    value={lists.find((l) => l.id === selectedListId)?.name || "Select list"}
                    options={lists}
                    onChange={(id) => { const li = lists.find((l) => l.id === id); if (li) { setSelectedListId(li.id); setTargetListId(li.id); setSelectedCardId(""); setCardQuery(""); } }}
                  />
                  <div className="text-[10px] text-red-400 mt-1">Debug Lists: {lists.length} | Context: {ctx} {debugError && `| Err: ${debugError}`} <br/> Data: {debugData}</div>
                </>
              )}

              {/* LIST context: show which list (read-only info) */}
              {ctx === "list" && (
                <div className="bg-[#22272b] border border-[#3B444C] rounded-xl p-4">
                  <div className="text-[11px] font-medium text-[#738496] uppercase tracking-widest mb-1.5">List</div>
                  <div className="text-[15px] font-medium text-[#B6C2CF] truncate">{listNameById.get(selectedListId) ?? "Selected list"}</div>
                </div>
              )}

              {/* BOARD & LIST: Card selector (filtered by selected list) */}
              {(ctx === "board" || ctx === "list") && (
                <div className="relative">
                  <label className="text-[13px] text-[#8C9BAB] mb-1.5 block">Select a card</label>
                  <div className="relative">
                    <input type="text" value={cardQuery} placeholder="Search"
                      onChange={(e) => { setCardQuery(e.target.value); setCardMenuOpen(true); }}
                      onFocus={() => setCardMenuOpen(true)}
                      className="w-full bg-[#22272b] border border-[#3B444C] rounded-xl px-4 py-3 pr-10 text-[14px] text-[#B6C2CF] placeholder-zinc-500 outline-none hover:border-[#2C333A] focus:border-[#2C333A] transition" />
                    <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#738496] pointer-events-none" />
                  </div>
                  {cardMenuOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto bg-[#2C333A] border border-[#2C333A] rounded-xl shadow-2xl py-1">
                      {filteredCards.length === 0 ? <div className="px-4 py-3 text-[13px] text-[#8C9BAB]">{selectedListId ? "No cards in this list" : "No cards found"}</div> : (
                        filteredCards.map((c) => (
                          <button key={c.id} type="button"
                            onClick={() => { setSelectedCardId(c.id); setCardQuery(c.name); setCardMenuOpen(false); setTargetListId(c.idList); }}
                            className={`w-full text-left px-4 py-2.5 transition hover:bg-[#3B444C] ${c.id === selectedCardId ? "bg-zinc-700/30" : ""}`}>
                            <div className="text-[14px] text-[#B6C2CF] truncate">{c.name}</div>
                            <div className="text-[12px] text-[#8C9BAB] truncate mt-0.5">{listNameById.get(c.idList) ?? ""}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Clone settings — always shown */}
              <SelectField label="Repeats" value={repeat} options={repeatOptions} onChange={setRepeat} />
              
              <div>
                <label className="text-[12px] text-[#8C9BAB] mb-1 block">At</label>
                <div className="relative">
                  <input type="time" value={atTime} onChange={(e) => setAtTime(e.target.value)} className="w-full bg-[#22272b] border border-[#3B444C] rounded-lg px-3 py-2 text-[13px] text-[#B6C2CF] outline-none hover:border-[#2C333A] focus:border-[#2C333A] transition [color-scheme:dark]" />
                </div>
              </div>

              {repeat === "Weekly" && (
                <div>
                  <label className="text-[12px] text-[#8C9BAB] mb-1 block">On</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#738496] pointer-events-none" />
                    <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className="w-full bg-[#22272b] border border-[#3B444C] rounded-lg px-3 py-2 pl-9 text-[13px] text-[#B6C2CF] outline-none hover:border-[#2C333A] focus:border-[#2C333A] transition appearance-none cursor-pointer">
                      {weekdayOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {repeat === "Monthly" && (
                <div>
                  <label className="text-[13px] text-[#8C9BAB] mb-1.5 block">On</label>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#738496] pointer-events-none" />
                    <select value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className="w-full bg-[#22272b] border border-[#3B444C] rounded-xl px-4 py-3 pl-11 text-[14px] text-[#B6C2CF] outline-none hover:border-[#2C333A] focus:border-[#2C333A] transition appearance-none cursor-pointer">
                      {dayOfMonthOptions.map(o => <option key={o} value={o}>Day {o}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Every" value={expiry} options={expiryOptions} onChange={setExpiry} />
                <SelectField label="Position" value={position} options={positionOptions} onChange={setPosition} />
              </div>

              {(ctx === "board" || ctx === "list") && (
                <SelectField label="List" value={lists.find(l => l.id === targetListId)?.name || "Select list"} options={lists} onChange={setTargetListId} />
              )}

              <div className="flex justify-end mt-2">
                <button type="button" onClick={onSave} disabled={saving} className="bg-[#2B2D31] hover:bg-[#35373C] border border-[#3B3D41] text-[#B6C2CF] text-[14px] font-medium px-6 py-2.5 rounded-xl transition disabled:opacity-50 min-w-[100px]">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {view === "cardback" && (
        <div className="flex items-center justify-between bg-[#22272b] border border-[#3B444C] rounded-lg p-3">
          <div>
            <div className="text-[11px] font-medium text-[#738496] uppercase tracking-widest mb-1">Next Repeat</div>
            <div className="text-[14px] font-medium text-[#B6C2CF]">
              {rules.find(r => r.srcId === selectedCardId)?.repeat === "Daily" && `Daily at ${rules.find(r => r.srcId === selectedCardId)?.time}`}
              {rules.find(r => r.srcId === selectedCardId)?.repeat === "Weekly" && `Every ${rules.find(r => r.srcId === selectedCardId)?.weekday} at ${rules.find(r => r.srcId === selectedCardId)?.time}`}
              {rules.find(r => r.srcId === selectedCardId)?.repeat === "Monthly" && `Monthly on day ${rules.find(r => r.srcId === selectedCardId)?.dayOfMonth} at ${rules.find(r => r.srcId === selectedCardId)?.time}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
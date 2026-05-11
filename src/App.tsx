import { useEffect, useMemo, useState } from "react";
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
  const [view, setView] = useState<"form" | "rules" | "account">("form");
  const [member, setMember] = useState<{ fullName?: string; username?: string; avatarUrl?: string } | null>(null);
  const [cards, setCards] = useState<TrelloCard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState("");
  const [cardQuery, setCardQuery] = useState("");
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [targetListName, setTargetListName] = useState("");
  const [repeat, setRepeat] = useState("Weekly");
  const [weekday, setWeekday] = useState("Monday");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [atTime, setAtTime] = useState("09:00");
  const [expiry, setExpiry] = useState("1 Month");
  const [position, setPosition] = useState("Top");
  const [rules, setRules] = useState<CloneRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { let a = 0; const id = setInterval(() => { a++; try { const c = window.TrelloPowerUp?.iframe?.(); if (c) { setT(c); clearInterval(id); } } catch {} if (a >= 30) clearInterval(id); }, 120); return () => clearInterval(id); }, []);
  useEffect(() => { if (!t?.render || !t?.sizeTo) return; try { t.render(() => t.sizeTo("#root").catch(() => {})); } catch {} }, [t]);
  useEffect(() => { if (!t?.sizeTo) return; const id = requestAnimationFrame(() => t.sizeTo("#root").catch(() => {})); return () => cancelAnimationFrame(id); }, [t, cardMenuOpen, view, cards.length, rules.length, selectedListId, ctx]);

  useEffect(() => {
    if (!t) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Read context from URL query param (most reliable), then t.arg, then infer
        const urlCtx = new URLSearchParams(window.location.search).get("ctx");
        const ctxArg = await t.arg("context").catch(() => null);
        const pf = (await t.arg("prefetch").catch(() => null)) ?? {};
        const sp = (await t.get("board", "shared", "autoClonePrefetch").catch(() => null)) ?? {};

        let mem = pf.member ?? sp.member ?? null;
        let bLists = pf.lists ?? sp.lists ?? [];
        let bCards = pf.cards ?? sp.cards ?? [];
        const curCard = pf.currentCard ?? sp.currentCard ?? null;
        const curList = pf.currentList ?? sp.currentList ?? null;

        // Detect context: URL param > arg > infer from data
        let context: Context = "board";
        if (urlCtx === "card" || urlCtx === "list" || urlCtx === "board") {
          context = urlCtx;
        } else if (ctxArg === "card" || ctxArg === "list" || ctxArg === "board") {
          context = ctxArg;
        } else if (curCard?.id && curCard?.name) {
          context = "card";
        } else if (curList?.id && curList?.name) {
          context = "list";
        }
        if (!cancelled) setCtx(context);

        // Fallback fetches
        if (!mem || !Array.isArray(bLists) || !Array.isArray(bCards)) {
          const [m, l, c] = await Promise.all([t.member("all").catch(() => null), t.lists("id", "name").catch(() => []), t.cards("id", "name", "desc", "idList", "idMembers", "idLabels").catch(() => [])]);
          mem = mem ?? m; bLists = bLists?.length ? bLists : l; bCards = bCards?.length ? bCards : c;
        }
        if (!mem?.username || !bLists?.length || !bCards?.length) {
          try {
            const api = await t.getRestApi(); const ok = await api.isAuthorized();
            if (!ok) await api.authorize({ scope: "read,write", expiration: "never" });
            const c2 = await t.getContext().catch(() => ({})); const bid = c2?.board || (await t.board("id").catch(() => null))?.id || "";
            const [me, ls, cs] = await Promise.all([api.get("members/me", { fields: "fullName,username,avatarUrl" }).catch(() => null), bid ? api.get(`boards/${bid}/lists`, { fields: "id,name", filter: "open" }).catch(() => []) : [], bid ? api.get(`boards/${bid}/cards`, { fields: "id,name,desc,idList,idMembers,idLabels", filter: "open" }).catch(() => []) : []]);
            mem = { ...(mem ?? {}), ...(me ?? {}) }; if (!bLists?.length && Array.isArray(ls)) bLists = ls; if (!bCards?.length && Array.isArray(cs)) bCards = cs;
          } catch {}
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
        if (context === "card" && curCard?.id) {
          setSelectedCardId(curCard.id);
          setCardQuery(curCard.name);
          setSelectedListId(curCard.idList ?? "");
          const ln = normLists.find((l: TrelloList) => l.id === curCard.idList)?.name;
          if (ln) setTargetListName(ln);
        } else if (context === "list" && curList?.id) {
          setSelectedListId(curList.id);
          const ln = normLists.find((l: TrelloList) => l.id === curList.id)?.name;
          if (ln) setTargetListName(ln);
        } else if (normLists.length) {
          setSelectedListId(normLists[0].id);
          setTargetListName(normLists[0].name);
        }
      } catch { if (!cancelled) { setLists([]); setCards([]); } } finally { if (!cancelled) setLoading(false); }
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
        try { await api.post("cards", { idCardSource: updated[i].srcId, idList: updated[i].listId, pos: updated[i].pos === "Top" ? "top" : "bottom", keepFromSource: "attachments,checklists,comments,labels,members,stickers" }); updated[i] = { ...updated[i], lastRun: new Date().toISOString() }; names.push(updated[i].srcName); ran = true; } catch {}
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
  const targetList = useMemo(() => lists.find((l) => l.name === targetListName) ?? null, [lists, targetListName]);

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
      const api = await t.getRestApi(); if (!(await api.isAuthorized())) await api.authorize({ scope: "read,write", expiration: "never" });
      await api.post("cards", { idCardSource: selectedCard.id, idList: actualTargetListId, pos: position === "Top" ? "top" : "bottom", keepFromSource: "attachments,checklists,comments,labels,members,stickers" });
      rule.lastRun = new Date().toISOString();
      await persistRules([...rules, rule]);
      showToast("✓ Rule created & first clone done!");
    } catch { showToast("✗ Failed. Try again."); } finally { setSaving(false); }
  }

  async function deleteRule(id: string) { await persistRules(rules.filter((r) => r.id !== id)); showToast("Rule deleted"); }
  async function toggleRule(id: string) { await persistRules(rules.map((r) => r.id === id ? { ...r, active: !r.active } : r)); }
  function scheduleLabel(r: CloneRule) { if (r.repeat === "Daily") return `Daily at ${r.time}`; if (r.repeat === "Weekly") return `Every ${r.weekday} at ${r.time}`; return `Monthly day ${r.dayOfMonth} at ${r.time}`; }
  function expiryLabel(r: CloneRule) { return r.expiry === "never" ? "No expiry" : `Expires ${new Date(r.expiry).toLocaleDateString()}`; }

  return (
    <div className="p-3 text-[#B6C2CF] w-full">
      {toast && <div className="fixed top-2 left-2 right-2 z-[999] bg-[#1D2125] border border-[#579DFF] text-[#B6C2CF] text-[12px] px-3 py-2 rounded-[8px] shadow-xl animate-pulse">{toast}</div>}

      <div className="flex items-center justify-between gap-2 mb-3">
        {view !== "form" ? (
          <button type="button" onClick={() => setView("form")} className="h-7 w-7 rounded-[6px] border border-[#3B444C] bg-[#22272B] hover:bg-[#2C333A] transition grid place-items-center" aria-label="Back">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9FADBC]"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        ) : <div />}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => { setView(view === "rules" ? "form" : "rules"); setCardMenuOpen(false); }} className="h-7 px-2 rounded-[6px] border border-[#3B444C] bg-[#22272B] hover:bg-[#2C333A] transition flex items-center gap-1 text-[11px] text-[#9FADBC]">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            {rules.filter((r) => r.active).length || 0}
            <span className="ml-1 px-1 py-0.5 rounded-[4px] bg-[#579DFF]/20 text-[#579DFF] text-[9px] font-bold">v3:{ctx}</span>
          </button>
          <button type="button" onClick={() => { setView(view === "account" ? "form" : "account"); setCardMenuOpen(false); }} className="h-7 w-7 rounded-full border border-[#3B444C] bg-[#22272B] hover:bg-[#2C333A] transition overflow-hidden grid place-items-center" aria-label="Account">
            {member?.avatarUrl ? <img src={member.avatarUrl} alt="User" className="h-full w-full object-cover" /> : <span className="text-[12px] text-[#9FADBC]">{(member?.fullName ?? "U").trim().slice(0, 1).toUpperCase()}</span>}
          </button>
        </div>
      </div>

      {view === "account" && (
        <div className="mt-3">
          <div className="flex items-center gap-3 bg-[#22272B] border border-[#3B444C] rounded-[10px] p-3">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-[#3B444C] bg-[#1D2125] grid place-items-center">
              {member?.avatarUrl ? <img src={member.avatarUrl} alt="User" className="h-full w-full object-cover" /> : <span className="text-[14px] text-[#9FADBC] font-semibold">{(member?.fullName ?? "U").trim().slice(0, 1).toUpperCase()}</span>}
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-[#B6C2CF] truncate">{member?.fullName ?? "Unknown"}</div>
              <div className="text-[12px] text-[#9FADBC] truncate">{member?.username ? `@${member.username}` : "@"}</div>
            </div>
          </div>
        </div>
      )}

      {view === "rules" && (
        <div className="mt-1">
          <h2 className="text-[13px] font-semibold text-[#9FADBC] mb-2">Rules ({rules.length})</h2>
          {rules.length === 0 ? <div className="text-[12px] text-[#758195] bg-[#22272B] border border-[#3B444C] rounded-[8px] p-4 text-center">No rules yet.</div> : (
            <div className="flex flex-col gap-2 max-h-72 overflow-auto">
              {rules.map((r) => (
                <div key={r.id} className={`bg-[#22272B] border rounded-[8px] p-2.5 transition ${r.active ? "border-[#3B444C]" : "border-[#2C333A] opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-[#B6C2CF] truncate">{r.srcName}</div>
                      <div className="text-[11px] text-[#9FADBC] truncate">→ {r.listName}</div>
                      <div className="text-[10px] text-[#758195] mt-1">{scheduleLabel(r)} · {expiryLabel(r)}</div>
                      {r.lastRun && <div className="text-[10px] text-[#758195]">Last: {new Date(r.lastRun).toLocaleString()}</div>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => toggleRule(r.id)} className={`h-6 w-9 rounded-full transition relative ${r.active ? "bg-[#579DFF]" : "bg-[#3B444C]"}`}><div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${r.active ? "left-3.5" : "left-0.5"}`} /></button>
                      <button type="button" onClick={() => deleteRule(r.id)} className="h-6 w-6 rounded-[4px] hover:bg-[#3B444C] transition grid place-items-center text-[#9FADBC] hover:text-red-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "form" && (
        <>
          {loading ? <div className="flex items-center justify-center py-8 text-[12px] text-[#758195]">Loading board data…</div> : (
            <>
              {/* CARD context: show card info only, no selectors */}
              {ctx === "card" && selectedCard && (
                <div className="mb-4 bg-[#22272B] border border-[#3B444C] rounded-[8px] p-2.5">
                  <div className="text-[10px] font-semibold text-[#758195] uppercase tracking-wide mb-1">Cloning card</div>
                  <div className="text-[13px] font-medium text-[#B6C2CF] truncate">{selectedCard.name}</div>
                  <div className="text-[11px] text-[#9FADBC] truncate">in {listNameById.get(selectedCard.idList) ?? "list"}</div>
                </div>
              )}

              {/* BOARD context: Select a list first */}
              {ctx === "board" && (
                <SelectField
                  label="Select a list"
                  value={lists.find((l) => l.id === selectedListId)?.name || "Select list"}
                  options={lists.map((l) => l.name)}
                  onChange={(name) => { const li = lists.find((l) => l.name === name); if (li) { setSelectedListId(li.id); setTargetListName(name); setSelectedCardId(""); setCardQuery(""); } }}
                />
              )}

              {/* LIST context: show which list (read-only info) */}
              {ctx === "list" && (
                <div className="mb-4 bg-[#22272B] border border-[#3B444C] rounded-[8px] p-2.5">
                  <div className="text-[10px] font-semibold text-[#758195] uppercase tracking-wide mb-1">List</div>
                  <div className="text-[13px] font-medium text-[#B6C2CF] truncate">{listNameById.get(selectedListId) ?? "Selected list"}</div>
                </div>
              )}

              {/* BOARD & LIST: Card selector (filtered by selected list) */}
              {(ctx === "board" || ctx === "list") && (
                <div className="mb-4 relative">
                  <label className="text-[12px] font-semibold text-[#9FADBC] mb-1 block">Select a card</label>
                  <input type="text" value={cardQuery} placeholder="Search card by name"
                    onChange={(e) => { setCardQuery(e.target.value); setCardMenuOpen(true); }}
                    onFocus={() => setCardMenuOpen(true)}
                    className="w-full bg-[#22272B] border border-[#3B444C] rounded-[3px] px-3 py-1.5 text-[14px] text-[#B6C2CF] placeholder-[#758195] outline-none hover:border-[#579DFF] focus:border-[#579DFF] transition" />
                  {selectedCard && <div className="mt-1 text-[11px] text-[#9FADBC]">Selected: {selectedCard.name}</div>}
                  {cardMenuOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-44 overflow-auto bg-[#282E33] border border-[#3B444C] rounded-[8px] shadow-2xl">
                      {filteredCards.length === 0 ? <div className="px-3 py-2 text-[12px] text-[#9FADBC]">{selectedListId ? "No cards in this list" : "No cards found"}</div> : (
                        filteredCards.map((c) => (
                          <button key={c.id} type="button"
                            onClick={() => { setSelectedCardId(c.id); setCardQuery(c.name); setCardMenuOpen(false); const ln = listNameById.get(c.idList); if (ln) setTargetListName(ln); }}
                            className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[#3B444C] transition ${c.id === selectedCardId ? "bg-[#3B444C]/50" : ""}`}>
                            <div className="truncate text-[#B6C2CF]">{c.name}</div>
                            <div className="text-[11px] text-[#9FADBC] truncate">{listNameById.get(c.idList) ?? ""}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Clone settings — always shown */}
              <SelectField label="Repeats" value={repeat} options={repeatOptions} onChange={setRepeat} />
              {repeat === "Weekly" && <SelectField label="On day" value={weekday} options={weekdayOptions} onChange={setWeekday} />}
              {repeat === "Monthly" && <SelectField label="On day of month" value={dayOfMonth} options={dayOfMonthOptions} onChange={setDayOfMonth} />}
              <div className="mb-4">
                <label className="text-[12px] font-semibold text-[#9FADBC] mb-1.5 block">At</label>
                <div className="bg-[#22272B] border border-[#3B444C] rounded-[3px] px-3 py-2 focus-within:border-[#579DFF]">
                  <input type="time" value={atTime} onChange={(e) => setAtTime(e.target.value)} className="w-full bg-transparent text-[14px] text-[#B6C2CF] outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SelectField label="Expiry" value={expiry} options={expiryOptions} onChange={setExpiry} />
                <SelectField label="Position" value={position} options={positionOptions} onChange={setPosition} />
              </div>

              {(ctx === "board" || ctx === "list") && (
                <div className="mt-4">
                  <SelectField label="Clone to list" value={targetListName || "Select list"} options={lists.map((l) => l.name)} onChange={setTargetListName} />
                </div>
              )}

              <div className="flex justify-end mt-4">
                <button type="button" onClick={onSave} disabled={saving} className="bg-[#579DFF] hover:bg-[#85B8FF] text-[#1D2125] text-[13px] font-semibold px-5 py-1.5 rounded-[3px] transition disabled:opacity-60">
                  {saving ? "Saving…" : "Save Rule & Clone"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
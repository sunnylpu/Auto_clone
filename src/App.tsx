import { useEffect, useMemo, useState } from "react";
import SelectField from "./components/SelectField";
import { durationOptions, positionOptions, repeatOptions } from "./data/options";

type TrelloCard = {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  idLabels?: string[];
  idMembers?: string[];
};

type TrelloList = {
  id: string;
  name: string;
};

declare global {
  interface Window {
    TrelloPowerUp: any;
  }
}

function App() {
  const [t, setT] = useState<any>(null);
  const [view, setView] = useState<"form" | "account">("form");
  const [member, setMember] = useState<{
    fullName?: string;
    username?: string;
    avatarUrl?: string;
  } | null>(null);

  const [cards, setCards] = useState<TrelloCard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [cardQuery, setCardQuery] = useState("");
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState("");

  const [repeat, setRepeat] = useState("Weekly");
  const [duration, setDuration] = useState("2 Weeks");
  const [position, setPosition] = useState("Top");
  const [targetListName, setTargetListName] = useState("");
  const [onDate, setOnDate] = useState("");
  const [atTime, setAtTime] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let attempt = 0;
    const id = window.setInterval(() => {
      attempt += 1;
      try {
        const iframeClient = window.TrelloPowerUp?.iframe?.();
        if (iframeClient) {
          setT(iframeClient);
          window.clearInterval(id);
        }
      } catch {
        // wait until context is ready
      }
      if (attempt >= 30) window.clearInterval(id);
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!t?.render || !t?.sizeTo) return;
    try {
      t.render(() => {
        t.sizeTo("#root").catch(() => {});
      });
    } catch {
      // ignore
    }
  }, [t]);

  useEffect(() => {
    if (!t?.sizeTo) return;
    const id = window.requestAnimationFrame(() => {
      t.sizeTo("#root").catch(() => {});
    });
    return () => window.cancelAnimationFrame(id);
  }, [t, cardMenuOpen, view, cards.length]);

  useEffect(() => {
    if (!t) return;
    let cancelled = false;

    async function loadContextData() {
      try {
        const prefetched = (await t.arg("prefetch").catch(() => null)) ?? {};
        const sharedPrefetched = (await t.get("board", "shared", "autoClonePrefetch").catch(() => null)) ?? {};

        let memberData = prefetched.member ?? sharedPrefetched.member ?? null;
        let boardLists = prefetched.lists ?? sharedPrefetched.lists ?? [];
        let boardCards = prefetched.cards ?? sharedPrefetched.cards ?? [];
        const currentCard = prefetched.currentCard ?? sharedPrefetched.currentCard ?? null;
        const currentList = prefetched.currentList ?? sharedPrefetched.currentList ?? null;

        // Fallbacks if args are missing.
        if (!memberData || !Array.isArray(boardLists) || !Array.isArray(boardCards)) {
          const [m, l, c] = await Promise.all([
            t.member("all").catch(() => null),
            t.lists("id", "name").catch(() => []),
            t.cards("id", "name", "desc", "idList", "idMembers", "idLabels").catch(() => []),
          ]);
          memberData = memberData ?? m;
          boardLists = Array.isArray(boardLists) && boardLists.length ? boardLists : l;
          boardCards = Array.isArray(boardCards) && boardCards.length ? boardCards : c;
        }

        // Strong fallback: Trello REST API (needs one-time auth for private boards).
        if (!memberData || !Array.isArray(boardLists) || boardLists.length === 0 || !Array.isArray(boardCards) || boardCards.length === 0) {
          try {
            const restApi = await t.getRestApi();
            const authorized = await restApi.isAuthorized();
            if (!authorized) {
              await restApi.authorize({ scope: "read,write", expiration: "never" });
            }

            const ctx = await t.getContext().catch(() => ({}));
            const boardId = ctx?.board;

            const [me, listsResp, cardsResp] = await Promise.all([
              restApi.get("members/me", { fields: "fullName,username,avatarUrl" }).catch(() => null),
              boardId
                ? restApi.get(`boards/${boardId}/lists`, { fields: "id,name", filter: "open" }).catch(() => [])
                : Promise.resolve([]),
              boardId
                ? restApi.get(`boards/${boardId}/cards`, {
                    fields: "id,name,desc,idList,idMembers,idLabels",
                    filter: "open",
                  }).catch(() => [])
                : Promise.resolve([]),
            ]);

            memberData = memberData ?? me;
            if ((!Array.isArray(boardLists) || boardLists.length === 0) && Array.isArray(listsResp)) {
              boardLists = listsResp;
            }
            if ((!Array.isArray(boardCards) || boardCards.length === 0) && Array.isArray(cardsResp)) {
              boardCards = cardsResp;
            }
          } catch {
            // keep existing fallback values
          }
        }
        if (cancelled) return;

        setMember({
          fullName: memberData?.fullName ?? memberData?.name ?? undefined,
          username: memberData?.username ?? memberData?.membername ?? undefined,
          avatarUrl: memberData?.avatarUrl ?? memberData?.avatarURL ?? undefined,
        });

        const normalizedLists = (boardLists ?? []).map((l: any) => ({
          id: l.id,
          name: l.name,
        }));
        if (currentList?.id && currentList?.name && !normalizedLists.some((l: TrelloList) => l.id === currentList.id)) {
          normalizedLists.unshift({ id: currentList.id, name: currentList.name });
        }
        setLists(normalizedLists);
        if (normalizedLists.length > 0) setTargetListName((prev) => prev || normalizedLists[0].name);

        const normalizedCards = (
          (boardCards ?? [])
            .filter((c: any) => Boolean(c?.id && c?.name))
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              desc: c.desc ?? "",
              idList: c.idList,
              idMembers: c.idMembers ?? [],
              idLabels: c.idLabels ?? [],
            }))
        );
        if (currentCard?.id && currentCard?.name && !normalizedCards.some((c: TrelloCard) => c.id === currentCard.id)) {
          normalizedCards.unshift({
            id: currentCard.id,
            name: currentCard.name,
            desc: currentCard.desc ?? "",
            idList: currentCard.idList ?? normalizedLists[0]?.id ?? "",
            idMembers: currentCard.idMembers ?? [],
            idLabels: currentCard.idLabels ?? [],
          });
        }
        setCards(normalizedCards);
      } catch {
        if (!cancelled) {
          setLists([]);
          setCards([]);
        }
      }
    }

    loadContextData();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  );

  const listNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of lists) map.set(list.id, list.name);
    return map;
  }, [lists]);

  const filteredCards = useMemo(() => {
    const q = cardQuery.trim().toLowerCase();
    if (!q) return cards.slice(0, 40);
    return cards
      .filter((c) => {
        const cardName = c.name.toLowerCase();
        const listName = (listNameById.get(c.idList) ?? "").toLowerCase();
        return cardName.includes(q) || listName.includes(q);
      })
      .slice(0, 40);
  }, [cards, cardQuery, listNameById]);

  const targetList = useMemo(
    () => lists.find((l) => l.name === targetListName) ?? null,
    [lists, targetListName]
  );

  useEffect(() => {
    if (!cards.length || selectedCardId) return;
    setSelectedCardId(cards[0].id);
    setCardQuery(cards[0].name);
  }, [cards, selectedCardId]);

  useEffect(() => {
    if (!selectedCard) return;
    const sourceListName = listNameById.get(selectedCard.idList);
    if (sourceListName) {
      setTargetListName(sourceListName);
    }
  }, [selectedCard, listNameById]);

  function getIntervalDays() {
    if (repeat === "Daily") return 1;
    if (repeat === "Monthly") return 30;
    return 7;
  }

  function getOccurrenceCount() {
    const weeks = Number.parseInt(duration, 10) || 1;
    const totalDays = weeks * 7;
    const interval = getIntervalDays();
    return Math.max(1, Math.floor(totalDays / interval));
  }

  function buildDueDate(index: number): string | undefined {
    if (!onDate) return undefined;
    const base = new Date(`${onDate}T${atTime || "00:00"}:00`);
    if (Number.isNaN(base.getTime())) return undefined;
    base.setDate(base.getDate() + getIntervalDays() * index);
    return base.toISOString();
  }

  async function onSave() {
    if (!t || saving) return;
    if (!selectedCard) {
      window.alert("Please select a card.");
      return;
    }
    if (!targetList) {
      window.alert("Please select a target list.");
      return;
    }

    setSaving(true);
    try {
      const count = getOccurrenceCount();
      const requests: Promise<any>[] = [];
      for (let i = 0; i < count; i += 1) {
        requests.push(
          t.post("cards", {
            idList: targetList.id,
            name: selectedCard.name,
            desc: selectedCard.desc ?? "",
            pos: position === "Top" ? "top" : "bottom",
            due: buildDueDate(i),
            idMembers: (selectedCard.idMembers ?? []).join(","),
            idLabels: (selectedCard.idLabels ?? []).join(","),
          })
        );
      }
      await Promise.all(requests);
      window.alert(`Created ${count} repeated card clone(s).`);
    } catch {
      window.alert("Failed to create repeated cards. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-3 text-[#B6C2CF] w-full">
      <div className="flex items-center justify-between gap-2 mb-3">
        {view === "account" ? (
          <button
            type="button"
            onClick={() => setView("form")}
            className="h-7 w-7 rounded-[6px] border border-[#3B444C] bg-[#22272B] hover:bg-[#2C333A] transition grid place-items-center"
            aria-label="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9FADBC]">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={() => {
            setView((prev) => (prev === "account" ? "form" : "account"));
            setCardMenuOpen(false);
          }}
          className="h-7 w-7 rounded-full border border-[#3B444C] bg-[#22272B] hover:bg-[#2C333A] transition overflow-hidden grid place-items-center"
          aria-label="Open account"
        >
          {member?.avatarUrl ? (
            <img src={member.avatarUrl} alt={member.fullName ?? member.username ?? "User"} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[12px] text-[#9FADBC]">{(member?.fullName ?? member?.username ?? "U").trim().slice(0, 1).toUpperCase()}</span>
          )}
        </button>
      </div>

      {view === "account" ? (
        <div className="mt-3">
          <div className="flex items-center gap-3 bg-[#22272B] border border-[#3B444C] rounded-[10px] p-3">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-[#3B444C] bg-[#1D2125] grid place-items-center">
              {member?.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.fullName ?? member.username ?? "User"} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[14px] text-[#9FADBC] font-semibold">{(member?.fullName ?? member?.username ?? "U").trim().slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-[#B6C2CF] truncate">{member?.fullName ?? "Unknown user"}</div>
              <div className="text-[12px] text-[#9FADBC] truncate">{member?.username ? `@${member.username}` : "@"}</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 relative">
            <label className="text-[12px] font-semibold text-[#9FADBC] mb-1 block">Select a card</label>
            <input
              type="text"
              value={cardQuery}
              placeholder="Search card"
              onChange={(e) => {
                setCardQuery(e.target.value);
                setCardMenuOpen(true);
              }}
              onFocus={() => setCardMenuOpen(true)}
              className="w-full bg-[#22272B] border border-[#3B444C] rounded-[3px] px-3 py-1.5 text-[14px] text-[#B6C2CF] placeholder-[#758195] outline-none hover:border-[#579DFF] focus:border-[#579DFF] transition"
            />
            {selectedCard && <div className="mt-1 text-[11px] text-[#9FADBC]">Selected: {selectedCard.name}</div>}

            {cardMenuOpen && (
              <div className="absolute z-50 mt-1 w-full max-h-44 overflow-auto bg-[#282E33] border border-[#3B444C] rounded-[8px] shadow-2xl">
                {filteredCards.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-[#9FADBC]">No cards found</div>
                ) : (
                  filteredCards.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCardId(c.id);
                        setCardQuery(c.name);
                        setCardMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-[#3B444C]"
                    >
                      <div className="truncate text-[#B6C2CF]">{c.name}</div>
                      <div className="text-[11px] text-[#9FADBC] truncate">
                        {listNameById.get(c.idList) ?? "Unknown list"}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <SelectField label="Repeats" value={repeat} options={repeatOptions} onChange={setRepeat} />

          <div className="mb-4">
            <label className="text-[12px] font-semibold text-[#9FADBC] mb-1.5 block">At</label>
            <div className="bg-[#22272B] border border-[#3B444C] rounded-[3px] px-3 py-2 focus-within:border-[#579DFF]">
              <input
                type="time"
                value={atTime}
                onChange={(e) => setAtTime(e.target.value)}
                className="w-full bg-transparent text-[14px] text-[#B6C2CF] outline-none"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[12px] font-semibold text-[#9FADBC] mb-1.5 block">On</label>
            <div className="bg-[#22272B] border border-[#3B444C] rounded-[3px] px-3 py-2 focus-within:border-[#579DFF]">
              <input
                type="date"
                value={onDate}
                onChange={(e) => setOnDate(e.target.value)}
                className="w-full bg-transparent text-[14px] text-[#B6C2CF] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SelectField label="Expiry" value={duration} options={durationOptions} onChange={setDuration} />
            <SelectField label="Position" value={position} options={positionOptions} onChange={setPosition} />
          </div>

          <SelectField
            label="List"
            value={targetListName || "Select list"}
            options={lists.map((l) => l.name)}
            onChange={setTargetListName}
          />

          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="bg-[#282E33] hover:bg-[#3B444C] border border-[#3B444C] text-[#B6C2CF] text-[13px] font-medium px-5 py-1.5 rounded-[3px] transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
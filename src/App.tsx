import { useEffect, useRef, useState } from "react";

import SelectField from "./components/SelectField";
import InputField from "./components/InputField";

import {
  repeatOptions,
  durationOptions,
  positionOptions,
  listOptions,
} from "./data/options";

function App() {
  const [t, setT] = useState<any>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [member, setMember] = useState<{
    fullName?: string;
    username?: string;
    avatarUrl?: string;
  } | null>(null);

  const [repeat, setRepeat] = useState("Weekly");

  const [duration, setDuration] = useState("2 Weeks");

  const [position, setPosition] = useState("Top");

  const [list, setList] = useState("To Do");

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    const tryGetT = () => {
      attempt += 1;
      try {
        const next = window.TrelloPowerUp?.iframe?.();
        if (next) {
          setT(next);
          return true;
        }
      } catch {
        // ignore; Trello context not ready yet
      }
      return false;
    };

    // try immediately + a few retries (fixes Trello timing/race)
    if (!tryGetT()) {
      const id = window.setInterval(() => {
        if (cancelled) return;
        if (tryGetT() || attempt >= 25) window.clearInterval(id);
      }, 120);
      return () => {
        cancelled = true;
        window.clearInterval(id);
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMember() {
      try {
        if (!t?.member) return;
        const m = await t.member("fullName", "username", "avatarUrl");
        if (!cancelled) setMember(m ?? null);
      } catch {
        if (!cancelled) setMember(null);
      }
    }
    loadMember();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!userMenuOpen) return;
      const el = userMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [userMenuOpen]);

  return (
    <div className="p-3 text-[#B6C2CF] w-full">
      {/* Top bar (in-app) */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="h-7 w-7 rounded-full border border-[#3B444C] bg-[#22272B] hover:bg-[#2C333A] transition overflow-hidden grid place-items-center"
            aria-label="User menu"
          >
            {member?.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.fullName ?? member.username ?? "User"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[12px] text-[#9FADBC]">
                {(member?.fullName ?? member?.username ?? "U")
                  .trim()
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
            )}
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-[220px] bg-[#282E33] border border-[#3B444C] rounded-[10px] shadow-2xl overflow-hidden z-50">
              <div className="px-3 py-2">
                <div className="text-[12px] font-semibold text-[#B6C2CF] truncate">
                  {member?.fullName ?? "Unknown user"}
                </div>
                {member?.username && (
                  <div className="text-[12px] text-[#9FADBC] truncate">
                    @{member.username}
                  </div>
                )}
              </div>
              <div className="h-px bg-[#3B444C]" />
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  t?.showSettings?.();
                }}
                className="w-full text-left px-3 py-2 text-[13px] text-[#B6C2CF] hover:bg-[#3B444C] transition"
              >
                Settings
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Select a Card (Search style) */}
      <div className="mb-4">
        <label className="text-[12px] font-semibold text-[#9FADBC] mb-1 block">
          Select a card
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search"
            className="w-full bg-[#22272B] border border-[#3B444C] rounded-[3px] px-3 py-1.5 text-[14px] text-[#B6C2CF] placeholder-[#758195] outline-none hover:border-[#579DFF] focus:border-[#579DFF] transition"
          />
          <div className="absolute right-3 top-2 text-[#9FADBC]">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
        </div>
      </div>

      <SelectField
        label="Repeats"
        value={repeat}
        options={repeatOptions}
        onChange={setRepeat}
      />

      <InputField
        label="At"
        type="time"
      />

      <InputField
        label="On"
        type="date"
      />

      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Expiry"
          value={duration}
          options={durationOptions}
          onChange={setDuration}
        />

        <SelectField
          label="Position"
          value={position}
          options={positionOptions}
          onChange={setPosition}
        />
      </div>

      <SelectField
        label="List"
        value={list}
        options={listOptions}
        onChange={setList}
      />

      <div className="flex justify-end mt-4">
        <button
          className="bg-[#282E33] hover:bg-[#3B444C] border border-[#3B444C] text-[#B6C2CF] text-[13px] font-medium px-5 py-1.5 rounded-[3px] transition"
        >
          Save
        </button>
      </div>

    </div>
  );
}

export default App;
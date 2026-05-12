import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface OptionObj {
  id: string;
  name: string;
}

interface Props {
  label: string;
  value: string;
  options: (string | OptionObj)[];
  onChange: (value: string) => void;
  className?: string;
}

function SelectField({
  label,
  value,
  options,
  onChange,
  className = "",
}: Props) {

  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>

      <label className="text-[12px] text-[#8C9BAB] mb-1 block">
        {label}
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-[#22272b] border border-[#3B444C] rounded-lg px-3 py-2 text-left text-[13px] text-[#B6C2CF] hover:border-[#2C333A] focus:border-[#2C333A] transition flex items-center justify-between group"
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={16} className={`text-[#8C9BAB] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 top-[56px] w-full bg-[#2C333A] border border-[#2C333A] rounded-lg shadow-2xl overflow-hidden z-50 py-1 max-h-48 overflow-y-auto">
          {options.map((option, idx) => {
            const id = typeof option === "string" ? option : option.id;
            const name = typeof option === "string" ? option : option.name;
            return (
              <button
                key={id + idx}
                type="button"
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[13px] transition hover:bg-[#3B444C] ${value === name ? "bg-[#3B444C] text-[#B6C2CF]" : "text-[#8C9BAB]"}`}
              >
                {name}
              </button>
            );
          })}

        </div>
      )}

    </div>
  );
}

export default SelectField;
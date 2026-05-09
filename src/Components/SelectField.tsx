import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: Props) {

  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 relative">

      <label className="text-xs text-gray-400 mb-1 block">
        {label}
      </label>

      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-[#22272B] border border-[#3B444C] rounded-lg px-3 py-2 flex items-center justify-between text-sm hover:border-[#579DFF] transition"
      >

        {value}

        <ChevronDown
          size={16}
          className={`transition ${
            open ? "rotate-180" : ""
          }`}
        />

      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-[72px] w-full bg-[#282E33] border border-[#3B444C] rounded-xl shadow-2xl overflow-hidden z-50">

          {options.map((option) => (

            <button
              key={option}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition hover:bg-[#3B444C]
              ${
                value === option
                  ? "bg-[#3B444C]"
                  : ""
              }`}
            >

              {option}

            </button>

          ))}

        </div>
      )}

    </div>
  );
}

export default SelectField;
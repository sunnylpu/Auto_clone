interface Props {
  label: string;
  type: string;
}

function InputField({
  label,
  type,
}: Props) {
  return (
    <div className="mb-4">

      <label className="text-xs text-gray-400 mb-1 block">
        {label}
      </label>

      <div className="bg-[#22272B] border border-[#3B444C] rounded-lg px-3 py-2 hover:border-[#579DFF] transition">

        <input
          type={type}
          className="w-full bg-transparent text-sm text-white outline-none"
        />

      </div>

    </div>
  );
}

export default InputField;
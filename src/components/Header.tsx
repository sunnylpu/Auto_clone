import { ChevronLeft, User } from "lucide-react";

function Header() {
  return (
    <div className="flex items-center justify-between mb-5">

      <button className="text-gray-400 hover:text-white transition">
        <ChevronLeft size={18} />
      </button>

      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="Auto Clone Logo" className="w-6 h-6 rounded-md" />
        <h1 className="text-sm font-semibold">
          Auto Clone
        </h1>
      </div>

      <button className="text-gray-400 hover:text-white transition">
        <User size={18} />
      </button>

    </div>
  );
}

export default Header;
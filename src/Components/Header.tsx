import { ChevronLeft, User } from "lucide-react";

function Header() {
  return (
    <div className="flex items-center justify-between mb-5">

      <button className="text-gray-400 hover:text-white transition">
        <ChevronLeft size={18} />
      </button>

      <h1 className="text-sm font-semibold">
        Auto Clone
      </h1>

      <button className="text-gray-400 hover:text-white transition">
        <User size={18} />
      </button>

    </div>
  );
}

export default Header;
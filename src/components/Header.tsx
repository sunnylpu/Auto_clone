import { ChevronLeft, User } from "lucide-react";

function Header() {
  const t = window.TrelloPowerUp.iframe();

  return (
    <div className="flex items-center justify-between mb-4 px-0">

      <button
        onClick={() => t.closePopup()}
        className="text-[#9FADBC] hover:text-white transition border-none outline-none bg-transparent cursor-pointer p-0"
      >
        <ChevronLeft size={20} />
      </button>

      <h1 className="text-[14px] font-medium text-[#B6C2CF] flex-1 text-center">
        Auto Clone
      </h1>

      <button className="text-[#9FADBC] hover:text-white transition border-none outline-none bg-transparent cursor-pointer p-0">
        <User size={20} />
      </button>

    </div>
  );
}

export default Header;
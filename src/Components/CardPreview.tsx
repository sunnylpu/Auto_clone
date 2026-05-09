function CardPreview() {
  return (
    <div className="mb-5 bg-[#22272B] border border-[#3B444C] rounded-xl p-3">

      <p className="text-xs text-gray-400 mb-1">
        Current Card
      </p>

      <h2 className="text-sm font-medium text-white">
        Helping me in Testing
      </h2>

      <div className="mt-2 flex items-center gap-2">

        <span className="text-[10px] bg-[#3B444C] px-2 py-1 rounded-md text-gray-300">
          QA
        </span>

        <span className="text-[10px] bg-[#3B444C] px-2 py-1 rounded-md text-gray-300">
          Design
        </span>

      </div>

    </div>
  );
}

export default CardPreview;
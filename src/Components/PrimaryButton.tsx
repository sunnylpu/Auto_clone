interface Props {
  loading?: boolean;
}

function PrimaryButton({
  loading,
}: Props) {
  return (
    <button
      className="w-full bg-[#579DFF] hover:bg-[#85B8FF] text-black font-medium py-2 rounded-lg transition-all disabled:opacity-50"
      disabled={loading}
    >

      {loading
        ? "Saving..."
        : "Save"}

    </button>
  );
}

export default PrimaryButton;
"use client";

import { Printer } from "lucide-react";

export default function Par3PrintButton() {
  return (
    <button
      type="button"
      className="par3-print-button"
      onClick={() => window.print()}
    >
      <Printer />
      Print this pack
    </button>
  );
}

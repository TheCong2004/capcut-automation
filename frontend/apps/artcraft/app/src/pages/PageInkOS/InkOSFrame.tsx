import React from "react";

const INKOS_URL =
  import.meta.env.VITE_INKOS_URL ?? "http://127.0.0.1:4567";

export const InkOSFrame: React.FC = () => {
  return (
    <iframe
      src={INKOS_URL}
      title="InkOS Story Studio"
      className="h-full w-full border-0"
      allow="clipboard-read; clipboard-write"
    />
  );
};

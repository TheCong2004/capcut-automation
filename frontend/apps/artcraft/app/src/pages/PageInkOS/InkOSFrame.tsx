import React from "react";

const INKOS_URL =
  import.meta.env.VITE_INKOS_URL ?? "http://127.0.0.1:4567";

interface InkOSFrameProps {
  onLoad?: () => void;
}

export const InkOSFrame: React.FC<InkOSFrameProps> = ({ onLoad }) => {
  return (
    <iframe
      src={INKOS_URL}
      title="InkOS Story Studio"
      className="h-full w-full border-0"
      allow="clipboard-read; clipboard-write"
      onLoad={onLoad}
    />
  );
};

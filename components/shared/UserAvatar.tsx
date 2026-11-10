"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

function getInitials(name?: string | null, email?: string | null) {
  const value = name?.trim() || email?.split("@")[0] || "Usuario";
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function UserAvatar({
  name,
  email,
  src,
  className = "h-10 w-10",
  textClassName = "text-xs",
}: {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  className?: string;
  textClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const label = name || email || "Usuario";
  const showImage = Boolean(src) && !failed;

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 font-bold text-white ${textClassName} ${className}`}>
      {showImage ? (
        <Image src={src as string} alt={label} fill sizes="96px" className="object-cover" unoptimized onError={() => setFailed(true)} />
      ) : (
        getInitials(name, email)
      )}
    </span>
  );
}

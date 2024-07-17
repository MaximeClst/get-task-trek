"use client";

import Link from "next/link";
import Image from "next/image";

import React from "react";

export default function Nav() {
  return (
    <nav className="max-w-[1200px] w-full mx-auto h-[80] flex items-center justify-between p-5 border-b border-gray-300">
      <div>
        <Link href="/">
          <Image width={30} height={30} src={} alt="Logo de Task Trek" />
        </Link>
      </div>
    </nav>
  );
}

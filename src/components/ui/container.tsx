import * as React from "react";
import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
  as: As = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  return React.createElement(
    As,
    { className: cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className) },
    children
  );
}

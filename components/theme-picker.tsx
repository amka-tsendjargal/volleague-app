"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  // theme is only known after the client script runs; until then render a
  // stable placeholder so the server and first client render match. Detecting
  // mount is exactly what this effect is for, so the set-state rule is a false
  // positive here.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const current = OPTIONS.find((option) => option.value === theme);

  return (
    <Select
      // Always a string: `undefined` would make the Select uncontrolled on the
      // first render and controlled once mounted, which React rejects.
      value={mounted && theme ? theme : "system"}
      onValueChange={(value) => value && setTheme(value)}
    >
      <SelectTrigger size="sm" className="w-32" aria-label="Theme">
        <SelectValue placeholder="Theme">
          {() =>
            mounted && current ? (
              <span className="flex items-center gap-1.5">
                <current.Icon className="size-3.5" />
                {current.label}
              </span>
            ) : (
              "Theme"
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center gap-1.5">
              <option.Icon className="size-3.5" />
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

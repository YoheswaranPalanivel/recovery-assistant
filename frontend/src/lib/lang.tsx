"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { asLang, type Lang } from "@shared/messages";

/**
 * The language a staff member reads the app in (a doctor may read only Hindi, a helper only Tamil).
 * Medical content is shown through approved templates in this language; numbers never change.
 */
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "English", setLang: () => {} });
const KEY = "staff-language";

export function StaffLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("English");
  useEffect(() => {
    try {
      setLangState(asLang(localStorage.getItem(KEY)));
    } catch {
      /* storage off: stay on English */
    }
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export const useStaffLang = () => useContext(Ctx);
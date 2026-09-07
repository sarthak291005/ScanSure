"use client";

import React, { createContext, useContext } from "react";
import { Shell } from "@/components/shell";
import { ToastProvider } from "@/components/toast";
import type { User } from "@/lib/types";

const UserCtx = createContext<User | null>(null);

export function useAppUser() {
  return useContext(UserCtx);
}

export function AppProvider({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  return (
    <UserCtx.Provider value={user}>
      <ToastProvider>
        <Shell user={user}>{children}</Shell>
      </ToastProvider>
    </UserCtx.Provider>
  );
}

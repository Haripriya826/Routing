import React, { createContext, useContext, useEffect, useState } from "react";

const AutoRefreshContext = createContext(null);
export function AutoRefreshProvider({ children }) {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    if (!autoRefresh) return;

    const id = setInterval(() => {
      setRefreshTick(t => t + 1);
    }, 5000);

    return () => clearInterval(id);
  }, [autoRefresh]);
  return (
    <AutoRefreshContext.Provider
      value={{ autoRefresh, setAutoRefresh, refreshTick }}
    >
      {children}
    </AutoRefreshContext.Provider>
  );
}

export function useAutoRefreshContext() {
  const ctx = useContext(AutoRefreshContext);
  if (!ctx) {
    throw new Error("useAutoRefreshContext must be used inside AutoRefreshProvider");
  }
  return ctx;
}

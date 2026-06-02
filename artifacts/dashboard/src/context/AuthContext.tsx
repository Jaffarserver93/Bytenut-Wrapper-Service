import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";

interface AuthContextType {
  creds: { username: string; password: string } | null;
  login: (username: string, password: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(() => {
    const saved = localStorage.getItem("bytenut_creds");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [, setLocation] = useLocation();

  const login = (username: string, password: string) => {
    const newCreds = { username, password };
    setCreds(newCreds);
    localStorage.setItem("bytenut_creds", JSON.stringify(newCreds));
  };

  const logout = () => {
    setCreds(null);
    localStorage.removeItem("bytenut_creds");
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ creds, login, logout, isAuthenticated: !!creds }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

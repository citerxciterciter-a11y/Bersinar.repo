import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=guest, obj=user
  const [location, setLocation] = useState(localStorage.getItem("bersinar_loc") || "Gudang Utama");

  useEffect(() => {
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => setUser(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("bersinar_token", data.token);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("bersinar_token");
    setUser(false);
  };

  const changeLocation = (loc) => {
    setLocation(loc);
    localStorage.setItem("bersinar_loc", loc);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, location, changeLocation }}>
      {children}
    </AuthContext.Provider>
  );
}

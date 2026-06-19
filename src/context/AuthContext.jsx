import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext();

const decodeJwt = (token) => {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
};

const tokenExpired = (token) => {
  const payload = decodeJwt(token);
  return !payload?.exp || payload.exp * 1000 <= Date.now();
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("bundlemind_token");
    const storedUser = localStorage.getItem("bundlemind_user");
    if (storedToken && storedUser && !tokenExpired(storedToken)) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    } else {
      localStorage.removeItem("bundlemind_token");
      localStorage.removeItem("bundlemind_user");
    }
  }, []);

  const loginUser = (tokenValue) => {
    const payload = decodeJwt(tokenValue);
    const userData = {
      email: payload?.email || "",
      role: payload?.role || "manager",
      initial: (payload?.role || payload?.email || "M").charAt(0).toUpperCase(),
    };
    localStorage.setItem("bundlemind_token", tokenValue);
    localStorage.setItem("bundlemind_user", JSON.stringify(userData));
    setToken(tokenValue);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("bundlemind_token");
    localStorage.removeItem("bundlemind_user");
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      login: loginUser,
      logout,
      isAuthenticated: !!token && !tokenExpired(token),
    }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

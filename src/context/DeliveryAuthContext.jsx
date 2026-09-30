import React, { createContext, useContext, useState, useEffect } from 'react';

const DeliveryAuthContext = createContext(null);

export const DELIVERY_PROFILES = {
  zakir: {
    id: "usr_deliv_zakir",
    username: "zakir_manager25",
    name: "Delivery Executives",
    displayName: "Delivery Executives (Zakir)",
    zoneName: "Zakir Blocks (A, B, C, D)",
    assignedArea: "zakir",
    role: "delivery_executive",
    phone: "+91 94372 56443",
    department: "CU Delivery Fleet - Zakir Zone",
    validUsernames: ['zakir_manager25'],
    validPasswords: ['anshu83hope']
  },
  nc: {
    id: "usr_deliv_nc",
    username: "NC_manager14",
    name: "Delivery Executives",
    displayName: "Delivery Executives - NC (1 to 4)",
    zoneName: "NC Blocks (1, 2, 3, 4)",
    assignedArea: "nc_1_4",
    role: "delivery_executive",
    phone: "+91 92530 77761",
    department: "CU Delivery Fleet - NC 1-4 Zone",
    validUsernames: ['nc_manager14'],
    validPasswords: ['karan27light']
  }
};

export function DeliveryAuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('cu_delivery_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role === 'delivery_executive' && (parsed.assignedArea === 'zakir' || parsed.assignedArea === 'nc_1_4')) {
          return parsed;
        }
      }
    } catch { /* ignore */ }
    return null;
  });

  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('cu_delivery_session', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('cu_delivery_session');
    }
  }, [currentUser]);

  // Strict Password / Credential login (No auto-login bypass)
  const login = async (username, password) => {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanUser) {
      const err = "Please enter your executive username.";
      setAuthError(err);
      return { success: false, error: err };
    }

    if (!cleanPass) {
      const err = "Please enter your password to sign in.";
      setAuthError(err);
      return { success: false, error: err };
    }

    // 1. Zakir user authentication
    if (DELIVERY_PROFILES.zakir.validUsernames.includes(cleanUser)) {
      const isPassValid = DELIVERY_PROFILES.zakir.validPasswords.includes(cleanPass);
      if (isPassValid) {
        const profile = { ...DELIVERY_PROFILES.zakir, token: `deliv_zakir_${Date.now()}` };
        setCurrentUser(profile);
        setAuthError(null);
        return { success: true, user: profile };
      } else {
        const err = "Incorrect password for Zakir Delivery Executive.";
        setAuthError(err);
        return { success: false, error: err };
      }
    }

    // 2. NC (1 to 4) user authentication
    if (DELIVERY_PROFILES.nc.validUsernames.includes(cleanUser)) {
      const isPassValid = DELIVERY_PROFILES.nc.validPasswords.includes(cleanPass);
      if (isPassValid) {
        const profile = { ...DELIVERY_PROFILES.nc, token: `deliv_nc_${Date.now()}` };
        setCurrentUser(profile);
        setAuthError(null);
        return { success: true, user: profile };
      } else {
        const err = "Incorrect password for NC (1 to 4) Delivery Executive.";
        setAuthError(err);
        return { success: false, error: err };
      }
    }

    const err = "Invalid username. Please check your credentials.";
    setAuthError(err);
    return { success: false, error: err };
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('cu_delivery_session');
    } catch { /* ignore */ }
    setAuthError(null);
  };

  return (
    <DeliveryAuthContext.Provider value={{
      isAuthenticated: Boolean(currentUser),
      currentUser,
      assignedArea: currentUser?.assignedArea || null,
      login,
      logout,
      authError,
      setAuthError
    }}>
      {children}
    </DeliveryAuthContext.Provider>
  );
}

export function useDeliveryAuth() {
  const context = useContext(DeliveryAuthContext);
  if (!context) {
    throw new Error('useDeliveryAuth must be used within a DeliveryAuthProvider');
  }
  return context;
}

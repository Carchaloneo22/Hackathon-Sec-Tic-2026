import { create } from "zustand";
import { persist } from "zustand/middleware";

// Credencial Basic Auth (usuario:contraseña en base64) que el backend valida en cada
// request — ver Trazo/backend/src/services/auth.ts. No es un JWT ni una sesión real,
// solo la misma credencial fija reenviada tal cual.
interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      clear: () => set({ token: null }),
    }),
    { name: "trazo-auth" }
  )
);

export function encodeCredentials(username: string, password: string): string {
  return btoa(`${username}:${password}`);
}

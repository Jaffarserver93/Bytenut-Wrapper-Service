import { useQuery, useMutation } from "@tanstack/react-query";
import { getProfile, getServers, login } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export function useLogin() {
  const { login: setAuth } = useAuth();
  
  return useMutation({
    mutationFn: async ({ username, password }: any) => {
      const res = await login(username, password);
      return { res, username, password };
    },
    onSuccess: ({ username, password }) => {
      setAuth(username, password);
    },
  });
}

export function useProfile() {
  const { creds, isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: ["profile", creds?.username],
    queryFn: () => getProfile(creds!.username, creds!.password),
    enabled: isAuthenticated && !!creds,
    staleTime: 1000 * 60 * 5, // 5 mins
  });
}

export function useServers() {
  const { creds, isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: ["servers", creds?.username],
    queryFn: () => getServers(creds!.username, creds!.password),
    enabled: isAuthenticated && !!creds,
    refetchInterval: 1000 * 30, // Poll every 30s
  });
}

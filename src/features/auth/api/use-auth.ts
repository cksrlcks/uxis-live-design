import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  login,
  signup,
  logout,
  changePassword,
  requestPasswordReset,
  resetPassword,
} from "./auth";

export function useLogin() {
  return useMutation({ mutationFn: login });
}

export function useSignup() {
  return useMutation({ mutationFn: signup });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => queryClient.clear(),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword });
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: requestPasswordReset });
}

export function useResetPassword() {
  return useMutation({ mutationFn: resetPassword });
}

import { beforeEach, describe, expect, it } from "vitest";
import { type AuthUser, useAuthStore } from "@/store/auth";

const fakeUser: AuthUser = {
  id: "user-123",
  username: "alice",
  name: "Alice Silva",
  email: "alice@example.com",
};

beforeEach(() => {
  useAuthStore.setState({ user: null });
  localStorage.clear();
});

describe("useAuthStore", () => {
  it("inicia com usuário nulo", () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("setUser atualiza o usuário no estado", () => {
    useAuthStore.getState().setUser(fakeUser);
    expect(useAuthStore.getState().user).toEqual(fakeUser);
  });

  it("setUser aceita null para limpar o usuário", () => {
    useAuthStore.getState().setUser(fakeUser);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("logout define o usuário como nulo", () => {
    useAuthStore.getState().setUser(fakeUser);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("mantém todos os campos do usuário ao fazer setUser", () => {
    useAuthStore.getState().setUser(fakeUser);
    const stored = useAuthStore.getState().user;

    expect(stored?.id).toBe("user-123");
    expect(stored?.username).toBe("alice");
    expect(stored?.name).toBe("Alice Silva");
    expect(stored?.email).toBe("alice@example.com");
  });

  it("persiste o estado no localStorage com a chave correta", () => {
    useAuthStore.getState().setUser(fakeUser);
    const stored = localStorage.getItem("cowcular-auth");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.user.id).toBe("user-123");
  });

  it("após logout, o localStorage reflete o estado nulo", () => {
    useAuthStore.getState().setUser(fakeUser);
    useAuthStore.getState().logout();
    const stored = localStorage.getItem("cowcular-auth");
    const parsed = JSON.parse(stored!);
    expect(parsed.state.user).toBeNull();
  });
});

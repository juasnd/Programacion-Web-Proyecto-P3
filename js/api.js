const Api = (() => {
  const BASE = "./index.php?api=1";

  async function req(action, method = "GET", data) {
    const opts = {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    };
    if (method !== "GET") opts.body = JSON.stringify(data ?? {});

    const r = await fetch(`${BASE}&action=${encodeURIComponent(action)}`, opts);
    const j = await r.json().catch(() => null);
    if (!j) return { ok: false, error: "respuesta inválida" };
    return j;
  }

  return {
    me: () => req("me"),
    login: (usuario, password) => req("login", "POST", { usuario, password }),
    logout: () => req("logout", "POST", {}),

    usuarios_list: () => req("usuarios_list"),
    usuarios_create: (p) => req("usuarios_create", "POST", p),
    usuarios_update: (p) => req("usuarios_update", "POST", p),
    usuarios_delete: (p) => req("usuarios_delete", "POST", p),

    roles_list: () => req("roles_list"),
    roles_create: (p) => req("roles_create", "POST", p),
    roles_update: (p) => req("roles_update", "POST", p),
    roles_delete: (p) => req("roles_delete", "POST", p),

    permisos_get: () => req("permisos_get"),
    permisos_set: (p) => req("permisos_set", "POST", p),
  };
})();

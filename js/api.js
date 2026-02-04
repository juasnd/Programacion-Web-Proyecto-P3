const API = "./server/api.php";

async function api(action, data = null, method = "POST") {
  const opts = {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  };
  if (data) opts.body = JSON.stringify(data);

  try {
    const r = await fetch(`${API}?action=${encodeURIComponent(action)}`, opts);
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      return { ok: false, error: "respuesta inválida del servidor", raw: text };
    }
  } catch (error) {
    return { ok: false, error: "error de conexión: " + error.message };
  }
}

const Api = {
  me: () => api("me", null, "GET"),
  login: (usuario, password) => api("login", { usuario: usuario.trim().toLowerCase(), password }),
  logout: () => api("logout"),

  usuarios_list: () => api("usuarios_list", null, "GET"),
  usuarios_create: (p) => api("usuarios_create", p),
  usuarios_update: (p) => api("usuarios_update", p),
  usuarios_delete: (p) => api("usuarios_delete", p),

  roles_list: () => api("roles_list", null, "GET"),
  roles_create: (p) => api("roles_create", p),
  roles_update: (p) => api("roles_update", p),
  roles_delete: (p) => api("roles_delete", p),

  permisos_get: () => api("permisos_get", null, "GET"),
  permisos_set: (p) => api("permisos_set", p),
};
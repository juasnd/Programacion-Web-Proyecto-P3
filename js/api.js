// /js/api.js
const Api = (() => {
  const BASE = "./server/api.php";

  async function parseJsonSafe(res) {
    const txt = await res.text().catch(() => "");
    if (!txt) return null;
    try { return JSON.parse(txt); } catch { return null; }
  }

  async function req(action, method = "GET", data, qs) {
    const u = new URL(BASE, window.location.href);
    u.searchParams.set("action", action);
    if (qs && typeof qs === "object") {
      Object.entries(qs).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        u.searchParams.set(k, String(v));
      });
    }

    const opts = {
      method,
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    };

    if (method !== "GET") {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(data ?? {});
    }

    const res = await fetch(u.toString(), opts);
    const j = await parseJsonSafe(res);

    if (!j) {
      return { ok: false, error: `respuesta inválida (${res.status})` };
    }

    if (j.ok === false) return j;

    if (!res.ok) {
      return { ok: false, error: j.error || `error http (${res.status})` };
    }

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

    permisos_get: (rol_id) => req("permisos_get", "GET", null, rol_id ? { rol_id } : null),
    permisos_set: (p) => req("permisos_set", "POST", p),

    cursos_list: (qs) => req("cursos_list", "GET", null, qs || null),
    cursos_create: (p) => req("cursos_create", "POST", p),
    cursos_update: (p) => req("cursos_update", "POST", p),
    cursos_delete: (p) => req("cursos_delete", "POST", p),

    matriculas_list: (qs) => req("matriculas_list", "GET", null, qs || null),
    matriculas_create: (p) => req("matriculas_create", "POST", p),
    matriculas_anular: (p) => req("matriculas_anular", "POST", p),

    mis_cursos: (qs) => req("mis_cursos", "GET", null, qs || null),
    curso_estudiantes: (curso_id) => req("curso_estudiantes", "GET", null, { curso_id }),
    guardar_notas: (p) => req("guardar_notas", "POST", p),

    reporte_horario_docente: (qs) => req("reporte_horario_docente", "GET", null, qs || null),
    reporte_notas_estudiante: (qs) => req("reporte_notas_estudiante", "GET", null, qs || null),

    // si luego haces un endpoint para PDF (permiso: reportes/pdf)
    reportes_pdf: (tipo, qs) => req("reportes_pdf", "GET", null, { tipo, ...(qs || {}) }),
  };
})();

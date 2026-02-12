const Api = (() => {
  // ajusta esta ruta a donde está tu api.php
  const BASE = "./server/api.php";

  async function req(action, method = "GET", data) {
    const url = `${BASE}?action=${encodeURIComponent(action)}`;
    const opts = {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    };
    if (method !== "GET") opts.body = JSON.stringify(data ?? {});

    const r = await fetch(url, opts);
    const j = await r.json().catch(() => null);
    if (!j) return { ok: false, error: "respuesta inválida" };
    return j;
  }

  async function getWithQS(action, qs = {}) {
    const u = new URL(BASE, window.location.href);
    u.searchParams.set("action", action);
    Object.entries(qs).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u.toString(), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json().catch(() => null);
    if (!j) return { ok: false, error: "respuesta inválida" };
    return j;
  }

  return {
    me: () => req("me"),
    login: (usuario, password) => req("login", "POST", { usuario, password }),
    logout: () => req("logout", "POST", {}),

// ✅ ESTO YA FUNCIONA - NO TOCAR
usuarios_list: (qs) => qs ? getWithQS("usuarios_list", qs) : req("usuarios_list"),
    usuarios_create: (p) => req("usuarios_create", "POST", p),
    usuarios_update: (p) => req("usuarios_update", "POST", p),
    usuarios_delete: (p) => req("usuarios_delete", "POST", p),

    // ESTUDIANTES - AGREGAR ESTAS FUNCIONES
    estudiantes_list: (qs) => (qs ? getWithQS("estudiantes_list", qs) : req("estudiantes_list")),
    estudiantes_create: (p) => req("estudiantes_create", "POST", p),
    estudiantes_update: (p) => req("estudiantes_update", "POST", p),
    estudiantes_delete: (p) => req("estudiantes_delete", "POST", p),

    roles_list: (qs) => (qs ? getWithQS("roles_list", qs) : req("roles_list")),
    roles_create: (p) => req("roles_create", "POST", p),
    roles_update: (p) => req("roles_update", "POST", p),
    roles_delete: (p) => req("roles_delete", "POST", p),

    permisos_get: () => req("permisos_get"),
    permisos_set: (p) => req("permisos_set", "POST", p),

    cursos_list: (qs) => (qs ? getWithQS("cursos_list", qs) : req("cursos_list")),
    cursos_create: (p) => req("cursos_create", "POST", p),
    cursos_update: (p) => req("cursos_update", "POST", p),
    cursos_delete: (p) => req("cursos_delete", "POST", p),

    // estudiante (auto)
    matriculas_create: (p) => req("matriculas_create", "POST", p),
    matriculas_anular: (p) => req("matriculas_anular", "POST", p),
    matriculas_list_mi: () => req("matriculas_list_estudiante"),
    // sistema (opcional)
    matriculas_list_estudiante: (estudiante_id) => getWithQS("matriculas_list_estudiante", { estudiante_id }),

    mis_cursos: (qs) => (qs ? getWithQS("mis_cursos", qs) : req("mis_cursos")),
    curso_estudiantes: (curso_id) => getWithQS("curso_estudiantes", { curso_id }),
    guardar_notas: (p) => req("guardar_notas", "POST", p),


    // REPORTES
reporte_notas_estudiante: () => req("reporte_notas_estudiante"),
reporte_cursos_docente: () => req("reporte_cursos_docente"),
reporte_notas_curso_docente: (curso_id) => getWithQS("reporte_notas_curso_docente", { curso_id }),
    // Agregar al objeto Api
mi_perfil: () => req("mi_perfil"),
mi_perfil_actualizar: (p) => req("mi_perfil_actualizar", "POST", p),
// AUDITORÍA
auditoria_list: (qs) => qs ? getWithQS("auditoria_list", qs) : req("auditoria_list"),
auditoria_clear: (p) => req("auditoria_clear", "POST", p),
  };
})();
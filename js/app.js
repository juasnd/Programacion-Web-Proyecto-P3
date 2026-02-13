
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

let clockTimer = null;

let USERS_CACHE = { loaded: false, data: [], at: 0 };

function ensureApp() {
  let root = $("#app");
  if (!root) {
    root = document.createElement("div");
    root.id = "app";
    document.body.prepend(root);
  }
  return root;
}
function setView(html) { ensureApp().innerHTML = html; }

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hasPerm(me, mod, acc) {
  const p = me?.perms || [];
  if (p.includes("*")) return true;
  return p.includes(`${mod}.${acc}`);
}
function hasAnyPerm(me, mod) {
  const p = me?.perms || [];
  if (p.includes("*")) return true;
  return p.some(x => String(x || "").startsWith(mod + "."));
}

function stopClock() {
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
}
function updateDateTime() {
  const now = new Date();
  const dateElement = $("#currentDate");
  const timeElement = $("#currentTime");
  if (dateElement) {
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    dateElement.textContent = now.toLocaleDateString("es-EC", options);
  }
  if (timeElement) {
    timeElement.textContent = now.toLocaleTimeString("es-EC", {
      hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  }
}
function startClock() { stopClock(); updateDateTime(); clockTimer = setInterval(updateDateTime, 1000); }

function onlyDigits(s) { return String(s || "").replace(/\D+/g, ""); }

function calcEdad(fechaISO) {
  if (!fechaISO) return null;
  const d = new Date(fechaISO + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - d.getFullYear();
  const m = hoy.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad--;
  return edad;
}

function fullName(me) {
  const n = `${me?.nombres || ""} ${me?.apellidos || ""}`.trim();
  return n || (me?.usuario || "");
}

function diaNombre(n) {
  const map = { 1:"lunes",2:"martes",3:"miércoles",4:"jueves",5:"viernes",6:"sábado",7:"domingo" };
  return map[Number(n)] || String(n || "");
}

function msgBox(kind, text) {
  return `<div class="message ${kind}">${escapeHtml(text)}</div>`;
}

function niceTitle(key) {
  const map = {
    dashboard: "dashboard",
    usuarios: "usuarios",
    roles: "roles",
    permisos: "permisos",
    cursos: "cursos",
    matriculas: "matriculación",
    notas: "notas",
    reportes: "reportes",
    login: "inicio de sesión",
    perfil: "mi perfil",
    auditoria: "auditoría",
  };
  return map[key] || key;
}

/* ====== pagination ====== */
function paginate(arr, page, perPage) {
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * perPage;
  return { page: p, totalPages, slice: arr.slice(start, start + perPage) };
}

function renderPager(containerSel, page, totalPages, onGo) {
  const el = $(containerSel);
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ""; return; }

  const btn = (label, p, disabled, active = false) => `
    <button class="pager-btn ${active ? "active" : ""}" ${disabled ? "disabled" : ""} data-p="${p}" type="button">
      ${label}
    </button>
  `;

  const maxNumbers = 5;
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + (maxNumbers - 1));
  start = Math.max(1, end - (maxNumbers - 1));

  const nums = [];
  for (let i = start; i <= end; i++) nums.push(i);

  el.innerHTML = `
    <div class="pager">
      ${btn("anterior", page - 1, page <= 1)}
      <div class="pager-numbers">
        ${nums.map(n => btn(String(n), n, false, n === page)).join("")}
      </div>
      ${btn("siguiente", page + 1, page >= totalPages)}
    </div>
  `;

  el.querySelectorAll("[data-p]").forEach(b => {
    b.onclick = () => {
      const p = Number(b.dataset.p);
      if (!p || p < 1 || p > totalPages) return;
      onGo(p);
    };
  });
}

function roleKind(u) {
  const r = String(u?.rol_nombre || "").toLowerCase();
  if (r.includes("docente") || r.includes("prof")) return "docente";
  if (r.includes("estudiante") || r.includes("alumno")) return "estudiante";
  return "";
}

async function ensureUsersCache(force = false) {
  const now = Date.now();
  const ttlMs = 60_000; // 1 min
  if (!force && USERS_CACHE.loaded && (now - USERS_CACHE.at) < ttlMs) return USERS_CACHE.data;

  const r = await Api.usuarios_list();
  if (!r.ok) return null;

  USERS_CACHE.loaded = true;
  USERS_CACHE.data = Array.isArray(r.data) ? r.data : [];
  USERS_CACHE.at = now;
  return USERS_CACHE.data;
}

function userLabel(u) {
  const nombre = `${u.apellidos || ""} ${u.nombres || ""}`.trim();
  const ced = u.cedula ? ` • ${u.cedula}` : "";
  const rol = u.rol_nombre ? ` • ${u.rol_nombre}` : "";
  return `${nombre || u.usuario || ("#" + u.id)}${ced}${rol}`;
}

function fillUserSelect(selEl, users, placeholder = "selecciona...") {
  if (!selEl) return;
  selEl.innerHTML = `
    <option value="">${escapeHtml(placeholder)}</option>
    ${(users || []).map(u => `<option value="${u.id}">${escapeHtml(userLabel(u))}</option>`).join("")}
  `;
}

function bindCedulaPicker(inputEl, users, onPick) {
  if (!inputEl) return;
  inputEl.addEventListener("input", () => {
    const ced = onlyDigits(inputEl.value);
    if (ced.length < 10) return;
    const hit = (users || []).find(u => String(u.cedula || "") === ced);
    if (hit) onPick(hit);
  });
}

/* =========================
   shell
   ========================= */
function shell(me, active, contentHtml) {
  const showUsuarios   = hasAnyPerm(me, "usuarios");
  const showRoles      = hasAnyPerm(me, "roles");
  const showPermisos   = hasAnyPerm(me, "permisos");
  const showCursos     = hasAnyPerm(me, "cursos");
  const showMatriculas = hasAnyPerm(me, "matriculas");
  const showNotas      = hasAnyPerm(me, "notas");
  const showReportes   = hasAnyPerm(me, "reportes") || hasAnyPerm(me, "horarios");
  const showEstudiantes = hasAnyPerm(me, "estudiantes");

  const navLink = (id, label, show) => show ? `
    <a class="nav-link ${active === id ? "active" : ""}" href="#${id}">${escapeHtml(label)}</a>
  ` : "";

  const navDropdown = (groupId, label, show, items = []) => {
    if (!show || !items.length) return "";
    const isActive = items.some(x => x.id === active);
    return `
      <div class="nav-dd ${isActive ? "active" : ""}" data-dd="${groupId}">
        <button class="nav-dd-btn" type="button"
          aria-haspopup="menu"
          aria-expanded="false"
          data-dd-btn="${groupId}">
          ${escapeHtml(label)} <span class="nav-dd-caret">▾</span>
        </button>

        <div class="nav-dd-menu" role="menu" data-dd-menu="${groupId}">
          ${items.map(x => `
            <a class="nav-dd-item ${active === x.id ? "active" : ""}" href="#${x.id}" role="menuitem">
              ${escapeHtml(x.label)}
            </a>
          `).join("")}
        </div>
      </div>
    `;
  };

  const avatarChar = escapeHtml(((me?.nombres || me?.usuario || "u")[0] || "u").toUpperCase());
  const rolName = escapeHtml(me?.rol_nombre || "sin rol");
  const nombreMostrado = escapeHtml(me?.usuario || "");

  return `
    <div class="topbar">
      <div class="user-info">
        <div class="user-avatar">${avatarChar}</div>
        <div class="user-details">
          <div class="username">${nombreMostrado}</div>
          <div class="user-role">${rolName}</div>
        </div>
      </div>

<nav class="topnav" aria-label="navegación">
  <a class="nav-link ${active === "dashboard" ? "active" : ""}" href="#dashboard">Inicio</a>

  ${navLink("usuarios", "Usuarios", showUsuarios)}
  ${navLink("estudiantes", "Estudiantes", showEstudiantes)}
  
  ${navDropdown("roles_dd", "Roles", (showRoles || showPermisos), [
    ...(showRoles ? [{ id: "roles", label: "Crear / Ver roles" }] : []),
    ...(showPermisos ? [{ id: "permisos", label: "Asignar permisos" }] : []),
  ])}

  ${navLink("cursos", "Cursos", showCursos)}
  ${navLink("matriculas", "Matriculación", showMatriculas)}
  ${navLink("notas", "Notas", showNotas)}

  ${navDropdown("reportes_dd", "Reportes", showReportes, [
    { id: "reportes", label: "Reportes" },
  ])}

  ${navLink("auditoria", "Auditoría", me?.is_admin || hasAnyPerm(me, "auditoria"))}
</nav>

      <div class="topbar-right">
        <div class="datetime-display" aria-label="fecha y hora">
          <div class="current-date" id="currentDate">cargando...</div>
          <div class="current-time" id="currentTime">--:--:--</div>
        </div>
        <button class="btn btn-outline" id="btnLogout" type="button">salir</button>
      </div>
    </div>

    <main class="content-area">
      <div class="seccion-barra">
        <div class="seccion-titulo">${escapeHtml(niceTitle(active))}</div>
        <div class="seccion-acciones" id="accionesSeccion"></div>
      </div>
      <div id="content">${contentHtml}</div>
    </main>
  `;
}

function bindTopbarDropdowns() {
  if (window.__topbar_dd_bound) return;
  window.__topbar_dd_bound = true;

  const closeAll = () => {
    document.querySelectorAll(".nav-dd.open").forEach(dd => {
      dd.classList.remove("open");
      const btn = dd.querySelector(".nav-dd-btn");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  };

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-dd-btn]");
    if (btn) {
      const id = btn.getAttribute("data-dd-btn");
      const dd = document.querySelector(`.nav-dd[data-dd="${id}"]`);
      if (!dd) return;

      const isOpen = dd.classList.contains("open");
      closeAll();
      if (!isOpen) {
        dd.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (!e.target.closest(".nav-dd")) closeAll();
  });

  window.addEventListener("hashchange", () => closeAll());
}

/* =========================
   login
   ========================= */
function loginView(msg = "") {
  stopClock();
  setView(`
    <div class="login-wrapper">
      <div class="login-box fade-in">
        <div class="login-logo"> Sistema Web</div>
        <strong>
        <div class="login-subtitle">Inicio De Sesion</div>
        </strong>

        <div id="msg">${msg || ""}</div>

        <input id="usuario" class="login-input" placeholder="usuario" autocomplete="username" />
        <input id="password" class="login-input" placeholder="contraseña" type="password" autocomplete="current-password" />
        <button id="btnLogin" class="login-btn" type="button">ingresar</button>
      </div>
    </div>
  `);



// ====== bloqueo por intentos fallidos (cliente) ======
const LOGIN_MAX_FAILS = 3;
const LOGIN_LOCK_MINUTES = 10;
const loginKey = (u) => `login_fail_${String(u || "").toLowerCase()}`;
const readLoginState = (u) => {
  try {
    const raw = localStorage.getItem(loginKey(u));
    const obj = raw ? JSON.parse(raw) : null;
    return (obj && typeof obj === "object") ? obj : { count: 0, lockedUntil: 0 };
  } catch { return { count: 0, lockedUntil: 0 }; }
};
const writeLoginState = (u, st) => {
  try { localStorage.setItem(loginKey(u), JSON.stringify(st)); } catch {}
};
const clearLoginState = (u) => {
  try { localStorage.removeItem(loginKey(u)); } catch {}
};
const isLocked = (u) => {
  const st = readLoginState(u);
  return st.lockedUntil && Date.now() < Number(st.lockedUntil || 0);
};
const lockInfoText = (u) => {
  const st = readLoginState(u);
  const ms = Math.max(0, Number(st.lockedUntil || 0) - Date.now());
  const min = Math.ceil(ms / 60000);
  return `usuario bloqueado temporalmente (${min} min).`;
};

  const doLogin = async () => {
    const usuario = ($("#usuario").value || "").trim();
    const password = ($("#password").value || "").trim();

    if (!usuario || !password) {
      $("#msg").innerHTML = msgBox("info", "complete todos los campos");
      return;
    }


if (isLocked(usuario)) {
  $("#msg").innerHTML = msgBox("info", lockInfoText(usuario));
  return;
}

const r = await Api.login(usuario, password);
if (!r.ok) {
  const st = readLoginState(usuario);
  const nextCount = Number(st.count || 0) + 1;

  let lockedUntil = Number(st.lockedUntil || 0);
  if (nextCount >= LOGIN_MAX_FAILS) {
    lockedUntil = Date.now() + (LOGIN_LOCK_MINUTES * 60_000);
  }

  writeLoginState(usuario, { count: nextCount, lockedUntil });

  const left = Math.max(0, LOGIN_MAX_FAILS - nextCount);
  const extra = lockedUntil && Date.now() < lockedUntil
    ? ` - ${lockInfoText(usuario)}`
    : (left > 0 ? ` - intentos restantes: ${left}` : "");

  $("#msg").innerHTML = msgBox("info", (r.error || "error") + extra);
  return;
}

clearLoginState(usuario);


    location.hash = "#dashboard";
    router();
  };

  $("#btnLogin").onclick = doLogin;
  $("#password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("#usuario").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
}

/* =========================
   dashboard
   ========================= */
async function viewDashboard(me) {
  const cards = [];

  const pushCard = (cond, href, title, desc) => {
    if (!cond) return;
    cards.push(`
      <a class="module-card" href="#${href}">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(desc)}</p>
      </a>
    `);
  };

  pushCard(hasAnyPerm(me, "usuarios"), "usuarios", "Usuarios", "administra usuarios del sistema.");
  pushCard(hasAnyPerm(me, "roles"), "roles", "Roles", "crea roles del sistema.");
  pushCard(hasAnyPerm(me, "permisos"), "permisos", "Permisos", "asigna permisos por rol.");
  pushCard(hasAnyPerm(me, "cursos"), "cursos", "Cursos", "gestiona cursos y horarios.");
  pushCard(hasAnyPerm(me, "matriculas"), "matriculas", "Matriculación", "matricula con validación de choques.");
  pushCard(hasAnyPerm(me, "notas"), "notas", "Notas", "ingreso de notas por curso.");
  pushCard(hasAnyPerm(me, "reportes") || hasAnyPerm(me, "horarios"), "reportes", "Reportes", "horario y notas.");
  pushCard(hasAnyPerm(me, "estudiantes"), "estudiantes", "Estudiantes", "gestiona estudiantes del sistema.");
  pushCard(me?.tipo === "ESTUDIANTE", "perfil", "Mi perfil", "actualiza tus datos y contraseña.");
  pushCard(me?.is_admin || hasAnyPerm(me, "auditoria"), "auditoria", "Auditoría", "consulta los registros de auditoría.");

  setView(shell(me, "dashboard", `
    <div class="dashboard-container fade-in">
      <div class="welcome-section">
        <h1>Bienvenido, ${escapeHtml(fullName(me))}</h1>
        <p>Panel principal</p>
      </div>

      <div class="modules-grid">
        ${cards.join("") || `<div class="message info">no tienes módulos asignados</div>`}
      </div>
    </div>
  `));

  bindTopbarDropdowns();

  $("#btnLogout").onclick = logoutTotal;
  startClock();
}

/* =========================
   usuarios 
   ========================= */
function showEditUserModal(me, user, roles, onSave) {
  const edadIni = calcEdad(user.fecha_nacimiento);

  const rolBlock = me.is_admin ? `
    <div class="form-group">
      <label>rol</label>
      <select id="edit_rol" class="form-control select">
        <option value="">sin rol</option>
        ${roles.map(r => `
          <option value="${r.id}" ${Number(r.id) === Number(user.rol_id) ? "selected" : ""}>
            ${escapeHtml(r.nombre)}${r.descripcion ? ` - ${escapeHtml(r.descripcion)}` : ""}
          </option>
        `).join("")}
      </select>
    </div>
  ` : `
    <div class="form-group">
      <label>rol</label>
      <input class="form-control" value="${escapeHtml(user.rol_nombre || "(sin rol)")}" disabled />
    </div>
  `;

  const modalHtml = `
    <div class="modal-overlay" id="editModal" role="dialog" aria-modal="true">
      <div class="modal-content">
        <button class="modal-close" id="closeModal" type="button" aria-label="cerrar">&times;</button>
        <div class="modal-header">
          <h3>editar usuario</h3>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>usuario</label>
            <input type="text" id="edit_usuario" class="form-control" value="${escapeHtml(user.usuario)}" />
          </div>

          <div class="form-group">
            <label>nombres</label>
            <input type="text" id="edit_nombres" class="form-control" value="${escapeHtml(user.nombres || "")}" />
          </div>

          <div class="form-group">
            <label>apellidos</label>
            <input type="text" id="edit_apellidos" class="form-control" value="${escapeHtml(user.apellidos || "")}" />
          </div>

          <div class="form-group">
            <label>cédula</label>
            <input type="text" id="edit_cedula" class="form-control" maxlength="10" value="${escapeHtml(user.cedula || "")}" />
          </div>

          <div class="form-group">
            <label>fecha de nacimiento</label>
            <input type="date" id="edit_fnac" class="form-control" value="${escapeHtml(user.fecha_nacimiento || "")}" />
            <small class="hint" id="edit_edad">${edadIni === null ? "" : `edad: ${edadIni}`}</small>
          </div>

          ${rolBlock}

          <div class="form-group">
            <label>estado</label>
            <select id="edit_activo" class="form-control select">
              <option value="1" ${Number(user.activo) === 1 ? "selected" : ""}>activo</option>
              <option value="0" ${Number(user.activo) === 0 ? "selected" : ""}>inactivo</option>
            </select>
          </div>

          <div class="form-group">
            <label>cambiar contraseña</label>
            <input type="password" id="edit_password" class="form-control" placeholder="dejar en blanco para no cambiar" />
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary" id="saveEdit" type="button">guardar</button>
          <button class="btn btn-outline" id="cancelEdit" type="button">cancelar</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const close = () => $("#editModal")?.remove();
  $("#closeModal").onclick = close;
  $("#cancelEdit").onclick = close;

  $("#edit_fnac").addEventListener("change", () => {
    const e = calcEdad($("#edit_fnac").value);
    $("#edit_edad").textContent = e === null ? "" : `edad: ${e}`;
  });

  $("#saveEdit").onclick = async () => {
    if (!hasPerm(me, "usuarios", "editar")) { alert("sin permiso para editar"); return; }

    const usuario = $("#edit_usuario").value.trim().toLowerCase();
    const nombres = $("#edit_nombres").value.trim();
    const apellidos = $("#edit_apellidos").value.trim();
    const cedula = onlyDigits($("#edit_cedula").value);
    const fecha_nacimiento = $("#edit_fnac").value;
    const activo = Number($("#edit_activo").value);
    const password = $("#edit_password").value.trim();

    if (!usuario || !nombres || !apellidos || !cedula || !fecha_nacimiento) { alert("complete los campos"); return; }
    if (cedula.length !== 10) { alert("la cédula debe tener 10 dígitos"); return; }

    const edad = calcEdad(fecha_nacimiento);
    if (edad === null) { alert("fecha de nacimiento inválida"); return; }
    if (edad < 18) { alert("solo mayores de edad (18+)"); return; }

    const data = { id: Number(user.id), usuario, nombres, apellidos, cedula, fecha_nacimiento, activo };

    if (me.is_admin && $("#edit_rol")) {
      const rolVal = $("#edit_rol").value;
      data.rol_id = (rolVal !== "") ? Number(rolVal) : "";
    }

    if (password) {
      if (password.length < 8) { alert("la contraseña debe tener al menos 8 caracteres"); return; }
      data.password = password;
    }

    const r = await Api.usuarios_update(data);
    if (r.ok) { close(); onSave(); }
    else alert("error: " + (r.error || "error"));
  };

  document.addEventListener("keydown", function escClose(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", escClose); }
  });
}

/* =========================
   usuarios 
   ========================= */

async function viewUsuarios(me) {
  if (!hasAnyPerm(me, "usuarios")) { location.hash = "#dashboard"; return router(); }

  const rolesRes = me.is_admin ? await Api.roles_list() : { ok: true, data: [] };
  const roles = rolesRes.ok ? rolesRes.data : [];

  const canList = hasPerm(me, "usuarios", "ver");
  const canCreate = hasPerm(me, "usuarios", "crear");
  const canEdit = hasPerm(me, "usuarios", "editar");
  const canDelete = hasPerm(me, "usuarios", "eliminar");

  setView(shell(me, "usuarios", `
    <div class="dashboard-container fade-in">
      <div id="uMsg"></div>

      ${canCreate ? `
      <div class="form-container">
        <h3>crear usuario</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>usuario</label>
            <input id="u_usuario" class="form-control" placeholder="ej: juan.perez" />
          </div>
          <div class="form-group">
            <label>nombres</label>
            <input id="u_nombres" class="form-control" placeholder="juan felipe" />
          </div>
          <div class="form-group">
            <label>apellidos</label>
            <input id="u_apellidos" class="form-control" placeholder="gutierrez vargas" />
          </div>
          <div class="form-group">
            <label>cédula</label>
            <input id="u_cedula" class="form-control" placeholder="10 dígitos" maxlength="10" />
          </div>
          <div class="form-group">
            <label>fecha de nacimiento</label>
            <input id="u_fnac" class="form-control" type="date" />
            <small class="hint" id="u_edad_hint"></small>
          </div>
          <div class="form-group">
            <label>contraseña</label>
            <input id="u_pass" class="form-control" type="password" placeholder="mínimo 8 caracteres" />
          </div>
          ${me.is_admin ? `
          <div class="form-group">
            <label>rol (opcional)</label>
            <select id="u_rol" class="form-control select">
              <option value="">sin rol</option>
              ${roles.map(r => `<option value="${r.id}">${escapeHtml(r.nombre)}${r.descripcion ? ` - ${escapeHtml(r.descripcion)}` : ""}</option>`).join("")}
            </select>
          </div>
          ` : ``}
        </div>
        <button class="btn btn-primary" id="btnCrearU" type="button">crear</button>
      </div>
      ` : `<div class="message info">no tienes permiso para crear usuarios</div>`}

      ${canList ? `
      <!-- ===== FILTRO SOLO ACTIVO/INACTIVO ===== -->
      <div class="form-container" style="margin-bottom:15px; padding:15px;">
        <div style="display:flex; gap:15px; align-items:flex-end; flex-wrap:wrap;">
          <div style="min-width:200px;">
            <label>estado</label>
            <select id="uEstadoFilter" class="form-control select">
              <option value="">todos</option>
              <option value="1">activo</option>
              <option value="0">inactivo</option>
            </select>
          </div>
          <div>
            <button class="btn btn-primary" id="btnFiltrarUsuarios">filtrar</button>
            <button class="btn btn-outline" id="btnLimpiarFiltros">limpiar</button>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>id</th>
              <th>usuario</th>
              <th>nombres</th>
              <th>apellidos</th>
              <th>cédula</th>
              <th>edad</th>
              <th>rol</th>
              <th>estado</th>
              <th>acciones</th>
            </tr>
          </thead>
          <tbody id="uTableBody">
            <tr><td colspan="9" class="td-center">cargando...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="uPager" class="pager-wrap"></div>
      ` : `<div class="message info">no tienes permiso para ver usuarios</div>`}
    </div>
  `));

  bindTopbarDropdowns();
  $("#btnLogout").onclick = logoutTotal;
  startClock();

  function msg(text) { $("#uMsg").innerHTML = msgBox("info", text); setTimeout(() => ($("#uMsg").innerHTML = ""), 3500); }

  if (canCreate) {
    $("#u_fnac").addEventListener("change", () => {
      const e = calcEdad($("#u_fnac").value);
      const h = $("#u_edad_hint");
      if (h) h.textContent = e === null ? "" : `edad: ${e}`;
    });

    $("#btnCrearU").onclick = async () => {
      const usuario = $("#u_usuario").value.trim().toLowerCase();
      const nombres = $("#u_nombres").value.trim();
      const apellidos = $("#u_apellidos").value.trim();
      const cedula = onlyDigits($("#u_cedula").value);
      const fecha_nacimiento = $("#u_fnac").value;
      const password = $("#u_pass").value;

      if (!usuario || !nombres || !apellidos || !cedula || !fecha_nacimiento || !password) return msg("complete todos los campos");
      if (cedula.length !== 10) return msg("la cédula debe tener 10 dígitos");
      const edad = calcEdad(fecha_nacimiento);
      if (edad === null) return msg("fecha de nacimiento inválida");
      if (edad < 18) return msg("solo mayores de edad (18+)");
      if (password.length < 8) return msg("contraseña mínima 8 caracteres");

      const payload = { usuario, nombres, apellidos, cedula, fecha_nacimiento, password };
      if (me.is_admin && $("#u_rol")) {
        const rol_id = $("#u_rol").value;
        if (rol_id !== "") payload.rol_id = Number(rol_id);
      }

      const r = await Api.usuarios_create(payload);
      msg(r.ok ? "usuario creado" : (r.error || "error"));
      if (r.ok) {
        $("#u_usuario").value = ""; $("#u_nombres").value = ""; $("#u_apellidos").value = "";
        $("#u_cedula").value = ""; $("#u_fnac").value = ""; 
        const h = $("#u_edad_hint"); if (h) h.textContent = "";
        $("#u_pass").value = ""; if ($("#u_rol")) $("#u_rol").value = "";
        USERS_CACHE.loaded = false;
        if (canList) cargarUsuarios();
      }
    };
  }

  if (canList) {
    let allUsers = [];
    let filteredUsers = [];
    let uPage = 1;
    const perPage = 4;
    let estadoFilter = "";

    async function cargarUsuarios() {
      const r = await Api.usuarios_list();
      if (!r.ok) {
        $("#uTableBody").innerHTML = `<tr><td colspan="9" class="td-center td-error">${escapeHtml(r.error || "error")}</td></tr>`;
        return;
      }
      allUsers = Array.isArray(r.data) ? r.data : [];
      aplicarFiltro();
    }

    function aplicarFiltro() {
      // SOLO FILTRO POR ESTADO (activo/inactivo)
      if (estadoFilter === "1") {
        filteredUsers = allUsers.filter(u => Number(u.activo) === 1);
      } else if (estadoFilter === "0") {
        filteredUsers = allUsers.filter(u => Number(u.activo) === 0);
      } else {
        filteredUsers = [...allUsers]; // todos
      }
      
      uPage = 1;
      renderUsersPage();
    }

    function renderUsersPage() {
      const out = paginate(filteredUsers, uPage, perPage);
      uPage = out.page;

      $("#uTableBody").innerHTML = out.slice.length ? out.slice.map(u => {
        const edad = calcEdad(u.fecha_nacimiento);
        const disEdit = !canEdit;
        const disDel = !canDelete;

        return `
          <tr>
            <td><strong>#${escapeHtml(u.id)}</strong></td>
            <td><strong>${escapeHtml(u.usuario)}</strong></td>
            <td>${escapeHtml(u.nombres || "")}</td>
            <td>${escapeHtml(u.apellidos || "")}</td>
            <td>${escapeHtml(u.cedula || "")}</td>
            <td>${edad === null ? "-" : edad}</td>
            <td>${escapeHtml(u.rol_nombre || "(sin rol)")}</td>
            <td>
              <span class="status-badge ${Number(u.activo) ? "status-active" : "status-inactive"}">
                ${Number(u.activo) ? "activo" : "inactivo"}
              </span>
            </td>
            <td>
              <div class="actions-container">
                <button class="btn btn-outline btn-sm" data-edit="${u.id}" ${disEdit ? "disabled" : ""} type="button">editar</button>
                <button class="btn btn-outline btn-sm" data-del="${u.id}" ${disDel ? "disabled" : ""} type="button">eliminar</button>
              </div>
            </td>
          </tr>
        `;
      }).join("") : `<tr><td colspan="9" class="td-center">no hay usuarios</td></tr>`;

      $$("[data-del]").forEach(b => {
        if (b.disabled) return;
        b.onclick = async () => {
          if (!canDelete) return msg("sin permiso para eliminar");
          if (!confirm("desactivar usuario?")) return;
          const id = Number(b.dataset.del);
          const rr = await Api.usuarios_delete({ id });
          msg(rr.ok ? "usuario desactivado" : (rr.error || "error"));
          if (rr.ok) { USERS_CACHE.loaded = false; cargarUsuarios(); }
        };
      });

      $$("[data-edit]").forEach(b => {
        if (b.disabled) return;
        b.onclick = async () => {
          if (!canEdit) return msg("sin permiso para editar");
          const id = Number(b.dataset.edit);
          const user = allUsers.find(x => Number(x.id) === id);
          if (!user) return;
          showEditUserModal(me, user, roles, async () => { USERS_CACHE.loaded = false; await cargarUsuarios(); });
        };
      });

      renderPager("#uPager", uPage, out.totalPages, (p) => {
        uPage = p;
        renderUsersPage();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // BOTONES DE FILTRO
    if ($("#btnFiltrarUsuarios")) {
      $("#btnFiltrarUsuarios").onclick = () => {
        estadoFilter = $("#uEstadoFilter")?.value || "";
        aplicarFiltro();
      };
    }

    if ($("#btnLimpiarFiltros")) {
      $("#btnLimpiarFiltros").onclick = () => {
        if ($("#uEstadoFilter")) $("#uEstadoFilter").value = "";
        estadoFilter = "";
        aplicarFiltro();
      };
    }

    cargarUsuarios();
  }
}

/* ===================== ROLES ===================== */
async function viewRoles(me) {
  if (!hasAnyPerm(me, "roles")) { location.hash = "#dashboard"; return router(); }

  const canList = hasPerm(me, "roles", "ver");
  const canCreate = hasPerm(me, "roles", "crear");
  const canEdit = hasPerm(me, "roles", "editar") && me.is_admin;

  setView(shell(me, "roles", `
    <div class="dashboard-container fade-in">
      <div id="rMsg"></div>

      ${canCreate ? `
      <div class="form-container">
        <h3>crear rol</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>nombre</label>
            <input id="r_nombre" class="form-control" placeholder="ej: supervisor" />
          </div>
          <div class="form-group">
            <label>descripción</label>
            <input id="r_desc" class="form-control" placeholder="opcional" />
          </div>
        </div>
        <button class="btn btn-primary" id="btnCrearR" type="button">crear</button>
      </div>
      ` : `<div class="message info">no tienes permiso para crear roles</div>`}

      ${canList ? `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>id</th>
              <th>nombre</th>
              <th>descripción</th>
              <th>tipo</th>
              <th>acciones</th>
            </tr>
          </thead>
          <tbody id="rTableBody">
            <tr><td colspan="5" class="td-center">cargando...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="rPager" class="pager-wrap"></div>
      ` : `<div class="message info">no tienes permiso para ver roles</div>`}

      ${(!me.is_admin && canList) ? `<div class="message info">nota: editar descripción de roles es solo para admin.</div>` : ``}
    </div>
  `));

  bindTopbarDropdowns();

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  function msg(text) {
    $("#rMsg").innerHTML = msgBox("info", text);
    setTimeout(() => ($("#rMsg").innerHTML = ""), 3500);
  }

  let rolesData = [];
  let rPage = 1;
  const perPage = 4;

  function renderRolesPage() {
    const out = paginate(rolesData, rPage, perPage);
    rPage = out.page;

    $("#rTableBody").innerHTML = out.slice.map(x => {
      const sys = Number(x.es_sistema) === 1;
      const disEdit = sys || !canEdit;

      return `
        <tr>
          <td><strong>#${escapeHtml(x.id)}</strong></td>
          <td><strong>${escapeHtml(x.nombre)}</strong></td>
          <td>${escapeHtml(x.descripcion || "sin descripción")}</td>
          <td>
            <span class="status-badge ${sys ? "status-active" : "status-inactive"}">
              ${sys ? "sistema" : "personalizado"}
            </span>
          </td>
          <td>
            <div class="actions-container">
              <button class="btn btn-outline btn-sm" data-edit="${x.id}" ${disEdit ? "disabled" : ""} type="button">editar</button>
              <button class="btn btn-outline btn-sm" disabled type="button">eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    $$("[data-edit]").forEach(b => {
      if (b.disabled) return;
      b.onclick = async () => {
        const id = Number(b.dataset.edit);
        const current = rolesData.find(z => Number(z.id) === id);
        const desc = prompt("nueva descripción:", current?.descripcion || "");
        if (desc === null) return;

        const rr = await Api.roles_update({ id, descripcion: desc.trim() });
        msg(rr.ok ? "actualizado" : (rr.error || "error"));
        if (rr.ok) cargarRoles();
      };
    });

    renderPager("#rPager", rPage, out.totalPages, (p) => {
      rPage = p;
      renderRolesPage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  async function cargarRoles() {
    if (!canList) return;

    const r = await Api.roles_list();
    if (!r.ok) {
      $("#rTableBody").innerHTML = `<tr><td colspan="5" class="td-center td-error">${escapeHtml(r.error || "error")}</td></tr>`;
      return;
    }

    rolesData = Array.isArray(r.data) ? r.data : [];
    if (rolesData.length === 0) {
      $("#rTableBody").innerHTML = `<tr><td colspan="5" class="td-center">sin roles</td></tr>`;
      $("#rPager").innerHTML = "";
      return;
    }

    rPage = 1;
    renderRolesPage();
  }

  if (canCreate) {
    $("#btnCrearR").onclick = async () => {
      const nombre = $("#r_nombre").value.trim().toLowerCase();
      const descripcion = $("#r_desc").value.trim();

      if (!nombre) return msg("nombre requerido");
      if (!/^[a-z0-9_]{3,50}$/.test(nombre)) return msg("nombre inválido (3-50, a-z 0-9 _)");

      const rr = await Api.roles_create({ nombre, descripcion });
      msg(rr.ok ? "rol creado" : (rr.error || "error"));

      if (rr.ok) {
        $("#r_nombre").value = "";
        $("#r_desc").value = "";
        cargarRoles();
      }
    };
  }

  cargarRoles();
}

async function viewPermisos(me) {
  if (!hasAnyPerm(me, "permisos")) { location.hash = "#dashboard"; return router(); }

  if (!me.is_admin) {
    setView(shell(me, "permisos", `<div class="message info">solo administrador puede asignar permisos</div>`));
    bindTopbarDropdowns();
    $("#btnLogout").onclick = logoutTotal;
    startClock();
    return;
  }

  if (!hasPerm(me, "permisos", "ver")) {
    setView(shell(me, "permisos", `<div class="message info">no tienes permiso para ver permisos</div>`));
    bindTopbarDropdowns();
    $("#btnLogout").onclick = logoutTotal;
    startClock();
    return;
  }

  const r = await Api.permisos_get();
  if (!r.ok) {
    setView(shell(me, "permisos", `<div class="message info">${escapeHtml(r.error || "error")}</div>`));
    bindTopbarDropdowns();
    $("#btnLogout").onclick = logoutTotal;
    startClock();
    return;
  }

  const modules = [
    { m: "usuarios",    actions: ["ver","crear","editar","eliminar"] },
    { m: "roles",       actions: ["ver","crear","editar","eliminar"] },
    { m: "permisos",    actions: ["ver","editar"] },
    { m: "cursos",      actions: ["ver","crear","editar","eliminar"] },
    { m: "matriculas",  actions: ["crear","anular"] },
    { m: "notas",       actions: ["ver","editar"] },
    { m: "reportes",    actions: ["ver"] },
    { m: "horarios",    actions: ["ver"] },
  ];

  setView(shell(me, "permisos", `
    <div class="dashboard-container fade-in">
      <div class="form-container">
        <h3>asignar permisos</h3>

        <div class="form-group">
          <label>rol</label>
          <select id="pRol" class="form-control select">
            ${r.roles.map(ro => `<option value="${ro.id}">${escapeHtml(ro.nombre)}${ro.descripcion ? ` - ${escapeHtml(ro.descripcion)}` : ""}</option>`).join("")}
          </select>
        </div>

        ${modules.map(x => `
          <div class="checkbox-group">
            <h4>${escapeHtml(x.m)}</h4>
            <div class="checkbox-row" id="p_${escapeHtml(x.m)}"></div>
          </div>
        `).join("")}

        <div class="perm-actions">
          <button class="btn btn-primary" id="btnGuardarP" type="button">guardar</button>
          <button class="btn btn-outline" id="btnSeleccionarTodos" type="button">seleccionar todo</button>
          <button class="btn btn-outline" id="btnDeseleccionarTodos" type="button">deseleccionar todo</button>
        </div>

        <div id="pMsg" style="margin-top: 1rem;"></div>
      </div>
    </div>
  `));

  bindTopbarDropdowns();

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  function renderChecks(mod, actions) {
    const el = $(`#p_${mod}`);
    if (!el) return;
    el.innerHTML = actions.map(a => `
      <div class="checkbox-item">
        <input type="checkbox" id="${mod}_${a}" />
        <label for="${mod}_${a}">${escapeHtml(a)}</label>
      </div>
    `).join("");
  }

  modules.forEach(x => renderChecks(x.m, x.actions));

  const map = r.map || {};

  function loadRole(rolId) {
    const perms = new Set(map[String(rolId)] || []);
    modules.forEach(x => {
      x.actions.forEach(a => {
        const cb = $(`#${x.m}_${a}`);
        if (cb) cb.checked = perms.has(`${x.m}.${a}`);
      });
    });
  }

  $("#pRol").onchange = () => loadRole($("#pRol").value);
  loadRole($("#pRol").value);

  $("#btnSeleccionarTodos").onclick = () => {
    modules.forEach(x => x.actions.forEach(a => {
      const cb = $(`#${x.m}_${a}`);
      if (cb) cb.checked = true;
    }));
  };

  $("#btnDeseleccionarTodos").onclick = () => {
    modules.forEach(x => x.actions.forEach(a => {
      const cb = $(`#${x.m}_${a}`);
      if (cb) cb.checked = false;
    }));
  };

  $("#btnGuardarP").onclick = async () => {
    if (!hasPerm(me, "permisos", "editar") || !me.is_admin) {
      $("#pMsg").innerHTML = msgBox("info", "sin permiso para editar (solo admin)");
      return;
    }

    const rol_id = Number($("#pRol").value);
    const selected = [];
    modules.forEach(x => x.actions.forEach(a => {
      const cb = $(`#${x.m}_${a}`);
      if (cb && cb.checked) selected.push(`${x.m}.${a}`);
    }));

    const rr = await Api.permisos_set({ rol_id, perms: selected });
    $("#pMsg").innerHTML = msgBox("info", rr.ok ? "guardado" : (rr.error || "error"));

    if (rr.ok) {
      map[String(rol_id)] = selected;
      setTimeout(() => ($("#pMsg").innerHTML = ""), 2200);
    }
  };
}

/* =========================
   cursos 
   ========================= */

async function viewCursos(me) {
  if (!hasAnyPerm(me, "cursos")) { location.hash = "#dashboard"; return router(); }

  const canCreate = hasPerm(me, "cursos", "crear");
  const canEdit = hasPerm(me, "cursos", "editar");
  const canDelete = hasPerm(me, "cursos", "eliminar");

  setView(shell(me, "cursos", `
    <div class="dashboard-container fade-in">
      <div id="cMsg"></div>

      ${canCreate ? `
      <div class="form-container">
        <h3>crear curso</h3>
        <div class="form-grid">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label>nombre</label>
            <input id="c_nombre" class="form-control" placeholder="ej: programación web" />
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label>descripción</label>
            <textarea id="c_desc" class="form-control" rows="3" placeholder="breve descripción del curso"></textarea>
          </div>
          <div class="form-group">
            <label>duración (semanas)</label>
            <input id="c_dur" class="form-control" type="number" min="1" max="52" value="4" />
          </div>
          <div class="form-group">
            <label>costo</label>
            <input id="c_costo" class="form-control" type="number" step="0.01" min="0" value="0" />
          </div>
          <div class="form-group">
            <label>docente</label>
            <select id="c_docente_sel" class="form-control select">
              <option value="">sin docente</option>
            </select>
            <small class="hint">solo se muestran usuarios con rol docente</small>
          </div>
          <div class="form-group">
            <label>día</label>
            <select id="c_dia" class="form-control select">
              <option value="1">lunes</option><option value="2">martes</option><option value="3">miércoles</option>
              <option value="4">jueves</option><option value="5">viernes</option><option value="6">sábado</option>
              <option value="7">domingo</option>
            </select>
          </div>
          <div class="form-group">
            <label>hora inicio</label>
            <input id="c_hi" class="form-control" placeholder="07:00" value="" />
          </div>
          <div class="form-group">
            <label>hora fin</label>
            <input id="c_hf" class="form-control" placeholder="08:00" value="" />
          </div>
        </div>
        <div class="modal-actions" style="justify-content:flex-start; gap:10px;">
          <button class="btn btn-primary" id="btnCrearC" type="button">crear</button>
          <button class="btn btn-outline" id="btnRefDoc" type="button">recargar docentes</button>
        </div>
      </div>
      ` : ``}

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>id</th>
              <th>curso</th>
              <th>duración</th>
              <th>costo</th>
              <th>docente</th>
              <th>horario</th>
              <th>acciones</th>
            </tr>
          </thead>
          <tbody id="cTableBody">
            <tr><td colspan="7" class="td-center">cargando...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="cPager" class="pager-wrap"></div>
    </div>
  `));

  bindTopbarDropdowns();
  $("#btnLogout").onclick = logoutTotal;
  startClock();

  const setMsg = (t, okk = false) => { $("#cMsg").innerHTML = msgBox(okk ? "success" : "info", t); };

  function esDocente(u) {
    if (!u || !u.rol_nombre) return false;
    const rol = String(u.rol_nombre).toLowerCase().trim();
    return rol === "docente" || 
           rol.includes("docente") || 
           rol === "profesor" || 
           rol.includes("prof");
  }

  // ===== CARGAR SOLO DOCENTES =====
  let docentes = [];
  async function loadDocentes(force = false) {
    const all = await ensureUsersCache(force);
    if (!all) { 
      setMsg("no se pudo cargar usuarios para docentes"); 
      return; 
    }

    docentes = all.filter(u => {
      const activo = Number(u.activo) === 1;
      return activo && esDocente(u);
    });

    const sel = $("#c_docente_sel");
    if (sel) {
      sel.innerHTML = '<option value="">sin docente</option>';
      docentes.forEach(u => {
        const option = document.createElement("option");
        option.value = u.id;
        option.textContent = `${u.apellidos || ""} ${u.nombres || ""}`.trim() || u.usuario;
        sel.appendChild(option);
      });
    }

    if (docentes.length === 0) {
      setMsg("no hay docentes activos disponibles");
    }
  }

  let allCursos = [];
  let currentPage = 1;
  const perPage = 4;

  async function loadCursos() {
    const r = await Api.cursos_list();
    if (!r.ok) {
      $("#cTableBody").innerHTML = `<tr><td colspan="7" class="td-center td-error">${escapeHtml(r.error || "error")}</td></tr>`;
      return;
    }
    allCursos = r.rows || r.data || [];
    currentPage = 1;
    renderCursosPage();
  }

  function renderCursosPage() {
    const out = paginate(allCursos, currentPage, perPage);
    currentPage = out.page;

    $("#cTableBody").innerHTML = out.slice.length ? out.slice.map(x => {
      const docente = x.docente_nombre ? escapeHtml(x.docente_nombre) : (x.docente_id ? `#${escapeHtml(x.docente_id)}` : "-");
      const horario = `${escapeHtml(diaNombre(x.dia_semana))} ${escapeHtml(x.hora_inicio || "00:00")}-${escapeHtml(x.hora_fin || "00:00")}`;
      const acciones = `
        ${canEdit ? `<button class="btn btn-outline btn-sm" data-edit="${x.id}" type="button">editar</button>` : ""}
        ${canDelete ? `<button class="btn btn-outline btn-sm" data-del="${x.id}" type="button">desactivar</button>` : ""}
      `;
      return `
        <tr>
          <td>${escapeHtml(x.id)}</td>
          <td>
            <strong>${escapeHtml(x.nombre)}</strong>
            ${x.descripcion ? `<div class="hint" style="margin-top:4px;">${escapeHtml(x.descripcion)}</div>` : ""}
          </td>
          <td>${escapeHtml(x.duracion_semanas)} sem</td>
          <td>$${escapeHtml(Number(x.costo ?? 0).toFixed(2))}</td>
          <td>${docente}</td>
          <td>${horario}</td>
          <td><div class="actions-container">${acciones || "-"}</div></td>
        </tr>
      `;
    }).join("") : `<tr><td colspan="7" class="td-center">sin cursos</td></tr>`;

    $$("#cTableBody [data-del]").forEach(b => {
      b.onclick = async () => {
        const id = Number(b.dataset.del);
        if (!confirm("desactivar curso #" + id + "?")) return;
        const rr = await Api.cursos_delete({ id });
        setMsg(rr.ok ? "curso desactivado" : (rr.error || "error"), rr.ok);
        if (rr.ok) loadCursos();
      };
    });

    $$("#cTableBody [data-edit]").forEach(b => {
      b.onclick = async () => {
        const id = Number(b.dataset.edit);
        const row = allCursos.find(z => Number(z.id) === id);
        if (!row) return;

        const nombre = prompt("nombre:", row.nombre); if (nombre === null) return;
        const descripcion = prompt("descripción:", row.descripcion || ""); if (descripcion === null) return;
        const duracion_semanas = prompt("duración (semanas):", row.duracion_semanas || 4); if (duracion_semanas === null) return;
        const costo = prompt("costo:", row.costo || 0); if (costo === null) return;
        const docente_id = prompt("docente_id (vacío = sin docente):", row.docente_id || ""); if (docente_id === null) return;
        const dia_semana = prompt("día (1=lun..7=dom):", row.dia_semana); if (dia_semana === null) return;
        const hora_inicio = prompt("hora inicio (HH:MM):", row.hora_inicio || "07:00"); if (hora_inicio === null) return;
        const hora_fin = prompt("hora fin (HH:MM):", row.hora_fin || "08:00"); if (hora_fin === null) return;

        const rr = await Api.cursos_update({
          id,
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          duracion_semanas: Number(duracion_semanas),
          costo: Number(costo),
          docente_id: (docente_id.trim() === "" ? "" : Number(docente_id)),
          dia_semana: Number(dia_semana),
          hora_inicio: hora_inicio.trim(),
          hora_fin: hora_fin.trim(),
        });

        setMsg(rr.ok ? "curso actualizado" : (rr.error || "error"), rr.ok);
        if (rr.ok) loadCursos();
      };
    });

    renderPager("#cPager", currentPage, out.totalPages, (p) => {
      currentPage = p;
      renderCursosPage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  await loadCursos();
  if (canCreate) await loadDocentes(false);

  if ($("#btnRefDoc")) {
    $("#btnRefDoc").onclick = async () => {
      USERS_CACHE.loaded = false;
      await loadDocentes(true);
      setMsg("docentes recargados", true);
    };
  }

  if (canCreate && $("#btnCrearC")) {
    $("#btnCrearC").onclick = async () => {
      const nombre = $("#c_nombre").value.trim();
      const descripcion = $("#c_desc").value.trim();
      const duracion_semanas = Number($("#c_dur").value);
      const costo = Number($("#c_costo").value);
      const docenteSel = $("#c_docente_sel") ? $("#c_docente_sel").value : "";
      const dia_semana = Number($("#c_dia").value);
      const hora_inicio = $("#c_hi").value.trim();
      const hora_fin = $("#c_hf").value.trim();

      if (!nombre) { setMsg("complete el nombre"); return; }
      if (!duracion_semanas || duracion_semanas < 1) { setMsg("duración inválida"); return; }
      if (!hora_inicio) { setMsg("complete hora inicio"); return; }
      if (!hora_fin) { setMsg("complete hora fin"); return; }

      const payload = { 
        nombre, 
        descripcion, 
        duracion_semanas, 
        costo, 
        dia_semana, 
        hora_inicio, 
        hora_fin
      };
      
      if (docenteSel !== "") payload.docente_id = Number(docenteSel);

      const rr = await Api.cursos_create(payload);
      setMsg(rr.ok ? "curso creado" : (rr.error || "error"), rr.ok);

      if (rr.ok) {
        $("#c_nombre").value = "";
        $("#c_desc").value = "";
        $("#c_dur").value = "4";
        $("#c_costo").value = "0";
        $("#c_hi").value = "";
        $("#c_hf").value = "";
        if ($("#c_docente_sel")) $("#c_docente_sel").value = "";
        await loadCursos();
      }
    };
  }
}

async function viewMatriculas(me) {
  if (!hasAnyPerm(me, "matriculas")) { location.hash="#dashboard"; return router(); }

  const canCreate = hasPerm(me, "matriculas", "crear");
  const canAnular = hasPerm(me, "matriculas", "anular");

  setView(shell(me, "matriculas", `
    <div class="dashboard-container fade-in">
      <div id="mMsg"></div>

      <div class="form-container">
        <h3>matrículas</h3>

        <div class="form-grid">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label>curso</label>
            <select id="m_curso" class="form-control select"></select>
          </div>
        </div>

        <div class="modal-actions" style="justify-content:flex-start; gap:10px;">
          <button class="btn btn-primary" id="btnMatricular" type="button" ${canCreate ? "" : "disabled"}>matricular</button>
          <button class="btn btn-outline" id="btnAnular" type="button" ${canAnular ? "" : "disabled"}>anular</button>
        </div>
        <small class="hint">se matricula/anula el estudiante que inició sesión.</small>
      </div>

      <div class="table-container" style="margin-top: 1rem;">
        <h3 style="margin:0 0 8px 0;">mi horario</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>curso</th><th>día</th><th>hora</th><th>docente</th>
            </tr>
          </thead>
          <tbody id="mHorarioBody"><tr><td colspan="4" class="td-center">cargando...</td></tr></tbody>
        </table>
        <div id="mChoques" style="margin-top:10px;"></div>
      </div>
    </div>
  `));

  bindTopbarDropdowns();

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  const setMsg = (t, okk=false) => { $("#mMsg").innerHTML = msgBox(okk ? "success" : "info", t); };

  const r = await Api.cursos_list();
  const cursos = (r.ok ? (r.rows || r.data || []) : []);
  const selCurso = $("#m_curso");
  selCurso.innerHTML = cursos.map(c => {
    const label = `${c.nombre} (${diaNombre(c.dia_semana)} ${c.hora_inicio}-${c.hora_fin})`;
    return `<option value="${c.id}">${escapeHtml(label)}</option>`;
  }).join("") || `<option value="">sin cursos</option>`;

  function detectarChoques(rows) {
    const choques = [];
    for (let i=0; i<rows.length; i++) {
      for (let j=i+1; j<rows.length; j++) {
        const a = rows[i], b = rows[j];
        if (Number(a.dia_semana) !== Number(b.dia_semana)) continue;
        const a1 = String(a.hora_inicio||"");
        const a2 = String(a.hora_fin||"");
        const b1 = String(b.hora_inicio||"");
        const b2 = String(b.hora_fin||"");
        if (a1 < b2 && b1 < a2) choques.push([a,b]);
      }
    }
    return choques;
  }

  async function refreshHorario() {
    const body = $("#mHorarioBody");
    const msg = $("#mChoques");

    const r = await Api.matriculas_list_mi();
    if (!r.ok) {
      body.innerHTML = `<tr><td colspan="4" class="td-center td-error">${escapeHtml(r.error || "error")}</td></tr>`;
      if (msg) msg.innerHTML = "";
      return;
    }

    const rows = r.rows || r.data || [];
    body.innerHTML = rows.length ? rows.map(x => `
      <tr>
        <td><strong>${escapeHtml(x.nombre)}</strong></td>
        <td>${escapeHtml(diaNombre(x.dia_semana))}</td>
        <td>${escapeHtml(x.hora_inicio)}-${escapeHtml(x.hora_fin)}</td>
        <td>${escapeHtml((x.docente_nombre || "").trim() || "-")}</td>
      </tr>
    `).join("") : `<tr><td colspan="4" class="td-center">sin matrículas activas</td></tr>`;

    const choques = detectarChoques(rows);
    if (msg) {
      msg.innerHTML = choques.length
        ? msgBox("info", `ojo: se detectaron ${choques.length} choque(s) de horario (mismo día con traslape).`)
        : "";
    }
  }

  await refreshHorario();

  $("#btnMatricular").onclick = async () => {
    if (!canCreate) return;
    const curso_id = Number(selCurso.value);
    if (!curso_id) { setMsg("elige un curso"); return; }
    const rr = await Api.matriculas_create({ curso_id });
    setMsg(rr.ok ? "matrícula registrada" : (rr.error || "error"), rr.ok);
    if (rr.ok) await refreshHorario();
  };

  $("#btnAnular").onclick = async () => {
    if (!canAnular) return;
    const curso_id = Number(selCurso.value);
    if (!curso_id) { setMsg("elige un curso"); return; }
    const rr = await Api.matriculas_anular({ curso_id });
    setMsg(rr.ok ? "matrícula anulada" : (rr.error || "error"), rr.ok);
    if (rr.ok) await refreshHorario();
  };
}


/* =========================
   notas
   ========================= */
async function viewNotas(me) {
  if (!hasAnyPerm(me, "notas")) { location.hash = "#dashboard"; return router(); }

  const canEdit = hasPerm(me, "notas", "editar");
  const PER_PAGE = 6;

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  setView(shell(me, "notas", `
    <div class="dashboard-container fade-in">
      <div id="nMsg"></div>

      <div class="form-container">
        <h3>ingreso de notas</h3>

        <div class="form-grid">
          <div class="form-group">
            <label>mis cursos</label>
            <select id="n_curso" class="form-control select"></select>
          </div>

          <div class="form-group">
            <label>buscar estudiante</label>
            <input type="text" id="nSearchInput" class="form-control" placeholder="nombre, cédula o usuario..." />
          </div>
        </div>

        <div class="modal-actions" style="justify-content:flex-start; gap:10px;">
          <button class="btn btn-primary" id="btnGuardarNotas" type="button" ${canEdit ? "" : "disabled"}>guardar</button>
          <button class="btn btn-outline" id="btnRecargarNotas" type="button">recargar</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>estudiante</th>
              <th>p1 (0-20)</th>
              <th>p2 (0-20)</th>
              <th>p3 (0-20)</th>
              <th>final</th>
              <th>estado</th>
              <th>supletorio</th>
            </tr>
          </thead>
          <tbody id="nTableBody">
            <tr><td colspan="7" class="td-center">elige un curso</td></tr>
          </tbody>
        </table>
      </div>

      <div class="pager-wrap" style="margin-top:12px;">
        <div id="nPagerContainer"></div>
      </div>
    </div>
  `));

  bindTopbarDropdowns();
  $("#btnLogout").onclick = logoutTotal;
  startClock();

  const setMsg = (t, okk = false) => { $("#nMsg").innerHTML = msgBox(okk ? "success" : "info", t); };

  function renderPagerSimple(containerSel, page, totalPages, onPage) {
    const el = $(containerSel);
    if (!el) return;
    const disabledPrev = page <= 1 ? "disabled" : "";
    const disabledNext = page >= totalPages ? "disabled" : "";
    el.innerHTML = `
      <div class="pager" style="display:flex; gap:10px; align-items:center; justify-content:center; flex-wrap:wrap;">
        <button class="btn btn-outline" id="nPrevBtn" type="button" ${disabledPrev}>anterior</button>
        <span class="hint" style="min-width:140px; text-align:center;">
          página <strong>${page}</strong> de <strong>${totalPages}</strong>
        </span>
        <button class="btn btn-outline" id="nNextBtn" type="button" ${disabledNext}>siguiente</button>
      </div>
    `;
    const prevBtn = $("#nPrevBtn");
    const nextBtn = $("#nNextBtn");
    if (prevBtn) prevBtn.onclick = () => { if (page > 1) onPage(page - 1); };
    if (nextBtn) nextBtn.onclick = () => { if (page < totalPages) onPage(page + 1); };
  }

  const cursosRes = await Api.mis_cursos();
  const cursos = cursosRes.ok ? (cursosRes.rows || cursosRes.data || []) : [];
  const sel = $("#n_curso");

  sel.innerHTML = cursos.map(c => {
    const label = `${c.nombre} (${diaNombre(c.dia_semana)} ${c.hora_inicio}-${c.hora_fin})`;
    return `<option value="${c.id}">${escapeHtml(label)}</option>`;
  }).join("") || `<option value="">sin cursos</option>`;

  let allEstudiantes = [];
  let currentPage = 1;

  function filterEstudiantes() {
    const t = ($("#nSearchInput")?.value || "").toLowerCase().trim();
    if (!t) return allEstudiantes;
    return allEstudiantes.filter(x => {
      const nombre = `${x.apellidos || ""} ${x.nombres || ""}`.toLowerCase();
      const usuario = (x.usuario || "").toLowerCase();
      const cedula = (x.cedula || "").toLowerCase();
      return nombre.includes(t) || usuario.includes(t) || cedula.includes(t);
    });
  }

  function calcularPromedio(p1, p2, p3) {
    return round2((Number(p1 || 0) + Number(p2 || 0) + Number(p3 || 0)) / 3);
  }

  function tieneDerecho(promedio) {
    return promedio >= 10 && promedio < 14;
  }

  function saveCurrentPageEdits() {
    $$("#nTableBody .n-inp").forEach(inp => {
      const eid = Number(inp.dataset.e || 0);
      const k = inp.dataset.k;
      const raw = String(inp.value ?? "").trim().replace(",", ".");
      const v = raw === "" ? null : Number(raw);
      const est = allEstudiantes.find(e => Number(e.estudiante_id) === eid);
      if (!est) return;
      if (k === "supletorio_nota") {
        est.supletorio_nota = (v === null || !isFinite(v)) ? null : clamp(v, 0, 20);
        return;
      }
      est[k] = (v === null || !isFinite(v)) ? 0 : round2(clamp(v, 0, 20));
    });
  }

  function paginateLocal(list, page, pp) {
    const totalPages = Math.max(1, Math.ceil(list.length / pp));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pp;
    return { page: safePage, totalPages, slice: list.slice(start, start + pp) };
  }

  function renderEstudiantes() {
    saveCurrentPageEdits();

    const filtered = filterEstudiantes();
    const { page, totalPages, slice } = paginateLocal(filtered, currentPage, PER_PAGE);
    currentPage = page;

    if (!slice.length) {
      $("#nTableBody").innerHTML = `<tr><td colspan="7" class="td-center">sin estudiantes encontrados</td></tr>`;
      renderPagerSimple("#nPagerContainer", 1, 1, () => {});
      return;
    }

    const inp20 = (eid, k, val, placeholder="", disabled = false) => `
      <input class="form-control n-inp" type="number" step="0.01" min="0" max="20"
        ${canEdit && !disabled ? "" : "disabled"}
        data-e="${eid}" data-k="${k}"
        value="${escapeHtml(val ?? "")}" placeholder="${escapeHtml(placeholder)}" />
    `;

    const soloLectura = (val) => `
      <input class="form-control" type="number" step="0.01" 
        disabled
        value="${escapeHtml(val ?? "")}" />
    `;

    $("#nTableBody").innerHTML = slice.map(x => {
      const eid = Number(x.estudiante_id);
      const nombre = `${x.apellidos || ""} ${x.nombres || ""}`.trim() || x.usuario || "estudiante";
      
      const p1 = Number(x.p1_total || 0);
      const p2 = Number(x.p2_total || 0);
      const p3 = Number(x.p3_total || 0);
      const promedioActual = calcularPromedio(p1, p2, p3);
      
      const estado = (x.estado ?? "REPROBADO");
      const estadoClass =
        estado === "APROBADO" ? "status-active" :
        estado === "SUPLETORIO" ? "status-warning" :
        "status-inactive";

      const tieneSupletorioGuardado = (x.supletorio_nota !== null && x.supletorio_nota !== undefined && x.supletorio_nota !== "");
      const derechoActual = tieneDerecho(promedioActual);
      
      let supletorioCell = `<span class="hint">—</span>`;
      
      if (tieneSupletorioGuardado) {
        if (derechoActual) {
          supletorioCell = inp20(eid, "supletorio_nota", x.supletorio_nota, "0–20", false);
        } else {
          supletorioCell = soloLectura(x.supletorio_nota);
        }
      } else if (derechoActual) {
        supletorioCell = inp20(eid, "supletorio_nota", "", "0–20", false);
      }

      return `
        <tr>
          <td>${escapeHtml(nombre)}</td>
          <td>${inp20(eid, "p1_total", p1, "", false)}</td>
          <td>${inp20(eid, "p2_total", p2, "", false)}</td>
          <td>${inp20(eid, "p3_total", p3, "", false)}</td>
          <td><strong>${escapeHtml(x.nota_final ?? "0.00")}</strong></td>
          <td><span class="status-badge ${estadoClass}">${escapeHtml(estado)}</span></td>
          <td>${supletorioCell}</td>
        </tr>
      `;
    }).join("");

    renderPagerSimple("#nPagerContainer", currentPage, totalPages, (p) => {
      currentPage = p;
      renderEstudiantes();
    });
  }

  async function loadEstudiantes() {
    const curso_id = Number(sel.value);
    if (!curso_id) {
      $("#nTableBody").innerHTML = `<tr><td colspan="7" class="td-center">sin curso</td></tr>`;
      renderPagerSimple("#nPagerContainer", 1, 1, () => {});
      return;
    }

    const r = await Api.curso_estudiantes(curso_id);
    if (!r.ok) {
      $("#nTableBody").innerHTML = `<tr><td colspan="7" class="td-center td-error">${escapeHtml(r.error || "error")}</td></tr>`;
      renderPagerSimple("#nPagerContainer", 1, 1, () => {});
      return;
    }

    allEstudiantes = r.rows || r.data || [];
    currentPage = 1;
    renderEstudiantes();
  }

  sel.onchange = loadEstudiantes;
  $("#btnRecargarNotas").onclick = loadEstudiantes;

  let searchTimeout;
  const searchInput = $("#nSearchInput");
  if (searchInput) {
    searchInput.oninput = () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentPage = 1;
        renderEstudiantes();
      }, 250);
    };
  }

  await loadEstudiantes();

  $("#btnGuardarNotas").onclick = async () => {
    if (!canEdit) return;

    const curso_id = Number(sel.value);
    if (!curso_id) return;

    saveCurrentPageEdits();

    const items = allEstudiantes.map(est => ({
      estudiante_id: Number(est.estudiante_id),
      p1_total: round2(clamp(Number(est.p1_total ?? 0), 0, 20)),
      p2_total: round2(clamp(Number(est.p2_total ?? 0), 0, 20)),
      p3_total: round2(clamp(Number(est.p3_total ?? 0), 0, 20)),
      supletorio_nota: (est.supletorio_nota === null || est.supletorio_nota === undefined || est.supletorio_nota === "")
        ? null
        : round2(clamp(Number(est.supletorio_nota), 0, 20)),
    }));

    const rr = await Api.guardar_notas({ curso_id, items });
    setMsg(rr.ok ? "notas guardadas correctamente" : (rr.error || "error"), rr.ok);

    if (rr.ok) {
      await loadEstudiantes();
    }
  };
}

/* =========================
   reportes
   ========================= */
async function viewReportes(me) {
  if (!(hasAnyPerm(me, "reportes") || hasAnyPerm(me, "horarios"))) {
    location.hash = "#dashboard";
    return router();
  }

  const esEstudiante = me?.tipo === "ESTUDIANTE";
  const esDocente = me?.rol_nombre?.toLowerCase().includes("docente") || me?.is_admin;
  const esAdmin = me?.is_admin;

  setView(shell(me, "reportes", `
    <div class="dashboard-container fade-in">
      <div id="repMsg"></div>

      <div class="form-container">
        <h3>reportes académicos</h3>

        <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
          ${esEstudiante ? `
            <button class="btn btn-primary" id="btnMisNotas">mis notas</button>
            <button class="btn btn-outline" id="btnMiHorario">mi horario</button>
            <button class="btn btn-success" id="btnPdfMisNotas">📄 PDF notas</button>
            <button class="btn btn-success" id="btnPdfMiHorario">📄 PDF horario</button>
          ` : ''}

          ${esDocente || esAdmin ? `
            <button class="btn btn-primary" id="btnHorarioDoc">mi horario</button>
            <button class="btn btn-outline" id="btnMisCursos">mis cursos</button>
            <button class="btn btn-success" id="btnPdfHorarioDoc">📄 PDF horario</button>
          ` : ''}
        </div>

        <div id="cursoSelectorContainer" style="margin-top:10px; display:none;"></div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead id="repHead">
            <tr><th>reporte</th></tr>
          </thead>
          <tbody id="repBody">
            <tr><td class="td-center">selecciona un reporte</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `));

  bindTopbarDropdowns();
  $("#btnLogout").onclick = logoutTotal;
  startClock();

  const setMsg = (t, okk = false) => {
    const boxType = okk ? "success" : "info";
    $("#repMsg").innerHTML = msgBox(boxType, t);
  };

  function setTable(headHtml, bodyHtml) {
    $("#repHead").innerHTML = headHtml;
    $("#repBody").innerHTML = bodyHtml;
  }

  function generarPDF(titulo, headHtml, bodyRows) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      setMsg("biblioteca PDF no cargada", false);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    
    let y = 20;
    doc.setFontSize(16);
    doc.text(titulo, 14, y);
    
    y += 10;
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString('es-EC')}`, 14, y);
    doc.text(`Usuario: ${me?.usuario || ''}`, 14, y + 5);
    doc.text(`Rol: ${me?.rol_nombre || 'sin rol'}`, 14, y + 10);
    
    y += 20;
    
    const headers = headHtml.match(/<th>(.*?)<\/th>/g)?.map(h => h.replace(/<\/?th>/g, '')) || [];
    const data = bodyRows.map(row => {
      const cells = row.match(/<td>(.*?)<\/td>/g)?.map(c => c.replace(/<\/?td>/g, '').replace(/<[^>]*>/g, '')) || [];
      return cells;
    });
    
    doc.autoTable({
      head: [headers],
      body: data,
      startY: y,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });
    
    doc.save(`${titulo.replace(/ /g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
    setMsg("PDF generado correctamente", true);
  }


  if ($("#btnMisNotas")) {
    $("#btnMisNotas").onclick = async () => {
      if (!hasPerm(me, "reportes", "ver")) return;
      $("#cursoSelectorContainer").style.display = "none";

      const r = await Api.reporte_notas_estudiante();
      if (!r.ok) { setMsg(r.error || "error"); return; }

      const rows = r.rows || r.data || [];
      if (!rows.length) {
        setTable(
          `<tr><th>mensaje</th></tr>`,
          `<tr><td class="td-center">no estás matriculado en ningún curso</td></tr>`
        );
        return;
      }

      const headHtml = `
        <tr>
          <th>curso</th>
          <th>docente</th>
          <th>horario</th>
          <th>p1</th>
          <th>p2</th>
          <th>p3</th>
          <th>final</th>
          <th>estado</th>
          <th>supletorio</th>
        </tr>
      `;

      const bodyHtml = rows.map(x => {
        const estado = (x.estado || "").toUpperCase();
        const estadoClass =
          estado === "APROBADO" ? "status-active" :
          estado === "SUPLETORIO" ? "status-warning" :
          "status-inactive";
        const horario = `${diaNombre(x.dia_semana)} ${x.hora_inicio || "00:00"}-${x.hora_fin || "00:00"}`;
        const p1 = Number(x.p1_total ?? 0).toFixed(2);
        const p2 = Number(x.p2_total ?? 0).toFixed(2);
        const p3 = Number(x.p3_total ?? 0).toFixed(2);
        const nf = Number(x.nota_final ?? 0).toFixed(2);
        return `
          <tr>
            <td><strong>${escapeHtml(x.nombre)}</strong></td>
            <td>${escapeHtml(x.docente_nombre || "-")}</td>
            <td>${escapeHtml(horario)}</td>
            <td>${escapeHtml(p1)}</td>
            <td>${escapeHtml(p2)}</td>
            <td>${escapeHtml(p3)}</td>
            <td><strong>${escapeHtml(nf)}</strong></td>
            <td><span class="status-badge ${estadoClass}">${escapeHtml(estado || "REPROBADO")}</span></td>
            <td>${x.supletorio_nota ? escapeHtml(Number(x.supletorio_nota).toFixed(2)) : '<span class="hint">—</span>'}</td>
          </tr>
        `;
      }).join("");

      setTable(headHtml, bodyHtml);
      window.__reporteNotasRows = rows;
      window.__reporteNotasHead = headHtml;
      window.__reporteNotasBody = bodyHtml;
    };


    if ($("#btnPdfMisNotas")) {
      $("#btnPdfMisNotas").onclick = async () => {
        if (!window.__reporteNotasRows) {
          const r = await Api.reporte_notas_estudiante();
          if (!r.ok) { setMsg(r.error || "error"); return; }
          window.__reporteNotasRows = r.rows || r.data || [];
          const rows = window.__reporteNotasRows;
          if (!rows.length) { setMsg("no hay datos para PDF"); return; }
          window.__reporteNotasHead = `<tr><th>curso</th><th>docente</th><th>horario</th><th>p1</th><th>p2</th><th>p3</th><th>final</th><th>estado</th><th>supletorio</th></tr>`;
          window.__reporteNotasBody = rows.map(x => {
            const horario = `${diaNombre(x.dia_semana)} ${x.hora_inicio || "00:00"}-${x.hora_fin || "00:00"}`;
            return `<tr><td>${x.nombre}</td><td>${x.docente_nombre || "-"}</td><td>${horario}</td><td>${Number(x.p1_total||0).toFixed(2)}</td><td>${Number(x.p2_total||0).toFixed(2)}</td><td>${Number(x.p3_total||0).toFixed(2)}</td><td>${Number(x.nota_final||0).toFixed(2)}</td><td>${x.estado||"REPROBADO"}</td><td>${x.supletorio_nota ? Number(x.supletorio_nota).toFixed(2) : '-'}</td></tr>`;
          }).join("");
        }
        if (!window.__reporteNotasRows.length) { setMsg("no hay datos para PDF"); return; }
        generarPDF("Reporte de Notas", window.__reporteNotasHead, window.__reporteNotasBody.match(/<tr>.*?<\/tr>/g) || []);
      };
    }
  }

  if ($("#btnMiHorario")) {
    $("#btnMiHorario").onclick = async () => {
      if (!hasPerm(me, "horarios", "ver") && !hasPerm(me, "reportes", "ver")) return;
      $("#cursoSelectorContainer").style.display = "none";

      const r = await Api.matriculas_list_mi();
      if (!r.ok) { setMsg(r.error || "error"); return; }

      const rows = r.rows || r.data || [];
      if (!rows.length) {
        setTable(
          `<tr><th>mensaje</th></tr>`,
          `<tr><td class="td-center">no estás matriculado en ningún curso</td></tr>`
        );
        return;
      }

      const headHtml = `
        <tr>
          <th>curso</th>
          <th>día</th>
          <th>hora</th>
          <th>docente</th>
        </tr>
      `;

      const bodyHtml = rows.map(x => `
        <tr>
          <td><strong>${escapeHtml(x.nombre)}</strong></td>
          <td>${escapeHtml(diaNombre(x.dia_semana))}</td>
          <td>${escapeHtml(x.hora_inicio || "00:00")}-${escapeHtml(x.hora_fin || "00:00")}</td>
          <td>${escapeHtml(x.docente_nombre || "-")}</td>
        </tr>
      `).join("");

      setTable(headHtml, bodyHtml);
      window.__reporteHorarioRows = rows;
      window.__reporteHorarioHead = headHtml;
      window.__reporteHorarioBody = bodyHtml;
    };

    if ($("#btnPdfMiHorario")) {
      $("#btnPdfMiHorario").onclick = async () => {
        if (!window.__reporteHorarioRows) {
          const r = await Api.matriculas_list_mi();
          if (!r.ok) { setMsg(r.error || "error"); return; }
          window.__reporteHorarioRows = r.rows || r.data || [];
          const rows = window.__reporteHorarioRows;
          if (!rows.length) { setMsg("no hay datos para PDF"); return; }
          window.__reporteHorarioHead = `<tr><th>curso</th><th>día</th><th>hora</th><th>docente</th></tr>`;
          window.__reporteHorarioBody = rows.map(x => 
            `<tr><td>${x.nombre}</td><td>${diaNombre(x.dia_semana)}</td><td>${x.hora_inicio}-${x.hora_fin}</td><td>${x.docente_nombre||"-"}</td></tr>`
          ).join("");
        }
        if (!window.__reporteHorarioRows.length) { setMsg("no hay datos para PDF"); return; }
        generarPDF("Mi Horario", window.__reporteHorarioHead, window.__reporteHorarioBody.match(/<tr>.*?<\/tr>/g) || []);
      };
    }
  }

  if ($("#btnHorarioDoc")) {
    $("#btnHorarioDoc").onclick = async () => {
      if (!hasPerm(me, "horarios", "ver") && !hasPerm(me, "reportes", "ver")) return;
      $("#cursoSelectorContainer").style.display = "none";

      const r = await Api.reporte_horario_docente();
      if (!r.ok) { setMsg(r.error || "error"); return; }

      const rows = r.rows || r.data || [];
      if (!rows.length) {
        setTable(
          `<tr><th>mensaje</th></tr>`,
          `<tr><td class="td-center">no tienes cursos asignados</td></tr>`
        );
        return;
      }

      const headHtml = `
        <tr>
          <th>curso</th>
          <th>día</th>
          <th>hora</th>
        </tr>
      `;

      const bodyHtml = rows.map(x => `
        <tr>
          <td><strong>${escapeHtml(x.nombre)}</strong></td>
          <td>${escapeHtml(diaNombre(x.dia_semana))}</td>
          <td>${escapeHtml(x.hora_inicio || "00:00")}-${escapeHtml(x.hora_fin || "00:00")}</td>
        </tr>
      `).join("");

      setTable(headHtml, bodyHtml);
      window.__reporteHorarioDocRows = rows;
      window.__reporteHorarioDocHead = headHtml;
      window.__reporteHorarioDocBody = bodyHtml;
    };

    if ($("#btnPdfHorarioDoc")) {
      $("#btnPdfHorarioDoc").onclick = async () => {
        if (!window.__reporteHorarioDocRows) {
          const r = await Api.reporte_horario_docente();
          if (!r.ok) { setMsg(r.error || "error"); return; }
          window.__reporteHorarioDocRows = r.rows || r.data || [];
          const rows = window.__reporteHorarioDocRows;
          if (!rows.length) { setMsg("no hay datos para PDF"); return; }
          window.__reporteHorarioDocHead = `<tr><th>curso</th><th>día</th><th>hora</th></tr>`;
          window.__reporteHorarioDocBody = rows.map(x => 
            `<tr><td>${x.nombre}</td><td>${diaNombre(x.dia_semana)}</td><td>${x.hora_inicio}-${x.hora_fin}</td></tr>`
          ).join("");
        }
        if (!window.__reporteHorarioDocRows.length) { setMsg("no hay datos para PDF"); return; }
        generarPDF("Mi Horario Docente", window.__reporteHorarioDocHead, window.__reporteHorarioDocBody.match(/<tr>.*?<\/tr>/g) || []);
      };
    }
  }

  if ($("#btnMisCursos")) {
    $("#btnMisCursos").onclick = async () => {
      if (!hasPerm(me, "reportes", "ver")) return;

      const r = await Api.reporte_cursos_docente();
      if (!r.ok) { setMsg(r.error || "error"); return; }

      const rows = r.rows || r.data || [];
      if (!rows.length) {
        setTable(
          `<tr><th>mensaje</th></tr>`,
          `<tr><td class="td-center">no tienes cursos asignados</td></tr>`
        );
        $("#cursoSelectorContainer").style.display = "none";
        return;
      }

      const selectContainer = $("#cursoSelectorContainer");
      selectContainer.style.display = "block";

      let selectHtml = `
        <label style="display:block; margin-bottom:5px;"><strong>seleccionar curso para ver notas:</strong></label>
        <select id="selectCursoNotas" class="form-control select" style="max-width:420px;">
          <option value="">-- seleccione un curso --</option>
          ${rows.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} (${c.total_estudiantes || 0} estudiantes)</option>`).join("")}
        </select>
      `;
      selectContainer.innerHTML = selectHtml;

      const headHtml = `
        <tr>
          <th>curso</th>
          <th>horario</th>
          <th>docente</th>
          <th>estudiantes</th>
        </tr>
      `;

      const bodyHtml = rows.map(x => `
        <tr>
          <td><strong>${escapeHtml(x.nombre)}</strong></td>
          <td>${escapeHtml(diaNombre(x.dia_semana))} ${escapeHtml(x.hora_inicio || "00:00")}-${escapeHtml(x.hora_fin || "00:00")}</td>
          <td>${escapeHtml(x.docente_nombre || me?.nombre || "-")}</td>
          <td>${escapeHtml(x.total_estudiantes || 0)}</td>
        </tr>
      `).join("");

      setTable(headHtml, bodyHtml);
      setMsg(`tienes ${rows.length} cursos`, true);

      $("#selectCursoNotas").onchange = async function () {
        const curso_id = Number(this.value);
        if (!curso_id) return;
        await verNotasCurso(curso_id);
      };
    };
  }

  async function verNotasCurso(curso_id) {
    const r = await Api.reporte_notas_curso_docente(curso_id);
    if (!r.ok) { setMsg(r.error || "error"); return; }

    const rows = r.rows || r.data || [];
    if (!rows.length) {
      setTable(
        `<tr><th>mensaje</th></tr>`,
        `<tr><td class="td-center">no hay estudiantes matriculados en este curso</td></tr>`
      );
      return;
    }

    const headHtml = `
      <tr>
        <th>#</th>
        <th>cédula</th>
        <th>apellidos</th>
        <th>nombres</th>
        <th>p1</th>
        <th>p2</th>
        <th>p3</th>
        <th>final</th>
        <th>estado</th>
        <th>supletorio</th>
      </tr>
    `;

    const bodyHtml = rows.map((x, i) => {
      const estado = (x.estado || "").toUpperCase();
      const estadoClass =
        estado === "APROBADO" ? "status-active" :
        estado === "SUPLETORIO" ? "status-warning" :
        "status-inactive";

      const p1 = Number(x.p1_total ?? 0).toFixed(2);
      const p2 = Number(x.p2_total ?? 0).toFixed(2);
      const p3 = Number(x.p3_total ?? 0).toFixed(2);
      const nf = Number(x.nota_final ?? 0).toFixed(2);

      return `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(x.cedula || "-")}</td>
          <td>${escapeHtml(x.apellidos || "")}</td>
          <td>${escapeHtml(x.nombres || "")}</td>
          <td>${escapeHtml(p1)}</td>
          <td>${escapeHtml(p2)}</td>
          <td>${escapeHtml(p3)}</td>
          <td><strong>${escapeHtml(nf)}</strong></td>
          <td><span class="status-badge ${estadoClass}">${escapeHtml(estado || "REPROBADO")}</span></td>
          <td>${x.supletorio_nota ? escapeHtml(Number(x.supletorio_nota).toFixed(2)) : '<span class="hint">—</span>'}</td>
        </tr>
      `;
    }).join("");

    setTable(headHtml, bodyHtml);
    setMsg(`mostrando ${rows.length} estudiantes`, true);
  }
}



async function viewEstudiantes(me) {
  if (!hasAnyPerm(me, "estudiantes")) { location.hash = "#dashboard"; return router(); }

  const canList = hasPerm(me, "estudiantes", "ver");
  const canCreate = hasPerm(me, "estudiantes", "crear");
  const canEdit = hasPerm(me, "estudiantes", "editar");
  const canDelete = hasPerm(me, "estudiantes", "eliminar");

  setView(shell(me, "estudiantes", `
    <div class="dashboard-container fade-in">
      <div id="estMsg"></div>

      ${canCreate ? `
      <div class="form-container">
        <h3>crear estudiante</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>nombres</label>
            <input id="est_nombres" class="form-control" placeholder="ej: juan carlos" />
          </div>

          <div class="form-group">
            <label>apellidos</label>
            <input id="est_apellidos" class="form-control" placeholder="ej: pérez garcía" />
          </div>

          <div class="form-group">
            <label>cédula</label>
            <input id="est_cedula" class="form-control" placeholder="10 dígitos" maxlength="10" />
          </div>

          <div class="form-group">
            <label>fecha de nacimiento</label>
            <input id="est_fnac" class="form-control" type="date" />
            <small class="hint" id="est_edad_hint"></small>
          </div>

          <div class="form-group">
            <label>correo</label>
            <input id="est_correo" class="form-control" type="email" placeholder="ejemplo@mail.com" />
          </div>

          <div class="form-group">
            <label>teléfono</label>
            <input id="est_telefono" class="form-control" placeholder="0987654321" />
          </div>

          <div class="form-group" style="grid-column: 1 / -1;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="est_crear_cuenta" style="width: auto;" />
              <span>crear cuenta de acceso al sistema</span>
            </label>
            <small class="hint">usuario y contraseña será la cédula</small>
          </div>
        </div>
        <button class="btn btn-primary" id="btnCrearEst" type="button">crear</button>
      </div>
      ` : `<div class="message info">no tienes permiso para crear estudiantes</div>`}

      ${canList ? `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>id</th>
              <th>cédula</th>
              <th>nombres</th>
              <th>apellidos</th>
              <th>edad</th>
              <th>correo</th>
              <th>teléfono</th>
              <th>cuenta</th>
              <th>estado</th>
              <th>acciones</th>
            </tr>
          </thead>
          <tbody id="estTableBody">
            <tr><td colspan="10" class="td-center">cargando...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="estPager" class="pager-wrap"></div>
      ` : `<div class="message info">no tienes permiso para ver estudiantes</div>`}
    </div>
  `));

  bindTopbarDropdowns();
  $("#btnLogout").onclick = logoutTotal;
  startClock();

  function msg(text) {
    $("#estMsg").innerHTML = msgBox("info", text);
    setTimeout(() => ($("#estMsg").innerHTML = ""), 3500);
  }

  if (canCreate) {
    $("#est_fnac").addEventListener("change", () => {
      const e = calcEdad($("#est_fnac").value);
      const h = $("#est_edad_hint");
      if (h) h.textContent = e === null ? "" : `edad: ${e}`;
    });

    $("#btnCrearEst").onclick = async () => {
      const nombres = $("#est_nombres").value.trim();
      const apellidos = $("#est_apellidos").value.trim();
      const cedula = onlyDigits($("#est_cedula").value);
      const fecha_nacimiento = $("#est_fnac").value;
      const correo = $("#est_correo").value.trim();
      const telefono = onlyDigits($("#est_telefono").value);
      const crear_cuenta = $("#est_crear_cuenta").checked ? 1 : 0;

      if (!nombres || !apellidos || !cedula || !fecha_nacimiento) {
        return msg("complete los campos obligatorios");
      }
      if (cedula.length !== 10) return msg("la cédula debe tener 10 dígitos");

      const edad = calcEdad(fecha_nacimiento);
      if (edad === null) return msg("fecha de nacimiento inválida");

      const payload = {
        nombres,
        apellidos,
        cedula,
        fecha_nacimiento,
        correo,
        telefono,
        crear_cuenta
      };

      const r = await Api.estudiantes_create(payload);
      msg(r.ok ? "estudiante creado correctamente" : (r.error || "error"));

      if (r.ok) {
        $("#est_nombres").value = "";
        $("#est_apellidos").value = "";
        $("#est_cedula").value = "";
        $("#est_fnac").value = "";
        $("#est_correo").value = "";
        $("#est_telefono").value = "";
        $("#est_crear_cuenta").checked = false;
        const h = $("#est_edad_hint");
        if (h) h.textContent = "";
        if (canList) cargarEstudiantes();
      }
    };
  }

  let estudiantesData = [];
  let estPage = 1;
  const perPage = 4;

  function renderEstudiantesPage() {
    const out = paginate(estudiantesData, estPage, perPage);
    estPage = out.page;

    $("#estTableBody").innerHTML = out.slice.map(est => {
      const edad = calcEdad(est.fecha_nacimiento);
      const disEdit = !canEdit;
      const disDel = !canDelete;

      return `
        <tr>
          <td><strong>#${escapeHtml(est.id)}</strong></td>
          <td>${escapeHtml(est.cedula || "")}</td>
          <td>${escapeHtml(est.nombres || "")}</td>
          <td>${escapeHtml(est.apellidos || "")}</td>
          <td>${edad === null ? "-" : edad}</td>
          <td>${escapeHtml(est.correo || "-")}</td>
          <td>${escapeHtml(est.telefono || "-")}</td>
          <td>
            ${est.cuenta_usuario ? 
              `<span class="status-badge status-active">${escapeHtml(est.cuenta_usuario)}</span>` : 
              `<span class="hint">sin cuenta</span>`
            }
          </td>
          <td>
            <span class="status-badge ${Number(est.activo) ? "status-active" : "status-inactive"}">
              ${Number(est.activo) ? "activo" : "inactivo"}
            </span>
          </td>
          <td>
            <div class="actions-container">
              <button class="btn btn-outline btn-sm" data-edit="${est.id}" ${disEdit ? "disabled" : ""} type="button">editar</button>
              <button class="btn btn-outline btn-sm" data-del="${est.id}" ${disDel ? "disabled" : ""} type="button">desactivar</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    $$("[data-del]").forEach(b => {
      if (b.disabled) return;
      b.onclick = async () => {
        if (!canDelete) return msg("sin permiso para eliminar");
        if (!confirm("¿desactivar estudiante?")) return;
        const id = Number(b.dataset.del);
        const rr = await Api.estudiantes_delete({ id });
        msg(rr.ok ? "estudiante desactivado" : (rr.error || "error"));
        if (rr.ok) cargarEstudiantes();
      };
    });

    $$("[data-edit]").forEach(b => {
      if (b.disabled) return;
      b.onclick = async () => {
        if (!canEdit) return msg("sin permiso para editar");
        const id = Number(b.dataset.edit);
        const est = estudiantesData.find(x => Number(x.id) === id);
        if (!est) return;
        showEditEstudianteModal(est);
      };
    });

    renderPager("#estPager", estPage, out.totalPages, (p) => {
      estPage = p;
      renderEstudiantesPage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function showEditEstudianteModal(est) {
    const edadIni = calcEdad(est.fecha_nacimiento);

    const modalHtml = `
      <div class="modal-overlay" id="editEstModal" role="dialog" aria-modal="true">
        <div class="modal-content">
          <button class="modal-close" id="closeEstModal" type="button" aria-label="cerrar">&times;</button>
          <div class="modal-header">
            <h3>editar estudiante</h3>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>nombres</label>
              <input type="text" id="edit_est_nombres" class="form-control" value="${escapeHtml(est.nombres || "")}" />
            </div>

            <div class="form-group">
              <label>apellidos</label>
              <input type="text" id="edit_est_apellidos" class="form-control" value="${escapeHtml(est.apellidos || "")}" />
            </div>

            <div class="form-group">
              <label>cédula</label>
              <input type="text" id="edit_est_cedula" class="form-control" maxlength="10" value="${escapeHtml(est.cedula || "")}" />
            </div>

            <div class="form-group">
              <label>fecha de nacimiento</label>
              <input type="date" id="edit_est_fnac" class="form-control" value="${escapeHtml(est.fecha_nacimiento || "")}" />
              <small class="hint" id="edit_est_edad">${edadIni === null ? "" : `edad: ${edadIni}`}</small>
            </div>

            <div class="form-group">
              <label>correo</label>
              <input type="email" id="edit_est_correo" class="form-control" value="${escapeHtml(est.correo || "")}" />
            </div>

            <div class="form-group">
              <label>teléfono</label>
              <input type="text" id="edit_est_telefono" class="form-control" value="${escapeHtml(est.telefono || "")}" />
            </div>

            <div class="form-group">
              <label>estado</label>
              <select id="edit_est_activo" class="form-control select">
                <option value="1" ${Number(est.activo) === 1 ? "selected" : ""}>activo</option>
                <option value="0" ${Number(est.activo) === 0 ? "selected" : ""}>inactivo</option>
              </select>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-primary" id="saveEditEst" type="button">guardar</button>
            <button class="btn btn-outline" id="cancelEditEst" type="button">cancelar</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const close = () => $("#editEstModal")?.remove();
    $("#closeEstModal").onclick = close;
    $("#cancelEditEst").onclick = close;

    $("#edit_est_fnac").addEventListener("change", () => {
      const e = calcEdad($("#edit_est_fnac").value);
      $("#edit_est_edad").textContent = e === null ? "" : `edad: ${e}`;
    });

    $("#saveEditEst").onclick = async () => {
      const nombres = $("#edit_est_nombres").value.trim();
      const apellidos = $("#edit_est_apellidos").value.trim();
      const cedula = onlyDigits($("#edit_est_cedula").value);
      const fecha_nacimiento = $("#edit_est_fnac").value;
      const correo = $("#edit_est_correo").value.trim();
      const telefono = onlyDigits($("#edit_est_telefono").value);
      const activo = Number($("#edit_est_activo").value);

      if (!nombres || !apellidos || !cedula || !fecha_nacimiento) {
        alert("complete los campos obligatorios");
        return;
      }
      if (cedula.length !== 10) {
        alert("la cédula debe tener 10 dígitos");
        return;
      }

      const edad = calcEdad(fecha_nacimiento);
      if (edad === null) {
        alert("fecha de nacimiento inválida");
        return;
      }

      const data = {
        id: Number(est.id),
        nombres,
        apellidos,
        cedula,
        fecha_nacimiento,
        correo,
        telefono,
        activo
      };

      const r = await Api.estudiantes_update(data);
      if (r.ok) {
        close();
        cargarEstudiantes();
        msg("estudiante actualizado");
      } else {
        alert("error: " + (r.error || "error"));
      }
    };

    document.addEventListener("keydown", function escClose(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", escClose);
      }
    });
  }

  async function cargarEstudiantes() {
    if (!canList) return;

    const r = await Api.estudiantes_list();
    if (!r.ok) {
      $("#estTableBody").innerHTML = `<tr><td colspan="10" class="td-center td-error">${escapeHtml(r.error || "error")}</td></tr>`;
      return;
    }

    estudiantesData = Array.isArray(r.data) ? r.data : [];
    if (estudiantesData.length === 0) {
      $("#estTableBody").innerHTML = `<tr><td colspan="10" class="td-center">sin estudiantes</td></tr>`;
      $("#estPager").innerHTML = "";
      return;
    }

    estPage = 1;
    renderEstudiantesPage();
  }

  cargarEstudiantes();
}



/* =========================
   AUDITORÍA
   ========================= */
async function viewAuditoria(me) {
  if (!(me?.is_admin || hasAnyPerm(me, "auditoria"))) {
    location.hash = "#dashboard";
    return router();
  }

  setView(shell(me, "auditoria", `
    <div class="dashboard-container fade-in">
      <div id="aMsg"></div>

      <div class="form-container">
        <h3>auditoría</h3>
        <div style="display:flex; gap:15px; align-items:flex-end; flex-wrap:wrap; margin-bottom:15px;">
          <div style="flex:2; min-width:250px;">
            <label>buscar</label>
            <input id="aSearch" class="form-control" placeholder="usuario, acción, tabla, detalle..." />
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-success" id="btnPdfAuditoria">📄 PDF auditoría</button>
          </div>
        </div>
      </div>

      <div class="table-container" style="margin-top:12px;">
        <table class="data-table">
          <thead id="aHead">
            <tr>
              <th>fecha</th>
              <th>usuario</th>
              <th>ip</th>
              <th>acción</th>
              <th>tabla</th>
              <th>detalle</th>
            </tr>
          </thead>
          <tbody id="aBody">
            <tr><td colspan="6" class="td-center">cargando...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="aPager" class="pager-wrap"></div>
    </div>
  `));

  bindTopbarDropdowns();
  $("#btnLogout").onclick = logoutTotal;
  startClock();

  const setMsg = (t, okk = false) => {
    const el = $("#aMsg");
    if (el) el.innerHTML = msgBox(okk ? "success" : "info", t);
  };

  const PER_PAGE = 10;
  let allLogs = [];
  let filteredLogs = [];
  let page = 1;

  function generarPDFAuditoria() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      setMsg("biblioteca PDF no cargada", false);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    
    let y = 20;
    doc.setFontSize(16);
    doc.text("Reporte de Auditoría", 14, y);
    
    y += 10;
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString('es-EC')}`, 14, y);
    doc.text(`Usuario: ${me?.usuario || ''}`, 14, y + 5);
    doc.text(`Rol: ${me?.rol_nombre || 'sin rol'}`, 14, y + 10);
    
    y += 20;
    
    const headers = ["fecha", "usuario", "ip", "acción", "tabla", "detalle"];
    const data = filteredLogs.map(log => [
      log.fecha || '',
      log.usuario || '-',
      log.ip || '-',
      log.accion || '',
      log.tabla || '-',
      (log.detalle || log.descripcion || '').substring(0, 100)
    ]);
    
    doc.autoTable({
      head: [headers],
      body: data,
      startY: y,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });
    
    doc.save(`auditoria_${new Date().toISOString().slice(0,10)}.pdf`);
    setMsg("PDF generado correctamente", true);
  }

  function norm(x) { return String(x ?? "").toLowerCase(); }

  function filterRows() {
    const q = norm($("#aSearch")?.value || "").trim();
    if (!q) return allLogs;
    return allLogs.filter(r => {
      const blob = [
        r.fecha, r.usuario, r.ip, r.accion, r.tabla, r.detalle, r.descripcion
      ].map(norm).join(" ");
      return blob.includes(q);
    });
  }

  function render() {
    filteredLogs = filterRows();
    const out = paginate(filteredLogs, page, PER_PAGE);
    page = out.page;

    if (!out.slice.length) {
      $("#aBody").innerHTML = `<tr><td colspan="6" class="td-center">sin registros</td></tr>`;
      $("#aPager").innerHTML = "";
      return;
    }

    $("#aBody").innerHTML = out.slice.map(r => {
      const fecha = r.fecha || '';
      const usuario = r.usuario || '-';
      const ip = r.ip || '-';
      const accion = r.accion || '';
      const tabla = r.tabla || '-';
      const detalle = (r.detalle || r.descripcion || '');
      
      let estadoClass = "status-inactive";
      if (accion.includes('ok') || accion.includes('create') || accion.includes('update')) estadoClass = "status-active";
      if (accion.includes('fail') || accion.includes('delete') || accion.includes('anular')) estadoClass = "status-warning";
      
      return `
        <tr>
          <td>${escapeHtml(fecha)}</td>
          <td><strong>${escapeHtml(usuario)}</strong></td>
          <td>${escapeHtml(ip)}</td>
          <td><span class="status-badge ${estadoClass}">${escapeHtml(accion)}</span></td>
          <td>${escapeHtml(tabla)}</td>
          <td style="max-width:420px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(detalle)}">
            ${escapeHtml(detalle.substring(0, 100))}${detalle.length > 100 ? '...' : ''}
          </td>
        </tr>
      `;
    }).join("");

    renderPager("#aPager", page, out.totalPages, (p) => {
      page = p;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  async function load() {
    if (!Api.auditoria_list) {
      setMsg("endpoint no disponible", false);
      $("#aBody").innerHTML = `<tr><td colspan="6" class="td-center td-error">endpoint no disponible</td></tr>`;
      return;
    }

    const r = await Api.auditoria_list();
    if (!r.ok) {
      setMsg(r.error || "error al cargar auditoría");
      $("#aBody").innerHTML = `<tr><td colspan="6" class="td-center td-error">${escapeHtml(r.error || "error")}</td></tr>`;
      return;
    }

    allLogs = (r.rows || r.data || []);
    if (!Array.isArray(allLogs)) allLogs = [];
    page = 1;
    render();
  }

  if ($("#aSearch")) {
    $("#aSearch").addEventListener("input", () => { 
      page = 1; 
      render(); 
    });
  }

  // BOTÓN PDF
  if ($("#btnPdfAuditoria")) {
    $("#btnPdfAuditoria").onclick = () => {
      if (filteredLogs.length === 0) {
        setMsg("no hay datos para generar PDF", false);
        return;
      }
      generarPDFAuditoria();
    };
  }

  await load();
}
/* =========================
   MI PERFIL (ESTUDIANTE)
   ========================= */
async function viewMiPerfil(me) {
  if (me?.tipo !== "ESTUDIANTE") {
    location.hash = "#dashboard";
    return router();
  }

  setView(shell(me, "perfil", `
    <div class="dashboard-container fade-in">
      <div id="perfilMsg"></div>
      
      <div class="form-container" style="max-width:800px; margin:0 auto;">
        <h3>mi perfil</h3>
        
        <div id="perfilForm">
          <div class="td-center">cargando datos del perfil...</div>
        </div>
      </div>
    </div>
  `));

  bindTopbarDropdowns();
  $("#btnLogout").onclick = logoutTotal;
  startClock();

  const setMsg = (t, okk = false) => {
    $("#perfilMsg").innerHTML = msgBox(okk ? "success" : "info", t);
  };

  async function cargarPerfil() {
    const r = await Api.mi_perfil();
    if (!r.ok) {
      $("#perfilForm").innerHTML = `<div class="message info">${escapeHtml(r.error || "error al cargar perfil")}</div>`;
      return;
    }

    const p = r.perfil;
    
    const html = `
      <div class="form-grid">
        <div class="form-group">
          <label>nombres</label>
          <input type="text" class="form-control" value="${escapeHtml(p.nombres || '')}" disabled readonly />
        </div>

        <div class="form-group">
          <label>apellidos</label>
          <input type="text" class="form-control" value="${escapeHtml(p.apellidos || '')}" disabled readonly />
        </div>

        <div class="form-group">
          <label>cédula</label>
          <input type="text" class="form-control" value="${escapeHtml(p.cedula || '')}" disabled readonly />
        </div>

        <div class="form-group">
          <label>fecha de nacimiento</label>
          <input type="date" id="perfil_fecha_nacimiento" class="form-control" value="${escapeHtml(p.fecha_nacimiento || '')}" />
          <small class="hint" id="perfil_edad_hint"></small>
        </div>

        <div class="form-group">
          <label>correo electrónico</label>
          <input type="email" id="perfil_correo" class="form-control" value="${escapeHtml(p.correo || '')}" placeholder="tucorreo@ejemplo.com" />
        </div>

        <div class="form-group">
          <label>teléfono</label>
          <input type="text" id="perfil_telefono" class="form-control" value="${escapeHtml(p.telefono || '')}" placeholder="0999999999" maxlength="10" />
        </div>

        <div class="form-group" style="grid-column: 1 / -1; border-top:1px solid var(--border); margin-top:20px; padding-top:20px;">
          <h4 style="margin-bottom:15px;">datos de acceso</h4>
        </div>

        <div class="form-group">
          <label>usuario</label>
          <input type="text" id="perfil_usuario" class="form-control" value="${escapeHtml(p.usuario || '')}" placeholder="usuario para iniciar sesión" />
          <small class="hint">mínimo 4 caracteres (dejar vacío para no cambiar)</small>
        </div>

        <div class="form-group">
          <label>nueva contraseña</label>
          <input type="password" id="perfil_password" class="form-control" placeholder="dejar en blanco para no cambiar" />
          <small class="hint">mínimo 8 caracteres</small>
        </div>

        <div class="form-group">
          <label>confirmar contraseña</label>
          <input type="password" id="perfil_password2" class="form-control" placeholder="repite tu nueva contraseña" />
        </div>
      </div>

      <div class="modal-actions" style="justify-content:center; margin-top:30px;">
        <button class="btn btn-primary" id="btnGuardarPerfil" type="button">guardar cambios</button>
        <button class="btn btn-outline" id="btnCancelarPerfil" type="button">cancelar</button>
      </div>
    `;

    $("#perfilForm").innerHTML = html;

    $("#perfil_fecha_nacimiento").addEventListener("change", () => {
      const edad = calcEdad($("#perfil_fecha_nacimiento").value);
      const hint = $("#perfil_edad_hint");
      if (hint) {
        if (edad === null) {
          hint.textContent = "fecha inválida";
          hint.style.color = "var(--muted)";
        } else if (edad < 18) {
          hint.textContent = `debes ser mayor de edad (tienes ${edad} años)`;
          hint.style.color = "var(--muted)";
        } else {
          hint.textContent = `edad: ${edad} años`;
          hint.style.color = "var(--muted)";
        }
      }
    });

    setTimeout(() => {
      const event = new Event('change');
      $("#perfil_fecha_nacimiento")?.dispatchEvent(event);
    }, 100);

    $("#btnGuardarPerfil").onclick = async () => {
      const fecha_nacimiento = $("#perfil_fecha_nacimiento").value;
      const correo = $("#perfil_correo").value.trim();
      const telefono = onlyDigits($("#perfil_telefono").value);
      const usuario = $("#perfil_usuario").value.trim().toLowerCase();
      const password = $("#perfil_password").value;
      const password2 = $("#perfil_password2").value;

      if (!fecha_nacimiento) {
        setMsg("fecha de nacimiento es obligatoria");
        return;
      }

      const edad = calcEdad(fecha_nacimiento);
      if (edad === null) {
        setMsg("fecha de nacimiento inválida");
        return;
      }
      if (edad < 18) {
        setMsg("debes ser mayor de edad (18+)");
        return;
      }

      if (usuario && usuario.length < 4) {
        setMsg("el usuario debe tener al menos 4 caracteres");
        return;
      }

      if (password || password2) {
        if (password.length < 8) {
          setMsg("la contraseña debe tener al menos 8 caracteres");
          return;
        }
        if (password !== password2) {
          setMsg("las contraseñas no coinciden");
          return;
        }
      }

      const data = {
        fecha_nacimiento,
        correo,
        telefono
      };

      if (usuario) data.usuario = usuario;
      if (password) data.password = password;

      const rr = await Api.mi_perfil_actualizar(data);
      setMsg(rr.ok ? "perfil actualizado correctamente" : (rr.error || "error al actualizar"), rr.ok);

      if (rr.ok) {
        const meRes = await Api.me();
        if (meRes.ok) {
          document.querySelectorAll(".username").forEach(el => {
            el.textContent = meRes.me.usuario;
          });
        }
      }
    };

    $("#btnCancelarPerfil").onclick = () => {
      location.hash = "#dashboard";
    };
  }

  await cargarPerfil();
}
/* =========================
   logout + router
   ========================= */
async function logoutTotal() {
  await Api.logout();
  stopClock();
  history.replaceState(null, "", location.pathname + location.search + "#login");
  loginView(msgBox("info", "sesión cerrada"));
}

async function router() {
  const hash = (location.hash || "#login").replace("#", "");

  const meRes = await Api.me();
  if (!meRes.ok) { loginView(); return; }

  const me = meRes.me;

  if (hash === "login" || hash === "") { location.hash = "#dashboard"; return; }

  if (hash === "usuarios" && !hasAnyPerm(me, "usuarios")) location.hash = "#dashboard";
  if (hash === "roles" && !hasAnyPerm(me, "roles")) location.hash = "#dashboard";
  if (hash === "permisos" && !hasAnyPerm(me, "permisos")) location.hash = "#dashboard";
  if (hash === "cursos" && !hasAnyPerm(me, "cursos")) location.hash = "#dashboard";
  if (hash === "matriculas" && !hasAnyPerm(me, "matriculas")) location.hash = "#dashboard";
  if (hash === "notas" && !hasAnyPerm(me, "notas")) location.hash = "#dashboard";
  if (hash === "perfil" && me?.tipo !== "ESTUDIANTE") location.hash = "#dashboard";
  if (hash === "auditoria" && !(me?.is_admin || hasAnyPerm(me, "auditoria"))) location.hash = "#dashboard";
  
  if (hash === "reportes" && !(hasAnyPerm(me, "reportes") || hasAnyPerm(me, "horarios"))) location.hash = "#dashboard";

  const h = (location.hash || "#dashboard").replace("#", "");

  if (h === "dashboard") return viewDashboard(me);
  if (h === "usuarios") return viewUsuarios(me);
  if (h === "roles") return viewRoles(me);
  if (h === "permisos") return viewPermisos(me);
  if (h === "estudiantes") return viewEstudiantes(me);
  if (h === "cursos") return viewCursos(me);
  if (h === "matriculas") return viewMatriculas(me);
  if (h === "notas") return viewNotas(me);
  if (h === "reportes") return viewReportes(me);
  if (h === "perfil") return viewMiPerfil(me);
  if (h === "auditoria") return viewAuditoria(me);
  if (hash === "auditoria" && !(me?.is_admin || hasAnyPerm(me, "auditoria"))) location.hash = "#dashboard";

  location.hash = "#dashboard";
  return viewDashboard(me);
}

document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("hashchange", router);
  router();
});

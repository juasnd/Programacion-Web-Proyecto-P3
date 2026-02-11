// /js/app.js
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
   shell (layout)
   ========================= */
function shell(me, active, contentHtml) {
  const showUsuarios   = hasAnyPerm(me, "usuarios");
  const showRoles      = hasAnyPerm(me, "roles");
  const showPermisos   = hasAnyPerm(me, "permisos");
  const showCursos     = hasAnyPerm(me, "cursos");
  const showMatriculas = hasAnyPerm(me, "matriculas");
  const showNotas      = hasAnyPerm(me, "notas");
  const showReportes   = hasAnyPerm(me, "reportes") || hasAnyPerm(me, "horarios");

  const navItem = (id, label, show) => show ? `
    <a class="nav-link ${active === id ? "active" : ""}" href="#${id}">${label}</a>
  ` : "";

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
        ${navItem("usuarios", "Usuarios", showUsuarios)}
        ${navItem("roles", "Roles", showRoles)}
        ${navItem("permisos", "Rermisos", showPermisos)}
        ${navItem("cursos", "Cursos", showCursos)}
        ${navItem("matriculas", "Matriculación", showMatriculas)}
        ${navItem("notas", "Notas", showNotas)}
        ${navItem("reportes", "Reportes", showReportes)}
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

  const doLogin = async () => {
    const usuario = ($("#usuario").value || "").trim();
    const password = ($("#password").value || "").trim();

    if (!usuario || !password) {
      $("#msg").innerHTML = msgBox("info", "complete todos los campos");
      return;
    }

    const r = await Api.login(usuario, password);
    if (!r.ok) {
      $("#msg").innerHTML = msgBox("info", r.error || "error");
      return;
    }

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

  setView(shell(me, "inicio", `
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

  $("#btnLogout").onclick = logoutTotal;
  startClock();
}

/* =========================
   usuarios (sin cambios grandes aquí)
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

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  function msg(text) {
    $("#uMsg").innerHTML = msgBox("info", text);
    setTimeout(() => ($("#uMsg").innerHTML = ""), 3500);
  }

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
        $("#u_usuario").value = "";
        $("#u_nombres").value = "";
        $("#u_apellidos").value = "";
        $("#u_cedula").value = "";
        $("#u_fnac").value = "";
        const h = $("#u_edad_hint");
        if (h) h.textContent = "";
        $("#u_pass").value = "";
        if ($("#u_rol")) $("#u_rol").value = "";
        USERS_CACHE.loaded = false; // refrescar cache
        if (canList) cargarUsuarios();
      }
    };
  }

  let usersData = [];
  let uPage = 1;
  const perPage = 6;

  function renderUsersPage() {
    const out = paginate(usersData, uPage, perPage);
    uPage = out.page;

    $("#uTableBody").innerHTML = out.slice.map(u => {
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
    }).join("");

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
        const user = usersData.find(x => Number(x.id) === id);
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

  async function cargarUsuarios() {
    if (!canList) return;

    const r = await Api.usuarios_list();
    if (!r.ok) {
      $("#uTableBody").innerHTML = `<tr><td colspan="9" class="td-center td-error">${escapeHtml(r.error || "error")}</td></tr>`;
      return;
    }

    usersData = Array.isArray(r.data) ? r.data : [];
    if (usersData.length === 0) {
      $("#uTableBody").innerHTML = `<tr><td colspan="9" class="td-center">sin usuarios</td></tr>`;
      $("#uPager").innerHTML = "";
      return;
    }

    uPage = 1;
    renderUsersPage();
  }

  cargarUsuarios();
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

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  function msg(text) {
    $("#rMsg").innerHTML = msgBox("info", text);
    setTimeout(() => ($("#rMsg").innerHTML = ""), 3500);
  }

  let rolesData = [];
  let rPage = 1;
  const perPage = 6;

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

/* ===================== PERMISOS ===================== */
async function viewPermisos(me) {
  if (!hasAnyPerm(me, "permisos")) { location.hash = "#dashboard"; return router(); }

  if (!me.is_admin) {
    setView(shell(me, "permisos", `<div class="message info">solo administrador puede asignar permisos</div>`));
    $("#btnLogout").onclick = logoutTotal;
    startClock();
    return;
  }

  if (!hasPerm(me, "permisos", "ver")) {
    setView(shell(me, "permisos", `<div class="message info">no tienes permiso para ver permisos</div>`));
    $("#btnLogout").onclick = logoutTotal;
    startClock();
    return;
  }

  const r = await Api.permisos_get();
  if (!r.ok) {
    setView(shell(me, "permisos", `<div class="message info">${escapeHtml(r.error || "error")}</div>`));
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
   cursos (MEJORADO: asignar docente por select + cédula)
   ========================= */
async function viewCursos(me) {
  if (!hasAnyPerm(me, "cursos")) { location.hash="#dashboard"; return router(); }

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
          <div class="form-group">
            <label>nombre</label>
            <input id="c_nombre" class="form-control" placeholder="ej: matemáticas" />
          </div>
          <div class="form-group">
            <label>paralelo</label>
            <input id="c_paralelo" class="form-control" value="A" />
          </div>
          <div class="form-group">
            <label>periodo</label>
            <input id="c_periodo" class="form-control" placeholder="ej: 2026-1" />
          </div>

          <div class="form-group">
            <label>docente (opcional)</label>
            <select id="c_docente_sel" class="form-control select"></select>
          </div>

          <div class="form-group">
            <label>cédula del docente (opcional)</label>
            <input id="c_docente_ced" class="form-control" placeholder="10 dígitos" maxlength="10" />
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
            <input id="c_hi" class="form-control" value="07:00" />
          </div>
          <div class="form-group">
            <label>hora fin</label>
            <input id="c_hf" class="form-control" value="08:00" />
          </div>
          <div class="form-group">
            <label>aula</label>
            <input id="c_aula" class="form-control" placeholder="ej: B-203" />
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
              <th>paralelo</th>
              <th>periodo</th>
              <th>docente</th>
              <th>horario</th>
              <th>aula</th>
              <th>acciones</th>
            </tr>
          </thead>
          <tbody id="cTableBody">
            <tr><td colspan="8" class="td-center">cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `));

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  const setMsg = (t, okk=false) => { $("#cMsg").innerHTML = msgBox(okk ? "success" : "info", t); };

  // cargar docentes para el select
  let docentes = [];
  async function loadDocentes(force=false) {
    const all = await ensureUsersCache(force);
    if (!all) { setMsg("no se pudo cargar usuarios para docentes"); return; }
    // preferimos rol docente; si no hay, mostramos todos para no bloquear
    docentes = all.filter(u => roleKind(u) === "docente" && Number(u.activo) === 1);
    if (docentes.length === 0) docentes = all.filter(u => Number(u.activo) === 1);

    fillUserSelect($("#c_docente_sel"), docentes, "sin docente");
    bindCedulaPicker($("#c_docente_ced"), docentes, (u) => { $("#c_docente_sel").value = String(u.id); });
  }

  async function loadCursos() {
    const r = await Api.cursos_list();
    if (!r.ok) {
      $("#cTableBody").innerHTML = `<tr><td colspan="8" class="td-center td-error">${escapeHtml(r.error || "error")}</td></tr>`;
      return;
    }
    const rows = r.rows || r.data || [];
    $("#cTableBody").innerHTML = rows.length ? rows.map(x => {
      const docente = x.docente_nombre ? escapeHtml(x.docente_nombre) : (x.docente_id ? `#${escapeHtml(x.docente_id)}` : "-");
      const horario = `${escapeHtml(diaNombre(x.dia_semana))} ${escapeHtml(x.hora_inicio)}-${escapeHtml(x.hora_fin)}`;
      const acciones = `
        ${canEdit ? `<button class="btn btn-outline btn-sm" data-edit="${x.id}" type="button">editar</button>` : ""}
        ${canDelete ? `<button class="btn btn-outline btn-sm" data-del="${x.id}" type="button">desactivar</button>` : ""}
      `;
      return `
        <tr>
          <td>${escapeHtml(x.id)}</td>
          <td><strong>${escapeHtml(x.nombre)}</strong></td>
          <td>${escapeHtml(x.paralelo)}</td>
          <td>${escapeHtml(x.periodo)}</td>
          <td>${docente}</td>
          <td>${horario}</td>
          <td>${escapeHtml(x.aula || "-")}</td>
          <td><div class="actions-container">${acciones || "-"}</div></td>
        </tr>
      `;
    }).join("") : `<tr><td colspan="8" class="td-center">sin cursos</td></tr>`;

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
        const row = rows.find(z => Number(z.id) === id);
        if (!row) return;

        // editar básico por prompts (incluye docente_id)
        const nombre = prompt("nombre:", row.nombre); if (nombre === null) return;
        const paralelo = prompt("paralelo:", row.paralelo); if (paralelo === null) return;
        const periodo = prompt("periodo:", row.periodo); if (periodo === null) return;

        // aquí mejor: permite poner docente_id directamente o dejar vacío
        const docente_id = prompt("docente_id (vacío = sin docente):", row.docente_id ?? ""); if (docente_id === null) return;

        const dia_semana = prompt("día (1=lun..7=dom):", row.dia_semana); if (dia_semana === null) return;
        const hora_inicio = prompt("hora inicio (HH:MM):", row.hora_inicio); if (hora_inicio === null) return;
        const hora_fin = prompt("hora fin (HH:MM):", row.hora_fin); if (hora_fin === null) return;
        const aula = prompt("aula:", row.aula ?? ""); if (aula === null) return;

        const rr = await Api.cursos_update({
          id,
          nombre: nombre.trim(),
          paralelo: paralelo.trim(),
          periodo: periodo.trim(),
          docente_id: (docente_id.trim() === "" ? "" : Number(docente_id)),
          dia_semana: Number(dia_semana),
          hora_inicio: hora_inicio.trim(),
          hora_fin: hora_fin.trim(),
          aula: aula.trim()
        });

        setMsg(rr.ok ? "curso actualizado" : (rr.error || "error"), rr.ok);
        if (rr.ok) loadCursos();
      };
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
      const paralelo = $("#c_paralelo").value.trim() || "A";
      const periodo = $("#c_periodo").value.trim();
      const docenteSel = $("#c_docente_sel") ? $("#c_docente_sel").value : "";
      const dia_semana = Number($("#c_dia").value);
      const hora_inicio = $("#c_hi").value.trim();
      const hora_fin = $("#c_hf").value.trim();
      const aula = $("#c_aula").value.trim();

      if (!nombre || !periodo) { setMsg("complete nombre y periodo"); return; }

      const payload = { nombre, paralelo, periodo, dia_semana, hora_inicio, hora_fin, aula };
      if (docenteSel !== "") payload.docente_id = Number(docenteSel);

      const rr = await Api.cursos_create(payload);
      setMsg(rr.ok ? "curso creado" : (rr.error || "error"), rr.ok);

      if (rr.ok) {
        $("#c_nombre").value = "";
        $("#c_aula").value = "";
        $("#c_docente_ced").value = "";
        if ($("#c_docente_sel")) $("#c_docente_sel").value = "";
        await loadCursos();
      }
    };
  }
}

/* =========================
   matriculación (MEJORADO: select estudiante + búsqueda por cédula)
   ========================= */
async function viewMatriculas(me) {
  if (!hasAnyPerm(me, "matriculas")) { location.hash="#dashboard"; return router(); }

  const canCreate = hasPerm(me, "matriculas", "crear");
  const canAnular = hasPerm(me, "matriculas", "anular");

  setView(shell(me, "matriculas", `
    <div class="dashboard-container fade-in">
      <div id="mMsg"></div>

      <div class="form-container">
        <h3>matricular</h3>

        <div class="form-grid">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label>estudiante</label>
            <select id="m_est_sel" class="form-control select"></select>
          </div>

          <div class="form-group">
            <label>cédula (búsqueda rápida)</label>
            <input id="m_est_ced" class="form-control" placeholder="10 dígitos" maxlength="10" />
          </div>

          <div class="form-group">
            <label>curso</label>
            <select id="m_curso" class="form-control select"></select>
          </div>
        </div>

        <div class="modal-actions" style="justify-content:flex-start; gap:10px;">
          <button class="btn btn-primary" id="btnMatricular" type="button" ${canCreate ? "" : "disabled"}>matricular</button>
          <button class="btn btn-outline" id="btnAnular" type="button" ${canAnular ? "" : "disabled"}>anular</button>
          <button class="btn btn-outline" id="btnRefEst" type="button">recargar estudiantes</button>
        </div>

      </div>

      <div class="table-container" style="margin-top: 1rem;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
          <h3 style="margin:0;">matrículas activas</h3>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>periodo</th><th>curso</th><th>paralelo</th><th>día</th><th>hora</th><th>aula</th><th>docente</th>
            </tr>
          </thead>
          <tbody id="mHorarioBody"><tr><td colspan="7" class="td-center">elige un estudiante</td></tr></tbody>
        </table>
        <div id="mChoques" style="margin-top:10px;"></div>
      </div>
    </div>
  `));

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  const setMsg = (t, okk=false) => { $("#mMsg").innerHTML = msgBox(okk ? "success" : "info", t); };

  // cursos
  const r = await Api.cursos_list();
  const cursos = (r.ok ? (r.rows || r.data || []) : []);
  const selCurso = $("#m_curso");
  selCurso.innerHTML = cursos.map(c => {
    const label = `${c.periodo} - ${c.nombre} ${c.paralelo} (${diaNombre(c.dia_semana)} ${c.hora_inicio}-${c.hora_fin})`;
    return `<option value="${c.id}">${escapeHtml(label)}</option>`;
  }).join("") || `<option value="">sin cursos</option>`;

  // estudiantes
  let estudiantes = [];
  async function loadEstudiantes(force=false) {
    const all = await ensureUsersCache(force);
    if (!all) { setMsg("no se pudo cargar usuarios para estudiantes"); return; }

    estudiantes = all.filter(u => roleKind(u) === "estudiante" && Number(u.activo) === 1);
    if (estudiantes.length === 0) estudiantes = all.filter(u => Number(u.activo) === 1); // fallback

    fillUserSelect($("#m_est_sel"), estudiantes, "selecciona estudiante");
    bindCedulaPicker($("#m_est_ced"), estudiantes, (u) => { $("#m_est_sel").value = String(u.id); });
  }

  await loadEstudiantes(false);
  const getSelectedEstudianteId = () => Number($("#m_est_sel")?.value || 0);

  await refreshHorario();

  $("#btnRefEst").onclick = async () => {
    USERS_CACHE.loaded = false;
    await loadEstudiantes(true);
    setMsg("estudiantes recargados", true);
  };

  function detectarChoques(rows) {
    // choque si mismo periodo + mismo día + traslape de horas
    const choques = [];
    for (let i=0; i<rows.length; i++) {
      for (let j=i+1; j<rows.length; j++) {
        const a = rows[i], b = rows[j];
        if (String(a.periodo) !== String(b.periodo)) continue;
        if (Number(a.dia_semana) !== Number(b.dia_semana)) continue;
        const a1 = String(a.hora_inicio||"");
        const a2 = String(a.hora_fin||"");
        const b1 = String(b.hora_inicio||"");
        const b2 = String(b.hora_fin||"");
        if (a1 < b2 && b1 < a2) {
          choques.push([a,b]);
        }
      }
    }
    return choques;
  }

  async function refreshHorario() {
    const estudiante_id = getSelectedEstudianteId();
    const body = $("#mHorarioBody");
    const msg = $("#mChoques");
    if (!body) return;

    if (!estudiante_id) {
      body.innerHTML = `<tr><td colspan="7" class="td-center">elige un estudiante</td></tr>`;
      if (msg) msg.innerHTML = "";
      return;
    }

    const r = await Api.matriculas_list_estudiante(estudiante_id);
    if (!r.ok) {
      body.innerHTML = `<tr><td colspan="7" class="td-center td-error">${escapeHtml(r.error || "error")}</td></tr>`;
      if (msg) msg.innerHTML = "";
      return;
    }

    const rows = r.rows || r.data || [];
    body.innerHTML = rows.length ? rows.map(x => `
      <tr>
        <td>${escapeHtml(x.periodo)}</td>
        <td>${escapeHtml(x.nombre)}</td>
        <td>${escapeHtml(x.paralelo)}</td>
        <td>${escapeHtml(diaNombre(x.dia_semana))}</td>
        <td>${escapeHtml(x.hora_inicio)}-${escapeHtml(x.hora_fin)}</td>
        <td>${escapeHtml(x.aula || "-")}</td>
        <td>${escapeHtml((x.docente_nombre || "").trim() || "-")}</td>
      </tr>
    `).join("") : `<tr><td colspan="7" class="td-center">sin matrículas activas</td></tr>`;

    const choques = detectarChoques(rows);
    if (msg) {
      msg.innerHTML = choques.length
        ? msgBox("info", `ojo: se detectaron ${choques.length} choque(s) de horario (mismo periodo y día con traslape).`)
        : "";
    }
  }

  $("#m_est_sel").onchange = refreshHorario;
  if ($("#btnVerHorarioEst")) $("#btnVerHorarioEst").onclick = refreshHorario;

  $("#btnMatricular").onclick = async () => {
    if (!canCreate) return;

    const estudiante_id = getSelectedEstudianteId();
    const curso_id = Number(selCurso.value);

    if (!estudiante_id || !curso_id) { setMsg("elige estudiante y curso"); return; }

    const rr = await Api.matriculas_create({ curso_id, estudiante_id });
    setMsg(rr.ok ? "matrícula registrada" : (rr.error || "error"), rr.ok);
    if (rr.ok) await refreshHorario();
  };

  $("#btnAnular").onclick = async () => {
    if (!canAnular) return;

    const estudiante_id = getSelectedEstudianteId();
    const curso_id = Number(selCurso.value);

    if (!estudiante_id || !curso_id) { setMsg("elige estudiante y curso"); return; }

    const rr = await Api.matriculas_anular({ curso_id, estudiante_id });
    setMsg(rr.ok ? "matrícula anulada" : (rr.error || "error"), rr.ok);
    if (rr.ok) await refreshHorario();
  };
}

/* =========================
   notas (docente)
   ========================= */
async function viewNotas(me) {
  if (!hasAnyPerm(me, "notas")) { location.hash = "#dashboard"; return router(); }

  const canEdit = hasPerm(me, "notas", "editar");

  // ====== CONFIG ======
  // ponderación 4/5/4/7 (total 20) PERO el docente ingresa cada actividad SOBRE 20.
  const W = {
    p1_deberes: 4, p1_prueba: 5, p1_lab: 4, p1_examen: 7,
    p2_deberes: 4, p2_prueba: 5, p2_lab: 4, p2_examen: 7,
    p3_deberes: 4, p3_prueba: 5, p3_lab: 4, p3_examen: 7,
  };

  const PER_PAGE = 2; // ✅ fijo en 2 (tu paginación de antes)
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  // BD/API guardan "ponderado" (0..peso). UI muestra "sobre 20" (0..20).
  function storedToUI(stored, weight) {
    const s = Number(stored);
    if (!isFinite(s) || !weight) return 0;
    return round2(clamp((s / weight) * 20, 0, 20));
  }
  function uiToStored(ui, weight) {
    const u = Number(ui);
    if (!isFinite(u) || !weight) return 0;
    return round2(clamp((u / 20) * weight, 0, weight));
  }

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
            <span class="hint">filtra en tiempo real</span>
          </div>
        </div>

        <div class="modal-actions" style="justify-content:flex-start; gap:10px;">
          <button class="btn btn-primary" id="btnGuardarNotas" type="button" ${canEdit ? "" : "disabled"}>guardar</button>
          <button class="btn btn-outline" id="btnRecargarNotas" type="button">recargar</button>
        </div>

        <small class="hint">
          ingresa cada actividad <strong>sobre 20</strong>. el sistema la pondera a <strong>4/5/4/7</strong>.
          <strong id="studentsCount"></strong>
        </small>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>estudiante</th>
              <th>p1</th>
              <th>p2</th>
              <th>p3</th>
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

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  const setMsg = (t, okk = false) => {
    $("#nMsg").innerHTML = msgBox(okk ? "success" : "info", t);
  };

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

  // ===== cargar cursos =====
  const cursosRes = await Api.mis_cursos();
  const cursos = cursosRes.ok ? (cursosRes.rows || cursosRes.data || []) : [];
  const sel = $("#n_curso");

  sel.innerHTML = cursos.map(c => {
    const label = `${c.periodo} - ${c.nombre} ${c.paralelo}`;
    return `<option value="${c.id}">${escapeHtml(label)}</option>`;
  }).join("") || `<option value="">sin cursos</option>`;

  let allEstudiantes = [];
  let currentPage = 1;

  function filterEstudiantes() {
    const searchTerm = ($("#nSearchInput")?.value || "").toLowerCase().trim();
    if (!searchTerm) return allEstudiantes;

    return allEstudiantes.filter(x => {
      const nombre = `${x.apellidos || ""} ${x.nombres || ""}`.toLowerCase();
      const usuario = (x.usuario || "").toLowerCase();
      const cedula = (x.cedula || "").toLowerCase();
      return nombre.includes(searchTerm) || usuario.includes(searchTerm) || cedula.includes(searchTerm);
    });
  }

  function updateCount(filtered, total) {
    const countEl = $("#studentsCount");
    if (!countEl) return;
    countEl.textContent = (filtered === total)
      ? `mostrando ${total} estudiantes`
      : `mostrando ${filtered} de ${total} estudiantes`;
  }

  // UI (0..20) -> guardado ponderado (0..peso). Supletorio se queda 0..20.
  function saveCurrentPageEdits() {
    $$("#nTableBody .n-inp").forEach(i => {
      const eid = Number(i.dataset.e);
      const k = i.dataset.k;
      const raw = String(i.value ?? "").trim().replace(",", ".");
      const v = raw === "" ? null : Number(raw);

      const est = allEstudiantes.find(e => e.estudiante_id === eid);
      if (!est) return;

      if (k === "supletorio_nota") {
        est.supletorio_nota = (v === null || !isFinite(v)) ? null : clamp(v, 0, 20);
        return;
      }

      const w = W[k] || 0;
      if (!w) return;

      const uiVal = (!isFinite(v) || v === null) ? 0 : clamp(v, 0, 20);
      est[k] = uiToStored(uiVal, w);
    });
  }

  function paginateLocal(list, page, pp) {
    const totalPages = Math.max(1, Math.ceil(list.length / pp));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pp;
    return { page: safePage, totalPages, slice: list.slice(start, start + pp) };
  }

  // si cambia cualquier actividad normal, resetea supletorio (frontend)
  function bindResetSupletorioOnChange() {
    $$("#nTableBody .n-inp").forEach(inp => {
      const k = inp.dataset.k;
      if (k === "supletorio_nota") return;

      inp.addEventListener("input", () => {
        const eid = Number(inp.dataset.e);
        const est = allEstudiantes.find(e => e.estudiante_id === eid);
        if (!est) return;

        est.supletorio_nota = null;

        const su = $(`#nTableBody .n-inp[data-e="${eid}"][data-k="supletorio_nota"]`);
        if (su) su.value = "";
      });
    });
  }

  function renderEstudiantes() {
    saveCurrentPageEdits();

    const filtered = filterEstudiantes();
    const { page, totalPages, slice } = paginateLocal(filtered, currentPage, PER_PAGE);
    currentPage = page;

    updateCount(filtered.length, allEstudiantes.length);

    if (!slice.length) {
      $("#nTableBody").innerHTML = `<tr><td colspan="7" class="td-center">sin estudiantes encontrados</td></tr>`;
      renderPagerSimple("#nPagerContainer", 1, 1, () => {});
      return;
    }

    const inpItemUI20 = (label, k, storedVal, step = "0.01") => {
      const w = W[k] || 0;
      const uiVal = storedToUI(storedVal ?? 0, w);
      return `
        <div class="mini-item">
          <small class="mini-label">${escapeHtml(label)}</small>
          <input
            class="form-control n-inp"
            type="number"
            step="${step}"
            min="0"
            max="20"
            ${canEdit ? "" : "disabled"}
            data-e="{{EID}}"
            data-k="${k}"
            value="${escapeHtml(uiVal)}"
          />
        </div>
      `;
    };

    $("#nTableBody").innerHTML = slice.map(x => {
      const nombre = `${x.apellidos || ""} ${x.nombres || ""}`.trim() || x.usuario || "estudiante";

      const p1 = `
        <div class="mini-grid">
          ${inpItemUI20("deberes", "p1_deberes", x.p1_deberes).replace("{{EID}}", x.estudiante_id)}
          ${inpItemUI20("prueba",  "p1_prueba",  x.p1_prueba ).replace("{{EID}}", x.estudiante_id)}
          ${inpItemUI20("lab",     "p1_lab",     x.p1_lab    ).replace("{{EID}}", x.estudiante_id)}
          ${inpItemUI20("examen",  "p1_examen",  x.p1_examen ).replace("{{EID}}", x.estudiante_id)}
        </div>
        <small class="hint">total (ponderado): ${escapeHtml(x.p1_total ?? "0.00")}</small>
      `;

      const p2 = `
        <div class="mini-grid">
          ${inpItemUI20("deberes", "p2_deberes", x.p2_deberes).replace("{{EID}}", x.estudiante_id)}
          ${inpItemUI20("prueba",  "p2_prueba",  x.p2_prueba ).replace("{{EID}}", x.estudiante_id)}
          ${inpItemUI20("lab",     "p2_lab",     x.p2_lab    ).replace("{{EID}}", x.estudiante_id)}
          ${inpItemUI20("examen",  "p2_examen",  x.p2_examen ).replace("{{EID}}", x.estudiante_id)}
        </div>
        <small class="hint">total (ponderado): ${escapeHtml(x.p2_total ?? "0.00")}</small>
      `;

      const p3 = `
        <div class="mini-grid">
          ${inpItemUI20("deberes", "p3_deberes", x.p3_deberes).replace("{{EID}}", x.estudiante_id)}
          ${inpItemUI20("prueba",  "p3_prueba",  x.p3_prueba ).replace("{{EID}}", x.estudiante_id)}
          ${inpItemUI20("lab",     "p3_lab",     x.p3_lab    ).replace("{{EID}}", x.estudiante_id)}
          ${inpItemUI20("examen",  "p3_examen",  x.p3_examen ).replace("{{EID}}", x.estudiante_id)}
        </div>
        <small class="hint">total (ponderado): ${escapeHtml(x.p3_total ?? "0.00")}</small>
      `;

      const estado = (x.estado ?? "REPROBADO");
      const estadoClass =
        estado === "APROBADO" ? "status-active" :
        estado === "SUPLETORIO" ? "status-warning" :
        "status-inactive";

      const supletorioCell = (estado === "SUPLETORIO")
        ? `<input class="form-control n-inp" type="number" step="0.01" min="0" max="20"
              ${canEdit ? "" : "disabled"}
              data-e="${x.estudiante_id}" data-k="supletorio_nota"
              value="${escapeHtml(x.supletorio_nota ?? "")}" placeholder="0–20" />`
        : `<span class="hint">—</span>`;

      return `
        <tr>
          <td>${escapeHtml(nombre)}</td>
          <td>${p1}</td>
          <td>${p2}</td>
          <td>${p3}</td>
          <td>${escapeHtml(x.nota_final ?? "0.00")}</td>
          <td><span class="status-badge ${estadoClass}">${escapeHtml(estado)}</span></td>
          <td>${supletorioCell}</td>
        </tr>
      `;
    }).join("");

    bindResetSupletorioOnChange();

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
      updateCount(0, 0);
      return;
    }

    const r = await Api.curso_estudiantes(curso_id);
    if (!r.ok) {
      $("#nTableBody").innerHTML = `<tr><td colspan="7" class="td-center td-error">${escapeHtml(r.error || "error")}</td></tr>`;
      renderPagerSimple("#nPagerContainer", 1, 1, () => {});
      updateCount(0, 0);
      return;
    }

    allEstudiantes = r.rows || r.data || [];
    currentPage = 1;
    renderEstudiantes();
  }

  sel.onchange = loadEstudiantes;
  $("#btnRecargarNotas").onclick = loadEstudiantes;

  // buscador con debounce
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

    // enviamos actividades ya ponderadas (0..peso), supletorio sobre 20
    const items = allEstudiantes.map(est => ({
      estudiante_id: est.estudiante_id,

      p1_deberes: est.p1_deberes ?? 0,
      p1_prueba:  est.p1_prueba  ?? 0,
      p1_lab:     est.p1_lab     ?? 0,
      p1_examen:  est.p1_examen  ?? 0,

      p2_deberes: est.p2_deberes ?? 0,
      p2_prueba:  est.p2_prueba  ?? 0,
      p2_lab:     est.p2_lab     ?? 0,
      p2_examen:  est.p2_examen  ?? 0,

      p3_deberes: est.p3_deberes ?? 0,
      p3_prueba:  est.p3_prueba  ?? 0,
      p3_lab:     est.p3_lab     ?? 0,
      p3_examen:  est.p3_examen  ?? 0,

      supletorio_nota: (est.supletorio_nota === null || est.supletorio_nota === undefined)
        ? null
        : clamp(est.supletorio_nota, 0, 20),
    }));

    const rr = await Api.guardar_notas({ curso_id, items });
    setMsg(rr.ok ? "notas guardadas correctamente" : (rr.error || "error"), rr.ok);

    if (rr.ok) await loadEstudiantes();
  };
}



/* =========================
   reportes
   ========================= */
async function viewReportes(me) {
  if (!(hasAnyPerm(me, "reportes") || hasAnyPerm(me, "horarios"))) { location.hash="#dashboard"; return router(); }

  const canHor = hasPerm(me, "horarios", "ver");
  const canRep = hasPerm(me, "reportes", "ver");

  setView(shell(me, "reportes", `
    <div class="dashboard-container fade-in">
      <div id="repMsg"></div>

      <div class="form-container">
        <h3>reportes</h3>
        <div class="modal-actions" style="justify-content:flex-start; gap:10px;">
          <button class="btn btn-primary" id="btnHorarioDoc" type="button" ${canHor ? "" : "disabled"}>horario docente</button>
          <button class="btn btn-outline" id="btnNotasEst" type="button" ${canRep ? "" : "disabled"}>mis notas (estudiante)</button>
        </div>
        <small class="hint">por ahora se muestra en tabla (json). pdf lo conectamos después.</small>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead id="repHead"></thead>
          <tbody id="repBody">
            <tr><td class="td-center">selecciona un reporte</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `));

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  const setMsg = (t, okk=false) => { $("#repMsg").innerHTML = msgBox(okk ? "success" : "info", t); };

  function setTable(headHtml, bodyHtml) {
    $("#repHead").innerHTML = headHtml;
    $("#repBody").innerHTML = bodyHtml;
  }

  $("#btnHorarioDoc").onclick = async () => {
    if (!canHor) return;
    const r = await Api.reporte_horario_docente();
    if (!r.ok) { setMsg(r.error || "error"); return; }
    const rows = r.rows || r.data || [];
    setTable(`
      <tr>
        <th>periodo</th><th>curso</th><th>paralelo</th><th>día</th><th>hora</th><th>aula</th>
      </tr>
    `, rows.length ? rows.map(x => `
      <tr>
        <td>${escapeHtml(x.periodo)}</td>
        <td>${escapeHtml(x.nombre)}</td>
        <td>${escapeHtml(x.paralelo)}</td>
        <td>${escapeHtml(diaNombre(x.dia_semana))}</td>
        <td>${escapeHtml(x.hora_inicio)}-${escapeHtml(x.hora_fin)}</td>
        <td>${escapeHtml(x.aula || "-")}</td>
      </tr>
    `).join("") : `<tr><td colspan="7" class="td-center">sin datos</td></tr>`);
  };

  $("#btnNotasEst").onclick = async () => {
    if (!canRep) return;
    const r = await Api.reporte_notas_estudiante();
    if (!r.ok) { setMsg(r.error || "error"); return; }
    const rows = r.rows || r.data || [];
    setTable(`
      <tr>
        <th>periodo</th><th>curso</th><th>paralelo</th><th>p1</th><th>p2</th><th>p3</th><th>final</th><th>estado</th>
      </tr>
    `, rows.length ? rows.map(x => `
      <tr>
        <td>${escapeHtml(x.periodo)}</td>
        <td>${escapeHtml(x.nombre)}</td>
        <td>${escapeHtml(x.paralelo)}</td>
        <td>${escapeHtml(x.p1_total ?? "0.00")}</td>
        <td>${escapeHtml(x.p2_total ?? "0.00")}</td>
        <td>${escapeHtml(x.p3_total ?? "0.00")}</td>
        <td>${escapeHtml(x.nota_final ?? "0.00")}</td>
        <td>${escapeHtml(x.estado ?? "-")}</td>
      </tr>
    `).join("") : `<tr><td colspan="8" class="td-center">sin datos</td></tr>`);
  };
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
  if (hash === "reportes" && !(hasAnyPerm(me, "reportes") || hasAnyPerm(me, "horarios"))) location.hash = "#dashboard";

  const h = (location.hash || "#dashboard").replace("#", "");

  if (h === "dashboard") return viewDashboard(me);
  if (h === "usuarios") return viewUsuarios(me);
  if (h === "roles") return viewRoles(me);
  if (h === "permisos") return viewPermisos(me);
  if (h === "cursos") return viewCursos(me);
  if (h === "matriculas") return viewMatriculas(me);
  if (h === "notas") return viewNotas(me);
  if (h === "reportes") return viewReportes(me);

  location.hash = "#dashboard";
  return viewDashboard(me);
}

document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("hashchange", router);
  router();
});
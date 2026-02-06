function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

let clockTimer = null;

function ensureApp() {
  let root = $("#app");
  if (!root) {
    root = document.createElement("div");
    root.id = "app";
    document.body.prepend(root);
  }
  return root;
}

function setView(html) {
  ensureApp().innerHTML = html;
}

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
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

function updateDateTime() {
  const now = new Date();
  const dateElement = $("#currentDate");
  const timeElement = $("#currentTime");

  if (dateElement) {
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    dateElement.textContent = now.toLocaleDateString("es-ES", options);
  }

  if (timeElement) {
    timeElement.textContent = now.toLocaleTimeString("es-ES", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
}

function startClock() {
  stopClock();
  updateDateTime();
  clockTimer = setInterval(updateDateTime, 1000);
}

function onlyDigits(s) {
  return String(s || "").replace(/\D+/g, "");
}

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

function shell(me, active, contentHtml) {
  const showUsuarios = hasAnyPerm(me, "usuarios");
  const showRoles = hasAnyPerm(me, "roles");
  const showPermisos = hasAnyPerm(me, "permisos");

  const usuariosLink = showUsuarios
    ? `<li><a class="sidebar-link ${active === "usuarios" ? "active" : ""}" href="#usuarios"><span class="sidebar-text">usuarios</span></a></li>`
    : "";

  const rolesLink = showRoles
    ? `<li><a class="sidebar-link ${active === "roles" ? "active" : ""}" href="#roles"><span class="sidebar-text">roles</span></a></li>`
    : "";

  const permisosLink = showPermisos
    ? `<li><a class="sidebar-link ${active === "permisos" ? "active" : ""}" href="#permisos"><span class="sidebar-text">permisos</span></a></li>`
    : "";

  const avatarChar = escapeHtml(((me.nombres || me.usuario || "u")[0] || "u").toUpperCase());
  const rolName = escapeHtml(me.rol_nombre || "sin rol");
  const nombreMostrado = escapeHtml(fullName(me));

  return `
    <div class="topbar">
      <div class="user-info">
        <div class="user-avatar">${avatarChar}</div>
        <div class="user-details">
          <div class="username">${nombreMostrado}</div>
          <div class="user-role">${rolName}</div>
        </div>
      </div>

      <div class="topbar-center">
        <div class="datetime-display">
          <div class="current-date" id="currentDate">cargando...</div>
          <div class="current-time" id="currentTime">--:--:--</div>
        </div>
      </div>

      <button class="logout-btn" id="btnLogout" type="button">salir</button>
    </div>

    <div class="gestion-layout">
      <aside class="sidebar">
        <ul class="sidebar-nav">
          <li><a class="sidebar-link ${active === "dashboard" ? "active" : ""}" href="#dashboard"><span class="sidebar-text">dashboard</span></a></li>
          ${usuariosLink}
          ${rolesLink}
          ${permisosLink}
        </ul>
      </aside>

      <main class="content-area">
        <div class="content-header">
          <h1 class="section-title">${escapeHtml(active)}</h1>
          <div class="section-subtitle">gestión del sistema</div>
        </div>
        <div id="content">${contentHtml}</div>
      </main>
    </div>
  `;
}

function loginView(msg = "") {
  stopClock();
  setView(`
    <div class="login-wrapper">
      <div class="login-box fade-in">
        <div class="login-logo">Sistema Web</div>
        <div class="login-subtitle">Gestión de usuarios y roles</div>

        ${msg ? `<div id="msg">${msg}</div>` : `<div id="msg"></div>`}

        <input id="usuario" class="login-input" placeholder="usuario" autocomplete="username" />
        <input id="password" class="login-input" placeholder="contraseña" type="password" autocomplete="current-password" />
        <button id="btnLogin" class="login-btn" type="button">ingresar</button>
      </div>
    </div>
  `);

  $("#btnLogin").onclick = async () => {
    const usuario = $("#usuario").value;
    const password = $("#password").value;

    if (!usuario || !password) {
      $("#msg").innerHTML = `<div class="message error">complete todos los campos</div>`;
      return;
    }

    const r = await Api.login(usuario, password);
    if (!r.ok) {
      $("#msg").innerHTML = `<div class="message error">${escapeHtml(r.error)}</div>`;
      return;
    }

    location.hash = "#dashboard";
    router();
  };
}

async function viewDashboard(me) {
  const cards = [];

  if (hasAnyPerm(me, "usuarios")) {
    cards.push(`
      <a class="module-card" href="#usuarios">
        <h3>usuarios</h3>
        <p>administra usuarios del sistema.</p>
      </a>
    `);
  }

  if (hasAnyPerm(me, "roles")) {
    cards.push(`
      <a class="module-card" href="#roles">
        <h3>roles</h3>
        <p>crea roles del sistema.</p>
      </a>
    `);
  }

  if (hasAnyPerm(me, "permisos")) {
    cards.push(`
      <a class="module-card" href="#permisos">
        <h3>permisos</h3>
        <p>asigna permisos por rol.</p>
      </a>
    `);
  }

  setView(shell(me, "dashboard", `
    <div class="dashboard-container fade-in">
      <div class="welcome-section">
        <h1>bienvenido, ${escapeHtml(fullName(me))}</h1>
        <p>panel principal</p>
      </div>

      <div class="modules-grid">
        ${cards.join("") || `<div class="message info">no tienes módulos asignados</div>`}
      </div>
    </div>
  `));

  $("#btnLogout").onclick = logoutTotal;
  startClock();
}

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
    <div class="modal-overlay" id="editModal">
      <div class="modal-content">
        <button class="modal-close" id="closeModal" type="button">&times;</button>
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
          <button class="btn btn-secondary" id="cancelEdit" type="button">cancelar</button>
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
    if (!hasPerm(me, "usuarios", "editar")) {
      alert("sin permiso para editar");
      return;
    }

    const usuario = $("#edit_usuario").value.trim().toLowerCase();
    const nombres = $("#edit_nombres").value.trim();
    const apellidos = $("#edit_apellidos").value.trim();
    const cedula = onlyDigits($("#edit_cedula").value);
    const fecha_nacimiento = $("#edit_fnac").value;
    const activo = Number($("#edit_activo").value);
    const password = $("#edit_password").value.trim();

    if (!usuario || !nombres || !apellidos || !cedula || !fecha_nacimiento) {
      alert("complete usuario, nombres, apellidos, cédula y fecha de nacimiento");
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
    if (edad < 18) {
      alert("solo mayores de edad (18+)");
      return;
    }

    const data = { id: Number(user.id), usuario, nombres, apellidos, cedula, fecha_nacimiento, activo };

    if (me.is_admin && $("#edit_rol")) {
      const rolVal = $("#edit_rol").value;
      data.rol_id = (rolVal !== "") ? Number(rolVal) : "";
    }

    if (password) {
      if (password.length < 8) {
        alert("la contraseña debe tener al menos 8 caracteres");
        return;
      }
      data.password = password;
    }

    const r = await Api.usuarios_update(data);
    if (r.ok) {
      close();
      onSave();
    } else {
      alert("error: " + r.error);
    }
  };
}

async function viewUsuarios(me) {
  if (!hasAnyPerm(me, "usuarios")) {
    location.hash = "#dashboard";
    return router();
  }

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
      ` : `<div class="message info">no tienes permiso para ver registros de usuarios</div>`}
    </div>
  `));

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  function msg(okv, text, type = okv ? "success" : "error") {
    $("#uMsg").innerHTML = `<div class="message ${type}">${escapeHtml(text)}</div>`;
    setTimeout(() => ($("#uMsg").innerHTML = ""), 4000);
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

      if (!usuario || !nombres || !apellidos || !cedula || !fecha_nacimiento || !password) {
        return msg(false, "complete todos los campos");
      }

      if (cedula.length !== 10) return msg(false, "la cédula debe tener 10 dígitos");
      const edad = calcEdad(fecha_nacimiento);
      if (edad === null) return msg(false, "fecha de nacimiento inválida");
      if (edad < 18) return msg(false, "solo mayores de edad (18+)");

      if (password.length < 8) return msg(false, "contraseña mínima 8 caracteres");

      const payload = { usuario, nombres, apellidos, cedula, fecha_nacimiento, password };

      if (me.is_admin && $("#u_rol")) {
        const rol_id = $("#u_rol").value;
        if (rol_id !== "") payload.rol_id = Number(rol_id);
      }

      const r = await Api.usuarios_create(payload);
      msg(r.ok, r.ok ? "usuario creado" : r.error);

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
        if (canList) cargarUsuarios();
      }
    };
  }

  async function cargarUsuarios() {
    if (!canList) return;

    const r = await Api.usuarios_list();
    if (!r.ok) {
      $("#uTableBody").innerHTML = `<tr><td colspan="9" class="td-center td-error">${escapeHtml(r.error)}</td></tr>`;
      return;
    }

    if (!r.data || r.data.length === 0) {
      $("#uTableBody").innerHTML = `<tr><td colspan="9" class="td-center">sin usuarios</td></tr>`;
      return;
    }

    $("#uTableBody").innerHTML = r.data.map(u => {
      const edad = calcEdad(u.fecha_nacimiento);
      const disEdit = !canEdit;
      const disDel = !canDelete;

      return `
        <tr>
          <td><strong>#${u.id}</strong></td>
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
              <button class="btn btn-secondary btn-sm" data-edit="${u.id}" ${disEdit ? "disabled" : ""} type="button">editar</button>
              <button class="btn btn-danger btn-sm" data-del="${u.id}" ${disDel ? "disabled" : ""} type="button">eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    $$("[data-del]").forEach(b => {
      if (b.disabled) return;
      b.onclick = async () => {
        if (!canDelete) return msg(false, "sin permiso para eliminar");
        if (!confirm("eliminar usuario?")) return;
        const id = Number(b.dataset.del);
        const rr = await Api.usuarios_delete({ id });
        msg(rr.ok, rr.ok ? "usuario eliminado" : rr.error);
        if (rr.ok) cargarUsuarios();
      };
    });

    $$("[data-edit]").forEach(b => {
      if (b.disabled) return;
      b.onclick = async () => {
        if (!canEdit) return msg(false, "sin permiso para editar");
        const id = Number(b.dataset.edit);
        const user = r.data.find(x => Number(x.id) === id);
        if (!user) return;
        showEditUserModal(me, user, roles, cargarUsuarios);
      };
    });
  }

  cargarUsuarios();
}

/* ===================== ROLES (AHORA SÍ: crear para cualquiera con permiso) ===================== */

async function viewRoles(me) {
  if (!hasAnyPerm(me, "roles")) {
    location.hash = "#dashboard";
    return router();
  }

  const canList = hasPerm(me, "roles", "ver");
  const canCreate = hasPerm(me, "roles", "crear");
  const canEdit = hasPerm(me, "roles", "editar") && me.is_admin; // solo admin edita descripción

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
      ` : `<div class="message info">no tienes permiso para ver registros de roles</div>`}

      ${(!me.is_admin && canList) ? `<div class="message info">nota: editar descripción de roles es solo para admin.</div>` : ``}
    </div>
  `));

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  function msg(okv, text, type = okv ? "success" : "error") {
    $("#rMsg").innerHTML = `<div class="message ${type}">${escapeHtml(text)}</div>`;
    setTimeout(() => ($("#rMsg").innerHTML = ""), 4000);
  }

  async function cargarRoles() {
    if (!canList) return;

    const r = await Api.roles_list();
    if (!r.ok) {
      $("#rTableBody").innerHTML = `<tr><td colspan="5" class="td-center td-error">${escapeHtml(r.error)}</td></tr>`;
      return;
    }

    if (!r.data || r.data.length === 0) {
      $("#rTableBody").innerHTML = `<tr><td colspan="5" class="td-center">sin roles</td></tr>`;
      return;
    }

    $("#rTableBody").innerHTML = r.data.map(x => {
      const sys = Number(x.es_sistema) === 1;
      const disEdit = sys || !canEdit;

      return `
        <tr>
          <td><strong>#${x.id}</strong></td>
          <td><strong>${escapeHtml(x.nombre)}</strong></td>
          <td>${escapeHtml(x.descripcion || "sin descripción")}</td>
          <td>
            <span class="status-badge ${sys ? "status-active" : "status-inactive"}">
              ${sys ? "sistema" : "personalizado"}
            </span>
          </td>
          <td>
            <div class="actions-container">
              <button class="btn btn-secondary btn-sm" data-edit="${x.id}" ${disEdit ? "disabled" : ""} type="button">editar</button>
              <button class="btn btn-danger btn-sm" disabled type="button">eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    $$("[data-edit]").forEach(b => {
      if (b.disabled) return;
      b.onclick = async () => {
        const id = Number(b.dataset.edit);
        const current = r.data.find(z => Number(z.id) === id);
        const desc = prompt("nueva descripción:", current?.descripcion || "");
        if (desc === null) return;

        const rr = await Api.roles_update({ id, descripcion: desc.trim() });
        msg(rr.ok, rr.ok ? "actualizado" : rr.error);
        if (rr.ok) cargarRoles();
      };
    });
  }

  if (canCreate) {
    $("#btnCrearR").onclick = async () => {
      const nombre = $("#r_nombre").value.trim().toLowerCase();
      const descripcion = $("#r_desc").value.trim();

      if (!nombre) return msg(false, "nombre requerido");
      if (!/^[a-z0-9_]{3,50}$/.test(nombre)) return msg(false, "nombre inválido (3-50, a-z 0-9 _)");

      const rr = await Api.roles_create({ nombre, descripcion });
      msg(rr.ok, rr.ok ? "rol creado" : rr.error);

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
  if (!hasAnyPerm(me, "permisos")) {
    location.hash = "#dashboard";
    return router();
  }

  if (!me.is_admin) {
    setView(shell(me, "permisos", `<div class="message info">solo administrador puede asignar permisos</div>`));
    $("#btnLogout").onclick = logoutTotal;
    startClock();
    return;
  }

  if (!hasPerm(me, "permisos", "ver")) {
    setView(shell(me, "permisos", `<div class="message info">no tienes permiso para ver registros de permisos</div>`));
    $("#btnLogout").onclick = logoutTotal;
    startClock();
    return;
  }

  const r = await Api.permisos_get();
  if (!r.ok) {
    setView(shell(me, "permisos", `<div class="message error">${escapeHtml(r.error)}</div>`));
    $("#btnLogout").onclick = logoutTotal;
    startClock();
    return;
  }

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

        <div class="checkbox-group">
          <h4>usuarios</h4>
          <div class="checkbox-row" id="pu"></div>
        </div>

        <div class="checkbox-group">
          <h4>roles</h4>
          <div class="checkbox-row" id="pr"></div>
        </div>

        <div class="checkbox-group">
          <h4>permisos</h4>
          <div class="checkbox-row" id="pp"></div>
        </div>

        <div class="perm-actions">
          <button class="btn btn-primary" id="btnGuardarP" type="button">guardar</button>
          <button class="btn btn-secondary" id="btnSeleccionarTodos" type="button">seleccionar todo</button>
          <button class="btn btn-secondary" id="btnDeseleccionarTodos" type="button">deseleccionar todo</button>
        </div>

        <div id="pMsg" style="margin-top: 1rem;"></div>
      </div>
    </div>
  `));

  $("#btnLogout").onclick = logoutTotal;
  startClock();

  const actions = ["ver", "crear", "editar", "eliminar"];

  function renderChecks(mod, elId) {
    $(elId).innerHTML = actions.map(a => `
      <div class="checkbox-item">
        <input type="checkbox" id="${mod}_${a}" />
        <label for="${mod}_${a}">${a}</label>
      </div>
    `).join("");
  }

  renderChecks("usuarios", "#pu");
  renderChecks("roles", "#pr");
  renderChecks("permisos", "#pp");

  const map = r.map || {};

  function loadRole(rolId) {
    const perms = new Set(map[String(rolId)] || []);
    ["usuarios", "roles", "permisos"].forEach(m => {
      actions.forEach(a => {
        const cb = $(`#${m}_${a}`);
        if (cb) cb.checked = perms.has(`${m}.${a}`);
      });
    });
  }

  $("#pRol").onchange = () => loadRole($("#pRol").value);
  loadRole($("#pRol").value);

  $("#btnSeleccionarTodos").onclick = () => {
    ["usuarios", "roles", "permisos"].forEach(m => actions.forEach(a => {
      const cb = $(`#${m}_${a}`);
      if (cb) cb.checked = true;
    }));
  };

  $("#btnDeseleccionarTodos").onclick = () => {
    ["usuarios", "roles", "permisos"].forEach(m => actions.forEach(a => {
      const cb = $(`#${m}_${a}`);
      if (cb) cb.checked = false;
    }));
  };

  $("#btnGuardarP").onclick = async () => {
    if (!hasPerm(me, "permisos", "editar") || !me.is_admin) {
      $("#pMsg").innerHTML = `<div class="message error">sin permiso para editar (solo admin)</div>`;
      return;
    }

    const rol_id = Number($("#pRol").value);
    const selected = [];
    ["usuarios", "roles", "permisos"].forEach(m => actions.forEach(a => {
      const cb = $(`#${m}_${a}`);
      if (cb && cb.checked) selected.push(`${m}.${a}`);
    }));

    const rr = await Api.permisos_set({ rol_id, perms: selected });
    $("#pMsg").innerHTML = `<div class="message ${rr.ok ? "success" : "error"}">${escapeHtml(rr.ok ? "guardado" : rr.error)}</div>`;

    if (rr.ok) {
      map[String(rol_id)] = selected;
      setTimeout(() => ($("#pMsg").innerHTML = ""), 2500);
    }
  };
}

async function logoutTotal() {
  await Api.logout();
  stopClock();
  history.replaceState(null, "", location.pathname + location.search + "#login");
  loginView(`<div class="message info">sesión cerrada</div>`);
}

async function router() {
  const meRes = await Api.me();
  const hash = (location.hash || "#login").replace("#", "");

  if (!meRes.ok) {
    loginView();
    return;
  }

  const me = meRes.me;

  if (hash === "login" || hash === "") {
    location.hash = "#dashboard";
    return router();
  }

  if (hash === "usuarios" && !hasAnyPerm(me, "usuarios")) {
    location.hash = "#dashboard";
    return router();
  }

  if (hash === "roles" && !hasAnyPerm(me, "roles")) {
    location.hash = "#dashboard";
    return router();
  }

  if (hash === "permisos" && !hasAnyPerm(me, "permisos")) {
    location.hash = "#dashboard";
    return router();
  }

  if (hash === "dashboard") return viewDashboard(me);
  if (hash === "usuarios") return viewUsuarios(me);
  if (hash === "roles") return viewRoles(me);
  if (hash === "permisos") return viewPermisos(me);

  location.hash = "#dashboard";
  return router();
}

document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("hashchange", router);
  router();
});

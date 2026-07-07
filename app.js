/* =========================================================
   NBC Plant Property Removal — app.js
   Firebase Firestore + Auth + Cloudinary
   ========================================================= */

// ---------- Firebase config ----------
const firebaseConfig = {
  apiKey: "AIzaSyCHMYRJ42snU4pF-7w66QroXF9tG_4PcsE",
  authDomain: "nbc-property-removal.firebaseapp.com",
  projectId: "nbc-property-removal",
  storageBucket: "nbc-property-removal.firebasestorage.app",
  messagingSenderId: "522200636163",
  appId: "1:522200636163:web:7f787f46af7770db56e736"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---------- EmailJS (notification emails) ----------
// TODO: replace these 3 values after Jay signs up at emailjs.com (see setup guide in chat)
const EMAILJS_PUBLIC_KEY = "3sGt-ZuFOKnhOCi4E";
const EMAILJS_SERVICE_ID = "service_zmwbtqh";
const EMAILJS_TEMPLATE_ID = "template_ko6gf6c";

if (window.emailjs && EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY") {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

async function sendNotifyEmail(toEmail, toName, subject, message, passNo) {
  if (!toEmail) return;
  if (EMAILJS_SERVICE_ID === "YOUR_SERVICE_ID") {
    console.warn("EmailJS not configured yet — skipping email:", subject, "to", toEmail);
    return;
  }
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: toEmail,
      to_name: toName || toEmail,
      subject: subject,
      message: message,
      pass_no: passNo || "",
      link: window.location.origin + window.location.pathname
    });
  } catch (e) {
    console.error("Email send failed:", e);
  }
}

// ---------- Cloudinary ----------
const CLOUDINARY_CLOUD_NAME = "yv2qgreu";
const CLOUDINARY_UPLOAD_PRESET = "nbc_property_removal";

async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  fd.append("folder", "nbc_property_removal");
  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url;
}

// ---------- Static reference data (seeded to Firestore on first admin login) ----------
const DEPARTMENTS = [
  { id: "administration", name_th: "Administration", l1_email: "thippawan_sonmahachan@natureworkspla.com", l1_name: "Thippawan Sonmahachan" },
  { id: "ehs", name_th: "EHS", l1_email: "kulitsara_kralam@natureworkspla.com", l1_name: "Kulitsara Kralam" },
  { id: "fermentation_lab", name_th: "Fermentation Lab", l1_email: "nantana_intanil@natureworkspla.com", l1_name: "Nantana Intanil" },
  { id: "hr", name_th: "HR", l1_email: "tassaneewan_surapraseart@natureworkspla.com", l1_name: "Tassaneewan Surapraseart" },
  { id: "it", name_th: "IT", l1_email: "amornthep_phueakphibool@natureworkspla.com", l1_name: "Amornthep Phueakphibool" },
  { id: "maintenance_reliability", name_th: "Maintenance & Reliability", l1_email: "warakorn_nuntaya@natureworkspla.com", l1_name: "Warakorn Nuntaya" },
  { id: "production", name_th: "Production", l1_email: "waron_sasipaworamet@natureworkspla.com", l1_name: "Waron Sasipaworamet" },
  { id: "qa_qc", name_th: "QA/QC", l1_email: "nantana_intanil@natureworkspla.com", l1_name: "Nantana Intanil" },
  { id: "warehouse", name_th: "Warehouse", l1_email: "puthapon_sookjit@natureworkspla.com", l1_name: "Puthapon Sookjit" }
];

const REMOVAL_TYPES = [
  { id: "repair", th: "ซ่อม", en: "Repair", requires_return: true },
  { id: "calibration", th: "สอบเทียบ", en: "Calibration", requires_return: true },
  { id: "return_vendor", th: "คืนผู้ให้บริการ", en: "Return to Vendor", requires_return: false },
  { id: "external_testing", th: "ทดสอบภายนอก", en: "External Testing", requires_return: true },
  { id: "disposal", th: "ส่งกำจัด", en: "Disposal", requires_return: false },
  { id: "sale", th: "ขายออก", en: "Sale", requires_return: false },
  { id: "other", th: "อื่นๆ", en: "Other", requires_return: true }
];

const UNITS = ["ชิ้น", "กล่อง", "ม้วน", "เครื่อง", "ใบ", "ชุด", "อัน", "กก."];

const L2_APPROVERS = [
  { email: "mike_bassett@natureworksllc.com", name: "Mike Bassett" },
  { email: "sirisak_charoenkitpeeti@natureworkspla.com", name: "Sirisak Charoenkitpeeti" },
  { email: "sippakorn_rattanaphun@natureworkspla.com", name: "Sippakorn Rattanaphun" }
];

// email(lowercase) -> profile
const APPROVER_DIRECTORY = {
  "kannikar.thaicharoen@gmail.com": { name: "Kannikar Thaicharoen", roles: ["admin", "test_admin", "return_confirmer"], dashboard: "all" },
  "kannikar_thaicharoen@natureworkspla.com": { name: "Kannikar Thaicharoen (NW)", roles: ["admin", "test_admin", "return_confirmer"], dashboard: "all" },
  "kulitsara_kralam@natureworkspla.com": { name: "Kulitsara Kralam", roles: ["dept_manager", "admin", "return_confirmer"], department: "ehs", dashboard: "all" },
  "naowadee_kotwit@natureworkspla.com": { name: "Naowadee Kotwit", roles: ["admin", "return_confirmer"], dashboard: "all" },
  "monthean_sathirayakorn@natureworkspla.com": { name: "Monthean Sathirayakorn", roles: ["admin", "return_confirmer"], dashboard: "all" },
  "mike_bassett@natureworksllc.com": { name: "Mike Bassett", roles: ["l2_approver"], dashboard: "none" },
  "sirisak_charoenkitpeeti@natureworkspla.com": { name: "Sirisak Charoenkitpeeti", roles: ["l2_approver"], dashboard: "none" },
  "sippakorn_rattanaphun@natureworkspla.com": { name: "Sippakorn Rattanaphun", roles: ["l2_approver"], dashboard: "none" },
  "thippawan_sonmahachan@natureworkspla.com": { name: "Thippawan Sonmahachan", roles: ["dept_manager"], department: "administration", dashboard: "own_dept" },
  "nantana_intanil@natureworkspla.com": { name: "Nantana Intanil", roles: ["dept_manager"], department: ["fermentation_lab", "qa_qc"], dashboard: "own_dept" },
  "waron_sasipaworamet@natureworkspla.com": { name: "Waron Sasipaworamet", roles: ["dept_manager"], department: "production", dashboard: "own_dept" },
  "warakorn_nuntaya@natureworkspla.com": { name: "Warakorn Nuntaya", roles: ["dept_manager"], department: "maintenance_reliability", dashboard: "own_dept" },
  "tassaneewan_surapraseart@natureworkspla.com": { name: "Tassaneewan Surapraseart", roles: ["dept_manager"], department: "hr", dashboard: "own_dept" },
  "puthapon_sookjit@natureworkspla.com": { name: "Puthapon Sookjit", roles: ["dept_manager"], department: "warehouse", dashboard: "own_dept" },
  "amornthep_phueakphibool@natureworkspla.com": { name: "Amornthep Phueakphibool", roles: ["dept_manager"], department: "it", dashboard: "own_dept" },
  "nbc_guardhouse@natureworkspla.com": { name: "รปภ. (Guardhouse)", roles: ["security"], dashboard: "none" }
};

const STATUS_LABEL = {
  pending_l1: "รออนุมัติ (ขั้น 1)",
  pending_l2: "รออนุมัติ (ขั้น 2)",
  approved: "อนุมัติ",
  issued: "ออกแล้ว",
  pending_return: "แจ้งนำกลับ (รอตรวจสอบ)",
  returned: "คืนแล้ว",
  rejected: "ปฏิเสธ"
};

const ALLOWED_EMAIL_DOMAINS = ["natureworkspla.com", "natureworksllc.com", "gmail.com"];

// ---------- Global state ----------
let currentUser = null;      // firebase auth user
let currentProfile = null;   // {name, roles, department, dashboard, email}
let allPasses = [];          // cache of pass docs
let unsubPasses = null;
let currentTab = "passes";
let currentSubFilter = "all";
let itemCounter = 0;
let newRequestItems = [];    // [{id, name, qty, unit, note, photoUrl, uploading}]

// =========================================================
// AUTH
// =========================================================
function toggleAuthMode(mode) {
  document.getElementById("authMsg").classList.add("hidden");
  if (mode === "signup") {
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("signupForm").classList.remove("hidden");
    document.getElementById("authTitle").textContent = "สมัครใช้งาน";
  } else {
    document.getElementById("signupForm").classList.add("hidden");
    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("authTitle").textContent = "เข้าสู่ระบบ";
  }
}

function showAuthMsg(msg, type) {
  const el = document.getElementById("authMsg");
  el.textContent = msg;
  el.className = "authMsg " + (type === "err" ? "err" : "ok");
  el.classList.remove("hidden");
}

function emailDomainOk(email) {
  const d = email.split("@")[1] || "";
  return ALLOWED_EMAIL_DOMAINS.includes(d.toLowerCase());
}

async function doLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const pw = document.getElementById("loginPassword").value;
  if (!email || !pw) { showAuthMsg("กรอก Email และ Password ให้ครบ", "err"); return; }
  const btn = document.getElementById("btnLogin");
  btn.disabled = true; btn.innerHTML = '<span class="loadingSpin"></span>กำลังเข้าสู่ระบบ...';
  try {
    await auth.signInWithEmailAndPassword(email, pw);
  } catch (e) {
    showAuthMsg(translateAuthErr(e), "err");
  } finally {
    btn.disabled = false; btn.textContent = "เข้าสู่ระบบ";
  }
}

async function doSignup() {
  const name = document.getElementById("suName").value.trim();
  const email = document.getElementById("suEmail").value.trim();
  const pw = document.getElementById("suPassword").value;
  if (!name || !email || !pw) { showAuthMsg("กรอกข้อมูลให้ครบ", "err"); return; }
  if (!emailDomainOk(email)) { showAuthMsg("กรุณาใช้ Email บริษัท (@natureworkspla.com)", "err"); return; }
  if (pw.length < 6) { showAuthMsg("Password ต้องมีอย่างน้อย 6 ตัวอักษร", "err"); return; }
  const btn = document.getElementById("btnSignup");
  btn.disabled = true; btn.innerHTML = '<span class="loadingSpin"></span>กำลังสมัคร...';
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pw);
    await cred.user.updateProfile({ displayName: name });
    await db.collection("users").doc(email.toLowerCase()).set({
      name, email: email.toLowerCase(), created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    showAuthMsg(translateAuthErr(e), "err");
  } finally {
    btn.disabled = false; btn.textContent = "สมัครใช้งาน";
  }
}

function translateAuthErr(e) {
  const code = e.code || "";
  if (code.includes("email-already-in-use")) return "Email นี้ถูกใช้สมัครแล้ว กรุณาเข้าสู่ระบบแทน";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Email หรือ Password ไม่ถูกต้อง";
  if (code.includes("user-not-found")) return "ไม่พบบัญชีนี้ กรุณาสมัครใช้งานก่อน";
  if (code.includes("invalid-email")) return "รูปแบบ Email ไม่ถูกต้อง";
  if (code.includes("weak-password")) return "Password ควรมีอย่างน้อย 6 ตัวอักษร";
  return "เกิดข้อผิดพลาด: " + (e.message || code);
}

function doLogout() {
  if (unsubPasses) unsubPasses();
  auth.signOut();
}

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    const email = (user.email || "").toLowerCase();
    let name = user.displayName || email;
    const dirEntry = APPROVER_DIRECTORY[email];
    if (dirEntry) {
      currentProfile = { email, name: dirEntry.name, roles: dirEntry.roles, department: dirEntry.department, dashboard: dirEntry.dashboard };
    } else {
      // general requester — try to load their signup name
      let displayName = name;
      try {
        const udoc = await db.collection("users").doc(email).get();
        if (udoc.exists) displayName = udoc.data().name || displayName;
      } catch (e) {}
      currentProfile = { email, name: displayName, roles: ["requester"], department: null, dashboard: "none" };
    }
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appShell").style.display = "flex";
    document.getElementById("ubName").textContent = currentProfile.name;
    document.getElementById("ubRole").textContent = roleLabel(currentProfile.roles);
    document.getElementById("adminTabBtn").style.display = currentProfile.roles.includes("test_admin") ? "" : "none";
    applyTabVisibility();
    listenToPasses();
    switchTab(defaultTabFor(currentProfile));
  } else {
    currentUser = null; currentProfile = null;
    if (unsubPasses) { unsubPasses(); unsubPasses = null; }
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("appShell").style.display = "none";
  }
});

function roleLabel(roles) {
  if (roles.includes("test_admin")) return "Test Admin";
  if (roles.includes("admin")) return "Admin / EHS";
  if (roles.includes("l2_approver")) return "ผู้อนุมัติขั้น 2";
  if (roles.includes("dept_manager")) return "Department Manager";
  if (roles.includes("security")) return "Security / รปภ.";
  return "ผู้ขอทั่วไป (Requester)";
}

function defaultTabFor(profile) {
  if (profile.roles.includes("security")) return "passes";
  return "passes";
}

function applyTabVisibility() {
  const showDash = currentProfile.dashboard !== "none";
  const btn = document.querySelector('#mainTabs button[data-tab="dashboard"]');
  btn.style.display = showDash ? "" : "none";
}

// =========================================================
// TAB SWITCHING
// =========================================================
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll("#mainTabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  ["passes", "newrequest", "tracking", "dashboard", "admin"].forEach(t => {
    document.getElementById("view-" + t).classList.toggle("hidden", t !== tab);
  });
  if (tab === "passes") renderPassesView();
  if (tab === "newrequest") renderNewRequestView();
  if (tab === "tracking") renderTrackingView();
  if (tab === "dashboard") renderDashboardView();
  if (tab === "admin") renderAdminView();
}

// =========================================================
// FIRESTORE LISTENERS
// =========================================================
function listenToPasses() {
  if (unsubPasses) unsubPasses();
  unsubPasses = db.collection("passes").orderBy("created_at", "desc").onSnapshot(snap => {
    allPasses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentTab === "passes") renderPassesView();
    if (currentTab === "tracking") renderTrackingView();
    if (currentTab === "dashboard") renderDashboardView();
  }, err => {
    console.error(err);
    showToast("โหลดข้อมูลไม่สำเร็จ: " + err.message, "err");
  });
}

// =========================================================
// HELPERS
// =========================================================
function showToast(msg, type) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = type === "err" ? "err" : (type === "ok" ? "ok" : "");
  t.style.display = "block";
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { t.style.display = "none"; }, 3200);
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function fmtDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function deptNameById(id) {
  const d = DEPARTMENTS.find(x => x.id === id);
  return d ? d.name_th : id;
}

function removalTypeById(id) {
  return REMOVAL_TYPES.find(x => x.id === id) || null;
}

function openLightbox(url) {
  document.getElementById("lbImg").src = url;
  document.getElementById("lbDownload").href = url;
  document.getElementById("lightbox").style.display = "flex";
}
function closeLightbox() { document.getElementById("lightbox").style.display = "none"; }

function visibleDeptIdsForCurrentUser() {
  const dep = currentProfile.department;
  if (!dep) return [];
  return Array.isArray(dep) ? dep : [dep];
}

// Passes visible to current user according to permission matrix
function getVisiblePasses(list) {
  const roles = currentProfile.roles;
  if (roles.includes("test_admin") || roles.includes("admin") || roles.includes("security") || roles.includes("requester")) {
    return list; // see all
  }
  if (roles.includes("dept_manager")) {
    const depts = visibleDeptIdsForCurrentUser();
    return list.filter(p => depts.includes(p.requester_dept));
  }
  if (roles.includes("l2_approver")) {
    return list.filter(p => p.approver_l2_email === currentProfile.email);
  }
  return list;
}

// PASSES LIST VIEW rendering, new request form, detail modal, tracking, dashboard, admin views appended below.

function renderPassesView() {
  const el = document.getElementById("view-passes");
  const roles = currentProfile.roles;
  const subtabs = [{ id: "all", label: "All / ทั้งหมด" }];
  if (roles.includes("dept_manager") || roles.includes("admin") || roles.includes("test_admin")) {
    subtabs.push({ id: "pending_approval", label: "Pending Approval / รอฉัน (ผจก.)" });
  }
  if (roles.includes("l2_approver") || roles.includes("admin") || roles.includes("test_admin")) {
    subtabs.push({ id: "my_approval", label: "My Approval / รออนุมัติ" });
  }
  if (roles.includes("security") || roles.includes("admin") || roles.includes("test_admin")) {
    subtabs.push({ id: "security_check", label: "Security Check / รปภ." });
  }

  let visible = getVisiblePasses(allPasses);

  if (currentSubFilter === "pending_approval") {
    const depts = visibleDeptIdsForCurrentUser();
    visible = allPasses.filter(p => (p.status === "pending_l1" || p.ext_status === "pending_l1") && (depts.includes(p.requester_dept) || roles.includes("admin") || roles.includes("test_admin")));
  } else if (currentSubFilter === "my_approval") {
    visible = allPasses.filter(p => (p.status === "pending_l2" || p.ext_status === "pending_l2") && (p.approver_l2_email === currentProfile.email || roles.includes("admin") || roles.includes("test_admin")));
  } else if (currentSubFilter === "security_check") {
    visible = allPasses.filter(p => p.status === "approved" || (p.status === "pending_return" && p.requires_return));
  }

  const search = (document.getElementById("passSearch") ? document.getElementById("passSearch").value : "").trim().toLowerCase();
  const statusFilter = document.getElementById("passStatusFilter") ? document.getElementById("passStatusFilter").value : "all";
  if (search) {
    visible = visible.filter(p =>
      (p.pass_no || "").toLowerCase().includes(search) ||
      (p.requester_name || "").toLowerCase().includes(search) ||
      deptNameById(p.requester_dept).toLowerCase().includes(search)
    );
  }
  if (statusFilter !== "all") visible = visible.filter(p => p.status === statusFilter);

  let html = '<div class="subtabs">';
  subtabs.forEach(t => {
    html += '<button class="' + (currentSubFilter === t.id ? "active" : "") + '" onclick="setSubFilter(\'' + t.id + '\')">' + t.label + '</button>';
  });
  html += '</div>';

  html += '<div class="searchRow">' +
    '<input type="text" id="passSearch" placeholder="Search by pass no. / name / dept..." value="' + escapeHtml(search) + '" oninput="renderPassesView()">' +
    '<select id="passStatusFilter" onchange="renderPassesView()">' +
    '<option value="all"' + (statusFilter === "all" ? " selected" : "") + '>All / ทุกสถานะ</option>' +
    Object.keys(STATUS_LABEL).map(s => '<option value="' + s + '"' + (statusFilter === s ? " selected" : "") + '>' + STATUS_LABEL[s] + '</option>').join("") +
    '</select>' +
    '<button class="btnNew" onclick="switchTab(\'newrequest\')">+ New Request / สร้างคำขอ</button>' +
    '</div>';

  if (visible.length === 0) {
    html += '<div class="emptyState">ไม่พบรายการ / No passes found</div>';
  } else {
    visible.forEach(p => { html += passCardHtml(p); });
  }

  el.innerHTML = html;
}

function setSubFilter(id) { currentSubFilter = id; renderPassesView(); }

function passCardHtml(p) {
  const overdue = isOverdue(p);
  const badgeClass = overdue ? "overdue" : p.status;
  const badgeText = overdue ? "Overdue" : (STATUS_LABEL[p.status] || p.status);
  const rt = removalTypeById(p.removal_type);
  const extBadge = p.ext_status ? '<span class="badge pending_return" style="margin-left:6px;">ขอต่ออายุ ครั้งที่ ' + ((p.ext_count || 0) + 1) + '</span>' : "";
  return '<div class="passCard" onclick="openPassDetail(\'' + p.id + '\')">' +
    '<div class="row1">' +
    '<div>' +
    '<div class="passNo">' + escapeHtml(p.pass_no) + '</div>' +
    '<div class="who">' + escapeHtml(p.requester_name) + ' — ' + escapeHtml(deptNameById(p.requester_dept)) + '</div>' +
    '<div class="meta">' + (rt ? escapeHtml(rt.th) + "/" + escapeHtml(rt.en) : "") + (p.due_date ? " · Due: " + escapeHtml(p.due_date) : "") + '</div>' +
    '</div>' +
    '<div style="text-align:right;">' +
    '<span class="badge ' + badgeClass + '">' + badgeText + '</span>' + extBadge +
    '</div>' +
    '</div>' +
    '</div>';
}

function isOverdue(p) {
  if (!p.requires_return) return false;
  if (p.status !== "issued" && p.status !== "pending_return") return false;
  if (!p.due_date) return false;
  return new Date(p.due_date) < new Date(new Date().toDateString());
}

function renderNewRequestView() {
  newRequestItems = [{ id: ++itemCounter, name: "", qty: 1, unit: "", note: "", photoUrl: "", uploading: false }];
  const el = document.getElementById("view-newrequest");
  el.innerHTML =
    '<div class="formCard">' +
      '<h3>ข้อมูลผู้ขอ / Requester Information</h3>' +
      '<div class="grid2">' +
        '<div class="field"><label>แผนก *</label>' +
          '<select id="reqDept" onchange="onDeptChange()">' +
            '<option value="">เลือกแผนก</option>' +
            DEPARTMENTS.map(d => '<option value="' + d.id + '">' + d.name_th + '</option>').join("") +
          '</select>' +
        '</div>' +
        '<div class="field"><label>ชื่อผู้ขอ *</label><input type="text" id="reqName" placeholder="ชื่อ-นามสกุล" value="' + escapeHtml(currentProfile.name) + '"></div>' +
        '<div class="field"><label>เบอร์โทร</label><input type="text" id="reqPhone" placeholder="08x-xxx-xxxx"></div>' +
        '<div class="field"><label>วัตถุประสงค์ในการนำออก *</label>' +
          '<select id="reqPurpose" onchange="onPurposeChange()">' +
            '<option value="">เลือกวัตถุประสงค์</option>' +
            REMOVAL_TYPES.map(r => '<option value="' + r.id + '">' + r.th + ' / ' + r.en + '</option>').join("") +
          '</select>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="formCard">' +
      '<h3>รายละเอียดการนำออก / Removal Details</h3>' +
      '<div class="grid2">' +
        '<div class="field"><label>ปลายทาง</label><input type="text" id="reqDestination" placeholder="สถานที่ปลายทาง"></div>' +
        '<div class="field"><label>ทะเบียนรถ</label><input type="text" id="reqVehicle" placeholder="1กข-1234"></div>' +
        '<div class="field"><label>ผู้อนุมัติขั้น 1 (อัตโนมัติตามแผนก)</label>' +
          '<div class="readonlyBox" id="reqL1Box">— เลือกแผนกก่อน —</div>' +
        '</div>' +
        '<div class="field"><label>ผู้อนุมัติขั้น 2 *</label>' +
          '<select id="reqL2">' +
            '<option value="">เลือกผู้อนุมัติขั้น 2</option>' +
            L2_APPROVERS.map(a => '<option value="' + a.email + '">' + a.name + '</option>').join("") +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="field" id="dueDateWrap" style="margin-top:14px;display:none;">' +
        '<label>กำหนดวันนำกลับ (Due date)</label>' +
        '<input type="date" id="reqDueDate">' +
      '</div>' +
      '<div class="field" style="margin-top:14px;"><label>หมายเหตุ</label><textarea id="reqNote" rows="2" placeholder="หมายเหตุเพิ่มเติม..."></textarea></div>' +
    '</div>' +

    '<div class="formCard">' +
      '<h3>รายการของ / Items <span style="font-weight:400;color:var(--muted);font-size:12px;">— ต้องแนบรูปถ่ายของทุกรายการ *</span></h3>' +
      '<div id="itemsContainer"></div>' +
      '<button class="addItemBtn" onclick="addItemRow()">+ เพิ่มรายการ</button>' +
    '</div>' +

    '<div class="formActions">' +
      '<button class="btnPrimary" style="width:auto;" id="btnSubmitRequest" onclick="submitNewRequest()">ส่งคำขอ / Submit</button>' +
      '<button class="btnGhost" onclick="switchTab(\'passes\')">ยกเลิก / Cancel</button>' +
    '</div>';
  renderItemRows();
}

function onDeptChange() {
  const deptId = document.getElementById("reqDept").value;
  const dept = DEPARTMENTS.find(d => d.id === deptId);
  document.getElementById("reqL1Box").textContent = dept ? (dept.l1_name + " (" + dept.name_th + ")") : "— เลือกแผนกก่อน —";
}

function onPurposeChange() {
  const rt = removalTypeById(document.getElementById("reqPurpose").value);
  document.getElementById("dueDateWrap").style.display = (rt && rt.requires_return) ? "" : "none";
}

function addItemRow() {
  newRequestItems.push({ id: ++itemCounter, name: "", qty: 1, unit: "", note: "", photoUrl: "", uploading: false });
  renderItemRows();
}
function removeItemRow(id) {
  newRequestItems = newRequestItems.filter(i => i.id !== id);
  renderItemRows();
}

function renderItemRows() {
  const c = document.getElementById("itemsContainer");
  c.innerHTML = newRequestItems.map((it, idx) => {
    return '<div class="itemBlock">' +
      (newRequestItems.length > 1 ? '<button class="removeItem" onclick="removeItemRow(' + it.id + ')">✕ ลบ</button>' : "") +
      '<div class="itemTitle">รายการที่ ' + (idx + 1) + '</div>' +
      '<div class="grid2">' +
        '<div class="field"><label>ชื่อของ *</label><input type="text" value="' + escapeHtml(it.name) + '" oninput="updateItemField(' + it.id + ',\'name\',this.value)" placeholder="ชื่ออุปกรณ์/ของ"></div>' +
        '<div class="grid2" style="gap:10px;">' +
          '<div class="field"><label>จำนวน</label><input type="number" min="1" value="' + it.qty + '" oninput="updateItemField(' + it.id + ',\'qty\',this.value)"></div>' +
          '<div class="field"><label>หน่วย</label><select onchange="updateItemField(' + it.id + ',\'unit\',this.value)">' +
            '<option value="">เลือกหน่วย</option>' +
            UNITS.map(u => '<option value="' + u + '"' + (it.unit === u ? " selected" : "") + '>' + u + '</option>').join("") +
          '</select></div>' +
        '</div>' +
      '</div>' +
      '<div class="field" style="margin-top:10px;">' +
        '<label>รูปถ่ายของ *</label>' +
        '<div class="photoUpload" onclick="document.getElementById(\'file_' + it.id + '\').click()">' +
          (it.uploading ? '<div class="icon">⏳</div><div class="lbl">กำลังอัปโหลด...</div>' :
            it.photoUrl ? '<img src="' + it.photoUrl + '">' :
            '<div class="icon">📷</div><div class="lbl">ถ่ายรูป / Upload photo</div>') +
        '</div>' +
        '<input type="file" id="file_' + it.id + '" accept="image/*" capture="environment" class="hidden" onchange="onItemPhotoSelected(' + it.id + ', this.files[0])">' +
      '</div>' +
      '<div class="field" style="margin-top:10px;"><label>หมายเหตุรายการ</label><input type="text" value="' + escapeHtml(it.note) + '" oninput="updateItemField(' + it.id + ',\'note\',this.value)" placeholder="หมายเหตุ (ถ้ามี)"></div>' +
    '</div>';
  }).join("");
}

function updateItemField(id, field, value) {
  const it = newRequestItems.find(i => i.id === id);
  if (!it) return;
  it[field] = field === "qty" ? Number(value) : value;
}

async function onItemPhotoSelected(id, file) {
  if (!file) return;
  const it = newRequestItems.find(i => i.id === id);
  it.uploading = true;
  renderItemRows();
  try {
    const url = await uploadToCloudinary(file);
    it.photoUrl = url;
  } catch (e) {
    showToast("อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง", "err");
  } finally {
    it.uploading = false;
    renderItemRows();
  }
}

async function getNextPassNo() {
  const beYear = new Date().getFullYear() + 543;
  const counterRef = db.collection("counters").doc("GP-" + beYear);
  const seq = await db.runTransaction(async (tx) => {
    const doc = await tx.get(counterRef);
    const next = doc.exists ? (doc.data().seq || 0) + 1 : 1;
    tx.set(counterRef, { seq: next });
    return next;
  });
  return "GP-" + beYear + "-" + String(seq).padStart(4, "0");
}

async function submitNewRequest() {
  const dept = document.getElementById("reqDept").value;
  const name = document.getElementById("reqName").value.trim();
  const phone = document.getElementById("reqPhone").value.trim();
  const purpose = document.getElementById("reqPurpose").value;
  const destination = document.getElementById("reqDestination").value.trim();
  const vehicle = document.getElementById("reqVehicle").value.trim();
  const l2email = document.getElementById("reqL2").value;
  const note = document.getElementById("reqNote").value.trim();
  const dueDate = document.getElementById("reqDueDate") ? document.getElementById("reqDueDate").value : "";

  if (!dept) return showToast("กรุณาเลือกแผนก", "err");
  if (!name) return showToast("กรุณากรอกชื่อผู้ขอ", "err");
  if (!purpose) return showToast("กรุณาเลือกวัตถุประสงค์", "err");
  if (!l2email) return showToast("กรุณาเลือกผู้อนุมัติขั้น 2", "err");
  if (newRequestItems.length === 0) return showToast("กรุณาเพิ่มรายการของอย่างน้อย 1 รายการ", "err");
  for (const it of newRequestItems) {
    if (!it.name.trim()) return showToast("กรุณากรอกชื่อของให้ครบทุกรายการ", "err");
    if (!it.photoUrl) return showToast("กรุณาแนบรูปถ่ายของให้ครบทุกรายการ", "err");
    if (it.uploading) return showToast("กรุณารอให้อัปโหลดรูปเสร็จก่อน", "err");
  }

  const rt = removalTypeById(purpose);
  const deptObj = DEPARTMENTS.find(d => d.id === dept);
  const l2 = L2_APPROVERS.find(a => a.email === l2email);

  const btn = document.getElementById("btnSubmitRequest");
  btn.disabled = true; btn.innerHTML = '<span class="loadingSpin"></span>กำลังส่งคำขอ...';

  try {
    const passNo = await getNextPassNo();
    await db.collection("passes").add({
      pass_no: passNo,
      requester_name: name,
      requester_dept: dept,
      requester_phone: phone,
      requester_email: currentProfile.email,
      purpose_th: rt.th, purpose_en: rt.en, removal_type: rt.id, requires_return: rt.requires_return,
      destination: destination, vehicle_plate: vehicle,
      approver_l1_email: deptObj.l1_email, approver_l1_name: deptObj.l1_name,
      approver_l2_email: l2.email, approver_l2_name: l2.name,
      note: note,
      due_date: dueDate || null,
      items: newRequestItems.map(i => ({ name: i.name, qty: i.qty, unit: i.unit, note: i.note, photo_url: i.photoUrl })),
      status: "pending_l1",
      ext_count: 0,
      ext_status: null,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("ส่งคำขอสำเร็จ (" + passNo + ")", "ok");
    sendNotifyEmail(
      deptObj.l1_email, deptObj.l1_name,
      "มีคำขอนำของออกใหม่รออนุมัติ - " + passNo,
      name + " (" + deptObj.name_th + ") ส่งคำขอนำของออก กรุณาเข้าระบบเพื่อตรวจสอบและอนุมัติขั้นที่ 1",
      passNo
    );
    switchTab("passes");
  } catch (e) {
    console.error(e);
    showToast("ส่งคำขอไม่สำเร็จ: " + e.message, "err");
  } finally {
    btn.disabled = false; btn.textContent = "ส่งคำขอ / Submit";
  }
}

function openPassDetail(id) {
  const p = allPasses.find(x => x.id === id);
  if (!p) return;
  const roles = currentProfile.roles;
  const isTestAdmin = roles.includes("test_admin") || roles.includes("admin");
  const canApproveL1 = (roles.includes("dept_manager") && visibleDeptIdsForCurrentUser().includes(p.requester_dept)) || isTestAdmin;
  const canApproveL2 = (roles.includes("l2_approver") && p.approver_l2_email === currentProfile.email) || isTestAdmin;
  const canSecurityOut = (roles.includes("security") || isTestAdmin) && p.status === "approved";
  const canConfirmReturn = (roles.includes("return_confirmer") || isTestAdmin) && p.status === "pending_return" && p.requires_return;
  const canNotifyReturn = (p.requester_email === currentProfile.email || isTestAdmin) && p.status === "issued" && p.requires_return && !p.ext_status;
  const canApproveExtL1 = (canApproveL1) && p.ext_status === "pending_l1";
  const canApproveExtL2 = (canApproveL2) && p.ext_status === "pending_l2";
  const canRequestExtension = (p.requester_email === currentProfile.email || isTestAdmin) && p.requires_return &&
    (p.status === "issued" || p.status === "pending_return") && !p.ext_status && (p.ext_count || 0) < 3;

  let actionsHtml = "";
  if (canApproveExtL1 || canApproveExtL2) {
    actionsHtml = extensionApprovalPanel(p, p.ext_status === "pending_l1" ? "l1" : "l2");
  } else if (p.status === "pending_l1" && canApproveL1) {
    actionsHtml = actionButtons(p.id, "l1");
  } else if (p.status === "pending_l2" && canApproveL2) {
    actionsHtml = actionButtons(p.id, "l2");
  } else if (canNotifyReturn || canRequestExtension) {
    actionsHtml = "";
    if (canNotifyReturn) {
      actionsHtml += '<div class="grid2">' +
        '<div class="field"><label>วันที่จะนำของกลับ *</label><input type="date" id="retNoticeDate"></div>' +
        '<div class="field"><label>เวลาโดยประมาณ *</label><input type="time" id="retNoticeTime"></div>' +
      '</div>' +
      '<div class="formActions"><button class="btnPrimary" style="width:auto;" onclick="submitReturnNotice(\'' + p.id + '\')">📩 แจ้งนำของกลับ / Notify Return</button></div>';
    }
    if (canRequestExtension) {
      actionsHtml += '<div style="margin-top:' + (canNotifyReturn ? "16px" : "0") + ';border-top:' + (canNotifyReturn ? "1px solid var(--border);padding-top:14px;" : "none") + '">' +
        '<div style="font-size:12.5px;color:var(--muted);margin-bottom:8px;">นำของกลับตามกำหนดไม่ได้? ขอขยายเวลาได้ (ใช้แล้ว ' + (p.ext_count || 0) + '/3 ครั้ง)</div>' +
        '<div class="field"><label>วันที่กำหนดคืนใหม่ที่ต้องการ *</label><input type="date" id="extNewDate"></div>' +
        '<div class="field"><label>เหตุผล *</label><input type="text" id="extReason" placeholder="เหตุผลที่ขอขยายเวลา"></div>' +
        '<div class="formActions"><button class="btnGhost" onclick="submitExtensionRequest(\'' + p.id + '\')">⏳ ขอขยายเวลานำกลับ</button></div>' +
      '</div>';
    }
  } else if (canSecurityOut) {
    actionsHtml = '<div class="field"><label>รูปถ่ายยืนยันการตรวจของก่อนนำออก (รปภ.) *</label>' +
      '<div class="photoUpload" onclick="document.getElementById(\'secOutFile\').click()" id="secOutPreview">' +
        '<div class="icon">📷</div><div class="lbl">ถ่ายรูปยืนยัน</div>' +
      '</div>' +
      '<input type="file" id="secOutFile" accept="image/*" capture="environment" class="hidden" onchange="onSecurityPhoto(this.files[0])">' +
    '</div>' +
    '<div class="formActions"><button class="btnSuccess" id="btnSecOut" onclick="confirmSecurityOut(\'' + p.id + '\')">✔ ยืนยันตรวจของ & ออกแล้ว</button></div>';
  } else if (canConfirmReturn) {
    actionsHtml = '<div class="field"><label>รูปถ่ายยืนยันการตรวจของตอนคืน (รปภ./EHS) *</label>' +
      '<div class="photoUpload" onclick="document.getElementById(\'secRetFile\').click()" id="secRetPreview">' +
        '<div class="icon">📷</div><div class="lbl">ถ่ายรูปยืนยัน</div>' +
      '</div>' +
      '<input type="file" id="secRetFile" accept="image/*" capture="environment" class="hidden" onchange="onReturnPhoto(this.files[0])">' +
    '</div>' +
    '<div class="formActions"><button class="btnSuccess" id="btnConfirmReturn" onclick="confirmReturn(\'' + p.id + '\')">✔ ยืนยันคืนของแล้ว</button></div>';
  }

  const itemsHtml = (p.items || []).map(it => {
    return '<div class="itemRowView">' +
      '<img src="' + it.photo_url + '" onclick="openLightbox(\'' + it.photo_url + '\')">' +
      '<div class="info"><div class="n">' + escapeHtml(it.name) + '</div><div class="m">' + (it.qty || "") + ' ' + escapeHtml(it.unit || "") + (it.note ? " · " + escapeHtml(it.note) : "") + '</div></div>' +
    '</div>';
  }).join("") || '<div style="color:var(--muted);font-size:13px;">ไม่มีรายการ</div>';

  let securityPhotosHtml = "";
  if (p.security_out_photo_url) {
    securityPhotosHtml += '<div class="itemRowView"><img src="' + p.security_out_photo_url + '" onclick="openLightbox(\'' + p.security_out_photo_url + '\')"><div class="info"><div class="n">รูปตอนออก (Security)</div><div class="m">' + fmtDate(p.security_out_at) + '</div></div></div>';
  }
  if (p.return_photo_url) {
    securityPhotosHtml += '<div class="itemRowView"><img src="' + p.return_photo_url + '" onclick="openLightbox(\'' + p.return_photo_url + '\')"><div class="info"><div class="n">รูปตอนคืน</div><div class="m">' + fmtDate(p.return_at) + '</div></div></div>';
  }

  const modalHtml =
  '<div class="modalOverlay" onclick="if(event.target.classList.contains(\'modalOverlay\'))closeModal()">' +
    '<div class="modalBox">' +
      '<div class="modalHead">' +
        '<div>' +
          '<h2>' + escapeHtml(p.pass_no) + '</h2>' +
          '<span class="badge ' + (isOverdue(p) ? "overdue" : p.status) + '">' + (isOverdue(p) ? "Overdue" : (STATUS_LABEL[p.status] || p.status)) + '</span>' +
        '</div>' +
        '<button onclick="closeModal()">✕</button>' +
      '</div>' +

      '<div class="detailSection">' +
        '<h4>ข้อมูลผู้ขอ</h4>' +
        '<div class="kv"><span class="k">ชื่อผู้ขอ</span><span>' + escapeHtml(p.requester_name) + '</span></div>' +
        '<div class="kv"><span class="k">แผนก</span><span>' + escapeHtml(deptNameById(p.requester_dept)) + '</span></div>' +
        '<div class="kv"><span class="k">เบอร์โทร</span><span>' + escapeHtml(p.requester_phone || "-") + '</span></div>' +
        '<div class="kv"><span class="k">วัตถุประสงค์</span><span>' + escapeHtml(p.purpose_th) + ' / ' + escapeHtml(p.purpose_en) + '</span></div>' +
        '<div class="kv"><span class="k">ปลายทาง</span><span>' + escapeHtml(p.destination || "-") + '</span></div>' +
        '<div class="kv"><span class="k">ทะเบียนรถ</span><span>' + escapeHtml(p.vehicle_plate || "-") + '</span></div>' +
        (p.due_date ? '<div class="kv"><span class="k">กำหนดคืน</span><span>' + escapeHtml(p.due_date) + '</span></div>' : "") +
        (p.note ? '<div class="kv"><span class="k">หมายเหตุ</span><span>' + escapeHtml(p.note) + '</span></div>' : "") +
        (p.return_notice_date ? '<div class="kv"><span class="k">แจ้งนำกลับ</span><span>' + escapeHtml(p.return_notice_date) + ' ' + escapeHtml(p.return_notice_time || "") + '</span></div>' : "") +
      '</div>' +

      '<div class="detailSection">' +
        '<h4>ผู้อนุมัติ</h4>' +
        '<div class="kv"><span class="k">ขั้น 1</span><span>' + escapeHtml(p.approver_l1_name) + (p.l1_approved_at ? " ✔ " + fmtDate(p.l1_approved_at) : "") + '</span></div>' +
        '<div class="kv"><span class="k">ขั้น 2</span><span>' + escapeHtml(p.approver_l2_name) + (p.l2_approved_at ? " ✔ " + fmtDate(p.l2_approved_at) : "") + '</span></div>' +
        (p.status === "rejected" ? '<div class="kv"><span class="k">เหตุผลปฏิเสธ</span><span>' + escapeHtml(p.rejected_reason || "-") + '</span></div>' : "") +
      '</div>' +

      (p.requires_return ? '<div class="detailSection">' +
        '<h4>การขอขยายเวลานำกลับ</h4>' +
        '<div class="kv"><span class="k">ใช้สิทธิ์ขยายเวลาแล้ว</span><span>' + (p.ext_count || 0) + ' / 3 ครั้ง</span></div>' +
        (p.ext_status ? '<div class="kv"><span class="k">สถานะคำขอล่าสุด</span><span>รออนุมัติ' + (p.ext_status === "pending_l1" ? " ขั้น 1" : " ขั้น 2") + ' — ขอเปลี่ยนเป็น ' + escapeHtml(p.ext_requested_due_date || "-") + '</span></div>' : "") +
      '</div>' : "") +

      '<div class="detailSection">' +
        '<h4>รายการของ (' + (p.items || []).length + ')</h4>' +
        itemsHtml +
      '</div>' +

      (securityPhotosHtml ? '<div class="detailSection"><h4>ภาพยืนยันความปลอดภัย</h4>' + securityPhotosHtml + '</div>' : "") +

      (actionsHtml ? '<div class="detailSection">' + actionsHtml + '</div>' : "") +
    '</div>' +
  '</div>';
  document.getElementById("modalRoot").innerHTML = modalHtml;
  window._activePassId = p.id;
}

function actionButtons(passId, stage) {
  return '<div class="field"><label>เหตุผล (กรณีปฏิเสธ)</label><input type="text" id="rejectReason_' + stage + '" placeholder="ระบุเหตุผล..."></div>' +
  '<div class="formActions">' +
    '<button class="btnSuccess" onclick="approvePass(\'' + passId + '\',\'' + stage + '\')">✔ อนุมัติ / Approve</button>' +
    '<button class="btnDanger" onclick="rejectPass(\'' + passId + '\',\'' + stage + '\')">✕ ปฏิเสธ / Reject</button>' +
  '</div>';
}

function extensionApprovalPanel(p, stage) {
  return '<div style="background:var(--bg);border-radius:8px;padding:12px;margin-bottom:12px;">' +
    '<div style="font-size:12.5px;font-weight:700;color:var(--navy);margin-bottom:8px;">คำขอขยายเวลานำกลับ ครั้งที่ ' + ((p.ext_count || 0) + 1) + ' — ' + (stage === "l1" ? "รออนุมัติขั้น 1" : "รออนุมัติขั้น 2") + '</div>' +
    '<div class="kv"><span class="k">วันที่กำหนดเดิม</span><span>' + escapeHtml(p.due_date || "-") + '</span></div>' +
    '<div class="kv"><span class="k">วันที่ขอเปลี่ยนเป็น</span><span>' + escapeHtml(p.ext_requested_due_date || "-") + '</span></div>' +
    '<div class="kv"><span class="k">เหตุผล</span><span>' + escapeHtml(p.ext_reason || "-") + '</span></div>' +
  '</div>' +
  '<div class="field"><label>เหตุผล (กรณีปฏิเสธ)</label><input type="text" id="extRejectReason_' + stage + '" placeholder="ระบุเหตุผล..."></div>' +
  '<div class="formActions">' +
    '<button class="btnSuccess" onclick="approveExtension(\'' + p.id + '\',\'' + stage + '\')">✔ อนุมัติการขยายเวลา</button>' +
    '<button class="btnDanger" onclick="rejectExtension(\'' + p.id + '\',\'' + stage + '\')">✕ ปฏิเสธ</button>' +
  '</div>';
}

async function submitExtensionRequest(id) {
  const dateEl = document.getElementById("extNewDate");
  const reasonEl = document.getElementById("extReason");
  const newDate = dateEl ? dateEl.value : "";
  const reason = reasonEl ? reasonEl.value.trim() : "";
  if (!newDate) return showToast("กรุณาระบุวันที่กำหนดคืนใหม่ที่ต้องการ", "err");
  if (!reason) return showToast("กรุณาระบุเหตุผลที่ขอขยายเวลา", "err");
  const p = allPasses.find(x => x.id === id);
  try {
    await db.collection("passes").doc(id).update({
      ext_status: "pending_l1",
      ext_requested_due_date: newDate,
      ext_reason: reason,
      ext_requested_by: currentProfile.email,
      ext_requested_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("ส่งคำขอขยายเวลาแล้ว รอผู้อนุมัติขั้น 1", "ok");
    closeModal();
    if (p) {
      sendNotifyEmail(
        p.approver_l1_email, p.approver_l1_name,
        "มีคำขอขยายเวลานำของกลับ - " + p.pass_no,
        p.requester_name + " ขอขยายเวลานำของกลับ (ครั้งที่ " + ((p.ext_count || 0) + 1) + ") เป็นวันที่ " + newDate + " เหตุผล: " + reason,
        p.pass_no
      );
    }
  } catch (e) { showToast("เกิดข้อผิดพลาด: " + e.message, "err"); }
}

async function approveExtension(id, stage) {
  const p = allPasses.find(x => x.id === id);
  try {
    if (stage === "l1") {
      await db.collection("passes").doc(id).update({
        ext_status: "pending_l2",
        ext_l1_approved_at: firebase.firestore.FieldValue.serverTimestamp(),
        ext_l1_approved_by: currentProfile.email,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("อนุมัติขั้น 1 แล้ว รอผู้อนุมัติขั้น 2", "ok");
      if (p) {
        sendNotifyEmail(
          p.approver_l2_email, p.approver_l2_name,
          "รออนุมัติคำขอขยายเวลา ขั้น 2 - " + p.pass_no,
          p.requester_name + " ขอขยายเวลานำของกลับ เป็นวันที่ " + p.ext_requested_due_date + " รอการอนุมัติขั้นที่ 2 จากท่าน",
          p.pass_no
        );
        sendNotifyEmail(
          p.requester_email, p.requester_name,
          "คำขอขยายเวลาผ่านขั้น 1 แล้ว - " + p.pass_no,
          "คำขอขยายเวลานำของกลับผ่านการอนุมัติขั้นที่ 1 แล้ว กำลังรออนุมัติขั้นที่ 2",
          p.pass_no
        );
      }
    } else {
      const newCount = (p ? (p.ext_count || 0) : 0) + 1;
      await db.collection("passes").doc(id).update({
        due_date: p.ext_requested_due_date,
        ext_status: null,
        ext_count: newCount,
        ext_l2_approved_at: firebase.firestore.FieldValue.serverTimestamp(),
        ext_l2_approved_by: currentProfile.email,
        ext_requested_due_date: null,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("อนุมัติการขยายเวลาสำเร็จ (ครั้งที่ " + newCount + "/3)", "ok");
      if (p) {
        sendNotifyEmail(
          p.requester_email, p.requester_name,
          "ขยายเวลานำของกลับสำเร็จ - " + p.pass_no,
          "คำขอขยายเวลานำของกลับได้รับอนุมัติครบแล้ว วันที่กำหนดคืนใหม่: " + p.ext_requested_due_date + " (ใช้สิทธิ์ขยายเวลาไปแล้ว " + newCount + "/3 ครั้ง)",
          p.pass_no
        );
      }
    }
    closeModal();
  } catch (e) { showToast("เกิดข้อผิดพลาด: " + e.message, "err"); }
}

async function rejectExtension(id, stage) {
  const reason = document.getElementById("extRejectReason_" + stage).value.trim();
  if (!reason) return showToast("กรุณาระบุเหตุผลในการปฏิเสธ", "err");
  const p = allPasses.find(x => x.id === id);
  try {
    await db.collection("passes").doc(id).update({
      ext_status: null,
      ext_requested_due_date: null,
      ext_last_rejected_reason: reason,
      ext_last_rejected_stage: stage,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("ปฏิเสธคำขอขยายเวลาแล้ว", "ok");
    closeModal();
    if (p) {
      sendNotifyEmail(
        p.requester_email, p.requester_name,
        "คำขอขยายเวลาถูกปฏิเสธ - " + p.pass_no,
        "คำขอขยายเวลานำของกลับถูกปฏิเสธ เหตุผล: " + reason + " (วันที่กำหนดคืนเดิมยังคงอยู่: " + p.due_date + ")",
        p.pass_no
      );
    }
  } catch (e) { showToast("เกิดข้อผิดพลาด: " + e.message, "err"); }
}

function closeModal() { document.getElementById("modalRoot").innerHTML = ""; window._activePassId = null; }

async function approvePass(id, stage) {
  const p = allPasses.find(x => x.id === id);
  try {
    const update = { updated_at: firebase.firestore.FieldValue.serverTimestamp() };
    if (stage === "l1") {
      update.status = "pending_l2";
      update.l1_approved_at = firebase.firestore.FieldValue.serverTimestamp();
      update.l1_approved_by = currentProfile.email;
    } else {
      update.status = "approved";
      update.l2_approved_at = firebase.firestore.FieldValue.serverTimestamp();
      update.l2_approved_by = currentProfile.email;
    }
    await db.collection("passes").doc(id).update(update);
    showToast("อนุมัติสำเร็จ", "ok");
    closeModal();
    if (p) {
      if (stage === "l1") {
        sendNotifyEmail(
          p.approver_l2_email, p.approver_l2_name,
          "รออนุมัติขั้น 2 - " + p.pass_no,
          p.requester_name + " (" + deptNameById(p.requester_dept) + ") รอการอนุมัติขั้นที่ 2 จากท่าน กรุณาเข้าระบบเพื่อตรวจสอบ",
          p.pass_no
        );
        sendNotifyEmail(
          p.requester_email, p.requester_name,
          "คำขอผ่านอนุมัติขั้น 1 แล้ว - " + p.pass_no,
          "คำขอนำของออกของคุณผ่านการอนุมัติขั้นที่ 1 แล้ว กำลังรออนุมัติขั้นที่ 2 จาก " + p.approver_l2_name,
          p.pass_no
        );
      } else {
        sendNotifyEmail(
          p.requester_email, p.requester_name,
          "คำขอได้รับอนุมัติครบแล้ว - " + p.pass_no,
          "คำขอนำของออกของคุณได้รับอนุมัติครบทุกขั้นแล้ว พร้อมนำออกได้ (รอ รปภ. ตรวจของก่อนออกจากโรงงาน)",
          p.pass_no
        );
      }
    }
  } catch (e) { showToast("เกิดข้อผิดพลาด: " + e.message, "err"); }
}

async function rejectPass(id, stage) {
  const reason = document.getElementById("rejectReason_" + stage).value.trim();
  if (!reason) return showToast("กรุณาระบุเหตุผลในการปฏิเสธ", "err");
  const p = allPasses.find(x => x.id === id);
  try {
    await db.collection("passes").doc(id).update({
      status: "rejected",
      rejected_reason: reason,
      rejected_by: currentProfile.email,
      rejected_stage: stage,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("ปฏิเสธคำขอแล้ว", "ok");
    closeModal();
    if (p) {
      sendNotifyEmail(
        p.requester_email, p.requester_name,
        "คำขอถูกปฏิเสธ - " + p.pass_no,
        "คำขอนำของออกของคุณถูกปฏิเสธ เหตุผล: " + reason,
        p.pass_no
      );
    }
  } catch (e) { showToast("เกิดข้อผิดพลาด: " + e.message, "err"); }
}

let _secOutPhotoUrl = "", _returnPhotoUrl = "";

async function onSecurityPhoto(file) {
  if (!file) return;
  document.getElementById("secOutPreview").innerHTML = '<div class="icon">⏳</div><div class="lbl">กำลังอัปโหลด...</div>';
  try {
    _secOutPhotoUrl = await uploadToCloudinary(file);
    document.getElementById("secOutPreview").innerHTML = '<img src="' + _secOutPhotoUrl + '">';
  } catch (e) {
    showToast("อัปโหลดรูปไม่สำเร็จ", "err");
    document.getElementById("secOutPreview").innerHTML = '<div class="icon">📷</div><div class="lbl">ถ่ายรูปยืนยัน</div>';
  }
}

async function confirmSecurityOut(id) {
  if (!_secOutPhotoUrl) return showToast("กรุณาถ่ายรูปยืนยันก่อน", "err");
  const p = allPasses.find(x => x.id === id);
  try {
    await db.collection("passes").doc(id).update({
      status: "issued",
      security_out_photo_url: _secOutPhotoUrl,
      security_out_by: currentProfile.email,
      security_out_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("ยืนยันตรวจของและออกแล้ว", "ok");
    _secOutPhotoUrl = "";
    closeModal();
    if (p) {
      sendNotifyEmail(
        p.requester_email, p.requester_name,
        "ของออกจากโรงงานแล้ว - " + p.pass_no,
        "รปภ. ตรวจของและอนุญาตให้นำของออกจากโรงงานเรียบร้อยแล้ว" + (p.requires_return ? " อย่าลืมแจ้งนำของกลับในระบบเมื่อถึงกำหนด" : ""),
        p.pass_no
      );
    }
  } catch (e) { showToast("เกิดข้อผิดพลาด: " + e.message, "err"); }
}

async function submitReturnNotice(id) {
  const dateEl = document.getElementById("retNoticeDate");
  const timeEl = document.getElementById("retNoticeTime");
  const date = dateEl ? dateEl.value : "";
  const time = timeEl ? timeEl.value : "";
  if (!date || !time) return showToast("กรุณาระบุวันที่และเวลาที่จะนำของกลับ", "err");
  try {
    await db.collection("passes").doc(id).update({
      status: "pending_return",
      return_notice_date: date,
      return_notice_time: time,
      return_notice_by: currentProfile.email,
      return_notice_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("แจ้งนำของกลับสำเร็จ รอ รปภ./EHS ตรวจของ", "ok");
    closeModal();
  } catch (e) { showToast("เกิดข้อผิดพลาด: " + e.message, "err"); }
}

async function onReturnPhoto(file) {
  if (!file) return;
  document.getElementById("secRetPreview").innerHTML = '<div class="icon">⏳</div><div class="lbl">กำลังอัปโหลด...</div>';
  try {
    _returnPhotoUrl = await uploadToCloudinary(file);
    document.getElementById("secRetPreview").innerHTML = '<img src="' + _returnPhotoUrl + '">';
  } catch (e) {
    showToast("อัปโหลดรูปไม่สำเร็จ", "err");
    document.getElementById("secRetPreview").innerHTML = '<div class="icon">📷</div><div class="lbl">ถ่ายรูปยืนยัน</div>';
  }
}

async function confirmReturn(id) {
  if (!_returnPhotoUrl) return showToast("กรุณาถ่ายรูปยืนยันก่อน", "err");
  try {
    await db.collection("passes").doc(id).update({
      status: "returned",
      return_photo_url: _returnPhotoUrl,
      return_by: currentProfile.email,
      return_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("ยืนยันคืนของสำเร็จ", "ok");
    _returnPhotoUrl = "";
    closeModal();
  } catch (e) { showToast("เกิดข้อผิดพลาด: " + e.message, "err"); }
}

function renderTrackingView() {
  const el = document.getElementById("view-tracking");
  let list = getVisiblePasses(allPasses).filter(p => p.requires_return && (p.status === "issued" || p.status === "pending_return"));
  const overdue = list.filter(isOverdue);
  const notNotified = list.filter(p => p.status === "issued" && !isOverdue(p));
  const awaitingInspection = list.filter(p => p.status === "pending_return" && !isOverdue(p));
  const returnedCount = getVisiblePasses(allPasses).filter(p => p.requires_return && p.status === "returned").length;

  let html = '<div class="trackStats" style="grid-template-columns:repeat(4,1fr);">' +
    '<div class="statCard danger"><div class="num">' + overdue.length + '</div><div class="lbl">Overdue</div></div>' +
    '<div class="statCard warn"><div class="num">' + notNotified.length + '</div><div class="lbl">ยังไม่แจ้งคืน</div></div>' +
    '<div class="statCard"><div class="num">' + awaitingInspection.length + '</div><div class="lbl">รอตรวจสอบ</div></div>' +
    '<div class="statCard"><div class="num" style="color:var(--success)">' + returnedCount + '</div><div class="lbl">คืนแล้ว</div></div>' +
    '</div>';

  if (list.length === 0) {
    html += '<div class="emptyState">ไม่มีของที่ต้องนำกลับ / Nothing pending return</div>';
  } else {
    list.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
    list.forEach(p => { html += passCardHtml(p); });
  }
  el.innerHTML = html;
}

function renderDashboardView() {
  const el = document.getElementById("view-dashboard");
  let list = allPasses;
  if (currentProfile.dashboard === "own_dept") {
    const depts = visibleDeptIdsForCurrentUser();
    list = list.filter(p => depts.includes(p.requester_dept));
  }

  const total = list.length;
  const pendingApproval = list.filter(p => p.status === "pending_l1" || p.status === "pending_l2").length;
  const issued = list.filter(p => p.status === "issued").length;
  const overdueCount = list.filter(isOverdue).length;

  const statusOrder = ["pending_l1", "pending_l2", "approved", "issued", "pending_return", "returned", "rejected"];
  const statusColors = { pending_l1: "#E2A400", pending_l2: "#E07A1F", approved: "#2F6FED", issued: "#1F497D", pending_return: "#7C5CE0", returned: "#2E8B57", rejected: "#D64545" };
  const statusCounts = {};
  statusOrder.forEach(s => statusCounts[s] = list.filter(p => p.status === s).length);
  const maxStatus = Math.max(1, Math.max.apply(null, Object.values(statusCounts)));

  const deptCounts = {};
  DEPARTMENTS.forEach(d => deptCounts[d.id] = 0);
  list.forEach(p => { if (deptCounts[p.requester_dept] !== undefined) deptCounts[p.requester_dept]++; });
  const maxDept = Math.max(1, Math.max.apply(null, Object.values(deptCounts)));

  el.innerHTML =
    '<div class="statGrid">' +
      '<div class="statCard"><div class="num">' + total + '</div><div class="lbl">ทั้งหมด</div></div>' +
      '<div class="statCard warn"><div class="num">' + pendingApproval + '</div><div class="lbl">รออนุมัติ</div></div>' +
      '<div class="statCard"><div class="num">' + issued + '</div><div class="lbl">ออกแล้ว</div></div>' +
      '<div class="statCard danger"><div class="num">' + overdueCount + '</div><div class="lbl">Overdue</div></div>' +
    '</div>' +
    '<div class="dashRow">' +
      '<div class="formCard">' +
        '<h3 style="margin-top:0;">ตามสถานะ</h3>' +
        statusOrder.map(s => '<div class="barRow"><span class="lbl">' + STATUS_LABEL[s] + '</span><div class="barTrack"><div class="barFill" style="width:' + (statusCounts[s] / maxStatus * 100) + '%;background:' + statusColors[s] + ';"></div></div><span class="barNum">' + statusCounts[s] + '</span></div>').join("") +
      '</div>' +
      '<div class="formCard">' +
        '<h3 style="margin-top:0;">ตามแผนก</h3>' +
        DEPARTMENTS.map(d => '<div class="barRow"><span class="lbl">' + d.name_th + '</span><div class="barTrack"><div class="barFill" style="width:' + (deptCounts[d.id] / maxDept * 100) + '%;"></div></div><span class="barNum">' + deptCounts[d.id] + '</span></div>').join("") +
      '</div>' +
    '</div>' +
    '<div style="margin-top:14px;text-align:right;"><button class="btnGhost" onclick="exportCsv()">⬇ Export CSV</button></div>';
}

function exportCsv() {
  let list = allPasses;
  if (currentProfile.dashboard === "own_dept") {
    const depts = visibleDeptIdsForCurrentUser();
    list = list.filter(p => depts.includes(p.requester_dept));
  }
  const headers = ["Pass No", "Requester", "Department", "Purpose", "Status", "Due Date", "Created At"];
  const rows = list.map(p => [
    p.pass_no, p.requester_name, deptNameById(p.requester_dept), p.purpose_en, STATUS_LABEL[p.status] || p.status, p.due_date || "", fmtDate(p.created_at)
  ]);
  let csv = headers.join(",") + "\n" + rows.map(r => r.map(v => '"' + String(v || "").replace(/"/g, '""') + '"').join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "property_removal_export_" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

function renderAdminView() {
  const el = document.getElementById("view-admin");
  el.innerHTML =
    '<div class="formCard">' +
      '<h3 style="margin-top:0;">ข้อมูลอ้างอิงระบบ (Read-only)</h3>' +
      '<p style="font-size:13px;color:var(--muted);">แผนก, ผู้อนุมัติ, ประเภทการนำออก, และหน่วยนับ ถูกกำหนดไว้ในตัวแอปโดยตรง หากต้องการแก้ไขรายชื่อผู้อนุมัติหรือแผนก แจ้ง Developer เพื่อแก้ไขใน app.js</p>' +
      '<h4>แผนก & ผู้อนุมัติขั้น 1</h4>' +
      DEPARTMENTS.map(d => '<div class="kv"><span class="k">' + d.name_th + '</span><span>' + d.l1_name + '</span></div>').join("") +
      '<h4 style="margin-top:16px;">ผู้อนุมัติขั้น 2</h4>' +
      L2_APPROVERS.map(a => '<div class="kv"><span class="k">' + a.name + '</span><span>' + a.email + '</span></div>').join("") +
    '</div>';
}

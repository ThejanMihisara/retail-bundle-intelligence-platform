import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import ConfirmModal from "../../components/shared/ConfirmModal";
import { BrandMark } from "../../components/shared/BrandLogo";
import { getUsers, updateUserRole, updateUserStatus, deleteUser } from "../../services/userManagementService";
import { getAccessRequests, approveAccessRequest, rejectAccessRequest, deleteAccessRequest } from "../../services/accessRequestService";
import { getModelStatus } from "../../services/modelService";
import { getMovementPredictions } from "../../services/productService";

const card = {
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: "1rem",
  backdropFilter: "blur(10px)",
  boxShadow: "var(--card-shadow)",
};

const ROLES = ["admin", "manager", "analyst", "viewer"];
const STATUSES = ["active", "suspended"];

const TAB_IDS = ["profile", "access-requests", "users", "model-info"];
const TAB_LABELS = ["Profile & Account", "Access Requests", "User Management", "Model Info"];
const ADMIN_TABS = new Set(["access-requests", "users"]);

const getApiErrorMessage = (error, fallback) => {
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg || item.message || JSON.stringify(item)).join(", ");
  if (detail && typeof detail === "object") return detail.message || JSON.stringify(detail);
  return fallback;
};

const RoleBadge = ({ role }) => {
  const styles = {
    admin: { bg: "rgba(239,68,68,0.12)", color: "#f87171", border: "rgba(239,68,68,0.22)" },
    manager: { bg: "rgba(16,185,129,0.12)", color: "var(--accent-green-text)", border: "rgba(16,185,129,0.22)" },
    analyst: { bg: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "rgba(99,102,241,0.22)" },
    viewer: { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", border: "rgba(148,163,184,0.22)" },
  };
  const s = styles[role] || styles.viewer;
  return (
    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {role}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const styles = {
    active: { bg: "rgba(16,185,129,0.1)", color: "var(--accent-green-text)", border: "rgba(16,185,129,0.2)" },
    invited: { bg: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "rgba(245,158,11,0.2)" },
    suspended: { bg: "rgba(239,68,68,0.1)", color: "#f87171", border: "rgba(239,68,68,0.2)" },
    pending: { bg: "rgba(99,102,241,0.1)", color: "#a5b4fc", border: "rgba(99,102,241,0.2)" },
    approved: { bg: "rgba(16,185,129,0.1)", color: "var(--accent-green-text)", border: "rgba(16,185,129,0.2)" },
    rejected: { bg: "rgba(239,68,68,0.1)", color: "#f87171", border: "rgba(239,68,68,0.2)" },
  };
  const s = styles[status] || styles.pending;
  return (
    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
};

const getReviewerLabel = (req) => {
  if (req.reviewed_by_name) return `by ${req.reviewed_by_name}`;
  if (req.reviewed_by) return "by Admin";
  return "—";
};

// ─── Profile Tab ─────────────────────────────────────────────────────────────
const ProfileTab = ({ user }) => (
  <div className="space-y-5">
    <div className="rounded-2xl p-6" style={card}>
      <h3 className="text-sm font-bold mb-5" style={{ color: "var(--text-primary)" }}>Account Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          { label: "Full Name", value: user?.full_name || "—" },
          { label: "Email", value: user?.email || "—" },
          { label: "Role", value: <RoleBadge role={user?.role} /> },
          { label: "Status", value: <StatusBadge status={user?.status} /> },
          { label: "Account Created", value: user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : "—" },
          { label: "Last Login", value: user?.last_login_at ? new Date(user.last_login_at).toLocaleString("en-IN") : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-label)" }}>{label}</p>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Access Requests Tab ──────────────────────────────────────────────────────
const AccessRequestsTab = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [approvingId, setApprovingId] = useState(null);
  const [approvalRequest, setApprovalRequest] = useState(null);
  const [approvalPassword, setApprovalPassword] = useState("");
  const [roleSelect, setRoleSelect] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAccessRequests(filterStatus);
      setRequests(res.data);
    } catch { toast.error("Failed to load access requests."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const generatePassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const randomPart = Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    setApprovalPassword(`BundleMind@${randomPart}`);
  };

  const openApprovalModal = (req) => {
    setApprovalRequest(req);
    setApprovalPassword("");
  };

  const closeApprovalModal = () => {
    setApprovalRequest(null);
    setApprovalPassword("");
  };

  const handleApprove = async () => {
    if (!approvalRequest) return;
    const password = approvalPassword.trim();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    const req = approvalRequest;
    const role = roleSelect[req.id] || req.requested_role || "analyst";
    setApprovingId(req.id);
    try {
      await approveAccessRequest(req.id, { assigned_role: role, password });
      toast.success(`Approved ${req.name}. They can now log in with ${req.email} and the password you set.`, { duration: 8000 });
      closeApprovalModal();
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Approval failed."));
    } finally { setApprovingId(null); }
  };

  const handleReject = async (id) => {
    try {
      await rejectAccessRequest(id);
      toast.success("Request rejected.");
      load();
    } catch { toast.error("Failed to reject request."); }
  };

  const handleDelete = (id) => {
    setConfirmDeleteId(id);
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["pending", "approved", "rejected", ""].map((s) => (
          <button key={s || "all"} onClick={() => setFilterStatus(s)}
            className="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
            style={filterStatus === s
              ? { background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.1))", color: "var(--accent-green-text)", border: "1px solid rgba(16,185,129,0.25)" }
              : { background: "var(--btn-ghost-bg)", border: "1px solid var(--btn-ghost-border)", color: "var(--text-body)" }}>
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1.5 text-xs font-bold rounded-lg transition-all"
          style={{ background: "var(--btn-ghost-bg)", border: "1px solid var(--btn-ghost-border)", color: "var(--text-body)" }}>
          ↻ Refresh
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={card}>
        {loading ? (
          <div className="p-10 flex justify-center"><LoadingSpinner label="Loading requests..." /></div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>No {filterStatus || ""} access requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--divider)" }}>
                  {["Name", "Email", "Requested Role", "Status", "Submitted", "Actions"].map((h) => (
                    <th key={h} className="px-4 pb-3 pt-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="transition-colors hover:bg-[var(--row-hover)]" style={{ borderBottom: "1px solid var(--divider-subtle)" }}>
                    <td className="px-4 py-3.5 font-bold" style={{ color: "var(--text-primary)" }}>{req.name}</td>
                    <td className="px-4 py-3.5" style={{ color: "var(--text-body)" }}>{req.email}</td>
                    <td className="px-4 py-3.5"><RoleBadge role={req.requested_role} /></td>
                    <td className="px-4 py-3.5"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3.5 whitespace-nowrap" style={{ color: "var(--text-body)" }}>
                      {new Date(req.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3.5">
                      {req.status === "pending" ? (
                        <div className="flex items-center gap-2">
                          <select
                            className="text-[10px] rounded-lg px-2 py-1 border font-bold"
                            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                            value={roleSelect[req.id] || req.requested_role || "analyst"}
                            onChange={(e) => setRoleSelect((p) => ({ ...p, [req.id]: e.target.value }))}
                          >
                            {ROLES.filter(r => r !== "admin").map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <button
                            disabled={approvingId === req.id}
                            onClick={() => openApprovalModal(req)}
                            className="px-3 py-1 text-[10px] font-bold rounded-lg text-white transition-all active:scale-95 disabled:opacity-40"
                            style={{ background: "linear-gradient(135deg, var(--accent-green), var(--accent-cyan))" }}
                          >
                            {approvingId === req.id ? "..." : "Approve"}
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            className="px-3 py-1 text-[10px] font-bold rounded-lg transition-all active:scale-95"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <span className="text-[10px]" style={{ color: "var(--text-very-muted)" }}>
                            {getReviewerLabel(req)}
                          </span>
                          <button
                            onClick={() => handleDelete(req.id)}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all"
                            style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {approvalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={card}>
            <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              Approve Access
            </h3>
            <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
              Set the password for {approvalRequest.email}. The user will log in with this email and password.
            </p>

            <div className="space-y-4">
              <div className="rounded-xl p-3" style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-label)" }}>Assigned Role</p>
                <p className="text-sm font-semibold capitalize" style={{ color: "var(--text-primary)" }}>
                  {roleSelect[approvalRequest.id] || approvalRequest.requested_role || "analyst"}
                </p>
              </div>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-label)" }}>
                  Password
                </span>
                <input
                  type="text"
                  value={approvalPassword}
                  onChange={(e) => setApprovalPassword(e.target.value)}
                  placeholder="Enter password for this user"
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                />
              </label>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Minimum 8 characters. Share this password with the user after approval.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={generatePassword}
                className="px-3 py-2 text-xs font-bold rounded-lg transition-all"
                style={{ background: "var(--btn-ghost-bg)", border: "1px solid var(--btn-ghost-border)", color: "var(--text-body)" }}
              >
                Generate
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeApprovalModal}
                  className="px-4 py-2 text-xs font-bold rounded-lg transition-all"
                  style={{ background: "var(--btn-ghost-bg)", border: "1px solid var(--btn-ghost-border)", color: "var(--text-body)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={approvingId === approvalRequest.id}
                  onClick={handleApprove}
                  className="px-4 py-2 text-xs font-bold rounded-lg text-white transition-all active:scale-95 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, var(--accent-green), var(--accent-cyan))" }}
                >
                  {approvingId === approvalRequest.id ? "Approving..." : "Approve User"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={async () => {
          if (confirmDeleteId === null) return;
          try {
            await deleteAccessRequest(confirmDeleteId);
            toast.success("Request deleted.");
            load();
          } catch { toast.error("Failed to delete request."); }
        }}
        title="Delete Access Request"
        message="Are you sure you want to permanently delete this access request? This action cannot be undone."
        confirmText="Delete Request"
        cancelText="Cancel"
      />
    </div>
  );
};

// ─── User Management Tab ──────────────────────────────────────────────────────
const UserManagementTab = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const res = await getUsers(); setUsers(res.data); }
    catch { toast.error("Failed to load users."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (userId, role) => {
    try { await updateUserRole(userId, role); toast.success("Role updated."); load(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed to update role."); }
  };

  const handleStatusChange = async (userId, status) => {
    try { await updateUserStatus(userId, status); toast.success("Status updated."); load(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed to update status."); }
  };

  const handleDelete = (userId, name) => {
    setConfirmDeleteUser({ id: userId, name });
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={card}>
      <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: "1px solid var(--divider)" }}>
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Registered Users</h3>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{users.length} user{users.length !== 1 ? "s" : ""} in the system</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all"
          style={{ background: "var(--btn-ghost-bg)", border: "1px solid var(--btn-ghost-border)", color: "var(--text-body)" }}>
          ↻ Refresh
        </button>
      </div>
      {loading ? (
        <div className="p-10 flex justify-center"><LoadingSpinner label="Loading users..." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--divider)" }}>
                {["#", "Name", "Email", "Role", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-4 pb-3 pt-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => {
                const isMe = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="transition-colors hover:bg-[var(--row-hover)]"
                    style={{ borderBottom: "1px solid var(--divider-subtle)", opacity: u.status === "suspended" ? 0.6 : 1 }}>
                    <td className="px-4 py-3.5 font-bold" style={{ color: "var(--text-muted)" }}>#{idx + 1}</td>
                    <td className="px-4 py-3.5 font-bold" style={{ color: "var(--text-primary)" }}>
                      {u.full_name} {isMe && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-1" style={{ background: "rgba(16,185,129,0.12)", color: "var(--accent-green-text)" }}>YOU</span>}
                    </td>
                    <td className="px-4 py-3.5" style={{ color: "var(--text-body)" }}>{u.email}</td>
                    <td className="px-4 py-3.5">
                      {isMe || u.role === "admin" ? (
                        <RoleBadge role={u.role} />
                      ) : (
                        <select
                          className="text-[10px] rounded-lg px-2 py-1 border font-bold"
                          style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          {ROLES.filter(r => r !== "admin").map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3.5 whitespace-nowrap" style={{ color: "var(--text-body)" }}>
                      {new Date(u.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3.5">
                      {!isMe && u.role !== "admin" && (
                        <div className="flex gap-2">
                          {u.status !== "active" && (
                            <button onClick={() => handleStatusChange(u.id, "active")}
                              className="px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all"
                              style={{ background: "rgba(16,185,129,0.1)", color: "var(--accent-green-text)", border: "1px solid rgba(16,185,129,0.2)" }}>
                              Activate
                            </button>
                          )}
                          {u.status === "active" && (
                            <button onClick={() => handleStatusChange(u.id, "suspended")}
                              className="px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all"
                              style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
                              Suspend
                            </button>
                          )}
                          <button onClick={() => handleDelete(u.id, u.full_name)}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all"
                            style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmDeleteUser !== null}
        onClose={() => setConfirmDeleteUser(null)}
        onConfirm={async () => {
          if (!confirmDeleteUser) return;
          try {
            await deleteUser(confirmDeleteUser.id);
            toast.success("User deleted.");
            load();
          } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to delete user.");
          }
        }}
        title="Delete User"
        message={`Are you sure you want to permanently delete user "${confirmDeleteUser?.name}"? This action cannot be undone.`}
        confirmText="Delete User"
        cancelText="Cancel"
      />
    </div>
  );
};

// ─── Model Info Tab ───────────────────────────────────────────────────────────
const ModelInfoTab = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getModelStatus(),
      getMovementPredictions({ period_type: "month", selected_date: "2026-01-15", page: 1, limit: 1 }),
    ])
      .then(([modelResult, movementResult]) => {
        const modelStatus = modelResult.status === "fulfilled" ? modelResult.value.data : {};
        const movementModel = movementResult.status === "fulfilled" ? movementResult.value.data?.model : null;
        const movementStatus = movementModel
          ? {
              model_loaded: true,
              predictions_loaded: true,
              period_analysis_loaded: true,
              training_summary_loaded: true,
            }
          : null;
        setStatus({
          ...modelStatus,
          random_forest: movementStatus
            ? { ...(modelStatus.random_forest || {}), ...movementStatus }
            : modelStatus.random_forest,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const modelSections = status
    ? [
        {
          title: "Random Forest — Product Movement",
          icon: "🌲",
          color: status.random_forest?.model_loaded ? "var(--accent-green-text)" : "#f87171",
          bg: status.random_forest?.model_loaded ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          border: status.random_forest?.model_loaded ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
          statusText: status.random_forest?.model_loaded ? "Active" : "Inactive",
          items: [
            { label: "Model Loaded", value: status.random_forest?.model_loaded ? "✓ Yes" : "✗ No", ok: status.random_forest?.model_loaded },
            { label: "Predictions CSV", value: status.random_forest?.predictions_loaded ? "✓ Loaded" : "✗ Missing", ok: status.random_forest?.predictions_loaded },
            { label: "Training Summary", value: status.random_forest?.training_summary_loaded ? "✓ Loaded" : "✗ Missing", ok: status.random_forest?.training_summary_loaded },
            { label: "Algorithm", value: "Random Forest Classifier" },
            { label: "Target Classes", value: "Fast Moving / Medium Moving / Slow Moving" },
          ],
        },
        {
          title: "FP-Growth — Bundle Recommendations",
          icon: "🧩",
          color: status.fp_growth?.model_loaded ? "#a5b4fc" : "#f87171",
          bg: status.fp_growth?.model_loaded ? "rgba(99,102,241,0.08)" : "rgba(239,68,68,0.08)",
          border: status.fp_growth?.model_loaded ? "rgba(99,102,241,0.2)" : "rgba(239,68,68,0.2)",
          statusText: status.fp_growth?.model_loaded ? "Active" : "Inactive",
          items: [
            { label: "Model Loaded", value: status.fp_growth?.model_loaded ? "✓ Yes" : "✗ No", ok: status.fp_growth?.model_loaded },
            { label: "Recommendations CSV", value: status.fp_growth?.recommendations_loaded ? "✓ Loaded" : "✗ Missing", ok: status.fp_growth?.recommendations_loaded },
            { label: "Association Rules", value: status.fp_growth?.rules_loaded ? "✓ Loaded" : "✗ Missing", ok: status.fp_growth?.rules_loaded },
            { label: "Product Lookup", value: status.fp_growth?.product_lookup_loaded ? "✓ Loaded" : "✗ Missing", ok: status.fp_growth?.product_lookup_loaded },
            { label: "Algorithm", value: "FP-Growth (Frequent Pattern Mining)" },
            { label: "Output", value: "Association Rules + Bundle Sets" },
          ],
        },
        {
          title: "Demand Forecasting",
          icon: "📈",
          color: status.demand_forecasting?.model_loaded ? "var(--accent-cyan-text)" : "#f87171",
          bg: status.demand_forecasting?.model_loaded ? "rgba(6,182,212,0.08)" : "rgba(239,68,68,0.08)",
          border: status.demand_forecasting?.model_loaded ? "rgba(6,182,212,0.2)" : "rgba(239,68,68,0.2)",
          statusText: status.demand_forecasting?.model_loaded ? "Active" : "Inactive",
          items: [
            { label: "Model Loaded", value: status.demand_forecasting?.model_loaded ? "✓ Yes" : "✗ No", ok: status.demand_forecasting?.model_loaded },
            { label: "Type", value: status.demand_forecasting?.type || "Hybrid Ensemble Model" },
            { label: "Method", value: status.demand_forecasting?.method || "Prophet + HistGradientBoosting" },
            { label: "Data Source", value: status.demand_forecasting?.data_source || "Live MySQL transactions" },
            { label: "Retraining Required", value: status.demand_forecasting?.retraining_required || "No — computes on uploaded data" },
            { label: "Granularity", value: status.demand_forecasting?.granularity || "Daily / Weekly / Monthly" },
          ],
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner label="Loading model status..." /></div>
      ) : (
        modelSections.map((sec) => (
          <div key={sec.title} className="rounded-2xl p-6" style={{ ...card, borderLeft: `2px solid ${sec.border}` }}>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xl">{sec.icon}</span>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{sec.title}</h3>
              <span className="ml-auto text-[9px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"
                style={{ background: sec.bg, color: sec.color, border: `1px solid ${sec.border}` }}>
                {sec.statusText}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sec.items.map(({ label, value, ok }) => (
                <div key={label} className="flex justify-between items-center py-2.5 px-4 rounded-xl"
                  style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span className="text-[11px] font-bold ml-4 text-right"
                    style={{ color: ok === true ? "var(--accent-green-text)" : ok === false ? "#f87171" : "var(--text-body-strong)" }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

// ─── Main Settings Page ───────────────────────────────────────────────────────
const SettingsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = TAB_IDS.includes(requestedTab) ? requestedTab : "profile";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Enrich user with full profile from API if needed
  const [fullUser, setFullUser] = useState(null);
  useEffect(() => {
    import("../../services/userManagementService").then(({ getCurrentUser }) => {
      getCurrentUser().then((res) => setFullUser(res.data)).catch(() => setFullUser(user));
    });
  }, []);

  const displayUser = fullUser || user;

  const visibleTabs = TAB_IDS.filter((id) => !ADMIN_TABS.has(id) || isAdmin);
  const selectTab = (id) => {
    setActiveTab(id);
    setSearchParams({ tab: id }, { replace: true });
  };

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      selectTab("profile");
      return;
    }
    if (requestedTab !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, requestedTab, visibleTabs, setSearchParams]);

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      {/* Header */}
      <div className="rounded-2xl p-6" style={card}>
        <div className="flex items-center gap-4">
          <BrandMark size="lg" />
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{displayUser?.full_name || displayUser?.email || "User"}</h2>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{displayUser?.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <RoleBadge role={displayUser?.role} />
              <StatusBadge status={displayUser?.status} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}>
        {visibleTabs.map((id) => {
          const label = TAB_LABELS[TAB_IDS.indexOf(id)];
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => selectTab(id)}
              className="flex-1 px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200"
              style={isActive
                ? { background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.1))", color: "var(--accent-green-text)", border: "1px solid rgba(16,185,129,0.25)" }
                : { color: "var(--text-body)", border: "1px solid transparent" }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "profile" && <ProfileTab user={displayUser} />}
      {activeTab === "access-requests" && isAdmin && <AccessRequestsTab />}
      {activeTab === "users" && isAdmin && <UserManagementTab currentUser={displayUser} />}
      {activeTab === "model-info" && <ModelInfoTab />}
    </div>
  );
};

export default SettingsPage;

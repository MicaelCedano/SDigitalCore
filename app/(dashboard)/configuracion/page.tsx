"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SYSTEM_ROLES,
  SYSTEM_MODULES,
  DEFAULT_ROLE_MODULES,
  type AccessRequest,
  type SystemUser,
} from "@/lib/auth/roles-permissions";
import {
  approveAccessRequestAction,
  createDirectUserAction,
  deleteAccessRequestAction,
  deleteUserAction,
  getUserManagementDataAction,
  rejectAccessRequestAction,
  toggleUserModuleAction,
  toggleUserStatusAction,
  updateUserRoleAction,
} from "@/app/actions/user-management";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UserCheck,
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Clock,
  Mail,
  Phone,
  AtSign,
  User,
  LockKeyhole,
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<"requests" | "users">("users");

  // Reactive states
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modal state for approving request
  const [selectedReq, setSelectedReq] = useState<AccessRequest | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("VENTAS");
  const [selectedModulesForNewUser, setSelectedModulesForNewUser] = useState<string[]>([
    ...DEFAULT_ROLE_MODULES["VENTAS"],
  ]);

  // Modal state for Direct User Creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [directUserData, setDirectUserData] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    roleCode: "VENTAS",
  });
  const [directUserModules, setDirectUserModules] = useState<string[]>([
    ...DEFAULT_ROLE_MODULES["VENTAS"],
  ]);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Expanded user state for custom module toggling
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Notification Toast
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<SystemUser | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const result = await getUserManagementDataAction();
    if (result.success) {
      setUsers(result.data.users);
      setRequests(result.data.requests);
    } else {
      setActionNotice(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const historyRequests = requests.filter((r) => r.status !== "PENDING");

  function handleRoleChangeForNewUser(roleCode: string) {
    setSelectedRole(roleCode);
    setSelectedModulesForNewUser([...(DEFAULT_ROLE_MODULES[roleCode] ?? [])]);
  }

  function handleToggleModuleForNewUser(moduleKey: string) {
    if (selectedModulesForNewUser.includes(moduleKey)) {
      setSelectedModulesForNewUser(selectedModulesForNewUser.filter((m) => m !== moduleKey));
    } else {
      setSelectedModulesForNewUser([...selectedModulesForNewUser, moduleKey]);
    }
  }

  async function handleApprove() {
    if (!selectedReq) return;
    setIsSaving(true);
    const result = await approveAccessRequestAction(
      selectedReq.id,
      selectedRole,
      selectedModulesForNewUser
    );
    if (result.success) {
      await loadData();
      setActionNotice(
        `Â¡Cuenta activada! Usuario @${selectedReq.username} (${selectedReq.name}) registrado con ${selectedModulesForNewUser.length} mÃ³dulos.`
      );
      setSelectedReq(null);
      setTimeout(() => setActionNotice(null), 4000);
    } else {
      setActionNotice(result.error);
    }
    setIsSaving(false);
  }

  async function handleReject(reqId: string) {
    setIsSaving(true);
    const result = await rejectAccessRequestAction(reqId);
    if (result.success) {
      setRequests((current) => current.map((request) => request.id === reqId ? result.data : request));
      setActionNotice("Solicitud de acceso rechazada.");
    } else {
      setActionNotice(result.error);
    }
    setTimeout(() => setActionNotice(null), 3000);
    setIsSaving(false);
  }

  async function handleDeleteRequest(request: AccessRequest) {
    if (!window.confirm(`Â¿Eliminar definitivamente la solicitud de ${request.name}?`)) return;
    setIsSaving(true);
    const result = await deleteAccessRequestAction(request.id);
    if (result.success) {
      setRequests((current) => current.filter((item) => item.id !== request.id));
      setActionNotice("Solicitud eliminada de la base de datos.");
    } else {
      setActionNotice(result.error);
    }
    setTimeout(() => setActionNotice(null), 3000);
    setIsSaving(false);
  }

  // Direct User Creation Handler
  function handleDirectRoleChange(roleCode: string) {
    setDirectUserData({ ...directUserData, roleCode });
    setDirectUserModules([...(DEFAULT_ROLE_MODULES[roleCode] ?? [])]);
  }

  function handleToggleDirectModule(moduleKey: string) {
    if (directUserModules.includes(moduleKey)) {
      setDirectUserModules(directUserModules.filter((m) => m !== moduleKey));
    } else {
      setDirectUserModules([...directUserModules, moduleKey]);
    }
  }

  async function handleCreateDirectUserSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateErrors({});

    const errs: Record<string, string> = {};
    if (!directUserData.name.trim()) errs.name = "El nombre completo es requerido";
    if (!directUserData.username.trim()) errs.username = "El nombre de usuario es requerido";
    if (!directUserData.email.trim()) errs.email = "El correo es requerido";
    if (directUserData.phone.trim().length < 7) errs.phone = "El telÃ©fono debe tener al menos 7 caracteres";

    if (directUserData.password.length < 8) errs.password = "La contraseÃ±a debe tener al menos 8 caracteres";
    if (directUserData.password !== directUserData.confirmPassword) errs.confirmPassword = "Las contraseÃƒÂ±as no coinciden";

    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setIsSaving(true);
    const result = await createDirectUserAction({
      ...directUserData,
      allowedModules: directUserModules,
    });

    if (!result.success) {
      setCreateErrors({ form: result.error });
      setActionNotice(result.error);
      setIsSaving(false);
      return;
    }

    setUsers((current) => [result.data, ...current]);
    setShowCreateModal(false);
    setDirectUserData({ name: "", username: "", email: "", phone: "", password: "", confirmPassword: "", roleCode: "VENTAS" });
    setDirectUserModules([...DEFAULT_ROLE_MODULES["VENTAS"]]);
    setActionNotice(`Â¡Usuario @${result.data.username} (${result.data.name}) creado con Ã©xito!`);
    setTimeout(() => setActionNotice(null), 4000);
    setIsSaving(false);
  }

  async function handleUserRoleChange(userId: string, newRoleCode: string) {
    setIsSaving(true);
    const result = await updateUserRoleAction(userId, newRoleCode);
    if (result.success) {
      setUsers((current) => current.map((user) => user.id === userId ? result.data : user));
      setActionNotice("Rol y mÃ³dulos actualizados para el usuario.");
    } else setActionNotice(result.error);
    setTimeout(() => setActionNotice(null), 3000);
    setIsSaving(false);
  }

  async function handleToggleUserModule(userId: string, moduleKey: string) {
    setIsSaving(true);
    const result = await toggleUserModuleAction(userId, moduleKey);
    if (result.success) {
      setUsers((current) => current.map((user) => user.id === userId ? result.data : user));
      setActionNotice(`Acceso al mÃ³dulo "${moduleKey}" modificado.`);
    } else setActionNotice(result.error);
    setTimeout(() => setActionNotice(null), 2500);
    setIsSaving(false);
  }

  async function handleStatusToggle(userId: string) {
    setIsSaving(true);
    const result = await toggleUserStatusAction(userId);
    if (result.success) setUsers((current) => current.map((user) => user.id === userId ? result.data : user));
    else setActionNotice(result.error);
    setIsSaving(false);
  }

  function requestDeleteUser(user: SystemUser) {
    setPendingDeleteUser(user);
  }

  async function confirmDeleteUser() {
    if (!pendingDeleteUser) return;
    setIsSaving(true);
    const result = await deleteUserAction(pendingDeleteUser.id);
    if (result.success) {
      setUsers((current) => current.filter((user) => user.id !== pendingDeleteUser.id));
      setExpandedUserId((current) => current === pendingDeleteUser.id ? null : current);
      setActionNotice(`Usuario @${pendingDeleteUser.username} eliminado.`);
      setTimeout(() => setActionNotice(null), 3000);
    } else setActionNotice(result.error);
    setPendingDeleteUser(null);
    setIsSaving(false);
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>GestiÃ³n Individual de Usuarios & MÃ³dulos</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Crea usuarios directamente, aprueba solicitudes y activa/desactiva mÃ³dulos por usuario.
          </p>
        </div>

        {/* Action notification toast */}
        {actionNotice && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold animate-fade-in shadow-xs">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}
      </div>

      {/* Tabs & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-px">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
              activeTab === "users"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Users size={16} />
            <span>Usuarios Registrados ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
              activeTab === "requests"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <UserCheck size={16} />
            <span>Solicitudes Pendientes</span>
            {pendingRequests.length > 0 && (
              <Badge variant="default" className="ml-1 bg-indigo-600 text-white px-1.5 py-0 text-[10px]">
                {pendingRequests.length}
              </Badge>
            )}
          </button>
        </div>

        {/* CREATE DIRECT USER BUTTON */}
        <div className="pb-2 sm:pb-0">
          <Button
            variant="default"
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 font-semibold gap-1.5 text-xs shadow-xs"
            onClick={() => setShowCreateModal(true)}
            disabled={isLoading || isSaving}
          >
            <UserPlus size={15} />
            <span>+ Crear Usuario Directo</span>
          </Button>
        </div>
      </div>

      {/* TAB 1: CONTROL POR USUARIO ESPECÃFICO */}
      {activeTab === "users" && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-start gap-3 text-xs text-indigo-900">
            <AlertCircle size={18} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Permisos Individuales por Usuario:</strong>
              <p className="mt-0.5 text-indigo-800">
                Haz clic en <strong>"Gestionar MÃ³dulos"</strong> en cualquier usuario para activar o desactivar individualmente los mÃ³dulos a los que tendrÃ¡ acceso. O pulsa <strong>"+ Crear Usuario Directo"</strong> para registrar uno de forma inmediata.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <Card className="p-8 text-center text-sm text-slate-500">Cargando usuarios...</Card>
            ) : null}
            {users.map((u) => {
              const isExpanded = expandedUserId === u.id;
              const moduleCount = u.allowedModules.length;

              return (
                <Card key={u.id} className="border-slate-200/80 bg-white overflow-hidden shadow-2xs">
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{u.name}</h3>
                          <span className="text-xs font-semibold font-mono text-indigo-600">@{u.username}</span>
                          {u.status === "ACTIVE" ? (
                            <Badge variant="success" className="text-[10px]">Activo</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span>{u.email}</span>
                          <span>â€¢</span>
                          <span>{u.phone}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <span className="text-xs font-bold text-slate-800 block">
                          {u.roleCode === "ADMIN" ? "Acceso Total (Admin)" : `${moduleCount} / 12 MÃ³dulos`}
                        </span>
                        <span className={`text-[10px] font-bold ${u.roleCode === "ADMIN" ? "text-indigo-600" : u.roleCode === "ALMACEN" ? "text-blue-600" : "text-slate-400"}`}>
                          {u.roleCode === "ADMIN" ? "ADMINISTRADOR Â· Aprueba movimientos" : u.roleCode === "ALMACEN" ? "ALMACENISTA Â· Solicita movimientos" : `Rol: ${u.roleCode}`}
                        </span>
                      </div>

                      <select
                        value={u.roleCode}
                        onChange={(e) => handleUserRoleChange(u.id, e.target.value)}
                        disabled={isSaving}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        {SYSTEM_ROLES.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.name}
                          </option>
                        ))}
                      </select>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 border-slate-200"
                        onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                      >
                        <SlidersHorizontal size={14} className="text-indigo-600" />
                        <span>Gestionar MÃ³dulos</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-slate-500 hover:text-red-600"
                        onClick={() => handleStatusToggle(u.id)}
                        disabled={isSaving}
                      >
                        {u.status === "ACTIVE" ? "Bloquear" : "Activar"}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                        onClick={() => requestDeleteUser(u)}
                        disabled={isSaving}
                        title="Eliminar usuario"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>

                  {/* EXPANDABLE MODULE TOGGLES */}
                  {isExpanded && (
                    <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          MÃ³dulos Activos para {u.name} (@{u.username})
                        </h4>
                        {u.roleCode === "ADMIN" && (
                          <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            El rol Administrador tiene todos los mÃ³dulos habilitados por defecto
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {SYSTEM_MODULES.map((mod) => {
                          const isEnabled = u.roleCode === "ADMIN" || u.allowedModules.includes(mod.key);

                          return (
                            <button
                              key={mod.key}
                              disabled={u.roleCode === "ADMIN" || isSaving}
                              onClick={() => handleToggleUserModule(u.id, mod.key)}
                              className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                                isEnabled
                                  ? "bg-white border-indigo-200 shadow-2xs text-slate-900"
                                  : "bg-slate-100/70 border-slate-200 text-slate-400 opacity-60 hover:opacity-100"
                              } ${u.roleCode === "ADMIN" ? "cursor-not-allowed" : "cursor-pointer"}`}
            …1357 tokens truncated…r:bg-indigo-700"
                          onClick={() => {
                            setSelectedReq(req);
                            setSelectedRole("VENTAS");
                            setSelectedModulesForNewUser([...DEFAULT_ROLE_MODULES["VENTAS"]]);
                          }}
                          disabled={isSaving}
                        >
                          <UserCheck size={14} />
                          <span>Configurar & Aceptar</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Historial */}
          {historyRequests.length > 0 && (
            <div className="pt-6 border-t border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historial de Solicitudes</h3>
              <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Usuario</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">TelÃ©fono</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Rol Asignado</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900">{r.name}</td>
                        <td className="p-3 font-mono font-semibold text-indigo-600">@{r.username}</td>
                        <td className="p-3">{r.email}</td>
                        <td className="p-3">{r.phone}</td>
                        <td className="p-3">
                          {r.status === "APPROVED" ? (
                            <Badge variant="success">Aprobado</Badge>
                          ) : (
                            <Badge variant="destructive">Rechazado</Badge>
                          )}
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-700">{r.assignedRole ?? "â€”"}</td>
                        <td className="p-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => void handleDeleteRequest(r)}
                            disabled={isSaving}
                          >
                            <Trash2 size={14} />
                            Eliminar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL CREAR USUARIO DIRECTO */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus size={20} className="text-indigo-600" />
                <span>Crear Usuario Directamente</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDirectUserSubmit} className="space-y-4 text-xs">
              {createErrors.form && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg font-semibold">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{createErrors.form}</span>
                </div>
              )}
              {/* Name */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Nombre completo</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Ej. Mario Santos"
                    value={directUserData.name}
                    onChange={(e) => setDirectUserData({ ...directUserData, name: e.target.value })}
                    className={`pl-9.5 ${createErrors.name ? "border-red-500" : ""}`}
                  />
                </div>
                {createErrors.name && <p className="text-xs text-red-600 mt-0.5">{createErrors.name}</p>}
              </div>

              {/* Username & Phone grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Usuario</label>
                  <div className="relative flex items-center">
                    <AtSign className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="msantos"
                      value={directUserData.username}
                      onChange={(e) => setDirectUserData({ ...directUserData, username: e.target.value })}
                      className={`pl-9.5 ${createErrors.username ? "border-red-500" : ""}`}
                    />
                  </div>
                  {createErrors.username && <p className="text-xs text-red-600 mt-0.5">{createErrors.username}</p>}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">TelÃ©fono</label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      type="tel"
                      placeholder="809-555-0199"
                      value={directUserData.phone}
                      onChange={(e) => setDirectUserData({ ...directUserData, phone: e.target.value })}
                      className={`pl-9.5 ${createErrors.phone ? "border-red-500" : ""}`}
                    />
                  </div>
                  {createErrors.phone && <p className="text-xs text-red-600 mt-0.5">{createErrors.phone}</p>}
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">ContraseÃƒÂ±a inicial</label>
                  <div className="relative flex items-center">
                    <LockKeyhole className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      type="password"
                      placeholder="MÃƒÂ­nimo 6 caracteres"
                      value={directUserData.password}
                      onChange={(e) => setDirectUserData({ ...directUserData, password: e.target.value })}
                      autoComplete="new-password"
                      className={`pl-9.5 ${createErrors.password ? "border-red-500" : ""}`}
                    />
                  </div>
                  {createErrors.password && <p className="text-xs text-red-600 mt-0.5">{createErrors.password}</p>}
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Confirmar contraseÃƒÂ±a</label>
                  <div className="relative flex items-center">
                    <LockKeyhole className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      type="password"
                      placeholder="Repite la contraseÃƒÂ±a"
                      value={directUserData.confirmPassword}
                      onChange={(e) => setDirectUserData({ ...directUserData, confirmPassword: e.target.value })}
                      autoComplete="new-password"
                      className={`pl-9.5 ${createErrors.confirmPassword ? "border-red-500" : ""}`}
                    />
                  </div>
                  {createErrors.confirmPassword && <p className="text-xs text-red-600 mt-0.5">{createErrors.confirmPassword}</p>}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Correo electrÃ³nico</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    type="email"
                    placeholder="mario.santos@empresa.com"
                    value={directUserData.email}
                    onChange={(e) => setDirectUserData({ ...directUserData, email: e.target.value })}
                    className={`pl-9.5 ${createErrors.email ? "border-red-500" : ""}`}
                  />
                </div>
                {createErrors.email && <p className="text-xs text-red-600 mt-0.5">{createErrors.email}</p>}
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Rol Inicial</label>
                <p className="text-[11px] text-slate-500">Administrador: acceso total y aprobaciÃ³n de entradas/salidas. Almacenista: crea solicitudes; no modifica existencias hasta aprobaciÃ³n.</p>
                <select
                  value={directUserData.roleCode}
                  onChange={(e) => handleDirectRoleChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                >
                  {SYSTEM_ROLES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} â€” {r.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Module Checklist */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="font-bold text-slate-700 block">
                  MÃ³dulos Habilitados para este Usuario:
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                  {SYSTEM_MODULES.map((mod) => {
                    const isChecked = directUserModules.includes(mod.key);

                    return (
                      <label
                        key={mod.key}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-indigo-50/60 border-indigo-200 font-semibold text-indigo-900"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDirectModule(mod.key)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                        />
                        <span>{mod.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={isSaving}
                >
                  Crear y Activar Usuario
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURABLE AL APROBAR SOLICITUD */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck size={20} className="text-indigo-600" />
                <span>Configurar Permisos de {selectedReq.name}</span>
              </h3>
              <button
                onClick={() => setSelectedReq(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{selectedReq.name}</div>
                <div className="text-indigo-600 font-semibold font-mono">@{selectedReq.username}</div>
                <div className="text-slate-500">{selectedReq.email} â€¢ {selectedReq.phone}</div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  1. Asignar Rol Base:
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => handleRoleChangeForNewUser(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                >
                  {SYSTEM_ROLES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} â€” {r.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="font-bold text-slate-700 block">
                  2. Activar / Desactivar MÃ³dulos EspecÃ­ficos para este Usuario:
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {SYSTEM_MODULES.map((mod) => {
                    const isChecked = selectedModulesForNewUser.includes(mod.key);

                    return (
                      <label
                        key={mod.key}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-indigo-50/60 border-indigo-200 font-semibold text-indigo-900"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleModuleForNewUser(mod.key)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                        />
                        <span>{mod.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedReq(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={handleApprove}
                disabled={isSaving}
              >
                Confirmar y Aceptar Cuenta
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm animate-fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start gap-4 border-b border-slate-100 p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertCircle size={23} />
              </div>
              <div>
                <h2 id="delete-user-title" className="text-lg font-black text-slate-900">Eliminar usuario</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">Esta acciÃ³n no se puede deshacer.</p>
              </div>
            </div>
            <div className="p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">{pendingDeleteUser.name}</p>
                <p className="mt-1 text-xs font-semibold text-indigo-600">@{pendingDeleteUser.username}</p>
              </div>
              <p className="mt-4 text-sm text-slate-600">Â¿Quieres eliminar este usuario del sistema?</p>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setPendingDeleteUser(null)} disabled={isSaving}>Cancelar</Button>
                <Button className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDeleteUser} disabled={isSaving}>Eliminar usuario</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


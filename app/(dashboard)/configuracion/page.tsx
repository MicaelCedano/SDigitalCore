"use client";

import { useState } from "react";
import {
  SYSTEM_ROLES,
  SYSTEM_MODULES,
  DEFAULT_ROLE_MODULES,
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  createDirectUser,
  getUsers,
  updateUserRole,
  toggleUserModulePermission,
  toggleUserStatus,
  type AccessRequest,
  type SystemUser,
} from "@/lib/auth/roles-permissions";
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
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<"requests" | "users">("users");

  // Reactive states
  const [requests, setRequests] = useState<AccessRequest[]>(getAccessRequests());
  const [users, setUsers] = useState<SystemUser[]>(getUsers());

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

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const historyRequests = requests.filter((r) => r.status !== "PENDING");

  function handleRoleChangeForNewUser(roleCode: string) {
    setSelectedRole(roleCode);
    setSelectedModulesForNewUser([...(DEFAULT_ROLE_MODULES[roleCode] ?? ["inventario"])]);
  }

  function handleToggleModuleForNewUser(moduleKey: string) {
    if (selectedModulesForNewUser.includes(moduleKey)) {
      setSelectedModulesForNewUser(selectedModulesForNewUser.filter((m) => m !== moduleKey));
    } else {
      setSelectedModulesForNewUser([...selectedModulesForNewUser, moduleKey]);
    }
  }

  function handleApprove() {
    if (!selectedReq) return;
    const newUser = approveAccessRequest(
      selectedReq.id,
      selectedRole,
      selectedModulesForNewUser
    );
    if (newUser) {
      setRequests([...getAccessRequests()]);
      setUsers([...getUsers()]);
      setActionNotice(
        `Â¡Cuenta activada! Usuario @${selectedReq.username} (${selectedReq.name}) registrado con ${selectedModulesForNewUser.length} mÃ³dulos.`
      );
      setSelectedReq(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  }

  function handleReject(reqId: string) {
    rejectAccessRequest(reqId);
    setRequests([...getAccessRequests()]);
    setActionNotice("Solicitud de acceso rechazada.");
    setTimeout(() => setActionNotice(null), 3000);
  }

  // Direct User Creation Handler
  function handleDirectRoleChange(roleCode: string) {
    setDirectUserData({ ...directUserData, roleCode });
    setDirectUserModules([...(DEFAULT_ROLE_MODULES[roleCode] ?? ["inventario"])]);
  }

  function handleToggleDirectModule(moduleKey: string) {
    if (directUserModules.includes(moduleKey)) {
      setDirectUserModules(directUserModules.filter((m) => m !== moduleKey));
    } else {
      setDirectUserModules([...directUserModules, moduleKey]);
    }
  }

  function handleCreateDirectUserSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateErrors({});

    const errs: Record<string, string> = {};
    if (!directUserData.name.trim()) errs.name = "El nombre completo es requerido";
    if (!directUserData.username.trim()) errs.username = "El nombre de usuario es requerido";
    if (!directUserData.email.trim()) errs.email = "El correo es requerido";
    if (!directUserData.phone.trim()) errs.phone = "El telÃ©fono es requerido";

    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    const created = createDirectUser({
      ...directUserData,
      allowedModules: directUserModules,
    });

    setUsers([...getUsers()]);
    setShowCreateModal(false);
    setDirectUserData({ name: "", username: "", email: "", phone: "", roleCode: "VENTAS" });
    setDirectUserModules([...DEFAULT_ROLE_MODULES["VENTAS"]]);
    setActionNotice(`Â¡Usuario @${created.username} (${created.name}) creado con Ã©xito!`);
    setTimeout(() => setActionNotice(null), 4000);
  }

  function handleUserRoleChange(userId: string, newRoleCode: string) {
    updateUserRole(userId, newRoleCode);
    setUsers([...getUsers()]);
    setActionNotice(`Rol y mÃ³dulos actualizados para el usuario.`);
    setTimeout(() => setActionNotice(null), 3000);
  }

  function handleToggleUserModule(userId: string, moduleKey: string) {
    toggleUserModulePermission(userId, moduleKey);
    setUsers([...getUsers()]);
    setActionNotice(`Acceso al mÃ³dulo "${moduleKey}" modificado.`);
    setTimeout(() => setActionNotice(null), 2500);
  }

  function handleStatusToggle(userId: string) {
    toggleUserStatus(userId);
    setUsers([...getUsers()]);
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
                        <span className="text-[10px] text-slate-400">Rol: {u.roleCode}</span>
                      </div>

                      <select
                        value={u.roleCode}
                        onChange={(e) => handleUserRoleChange(u.id, e.target.value)}
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
                      >
                        {u.status === "ACTIVE" ? "Bloquear" : "Activar"}
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
                              disabled={u.roleCode === "ADMIN"}
                              onClick={() => handleToggleUserModule(u.id, mod.key)}
                              className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                                isEnabled
                                  ? "bg-white border-indigo-200 shadow-2xs text-slate-900"
                                  : "bg×Ÿv¶‰Ëkºwµç@€€€€€€€€€€€ñ	ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€Ù…É¥…¹Ğô‰‘•ÍÑÉÕÑ¥Ù”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€Í¥é”ô‰Í´ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰ ´àÑ•áĞµáÌÁà´È¸Ôˆ(€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹‘±•I•©•Ğ¡É•Ä¹¥¥ô(€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ña¥É±”Í¥é”õìÄÑô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùI•¡…é…Èğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½	ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€€€€€€€ñ	ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€Ù…É¥…¹Ğô‰‘•™…Õ±Ğˆ(€€€€€€€€€€€€€€€€€€€€€€€€€Í¥é”ô‰Í´ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰ ´àÑ•áĞµáÌÁà´Ì‰œµ¥¹‘¥¼´ØÀÀ¡½Ù•Èé‰œµ¥¹‘¥¼´ÜÀÀˆ(€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•ÑM•±•Ñ•‘I•Ä¡É•Ä¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•ÑM•±•Ñ•‘I½±” ‰Y9QLˆ¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•ÑM•±•Ñ•‘5½‘Õ±•Í½É9•İUÍ•È¡l¸¸¹U1Q}I=1}5=U1Ml‰Y9QL‰ut¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñUÍ•É¡•¬Í¥é”õìÄÑô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù½¹™¥ÕÉ…È€˜•ÁÑ…Èğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½	ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ğ½…É‘½¹Ñ•¹Ğø(€€€€€€€€€€€€€€€€ğ½…Éø(€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¥ô((€€€€€€€€€ì¼¨!¥ÍÑ½É¥…°€¨½ô(€€€€€€€€€í¡¥ÍÑ½ÉåI•ÅÕ•ÍÑÌ¹±•¹Ñ €ø€À€˜˜€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÁĞ´Ø‰½É‘•ÈµĞ‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÍÁ…”µä´Ìˆø(€€€€€€€€€€€€€€ñ Ì±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÍ±…Ñ”´ÔÀÀÕÁÁ•É…Í”ÑÉ…­¥¹œµİ¥‘•Èˆù!¥ÍÑ½É¥…°‘”M½±¥¥ÑÕ‘•Ìğ½ Ìø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½Ù•É™±½Üµàµ…ÕÑ¼‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µá°ˆø(€€€€€€€€€€€€€€€€ñÑ…‰±”±…ÍÍ9…µ”ô‰Üµ™Õ±°Ñ•áĞµ±•™ĞÑ•áĞµáÌÑ•áĞµÍ±…Ñ”´ØÀÀˆø(€€€€€€€€€€€€€€€€€€ñÑ¡•…±…ÍÍ9…µ”ô‰‰œµÍ±…Ñ”´ÔÀÑ•áĞµÍ±…Ñ”´ÔÀÀ™½¹Ğµ‰½±‰½É‘•Èµˆ‰½É‘•ÈµÍ±…Ñ”´ÈÀÀˆø(€€€€€€€€€€€€€€€€€€€€ñÑÈø(€€€€€€€€€€€€€€€€€€€€€€ñÑ ±…ÍÍ9…µ”ô‰À´Ìˆù9½µ‰É”ğ½Ñ ø(€€€€€€€€€€€€€€€€€€€€€€ñÑ ±…ÍÍ9…µ”ô‰À´ÌˆùUÍÕ…É¥¼ğ½Ñ ø(€€€€€€€€€€€€€€€€€€€€€€ñÑ ±…ÍÍ9…µ”ô‰À´Ìˆùµ…¥°ğ½Ñ ø(€€€€€€€€€€€€€€€€€€€€€€ñÑ ±…ÍÍ9…µ”ô‰À´ÌˆùQ•³¥™½¹¼ğ½Ñ ø(€€€€€€€€€€€€€€€€€€€€€€ñÑ ±…ÍÍ9…µ”ô‰À´ÌˆùÍÑ…‘¼ğ½Ñ ø(€€€€€€€€€€€€€€€€€€€€€€ñÑ ±…ÍÍ9…µ”ô‰À´ÌˆùI½°Í¥¹…‘¼ğ½Ñ ø(€€€€€€€€€€€€€€€€€€€€ğ½ÑÈø(€€€€€€€€€€€€€€€€€€ğ½Ñ¡•…ø(€€€€€€€€€€€€€€€€€€ñÑ‰½‘ä±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÍ±…Ñ”´ÄÀÀˆø(€€€€€€€€€€€€€€€€€€€í¡¥ÍÑ½ÉåI•ÅÕ•ÍÑÌ¹µ…À ¡È¤€ôø€ (€€€€€€€€€€€€€€€€€€€€€€ñÑÈ­•äõíÈ¹¥‘ô±…ÍÍ9…µ”ô‰¡½Ù•Èé‰œµÍ±…Ñ”´ÔÀˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰À´Ì™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÍ±…Ñ”´äÀÀˆùíÈ¹¹…µ•ôğ½Ñø(€€€€€€€€€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰À´Ì™½¹Ğµµ½¹¼™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ¥¹‘¥¼´ØÀÀˆùíÈ¹ÕÍ•É¹…µ•ôğ½Ñø(€€€€€€€€€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰À´ÌˆùíÈ¹•µ…¥±ôğ½Ñø(€€€€€€€€€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰À´ÌˆùíÈ¹Á¡½¹•ôğ½Ñø(€€€€€€€€€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰À´Ìˆø(€€€€€€€€€€€€€€€€€€€€€€€€€íÈ¹ÍÑ…ÑÕÌ€ôôô€‰AAI=Yˆ€ü€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ	…‘”Ù…É¥…¹Ğô‰ÍÕ•ÍÌˆùÁÉ½‰…‘¼ğ½	…‘”ø(€€€€€€€€€€€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ	…‘”Ù…É¥…¹Ğô‰‘•ÍÑÉÕÑ¥Ù”ˆùI•¡…é…‘¼ğ½	…‘”ø(€€€€€€€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€€€€€€€ğ½Ñø(€€€€€€€€€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰À´Ì™½¹Ğµµ½¹¼™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÍ±…Ñ”´ÜÀÀˆùíÈ¹…ÍÍ¥¹•‘I½±”€üü€‹ŠP‰ôğ½Ñø(€€€€€€€€€€€€€€€€€€€€€€ğ½ÑÈø(€€€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€€€ğ½Ñ‰½‘äø(€€€€€€€€€€€€€€€€ğ½Ñ…‰±”ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô((€€€€€ì¼¨5=0IHUMUI%<%IQ<€¨½ô(€€€€€íÍ¡½İÉ•…Ñ•5½‘…°€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ğ´Àè´ÔÀ‰œµÍ±…Ñ”´äÀÀ¼ØÀ‰…­‘É½Àµ‰±ÕÈµáÌ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÀ´Ğ…¹¥µ…Ñ”µ™…‘”µ¥¸ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•´Éá°µ…àµÜµ±œÜµ™Õ±°À´ØÍ¡…‘½Ü´Éá°ÍÁ…”µä´Ôµ…àµ µläÁÙ¡t½Ù•É™±½Üµäµ…ÕÑ¼ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Áˆ´Ì‰½É‘•Èµˆ‰½É‘•ÈµÍ±…Ñ”´ÄÀÀˆø(€€€€€€€€€€€€€€ñ Ì±…ÍÍ9…µ”ô‰Ñ•áĞµ‰…Í”™½¹Ğµ‰½±Ñ•áĞµÍ±…Ñ”´äÀÀ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€€€€€€€€€€€ñUÍ•ÉA±ÕÌÍ¥é”õìÈÁô±…ÍÍ9…µ”ô‰Ñ•áĞµ¥¹‘¥¼´ØÀÀˆ€¼ø(€€€€€€€€€€€€€€€€ñÍÁ…¸ùÉ•…ÈUÍÕ…É¥¼¥É•Ñ…µ•¹Ñ”ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ½ Ìø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•ÑM¡½İÉ•…Ñ•5½‘…°¡™…±Í”¥ô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ñ•áĞµÍ±…Ñ”´ĞÀÀ¡½Ù•ÈéÑ•áĞµÍ±…Ñ”´ØÀÀÀ´Äˆ(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€ña¥É±”Í¥é”õìÄáô€¼ø(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ™½É´½¹MÕ‰µ¥Ğõí¡…¹‘±•É•…Ñ•¥É•ÑUÍ•ÉMÕ‰µ¥Ñô±…ÍÍ9…µ”ô‰ÍÁ…”µä´ĞÑ•áĞµáÌˆø(€€€€€€€€€€€€€ì¼¨9…µ”€¨½ô(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Äˆø(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÍ±…Ñ”´ÜÀÀ‰±½¬ˆù9½µ‰É”½µÁ±•Ñ¼ğ½±…‰•°ø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±…Ñ¥Ù”™±•à¥Ñ•µÌµ•¹Ñ•Èˆø(€€€€€€€€€€€€€€€€€€ñUÍ•È±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ğ´ÌÜ´Ğ ´ĞÑ•áĞµÍ±…Ñ”´ĞÀÀÁ½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ˆ€¼ø(€€€€€€€€€€€€€€€€€€ñ%¹ÁÕĞ(€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Ñ•áĞˆ(€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰¨¸5…É¥¼M…¹Ñ½Ìˆ(€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí‘¥É•ÑUÍ•É…Ñ„¹¹…µ•ô(€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•Ñ¥É•ÑUÍ•É…Ñ„¡ì€¸¸¹‘¥É•ÑUÍ•É…Ñ„°¹…µ”è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁ°´ä¸Ô€‘íÉ•…Ñ•ÉÉ½ÉÌ¹¹…µ”€ü€‰‰½É‘•ÈµÉ•´ÔÀÀˆ€è€ˆ‰õô(€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€íÉ•…Ñ•ÉÉ½ÉÌ¹¹…µ”€˜˜€ñÀ±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ•´ØÀÀµĞ´À¸ÔˆùíÉ•…Ñ•ÉÉ½ÉÌ¹¹…µ•ôğ½Àùô(€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€ì¼¨UÍ•É¹…µ”€˜A¡½¹”É¥€¨½ô(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´ÄÍ´éÉ¥µ½±Ì´È…À´Ìˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Äˆø(€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÍ±…Ñ”´ÜÀÀ‰±½¬ˆùUÍÕ…É¥¼ğ½±…‰•°ø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±…Ñ¥Ù”™±•à¥Ñ•µÌµ•¹Ñ•Èˆø(€€€€€€€€€€€€€€€€€€€€ñÑM¥¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ğ´ÌÜ´Ğ ´ĞÑ•áĞµÍ±…Ñ”´ĞÀÀÁ½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ˆ€¼ø(€€€€€€€€€€€€€€€€€€€€ñ%¹ÁÕĞ(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Ñ•áĞˆ(€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰µÍ…¹Ñ½Ìˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí‘¥É•ÑUÍ•É…Ñ„¹ÕÍ•É¹…µ•ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•Ñ¥É•ÑUÍ•É…Ñ„¡ì€¸¸¹‘¥É•ÑUÍ•É…Ñ„°ÕÍ•É¹…µ”è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁ°´ä¸Ô€‘íÉ•…Ñ•ÉÉ½ÉÌ¹ÕÍ•É¹…µ”€ü€‰‰½É‘•ÈµÉ•´ÔÀÀˆ€è€ˆ‰õô(€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€íÉ•…Ñ•ÉÉ½ÉÌ¹ÕÍ•É¹…µ”€˜˜€ñÀ±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ•´ØÀÀµĞ´À¸ÔˆùíÉ•…Ñ•ÉÉ½ÉÌ¹ÕÍ•É¹…µ•ôğ½Àùô(€€€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Äˆø(€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÍ±…Ñ”´ÜÀÀ‰±½¬ˆùQ•³¥™½¹¼ğ½±…‰•°ø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±…Ñ¥Ù”™±•à¥Ñ•µÌµ•¹Ñ•Èˆø(€€€€€€€€€€€€€€€€€€€€ñA¡½¹”±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ğ´ÌÜ´Ğ ´ĞÑ•áĞµÍ±…Ñ”´ĞÀÀÁ½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ˆ€¼ø(€€€€€€€€€€€€€€€€€€€€ñ%¹ÁÕĞ(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Ñ•°ˆ(€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•ÈôˆàÀä´ÔÔÔ´ÀÄääˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí‘¥É•ÑUÍ•É…Ñ„¹Á¡½¹•ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•Ñ¥É•ÑUÍ•É…Ñ„¡ì€¸¸¹‘¥É•ÑUÍ•É…Ñ„°Á¡½¹”è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁ°´ä¸Ô€‘íÉ•…Ñ•ÉÉ½ÉÌ¹Á¡½¹”€ü€‰‰½É‘•ÈµÉ•´ÔÀÀˆ€è€ˆ‰õô(€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€íÉ•…Ñ•ÉÉ½ÉÌ¹Á¡½¹”€˜˜€ñÀ±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ•´ØÀÀµĞ´À¸ÔˆùíÉ•…Ñ•ÉÉ½ÉÌ¹Á¡½¹•ôğ½Àùô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€ì¼¨µ…¥°€¨½ô(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Äˆø(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÍ±…Ñ”´ÜÀÀ‰±½¬ˆù½ÉÉ•¼•±•ÑËÍ¹¥¼ğ½±…‰•°ø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±…Ñ¥Ù”™±•à¥Ñ•µÌµ•¹Ñ•Èˆø(€€€€€€€€€€€€€€€€€€ñ5…¥°±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ğ´ÌÜ´Ğ ´ĞÑ•áĞµÍ±…Ñ”´ĞÀÀÁ½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ˆ€¼ø(€€€€€€€€€€€€€€€€€€ñ%¹ÁÕĞ(€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰•µ…¥°ˆ(€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰µ…É¥¼¹Í…¹Ñ½Í•µÁÉ•Í„¹½´ˆ(€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí‘¥É•ÑUÍ•É…Ñ„¹•µ…¥±ô(€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•Ñ¥É•ÑUÍ•É…Ñ„¡ì€¸¸¹‘¥É•ÑUÍ•É…Ñ„°•µ…¥°è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁ°´ä¸Ô€‘íÉ•…Ñ•ÉÉ½ÉÌ¹•µ…¥°€ü€‰‰½É‘•ÈµÉ•´ÔÀÀˆ€è€ˆ‰õô(€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€íÉ•…Ñ•ÉÉ½ÉÌ¹•µ…¥°€˜˜€ñÀ±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ•´ØÀÀµĞ´À¸ÔˆùíÉ•…Ñ•ÉÉ½ÉÌ¹•µ…¥±ôğ½Àùô(€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€ì¼¨I½±”€¨½ô(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Äˆø(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÍ±…Ñ”´ÜÀÀ‰±½¬ˆùI½°%¹¥¥…°ğ½±…‰•°ø(€€€€€€€€€€€€€€€€ñÍ•±•Ğ(€€€€€€€€€€€€€€€€€Ù…±Õ”õí‘¥É•ÑUÍ•É…Ñ„¹É½±•½‘•ô(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôø¡…¹‘±•¥É•ÑI½±•¡…¹”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µ±œÀ´È¸ÔÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÍ±…Ñ”´äÀÀ™½ÕÌéÉ¥¹œ´È™½ÕÌéÉ¥¹œµ¥¹‘¥¼´ÔÀÀ¼ÈÀ™½ÕÌé‰½É‘•Èµ¥¹‘¥¼´ØÀÀ½ÕÑ±¥¹”µ¹½¹”ˆ(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€íMeMQ5}I=1L¹µ…À ¡È¤€ôø€ (€€€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸­•äõíÈ¹½‘•ôÙ…±Õ”õíÈ¹½‘•ôø(€€€€€€€€€€€€€€€€€€€€€íÈ¹¹…µ•ôƒŠPíÈ¹‘•ÍÉ¥ÁÑ¥½¹ô(€€€€€€€€€€€€€€€€€€€€ğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€ì¼¨5½‘Õ±”¡•­±¥ÍĞ€¨½ô(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´ÈÁĞ´Ä‰½É‘•ÈµĞ‰½É‘•ÈµÍ±…Ñ”´ÄÀÀˆø(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÍ±…Ñ”´ÜÀÀ‰±½¬ˆø(€€€€€€€€€€€€€€€€€7Í‘Õ±½Ì!…‰¥±¥Ñ…‘½ÌÁ…É„•ÍÑ”UÍÕ…É¥¼è(€€€€€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´Èµ…àµ ´ĞÀ½Ù•É™±½Üµäµ…ÕÑ¼À´Äˆø(€€€€€€€€€€€€€€€€€íMeMQ5}5=U1L¹µ…À ¡µ½¤€ôøì(€€€€€€€€€€€€€€€€€€€½¹ÍĞ¥Í¡•­•€ô‘¥É•ÑUÍ•É5½‘Õ±•Ì¹¥¹±Õ‘•Ì¡µ½¹­•ä¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°(€€€€€€€€€€€€€€€€€€€€€€€­•äõíµ½¹­•åô(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÀ´ÈÉ½Õ¹‘•µ±œ‰½É‘•ÈÑ•áĞµáÌÕÉÍ½ÈµÁ½¥¹Ñ•ÈÑÉ…¹Í¥Ñ¥½¸µ…±°€‘ì(€€€€€€€€€€€€€€€€€€€€€€€€€¥Í¡•­•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰‰œµ¥¹‘¥¼´ÔÀ¼ØÀ‰½É‘•Èµ¥¹‘¥¼´ÈÀÀ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ¥¹‘¥¼´äÀÀˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€‰‰œµİ¡¥Ñ”‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÑ•áĞµÍ±…Ñ”´ØÀÀ¡½Ù•Èé‰œµÍ±…Ñ”´ÔÀˆ(€€€€€€€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞ(€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰¡•­‰½àˆ(€€€€€€€€€€€€€€€€€€€€€€€€€¡•­•õí¥Í¡•­•‘ô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì ¤€ôø¡…¹‘±•Q½±•¥É•Ñ5½‘Õ±”¡µ½¹­•ä¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰É½Õ¹‘•Ñ•áĞµ¥¹‘¥¼´ØÀÀ™½ÕÌéÉ¥¹œµ¥¹‘¥¼´ÔÀÀ…•¹Ğµ¥¹‘¥¼´ØÀÀˆ(€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùíµ½¹±…‰•±ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹…À´ÈÁĞ´Ì‰½É‘•ÈµĞ‰½É‘•ÈµÍ±…Ñ”´ÄÀÀˆø(€€€€€€€€€€€€€€€€ñ	ÕÑÑ½¸(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€Ù…É¥…¹Ğô‰½ÕÑ±¥¹”ˆ(€€€€€€€€€€€€€€€€€Í¥é”ô‰Í´ˆ(€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•ÑM¡½İÉ•…Ñ•5½‘…°¡™…±Í”¥ô(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€…¹•±…È(€€€€€€€€€€€€€€€€ğ½	ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ	ÕÑÑ½¸(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰ÍÕ‰µ¥Ğˆ(€€€€€€€€€€€€€€€€€Ù…É¥…¹Ğô‰‘•™…Õ±Ğˆ(€€€€€€€€€€€€€€€€€Í¥é”ô‰Í´ˆ(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰‰œµ¥¹‘¥¼´ØÀÀ¡½Ù•Èé‰œµ¥¹‘¥¼´ÜÀÀˆ(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€É•…ÈäÑ¥Ù…ÈUÍÕ…É¥¼(€€€€€€€€€€€€€€€€ğ½	ÕÑÑ½¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½™½É´ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô((€€€€€ì¼¨5=0=9%UI	10AI=	HM=1%%QU€¨½ô(€€€€€íÍ•±•Ñ•‘I•Ä€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ğ´Àè´ÔÀ‰œµÍ±…Ñ”´äÀÀ¼ØÀ‰…­‘É½Àµ‰±ÕÈµáÌ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÀ´Ğ…¹¥µ…Ñ”µ™…‘”µ¥¸ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•´Éá°µ…àµÜµ±œÜµ™Õ±°À´ØÍ¡…‘½Ü´Éá°ÍÁ…”µä´Ôµ…àµ µläÁÙ¡t½Ù•É™±½Üµäµ…ÕÑ¼ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Áˆ´Ì‰½É‘•Èµˆ‰½É‘•ÈµÍ±…Ñ”´ÄÀÀˆø(€€€€€€€€€€€€€€ñ Ì±…ÍÍ9…µ”ô‰Ñ•áĞµ‰…Í”™½¹Ğµ‰½±Ñ•áĞµÍ±…Ñ”´äÀÀ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€€€€€€€€€€€ñUÍ•É¡•¬Í¥é”õìÈÁô±…ÍÍ9…µ”ô‰Ñ•áĞµ¥¹‘¥¼´ØÀÀˆ€¼ø(€€€€€€€€€€€€€€€€ñÍÁ…¸ù½¹™¥ÕÉ…ÈA•Éµ¥Í½Ì‘”íÍ•±•Ñ•‘I•Ä¹¹…µ•ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ½ Ìø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•ÑM•±•Ñ•‘I•Ä¡¹Õ±°¥ô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ñ•áĞµÍ±…Ñ”´ĞÀÀ¡½Ù•ÈéÑ•áĞµÍ±…Ñ”´ØÀÀÀ´Äˆ(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€ña¥É±”Í¥é”õìÄáô€¼ø(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´ĞÑ•áĞµáÌˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´Ì‰œµÍ±…Ñ”´ÔÀÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÄÀÀÍÁ…”µä´Äˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÍ±…Ñ”´äÀÀÑ•áĞµÍ´ˆùíÍ•±•Ñ•‘I•Ä¹¹…µ•ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ¥¹‘¥¼´ØÀÀ™½¹ĞµÍ•µ¥‰½±™½¹Ğµµ½¹¼ˆùíÍ•±•Ñ•‘I•Ä¹ÕÍ•É¹…µ•ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ±…Ñ”´ÔÀÀˆùíÍ•±•Ñ•‘I•Ä¹•µ…¥±ôƒŠˆíÍ•±•Ñ•‘I•Ä¹Á¡½¹•ôğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ä¸Ôˆø(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÍ±…Ñ”´ÜÀÀ‰±½¬ˆø(€€€€€€€€€€€€€€€€€€Ä¸Í¥¹…ÈI½°	…Í”è(€€€€€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€€€€€ñÍ•±•Ğ(€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘I½±•ô(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôø¡…¹‘±•I½±•¡…¹•½É9•İUÍ•È¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÉ½Õ¹‘•µ±œÀ´È¸ÔÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÍ±…Ñ”´äÀÀ™½ÕÌéÉ¥¹œ´È™½ÕÌéÉ¥¹œµ¥¹‘¥¼´ÔÀÀ¼ÈÀ™½ÕÌé‰½É‘•Èµ¥¹‘¥¼´ØÀÀ½ÕÑ±¥¹”µ¹½¹”ˆ(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€íMeMQ5}I=1L¹µ…À ¡È¤€ôø€ (€€€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸­•äõíÈ¹½‘•ôÙ…±Õ”õíÈ¹½‘•ôø(€€€€€€€€€€€€€€€€€€€€€íÈ¹¹…µ•ôƒŠPíÈ¹‘•ÍÉ¥ÁÑ¥½¹ô(€€€€€€€€€€€€€€€€€€€€ğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´ÈÁĞ´Ä‰½É‘•ÈµĞ‰½É‘•ÈµÍ±…Ñ”´ÄÀÀˆø(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÍ±…Ñ”´ÜÀÀ‰±½¬ˆø(€€€€€€€€€€€€€€€€€€È¸Ñ¥Ù…È€¼•Í…Ñ¥Ù…È7Í‘Õ±½ÌÍÁ•µ™¥½ÌÁ…É„•ÍÑ”UÍÕ…É¥¼è(€€€€€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´Èµ…àµ ´Ğà½Ù•É™±½Üµäµ…ÕÑ¼À´Äˆø(€€€€€€€€€€€€€€€€€íMeMQ5}5=U1L¹µ…À ¡µ½¤€ôøì(€€€€€€€€€€€€€€€€€€€½¹ÍĞ¥Í¡•­•€ôÍ•±•Ñ•‘5½‘Õ±•Í½É9•İUÍ•È¹¥¹±Õ‘•Ì¡µ½¹­•ä¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°(€€€€€€€€€€€€€€€€€€€€€€€­•äõíµ½¹­•åô(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÀ´ÈÉ½Õ¹‘•µ±œ‰½É‘•ÈÑ•áĞµáÌÕÉÍ½ÈµÁ½¥¹Ñ•ÈÑÉ…¹Í¥Ñ¥½¸µ…±°€‘ì(€€€€€€€€€€€€€€€€€€€€€€€€€¥Í¡•­•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰‰œµ¥¹‘¥¼´ÔÀ¼ØÀ‰½É‘•Èµ¥¹‘¥¼´ÈÀÀ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ¥¹‘¥¼´äÀÀˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€‰‰œµİ¡¥Ñ”‰½É‘•ÈµÍ±…Ñ”´ÈÀÀÑ•áĞµÍ±…Ñ”´ØÀÀ¡½Ù•Èé‰œµÍ±…Ñ”´ÔÀˆ(€€€€€€€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞ(€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰¡•­‰½àˆ(€€€€€€€€€€€€€€€€€€€€€€€€€¡•­•õí¥Í¡•­•‘ô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì ¤€ôø¡…¹‘±•Q½±•5½‘Õ±•½É9•İUÍ•È¡µ½¹­•ä¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰É½Õ¹‘•Ñ•áĞµ¥¹‘¥¼´ØÀÀ™½ÕÌéÉ¥¹œµ¥¹‘¥¼´ÔÀÀ…•¹Ğµ¥¹‘¥¼´ØÀÀˆ(€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùíµ½¹±…‰•±ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹…À´ÈÁĞ´Ì‰½É‘•ÈµĞ‰½É‘•ÈµÍ±…Ñ”´ÄÀÀˆø(€€€€€€€€€€€€€€ñ	ÕÑÑ½¸(€€€€€€€€€€€€€€€Ù…É¥…¹Ğô‰½ÕÑ±¥¹”ˆ(€€€€€€€€€€€€€€€Í¥é”ô‰Í´ˆ(€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•ÑM•±•Ñ•‘I•Ä¡¹Õ±°¥ô(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€…¹•±…È(€€€€€€€€€€€€€€ğ½	ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ	ÕÑÑ½¸(€€€€€€€€€€€€€€€Ù…É¥…¹Ğô‰‘•™…Õ±Ğˆ(€€€€€€€€€€€€€€€Í¥é”ô‰Í´ˆ(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰‰œµ¥¹‘¥¼´ØÀÀ¡½Ù•Èé‰œµ¥¹‘¥¼´ÜÀÀˆ(€€€€€€€€€€€€€€€½¹±¥¬õí¡…¹‘±•ÁÁÉ½Ù•ô(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€½¹™¥Éµ…Èä•ÁÑ…ÈÕ•¹Ñ„(€€€€€€€€€€€€€€ğ½	ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô(€€€€ğ½‘¥Øø(€€¤ì)ô
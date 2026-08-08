"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { changePasswordAction, getProfileAction, updateProfileAction } from "@/app/actions/profile";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  User,
  AtSign,
  Mail,
  Phone,
  Camera,
  Lock,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Building2,
  Trash2,
} from "lucide-react";

export default function PerfilPage() {
  const [profileUser, setProfileUser] = useState({
    id: "",
    name: "",
    username: "",
    email: "",
    phone: "",
    avatarUrl: "",
    roleCode: "",
  });
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    void getProfileAction().then((result) => {
      if (!result.success) {
        setNotice(result.error);
        setIsLoading(false);
        return;
      }
      const nextUser = {
        id: result.data.id,
        name: result.data.name ?? "",
        email: result.data.email,
        username: result.data.username ?? "",
        phone: result.data.phone ?? "",
        avatarUrl: result.data.image ?? "",
        roleCode: result.data.roleCode,
      };
      setProfileUser(nextUser);
      setName(nextUser.name);
      setEmail(nextUser.email);
      setUsername(nextUser.username);
      setPhone(nextUser.phone);
      setAvatarUrl(nextUser.avatarUrl ?? "");
      setIsLoading(false);
    });
  }, []);

  // Password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Notification Toast
  const [notice, setNotice] = useState<string | null>(null);

  // Handle Photo Upload
  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setAvatarUrl(base64);
      setNotice("Vista previa lista. Guarda los cambios para actualizar la foto.");
      setTimeout(() => setNotice(null), 3000);
    };
    reader.readAsDataURL(file);
  }

  function handleRemovePhoto() {
    setAvatarUrl("");
    setNotice("La foto se eliminará cuando guardes los cambios.");
    setTimeout(() => setNotice(null), 3000);
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await updateProfileAction({
      name,
      email,
      username,
      phone,
      avatarUrl,
    });
    if (!result.success) {
      setNotice(result.error || "No se pudo actualizar el perfil.");
      setTimeout(() => setNotice(null), 4000);
      return;
    }
    setProfileUser({ ...profileUser, name, email, username, phone, avatarUrl });
    setNotice(result.requiresRelogin ? "Perfil guardado. Cierra sesión y vuelve a entrar para activar el nuevo correo." : "¡Perfil actualizado con éxito!");
    setTimeout(() => setNotice(null), 3500);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (!newPassword || newPassword.length < 8) {
      setPasswordError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    const result = await changePasswordAction({ currentPassword, newPassword });
    if (!result.success) {
      setPasswordError(result.error);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNotice("¡Contraseña modificada correctamente!");
    setTimeout(() => setNotice(null), 3500);
  }

  function getInitials(n: string) {
    return n
      .split(" ")
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }

  if (isLoading) {
    return <Card className="mx-auto max-w-4xl p-10 text-center text-sm text-slate-500">Cargando perfil...</Card>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white border border-[#e2e8f0] rounded-[10px] shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1c2434] flex items-center gap-2">
            <span>Mi Perfil de Usuario</span>
          </h1>
          <p className="text-xs text-[#64748b] mt-1 font-medium">
            Actualiza tu foto de perfil, información personal y credenciales de seguridad.
          </p>
        </div>

        {notice && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-[#22ad5c]/10 border border-[#22ad5c]/20 text-[#22ad5c] rounded-lg text-xs font-bold animate-fade-in shadow-2xs">
            <CheckCircle2 size={16} className="text-[#22ad5c] shrink-0" />
            <span>{notice}</span>
          </div>
        )}
      </div>

      {/* Profile Overview Card */}
      <Card className="border-[#e2e8f0] bg-white overflow-hidden shadow-xs">
        <div className="p-6 flex flex-col sm:flex-row items-center gap-6 bg-gradient-to-r from-[#5750f1]/5 via-white to-white">
          {/* Avatar Container with Upload overlay */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white ring-4 ring-[#5750f1]/20 bg-[#5750f1] flex items-center justify-center text-white text-2xl font-bold shadow-md relative">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={name}
                  fill
                  className="object-cover"
                />
              ) : (
                <span>{getInitials(name)}</span>
              )}
            </div>

            {/* Camera Overlay Trigger */}
            <label
              htmlFor="avatar-upload"
              className="absolute inset-0 rounded-full bg-slate-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold cursor-pointer transition-opacity backdrop-blur-2xs"
            >
              <Camera size={20} />
              <span className="text-[10px] mt-0.5">Cambiar</span>
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>

          {/* User Details */}
          <div className="space-y-1 text-center sm:text-left flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-lg font-bold text-[#1c2434]">{name}</h2>
              <Badge variant="default" className="w-fit mx-auto sm:mx-0">
                Rol: {profileUser.roleCode}
              </Badge>
            </div>
            <p className="text-xs font-semibold font-mono text-[#5750f1]">@{username}</p>
            <p className="text-xs text-[#64748b]">{email}</p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <label
                htmlFor="avatar-upload"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5750f1] text-white rounded-md text-xs font-semibold hover:bg-[#463ecf] cursor-pointer transition-colors"
              >
                <Camera size={14} />
                <span>Subir Foto</span>
              </label>

              {avatarUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleRemovePhoto}
                >
                  <Trash2 size={13} />
                  <span>Quitar Foto</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-px">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
            activeTab === "profile"
              ? "border-[#5750f1] text-[#5750f1] bg-white"
              : "border-transparent text-[#64748b] hover:text-[#1c2434]"
          }`}
        >
          <User size={16} />
          <span>Información Personal</span>
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
            activeTab === "security"
              ? "border-[#5750f1] text-[#5750f1] bg-white"
              : "border-transparent text-[#64748b] hover:text-[#1c2434]"
          }`}
        >
          <Lock size={16} />
          <span>Seguridad & Contraseña</span>
        </button>
      </div>

      {/* TAB 1: PROFILE EDIT */}
      {activeTab === "profile" && (
        <Card className="border-[#e2e8f0] bg-white shadow-xs animate-fade-in">
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#1c2434]">Editar Datos de Perfil</CardTitle>
            <CardDescription>Modifica tu nombre, usuario y datos de contacto.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre completo */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1c2434] block">Nombre completo</label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3 w-4 h-4 text-[#8a99ad] pointer-events-none" />
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9.5"
                      required
                    />
                  </div>
                </div>

                {/* Usuario */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1c2434] block">Nombre de usuario</label>
                  <div className="relative flex items-center">
                    <AtSign className="absolute left-3 w-4 h-4 text-[#8a99ad] pointer-events-none" />
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-9.5 font-semibold text-[#5750f1]"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1c2434] block">Correo electrónico</label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 w-4 h-4 text-[#8a99ad] pointer-events-none" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9.5"
                    />
                  </div>
                  <span className="text-[10px] text-[#8a99ad]">Se validará que no esté usado por otra cuenta.</span>
                </div>

                {/* Teléfono */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1c2434] block">Teléfono / WhatsApp</label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-3 w-4 h-4 text-[#8a99ad] pointer-events-none" />
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9.5"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#f1f5f9] flex justify-end">
                <Button type="submit" variant="default" className="bg-[#5750f1] hover:bg-[#463ecf]">
                  Guardar Cambios de Perfil
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: SECURITY & PASSWORD */}
      {activeTab === "security" && (
        <Card className="border-[#e2e8f0] bg-white shadow-xs animate-fade-in">
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#1c2434]">Cambiar Contraseña</CardTitle>
            <CardDescription>Actualiza tu clave de acceso para mantener tu cuenta protegida.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
                  {passwordError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#1c2434] block">Contraseña actual</label>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-3 w-4 h-4 text-[#8a99ad] pointer-events-none" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pl-9.5"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#1c2434] block">Nueva contraseña</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-[#8a99ad] pointer-events-none" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-9.5"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#1c2434] block">Confirmar nueva contraseña</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-[#8a99ad] pointer-events-none" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9.5"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#f1f5f9] flex justify-end">
                <Button type="submit" variant="default" className="bg-[#5750f1] hover:bg-[#463ecf]">
                  Actualizar Contraseña
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

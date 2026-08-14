import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { syncQcWorkTasks } from "@/modules/centro-trabajo/integrations/qc";

function emptyWorkCenterData(userId: string, roleCode: string) {
  return {
    tasks: [],
    activeUsers: [],
    metrics: { action: 0, completedToday: 0, waiting: 0, overdue: 0 },
    currentUserId: userId,
    roleCode,
    schemaReady: false,
  };
}

export async function getWorkCenterData() {
  const sessionUser = await requirePermission("centro-trabajo.read");
  if (!sessionUser.id) throw new Error("La sesión no tiene un usuario persistido.");

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, roleCode: true, allowedModules: true },
  });
  if (!user) throw new Error("Usuario no encontrado.");

  try {
    await syncQcWorkTasks(user.id);

    const scope = user.roleCode === "ADMIN"
      ? {}
      : {
          OR: [
            { creatorId: user.id },
            { assigneeId: user.id },
            { assignees: { some: { userId: user.id } } },
            { sourceModule: { in: user.allowedModules } },
          ],
        };

    const tasks = await prisma.workTask.findMany({
      where: scope,
      include: {
        creator: { select: { name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true, image: true } },
        assignees: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
          orderBy: { assignedAt: "asc" },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { actor: { select: { name: true } } },
        },
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    const [activeUsers, completedToday, waiting] = await Promise.all([
      prisma.user.findMany({
        where: { status: "ACTIVE", allowedModules: { has: "centro-trabajo" } },
        select: { id: true, name: true, email: true, image: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
      prisma.workTask.count({
        where: {
          ...scope,
          status: "COMPLETED",
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.workTask.count({ where: { ...scope, status: "WAITING" } }),
    ]);

    const now = new Date();
    const overdue = tasks.filter(
      (task) => task.dueAt && task.dueAt < now && !["COMPLETED", "CANCELLED"].includes(task.status),
    ).length;

    return {
      tasks,
      activeUsers,
      metrics: {
        action: tasks.filter((task) => ["PENDING", "IN_PROGRESS", "IN_REVIEW"].includes(task.status)).length,
        completedToday,
        waiting,
        overdue,
      },
      currentUserId: user.id,
      roleCode: user.roleCode,
      schemaReady: true,
    };
  } catch (error) {
    if (!isMissingWorkCenterSchema(error)) throw error;
    console.error("[centro-trabajo] Falta aplicar la migración del Centro de trabajo.");
    return emptyWorkCenterData(user.id, user.roleCode);
  }
}

function isMissingWorkCenterSchema(error: unknown) {
  return error instanceof Error && /(work_task|work_task_event|work_task_assignee|P2021|does not exist)/i.test(error.message);
}

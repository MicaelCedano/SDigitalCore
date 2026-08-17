import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/helpers";
import { syncQcWorkTasks } from "@/modules/centro-trabajo/integrations/qc";
import { syncShipmentWorkTasks } from "@/modules/centro-trabajo/integrations/envios";
import { Prisma, WorkTaskStatus } from "@prisma/client";

const taskInclude = {
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
} satisfies Prisma.WorkTaskInclude;

type WorkTaskWithRelations = Prisma.WorkTaskGetPayload<{ include: typeof taskInclude }>;
type WorkCenterData = {
  tasks: WorkTaskWithRelations[];
  historyTasks: WorkTaskWithRelations[];
  activeUsers: { id: string; name: string | null; email: string; image: string | null }[];
  metrics: { action: number; completedToday: number; overdue: number };
  currentUserId: string;
  roleCode: string;
  schemaReady: boolean;
};

function emptyWorkCenterData(userId: string, roleCode: string): WorkCenterData {
  return {
    tasks: [],
    historyTasks: [],
    activeUsers: [],
    metrics: { action: 0, completedToday: 0, overdue: 0 },
    currentUserId: userId,
    roleCode,
    schemaReady: false,
  };
}

function startOfCurrentWeekInSantoDomingo() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santo_Domingo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const localDateAsUtc = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = localDateAsUtc.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(Date.UTC(year, month - 1, day - daysSinceMonday, 4));
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
    await syncShipmentWorkTasks(user.id);

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

    const weekStart = startOfCurrentWeekInSantoDomingo();
    const terminalStatuses: WorkTaskStatus[] = ["COMPLETED", "CANCELLED"];
    const currentTasksWhere: Prisma.WorkTaskWhereInput = {
      ...scope,
      OR: [
        { status: { notIn: terminalStatuses } },
        { status: { in: terminalStatuses }, completedAt: { gte: weekStart } },
        { status: { in: terminalStatuses }, completedAt: null },
      ],
    };
    const historyTasksWhere: Prisma.WorkTaskWhereInput = {
      ...scope,
      status: { in: terminalStatuses },
      completedAt: { lt: weekStart },
    };

    const tasks = await prisma.workTask.findMany({
      where: currentTasksWhere,
      include: taskInclude,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    const historyTasks = await prisma.workTask.findMany({
      where: historyTasksWhere,
      include: taskInclude,
      orderBy: { completedAt: "desc" },
    });

    const [activeUsers, completedToday] = await Promise.all([
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
          completedAt: { gte: weekStart },
        },
      }),
    ]);

    const now = new Date();
    const overdue = tasks.filter(
      (task) => task.dueAt && task.dueAt < now && !["COMPLETED", "CANCELLED"].includes(task.status),
    ).length;

    return {
      tasks,
      historyTasks,
      activeUsers,
      metrics: {
        action: tasks.filter((task) => ["PENDING", "IN_PROGRESS", "IN_REVIEW"].includes(task.status)).length,
        completedToday,
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

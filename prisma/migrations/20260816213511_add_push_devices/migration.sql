CREATE TYPE "push_device_platform" AS ENUM ('ANDROID');

CREATE TABLE "push_device" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "push_device_platform" NOT NULL,
    "app_version" VARCHAR(32),
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "push_device_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_device_token_key" ON "push_device"("token");
CREATE INDEX "push_device_user_id_platform_last_seen_at_idx" ON "push_device"("user_id", "platform", "last_seen_at");
ALTER TABLE "push_device" ADD CONSTRAINT "push_device_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_device" ENABLE ROW LEVEL SECURITY;

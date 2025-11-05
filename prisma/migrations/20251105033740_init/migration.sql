-- CreateEnum
CREATE TYPE "Status" AS ENUM ('CLAIMED', 'WAITING', 'EXPIRED');

-- CreateTable
CREATE TABLE "ParkingCode" (
    "codigo" TEXT NOT NULL,
    "status" "Status" NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingCode_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" TEXT,
    "ip" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "codigo" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

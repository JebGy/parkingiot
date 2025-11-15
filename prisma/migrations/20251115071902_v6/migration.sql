-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "space_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_space_id_status_idx" ON "Payment"("space_id", "status");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_codigo_fkey" FOREIGN KEY ("codigo") REFERENCES "ParkingCode"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

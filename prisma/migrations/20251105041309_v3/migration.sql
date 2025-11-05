-- CreateTable
CREATE TABLE "ParkingSpace" (
    "id" INTEGER NOT NULL,
    "occupied" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceLog" (
    "id" SERIAL NOT NULL,
    "space_id" INTEGER NOT NULL,
    "occupied" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "SpaceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpaceLog_space_id_timestamp_idx" ON "SpaceLog"("space_id", "timestamp");

-- AddForeignKey
ALTER TABLE "SpaceLog" ADD CONSTRAINT "SpaceLog_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "ParkingSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

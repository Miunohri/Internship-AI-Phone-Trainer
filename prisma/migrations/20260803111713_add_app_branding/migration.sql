-- CreateTable
CREATE TABLE "AppBranding" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "shopName" TEXT NOT NULL DEFAULT 'JB Import Auto',
    "logoUrl" TEXT NOT NULL DEFAULT '/jb-logo.png',
    "primaryColor" TEXT NOT NULL DEFAULT '#002f6b',
    "secondaryColor" TEXT NOT NULL DEFAULT '#5c7bb1',
    "accentColor" TEXT NOT NULL DEFAULT '#3b3a39',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppBranding_pkey" PRIMARY KEY ("id")
);

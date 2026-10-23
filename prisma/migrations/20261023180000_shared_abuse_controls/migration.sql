-- CreateTable
CREATE TABLE "RateBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AdminAuthState" (
    "id" TEXT NOT NULL DEFAULT 'admin',
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdminAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateBucket_expiresAt_idx" ON "RateBucket"("expiresAt");


ALTER TABLE "RateBucket" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "RateBucket" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "RateBucket" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "RateBucket" FROM authenticated; END IF;
END $$;

ALTER TABLE "AdminAuthState" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AdminAuthState" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "AdminAuthState" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "AdminAuthState" FROM authenticated; END IF;
END $$;

INSERT INTO "AdminAuthState" (id, version) VALUES ('admin', 0);

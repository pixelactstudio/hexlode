# Database and accounts stay in the code, unused

Drizzle, PostgreSQL and Better Auth stay in the repository although version 1 does not use them,
because the cloud mode that needs them is planned soon after. They must keep compiling, and no
version 1 feature may depend on them. `DATABASE_URL` is optional so a fresh clone runs without a
database.

-- Create the zitadel database and grant the heartbits user full access.
-- Runs automatically on first postgres start (docker-entrypoint-initdb.d).
-- The heartbits database already exists (POSTGRES_DB in docker-compose).

CREATE DATABASE zitadel;
GRANT ALL PRIVILEGES ON DATABASE zitadel TO heartbits;
\c zitadel
GRANT ALL ON SCHEMA public TO heartbits;

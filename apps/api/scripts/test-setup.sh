#!/bin/bash

echo "🧪 Setting up test environment for bioRxiv API..."

# Check if we're in CI environment (GitHub Actions)
if [ -n "$CI" ]; then
    echo "🚀 Running in CI environment (GitHub Actions)"
    PG_SUPERUSER="postgres"
    PG_HOST="localhost"
    PG_PASSWORD="postgres"
    DB_NAME="biorxiv_api"
else
    echo "💻 Running in local development environment"
    # Check if PostgreSQL is running
    if ! pg_isready -q; then
        echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
        echo "   On macOS: brew services start postgresql"
        echo "   On Ubuntu: sudo systemctl start postgresql"
        exit 1
    fi
    PG_SUPERUSER="postgres"
    PG_HOST="localhost"
    PG_PASSWORD="postgres"
    DB_NAME="biorxiv_api_test"
fi

echo "🔑 Setting up PostgreSQL database..."

PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -U "$PG_SUPERUSER" <<EOF
-- Check if user 'biorxiv' exists, create if not
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'biorxiv') THEN
        CREATE USER biorxiv WITH PASSWORD 'biorxiv' CREATEDB;
        RAISE NOTICE '✅ User ''biorxiv'' created with password ''biorxiv'' and database creation privileges';
    ELSE
        RAISE NOTICE '✅ User ''biorxiv'' already exists';
        -- Grant CREATEDB privilege if user already exists but doesn't have it
        ALTER USER biorxiv CREATEDB;
        RAISE NOTICE '🔐 Granted database creation privileges to existing user ''biorxiv''';
    END IF;
END
\$\$;

-- Drop database if it exists (for CI, always start fresh)
DROP DATABASE IF EXISTS $DB_NAME;
RAISE NOTICE '🗑️  Dropped existing database ''$DB_NAME''';

-- Create database
CREATE DATABASE $DB_NAME;
RAISE NOTICE '✅ Created database ''$DB_NAME''';

-- Grant privileges to biorxiv user on database
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO biorxiv;

-- Connect to database to grant schema privileges
\c $DB_NAME

-- Grant all privileges on public schema and future objects
GRANT ALL ON SCHEMA public TO biorxiv;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO biorxiv;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO biorxiv;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO biorxiv;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO biorxiv;

RAISE NOTICE '🔐 User ''biorxiv'' granted full privileges on ''biorxiv_api_test''';
EOF

if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL test database setup completed successfully"
else
    echo "❌ PostgreSQL test database setup failed"
    exit 1
fi

# Copy committed test environment file
echo "📝 Copying committed test environment file..."
cp env.test .env
echo "✅ .env file created from committed env.test"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run db:generate

# Push database schema to database
echo "🗄️  Setting up database schema..."
npx prisma migrate deploy

# Seed database
echo "🌱 Seeding database with sample data..."
npm run db:seed

echo ""
echo "🎉 Test environment setup complete!"
echo "   You can now run tests with:"
echo "   cd apps/api && npm test"
echo ""
if [ -n "$CI" ]; then
    echo "📚 CI database: $DB_NAME"
else
    echo "📚 Test database: $DB_NAME"
fi
echo "🔍 Test API keys: test-key:test-client, ci-key:ci-client"

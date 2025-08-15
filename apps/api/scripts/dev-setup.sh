#!/bin/bash

echo "🚀 Setting up bioRxiv Bucket API for local development..."

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    echo "   On macOS: brew services start postgresql"
    echo "   On Ubuntu: sudo systemctl start postgresql"
    exit 1
fi

# Setup PostgreSQL user and database (single password prompt)
PG_SUPERUSER="postgres"
echo "🔑 Setting up PostgreSQL user and database..."
echo "   (You'll be prompted for the PostgreSQL password once)"

psql -U "$PG_SUPERUSER" <<EOF
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

-- Clean up any unwanted 'biorxiv' database (same name as user)
DO \$\$
BEGIN
    IF EXISTS (SELECT FROM pg_database WHERE datname = 'biorxiv') THEN
        DROP DATABASE biorxiv;
        RAISE NOTICE '🗑️  Removed unwanted database ''biorxiv''';
    END IF;
END
\$\$;

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE biorxiv_api'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'biorxiv_api')\gexec

-- Grant privileges to biorxiv user on biorxiv_api database
GRANT ALL PRIVILEGES ON DATABASE biorxiv_api TO biorxiv;

-- Connect to biorxiv_api database to grant schema privileges
\c biorxiv_api

-- Grant all privileges on public schema and future objects
GRANT ALL ON SCHEMA public TO biorxiv;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO biorxiv;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO biorxiv;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO biorxiv;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO biorxiv;

-- Check if database was created or already existed
DO \$\$
BEGIN
    IF EXISTS (SELECT FROM pg_database WHERE datname = 'biorxiv_api') THEN
        RAISE NOTICE '✅ Database ''biorxiv_api'' is ready';
        RAISE NOTICE '🔐 User ''biorxiv'' granted full privileges on ''biorxiv_api''';
    END IF;
END
\$\$;
EOF

if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL setup completed successfully"
else
    echo "❌ PostgreSQL setup failed"
    exit 1
fi

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env with your database credentials"
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run db:generate

# Push database schema
echo "🗄️  Setting up database schema..."
npx prisma migrate deploy

# Seed database
echo "🌱 Seeding database with sample data..."
npm run db:seed

echo ""
echo "🎉 Setup complete! You can now:"
echo "   npm run dev          # Start development server"
echo "   npm run db:studio    # Open database viewer"
echo "   npm test             # Run tests"
echo ""
echo "📚 API will be available at: http://localhost:3001"
echo "🔍 Health check: http://localhost:3001/health"


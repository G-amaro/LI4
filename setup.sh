#!/usr/bin/env bash
# ================================================================
#  BragaConvenience Integrated System (BIS) - Monorepo Setup
#  Bash version (Mac / Linux / WSL / Git Bash)
#  DB: MySQL (nativo, sem Docker) via Pomelo EF Core provider
# ================================================================

set -e

echo ""
echo "================================================"
echo "  BIS Monorepo Setup - BragaConvenience"
echo "  DB: MySQL (nativo)"
echo "================================================"
echo ""

# ----------------------------------------------------------------
# 1. Root folder
# ----------------------------------------------------------------
echo "[1/6] A criar estrutura base do monorepo..."
mkdir -p BIS-Project
cd BIS-Project

mkdir -p docs/sql docs/diagrams

# ----------------------------------------------------------------
# 2. Backend API (.NET 8)
# ----------------------------------------------------------------
echo "[2/6] A inicializar backend-api (.NET 8 Web API)..."

dotnet new sln -n BIS > /dev/null
dotnet new webapi -n BIS.Api -o backend-api --use-controllers --framework net8.0 > /dev/null
dotnet new classlib -n BIS.Domain -o backend-api-domain --framework net8.0 > /dev/null
dotnet new classlib -n BIS.Infrastructure -o backend-api-infra --framework net8.0 > /dev/null

mv backend-api-domain backend-api/BIS.Domain
mv backend-api-infra  backend-api/BIS.Infrastructure

dotnet sln BIS.sln add backend-api/BIS.Api/BIS.Api.csproj > /dev/null
dotnet sln BIS.sln add backend-api/BIS.Domain/BIS.Domain.csproj > /dev/null
dotnet sln BIS.sln add backend-api/BIS.Infrastructure/BIS.Infrastructure.csproj > /dev/null

dotnet add backend-api/BIS.Api/BIS.Api.csproj reference backend-api/BIS.Domain/BIS.Domain.csproj > /dev/null
dotnet add backend-api/BIS.Api/BIS.Api.csproj reference backend-api/BIS.Infrastructure/BIS.Infrastructure.csproj > /dev/null
dotnet add backend-api/BIS.Infrastructure/BIS.Infrastructure.csproj reference backend-api/BIS.Domain/BIS.Domain.csproj > /dev/null

echo "      ... a instalar NuGet packages"
dotnet add backend-api/BIS.Api/BIS.Api.csproj package Microsoft.EntityFrameworkCore.Design --version 8.0.10 > /dev/null
dotnet add backend-api/BIS.Api/BIS.Api.csproj package Microsoft.AspNetCore.Authentication.JwtBearer --version 8.0.10 > /dev/null
dotnet add backend-api/BIS.Infrastructure/BIS.Infrastructure.csproj package Pomelo.EntityFrameworkCore.MySql --version 8.0.2 > /dev/null
dotnet add backend-api/BIS.Infrastructure/BIS.Infrastructure.csproj package Microsoft.EntityFrameworkCore --version 8.0.10 > /dev/null
dotnet add backend-api/BIS.Infrastructure/BIS.Infrastructure.csproj package BCrypt.Net-Next --version 4.0.3 > /dev/null

dotnet tool install --global dotnet-ef --version 8.0.10 2>/dev/null || echo "      dotnet-ef ja estava instalado, ok"

# ----------------------------------------------------------------
# 3. Backoffice Web (Vite + React + TS)
# ----------------------------------------------------------------
echo "[3/6] A inicializar backoffice-web (Vite + React + TS)..."

npm create vite@latest backoffice-web -- --template react-ts > /dev/null 2>&1
cd backoffice-web
npm install > /dev/null 2>&1
npm install -D tailwindcss@3.4.14 postcss autoprefixer > /dev/null 2>&1
npm install axios react-router-dom > /dev/null 2>&1
npx tailwindcss init -p > /dev/null 2>&1
cd ..

# ----------------------------------------------------------------
# 4. POS Terminal (Electron + React + TS via electron-vite)
# ----------------------------------------------------------------
echo "[4/6] A inicializar pos-terminal (Electron + React + TS)..."

npm create @quick-start/electron@latest pos-terminal -- --template react-ts --skip > /dev/null 2>&1
cd pos-terminal
npm install > /dev/null 2>&1
npm install better-sqlite3 axios > /dev/null 2>&1
npm install -D @types/better-sqlite3 tailwindcss@3.4.14 postcss autoprefixer > /dev/null 2>&1
npx tailwindcss init -p > /dev/null 2>&1
cd ..

# ----------------------------------------------------------------
# 5. Root files
# ----------------------------------------------------------------
echo "[5/6] A criar ficheiros raiz (.gitignore, README)..."

cat > .gitignore << 'EOF'
# ===== .NET =====
bin/
obj/
*.user
*.suo
.vs/

# ===== Node =====
node_modules/
dist/
dist-electron/
out/
.vite/
.turbo/

# ===== Env / secrets =====
.env
.env.local
appsettings.Development.json
appsettings.Local.json

# ===== OS =====
.DS_Store
Thumbs.db

# ===== IDE =====
.idea/
.vscode/*
!.vscode/settings.json
!.vscode/launch.json
!.vscode/extensions.json

# ===== SQLite local (POS) =====
*.db
*.sqlite
*.sqlite3
!schema.sqlite

# ===== Logs =====
*.log
logs/
EOF

cat > README.md << 'EOF'
# BragaConvenience Integrated System (BIS)

Projeto de Laboratórios de Informática IV — 2025/2026
Universidade do Minho — Engenharia Informática

## Estrutura do Monorepo

- `backend-api/`    — API REST em C# .NET 8 (Sede)
- `backoffice-web/` — Dashboard administrativo (React + Vite)
- `pos-terminal/`   — Terminal de loja (Electron + React)
- `docs/`           — Relatório, diagramas UML, scripts SQL

## Stack

- .NET 8 Web API + Entity Framework Core + MySQL (via Pomelo)
- React 18 + Vite + TypeScript + TailwindCSS
- Electron + better-sqlite3 (DB local do POS)

## Pré-requisitos

- .NET 8 SDK
- Node.js 20+
- MySQL 8.x a correr localmente (porta 3306 por defeito)

## Setup rápido

1. Criar base de dados MySQL:
   `CREATE DATABASE bis;`
2. Backend: `cd backend-api && dotnet run --project BIS.Api`
3. Backoffice: `cd backoffice-web && npm run dev`
4. POS: `cd pos-terminal && npm run dev`

## Autores

- Gonçalo Amaro (A106803)
- João Sousa (A106900)
- Dinis Machado
- Pedro Pereira
EOF

# ----------------------------------------------------------------
# 6. Git init
# ----------------------------------------------------------------
echo "[6/6] A inicializar repositório Git..."
git init -b main > /dev/null 2>&1
git add . > /dev/null 2>&1
git commit -m "chore: initial monorepo scaffold (api + backoffice + pos)" > /dev/null 2>&1

echo ""
echo "================================================"
echo "  Setup concluído!"
echo "================================================"
echo ""
echo "Estrutura criada em: $(pwd)"
echo ""
echo "Próximos passos:"
echo "  1. Criar a base de dados 'bis' no teu MySQL local:"
echo "     mysql -u root -p -e \"CREATE DATABASE bis;\""
echo "  2. Validar build: dotnet build BIS.sln"
echo "  3. Voltar ao Claude para avançar para o Data Model (EF Core)"
echo ""

# BIS — BragaConvenience Information System

Sistema de Gestão de Ponto de Venda para a cadeia BragaConvenience.  
Projecto académico LI4 · Universidade do Minho · 2025/2026

---

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│  AWS EC2 — 13.48.156.89                             │
│  ┌─────────────┐   ┌──────────────────────────────┐ │
│  │  MySQL 8    │   │  API .NET 8 (porta 5254)      │ │
│  │  base: bis  │◄──│  BIS.Api — sempre a correr    │ │
│  └─────────────┘   └──────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
           ▲                    ▲
           │                    │
   ┌───────┴────────┐   ┌───────┴────────┐
   │  Backoffice    │   │  POS Terminal  │
   │  React + Vite  │   │  Electron      │
   │  (browser)     │   │  (desktop)     │
   └────────────────┘   └────────────────┘
```

**A API corre sempre na AWS** — não precisas de ter .NET nem MySQL instalados.  
O backoffice e o POS ligam à API pela internet.

---

## Pré-requisitos (só uma vez)

- **Node.js** v18 ou superior → https://nodejs.org
- **Git** → https://git-scm.com

---

## Instalação (só uma vez)

```bash
git clone <url-do-repositorio>
cd BIS-Project

# Instalar dependências do backoffice
cd backoffice-web
npm install
cd ..

# Instalar dependências do POS
cd pos-terminal
npm install
cd ..
```

---

## Arrancar o sistema

### 1. Backoffice Web

```bash
cd backoffice-web

# Configurar URL da API (só na primeira vez)
echo 'VITE_API_BASE_URL=http://13.48.156.89:5254' > .env.local

# Arrancar
npm run dev
```

Abre o browser em **http://localhost:5173**

**Login:**
- Email: `orlando@bragaconvenience.pt`
- Password: `admin123`

---

### 2. POS Terminal

Cada loja tem o seu próprio terminal. Abre um terminal por loja:

```bash
cd pos-terminal

# Fraião
npm run dev:fraiao

# Centro
npm run dev:centro

# Gualtar
npm run dev:gualtar
```

**Credenciais POS:**

| Loja    | NIF         | PIN    | Perfil       |
|---------|-------------|--------|--------------|
| Fraião  | `223456781` | `0000` | Funcionário  |
| Centro  | `234567892` | `0000` | Funcionário  |
| Gualtar | `245678904` | `0000` | Funcionário  |

**Gerentes de loja** (PIN `1234`):
- Gerente Fraião, Gerente Centro, Gerente Gualtar

---

## Uso diário

### Para usar o sistema basta:

```bash
# Terminal 1 — Backoffice
cd backoffice-web && npm run dev

# Terminal 2 — POS Fraião
cd pos-terminal && npm run dev:fraiao
```

**Não precisas de arrancar nada na AWS** — a API está sempre a correr automaticamente.

### Se precisares de verificar que a API está online:

```bash
curl http://13.48.156.89:5254/api/catalogo
```

Se devolver uma lista de produtos, está tudo bem.

---

## Servidor AWS (manutenção)

### Ligar via SSH

```bash
ssh -i ~/.ssh/bis-key.pem ubuntu@13.48.156.89
```

> O ficheiro `bis-key.pem` está em `~/.ssh/bis-key.pem` no computador do Joao.  
> Outros membros do grupo precisam de pedir uma cópia deste ficheiro.

### Comandos úteis no servidor

```bash
# Ver estado da API
sudo systemctl status bis-api

# Reiniciar a API
sudo systemctl restart bis-api

# Ver logs da API em tempo real
sudo journalctl -u bis-api -f

# Verificar base de dados
mysql -u bis_user -pBisPassword2026! bis -e "SHOW TABLES;"
```

### Parar/Arrancar o servidor AWS

Se precisares de parar o servidor para poupar custos (o Free Tier dá 750h/mês):

1. **AWS Console → EC2 → Instances → bis-server**
2. **Instance State → Stop** para parar
3. **Instance State → Start** para arrancar

> ⚠️ O IP **13.48.156.89** é fixo (Elastic IP) — não muda quando pares e arranques.

---

## Actualizar a API na AWS

Quando fizeres alterações ao backend:

```bash
# 1. Compilar
cd backend-api
dotnet publish BIS.Api/BIS.Api.csproj \
  -c Release -r linux-x64 --self-contained false \
  -o /tmp/bis-api-publish

# 2. Enviar para a AWS
scp -i ~/.ssh/bis-key.pem /tmp/bis-api-publish/BIS.Api.dll \
  ubuntu@13.48.156.89:/home/ubuntu/bis-api/BIS.Api.dll

scp -i ~/.ssh/bis-key.pem /tmp/bis-api-publish/BIS.Api.pdb \
  ubuntu@13.48.156.89:/home/ubuntu/bis-api/BIS.Api.pdb

# 3. Reiniciar o serviço
ssh -i ~/.ssh/bis-key.pem ubuntu@13.48.156.89 \
  "sudo systemctl restart bis-api"
```

---

## Re-seed dos dados de demonstração

Se precisares de repor os dados de demo:

```bash
# 1. Limpar dados transacionais na AWS
ssh -i ~/.ssh/bis-key.pem ubuntu@13.48.156.89 << 'EOF'
mysql -u bis_user -pBisPassword2026! bis << 'SQL'
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE LinhasDevolucao; TRUNCATE TABLE Devolucoes;
TRUNCATE TABLE LinhasVenda;     TRUNCATE TABLE Vendas;
TRUNCATE TABLE LinhasRececao;   TRUNCATE TABLE Rececoes;
TRUNCATE TABLE Quebras;         TRUNCATE TABLE FechosCaixa;
TRUNCATE TABLE LinhasTransferencia; TRUNCATE TABLE Transferencias;
SET FOREIGN_KEY_CHECKS = 1;
SQL
EOF

# 2. Apagar BDs locais do POS
rm -f ~/.config/pos-terminal-fraiao/bis-pos.db
rm -f ~/.config/pos-terminal-centro/bis-pos.db
rm -f ~/.config/pos-terminal-gualtar/bis-pos.db

# 3. Correr o seed
node backend-api/seed-pos.js
```

---

## Estrutura do projecto

```
BIS-Project/
├── backend-api/          # API .NET 8 (corre na AWS)
│   ├── BIS.Api/          # Controllers, DTOs, Program.cs
│   ├── BIS.Domain/       # Entidades, Enums
│   ├── BIS.Infrastructure/ # DbContext, Migrations, DataSeeder
│   └── seed-pos.js       # Script de seed de dados de demo
│
├── backoffice-web/       # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/        # Dashboard, Inventário, Relatórios, etc.
│   │   ├── services/     # Chamadas à API
│   │   └── components/
│   └── .env.local        # URL da API (não vai para o git)
│
└── pos-terminal/         # Electron + React + SQLite
    ├── src/
    │   ├── main/         # Processo principal (Node/Electron)
    │   │   ├── business/ # Facades (lógica de negócio)
    │   │   ├── data/     # DAOs (SQLite)
    │   │   ├── ipc/      # Handlers IPC
    │   │   └── services/ # ApiClient, SincronizacaoFacade
    │   └── renderer/     # Interface React
    │       └── pages/    # Login, Dashboard, Venda, etc.
    └── package.json      # Scripts: dev:fraiao, dev:centro, dev:gualtar
```

---

## Casos de Uso implementados

| UC | Descrição | Onde |
|----|-----------|------|
| UC01 | Autenticação | POS → Login |
| UC02 | Devolução de artigos | POS → Devoluções |
| UC03 | Fecho de caixa | POS → Fecho de Caixa |
| UC05 | Consulta de inventário | Backoffice → Inventário |
| UC06 | Gestão de utilizadores | Backoffice → Utilizadores |
| UC07 | Venda | POS → Vendas |
| UC08 | Quebras de stock | POS → Quebras |
| UC09 | Receção de mercadoria | POS → Receções |
| UC10 | Transferência entre lojas | POS → Transferências |
| UC11 | Gestão de fornecedores | Backoffice → Fornecedores |
| UC12 | Relatórios financeiros | Backoffice → Relatórios |

---

## Tecnologias

| Componente | Tecnologia |
|-----------|-----------|
| API | C# .NET 8, Entity Framework Core, MySQL |
| Backoffice | React 19, Vite, Tailwind CSS |
| POS | Electron, React, better-sqlite3 (SQLite) |
| Base de dados central | MySQL 8 (AWS EC2) |
| Base de dados local | SQLite (por terminal POS) |
| Autenticação | JWT Bearer Token + BCrypt |
| Deploy | AWS EC2 t3.micro + Elastic IP |

---

## Contactos e informação

- **Projecto:** BIS — BragaConvenience Information System  
- **UC:** LI4 — Laboratório de Informática 4  
- **Instituição:** Universidade do Minho  
- **Ano:** 2025/2026  
- **API URL:** http://13.48.156.89:5254  
- **Swagger:** http://13.48.156.89:5254/swagger (ambiente Development)

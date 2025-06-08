# Estágio 1: Build da aplicação
FROM node:18-alpine AS builder

WORKDIR /app

# Copie package.json e package-lock.json (ou yarn.lock, pnpm-lock.yaml)
# Isso otimiza o cache do Docker. 'npm ci' só será reexecutado se estes arquivos mudarem.
COPY package.json package-lock.json* ./

# Instale TODAS as dependências, incluindo devDependencies (como tsup)
# npm ci é geralmente mais rápido e confiável para builds
RUN npm ci

# Copie o restante do código da aplicação
COPY . .

# Execute o script de build
RUN npm run build

# Estágio 2: Imagem de produção enxuta
FROM node:18-alpine

WORKDIR /app

# Copie apenas as dependências de PRODUÇÃO do estágio builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json* ./
RUN npm ci --omit=dev --only=production

# Copie os artefatos construídos (a pasta dist) do estágio builder
COPY --from=builder /app/dist ./dist

# Comando para iniciar a aplicação (o Railway fornecerá a PORTA via variável de ambiente)
CMD ["node", "dist/server.js"]
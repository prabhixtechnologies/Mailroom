# syntax=docker/dockerfile:1
# Base images come from AWS's public gallery rather than Docker Hub. These are the same
# Docker Official Images, mirrored by AWS, and the move takes Docker Hub's anonymous pull
# limit off the build path: a rate-limited base image fails the build for a reason that has
# nothing to do with the change being built.

# Build stage
FROM public.ecr.aws/docker/library/node:22-alpine AS build
WORKDIR /app
# Vendor file: packages under /app so Vite can resolve their peer deps from /app/node_modules.
COPY --from=webkit packages ./vendor/web-kit/packages
COPY package.json ./
# Host lockfiles are npm 8 / lockfileVersion 2. node:22-alpine ships npm 10, which
# rejects those on `npm ci` and crashes on `npm install` if the old lock is present.
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));const m={'@prabhix/brand':'file:./vendor/web-kit/packages/brand','@prabhix/oidc-client':'file:./vendor/web-kit/packages/oidc-client'};for (const [k,v] of Object.entries(m)){if(p.dependencies?.[k]?.startsWith('file:'))p.dependencies[k]=v;}fs.writeFileSync('package.json',JSON.stringify(p,null,2));"
RUN npm install --no-audit --no-fund
COPY . .
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));const m={'@prabhix/brand':'file:./vendor/web-kit/packages/brand','@prabhix/oidc-client':'file:./vendor/web-kit/packages/oidc-client'};for (const [k,v] of Object.entries(m)){if(p.dependencies?.[k]?.startsWith('file:'))p.dependencies[k]=v;}fs.writeFileSync('package.json',JSON.stringify(p,null,2));"
# Vite inlines import.meta.env.VITE_* at build time, so every var the app reads has to be declared
# here — an arg passed by Compose but not declared in this stage is silently discarded, and the app
# ships with the default instead.
ARG VITE_API_URL=http://localhost:8080
# Mailroom has no password form, so a blank issuer is not a degraded mode: there is nowhere to sign in
# at all. The app says so on screen rather than pretending.
# Local default matches Infra compose; production overrides.
ARG VITE_IDENTITY_ISSUER=http://localhost:8081
ARG VITE_ONEOPS_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_IDENTITY_ISSUER=$VITE_IDENTITY_ISSUER
ENV VITE_ONEOPS_URL=$VITE_ONEOPS_URL
RUN npm run build

# Production stage
FROM public.ecr.aws/docker/library/nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

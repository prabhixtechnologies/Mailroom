# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
# Vite inlines import.meta.env.VITE_* at build time, so every var the app reads has to be declared
# here — an arg passed by Compose but not declared in this stage is silently discarded, and the app
# ships with the default instead.
ARG VITE_API_URL=http://localhost:8080
# Mailroom has no password form, so a blank issuer is not a degraded mode: there is nowhere to sign in
# at all. The app says so on screen rather than pretending.
ARG VITE_IDENTITY_ISSUER=
ARG VITE_ONEOPS_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_IDENTITY_ISSUER=$VITE_IDENTITY_ISSUER
ENV VITE_ONEOPS_URL=$VITE_ONEOPS_URL
RUN npm run build

# Production stage
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

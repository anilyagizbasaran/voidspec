# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
# npm ci: package-lock.json'a birebir sadık, tekrarlanabilir kurulum.
RUN npm ci

COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine

RUN apk add --no-cache openssl

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.docker.conf /etc/nginx/conf.d/default.conf
COPY panel-locations.conf /etc/nginx/snippets/panel-locations.conf
COPY 40-selfsigned-cert.sh /docker-entrypoint.d/40-selfsigned-cert.sh
RUN chmod +x /docker-entrypoint.d/40-selfsigned-cert.sh

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]

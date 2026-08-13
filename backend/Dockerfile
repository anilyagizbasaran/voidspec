FROM node:20

RUN apt-get update && apt-get install -y sshpass openssh-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# npm ci: package-lock.json'a birebir sadık, tekrarlanabilir kurulum.
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]

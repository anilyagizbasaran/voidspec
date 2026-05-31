FROM node:20

RUN apt-get update && apt-get install -y sshpass openssh-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]

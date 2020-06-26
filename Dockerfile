FROM node:12.16.3
MAINTAINER rhythmbhiwani@gmail.com
COPY . /app
WORKDIR /app
RUN npm install
RUN npm install pm2 --global
ENTRYPOINT pm2-runtime start app.js -i max

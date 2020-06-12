FROM node:12.16.3
MAINTAINER rhythmbhiwani@gmail.com
COPY . /app
WORKDIR /app
RUN npm install
RUN npm install nodemon --global
ENTRYPOINT nodemon app.js

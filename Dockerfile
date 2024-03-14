FROM node:18.16.1-alpine

LABEL email="rhythmbhiwani@gmail.com" 

# Set the working directory
WORKDIR /app

RUN apk add --no-cache bash curl && curl -1sLf \
    'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.alpine.sh' | bash \
    && apk add infisical==0.16.10

# Copy only package.json and package-lock.json first to leverage Docker caching
COPY package.json package-lock.json ./

# Install dependencies and remove cache
RUN npm install --production && \
    npm cache clean --force

# Copy the rest of the application code
COPY . .

# Install pm2 globally and clean up after installation
RUN npm install pm2 -g --production && \
    npm cache clean --force

# Use the non-root user for better security (optional)
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

# Set the command to run the application with pm2
CMD ["pm2-runtime", "start", "app.js"]
CMD infisical run --path=/ --env=prod -- pm2-runtime start app.js

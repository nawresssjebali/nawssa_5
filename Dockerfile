# Use a smaller, Alpine-based Node.js 18.19.1 image
FROM node:18.19.1-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files for dependency installation
COPY package*.json ./

# Install only production dependencies to reduce size
RUN npm install --production --legacy-peer-deps


# Copy the rest of your source code
COPY . .

# Define production environment variable
ENV NODE_ENV=production

# Expose your app's port (change if not 3000)
EXPOSE 5000

# Start the app (update this if you don’t use server.js directly)
CMD ["npm", "start"]

# Start the app using the "start" script defined in package.json
CMD ["npm", "start"]



# Use Node 18.x (or another LTS version)
FROM node:18.19.1

# Set home directory for the app
ENV HOME=/home/app

# Install utilities like htop without recommendations to keep the image slim
RUN apt-get update && apt-get install -y --no-install-recommends htop && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy package.json from the project root
COPY package.json $HOME/

# Optional: copy package-lock.json if you have one
COPY package-lock.json $HOME/

# Install dependencies from package.json (in $HOME)
WORKDIR $HOME
RUN npm install --legacy-peer-deps --verbose

# Copy your application code (Backend folder)
COPY Backend/ $HOME/Backend/

# Set the working directory to Backend (where server.js lives)
WORKDIR $HOME/Backend

# Expose app port
EXPOSE 5000

# Start the app using the "start" script defined in package.json
CMD ["npm", "start"]


# Use Node 18.x (or another LTS version)
FROM node:18.19.1

# Set home directory for the app
ENV HOME=/home/app

# Install utilities like htop without recommendations to keep the image slim
RUN apt-get update && apt-get install -y --no-install-recommends htop && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy the entire project first (including Backend folder and package files)
COPY . $HOME/

# Set working directory to the root (where package.json is)
WORKDIR $HOME

# Install dependencies from package.json (in $HOME)
RUN npm install --legacy-peer-deps --verbose

# Set working directory to Backend (where server.js lives)
WORKDIR $HOME/Backend

# Expose app port
EXPOSE 5000

# Start the app using the "start" script defined in package.json
CMD ["npm", "start"]



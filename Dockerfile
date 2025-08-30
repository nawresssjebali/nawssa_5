# Use Node 18.x (or another LTS version that matches your engines field)
FROM node:18.19.1

# Set home directory for the app
ENV HOME=/home/app

# Install utilities like htop and clean up the apt cache
RUN apt-get update && apt-get install -y htop && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy the package files first to optimize caching
COPY package.json package-lock.json $HOME/Backend/

# Set working directory to Backend folder
WORKDIR $HOME/Backend

# Install dependencies silently
RUN npm install --legacy-peer-deps --verbose



# Copy the rest of the project files (Backend folder)
COPY Backend/ $HOME/Backend/

# Expose port 5000 for the app
EXPOSE 5000

# Optional: Run the build step if needed
# RUN npm run build --prod

# Start the app (if "start" script is defined in package.json)
CMD ["npm", "start"]

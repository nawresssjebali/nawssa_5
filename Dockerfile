# Use Node 18.x (or another LTS version that matches your engines field)
FROM node:18.19.1

# Set home directory for the app
ENV HOME=/home/app

# Install utilities like htop without recommendations to keep the image slim
RUN apt-get update && apt-get install -y --no-install-recommends htop && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy the entire Backend folder (including package files)
COPY Backend/ $HOME/Backend/

# Set working directory to Backend folder
WORKDIR $HOME/Backend

# Install dependencies silently
RUN npm install --legacy-peer-deps --verbose

# Expose port 5000 for the app
EXPOSE 5000

# Optional: Run the build step if needed
# RUN npm run build --prod

# Start the app (if "start" script is defined in package.json)
CMD ["npm", "start"]


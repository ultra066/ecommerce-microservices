# Use a lightweight Linux version of Node.js
FROM node:22-alpine

# Create a working directory inside the container
WORKDIR /app

# Copy dependency files first (optimizes caching)
COPY package*.json ./

# Install production dependencies
RUN npm install

# Copy the rest of your API code into the container
COPY . .

# Expose the port your Express server uses
EXPOSE 3001

# The command to start the server
CMD ["node", "index.js"]
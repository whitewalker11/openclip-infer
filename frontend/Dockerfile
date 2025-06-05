# Use a lightweight Nginx image
FROM nginx:1.25-alpine

# Remove the default Nginx welcome page.
RUN rm -rf /usr/share/nginx/html/*

# Copy the static assets from your project (HTML, CSS, JS)
# to the Nginx public directory.
# Assumes index.html, index.css, and the compiled index.js
# are in the same directory as this Dockerfile.
COPY index.html /usr/share/nginx/html/
COPY index.css /usr/share/nginx/html/
COPY index.js /usr/share/nginx/html/

# Expose port 80 (Nginx default HTTP port)
EXPOSE 80

# The default Nginx command will start the server.
# CMD ["nginx", "-g", "daemon off;"] is implicitly run by the base image.
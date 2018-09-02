# Set the base image
FROM 794167933507.dkr.ecr.us-west-2.amazonaws.com/nodejs:8.11.3
LABEL maintainer "Matt Rapczynski <rapczynskimatthew@fhda.edu>"

# Set user and working directory
USER docker
WORKDIR /home/docker

# Copy NPM configuration
COPY package.json /home/docker/

# Fetch latest Github host key
RUN ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts

# Install Node.js packages
RUN npm install

# Copy application source
COPY config config/
COPY src src/
COPY *.js *.json /home/docker/

# Fix file permissions
USER root
RUN chown -R docker:docker /home/docker
USER docker

# Set default run command
CMD npm start
# Set the base image
FROM 794167933507.dkr.ecr.us-west-2.amazonaws.com/oracle-instant-client-libs:2019-06-06.073532 as oracle
FROM node:12.16.1-buster
LABEL maintainer "Matt Rapczynski <rapczynskimatthew@fhda.edu>"

# Configure Oracle Instant Client
ENV LD_LIBRARY_PATH=/usr/local/lib
COPY --from=oracle /usr/local/lib/* /usr/local/lib/

# Set user and working directory
USER node
WORKDIR /home/node

# Copy package configuration
COPY --chown=node local-packages ./local-packages
COPY --chown=node package.json ./

# Install packages
RUN npm install

# Copy application source
COPY --chown=node config ./config/
COPY --chown=node src ./src/
COPY --chown=node *.js *.json ./

# Set default run command
CMD npm start 
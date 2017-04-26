# Set base image
FROM dockermgmt.ad.fhda.edu/ets/node-fhda:7.9.0
LABEL maintainer rapczynskimatthew@fhda.edu

# Install application dependencies
COPY package.json .
COPY yarn.lock .
RUN npm --quiet install

# Install application source code
COPY config/default.js config/default.js
COPY src src
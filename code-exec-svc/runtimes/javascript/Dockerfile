FROM node:20-slim

# Install utility packages only (NO NETWORK - containers are isolated)
RUN npm install -g \
    lodash@4.17.21 \
    moment@2.30.1

ENV NODE_PATH=/usr/local/lib/node_modules

# Copy seccomp profile for security hardening
COPY seccomp-profile.json /etc/docker/seccomp-profile.json

USER node
WORKDIR /home/node

CMD ["tail", "-f", "/dev/null"]

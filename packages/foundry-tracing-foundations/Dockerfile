# syntax=docker/dockerfile:1@sha256:b6afd42430b15f2d2a4c5a02b919e98a525b785b1aaff16747d2f623364e39b6
ARG NODE_VERSION=20.10.0
FROM --platform=amd64 node:${NODE_VERSION}-alpine

ARG FOUNDRY_TOKEN=undefined

ENV FOUNDRY_TOKEN=$FOUNDRY_TOKEN

WORKDIR /app

# Copy package files
COPY package*.json /app/

# Install all dependencies for building
RUN npm ci

# Copy source files
COPY tsconfig.build.json /app/
COPY src/ /app/src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm ci --only=production

# Create a non-root numeric user (must be numeric for compute modules)
RUN adduser --uid 5001 --disabled-password --gecos "" user && \
    chown -R 5001:5001 /app

USER 5001

# Environment setup
ENV NODE_ENV=production

# Verify directory structure
RUN ls -la /app/src/domain && \
    ls -la /app/src/services

# Specify the entrypoint explicitly as required
ENTRYPOINT ["node", "dist/src/computeModule.js"] 
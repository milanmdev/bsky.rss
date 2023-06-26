FROM node:lts

LABEL org.opencontainers.image.description "A configurable RSS poster for Bluesky"

WORKDIR /build
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
CMD yarn start
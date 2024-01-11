FROM node:lts

LABEL org.opencontainers.image.description "A configurable RSS poster for Bluesky"
LABEL org.opencontainers.image.source "https://github.com/milanmdev/bsky.rss"

WORKDIR /build
COPY package.json yarn.lock ./
COPY .yarn ./.yarn
COPY .yarnrc.yml ./
RUN yarn install --frozen-lockfile
COPY . .
CMD yarn start
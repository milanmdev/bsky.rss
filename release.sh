#!/bin/bash
# Check if Docker is available on the host machine
if ! command -v docker &> /dev/null
then
    echo "Docker could not be found"
    exit
fi
if ! command -v yarn &> /dev/null
then
    echo "Yarn could not be found"
    exit
fi

# Read package.json version
versionInit=$(cat ./package.json | yarn run -s underscore select '.version')
versionNoQuote=${versionInit//\"/}
version=$(echo $versionNoQuote | sed 's/[][]//g')

# Removing old images
echo "Removing old images..."
docker images | grep bsky.rss | tr -s ' ' | cut -d ' ' -f 2 | xargs -I {} docker rmi ghcr.io/milanmdev/bsky.rss:{} --force

if [ $(echo git rev-parse --abbrev-ref HEAD) != "main" ]
then
    echo "Building \"$(echo git rev-parse --abbrev-ref HEAD)\" branch image..."
    docker build . --platform linux/x86_64 -t ghcr.io/milanmdev/bsky.rss:$version
fi

# Build the production image
echo "Building the production image..."
docker build . --platform linux/x86_64 -t ghcr.io/milanmdev/bsky.rss:latest -t ghcr.io/milanmdev/bsky.rss:$version

# Push the production image
echo "Pushing the production image..."
#docker push ghcr.io/milanmdev/bsky.rss:$version && docker push ghcr.io/milanmdev/bsky.rss:latest
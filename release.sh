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
if ! command -v git &> /dev/null
then
    echo "Git could not be found"
    exit
fi

# Read package.json version
versionInit=$(cat ./package.json | yarn run underscore select '.version')
versionNoQuote=${versionInit//\"/}
version=$(echo $versionNoQuote | sed 's/[][]//g')
branch="$(git rev-parse --abbrev-ref HEAD)"

# Create builder
echo "Creating a new BuildKit builder"
docker buildx create --name multibuild --bootstrap --use

if [[ "$branch" != "main" ]]; then
    echo "Building & pushing \"$(git rev-parse --abbrev-ref HEAD)\" branch image..."
    docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/milanmdev/bsky.rss:$(git rev-parse --abbrev-ref HEAD)-$(git rev-parse --short HEAD) --push .
else
    echo "Building & pushing \"main\" branch image..."
    docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/milanmdev/bsky.rss:latest -t ghcr.io/milanmdev/bsky.rss:$version --push .
fi

# Remove the builder
echo "Removing the builder"
docker buildx rm multibuild
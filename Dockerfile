# -- Backend build --
# Pin SDK version to avoid supply-chain drift; update deliberately
FROM mcr.microsoft.com/dotnet/sdk:10.0.102 AS backend-build
ARG TARGETARCH
WORKDIR /build
COPY .editorconfig global.json ./
COPY Logo/ Logo/
COPY src/ src/
RUN dotnet_rid="linux-musl-$([ "$TARGETARCH" = "amd64" ] && echo x64 || echo $TARGETARCH)" && \
    dotnet publish src/NzbDrone.Console/Sonarr.Console.csproj \
    -c Release \
    -f net10.0 \
    -r "$dotnet_rid" \
    -o /app \
    --self-contained && \
    dotnet publish src/NzbDrone.Mono/Sonarr.Mono.csproj \
    -c Release \
    -f net10.0 \
    -r "$dotnet_rid" \
    -o /app-mono && \
    cp -rn /app-mono/* /app/

# -- Frontend build (arch-independent, always run natively) --
FROM --platform=$BUILDPLATFORM node:20.11.1-slim AS frontend-build
WORKDIR /build
COPY package.json yarn.lock .yarnrc ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY frontend/ frontend/
COPY tsconfig.json ./
RUN yarn build --env production

# -- Runtime image --
# TODO: Pin to a specific version tag (e.g. lscr.io/linuxserver/sonarr:4.x.y) to avoid supply-chain drift
FROM lscr.io/linuxserver/sonarr:latest

# Preserve ffprobe from the base image before replacing binaries
RUN cp /app/sonarr/bin/ffprobe /tmp/ffprobe

# Replace Sonarr binaries with our build
RUN rm -rf /app/sonarr/bin
COPY --from=backend-build /app /app/sonarr/bin
COPY --from=frontend-build /build/_output/UI /app/sonarr/bin/UI
RUN cp /tmp/ffprobe /app/sonarr/bin/ffprobe && chmod +x /app/sonarr/bin/ffprobe
# Update package info to reflect custom build
RUN echo -e "UpdateMethod=docker\nBranch=v5-develop\nPackageVersion=custom\nPackageAuthor=custom-build" > /app/sonarr/package_info

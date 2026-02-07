# -- Backend build --
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /build
COPY .editorconfig global.json ./
COPY Logo/ Logo/
COPY src/ src/
RUN dotnet publish src/NzbDrone.Console/Sonarr.Console.csproj \
    -c Release \
    -f net10.0 \
    -r linux-musl-x64 \
    -o /app \
    --self-contained

# -- Frontend build --
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY package.json yarn.lock .yarnrc ./
RUN yarn install --frozen-lockfile
COPY frontend/ frontend/
COPY tsconfig.json ./
RUN yarn build --env production

# -- Runtime image --
FROM lscr.io/linuxserver/sonarr:latest

# Replace Sonarr binaries with our build
RUN rm -rf /app/sonarr/bin
COPY --from=backend-build /app /app/sonarr/bin
COPY --from=frontend-build /build/_output/UI /app/sonarr/bin/UI

# Update package info to reflect custom build
RUN echo -e "UpdateMethod=docker\nBranch=v5-develop\nPackageVersion=custom\nPackageAuthor=custom-build" > /app/sonarr/package_info

#!/usr/bin/env bash
# Build and optionally test Sonarr inside a .NET SDK container.
#
# Usage:
#   ./build-docker.sh              # build only
#   ./build-docker.sh test         # build + run unit tests
#   ./build-docker.sh test "FullyQualifiedName~SomeFixture"  # run specific test filter

set -euo pipefail

SDK_IMAGE="mcr.microsoft.com/dotnet/sdk:10.0"
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
ACTION="${1:-build}"
TEST_FILTER="${2:-TestCategory!=ManualTest&TestCategory!=WINDOWS&TestCategory!=IntegrationTest&TestCategory!=AutomationTest}"

case "$ACTION" in
  build)
    echo "==> Building Sonarr solution..."
    docker run --rm \
      -v "$REPO_ROOT:/src" \
      -w /src \
      "$SDK_IMAGE" \
      dotnet build src/Sonarr.sln -warnaserror
    ;;

  test)
    echo "==> Building and testing Sonarr..."
    docker run --rm \
      -v "$REPO_ROOT:/src" \
      -w /src \
      "$SDK_IMAGE" \
      bash -c "dotnet build src/Sonarr.sln -warnaserror && dotnet test src/NzbDrone.Core.Test/Sonarr.Core.Test.csproj --filter \"$TEST_FILTER\" --no-build"
    ;;

  *)
    echo "Usage: $0 [build|test] [optional-test-filter]"
    exit 1
    ;;
esac

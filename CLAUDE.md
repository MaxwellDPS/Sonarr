# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sonarr is a PVR (Personal Video Recorder) for Usenet and BitTorrent users. It has a C# backend (ASP.NET Core / .NET 10.0) and a React/TypeScript frontend. The project uses two databases: SQLite (default) and PostgreSQL.

## Build & Development Commands

### Prerequisites
- .NET SDK 10.0.102 (see `global.json`)
- Node.js 20.11.1
- Yarn 1.22.22+

### Backend
```bash
# Build the solution
dotnet build src/Sonarr.sln

# Build for specific platform
dotnet build src/Sonarr.sln /p:Platform=Posix

# Run the application (default port 8989)
dotnet run --project src/NzbDrone.Console
```

### Frontend (run from repo root)
```bash
yarn install                # Install dependencies
yarn start                  # Watch mode for development
yarn build                  # Production build (outputs to _output/UI)
yarn lint                   # ESLint
yarn lint-fix               # ESLint with auto-fix
yarn stylelint              # CSS linting
```

### Testing
```bash
# Run all unit tests
dotnet test src/Sonarr.sln --filter "TestCategory!=ManualTest&TestCategory!=WINDOWS&TestCategory!=IntegrationTest&TestCategory!=AutomationTest"

# Run a specific test project
dotnet test src/NzbDrone.Core.Test/Sonarr.Core.Test.csproj

# Run a single test by name
dotnet test src/NzbDrone.Core.Test/Sonarr.Core.Test.csproj --filter "FullyQualifiedName~ConfigServiceFixture.Add_new_value"

# Run integration tests (requires running Sonarr instance)
dotnet test src/NzbDrone.Integration.Test/Sonarr.Integration.Test.csproj
```

## Architecture

### Project Naming
Projects use the legacy `NzbDrone.*` prefix for core libraries and `Sonarr.*` for API/HTTP layers:
- **NzbDrone.Common** - Shared utilities, disk/process/network operations
- **NzbDrone.Core** - Business logic, domain models, services, database access
- **NzbDrone.Host** - ASP.NET Core hosting, startup, middleware
- **Sonarr.Api.V5** - Current REST API controllers (route: `api/v5/`)
- **Sonarr.Api.V3** - Legacy API controllers (route: `api/v3/`)
- **Sonarr.Http** - HTTP infrastructure, REST base classes, authentication

### Dependency Injection
DryIoc container with assembly scanning. All interfaces are auto-registered as **singletons**, concrete types as **transient**. Services are resolved by constructor injection. Configuration is in `NzbDrone.Host/Bootstrap.cs` and `NzbDrone.Common/Composition/Extensions.cs`.

### Backend Layering
```
Controllers (Sonarr.Api.V5) → Services (NzbDrone.Core) → Repositories (NzbDrone.Core/Datastore) → Database
```

- **Controllers** extend `RestController<TResource>` or `RestControllerWithSignalR<TResource, TModel>`. They use `[V5ApiController]` attribute for routing and FluentValidation for input validation.
- **Services** implement business logic, can handle commands (`IExecute<TCommand>`) and events (`IHandle<TEvent>`).
- **Repositories** extend `BasicRepository<TModel>` using Dapper for SQL mapping. Models extend `ModelBase` (which provides `int Id`).
- **Resources** (API DTOs) extend `RestResource` with static mapper extension methods (`ToResource()`/`ToModel()`).

### Command & Event System
- **Commands**: Async operations modeled as classes extending `Command`. Executed by services implementing `IExecute<TCommand>`. Queued via `IManageCommandQueue`.
- **Events**: Published via `IEventAggregator.PublishEvent()`. Handlers implement `IHandle<TEvent>` (sync) or `IHandleAsync<TEvent>` (async).
- **SignalR**: `RestControllerWithSignalR` auto-broadcasts model changes to connected frontend clients.

### Database Migrations
FluentMigrator with sequentially numbered migrations in `NzbDrone.Core/Datastore/Migration/` (format: `XXX_description.cs`, e.g. `225_mediainfo_multiple_streams.cs`). Migrations extend `NzbDroneMigrationBase` and override `MainDbUpgrade()` or `LogDbUpgrade()`.

### Frontend Structure
- **Framework**: React 18 with TypeScript, Redux + Zustand for state, React Query for server state
- **Build**: Webpack 5, Babel, PostCSS with CSS Modules
- **Styling**: CSS Modules with typed exports, CSS variables, theme support (dark/light)
- **Organization**: Feature-based directories under `frontend/src/` (Series, Episodes, Calendar, Settings, etc.) with shared components in `Components/`

### Test Architecture
- **Framework**: NUnit with AutoMoqer (auto-mocking via DryIoc)
- **Base classes**: `TestBase<TSubject>` provides `Subject` (auto-resolved with mocks) and `Mocker` (for setting up mocks). `CoreTest` adds HTTP infrastructure. `DbTest` adds database support for integration-style tests.
- **Pattern**: Tests use `Mocker.GetMock<IDependency>()` to set up expectations, then call methods on `Subject`.

## Code Style

### Backend
- 4 spaces indentation, unix line endings
- Warnings treated as errors (StyleCop + FxCop analyzers enabled)
- File-scoped namespaces in newer code, block namespaces in Core

### Frontend
- 2 spaces indentation (per `.editorconfig`)
- ESLint + Prettier (single quotes, trailing commas)
- camelCase filenames matching exported component names
- Simple-import-sort for import ordering

## Contributing
- PRs target `v5-develop` branch only (never `main`)
- Rebase from `v5-develop`, don't merge
- One feature/bug fix per PR

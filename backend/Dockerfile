# Build stage with .NET 10 SDK
FROM mcr.microsoft.com/dotnet/sdk:10 AS build
WORKDIR /src

# Copy project files for caching restore layer
COPY Directory.Build.props Directory.Packages.props EventPlatform.sln ./
COPY src/EventPlatform.Core/EventPlatform.Core.csproj src/EventPlatform.Core/
COPY src/EventPlatform.Api/EventPlatform.Api.csproj src/EventPlatform.Api/
COPY src/EventPlatform.Workers/EventPlatform.Workers.csproj src/EventPlatform.Workers/
COPY tests/EventPlatform.Tests/EventPlatform.Tests.csproj tests/EventPlatform.Tests/

# Restore NuGet packages
RUN dotnet restore EventPlatform.sln

# Copy the rest of the source code and publish
COPY . .
RUN dotnet publish src/EventPlatform.Api/EventPlatform.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "EventPlatform.Api.dll"]

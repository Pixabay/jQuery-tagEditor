# Stage 1 - Build app
FROM mcr.microsoft.com/dotnet/sdk:6.0-alpine AS builder
COPY version version
RUN echo cat version